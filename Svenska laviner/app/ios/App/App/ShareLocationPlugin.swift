import Capacitor
import CoreLocation

/// "Dela position" while Snöläge is in the background or the screen is off.
/// Same JavaScript API as the Android plugin (services/nativeShare.ts):
/// background location updates (the blue indicator shows while it runs),
/// sent to the worker with the rules of services/locationShare.ts – first
/// fix, then a 50 m move at most once a minute, or every 5 minutes. Stops at
/// the end time or when the worker says the share is gone.
@objc(ShareLocationPlugin)
public class ShareLocationPlugin: CAPPlugin, CAPBridgedPlugin, CLLocationManagerDelegate {
    public let identifier = "ShareLocationPlugin"
    public let jsName = "ShareLocation"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
    ]

    private static let minInterval: TimeInterval = 60
    private static let heartbeat: TimeInterval = 5 * 60
    private static let minDistance: CLLocationDistance = 50
    /// The web app's own record of a running share (Capacitor Preferences, ACTIVE_KEY in services/locationShare.ts).
    private static let appShareKey = "CapacitorStorage.fjallkoll:location-share"

    private var manager: CLLocationManager?
    private var token: String?
    private var url: String?
    private var endsAt: Date?
    private var lastSent: CLLocation?
    private var lastSentAt: Date?
    private var sending = false
    private var running = false

    /// {token, url, endsAt (ms), text, stopText}; the texts are only used on Android.
    @objc func start(_ call: CAPPluginCall) {
        guard let token = call.getString("token"), !token.isEmpty,
              let url = call.getString("url"), !url.isEmpty,
              let endsAtMs = call.getDouble("endsAt"), endsAtMs > Date().timeIntervalSince1970 * 1000
        else {
            call.reject("Saknar uppgifter för att dela positionen.")
            return
        }
        DispatchQueue.main.async {
            let manager = self.manager ?? CLLocationManager()
            self.manager = manager
            manager.delegate = self
            let status = manager.authorizationStatus
            guard status == .authorizedWhenInUse || status == .authorizedAlways else {
                call.resolve(["started": false, "reason": "location"])
                return
            }
            self.token = token
            self.url = url.hasSuffix("/") ? String(url.dropLast()) : url
            self.endsAt = Date(timeIntervalSince1970: endsAtMs / 1000)
            self.lastSent = nil
            self.lastSentAt = nil
            manager.desiredAccuracy = kCLLocationAccuracyNearestTenMeters
            manager.distanceFilter = kCLDistanceFilterNone
            manager.activityType = .fitness
            manager.pausesLocationUpdatesAutomatically = false
            manager.allowsBackgroundLocationUpdates = true
            manager.showsBackgroundLocationIndicator = true
            manager.startUpdatingLocation()
            self.running = true
            call.resolve(["started": true])
        }
    }

    /// Stops quietly; the web app deletes the share on the server itself.
    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.halt()
            call.resolve()
        }
    }

    @objc func status(_ call: CAPPluginCall) {
        call.resolve(["running": running])
    }

    private func halt() {
        manager?.stopUpdatingLocation()
        manager?.allowsBackgroundLocationUpdates = false
        running = false
        token = nil
    }

    private func finish(_ reason: String) {
        guard running else { return }
        halt()
        if reason != "ended" {
            // The share is over, so the app shouldn't restart it or say it runs.
            UserDefaults.standard.removeObject(forKey: Self.appShareKey)
        }
        notifyListeners("stopped", data: ["reason": reason], retainUntilConsumed: true)
    }

    public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard running, let location = locations.last else { return }
        if let endsAt = endsAt, Date() >= endsAt {
            finish("ended")
            return
        }
        let now = Date()
        let due: Bool
        if let last = lastSent, let at = lastSentAt {
            let elapsed = now.timeIntervalSince(at)
            due = elapsed >= Self.heartbeat || (elapsed >= Self.minInterval && location.distance(from: last) >= Self.minDistance)
        } else {
            due = true
        }
        if due { send(location) }
    }

    public func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        if running && (status == .denied || status == .restricted) { finish("gone") }
    }

    private func send(_ location: CLLocation) {
        guard !sending, let token = token, let url = url, let address = URL(string: "\(url)/location/position") else { return }
        sending = true
        var request = URLRequest(url: address, timeoutInterval: 20)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body: [String: Any] = [
            "lat": location.coordinate.latitude,
            "lon": location.coordinate.longitude,
            "accuracy": Int(location.horizontalAccuracy.rounded()),
        ]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        URLSession.shared.dataTask(with: request) { _, response, _ in
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            DispatchQueue.main.async {
                self.sending = false
                if (200..<300).contains(status) {
                    self.lastSent = location
                    self.lastSentAt = Date()
                    self.notifyListeners("sent", data: [
                        "lat": location.coordinate.latitude,
                        "lon": location.coordinate.longitude,
                        "accuracy": Int(location.horizontalAccuracy.rounded()),
                        "at": ISO8601DateFormatter().string(from: Date()),
                    ])
                } else if status == 404 || status == 401 {
                    // Stopped or ended elsewhere, or logged out.
                    self.finish("gone")
                }
                // No coverage: the next update tries again.
            }
        }.resume()
    }
}
