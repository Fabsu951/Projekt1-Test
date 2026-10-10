package se.snolage.app

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import org.json.JSONArray
import java.util.concurrent.TimeUnit

/**
 * "Påminn mig om nya skidpass": a check about once an hour, also when the
 * app is closed, for new winter sessions the watch's app has written to
 * Health Connect. It only posts a notification; the tour is created when the
 * user taps it and the app opens /turer/halsa, because on Android 14 Health
 * Connect hands out another app's GPS route only after a per-session yes in
 * its own dialog. Nothing leaves the phone in the background.
 */
object BackgroundImport {
    private const val WORK_NAME = "snolage-health-check"
    private const val PREFS = "snolage-background"
    private const val KEY_ENABLED = "enabled"
    private const val KEY_SINCE = "since"
    private const val KEY_NOTIFIED = "notified"
    private const val MAX_REMEMBERED = 300
    private const val CHANNEL_ID = "watch-tours"
    private const val NOTIFICATION_ID = 4711

    /** Intent extra with the in-app path to open (see BackgroundImportPlugin). */
    const val EXTRA_PATH = "se.snolage.app.PATH"
    const val IMPORT_PATH = "/turer/halsa"

    // The app's own list of imported/skipped sessions (Capacitor Preferences,
    // key IMPORTED_KEY in services/healthImport.ts).
    private const val CAPACITOR_PREFS = "CapacitorStorage"
    private const val APP_IMPORTED_KEY = "fjallkoll:health-imported"

    val READ_WORKOUTS = HealthPermission.getReadPermission(ExerciseSessionRecord::class)
    const val READ_IN_BACKGROUND = HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND

    /** Same as WINTER_TYPES in services/healthImport.ts. */
    val WINTER_TYPES = setOf(
        ExerciseSessionRecord.EXERCISE_TYPE_SKIING,
        ExerciseSessionRecord.EXERCISE_TYPE_SNOWBOARDING,
        ExerciseSessionRecord.EXERCISE_TYPE_SNOWSHOEING,
        ExerciseSessionRecord.EXERCISE_TYPE_HIKING,
        ExerciseSessionRecord.EXERCISE_TYPE_OTHER_WORKOUT,
    )

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun isEnabled(context: Context) = prefs(context).getBoolean(KEY_ENABLED, false)

    /** Sessions that ended before this (when reminders were turned on) never notify. */
    fun since(context: Context) = prefs(context).getLong(KEY_SINCE, System.currentTimeMillis())

    fun enable(context: Context) {
        prefs(context).edit()
            .putBoolean(KEY_ENABLED, true)
            .putLong(KEY_SINCE, System.currentTimeMillis())
            .apply()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            WORK_NAME,
            ExistingPeriodicWorkPolicy.KEEP,
            PeriodicWorkRequestBuilder<HealthCheckWorker>(1, TimeUnit.HOURS).build(),
        )
    }

    fun disable(context: Context) {
        prefs(context).edit().putBoolean(KEY_ENABLED, false).remove(KEY_SINCE).apply()
        WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
    }

    /** Session ids already notified about, or imported/skipped in the app. */
    fun knownIds(context: Context): Set<String> {
        val ids = mutableSetOf<String>()
        prefs(context).getStringSet(KEY_NOTIFIED, null)?.let { ids.addAll(it) }
        val appList = context.getSharedPreferences(CAPACITOR_PREFS, Context.MODE_PRIVATE).getString(APP_IMPORTED_KEY, null)
        if (appList != null) {
            try {
                val array = JSONArray(appList)
                for (i in 0 until array.length()) ids.add(array.optString(i))
            } catch (ignored: Exception) {
                // Not a list: nothing to skip.
            }
        }
        return ids
    }

    fun rememberNotified(context: Context, ids: Collection<String>) {
        val all = (ids + (prefs(context).getStringSet(KEY_NOTIFIED, null) ?: emptySet())).distinct().take(MAX_REMEMBERED)
        prefs(context).edit().putStringSet(KEY_NOTIFIED, all.toSet()).apply()
    }

    fun canNotify(context: Context): Boolean =
        Build.VERSION.SDK_INT < 33 ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    fun notifyNewSessions(context: Context, count: Int) {
        if (!canNotify(context)) return
        if (Build.VERSION.SDK_INT >= 26) {
            val channel = NotificationChannel(CHANNEL_ID, "Turer från klockan", NotificationManager.IMPORTANCE_DEFAULT)
            channel.description = "När klockan har sparat ett nytt skidpass som kan bli en tur i Snöläge."
            context.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
        val open = Intent(context, MainActivity::class.java)
            .putExtra(EXTRA_PATH, IMPORT_PATH)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        val tap = PendingIntent.getActivity(
            context,
            0,
            open,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val title = if (count == 1) "Nytt skidpass från klockan" else "$count nya skidpass från klockan"
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_snolage)
            .setColor(ContextCompat.getColor(context, R.color.notification_accent))
            .setContentTitle(title)
            .setContentText("Tryck för att lägga till det som en privat tur i Snöläge.")
            .setContentIntent(tap)
            .setAutoCancel(true)
            .build()
        try {
            NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification)
        } catch (ignored: SecurityException) {
            // Notifications were turned off in the meantime.
        }
    }
}
