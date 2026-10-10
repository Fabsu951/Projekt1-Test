import Capacitor

/// The app's web view. Registers the plugins that live in this app rather than in npm packages.
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(BackgroundImportPlugin())
    }
}
