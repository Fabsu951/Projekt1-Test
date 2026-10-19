package se.snolage.app

import android.Manifest
import android.content.Intent
import android.os.Build
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import java.time.Instant

/**
 * The app's side of ShareLocationService (services/nativeShare.ts): start it
 * while the app is open, stop it, ask whether it runs, and pass its sends and
 * stops on to the page as "sent" / "stopped" events.
 */
@CapacitorPlugin(
    name = "ShareLocation",
    permissions = [Permission(alias = "notifications", strings = [Manifest.permission.POST_NOTIFICATIONS])],
)
class ShareLocationPlugin : Plugin(), ShareLocationService.Listener {

    override fun load() {
        ShareLocationService.listener = this
    }

    override fun handleOnDestroy() {
        if (ShareLocationService.listener === this) ShareLocationService.listener = null
        super.handleOnDestroy()
    }

    private fun notificationsAllowed() =
        Build.VERSION.SDK_INT < 33 || getPermissionState("notifications") == PermissionState.GRANTED

    /** {token, url, endsAt (ms), text, stopText}: asks to show notifications first (the service's notice needs it). */
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
        val token = call.getString("token")
        val url = call.getString("url")
        // Milliseconds arrive as a Long, which PluginCall.getDouble doesn't read (it returned null).
        val endsAt = (call.data.opt("endsAt") as? Number)?.toLong() ?: 0L
        if (token.isNullOrEmpty() || url.isNullOrEmpty() || endsAt <= System.currentTimeMillis()) {
            call.reject("Saknar uppgifter för att dela positionen.")
            return
        }
        if (!ShareLocationService.hasLocationPermission(context)) {
            call.resolve(JSObject().put("started", false).put("reason", "location"))
            return
        }
        val intent = Intent(context, ShareLocationService::class.java)
            .putExtra(ShareLocationService.EXTRA_TOKEN, token)
            .putExtra(ShareLocationService.EXTRA_URL, url)
            .putExtra(ShareLocationService.EXTRA_ENDS_AT, endsAt)
            .putExtra(ShareLocationService.EXTRA_TEXT, call.getString("text") ?: "Snöläge")
            .putExtra(ShareLocationService.EXTRA_STOP_TEXT, call.getString("stopText") ?: "Stoppa")
        try {
            ContextCompat.startForegroundService(context, intent)
            call.resolve(JSObject().put("started", true))
        } catch (e: Exception) {
            call.resolve(JSObject().put("started", false).put("reason", e.message))
        }
    }

    /** Stops quietly; the web app deletes the share on the server itself. */
    @PluginMethod
    fun stop(call: PluginCall) {
        context.stopService(Intent(context, ShareLocationService::class.java))
        call.resolve()
    }

    @PluginMethod
    fun status(call: PluginCall) {
        call.resolve(JSObject().put("running", ShareLocationService.running))
    }

    override fun sent(lat: Double, lon: Double, accuracy: Float, at: Long) {
        val data = JSObject()
            .put("lat", lat)
            .put("lon", lon)
            .put("accuracy", Math.round(accuracy))
            .put("at", Instant.ofEpochMilli(at).toString())
        notifyListeners("sent", data)
    }

    override fun stopped(reason: String) {
        notifyListeners("stopped", JSObject().put("reason", reason), true)
    }
}
