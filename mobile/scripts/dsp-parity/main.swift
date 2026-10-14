// Parity harness for BreathFrameProcessor. Reads raw little-endian Float32
// samples and prints one JSON frame per line, fed in the same 128-sample
// blocks the web worklet receives. Used only by parity.mjs.
import Foundation

let args = CommandLine.arguments
guard args.count == 3, let rate = Double(args[2]) else {
  FileHandle.standardError.write("usage: parity <samples.f32> <sampleRate>\n".data(using: .utf8)!)
  exit(2)
}
let data = try Data(contentsOf: URL(fileURLWithPath: args[1]))
let samples: [Float] = data.withUnsafeBytes { Array($0.bindMemory(to: Float.self)) }

var lines: [String] = []
let processor = BreathFrameProcessor(sampleRate: rate) { frame in
  lines.append(
    "{\"t\":\(frame.t),\"peak\":\(frame.peak),\"level\":\(frame.level),\"voice\":\(frame.voice),\"high\":\(frame.high),\"zcr\":\(frame.zcr)}"
  )
}
samples.withUnsafeBufferPointer { buffer in
  var i = 0
  while i < buffer.count {
    let n = min(128, buffer.count - i)
    processor.process(buffer.baseAddress! + i, count: n)
    i += n
  }
}
print(lines.joined(separator: "\n"))
