import Foundation
import HealthKit
import UserNotifications

/// The iPhone side of "Påminn mig om nya skidpass" (Android: BackgroundImport.kt).
/// Apple Hälsa wakes the app when a new workout is saved (background delivery
/// for an HKObserverQuery); if it is a new winter session, a notification
/// offers to add it as a private tour. Nothing leaves the phone until the user
/// opens the app. The observer has to be set up again at every launch,
/// so AppDelegate calls startIfEnabled() first thing.
final class HealthReminder {
    static let shared = HealthReminder()
    static let importPath = "/turer/halsa"

    private let store = HKHealthStore()
    private let defaults = UserDefaults.standard
    private let enabledKey = "snolage.background.enabled"
    private let sinceKey = "snolage.background.since"
    private let notifiedKey = "snolage.background.notified"
    /// The app's own list of imported/skipped sessions (Capacitor Preferences, IMPORTED_KEY in healthImport.ts).
    private let appImportedKey = "CapacitorStorage.fjallkoll:health-imported"
    private let maxRemembered = 300
    private var observer: HKObserverQuery?

    /// Same as WINTER_TYPES in services/healthImport.ts.
    private static let winterTypes: Set<HKWorkoutActivityType> = [
        .downhillSkiing, .crossCountrySkiing, .snowSports, .snowboarding, .hiking, .other,
    ]

    var isAvailable: Bool { HKHealthStore.isHealthDataAvailable() }
    var isEnabled: Bool { defaults.bool(forKey: enabledKey) }

    func startIfEnabled() {
        guard isEnabled, isAvailable else { return }
        store.enableBackgroundDelivery(for: HKObjectType.workoutType(), frequency: .immediate) { _, _ in }
        startObserving()
    }

    /// Asks for notifications and read access, then turns on background delivery.
    /// Calls back with nil when on, else the reason: "notifications", "workouts" or "background".
    func enable(completion: @escaping (String?) -> Void) {
        guard isAvailable else { return completion("workouts") }
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
            guard granted else { return completion("notifications") }
            let read: Set<HKObjectType> = [HKObjectType.workoutType(), HKSeriesType.workoutRoute()]
            self.store.requestAuthorization(toShare: nil, read: read) { _, error in
                guard error == nil else { return completion("workouts") }
                self.store.enableBackgroundDelivery(for: HKObjectType.workoutType(), frequency: .immediate) { ok, _ in
                    guard ok else { return completion("background") }
                    self.defaults.set(true, forKey: self.enabledKey)
                    self.defaults.set(Date().timeIntervalSince1970, forKey: self.sinceKey)
                    DispatchQueue.main.async { self.startObserving() }
                    completion(nil)
                }
            }
        }
    }

    func disable(completion: @escaping () -> Void) {
        defaults.set(false, forKey: enabledKey)
        defaults.removeObject(forKey: sinceKey)
        if let observer = observer {
            store.stop(observer)
            self.observer = nil
        }
        store.disableBackgroundDelivery(for: HKObjectType.workoutType()) { _, _ in completion() }
    }

    func status(completion: @escaping ([String: Any]) -> Void) {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            let allowed = settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional
            completion([
                "supported": self.isAvailable,
                "enabled": self.isEnabled,
                // HealthKit never says whether reading was allowed.
                "backgroundPermission": true,
                "notifications": allowed,
            ])
        }
    }

    private func startObserving() {
        guard observer == nil else { return }
        let query = HKObserverQuery(sampleType: HKObjectType.workoutType(), predicate: nil) { [weak self] _, done, error in
            guard let self = self, error == nil else { return done() }
            self.checkForNewWorkouts(done: done)
        }
        observer = query
        store.execute(query)
    }

    private func checkForNewWorkouts(done: @escaping () -> Void) {
        guard isEnabled else { return done() }
        let since = Date(timeIntervalSince1970: defaults.double(forKey: sinceKey))
        let predicate = HKQuery.predicateForSamples(withStart: since, end: nil, options: [])
        let newest = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
        let query = HKSampleQuery(sampleType: HKObjectType.workoutType(), predicate: predicate, limit: 50, sortDescriptors: [newest]) { [weak self] _, samples, _ in
            guard let self = self else { return done() }
            let known = self.knownIds()
            let fresh = (samples as? [HKWorkout] ?? []).filter {
                Self.winterTypes.contains($0.workoutActivityType) && $0.endDate > since && !known.contains($0.uuid.uuidString)
            }
            if fresh.isEmpty { return done() }
            self.rememberNotified(fresh.map { $0.uuid.uuidString })
            self.notify(count: fresh.count, done: done)
        }
        store.execute(query)
    }

    private func knownIds() -> Set<String> {
        var ids = Set(defaults.stringArray(forKey: notifiedKey) ?? [])
        if let json = defaults.string(forKey: appImportedKey),
           let data = json.data(using: .utf8),
           let list = try? JSONSerialization.jsonObject(with: data) as? [String] {
            ids.formUnion(list)
        }
        return ids
    }

    private func rememberNotified(_ ids: [String]) {
        let old = defaults.stringArray(forKey: notifiedKey) ?? []
        var seen = Set<String>()
        let all = (ids + old).filter { seen.insert($0).inserted }
        defaults.set(Array(all.prefix(maxRemembered)), forKey: notifiedKey)
    }

    private func notify(count: Int, done: @escaping () -> Void) {
        let content = UNMutableNotificationContent()
        content.title = count == 1 ? "Nytt skidpass från klockan" : "\(count) nya skidpass från klockan"
        content.body = "Tryck för att lägga till det som en privat tur i Snöläge."
        content.sound = .default
        content.userInfo = ["path": Self.importPath]
        let request = UNNotificationRequest(identifier: "snolage-watch-tours", content: content, trigger: nil)
        UNUserNotificationCenter.current().add(request) { _ in done() }
    }
}
