import Capacitor
import CoreLocation

/// "Spela in tur" on iPhone: the same JavaScript API as the Android plugin
/// (services/tourRecorder.ts). Background location updates (the blue
/// indicator shows while it records) append every fix to a file in the
/// app's own storage, so nothing needs coverage and nothing is lost if the
/// app is closed. Same file format as TourRecorderService.kt:
///   lat,lon,elevation or empty,time ms,accuracy m   a fix
///   P,time ms / R,time ms                            paused / resumed
@objc(TourRecorderPlugin)
public class TourRecorderPlugin: CAPPlugin, CAPBridgedPlugin, CLLocationManagerDelegate {
    public let identifier = "TourRecorderPlugin"
    public let jsName = "TourRecorder"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pause", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resume", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "finish", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "discard", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "read", returnType: CAPPluginReturnPromise),
    ]

    private static let stateKey = "snolage.recording.state"
    private static let startedKey = "snolage.recording.startedAt"
    private static let pausedMsKey = "snolage.recording.pausedMs"
    private static let pausedAtKey = "snolage.recording.pausedAt"

    private var manager: CLLocationManager?
    private var updating = false
    private let defaults = UserDefaults.standard

    private var fileURL: URL {
        let folder = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        return folder.appendingPathComponent("tour-recording.txt")
    }

    private var state: String {
        get { defaults.string(forKey: Self.stateKey) ?? "idle" }
        set { defaults.set(newValue, forKey: Self.stateKey) }
    }

    private static func nowMs() -> Int { Int(Date().timeIntervalSince1970 * 1000) }

    public override func load() {
        // Opened again during a recording (e.g. after iOS closed the app): carry on.
        if state == "recording" {
            DispatchQueue.main.async { self.startUpdates() }
        }
    }

    @objc func start(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let manager = self.locationManager()
            let status = manager.authorizationStatus
            guard status == .authorizedWhenInUse || status == .authorizedAlways else {
                call.resolve(["started": false, "reason": "location"])
                return
            }
            try? FileManager.default.removeItem(at: self.fileURL)
            self.defaults.set(Self.nowMs(), forKey: Self.startedKey)
            self.defaults.set(0, forKey: Self.pausedMsKey)
            self.defaults.removeObject(forKey: Self.pausedAtKey)
            self.state = "recording"
            self.startUpdates()
            call.resolve(["started": true])
        }
    }

    @objc func pause(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if self.state == "recording" {
                let now = Self.nowMs()
                self.append("P,\(now)")
                self.defaults.set(now, forKey: Self.pausedAtKey)
                self.state = "paused"
                self.stopUpdates()
            }
            call.resolve()
        }
    }

    @objc func resume(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if self.state == "paused" {
                let now = Self.nowMs()
                self.append("R,\(now)")
                self.closePause(now)
                self.state = "recording"
            }
            if self.state == "recording" { self.startUpdates() }
            call.resolve()
        }
    }

    @objc func finish(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if self.state == "recording" || self.state == "paused" {
                self.closePause(Self.nowMs())
                self.state = "finished"
            }
            self.stopUpdates()
            call.resolve()
        }
    }

    @objc func discard(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.stopUpdates()
            try? FileManager.default.removeItem(at: self.fileURL)
            for key in [Self.stateKey, Self.startedKey, Self.pausedMsKey, Self.pausedAtKey] {
                self.defaults.removeObject(forKey: key)
            }
            call.resolve()
        }
    }

    @objc func status(_ call: CAPPluginCall) {
        let pausedAt = number(Self.pausedAtKey)
        let paused = (number(Self.pausedMsKey)) + (pausedAt > 0 ? Self.nowMs() - pausedAt : 0)
        call.resolve([
            "state": state,
            "running": updating,
            "startedAt": number(Self.startedKey),
            "pausedMs": paused,
        ])
    }

    /// {from}: the recorded lines from that line on, and how many there are in all.
    @objc func read(_ call: CAPPluginCall) {
        let from = call.getInt("from") ?? 0
        let text = (try? String(contentsOf: fileURL, encoding: .utf8)) ?? ""
        let all = text.split(separator: "\n").map(String.init).filter { !$0.isEmpty }
        call.resolve(["lines": from < all.count ? Array(all[from...]) : [], "total": all.count])
    }

    /// A stored millisecond count (UserDefaults keeps numbers as NSNumber).
    private func number(_ key: String) -> Int {
        (defaults.object(forKey: key) as? NSNumber)?.intValue ?? 0
    }

    private func closePause(_ now: Int) {
        let pausedAt = number(Self.pausedAtKey)
        if pausedAt > 0 {
            let total = (number(Self.pausedMsKey)) + (now - pausedAt)
            defaults.set(total, forKey: Self.pausedMsKey)
            defaults.removeObject(forKey: Self.pausedAtKey)
        }
    }

    private func locationManager() -> CLLocationManager {
        if let manager = manager { return manager }
        let manager = CLLocationManager()
        manager.delegate = self
        self.manager = manager
        return manager
    }

    private func startUpdates() {
        let manager = locationManager()
        let status = manager.authorizationStatus
        guard status == .authorizedWhenInUse || status == .authorizedAlways else { return }
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.distanceFilter = 5
        manager.activityType = .fitness
        manager.pausesLocationUpdatesAutomatically = false
        manager.allowsBackgroundLocationUpdates = true
        manager.showsBackgroundLocationIndicator = true
        manager.startUpdatingLocation()
        updating = true
    }

    private func stopUpdates() {
        manager?.stopUpdatingLocation()
        manager?.allowsBackgroundLocationUpdates = false
        updating = false
    }

    public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard state == "recording" else { return }
        var lines: [String] = []
        for location in locations where location.horizontalAccuracy >= 0 {
            let time = Int(min(location.timestamp, Date()).timeIntervalSince1970 * 1000)
            let ele = location.verticalAccuracy >= 0 ? String(format: "%.1f", location.altitude) : ""
            lines.append(String(format: "%.6f,%.6f,", location.coordinate.latitude, location.coordinate.longitude)
                + "\(ele),\(time),\(Int(location.horizontalAccuracy.rounded()))")
        }
        if !lines.isEmpty { append(lines.joined(separator: "\n")) }
    }

    private func append(_ text: String) {
        let data = Data((text + "\n").utf8)
        if let handle = try? FileHandle(forWritingTo: fileURL) {
            handle.seekToEndOfFile()
            handle.write(data)
            try? handle.close()
        } else {
            try? data.write(to: fileURL)
        }
    }
}
