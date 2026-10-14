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
      // iOS mutes haptics while an app records unless it opts in. Microphone
      // dives use only short transients (taps, the onset pulse, the zone
      // thud) — never the continuous rumble, whose hum could reach the mic.
      try session.setAllowHapticsAndSystemSoundsDuringRecording(true)
      try session.setActive(true)
    } catch {
      print("Fathom: audio session could not be configured: \(error)")
    }
  }

  /// Another app is playing audio (music, a podcast). With the speaker on, it
  /// reaches the breath microphone like any other room noise.
  static var otherAudioPlaying: Bool {
    AVAudioSession.sharedInstance().isOtherAudioPlaying
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
