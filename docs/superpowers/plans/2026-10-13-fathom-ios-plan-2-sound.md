# Fathom iOS — Plan 2: Sound Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A procedural underwater soundscape that makes the dive feel real — surface waves that muffle as you sink, a bed per zone, bubbles on every breath out, a soft rise on the double inhale — without ever being heard by the breath microphone as a breath.

**Architecture:** Sound is synthesized natively (Swift, inside the same AVAudioSession the microphone uses) and steered from JavaScript. A pure TypeScript `SoundDirector` turns game state into a `SoundMix` (gains, filter cutoff, bubble rate) and applies the speaker-safety rules; a native `FathomSound` plugin renders that mix with `Soundscape`, a pure-arithmetic synth that a CLI harness can render offline for tests. The audio session is configured once at launch (play-and-record, measurement mode, speaker default) so starting the microphone never interrupts the sound.

**Why native, not Web Audio (deviation from the spec, decided after Plan 1 debugging):** the web view hands out a mock microphone in the simulator and manages its own audio session; sound played there can re-categorise the session and break the native microphone. One native session for both avoids that, and gives the route (speaker vs headphones) the safety rules need.

**Tech Stack:** Swift (AVAudioEngine, AVAudioSourceNode), TypeScript, Capacitor 8, in-repo test harness, swiftc CLI harness.

**Spec:** `docs/superpowers/specs/2026-10-13-fathom-ios-game-design.md` (Section 2, Sound)

## Global Constraints

- The breath detector listens above 100 Hz and wants broadband energy above 1 kHz (`public/breath-processor.js`). On the **speaker** route, while an exhale can be scored (conductor exhale or rest step), the mix must carry **no content above 500 Hz** and bubbles must be silent — otherwise playback can read as, or prolong, an exhale. On headphones the full mix plays.
- Volume comes from settings (`loadVolume`, 0–1) and scales the master.
- Calm only: no stings, no alarms, no rewards that feel like a slot machine. Every gain change is smoothed (≥ 80 ms) — no clicks.
- Real-time render code allocates nothing and takes no locks.
- Nothing recorded, nothing sent.
- Commits: plain messages, no Co-Authored-By trailer.

## Review Focus

- **Speaker + exhale window:** mix above 500 Hz and bubbles must be silent. (SoundDirector test + Swift harness test.)
- **Headphones unplugged mid-dive:** route event flips to speaker rules within one update. (SoundDirector test on route.)
- **Volume 0:** true silence. (Harness test.)
- **Mic start while sound plays:** no session reconfiguration, no interruption. (Session configured once at launch; mic plugin no longer touches category or activation.)
- **App backgrounded:** sound stops with the dive's lifecycle; resumes on return to the title.

---

### Task 1: One audio session for the app, plus the output route

**Files:** Create `mobile/ios/App/App/AudioSession.swift`; Modify `FathomMicPlugin.swift` (stop setting category/activating/deactivating), `FathomViewController.swift` (configure at load, register `FathomSound`).

- [ ] `AudioSession.configure()`: `.playAndRecord`, mode `.measurement`, options `[.defaultToSpeaker, .allowBluetoothA2DP, .mixWithOthers]`, `setActive(true)`; called once from `capacitorDidLoad`.
- [ ] `AudioSession.headphones` → true when any current output port is headphones, Bluetooth (A2DP/LE/HFP) or USB audio.
- [ ] Mic plugin only installs/removes its tap and starts/stops its engine.
- [ ] Verify on the simulator: mic dive still captures (frames flowing), no crash.

### Task 2: `SoundDirector` — game state to mix, with the speaker-safety rules (TDD)

**Files:** Create `mobile/src/sound/soundDirector.ts`, `mobile/src/sound/soundDirector.test.ts`.

**Interfaces:**
```ts
export interface SoundInput {
  screen: 'safety' | 'title' | 'predive' | 'dive' | 'results';
  depth: number;            // metres
  zone: number;             // 0..2
  exhaling: boolean;        // engine phase
  exhaleWindow: boolean;    // conductor expects an exhale (exhale or rest step)
  headphones: boolean;
  volume: number;           // 0..1 from settings
}
export interface SoundMix {
  master: number;           // 0..1, already includes volume
  surface: number;          // waves + wind gain
  beds: [number, number, number];
  lowpassHz: number;        // underwater muffling on surface + beds
  bubbles: number;          // 0..1 bubble intensity
  highCut: boolean;         // speaker safety: nothing above 500 Hz
}
export function mixFor(input: SoundInput): SoundMix;
```

Tests: depth closes the filter monotonically; surface fades out with depth; only the current zone's bed is up; bubbles only while exhaling; speaker + exhale window → `highCut` and bubbles 0 and lowpass ≤ 500; headphones → no highCut, bubbles on; volume 0 → master 0; results/safety screens quieter than the dive.

### Task 3: `Soundscape` synth + offline harness (TDD)

**Files:** Create `mobile/ios/App/App/Soundscape.swift` (pure arithmetic), `mobile/scripts/sound-check/main.swift`, `mobile/scripts/sound-check/check.mjs`; npm script `test:sound`.

Voices: brown-noise waves with slow swells, pink wind; per-zone beds (twilight airy pad, midnight drone + occasional whale glide, abyss low hum + rare clicks); Minnaert-style bubbles (fast rising sine chirps with decay); inhale rise (filtered noise swell). One-pole smoothing on every gain; a state-variable low-pass for the muffling; a hard 500 Hz low-pass stage when `highCut`.

Harness renders seconds of audio for given mixes and asserts: master 0 is silent; deeper (lower cutoff) has less energy above 1 kHz; bubbles add energy above 1 kHz; `highCut` leaves < 1% of the energy above 1 kHz and bubbles inaudible; no sample exceeds ±1.

### Task 4: `FathomSound` plugin and app wiring

**Files:** Create `FathomSoundPlugin.swift`; `mobile/src/native/fathomSound.ts`; `mobile/src/sound/useSoundscape.ts`; Modify `App.tsx`, `DiveController` (expose exhale phase / window via callbacks).

- [ ] Plugin: `start()`, `stop()`, `setMix(mix)`, `inhale()`; emits `route` `{ headphones }`.
- [ ] Hook samples game state every 100 ms → `mixFor` → `setMix`; fires `inhale()` on each inhale/top-up prompt; stops on background, restarts on foreground.
- [ ] Settings volume applies live.

### Task 5: Verify

- [ ] All suites + `test:dsp` + `test:sound` green; simulator run with the mic autoplay: frames still flow while sound plays; no crash; the user listens.
