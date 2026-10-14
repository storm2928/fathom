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
    CAPPluginMethod(name: "requestPermission", returnType: CAPPluginReturnPromise),
  ]

  private let engine = AVAudioEngine()
  private var running = false
  private var tapInstalled = false
  /// Audio session and engine setup block on the audio server; keep them off
  /// the main thread (Apple's own runtime warning says the same).
  private let queue = DispatchQueue(label: "app.fathom.mic")

  @objc func start(_ call: CAPPluginCall) {
    askForMicrophone { granted in
      self.queue.async {
        guard granted else {
          call.reject("Microphone permission was denied.", "DENIED")
          return
        }
        self.begin(call)
      }
    }
  }

  override public func load() {
    // iOS stops the input engine for calls, Siri and alarms, and on a route
    // change (headphones with a mic plugged in, say). A dive must not carry on
    // as if it were still listening: tell JavaScript, which ends it as
    // signal-lost rather than invent the rest of the measurement.
    let center = NotificationCenter.default
    center.addObserver(
      self, selector: #selector(inputLost(_:)),
      name: AVAudioSession.interruptionNotification, object: nil)
    center.addObserver(
      self, selector: #selector(inputLost(_:)),
      name: .AVAudioEngineConfigurationChange, object: engine)
  }

  @objc private func inputLost(_ note: Notification) {
    if note.name == AVAudioSession.interruptionNotification {
      guard
        let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
        AVAudioSession.InterruptionType(rawValue: raw) == .began
      else { return }
    }
    queue.async {
      guard self.running else { return }
      self.end()
      self.notifyListeners("lost", data: [:])
    }
  }

  /// Asks iOS for the microphone without starting it — for onboarding, where
  /// the choice is made.
  @objc func requestPermission(_ call: CAPPluginCall) {
    askForMicrophone { granted in call.resolve(["granted": granted]) }
  }

  @objc func stop(_ call: CAPPluginCall) {
    queue.async {
      self.end()
      call.resolve()
    }
  }

  private func askForMicrophone(_ done: @escaping (Bool) -> Void) {
    if #available(iOS 17.0, *) {
      AVAudioApplication.requestRecordPermission(completionHandler: done)
    } else {
      AVAudioSession.sharedInstance().requestRecordPermission(done)
    }
  }

  private func begin(_ call: CAPPluginCall) {
    end()  // clears any tap a failed or interrupted start left behind
    do {
      // The session itself is configured once at launch (AudioSession), so
      // starting the microphone never interrupts the soundscape.
      let session = AVAudioSession.sharedInstance()
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

      // iOS may deliver larger buffers than asked for (up to ~100 ms); frame
      // times are counted in samples, so only latency changes. Each buffer's
      // frames go over in one event.
      tapInstalled = true
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

  /// Removes the tap and stops the engine — also after a start that failed
  /// half-way, so the next start never installs a second tap on the bus.
  private func end() {
    if tapInstalled {
      engine.inputNode.removeTap(onBus: 0)
      tapInstalled = false
    }
    engine.stop()
    running = false
  }
}
