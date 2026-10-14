# Fathom iOS — Plan 3: Haptics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans.

**Goal:** Feel the dive in your hands: a soft rumble while you breathe out, a light tap on each breath-in prompt so the rhythm can be followed eyes closed, a deep thud when you cross into a new zone — calm, never a buzz.

**Architecture:** Pure TypeScript decides what to feel (`hapticDirector.ts`, tested); a native `FathomHaptics` plugin plays it with Core Haptics (a continuous player whose intensity is updated live, plus transient patterns). A settings toggle turns haptics off, saved like volume.

**Spec:** `docs/superpowers/specs/2026-10-13-fathom-ios-game-design.md` (Section 2, Haptics)

## Global Constraints

- Calm only: no error buzzes, no reward bursts; nothing stronger than the zone thud.
- **Microphone dives get no continuous exhale rumble** (deviation from the spec, decided here): the Taptic Engine's hum sits around 150–250 Hz, inside the detector's voice band, and a rumble during the breath could lower its breath-to-voice ratio and cut the breath short. Mic dives get one soft pulse when a breath out begins. Touch dives get the rumble. Revisit with on-device recordings.
- Haptics off in settings means nothing plays at all.
- Devices without haptics (the simulator, iPads) are a silent no-op, never an error.

## Tasks

1. **`hapticDirector.ts` (TDD):** `exhaleFeel(seconds, input)` → `{ rumble: number | null }` (null for mic); rumble eases in over 0.4 s from 0.15 to 0.35, then grows slowly with the breath's length to a 0.55 cap — longer breaths feel deeper, matching the descent. `loadHaptics/saveHaptics` in storage (default on, throw-safe).
2. **`FathomHapticsPlugin.swift`:** `CHHapticEngine` with stopped/reset handlers that restart it; `exhaleStart(intensity)`, `exhaleLevel(intensity)`, `exhaleStop()` via a continuous advanced player and `hapticIntensityControl`; `tap({ kind: 'inhale' | 'zone' | 'onset' })`.
3. **Wiring:** a `useHaptics` hook polls the dive at 50 ms (exhaling, elapsed) and drives the rumble; inhale/top-up prompts tap; entering zone 2 or 3 thuds; settings toggle; all calls no-op off device.
4. **Verify:** suites green; simulator run shows plugin calls and no crash (the simulator has no Taptic Engine, so the user feels it on a phone).
