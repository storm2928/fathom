// Generated ambient music for the dive: slow, warm chords that fade into one
// another about once a breath, and now and then a soft bell from the same
// scale. It deepens with the dive — brighter chords with bells in the
// twilight, lower and slower at midnight, a few low chords and no bells in the
// abyss.
//
// Plain arithmetic, like Soundscape: nothing allocates on the render path, so
// scripts/sound-check can render it offline. Soundscape mixes it in and owns
// the speaker-safety cut, which this file never needs to know about.

import Foundation

struct AmbientMusic {
  private let rate: Double
  private var rng: UInt32

  /// The chords each zone moves through, as MIDI notes. D major, kept soft:
  /// D add9, B minor 7, G major 7, A sus2 — and lower, and fewer, going down.
  private static let progressions: [[[Double]]] = [
    [[50, 57, 64, 66], [47, 54, 57, 62], [43, 50, 54, 59], [45, 52, 57, 59]],
    [[38, 45, 52, 54], [35, 42, 45, 50], [31, 38, 42, 47], [33, 40, 45, 47]],
    [[38, 45, 52], [43, 50, 57]],
  ]
  /// Seconds each chord holds before the next fades in.
  private static let chordSeconds: [Double] = [8, 11, 15]
  /// Bell notes, D major pentatonic; none in the abyss.
  private static let bellNotes: [[Double]] = [
    [74, 76, 78, 81, 83, 86],
    [62, 64, 66, 69, 71],
    [],
  ]
  /// Seconds between bells: a random wait in this range.
  private static let bellGap: [(Double, Double)] = [(3, 7), (7, 14), (0, 0)]
  private static let bellLevel: [Double] = [0.07, 0.05, 0]

  private static let attack = 2.5
  private static let release = 3.5
  private static let noteLevel = 0.06
  /// Two oscillators per note, a few cents apart, for warmth.
  private static let detune = 0.0009

  /// Two chords at a time: the one sounding and the one fading in or out.
  private struct ChordSlot {
    var active = false
    var age = 0.0
    var hold = 8.0
    var count = 0
    var freqs = [Double](repeating: 0, count: 4)
    var phaseA = [Double](repeating: 0, count: 4)
    var phaseB = [Double](repeating: 0, count: 4)
  }

  private struct Bell {
    var active = false
    var t = 0.0
    var freq = 0.0
    var phase = 0.0
    var partial = 0.0
    var level = 0.0
  }

  private var slots = [ChordSlot(), ChordSlot()]
  private var current = 0
  private var chordIndex = 0
  private var untilNextChord = 0.0
  private var bells = [Bell](repeating: Bell(), count: 3)
  private var untilNextBell = 2.0
  private var time = 0.0

  init(sampleRate: Double, seed: UInt32 = 0x5eed_c40d) {
    rate = sampleRate
    rng = seed == 0 ? 1 : seed
  }

  /// One sample of music for this zone (0 twilight, 1 midnight, 2 abyss).
  mutating func next(zone rawZone: Int) -> Double {
    let zone = max(0, min(2, rawZone))
    let dt = 1 / rate
    let twoPi = 2 * Double.pi

    untilNextChord -= dt
    if untilNextChord <= 0 { startChord(zone: zone) }

    var out = 0.0
    for s in 0..<slots.count where slots[s].active {
      var slot = slots[s]
      let env = AmbientMusic.envelope(age: slot.age, hold: slot.hold)
      if env <= 0 && slot.age > slot.hold {
        slot.active = false
        slots[s] = slot
        continue
      }
      for n in 0..<slot.count {
        let f = slot.freqs[n]
        slot.phaseA[n] = (slot.phaseA[n] + f * (1 + AmbientMusic.detune) * dt).truncatingRemainder(dividingBy: 1)
        slot.phaseB[n] = (slot.phaseB[n] + f * (1 - AmbientMusic.detune) * dt).truncatingRemainder(dividingBy: 1)
        // A slow shimmer per note, so a held chord breathes.
        let shimmer = 0.8 + 0.2 * sin(twoPi * (0.05 + 0.013 * Double(n)) * time + Double(n))
        out += (AmbientMusic.voice(slot.phaseA[n]) + AmbientMusic.voice(slot.phaseB[n]))
          * 0.5 * shimmer * env * AmbientMusic.noteLevel
      }
      slot.age += dt
      slots[s] = slot
    }

    // Bells.
    let notes = AmbientMusic.bellNotes[zone]
    if !notes.isEmpty {
      untilNextBell -= dt
      if untilNextBell <= 0 {
        ring(notes: notes, level: AmbientMusic.bellLevel[zone])
        let gap = AmbientMusic.bellGap[zone]
        untilNextBell = gap.0 + Double(nextUnit()) * (gap.1 - gap.0)
      }
    }
    for b in 0..<bells.count where bells[b].active {
      var bell = bells[b]
      bell.phase = (bell.phase + bell.freq * dt).truncatingRemainder(dividingBy: 1)
      bell.partial = (bell.partial + bell.freq * 2.76 * dt).truncatingRemainder(dividingBy: 1)
      let attack = min(1, bell.t / 0.005)
      let body = sin(twoPi * bell.phase) * exp(-bell.t / 2.2)
      let shine = 0.3 * sin(twoPi * bell.partial) * exp(-bell.t / 0.6)
      out += (body + shine) * attack * bell.level
      bell.t += dt
      if bell.t > 8 { bell.active = false }
      bells[b] = bell
    }

    time += dt
    return out
  }

  // MARK: - Helpers

  /// Fade in over the attack, hold, then fade out over the release.
  private static func envelope(age: Double, hold: Double) -> Double {
    let rise = min(1, age / attack)
    let fall = age < hold ? 1 : max(0, 1 - (age - hold) / release)
    let r = rise * rise * (3 - 2 * rise)
    return r * fall
  }

  /// A warm voice: the fundamental with a little second and third harmonic.
  private static func voice(_ phase: Double) -> Double {
    let s = sin(2 * Double.pi * phase)
    let c = cos(2 * Double.pi * phase)
    let h2 = 2 * s * c
    let h3 = s * (3 - 4 * s * s)
    return s + 0.22 * h2 + 0.06 * h3
  }

  private static func hz(_ midi: Double) -> Double {
    440 * pow(2, (midi - 69) / 12)
  }

  private mutating func startChord(zone: Int) {
    let chords = AmbientMusic.progressions[zone]
    chordIndex = (chordIndex + 1) % chords.count
    let notes = chords[chordIndex]
    let hold = AmbientMusic.chordSeconds[zone]
    current = 1 - current
    var slot = slots[current]
    slot.active = true
    slot.age = 0
    slot.hold = hold
    slot.count = min(notes.count, slot.freqs.count)
    for n in 0..<slot.count {
      slot.freqs[n] = AmbientMusic.hz(notes[n])
      slot.phaseA[n] = Double(nextUnit())
      slot.phaseB[n] = Double(nextUnit())
    }
    slots[current] = slot
    // The next chord starts as this one begins to let go.
    untilNextChord = hold
  }

  private mutating func ring(notes: [Double], level: Double) {
    guard let b = bells.firstIndex(where: { !$0.active }) else { return }
    let note = notes[Int(nextUnit() * Float(notes.count)) % notes.count]
    bells[b] = Bell(active: true, t: 0, freq: AmbientMusic.hz(note), phase: 0, partial: 0, level: level)
  }

  /// xorshift32 → [0, 1)
  private mutating func nextUnit() -> Float {
    rng ^= rng << 13
    rng ^= rng >> 17
    rng ^= rng << 5
    return Float(rng) / Float(UInt32.max)
  }
}
