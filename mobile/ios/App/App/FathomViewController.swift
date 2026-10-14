import Capacitor

/// Capacitor's bridge view controller, plus the plugins that live in the app
/// itself rather than in an npm package.
class FathomViewController: CAPBridgeViewController {
  override open func capacitorDidLoad() {
    bridge?.registerPluginInstance(FathomMicPlugin())
  }
}
