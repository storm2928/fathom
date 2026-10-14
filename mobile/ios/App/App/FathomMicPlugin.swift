import AVFoundation
import Capacitor

/// The breath microphone, captured natively and measured with the same
/// arithmetic as the web worklet (BreathFrameProcessor). JavaScript receives
/// ~50 frames a second as "frames" events and runs the unchanged detector.
///
/// Native rather than getUserMedia because the web view gives the page no say
/// over the audio session — and in the simulator it hands over a mock device.
@objc(FathomMicPlugin)
public class FathomMicPlugin: CAPPlugin, CAPBridgedPlugin {
  public let identifier = "FathomMicPlugin"
  public let jsName = "FathomMic"
  public let pluginMethods: [CAPPluginMethod] = [
    CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
  ]

  private let engine = AVAudioEngine()
  private var running = false
  /// Audio session and engine setup block on the audio server; keep them off
  /// the main thread (Apple's own runtime warning says the same).
  private let queue = DispatchQueue(label: "app.fathom.mic")

  @objc func start(_ call: CAPPluginCall) {
    requestPermission { granted in
      self.queue.async {
        guard granted else {
          call.reject("Microphone permission was denied.", "DENIED")
          return
        }
        self.begin(call)
      }
    }
  }

  @objc func stop(_ call: CAPPluginCall) {
    queue.async {
      self.end()
      call.resolve()
    }
  }

  private func requestPermission(_ done: @escaping (Bool) -> Void) {
    if #available(iOS 17.0, *) {
      AVAudioApplication.requestRecordPermission(completionHandler: done)
    } else {
      AVAudioSession.sharedInstance().requestRecordPermission(done)
    }
  }

  private func begin(_ call: CAPPluginCall) {
    if running { end() }
    do {
      let session = AVAudioSession.sharedInstance()
      // Measurement mode turns off the voice processing (echo cancellation,
      // noise suppression, gain control) that would delete a slow exhale.
      // Play-and-record so Plan 2's soundscape can play during a dive.
      try session.setCategory(
        .playAndRecord, mode: .measurement,
        options: [.defaultToSpeaker, .allowBluetoothA2DP, .mixWithOthers])
      try session.setActive(true)

      let input = engine.inputNode
      let format = input.outputFormat(forBus: 0)
      guard format.sampleRate > 0, format.channelCount > 0 else {
        call.reject("No microphone input is available.", "NO_INPUT")
        return
      }

      var pending: [[String: Double]] = []
      let processor = BreathFrameProcessor(sampleRate: format.sampleRate) { frame in
        pending.append(frame.dictionary)
      }

      // ~20 ms buffers; whatever frames each buffer completes go over in one
      // event, so the bridge carries ~50 small messages a second at most.
      input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
        guard let self, let channel = buffer.floatChannelData?[0] else { return }
        processor.process(channel, count: Int(buffer.frameLength))
        guard !pending.isEmpty else { return }
        let frames = pending
        pending.removeAll(keepingCapacity: true)
        self.notifyListeners("frames", data: ["frames": frames])
      }

      engine.prepare()
      try engine.start()
      running = true
      call.resolve([
        "sampleRate": format.sampleRate,
        "deviceLabel": session.currentRoute.inputs.first?.portName ?? "Microphone",
      ])
    } catch {
      end()
      call.reject("Microphone unavailable: \(error.localizedDescription)", "UNAVAILABLE")
    }
  }

  private func end() {
    guard running else { return }
    engine.inputNode.removeTap(onBus: 0)
    engine.stop()
    running = false
    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
  }
}
