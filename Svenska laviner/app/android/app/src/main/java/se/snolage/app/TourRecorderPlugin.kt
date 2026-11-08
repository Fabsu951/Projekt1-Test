package se.snolage.app

import android.Manifest
import android.content.Intent
import android.os.Build
import androidx.core.content.ContextCompat
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

/**
 * The app's side of TourRecorderService (services/tourRecorder.ts): start,
 * pause, resume and finish a recording, ask how it is going, read the
 * recorded lines and throw a recording away.
 */
@CapacitorPlugin(
    name = "TourRecorder",
    permissions = [Permission(alias = "notifications", strings = [Manifest.permission.POST_NOTIFICATIONS])],
)
class TourRecorderPlugin : Plugin() {

    private fun notificationsAllowed() =
        Build.VERSION.SDK_INT < 33 || getPermissionState("notifications") == PermissionState.GRANTED

    /** Starts a new recording (an old one is replaced). Asks to show notifications first. */
    @PluginMethod
    fun start(call: PluginCall) {
        if (!notificationsAllowed()) {
            requestPermissionForAlias("notifications", call, "notificationsAnswered")
            return
        }
        begin(call)
    }

    @PermissionCallback
    fun notificationsAnswered(call: PluginCall) {
        // Without notifications Android still runs the service, just without the visible notice.
        begin(call)
    }

    private fun begin(call: PluginCall) {
        if (!ShareLocationService.hasLocationPermission(context)) {
            call.resolve(JSObject().put("started", false).put("reason", "location"))
            return
        }
        if (send(TourRecorderService.ACTION_START)) call.resolve(JSObject().put("started", true))
        else call.resolve(JSObject().put("started", false).put("reason", "service"))
    }

    @PluginMethod
    fun pause(call: PluginCall) {
        send(TourRecorderService.ACTION_PAUSE)
        call.resolve()
    }

    /** Also restarts the service when the recording was going on but Android had stopped it. */
    @PluginMethod
    fun resume(call: PluginCall) {
        val state = TourRecorderService.state(context)
        if (state == "recording" || state == "paused") {
            send(if (state == "paused") TourRecorderService.ACTION_RESUME else "")
        }
        call.resolve()
    }

    @PluginMethod
    fun finish(call: PluginCall) {
        val state = TourRecorderService.state(context)
        if (state == "recording" || state == "paused") {
            // Through the service even when Android had stopped it, so the
            // pause time is counted the same way; it stops itself right after.
            if (!send(TourRecorderService.ACTION_FINISH)) TourRecorderService.markFinished(context)
        }
        call.resolve()
    }

    @PluginMethod
    fun discard(call: PluginCall) {
        TourRecorderService.discard(context)
        call.resolve()
    }

    @PluginMethod
    fun status(call: PluginCall) {
        call.resolve(
            JSObject()
                .put("state", TourRecorderService.state(context))
                .put("running", TourRecorderService.running)
                .put("startedAt", TourRecorderService.startedAt(context))
                .put("pausedMs", TourRecorderService.pausedMs(context)),
        )
    }

    /** {from}: the recorded lines from that line on, and how many there are in all. */
    @PluginMethod
    fun read(call: PluginCall) {
        val from = (call.data.opt("from") as? Number)?.toInt() ?: 0
        val lines = JSArray()
        var count = 0
        val file = TourRecorderService.file(context)
        if (file.exists()) {
            file.bufferedReader().useLines { all ->
                for (line in all) {
                    if (line.isBlank()) continue
                    if (count >= from) lines.put(line)
                    count++
                }
            }
        }
        call.resolve(JSObject().put("lines", lines).put("total", count))
    }

    private fun send(action: String): Boolean {
        val intent = Intent(context, TourRecorderService::class.java)
        if (action.isNotEmpty()) intent.action = action
        return try {
            ContextCompat.startForegroundService(context, intent)
            true
        } catch (e: Exception) {
            false
        }
    }
}
