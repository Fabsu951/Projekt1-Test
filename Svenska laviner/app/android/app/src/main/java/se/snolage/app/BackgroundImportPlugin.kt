package se.snolage.app

import android.Manifest
import android.content.Intent
import android.os.Build
import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.HealthConnectFeatures
import androidx.health.connect.client.PermissionController
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * The app's side of BackgroundImport: status, turning reminders on and off
 * (asking for notification and background-read permission first), and the
 * page a tapped notification should open.
 */
@CapacitorPlugin(
    name = "BackgroundImport",
    permissions = [Permission(alias = "notifications", strings = [Manifest.permission.POST_NOTIFICATIONS])],
)
class BackgroundImportPlugin : Plugin() {

    private val healthPermissions = PermissionController.createRequestPermissionResultContract()

    /** From the intent that started the app, until the web app asks for it. */
    private var launchPath: String? = null

    override fun load() {
        launchPath = takePath(activity?.intent)
    }

    override fun handleOnNewIntent(intent: Intent) {
        super.handleOnNewIntent(intent)
        val path = takePath(intent) ?: return
        notifyListeners("openPath", JSObject().put("path", path), true)
    }

    private fun takePath(intent: Intent?): String? {
        val path = intent?.getStringExtra(BackgroundImport.EXTRA_PATH) ?: return null
        intent.removeExtra(BackgroundImport.EXTRA_PATH)
        return path.takeIf { it.startsWith("/") }
    }

    @PluginMethod
    fun takeLaunchPath(call: PluginCall) {
        val answer = JSObject()
        answer.put("path", launchPath)
        launchPath = null
        call.resolve(answer)
    }

    private fun notificationsAllowed() =
        Build.VERSION.SDK_INT < 33 || getPermissionState("notifications") == PermissionState.GRANTED

    @PluginMethod
    fun status(call: PluginCall) {
        val context = context
        if (HealthConnectClient.getSdkStatus(context) != HealthConnectClient.SDK_AVAILABLE) {
            call.resolve(JSObject().put("supported", false).put("enabled", false))
            return
        }
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val client = HealthConnectClient.getOrCreate(context)
                val supported = client.features.getFeatureStatus(
                    HealthConnectFeatures.FEATURE_READ_HEALTH_DATA_IN_BACKGROUND
                ) == HealthConnectFeatures.FEATURE_STATUS_AVAILABLE
                val granted = client.permissionController.getGrantedPermissions()
                val answer = JSObject()
                answer.put("supported", supported)
                answer.put("enabled", BackgroundImport.isEnabled(context))
                answer.put("backgroundPermission", BackgroundImport.READ_IN_BACKGROUND in granted)
                answer.put("notifications", notificationsAllowed())
                call.resolve(answer)
            } catch (e: Exception) {
                call.reject("Kunde inte läsa från Health Connect: ${e.message}")
            }
        }
    }

    /** Asks for notifications, then Health Connect's background permission, then starts the hourly check. */
    @PluginMethod
    fun enable(call: PluginCall) {
        if (!notificationsAllowed()) {
            requestPermissionForAlias("notifications", call, "notificationsAnswered")
            return
        }
        askForBackground(call)
    }

    @PermissionCallback
    fun notificationsAnswered(call: PluginCall) {
        if (!notificationsAllowed()) {
            call.resolve(JSObject().put("enabled", false).put("reason", "notifications"))
            return
        }
        askForBackground(call)
    }

    private fun askForBackground(call: PluginCall) {
        val context = context
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val granted = HealthConnectClient.getOrCreate(context).permissionController.getGrantedPermissions()
                when {
                    BackgroundImport.READ_WORKOUTS !in granted ->
                        call.resolve(JSObject().put("enabled", false).put("reason", "workouts"))
                    BackgroundImport.READ_IN_BACKGROUND in granted -> turnOn(call)
                    else -> activity.runOnUiThread {
                        val intent = healthPermissions.createIntent(context, setOf(BackgroundImport.READ_IN_BACKGROUND))
                        startActivityForResult(call, intent, "backgroundAnswered")
                    }
                }
            } catch (e: Exception) {
                call.reject("Kunde inte fråga Health Connect: ${e.message}")
            }
        }
    }

    @ActivityCallback
    fun backgroundAnswered(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        val granted = try {
            healthPermissions.parseResult(result.resultCode, result.data)
        } catch (e: Exception) {
            emptySet()
        }
        if (BackgroundImport.READ_IN_BACKGROUND in granted) turnOn(call)
        else call.resolve(JSObject().put("enabled", false).put("reason", "background"))
    }

    private fun turnOn(call: PluginCall) {
        BackgroundImport.enable(context)
        call.resolve(JSObject().put("enabled", true))
    }

    @PluginMethod
    fun disable(call: PluginCall) {
        BackgroundImport.disable(context)
        call.resolve(JSObject().put("enabled", false))
    }
}
