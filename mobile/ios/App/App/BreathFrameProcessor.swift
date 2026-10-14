// A line-for-line port of public/breath-processor.js, the web worklet that
// turns raw microphone audio into breath measurements. The detector, its
// thresholds and the breathing recordings were all tuned on that worklet's
// numbers, so this must produce the same frames: scripts/dsp-parity checks it.
//
// Plain arithmetic — no AVFoundation — so the parity harness can compile it on
// its own. Doubles throughout, matching JavaScript numbers.

import Foundation

/// One hop of measured audio, ~20 ms. Same fields as CaptureFrame in capture.ts.
struct BreathFrame {
  /// milliseconds on the audio clock, counted in samples so it stays exact
  let t: Double
  /// 0–1 raw peak magnitude, taken pre-filter so clipping stays visible
  let peak: Double
  /// RMS above the rumble cutoff
  let level: Double
  /// RMS within the voice band
  let voice: Double
  /// RMS above the voice band, where the turbulence of a breath sits
  let high: Double
  /// zero-crossing rate, 0–1
  let zcr: Double

  var dictionary: [String: Double] {
    ["t": t, "peak": peak, "level": level, "voice": voice, "high": high, "zcr": zcr]
  }
}

/// Hop length. ~50 Hz of frames at any sample rate.
private let frameSeconds = 0.02
/// Below this is desk bumps, handling noise and HVAC. Never signal.
private let rumbleCutoffHz = 100.0
/// Split between the speech-dominated band and the breath-dominated band.
private let voiceHighSplitHz = 1000.0
/// Butterworth Q (Math.SQRT1_2 in the worklet).
private let butterworthQ = 0.7071067811865476

/// RBJ cookbook biquad in transposed direct form II, normalised by a0.
private struct Biquad {
  enum Kind { case highpass, lowpass }

  let b0, b1, b2, a1, a2: Double
  var z1 = 0.0
  var z2 = 0.0

  init(_ kind: Kind, frequency: Double, rate: Double) {
    let w0 = (2 * Double.pi * frequency) / rate
    let cosine = cos(w0)
    let alpha = sin(w0) / (2 * butterworthQ)
    let nb0, nb1, nb2: Double
    switch kind {
    case .highpass:
      nb0 = (1 + cosine) / 2
      nb1 = -(1 + cosine)
      nb2 = (1 + cosine) / 2
    case .lowpass:
      nb0 = (1 - cosine) / 2
      nb1 = 1 - cosine
      nb2 = (1 - cosine) / 2
    }
    let a0 = 1 + alpha
    b0 = nb0 / a0
    b1 = nb1 / a0
    b2 = nb2 / a0
    a1 = (-2 * cosine) / a0
    a2 = (1 - alpha) / a0
  }

  mutating func step(_ x: Double) -> Double {
    let y = b0 * x + z1
    z1 = b1 * x - a1 * y + z2
    z2 = b2 * x - a2 * y
    return y
  }
}

final class BreathFrameProcessor {
  private let sampleRate: Double
  private let frameSamples: Int
  private let emit: (BreathFrame) -> Void

  private var rumbleFilter: Biquad
  private var voiceFilter: Biquad
  private var highFilter: Biquad

  private var samplesSeen = 0
  private var sumSquares = 0.0
  private var voiceSquares = 0.0
  private var highSquares = 0.0
  private var peak = 0.0
  private var crossings = 0
  private var lastSign = 0
  private var filled = 0

  init(sampleRate: Double, emit: @escaping (BreathFrame) -> Void) {
    self.sampleRate = sampleRate
    self.frameSamples = max(1, Int((sampleRate * frameSeconds).rounded()))
    self.emit = emit
    rumbleFilter = Biquad(.highpass, frequency: rumbleCutoffHz, rate: sampleRate)
    voiceFilter = Biquad(.lowpass, frequency: voiceHighSplitHz, rate: sampleRate)
    highFilter = Biquad(.highpass, frequency: voiceHighSplitHz, rate: sampleRate)
  }

  private func resetFrame() {
    sumSquares = 0
    voiceSquares = 0
    highSquares = 0
    peak = 0
    crossings = 0
    lastSign = 0
    filled = 0
  }

  func process(_ samples: UnsafePointer<Float>, count: Int) {
    for i in 0..<count {
      let raw = Double(samples[i])

      // Peak is taken pre-filter: clipping happens at the converter.
      let magnitude = raw < 0 ? -raw : raw
      if magnitude > peak { peak = magnitude }

      let level = rumbleFilter.step(raw)
      let voice = voiceFilter.step(level)
      let high = highFilter.step(level)

      sumSquares += level * level
      voiceSquares += voice * voice
      highSquares += high * high

      let sign = level > 0 ? 1 : level < 0 ? -1 : 0
      if sign != 0 {
        if lastSign != 0 && sign != lastSign { crossings += 1 }
        lastSign = sign
      }

      filled += 1
      samplesSeen += 1

      if filled >= frameSamples {
        let n = Double(filled)
        emit(
          BreathFrame(
            t: (Double(samplesSeen) / sampleRate) * 1000,
            peak: peak,
            level: (sumSquares / n).squareRoot(),
            voice: (voiceSquares / n).squareRoot(),
            high: (highSquares / n).squareRoot(),
            zcr: Double(crossings) / n
          ))
        resetFrame()
      }
    }
  }
}
