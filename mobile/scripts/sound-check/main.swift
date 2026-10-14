// Offline renderer for Soundscape. Renders a mix for a few seconds after it
// settles and prints what was heard: overall RMS, RMS above 1 kHz (where the
// breath detector listens), and the largest sample. Used only by check.mjs.
import Foundation

let rate = 48_000.0
let args = CommandLine.arguments
guard args.count == 2 else {
  FileHandle.standardError.write("usage: sound-check <scenario>\n".data(using: .utf8)!)
  exit(2)
}

func mix(_ changes: (inout SoundMixParams) -> Void) -> SoundMixParams {
  var m = SoundMixParams(
    master: 1, surface: 1, beds: (1, 0, 0), lowpassHz: 2400, bubbles: 0, highCut: false)
  changes(&m)
  return m
}

let scenarios: [String: SoundMixParams] = [
  "silent": mix { $0.master = 0; $0.bubbles = 1 },
  "shallow": mix { _ in },
  "deep": mix { $0.lowpassHz = 260; $0.surface = 0 },
  "bubbles": mix { $0.bubbles = 1 },
  // Worst case: bright, bubbling, and the cut alone must make it safe.
  "speaker-window": mix { $0.bubbles = 1; $0.highCut = true },
  "midnight": mix { $0.surface = 0; $0.beds = (0, 1, 0); $0.lowpassHz = 700 },
  "abyss": mix { $0.surface = 0; $0.beds = (0, 0, 1); $0.lowpassHz = 300 },
]
guard let params = scenarios[args[1]] else {
  FileHandle.standardError.write("unknown scenario \(args[1])\n".data(using: .utf8)!)
  exit(2)
}

let soundscape = Soundscape(sampleRate: rate, seed: 7)
soundscape.setMix(params)
let block = 512
var buffer = [Float](repeating: 0, count: block)

// Let every smoothed parameter settle before measuring.
for _ in 0..<Int(rate * 4.0) / block {
  buffer.withUnsafeMutableBufferPointer { soundscape.render($0.baseAddress!, frames: block) }
}

// Measure: a 4th-order 1 kHz high-pass (two cascaded TPT sections) isolates
// the band the breath detector listens to.
struct HighPass {
  var ic1 = 0.0, ic2 = 0.0
  let a1, a2, a3, k: Double
  init(_ fc: Double) {
    let g = tan(Double.pi * fc / rate)
    k = 2.0.squareRoot()
    a1 = 1 / (1 + g * (g + k)); a2 = g * a1; a3 = g * a2
  }
  mutating func step(_ v0: Double) -> Double {
    let v3 = v0 - ic2
    let v1 = a1 * ic1 + a2 * v3
    let v2 = ic2 + a2 * ic1 + a3 * v3
    ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2
    return v0 - k * v1 - v2
  }
}
var hp1 = HighPass(1000), hp2 = HighPass(1000)
var sum = 0.0, highSum = 0.0, peak = 0.0, n = 0.0
for _ in 0..<Int(rate * 4.0) / block {
  buffer.withUnsafeMutableBufferPointer { soundscape.render($0.baseAddress!, frames: block) }
  for x in buffer {
    let v = Double(x)
    sum += v * v
    let h = hp2.step(hp1.step(v))
    highSum += h * h
    peak = max(peak, abs(v))
    n += 1
  }
}
print("{\"rms\":\((sum / n).squareRoot()),\"high\":\((highSum / n).squareRoot()),\"peak\":\(peak)}")
