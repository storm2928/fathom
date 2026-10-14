// The underwater soundscape, synthesized from noise and sines — no samples to
// license, nothing to download, and every voice responds continuously to how
// deep you are.
//
// Plain arithmetic, no AVFoundation, so scripts/sound-check can render it
// offline and measure it. The render path allocates nothing and takes no
// locks: parameters are plain stores read once per block, and every gain the
// listener can hear is smoothed, so nothing clicks.
//
// The mix itself is decided in TypeScript (mobile/src/sound/soundDirector.ts);
// this file only plays it. One rule is enforced here as well, because it is a
// rule about sound: with `highCut` on, a steep 500 Hz low-pass sits on the
// whole output, so the breath detector (which listens above 1 kHz) cannot hear
// the game.

import Foundation

struct SoundMixParams {
  var master: Float
  var surface: Float
  var beds: (Float, Float, Float)
  var lowpassHz: Float
  var bubbles: Float
  var highCut: Bool
}

/// Topology-preserving state-variable filter (Zavalishin). Stable under
/// fast cutoff changes, which the depth sweep needs.
private struct SVF {
  private var ic1 = 0.0, ic2 = 0.0
  private var a1 = 0.0, a2 = 0.0, a3 = 0.0, k = 1.414
  mutating func tune(_ cutoff: Double, q: Double, rate: Double) {
    let g = tan(Double.pi * min(cutoff, rate * 0.45) / rate)
    k = 1 / q
    a1 = 1 / (1 + g * (g + k))
    a2 = g * a1
    a3 = g * a2
  }
  /// Returns (low, band).
  mutating func step(_ v0: Double) -> (Double, Double) {
    let v3 = v0 - ic2
    let v1 = a1 * ic1 + a2 * v3
    let v2 = ic2 + a2 * ic1 + a3 * v3
    ic1 = 2 * v1 - ic1
    ic2 = 2 * v2 - ic2
    return (v2, v1)
  }
}

/// One-pole smoother for anything audible.
private struct Smooth {
  var value: Double
  let coef: Double
  init(_ value: Double, seconds: Double, rate: Double) {
    self.value = value
    coef = exp(-1 / (seconds * rate))
  }
  mutating func step(_ target: Double) -> Double {
    value = target + (value - target) * coef
    return value
  }
}

private struct Bubble {
  var active = false
  var phase = 0.0
  var t = 0.0
  var f0 = 800.0
  var decay = 0.02
  var gain = 0.0
}

final class Soundscape {
  private let rate: Double
  private var rng: UInt32

  // Parameters, written from outside, read per block.
  private var target = SoundMixParams(
    master: 0, surface: 1, beds: (1, 0, 0), lowpassHz: 2400, bubbles: 0, highCut: false)
  private var inhaleRequested = false
  private var pingRequested = false

  // Smoothed state.
  private var master: Smooth
  private var surface: Smooth
  private var bed0: Smooth, bed1: Smooth, bed2: Smooth
  private var cutoff: Smooth
  private var bubbleLevel: Smooth
  private var cut: Smooth

  // Noise colours.
  private var b0 = 0.0, b1 = 0.0, b2 = 0.0, brown = 0.0

  // Filters.
  private var washBand = SVF(), windBand = SVF(), airLow = SVF(), abyssLow = SVF()
  private var muffle = SVF(), muffle2 = SVF()
  private var safety1 = SVF(), safety2 = SVF()
  private var inhaleBand = SVF()

  // Oscillator phases.
  private var time = 0.0
  private var padPhase = (0.0, 0.0, 0.0)
  private var dronePhase = (0.0, 0.0)
  private var humPhase = (0.0, 0.0)
  private var whalePhase = 0.0

  // Events.
  private var whaleT = -1.0
  private var nextWhale = 6.0
  private var clickT = -1.0
  private var nextClick = 3.0
  private var clicksLeft = 0
  private var inhaleT = -1.0
  private var pingT = -1.0
  private var pingPhase = 0.0

  // Whale echo.
  private let echo: UnsafeMutablePointer<Double>
  private let echoLength: Int
  private var echoIndex = 0

  private var bubbles = [Bubble](repeating: Bubble(), count: 10)

  private var tuneCountdown = 0

  init(sampleRate: Double, seed: UInt32 = 0x0fa7_1234) {
    rate = sampleRate
    rng = seed == 0 ? 1 : seed
    master = Smooth(0, seconds: 0.25, rate: sampleRate)
    surface = Smooth(1, seconds: 0.6, rate: sampleRate)
    bed0 = Smooth(1, seconds: 2.0, rate: sampleRate)
    bed1 = Smooth(0, seconds: 2.0, rate: sampleRate)
    bed2 = Smooth(0, seconds: 2.0, rate: sampleRate)
    cutoff = Smooth(2400, seconds: 0.3, rate: sampleRate)
    bubbleLevel = Smooth(0, seconds: 0.08, rate: sampleRate)
    cut = Smooth(0, seconds: 0.08, rate: sampleRate)
    echoLength = Int(sampleRate * 0.45)
    echo = UnsafeMutablePointer<Double>.allocate(capacity: echoLength)
    echo.initialize(repeating: 0, count: echoLength)

    washBand.tune(700, q: 0.7, rate: sampleRate)
    windBand.tune(450, q: 1.2, rate: sampleRate)
    airLow.tune(320, q: 0.7, rate: sampleRate)
    abyssLow.tune(120, q: 0.7, rate: sampleRate)
    safety1.tune(500, q: 0.707, rate: sampleRate)
    safety2.tune(500, q: 0.707, rate: sampleRate)
    inhaleBand.tune(500, q: 1.5, rate: sampleRate)
  }

  deinit {
    echo.deallocate()
  }

  func setMix(_ mix: SoundMixParams) {
    target = mix
  }

  /// A soft sonar ping with one echo, for a discovery.
  func ping() {
    pingRequested = true
  }

  /// A soft rising breath of filtered noise, for the inhale prompt.
  func inhale() {
    inhaleRequested = true
  }

  // MARK: - Render

  func render(_ out: UnsafeMutablePointer<Float>, frames: Int) {
    let p = target
    if inhaleRequested {
      inhaleRequested = false
      inhaleT = 0
    }
    if pingRequested {
      pingRequested = false
      pingT = 0
    }
    let dt = 1 / rate
    let twoPi = 2 * Double.pi

    for i in 0..<frames {
      // Smoothed controls.
      let m = master.step(Double(p.master))
      let sGain = surface.step(Double(p.surface))
      let g0 = bed0.step(Double(p.beds.0))
      let g1 = bed1.step(Double(p.beds.1))
      let g2 = bed2.step(Double(p.beds.2))
      let fc = cutoff.step(Double(p.lowpassHz))
      let bub = bubbleLevel.step(Double(p.bubbles))
      let hc = cut.step(p.highCut ? 1 : 0)

      if tuneCountdown == 0 {
        muffle.tune(fc, q: 0.707, rate: rate)
        muffle2.tune(fc * 1.4, q: 0.6, rate: rate)
        tuneCountdown = 32
      }
      tuneCountdown -= 1

      // Noise: white, pink (Kellet economy), brown.
      let white = nextWhite()
      b0 = 0.99765 * b0 + white * 0.0990460
      b1 = 0.96300 * b1 + white * 0.2965164
      b2 = 0.57000 * b2 + white * 1.0526913
      let pink = (b0 + b1 + b2 + white * 0.1848) * 0.18
      brown = (brown + 0.02 * white) / 1.02
      let brownOut = brown * 3.5

      // Surface: slow swells of brown noise, a washing band, wind.
      let swell =
        (0.55 + 0.45 * sin(twoPi * 0.11 * time)) * (0.65 + 0.35 * sin(twoPi * 0.037 * time + 1.3))
      let wash = washBand.step(pink).1 * swell * swell * 0.9
      let wind = windBand.step(pink).1 * (0.7 + 0.3 * sin(twoPi * 0.05 * time)) * 0.35
      let surfaceSound = (brownOut * swell * 0.45 + wash + wind) * sGain

      // Twilight: an airy, slowly breathing pad.
      var bedSound = 0.0
      if g0 > 0.0005 {
        padPhase.0 += 196.0 * dt
        padPhase.1 += 293.66 * dt
        padPhase.2 += 392.4 * dt
        let pad =
          sin(twoPi * padPhase.0) * (0.5 + 0.5 * sin(twoPi * 0.07 * time))
          + sin(twoPi * padPhase.1) * (0.5 + 0.5 * sin(twoPi * 0.05 * time + 2))
          + sin(twoPi * padPhase.2) * (0.5 + 0.5 * sin(twoPi * 0.031 * time + 4)) * 0.6
        let air = airLow.step(pink).0
        bedSound += (pad * 0.045 + air * 0.35) * g0
      }

      // Midnight: a deep drone, and now and then a whale far off.
      if g1 > 0.0005 {
        dronePhase.0 += 55.0 * dt
        dronePhase.1 += 82.5 * dt
        var mid = sin(twoPi * dronePhase.0) * 0.14 + sin(twoPi * dronePhase.1) * 0.06
        if whaleT < 0 {
          nextWhale -= dt
          if nextWhale <= 0 {
            whaleT = 0
            nextWhale = 18 + Double(nextUnit()) * 17
          }
        } else {
          let u = whaleT / 3.6
          if u >= 1 {
            whaleT = -1
          } else {
            let f = 140 + 170 * sin(Double.pi * u) + 6 * sin(twoPi * 4.2 * whaleT)
            whalePhase += f * dt
            let env = pow(sin(Double.pi * u), 2)
            mid += sin(twoPi * whalePhase) * env * 0.16
            whaleT += dt
          }
        }
        // A long, faint echo makes the call sound like it crossed open water.
        let delayed = echo[echoIndex]
        echo[echoIndex] = mid + delayed * 0.38
        echoIndex = (echoIndex + 1) % echoLength
        bedSound += (mid + delayed * 0.3) * g1
      }

      // Abyss: a low hum, and rare clicks out in the dark.
      if g2 > 0.0005 {
        humPhase.0 += 41.0 * dt
        humPhase.1 += 82.0 * dt
        var deep =
          sin(twoPi * humPhase.0) * 0.17 + sin(twoPi * humPhase.1) * 0.05
          + abyssLow.step(brownOut).0 * 0.5
        if clickT < 0 {
          nextClick -= dt
          if nextClick <= 0 {
            clickT = 0
            clicksLeft = 1 + Int(nextUnit() * 3)
            nextClick = 2.5 + Double(nextUnit()) * 4.5
          }
        } else {
          deep += white * exp(-clickT / 0.0015) * 0.3
          clickT += dt
          if clickT > 0.09 {
            clicksLeft -= 1
            clickT = clicksLeft > 0 ? 0 : -1
          }
        }
        bedSound += deep * g2
      }

      // Everything above is heard through the water.
      let ambient = surfaceSound + bedSound
      let muffled = muffle2.step(muffle.step(ambient).0).0

      // Bubbles: short rising chirps, near the diver, barely muffled.
      var bubbleSound = 0.0
      if bub > 0.001 {
        if Double(nextUnit()) < 12 * bub * dt { spawnBubble(gain: bub) }
      }
      for j in 0..<bubbles.count where bubbles[j].active {
        var b = bubbles[j]
        let f = b.f0 * (1 + b.t * 9)
        b.phase += f * dt
        let env = exp(-b.t / b.decay)
        bubbleSound += sin(twoPi * b.phase) * env * b.gain
        b.t += dt
        if env < 0.001 { b.active = false }
        bubbles[j] = b
      }

      // The inhale: a soft swell of breathy noise rising in pitch.
      var inhaleSound = 0.0
      if inhaleT >= 0 {
        let u = inhaleT / 0.8
        if u >= 1 {
          inhaleT = -1
        } else {
          if tuneCountdown == 31 { inhaleBand.tune(320 + 600 * u, q: 1.5, rate: rate) }
          inhaleSound = inhaleBand.step(pink).1 * sin(Double.pi * u) * 0.5
          inhaleT += dt
        }
      }

      // The discovery ping: a pure tone sliding gently down, and its echo.
      var pingSound = 0.0
      if pingT >= 0 {
        if pingT > 2.2 {
          pingT = -1
        } else {
          pingPhase += (880 - 40 * min(pingT, 1)) * dt
          let env = Soundscape.pingVoice(pingT) + 0.35 * Soundscape.pingVoice(pingT - 0.42)
          pingSound = sin(twoPi * pingPhase) * env * 0.22
          pingT += dt
        }
      }

      var mix = muffled + bubbleSound + inhaleSound + pingSound

      // Speaker safety: crossfade into a 24 dB/oct 500 Hz low-pass.
      let safe = safety2.step(safety1.step(mix).0).0
      mix = mix * (1 - hc) + safe * hc

      // Gentle saturation keeps every sum inside ±1 without a hard clip.
      out[i] = Float(tanh(mix * m * 0.9))
      time += dt
    }
  }

  // MARK: - Helpers

  /// A ping's envelope: a 6 ms attack and a long, soft decay.
  private static func pingVoice(_ t: Double) -> Double {
    t < 0 ? 0 : min(1, t / 0.006) * exp(-t / 0.45)
  }

  private func spawnBubble(gain: Double) {
    for j in 0..<bubbles.count where !bubbles[j].active {
      bubbles[j] = Bubble(
        active: true, phase: 0, t: 0,
        f0: 900 + Double(nextUnit()) * 1700,
        decay: 0.012 + Double(nextUnit()) * 0.02,
        gain: 0.3 * gain * (0.5 + Double(nextUnit()) * 0.5))
      return
    }
  }

  /// xorshift32 → [-1, 1)
  private func nextWhite() -> Double {
    rng ^= rng << 13
    rng ^= rng >> 17
    rng ^= rng << 5
    return Double(rng) / 2_147_483_648.0 - 1
  }

  /// [0, 1)
  private func nextUnit() -> Float {
    rng ^= rng << 13
    rng ^= rng >> 17
    rng ^= rng << 5
    return Float(rng >> 8) / 16_777_216
  }
}
