package se.snolage.app

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import java.time.Duration
import java.time.Instant

/** The hourly check behind BackgroundImport: new winter sessions → one notification. */
class HealthCheckWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val context = applicationContext
        if (!BackgroundImport.isEnabled(context) || !BackgroundImport.canNotify(context)) return Result.success()
        if (HealthConnectClient.getSdkStatus(context) != HealthConnectClient.SDK_AVAILABLE) return Result.success()
        return try {
            val client = HealthConnectClient.getOrCreate(context)
            val granted = client.permissionController.getGrantedPermissions()
            if (BackgroundImport.READ_WORKOUTS !in granted || BackgroundImport.READ_IN_BACKGROUND !in granted) {
                return Result.success()
            }
            val since = Instant.ofEpochMilli(BackgroundImport.since(context))
            val monthAgo = Instant.now().minus(Duration.ofDays(30))
            val from = if (since.isAfter(monthAgo)) since else monthAgo
            val sessions = client.readRecords(
                ReadRecordsRequest(
                    recordType = ExerciseSessionRecord::class,
                    timeRangeFilter = TimeRangeFilter.after(from),
                )
            ).records
            val known = BackgroundImport.knownIds(context)
            val fresh = sessions.filter {
                it.exerciseType in BackgroundImport.WINTER_TYPES && it.metadata.id !in known && it.endTime.isAfter(since)
            }
            if (fresh.isNotEmpty()) {
                BackgroundImport.notifyNewSessions(context, fresh.size)
                BackgroundImport.rememberNotified(context, fresh.map { it.metadata.id })
            }
            Result.success()
        } catch (e: Exception) {
            // Health Connect busy, permission revoked or rate limited: try at the next hour.
            Result.success()
        }
    }
}
