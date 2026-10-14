import AVFoundation

/// The app's one audio session, configured once at launch and left alone.
///
/// Play-and-record from the start, so turning the breath microphone on never
/// reconfigures the session underneath the soundscape (a category or mode
/// change mid-play interrupts the output engine). Measurement mode keeps iOS's
/// voice processing — echo cancellation, noise suppression, gain control —
/// off, because it would delete a slow exhale. Choosing the category does not
/// ask for the microphone; only starting to record does.
enum AudioSession {
  static func configure() {
    let session = AVAudioSession.sharedInstance()
    do {
      try session.setCategory(
        .playAndRecord, mode: .measurement,
        options: [.defaultToSpeaker, .allowBluetoothA2DP, .mixWithOthers])
      try session.setActive(true)
    } catch {
      print("Fathom: audio session could not be configured: \(error)")
    }
  }

  /// True when sound goes somewhere the microphone cannot hear it well:
  /// wired or Bluetooth headphones, or a USB interface.
  static var headphones: Bool {
    let outputs = AVAudioSession.sharedInstance().currentRoute.outputs
    return outputs.contains { port in
      switch port.portType {
      case .headphones, .bluetoothA2DP, .bluetoothLE, .bluetoothHFP, .usbAudio:
        return true
      default:
        return false
      }
    }
  }
}
