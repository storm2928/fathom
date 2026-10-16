# Fathom iOS — Plan 7: release readiness

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the gaps between the finished game and an App Store submission: a privacy policy (in the app and at a public URL), a support page, Apple Health mindful minutes, a hint when the microphone cannot hear the player, a Dynamic Type and VoiceOver pass, and a French store listing.

**Architecture:** Pure, tested TypeScript for every decision (when to show the hint, what to write to Health, how far text may scale); thin native bridges with web no-op fallbacks, following `native/fathomHaptics.ts`; one new Swift plugin (`FathomHealthPlugin`) registered in `FathomViewController`. Policy text lives once in `src/privacy/policy.ts`; the public HTML page is checked against it by a test.

**Tech Stack:** React 19, Capacitor 8, Swift (HealthKit), the repo's own test harness (`npm test -w mobile`).

**Spec:** `docs/superpowers/specs/2026-10-13-fathom-ios-game-design.md`

## Global Constraints

- Nothing leaves the device. No account, no server, no analytics.
- No streaks, no notifications, no "dive again" prompt. Health writes minutes only — no scores, no rates.
- Claims stay "trains arousal regulation, measured live". Not therapy, not diagnosis, not for crisis.
- Every new string exists in EN and FR (`src/strings.ts` pattern).
- Calm only: no error buzzes, no alarms. A hint is one quiet line.
- Commits: no Co-Authored-By trailer (DEVELOPMENT.md rule 8).

## Decided against

- **Background grace period.** A mic dive cannot survive backgrounding: iOS takes the input away and the app deliberately ends the dive as signal-lost rather than invent measurements (commit 0e1442b). Pulling down Control Center or a notification does not background the app, so the accidental case is already safe. A true pause would need pause support in the shared session machine and would distort the before/after rate. Not built.

## Review Focus

1. Health switched on, then access declined in the iOS sheet → the switch must fall back to off with a one-line note, and dives must never try to write.
2. A dive left after a few seconds → nothing written to Health (under 30 s is not a session).
3. A mic dive where the player is breathing but quietly at first → the hint must clear the moment one breath out is heard, and never show on touch dives.
4. Largest accessibility text size → settings, onboarding and journal stay usable; the dive HUD does not grow past its layout.
5. Contact email unset → no broken `mailto:` anywhere; the policy still renders.

---

### Task 1: Privacy policy and support pages

**Files:**
- Create: `mobile/src/privacy/policy.ts`, `mobile/src/privacy/policy.test.ts`, `mobile/src/screens/PrivacySheet.tsx`
- Create: `public/privacy.html`, `public/support.html` (served by the Render static site)
- Modify: `mobile/src/screens/SettingsSheet.tsx` (a "Privacy policy" button), `mobile/src/App.tsx`, `mobile/src/strings.ts`, `mobile/src/testing/run.ts`

**Interfaces:**
- Produces: `POLICY: Record<'en'|'fr', { title; updated; sections: { heading; body: string[] }[] }>`, `CONTACT_EMAIL: string`, `<PrivacySheet onClose />`.

- [ ] Test: every EN section heading appears in `public/privacy.html`; EN and FR have the same number of sections; the policy mentions microphone, Apple Health, and deletion.
- [ ] Implement policy text, sheet, settings entry, HTML pages.
- [ ] `npm test -w mobile` passes; commit.

### Task 2: Microphone hint

**Files:**
- Create: `mobile/src/dive/unheardWatch.ts`, `mobile/src/dive/unheardWatch.test.ts`
- Modify: `mobile/src/dive/diveController.ts` (wire it; new optional callback `onUnheard?(unheard: boolean)`), `mobile/src/App.tsx`, `mobile/src/dive/DiveHud.tsx`, `mobile/src/strings.ts`

**Interfaces:**
- Produces: `class UnheardWatch { constructor(missesToWarn = 2); window(step: PromptStep): boolean | null; heard(): boolean | null }` — each returns the new `unheard` value when it changed, else `null`.

- [ ] Tests: two exhale windows with no breath out → unheard; one breath out → cleared at once; one miss alone → nothing; a breath out heard before the window opened counts.
- [ ] Wire into the controller for `code === 'microphone'` only; HUD shows `a.micUnheard` in a `role="status"` line.
- [ ] Tests pass; commit.

### Task 3: Apple Health mindful minutes

**Files:**
- Create: `mobile/ios/App/App/FathomHealthPlugin.swift`, `mobile/ios/App/App/App.entitlements`
- Create: `mobile/src/native/fathomHealth.ts`, `mobile/src/app/health.ts`, `mobile/src/app/health.test.ts`
- Modify: `FathomViewController.swift`, `project.pbxproj` (file refs + `CODE_SIGN_ENTITLEMENTS`), `Info.plist` (`NSHealthUpdateUsageDescription`), `storage.ts` (`loadHealth`/`saveHealth`, default off), `SettingsSheet.tsx`, `App.tsx`, `strings.ts`

**Interfaces:**
- Produces: `mindfulSession(result: { durationMs: number }, endedAt: Date): { start: Date; end: Date } | null` (null under 30 s); `health.available(): Promise<boolean>`, `health.authorize(): Promise<boolean>`, `health.saveMindful(start: Date, end: Date): Promise<void>` (no-ops off native).

- [ ] Tests: 90 s dive → 90 s session ending at `endedAt`; 20 s → null; storage default off, round-trips, survives a broken store.
- [ ] Swift plugin: write-only `HKCategoryTypeIdentifier.mindfulSession`; `authorize` resolves `sharingAuthorized`.
- [ ] Settings switch hidden when Health is unavailable; declined → switch off + note.
- [ ] Build for simulator; commit.

### Task 4: Dynamic Type and VoiceOver

**Files:**
- Create: `mobile/src/app/typeScale.ts`, `mobile/src/app/typeScale.test.ts`
- Modify: `mobile/src/main.tsx`, the CSS files' reading-text `font-size` values (< 26px) to `calc(Npx * var(--ts, 1))`, `DiveHud.tsx` (live prompt announcement, label on the hold surface)

**Interfaces:**
- Produces: `typeScale(systemBodyPx: number): number` — `systemBodyPx / 17`, clamped to [1, 1.4]; `applyTypeScale(doc)` sets `--ts` on `<html>`, re-run when the app becomes visible.

- [ ] Tests: 17 → 1; 23 → 1.35; 40 → 1.4; 12 → 1; NaN → 1.
- [ ] Check the largest size on the simulator (`xcrun simctl ui booted content_size accessibility-extra-extra-extra-large`).
- [ ] Commit.

### Task 5: Store listing and release notes

**Files:**
- Create: `docs/app-store/listing.fr.md`
- Modify: `docs/app-store/listing.md` (URLs, Health in description and review notes), `docs/app-store/release.md` (HealthKit capability, device checks)

- [ ] Commit.
