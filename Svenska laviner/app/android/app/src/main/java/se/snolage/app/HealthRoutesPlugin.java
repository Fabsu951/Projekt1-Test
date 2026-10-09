package se.snolage.app;

import android.content.Intent;
import androidx.activity.result.ActivityResult;
import androidx.health.connect.client.contracts.ExerciseRouteRequestContract;
import androidx.health.connect.client.records.ExerciseRoute;
import androidx.health.connect.client.units.Length;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Asks Health Connect for one workout's GPS route.
 *
 * On Android 14, routes that another app (the watch's app) saved are not
 * covered by the normal permission dialog: Health Connect hands them out one
 * session at a time, after the user agrees in its own dialog. The
 * capacitor-health plugin skips those routes, so this small plugin opens that
 * dialog via ExerciseRouteRequestContract and returns the points in the same
 * shape capacitor-health uses ({timestamp, lat, lng, alt}).
 */
@CapacitorPlugin(name = "HealthRoutes")
public class HealthRoutesPlugin extends Plugin {

    private final ExerciseRouteRequestContract contract = new ExerciseRouteRequestContract();

    @PluginMethod
    public void requestRoute(PluginCall call) {
        String id = call.getString("id");
        if (id == null || id.isEmpty()) {
            call.reject("Passet saknar id.");
            return;
        }
        Intent intent;
        try {
            intent = contract.createIntent(getContext(), id);
        } catch (Exception e) {
            call.reject("Health Connect kunde inte öppnas: " + e.getMessage());
            return;
        }
        startActivityForResult(call, intent, "routeResult");
    }

    @ActivityCallback
    private void routeResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        ExerciseRoute route;
        try {
            route = contract.parseResult(result.getResultCode(), result.getData());
        } catch (Exception e) {
            route = null;
        }
        JSArray points = new JSArray();
        if (route != null) {
            for (ExerciseRoute.Location location : route.getRoute()) {
                JSObject point = new JSObject();
                point.put("timestamp", location.getTime().toString());
                point.put("lat", location.getLatitude());
                point.put("lng", location.getLongitude());
                Length altitude = location.getAltitude();
                if (altitude != null) point.put("alt", altitude.getMeters());
                points.put(point);
            }
        }
        JSObject answer = new JSObject();
        // false: the user said no, or the session has no route.
        answer.put("granted", route != null);
        answer.put("route", points);
        call.resolve(answer);
    }
}
