package se.snolage.app

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * "Dela position" while Snöläge is in the background or the screen is off:
 * a foreground service (an ongoing notification with "Stoppa") that follows
 * the position and sends it to the worker, with the same rules as
 * services/locationShare.ts – first fix, then a 50 m move at most once a
 * minute, or every 5 minutes standing still. It stops at the end time, when
 * the worker says the share is gone, or from the notification.
 *
 * Started by ShareLocationPlugin while the app is open, so it only needs the
 * ordinary location permission, not background location.
 */
class ShareLocationService : Service(), LocationListener {

    interface Listener {
        fun sent(lat: Double, lon: Double, accuracy: Float, at: Long)
        fun stopped(reason: String)
    }

    companion object {
        const val ACTION_STOP = "se.snolage.app.share.STOP"
        const val EXTRA_TOKEN = "token"
        const val EXTRA_URL = "url"
        const val EXTRA_ENDS_AT = "endsAt"
        const val EXTRA_TEXT = "text"
        const val EXTRA_STOP_TEXT = "stopText"
        const val SHARE_PATH = "/dela-position"

        private const val CHANNEL_ID = "share-position"
        private const val NOTIFICATION_ID = 4712
        private const val MIN_INTERVAL_MS = 60_000L
        private const val HEARTBEAT_MS = 5 * 60_000L
        private const val MIN_DISTANCE_M = 50f
        /** A network fix this soon after a GPS one is less precise; skip it. */
        private const val PREFER_GPS_MS = 2 * 60_000L

        // The web app's own record of a running share (Capacitor Preferences,
        // ACTIVE_KEY in services/locationShare.ts).
        private const val CAPACITOR_PREFS = "CapacitorStorage"
        private const val APP_SHARE_KEY = "fjallkoll:location-share"

        @Volatile
        var running = false
            private set

        /** The plugin, while the app is open, so the page hears about sends and stops. */
        @Volatile
        var listener: Listener? = null

        fun hasLocationPermission(context: Context) =
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
    }

    private val handler = Handler(Looper.getMainLooper())
    private val executor: ExecutorService = Executors.newSingleThreadExecutor()
    private var token: String? = null
    private var url: String? = null
    private var endsAt = 0L
    private var latest: Location? = null
    private var lastGpsAt = 0L
    private var lastSent: Location? = null
    private var lastSentAt = 0L
    private var sending = false
    private var finished = false

    private val endAtTime = Runnable { finish("ended") }
    private val heartbeat = object : Runnable {
        override fun run() {
            val fix = latest
            if (fix != null && System.currentTimeMillis() - lastSentAt >= HEARTBEAT_MS) send(fix)
            handler.postDelayed(this, MIN_INTERVAL_MS)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopFromNotification()
            return START_NOT_STICKY
        }
        val newToken = intent?.getStringExtra(EXTRA_TOKEN)
        val newUrl = intent?.getStringExtra(EXTRA_URL)
        val newEndsAt = intent?.getLongExtra(EXTRA_ENDS_AT, 0L) ?: 0L
        if (newToken.isNullOrEmpty() || newUrl.isNullOrEmpty() || newEndsAt <= System.currentTimeMillis() || !hasLocationPermission(this)) {
            stopSelf()
            return START_NOT_STICKY
        }
        token = newToken
        url = newUrl.trimEnd('/')
        endsAt = newEndsAt
        finished = false
        try {
            val notification = buildNotification(intent.getStringExtra(EXTRA_TEXT) ?: "Snöläge", intent.getStringExtra(EXTRA_STOP_TEXT) ?: "Stoppa")
            if (Build.VERSION.SDK_INT >= 29) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
        } catch (e: Exception) {
            // E.g. restarted by the system while the app is in the background,
            // which Android doesn't allow for location: the app restarts it when opened.
            stopSelf()
            return START_NOT_STICKY
        }
        startUpdates()
        handler.removeCallbacks(endAtTime)
        handler.postDelayed(endAtTime, endsAt - System.currentTimeMillis())
        handler.removeCallbacks(heartbeat)
        handler.postDelayed(heartbeat, MIN_INTERVAL_MS)
        running = true
        return START_REDELIVER_INTENT
    }

    private fun startUpdates() {
        val manager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        try {
            manager.removeUpdates(this)
            // Also a provider that is off right now: updates start when the user turns it on.
            for (provider in listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)) {
                if (provider in manager.allProviders) {
                    manager.requestLocationUpdates(provider, MIN_INTERVAL_MS, 0f, this, Looper.getMainLooper())
                }
            }
        } catch (e: SecurityException) {
            finish("gone")
        }
    }

    override fun onLocationChanged(location: Location) {
        val now = System.currentTimeMillis()
        if (location.provider == LocationManager.GPS_PROVIDER) {
            lastGpsAt = now
        } else if (now - lastGpsAt < PREFER_GPS_MS) {
            return
        }
        latest = location
        val previous = lastSent
        val due = previous == null ||
            now - lastSentAt >= HEARTBEAT_MS ||
            (now - lastSentAt >= MIN_INTERVAL_MS && location.distanceTo(previous) >= MIN_DISTANCE_M)
        if (due) send(location)
    }

    // Older Android versions call these and have no default bodies.
    override fun onProviderEnabled(provider: String) {}
    override fun onProviderDisabled(provider: String) {}
    @Deprecated("Only called on old Android versions")
    override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}

    private fun send(location: Location) {
        val token = token ?: return
        val url = url ?: return
        if (sending || finished) return
        sending = true
        executor.execute {
            var status = 0
            try {
                val body = JSONObject()
                    .put("lat", location.latitude)
                    .put("lon", location.longitude)
                    .put("accuracy", Math.round(location.accuracy))
                    // When the fix was taken: the heartbeat resends the last one when GPS is lost.
                    .put("at", fixTime(location))
                status = request("$url/location/position", "POST", token, body.toString())
            } catch (e: Exception) {
                // No coverage: the next fix or the heartbeat tries again.
            }
            handler.post {
                sending = false
                when {
                    status in 200..299 -> {
                        lastSent = location
                        lastSentAt = System.currentTimeMillis()
                        listener?.sent(location.latitude, location.longitude, location.accuracy, fixTime(location))
                    }
                    // Stopped or ended elsewhere, or logged out.
                    status == 404 || status == 401 -> finish("gone")
                }
            }
        }
    }

    /** The fix's own time, never later than now (a device clock can run ahead). */
    private fun fixTime(location: Location): Long =
        if (location.time > 0) minOf(location.time, System.currentTimeMillis()) else System.currentTimeMillis()

    private fun request(address: String, method: String, token: String, body: String?): Int {
        val connection = URL(address).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = method
            connection.connectTimeout = 20_000
            connection.readTimeout = 20_000
            connection.setRequestProperty("Authorization", "Bearer $token")
            if (body != null) {
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json")
                connection.outputStream.use { it.write(body.toByteArray()) }
            }
            return connection.responseCode
        } finally {
            connection.disconnect()
        }
    }

    /** "Stoppa" in the notification: same as stopping in the app – the position is deleted. */
    private fun stopFromNotification() {
        val token = token
        val url = url
        if (token != null && url != null) {
            executor.execute {
                try {
                    request("$url/location/share", "DELETE", token, null)
                } catch (e: Exception) {
                    // Offline: the share still ends by itself at its end time.
                }
            }
        }
        finish("stopped")
    }

    private fun finish(reason: String) {
        if (finished) return
        finished = true
        if (reason != "ended") {
            // The share is over, so the app shouldn't restart it or say it runs.
            getSharedPreferences(CAPACITOR_PREFS, Context.MODE_PRIVATE).edit().remove(APP_SHARE_KEY).apply()
        }
        listener?.stopped(reason)
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        running = false
        handler.removeCallbacksAndMessages(null)
        try {
            (getSystemService(Context.LOCATION_SERVICE) as LocationManager).removeUpdates(this)
        } catch (ignored: Exception) {
        }
        // Let a last DELETE finish before the thread goes.
        executor.shutdown()
        super.onDestroy()
    }

    private fun buildNotification(text: String, stopText: String): Notification {
        if (Build.VERSION.SDK_INT >= 26) {
            val sv = BackgroundImport.swedish()
            val channel = NotificationChannel(CHANNEL_ID, if (sv) "Dela position" else "Share location", NotificationManager.IMPORTANCE_LOW)
            channel.description =
                if (sv) "Visas medan Snöläge delar din position med dem du valt."
                else "Shown while Snöläge shares your location with the people you chose."
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
        val open = Intent(this, MainActivity::class.java)
            .putExtra(BackgroundImport.EXTRA_PATH, SHARE_PATH)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        val tap = PendingIntent.getActivity(this, 2, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val stop = PendingIntent.getService(
            this,
            3,
            Intent(this, ShareLocationService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_snolage)
            .setColor(ContextCompat.getColor(this, R.color.notification_accent))
            .setContentTitle("Snöläge")
            .setContentText(text)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_NAVIGATION)
            .setContentIntent(tap)
            .addAction(0, stopText, stop)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .build()
    }
}
