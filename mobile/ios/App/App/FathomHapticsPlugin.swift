import Capacitor
import CoreHaptics

/// The dive in your hands, with Core Haptics.
///
/// A continuous rumble whose intensity JavaScript updates live while you
/// breathe out (touch dives), and three short patterns: a light tap on each
/// breath-in prompt, a soft onset pulse when a microphone breath out begins,
/// and a deep thud when you enter a new zone. Calm only — nothing buzzes.
///
/// Devices without a Taptic Engine (the simulator, iPads) resolve every call
/// and do nothing.
@objc(FathomHapticsPlugin)
public class FathomHapticsPlugin: CAPPlugin, CAPBridgedPlugin {
  public let identifier = "FathomHapticsPlugin"
  public let jsName = "FathomHaptics"
  public let pluginMethods: [CAPPluginMethod] = [
    CAPPluginMethod(name: "exhaleStart", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "exhaleLevel", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "exhaleStop", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "tap", returnType: CAPPluginReturnPromise),
  ]

  private var engine: CHHapticEngine?
  private var rumble: CHHapticAdvancedPatternPlayer?
  private let queue = DispatchQueue(label: "app.fathom.haptics")

  override public func load() {
    guard CHHapticEngine.capabilitiesForHardware().supportsHaptics else { return }
    do {
      let engine = try CHHapticEngine()
      engine.playsHapticsOnly = true
      engine.isAutoShutdownEnabled = true
      // iOS stops the engine in the background and may reset it; come back.
      engine.resetHandler = { [weak self] in
        self?.queue.async {
          self?.rumble = nil
          try? self?.engine?.start()
        }
      }
      engine.stoppedHandler = { [weak self] _ in
        self?.queue.async { self?.rumble = nil }
      }
      try engine.start()
      self.engine = engine
    } catch {
      engine = nil
    }
  }

  @objc func exhaleStart(_ call: CAPPluginCall) {
    let intensity = Float(call.getDouble("intensity") ?? 0.15)
    queue.async {
      defer { call.resolve() }
      guard let engine = self.engine else { return }
      do {
        try engine.start()
        try self.rumble?.stop(atTime: CHHapticTimeImmediate)
        let event = CHHapticEvent(
          eventType: .hapticContinuous,
          parameters: [
            CHHapticEventParameter(parameterID: .hapticIntensity, value: 1),
            // Low sharpness: a soft, round rumble rather than a buzz.
            CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.12),
          ],
          relativeTime: 0, duration: 60)
        let player = try engine.makeAdvancedPlayer(
          with: CHHapticPattern(events: [event], parameters: []))
        try player.start(atTime: CHHapticTimeImmediate)
        try player.sendParameters(
          [CHHapticDynamicParameter(parameterID: .hapticIntensityControl, value: intensity, relativeTime: 0)],
          atTime: CHHapticTimeImmediate)
        self.rumble = player
      } catch {
        self.rumble = nil
      }
    }
  }

  @objc func exhaleLevel(_ call: CAPPluginCall) {
    let intensity = Float(call.getDouble("intensity") ?? 0.3)
    queue.async {
      try? self.rumble?.sendParameters(
        [CHHapticDynamicParameter(parameterID: .hapticIntensityControl, value: intensity, relativeTime: 0)],
        atTime: CHHapticTimeImmediate)
      call.resolve()
    }
  }

  @objc func exhaleStop(_ call: CAPPluginCall) {
    queue.async {
      try? self.rumble?.stop(atTime: CHHapticTimeImmediate)
      self.rumble = nil
      call.resolve()
    }
  }

  @objc func tap(_ call: CAPPluginCall) {
    let kind = call.getString("kind") ?? "inhale"
    queue.async {
      defer { call.resolve() }
      guard let engine = self.engine else { return }
      let events: [CHHapticEvent]
      switch kind {
      case "zone":
        // A deep thud: a soft transient, then a short low swell under it.
        events = [
          CHHapticEvent(
            eventType: .hapticTransient,
            parameters: [
              CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.85),
              CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.05),
            ], relativeTime: 0),
          CHHapticEvent(
            eventType: .hapticContinuous,
            parameters: [
              CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.45),
              CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.0),
            ], relativeTime: 0.02, duration: 0.3),
        ]
      case "onset":
        events = [
          CHHapticEvent(
            eventType: .hapticTransient,
            parameters: [
              CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.3),
              CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.15),
            ], relativeTime: 0)
        ]
      default:
        events = [
          CHHapticEvent(
            eventType: .hapticTransient,
            parameters: [
              CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.4),
              CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.3),
            ], relativeTime: 0)
        ]
      }
      do {
        try engine.start()
        try engine.makePlayer(with: CHHapticPattern(events: events, parameters: []))
          .start(atTime: CHHapticTimeImmediate)
      } catch {
        // A missed tap is not worth surfacing.
      }
    }
  }
}
