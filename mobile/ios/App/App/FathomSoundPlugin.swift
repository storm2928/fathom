import AVFoundation
import Capacitor

/// Plays the Soundscape and tells JavaScript where the sound is going.
///
/// JavaScript decides the mix (soundDirector.ts) and sends it ~10 times a
/// second; this renders it through its own AVAudioEngine on the app's single
/// audio session (AudioSession), alongside — never reconfiguring — the
/// microphone's engine. Route changes (headphones in or out) are reported as
/// "route" events, because the speaker-safety rule depends on them.
@objc(FathomSoundPlugin)
public class FathomSoundPlugin: CAPPlugin, CAPBridgedPlugin {
  public let identifier = "FathomSoundPlugin"
  public let jsName = "FathomSound"
  public let pluginMethods: [CAPPluginMethod] = [
    CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "setMix", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "inhale", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "getRoute", returnType: CAPPluginReturnPromise),
  ]

  private let engine = AVAudioEngine()
  private var soundscape: Soundscape?
  private var source: AVAudioSourceNode?
  private var wanted = false
  private let queue = DispatchQueue(label: "app.fathom.sound")

  override public func load() {
    let center = NotificationCenter.default
    center.addObserver(
      self, selector: #selector(routeChanged),
      name: AVAudioSession.routeChangeNotification, object: nil)
    center.addObserver(
      self, selector: #selector(restartIfWanted),
      name: .AVAudioEngineConfigurationChange, object: engine)
    center.addObserver(
      self, selector: #selector(interrupted(_:)),
      name: AVAudioSession.interruptionNotification, object: nil)
  }

  @objc func start(_ call: CAPPluginCall) {
    queue.async {
      self.wanted = true
      do {
        try self.begin()
        call.resolve()
      } catch {
        call.reject("Sound could not start: \(error.localizedDescription)")
      }
    }
  }

  @objc func stop(_ call: CAPPluginCall) {
    queue.async {
      self.wanted = false
      self.engine.stop()
      call.resolve()
    }
  }

  @objc func setMix(_ call: CAPPluginCall) {
    let beds = call.getArray("beds", Double.self) ?? [1, 0, 0]
    let mix = SoundMixParams(
      master: Float(call.getDouble("master") ?? 0),
      surface: Float(call.getDouble("surface") ?? 0),
      beds: (
        Float(beds.count > 0 ? beds[0] : 0),
        Float(beds.count > 1 ? beds[1] : 0),
        Float(beds.count > 2 ? beds[2] : 0)
      ),
      lowpassHz: Float(call.getDouble("lowpassHz") ?? 2400),
      bubbles: Float(call.getDouble("bubbles") ?? 0),
      highCut: call.getBool("highCut") ?? false)
    soundscape?.setMix(mix)
    call.resolve()
  }

  @objc func inhale(_ call: CAPPluginCall) {
    soundscape?.inhale()
    call.resolve()
  }

  @objc func getRoute(_ call: CAPPluginCall) {
    call.resolve(["headphones": AudioSession.headphones])
  }

  // MARK: - Engine

  private func begin() throws {
    if source == nil {
      let format = engine.outputNode.inputFormat(forBus: 0)
      let rate = format.sampleRate > 0 ? format.sampleRate : 48_000
      let synth = Soundscape(sampleRate: rate)
      let mono = AVAudioFormat(standardFormatWithSampleRate: rate, channels: 1)!
      let node = AVAudioSourceNode(format: mono) { _, _, frameCount, bufferList -> OSStatus in
        let buffers = UnsafeMutableAudioBufferListPointer(bufferList)
        if let data = buffers.first?.mData?.assumingMemoryBound(to: Float.self) {
          synth.render(data, frames: Int(frameCount))
        }
        return noErr
      }
      engine.attach(node)
      engine.connect(node, to: engine.mainMixerNode, format: mono)
      soundscape = synth
      source = node
    }
    if !engine.isRunning {
      engine.prepare()
      try engine.start()
    }
  }

  @objc private func restartIfWanted() {
    queue.async {
      guard self.wanted else { return }
      try? self.begin()
    }
  }

  @objc private func interrupted(_ note: Notification) {
    guard
      let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
      AVAudioSession.InterruptionType(rawValue: raw) == .ended
    else { return }
    try? AVAudioSession.sharedInstance().setActive(true)
    restartIfWanted()
  }

  @objc private func routeChanged() {
    notifyListeners("route", data: ["headphones": AudioSession.headphones])
  }
}
