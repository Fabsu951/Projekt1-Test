package se.snolage.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import java.io.File

/**
 * "Spela in tur": records the GPS track while Snöläge is in the background or
 * the screen is off, like starting an activity in a sports app instead of on
 * the watch. A foreground service (ongoing notification with Pausa/Fortsätt)
 * appends every fix to a file in the app's own storage, so nothing needs
 * coverage and nothing is lost if the app is closed. The web app reads the
 * file (TourRecorderPlugin.read) and uploads the tour only when the user saves.
 *
 * File format, one line per entry (services/tourRecorder.ts parses it):
 *   lat,lon,elevation or empty,time ms,accuracy m   a fix
 *   P,time ms                                        paused
 *   R,time ms                                        resumed
 */
class TourRecorderService : Service(), LocationListener {

    companion object {
        const val ACTION_START = "se.snolage.app.record.START"
        const val ACTION_PAUSE = "se.snolage.app.record.PAUSE"
        const val ACTION_RESUME = "se.snolage.app.record.RESUME"
        const val ACTION_FINISH = "se.snolage.app.record.FINISH"
        const val RECORD_PATH = "/turer/spela-in"

        private const val CHANNEL_ID = "record-tour"
        private const val NOTIFICATION_ID = 4713
        private const val MIN_INTERVAL_MS = 3_000L
        private const val MIN_DISTANCE_M = 5f
        private const val PREFS = "snolage-recording"
        private const val KEY_STATE = "state"
        private const val KEY_STARTED = "startedAt"
        private const val KEY_PAUSED_MS = "pausedMs"
        private const val KEY_PAUSED_AT = "pausedAt"

        @Volatile
        var running = false
            private set

        fun file(context: Context) = File(context.filesDir, "tour-recording.txt")

        fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

        /** "idle", "recording", "paused" or "finished". */
        fun state(context: Context): String = prefs(context).getString(KEY_STATE, "idle") ?: "idle"

        fun startedAt(context: Context): Long = prefs(context).getLong(KEY_STARTED, 0L)

        /** Time spent paused so far, including a pause still going on. */
        fun pausedMs(context: Context): Long {
            val p = prefs(context)
            val since = p.getLong(KEY_PAUSED_AT, 0L)
            return p.getLong(KEY_PAUSED_MS, 0L) + if (since > 0) System.currentTimeMillis() - since else 0L
        }

        /** Fallback when the service can't be started: the track so far is what there is. */
        fun markFinished(context: Context) {
            val p = prefs(context)
            val since = p.getLong(KEY_PAUSED_AT, 0L)
            val edit = p.edit().putString(KEY_STATE, "finished").remove(KEY_PAUSED_AT)
            if (since > 0) edit.putLong(KEY_PAUSED_MS, p.getLong(KEY_PAUSED_MS, 0L) + (System.currentTimeMillis() - since))
            edit.apply()
        }

        fun discard(context: Context) {
            context.stopService(Intent(context, TourRecorderService::class.java))
            file(context).delete()
            prefs(context).edit().clear().apply()
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val now = System.currentTimeMillis()
        val p = prefs(this)
        when (intent?.action) {
            ACTION_START -> {
                file(this).delete()
                p.edit().clear().putString(KEY_STATE, "recording").putLong(KEY_STARTED, now).apply()
            }
            ACTION_PAUSE -> if (state(this) == "recording") {
                append("P,$now")
                p.edit().putString(KEY_STATE, "paused").putLong(KEY_PAUSED_AT, now).apply()
            }
            ACTION_RESUME -> if (state(this) == "paused") {
                append("R,$now")
                val since = p.getLong(KEY_PAUSED_AT, now)
                p.edit()
                    .putString(KEY_STATE, "recording")
                    .putLong(KEY_PAUSED_MS, p.getLong(KEY_PAUSED_MS, 0L) + (now - since))
                    .remove(KEY_PAUSED_AT)
                    .apply()
            }
            ACTION_FINISH -> {
                if (state(this) == "paused") {
                    val since = p.getLong(KEY_PAUSED_AT, now)
                    p.edit().putLong(KEY_PAUSED_MS, p.getLong(KEY_PAUSED_MS, 0L) + (now - since)).remove(KEY_PAUSED_AT).apply()
                }
                if (state(this) != "idle") p.edit().putString(KEY_STATE, "finished").apply()
            }
            // Restarted by the system (null intent): carry on with what was going on.
        }
        val current = state(this)
        // Started with startForegroundService, so Android wants a notification
        // even when the answer is to stop at once.
        try {
            val notification = buildNotification(current != "recording")
            if (Build.VERSION.SDK_INT >= 29) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
        } catch (e: Exception) {
            // Android refused (e.g. a restart while the app is in the background):
            // the recording stays saved and the app carries on when it is opened.
            stopSelf()
            return START_NOT_STICKY
        }
        if ((current != "recording" && current != "paused") || !ShareLocationService.hasLocationPermission(this)) {
            stopEverything()
            return START_NOT_STICKY
        }
        running = true
        if (current == "recording") startUpdates() else stopUpdates()
        return START_STICKY
    }

    private fun startUpdates() {
        val manager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        try {
            manager.removeUpdates(this)
            if (LocationManager.GPS_PROVIDER in manager.allProviders) {
                manager.requestLocationUpdates(LocationManager.GPS_PROVIDER, MIN_INTERVAL_MS, MIN_DISTANCE_M, this, Looper.getMainLooper())
            }
        } catch (e: SecurityException) {
            stopEverything()
        }
    }

    private fun stopUpdates() {
        try {
            (getSystemService(Context.LOCATION_SERVICE) as LocationManager).removeUpdates(this)
        } catch (ignored: Exception) {
        }
    }

    override fun onLocationChanged(location: Location) {
        if (state(this) != "recording") return
        val elevation: Double? = when {
            Build.VERSION.SDK_INT >= 34 && location.hasMslAltitude() -> location.mslAltitudeMeters
            location.hasAltitude() -> location.altitude
            else -> null
        }
        val time = if (location.time > 0) minOf(location.time, System.currentTimeMillis()) else System.currentTimeMillis()
        val accuracy = if (location.hasAccuracy()) Math.round(location.accuracy).toString() else ""
        val ele = elevation?.let { String.format(java.util.Locale.ROOT, "%.1f", it) } ?: ""
        append(String.format(java.util.Locale.ROOT, "%.6f,%.6f,%s,%d,%s", location.latitude, location.longitude, ele, time, accuracy))
    }

    // Older Android versions call these and have no default bodies.
    override fun onProviderEnabled(provider: String) {}
    override fun onProviderDisabled(provider: String) {}
    @Deprecated("Only called on old Android versions")
    override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}

    private fun append(line: String) {
        try {
            file(this).appendText(line + "\n")
        } catch (ignored: Exception) {
            // Out of space: nothing sensible to do but keep the track so far.
        }
    }

    private fun stopEverything() {
        stopUpdates()
        running = false
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        running = false
        stopUpdates()
        super.onDestroy()
    }

    private fun buildNotification(paused: Boolean): Notification {
        val sv = BackgroundImport.swedish()
        if (Build.VERSION.SDK_INT >= 26) {
            val channel = NotificationChannel(CHANNEL_ID, if (sv) "Spela in tur" else "Record tour", NotificationManager.IMPORTANCE_LOW)
            channel.description =
                if (sv) "Visas medan Snöläge spelar in din tur."
                else "Shown while Snöläge records your tour."
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
        val open = Intent(this, MainActivity::class.java)
            .putExtra(BackgroundImport.EXTRA_PATH, RECORD_PATH)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        val tap = PendingIntent.getActivity(this, 5, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val toggle = PendingIntent.getService(
            this,
            6,
            Intent(this, TourRecorderService::class.java).setAction(if (paused) ACTION_RESUME else ACTION_PAUSE),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_snolage)
            .setColor(ContextCompat.getColor(this, R.color.notification_accent))
            .setContentTitle(if (paused) (if (sv) "Turen är pausad" else "Tour paused") else (if (sv) "Snöläge spelar in din tur" else "Snöläge is recording your tour"))
            .setContentText(if (sv) "Tryck för att se turen eller avsluta den." else "Tap to see the tour or finish it.")
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory("workout") // Notification.CATEGORY_WORKOUT (API 31)
            .setContentIntent(tap)
            .addAction(0, if (paused) (if (sv) "Fortsätt" else "Resume") else (if (sv) "Pausa" else "Pause"), toggle)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
        if (!paused) {
            // A running clock of the time spent moving, kept by Android itself.
            builder.setUsesChronometer(true).setShowWhen(true).setWhen(startedAt(this) + pausedMs(this))
        }
        return builder.build()
    }
}
