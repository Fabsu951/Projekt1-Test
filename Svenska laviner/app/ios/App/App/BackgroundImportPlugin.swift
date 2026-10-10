import Capacitor
import UserNotifications

/// Same JavaScript API as the Android plugin (services/backgroundImport.ts).
/// Also shows our own notifications while the app is open, and turns a tap
/// on one into an "openPath" event.
@objc(BackgroundImportPlugin)
public class BackgroundImportPlugin: CAPPlugin, CAPBridgedPlugin, NotificationHandlerProtocol {
    public let identifier = "BackgroundImportPlugin"
    public let jsName = "BackgroundImport"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "enable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "takeLaunchPath", returnType: CAPPluginReturnPromise),
    ]

    override public func load() {
        // Push notifications go to the Firebase plugin; local ones (ours) come here.
        bridge?.notificationRouter.localNotificationHandler = self
    }

    @objc func status(_ call: CAPPluginCall) {
        HealthReminder.shared.status { call.resolve($0) }
    }

    @objc func enable(_ call: CAPPluginCall) {
        HealthReminder.shared.enable { reason in
            if let reason = reason {
                call.resolve(["enabled": false, "reason": reason])
            } else {
                call.resolve(["enabled": true])
            }
        }
    }

    @objc func disable(_ call: CAPPluginCall) {
        HealthReminder.shared.disable { call.resolve(["enabled": false]) }
    }

    /// On iPhone a tap always arrives as an "openPath" event (kept until the page listens).
    @objc func takeLaunchPath(_ call: CAPPluginCall) {
        call.resolve([:])
    }

    public func willPresent(notification: UNNotification) -> UNNotificationPresentationOptions {
        return [.banner, .list, .sound]
    }

    public func didReceive(response: UNNotificationResponse) {
        guard let path = response.notification.request.content.userInfo["path"] as? String, path.hasPrefix("/") else { return }
        notifyListeners("openPath", data: ["path": path], retainUntilConsumed: true)
    }
}
