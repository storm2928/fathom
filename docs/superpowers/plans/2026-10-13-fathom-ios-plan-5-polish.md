# Fathom iOS — Plan 5: Screens & Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans.

**Goal:** First run and the end of a dive feel finished: a three-card onboarding, a rise back to the light when the dive ends, the dive log shareable through iOS, a language switch, and the small fixes from earlier reviews.

**Spec:** `docs/superpowers/specs/2026-10-13-fathom-ios-game-design.md` (Sections 1 and 2)

## Global Constraints

- The website's safety screen marks `not1`, `care1`–`care3`, `voiceShort` and `measuredShort` as **required to stay visible without a click**. The single-sheet safety gate from Plan 1 omitted most of them — a regression this plan fixes: every one appears on an onboarding card, verbatim from `src/shell/strings/safety.ts`.
- Crisis numbers stay on the safety card and the results.
- No dive is reachable before the safety card is acknowledged (flow rules unchanged).

## Tasks

1. **Onboarding (3 cards, swipe or Next):**
   - *How to breathe* — an animated breath orb (in, a little more, long out), `measuredShort`.
   - *Microphone or touch* — the choice, `voiceShort`; choosing the microphone asks iOS for permission there and then (`FathomMic.requestPermission`); a refusal switches to touch and says so.
   - *Before you dive* — `lead`, `not1`, `care1`–`care3`, `stopAnyTime`, the crisis row, and "I have read this — continue".
   - Re-readable from Settings ("How to breathe and stay safe").
2. **Surfacing:** `DiveScene.ascend(seconds)` (TDD) eases the drawn depth back to the surface; the app calls it when a dive ends, so the results sit over a rising camera that returns to the dawn waterline.
3. **Share the dive log:** `@capacitor/share` + `@capacitor/filesystem`; "Save dive log" in the results' info sheet writes the existing `buildDiveLog` JSON to the cache and opens the share sheet.
4. **Language:** EN/FR switch in Settings.
5. **Review fixes:** a second finger no longer ends a hold early (track the active pointer); the ocean shows a message if the renderer cannot start; delete the stray iCloud duplicate `config 2.xml`; zone card over-line legible on the sky.
