# Fathom Web Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The website becomes the iOS app (`mobile/`), running in a desktop browser, laid out for a big screen, with its sound.

**Architecture:** `mobile/` already runs in a browser. It uses the web AudioWorklet breath engine and localStorage when not native. Add four things on top: web wording and policy variants chosen once at startup, a TypeScript port of the Swift synth played through an AudioWorklet, a desktop-only CSS layer, and a root build and deploy that ships `mobile/dist`. Then delete the old website entry and its pages.

**Tech Stack:** React 19, Vite 8, TypeScript 6, PixiJS 8, Capacitor 8 (native only), Web Audio API (AudioWorklet), Render static hosting. Tests run on the repo's own harness (`@fathom/game/testing/harness.ts`: `test`, `assert`, `equal`).

**Spec:** `docs/superpowers/specs/2026-10-26-fathom-web-demo-design.md`

## Global Constraints

- Branch `web-demo` (already cut from `ios-foundation`). No pushing or merging to `main` without the user.
- No commit trailers (`Co-Authored-By` etc.). Commit messages describe the code change, plain and specific.
- The iPhone build ships from the same files: the native look, layout, strings and policy must not change. Every web-only rule is gated on not-native, or behind the desktop media query.
- The app is the spec. No new screens or copy beyond the device-wording variants. Keep the variants as close to the app's text as possible, in EN and FR.
- Claims rules from `DEVELOPMENT.md` apply: never "treats/cures/reduces anxiety". The inhale is rhythm-prompted, not sensed. The crisis line stays on results.
- Nothing collects data: no analytics, no network calls, nothing stored server-side.
- Speaker safety: on the web `headphones` is always `false`, so `mixFor` sets `highCut` during microphone dives. The web synth must honour `highCut` exactly as `Soundscape.swift` does (the steep 500 Hz low-pass on the whole output).
- Desktop media query, used everywhere a desktop rule is needed: `@media (min-width: 900px) and (hover: hover) and (pointer: fine)`.
- Test commands: `npm test -w mobile` (app suite) and `node --import ./src/game/testing/resolve.mjs src/game/testing/run.ts` (shared suite), plus `npx tsc -p mobile/tsconfig.json`.

## Review Focus

1. **Audio before a gesture.** A returning player lands on the title screen with no click yet. The browser keeps the AudioContext suspended. Nothing may throw or block, and sound starts on the first pointerdown or keydown anywhere. (Task 3 test: `webSound` calls before `unlock()` resolve without error.)
2. **Laptop speakers on a mic dive.** The web route reports `headphones: false` always, so `highCut` engages in the scoring window. (Task 3 test: `webSound.getRoute()` resolves `{ headphones: false }`. Task 2 test: the speaker-window scenario leaves under 10% of RMS above 1 kHz.)
3. **Tab hidden mid-dive.** Sound stops when the tab is hidden and resumes when it's shown, like the native app going to the background. (Already in `useSoundscape`'s visibility handler; Task 3 keeps it routed to the web driver.)
4. **Short desktop windows (1280×720, 1024×640).** Overlays must not clip. Sheets taller than the window scroll inside themselves, and the page never scrolls. (Task 4 screenshots at 1280×720.)
5. **Touch-screen laptops and iPads.** Wording follows the primary pointer. A coarse pointer keeps "Touch and hold" and the phone layout. (Task 1 test: `deviceKind` for each `(native, finePointer)` pair.)

---

## File map

| File | Responsibility |
|---|---|
| `mobile/src/app/platform.ts` (new) | `IS_NATIVE`, `deviceKind()`: the one place web or native and pointer are decided |
| `mobile/src/strings.ts` | add `desktop` and `touchWeb` overrides, EN+FR; `useAppStrings` merges by `deviceKind()` |
| `mobile/src/privacy/policy.ts` | add `WEB_POLICY` (EN+FR) and `policyFor(native)` |
| `mobile/src/privacy/policy.test.ts` | iOS checks unchanged; web policy checks |
| `mobile/src/screens/PrivacySheet.tsx`, `SettingsSheet.tsx` | use `policyFor`; hide haptics on web |
| `mobile/src/sound/web/svf.ts`, `soundscape.ts`, `ambientMusic.ts` (new) | pure TS port of the Swift synth |
| `mobile/src/sound/web/soundscape.test.ts` (new) | the `check.mjs` scenarios, against the TS port |
| `mobile/src/sound/web/soundscape.worklet.ts` (new) | AudioWorkletProcessor wrapping `Soundscape` |
| `mobile/src/sound/web/webSound.ts` (new) | `FathomSoundPlugin`-shaped driver over the worklet, with gesture unlock |
| `mobile/src/sound/useSoundscape.ts` | pick native plugin or `webSound` |
| `mobile/src/styles/desktop.css` (new) | every desktop layout rule, one media query |
| `mobile/index.html`, `public/favicon.svg` (the app's public dir is the shared root `public/`) | title, favicon, description, theme colour |
| root `package.json`, `render.yaml`, `README.md` | root scripts and deploy build the app |
| deleted | old site entry and its pages (Task 5 list) |

---

### Task 1: Web wording, web privacy policy, web-only settings

**Files:**
- Create: `mobile/src/app/platform.ts`, `mobile/src/app/platform.test.ts`
- Modify: `mobile/src/strings.ts`, `mobile/src/privacy/policy.ts`, `mobile/src/privacy/policy.test.ts`, `mobile/src/screens/PrivacySheet.tsx`, `mobile/src/screens/SettingsSheet.tsx`, `mobile/src/testing/run.ts`

**Interfaces:**
- Produces: `export type DeviceKind = 'native' | 'desktop' | 'touch-web'`; `export function deviceKind(native: boolean, finePointer: boolean): DeviceKind`; `export const IS_NATIVE: boolean` (`Capacitor.isNativePlatform()`); `export const DEVICE: DeviceKind`, computed once from `IS_NATIVE` and `matchMedia('(hover: hover) and (pointer: fine)').matches` (false when `matchMedia` is missing, as in node tests).
- Produces: `stringsFor(language: 'en' | 'fr', device: DeviceKind): AppStrings` (the pure core of `useAppStrings`, so it's testable); `policyFor(native: boolean): Record<'en' | 'fr', Policy>`; `WEB_POLICY: Record<'en' | 'fr', Policy>`.

- [ ] **Step 1: Write failing tests** in `platform.test.ts` (register it in `mobile/src/testing/run.ts`):
  - `deviceKind(true, true) === 'native'`, `deviceKind(true, false) === 'native'`, `deviceKind(false, true) === 'desktop'`, `deviceKind(false, false) === 'touch-web'`.
  - `stringsFor('en', 'native')` deep-equals the current `en` object (the iPhone text is untouched). Same for `'fr'`.
  - For `'desktop'`, in both languages: none of `useTouch`, `useTouchHint`, `holdHint`, `micFellBack`, `lostFixMic`, `lostFixTouch`, `micDeclined`, `micUnheard` matches `/finger|touch|phone|doigt|écran|téléphone|appui/i`. `useTouchHint` mentions Space (`/space|espace/i`).
  - For `'touch-web'`: `micUnheard` doesn't match `/phone|téléphone/i`. Touch wording is kept.
- [ ] **Step 2: Add web policy tests** in `policy.test.ts`. Keep the three existing tests on `POLICY` as they are. Add:
  - `WEB_POLICY.en` and `.fr` contain none of `/iPhone|Apple Health|Apple Santé|iOS|Deleting the app|Supprimer l’app/`.
  - `WEB_POLICY.en` mentions the microphone, "browser", and that clearing the site's data deletes what's saved (`/clear/i`).
  - `WEB_POLICY.fr.sections.length === WEB_POLICY.en.sections.length`.
  - `policyFor(true) === POLICY` and `policyFor(false) === WEB_POLICY`.
- [ ] **Step 3: Run `npm test -w mobile`.** Expect FAIL: `platform.ts`, `stringsFor`, `WEB_POLICY` and `policyFor` don't exist yet.
- [ ] **Step 4: Implement.**
  - `strings.ts`: keep `en`/`fr`. Add `Partial<AppStrings>` override objects `desktopEn`, `desktopFr`, `touchWebEn`, `touchWebFr`. Desktop wording: hold Space or hold the mouse button (e.g. `useTouch: 'Hold to breathe out'`, `useTouchHint: 'Hold Space, or hold the mouse button, for as long as you breathe out.'`, `holdHint: 'Hold Space or the mouse button while you breathe out'`). `micUnheard` becomes "…Move a little closer to the microphone…" for both web kinds. `stringsFor` merges the base with the overrides. `useAppStrings` becomes `stringsFor(language === 'fr' ? 'fr' : 'en', DEVICE)`.
  - `policy.ts`: `WEB_POLICY` mirrors `POLICY`'s sections, minus Apple Health. "Stays on your iPhone" becomes "stays in this browser on this device". The microphone section's numbers-not-recordings sentence keeps its substance; the settings path uses the web label. "What is saved" names browser storage, and clearing the site's data in the browser deletes it. Sharing: the dive log downloads as a file. Same `updated` date and contact. Then `policyFor`.
  - `PrivacySheet.tsx`: `policyFor(IS_NATIVE)`. `SettingsSheet.tsx`: render the haptics row only when `IS_NATIVE`.
- [ ] **Step 5: Run `npm test -w mobile` and `npx tsc -p mobile/tsconfig.json`.** Expect all PASS, no type errors.
- [ ] **Step 6: Sweep.** Run `grep -niE "iphone|phone|finger|touch|tap|screen|écran|téléphone|doigt" mobile/src/strings.ts mobile/src/journal/creatureStrings.ts`, and the `t.safety` and `t.setup` strings the app shows (`src/shell/strings/safety.ts`, `setup.ts`). For each hit the web would show that's false on the web, add an override, or note in the commit why it's fine. `t.safety` already says "spacebar". It's shown in the app's onboarding, so check it reads true on both: on iPhone it's the existing text, so leave it unless it's false on desktop.
- [ ] **Step 7: Commit.** `git commit -m "Say what is true in a browser: web wording, a web privacy policy, no haptics row"`

### Task 2: Port the native synth to TypeScript

**Files:**
- Create: `mobile/src/sound/web/svf.ts`, `mobile/src/sound/web/ambientMusic.ts`, `mobile/src/sound/web/soundscape.ts`, `mobile/src/sound/web/soundscape.test.ts`
- Modify: `mobile/src/testing/run.ts`
- Read (source of truth): `mobile/ios/App/App/Soundscape.swift`, `AmbientMusic.swift`, `mobile/scripts/sound-check/main.swift`, `check.mjs`

**Interfaces:**
- Consumes: `SoundMix` from `mobile/src/sound/soundDirector.ts` (fields map 1:1 to Swift `SoundMixParams`; `beds` is a tuple).
- Produces: `export class Soundscape { constructor(sampleRate: number, seed?: number); setMix(mix: SoundMix): void; ping(): void; splash(): void; inhale(): void; render(out: Float32Array): void }`. `render` fills the whole array, mono, and allocates nothing.

- [ ] **Step 1: Write `soundscape.test.ts`.** It's a TS port of `main.swift` + `check.mjs`: same 11 scenarios with the same `SoundMix` values, a 48 kHz sample rate, seed 7, 512-sample blocks, 4 s settle, then `ping()`/`splash()` for those scenarios, then 4 s measured. Measure RMS, peak, and RMS after two cascaded 1 kHz TPT high-passes (port `HighPass` from `main.swift`). One `test(...)` per check, with the same names and thresholds as `check.mjs`: silent peak `=== 0`; every other scenario `rms > 0.005` and `peak <= 1`; `deep.high < shallow.high * 0.35`; `swell.rms` within `(shallow.rms*1.2, shallow.rms*2)`; `musicAbyss.high < music.high`; `speakerWindow.high < speakerWindow.rms * 0.1`. Also: two `Soundscape(48000, 7)` instances rendering the same mix give identical buffers (determinism). Register in `run.ts`.
- [ ] **Step 2: Run `npm test -w mobile`.** Expect FAIL (module missing).
- [ ] **Step 3: Implement the port.** Line for line from the Swift. Keep constants, names and comments (`OCEAN_LEVEL`, `DEEP_BED_LEVEL`, `SWELL_LIFT`, the SVF, `Smooth`, bubbles, bells, the PRNG and its seeds `0x0fa7_1234` / `0x5eed_c40d`). Do the arithmetic in doubles (JS numbers) and write `Float32` only at output. Use unsigned 32-bit ops (`>>> 0`, `Math.imul`) wherever the Swift PRNG relies on `UInt32` wrap. Preallocate everything in the constructor.
- [ ] **Step 4: Run `npm test -w mobile`.** Expect PASS. If a threshold fails, the port differs from the Swift. Fix the port, never the threshold.
- [ ] **Step 5: Commit.** `git commit -m "Port the soundscape synth to TypeScript, checked against the native sound checks"`

### Task 3: Play the soundscape in the browser

**Files:**
- Create: `mobile/src/sound/web/soundscape.worklet.ts`, `mobile/src/sound/web/webSound.ts`, `mobile/src/sound/web/webSound.test.ts`
- Modify: `mobile/vite.config.ts`, `mobile/src/sound/useSoundscape.ts`, `mobile/src/screens/PreDive.tsx` (only if it calls `FathomSound` directly on web; it currently returns early when not native, so leave it), `mobile/src/testing/run.ts`

**Interfaces:**
- Consumes: `Soundscape` (Task 2); `FathomSoundPlugin` from `mobile/src/native/fathomSound.ts`.
- Produces: `export const webSound: Pick<FathomSoundPlugin, 'start' | 'stop' | 'setMix' | 'inhale' | 'ping' | 'splash' | 'getRoute'>` and `export function soundDriver(native: boolean)`, which returns `FathomSound` or `webSound`.

- [ ] **Step 1: Write `webSound.test.ts`** (node has no `AudioContext`, and that's the point): every method of `webSound` resolves and doesn't throw when `AudioContext` is undefined. `await webSound.getRoute()` deep-equals `{ headphones: false }`. Register in `run.ts`.
- [ ] **Step 2: Run `npm test -w mobile`.** Expect FAIL.
- [ ] **Step 3: Implement.**
  - Worklet: `registerProcessor('fathom-soundscape', …)`. Construct `Soundscape(sampleRate)`. `port.onmessage` takes `{ type: 'mix', mix } | { type: 'ping' | 'splash' | 'inhale' }`. `process()` renders into `outputs[0][0]` and copies to any second channel. Declare the worklet globals locally (`AudioWorkletProcessor`, `registerProcessor`, `sampleRate`); don't add a lib to the tsconfig.
  - `mobile/vite.config.ts`: add `worker: { format: 'es' }` to `config`, so the worklet bundles as an ES module.
  - `webSound.ts`: load the worklet with `import workletUrl from './soundscape.worklet.ts?worker&url'`. Create the `AudioContext` lazily on `start()`, then `audioWorklet.addModule(workletUrl)` and an `AudioWorkletNode` (`outputChannelCount: [2]`) to the destination. On the first `pointerdown` or `keydown` on `window` (listener added at module load, `{ once: true, capture: true }`), call `resume()`. `stop()` suspends. `setMix` before the node exists stores the latest mix and sends it when the node is ready. Every method swallows errors.
  - `useSoundscape.ts`: replace the native-only early return and `FathomSound.*` calls with `const sound = soundDriver(native)`. The effect runs on both platforms, and `playPing/playSplash/playInhale` use the driver.
- [ ] **Step 4: Run `npm test -w mobile` and `npx tsc -p mobile/tsconfig.json`.** Expect PASS.
- [ ] **Step 5: Verify in the browser.** Run `npm run dev -w mobile`, open `http://localhost:5173/?scripted`, click Dive, then Begin. In devtools, check that `AudioContext.state === 'running'`, and that the music changes zone to zone and fades as depth grows. Then reload, change nothing, and confirm the console shows no errors before the first click.
- [ ] **Step 6: Commit.** `git commit -m "Play the soundscape in a browser through an AudioWorklet"`

### Task 4: Desktop layout

**Files:**
- Create: `mobile/src/styles/desktop.css`
- Modify: `mobile/src/main.tsx` (import `desktop.css` last), `mobile/index.html`

**Interfaces:** none (CSS only). Every rule sits inside `@media (min-width: 900px) and (hover: hover) and (pointer: fine)`.

- [ ] **Step 1: Take baseline screenshots** at 430×932 with Playwright (title, onboarding card 1, pre-dive, a dive mid-zone via `?scripted`, results, journal). Save them under `.playwright-mcp/baseline-phone/` (untracked) for the unchanged check in Task 6.
- [ ] **Step 2: Write `desktop.css`.**
  - Define `--ui-scale: clamp(1, calc(100vh / 760px), 1.5)` on `:root`.
  - **Column:** the text overlays sit in a centered column, `max-width: 560px`, `margin-inline: auto`, keeping their vertical placement: `.title__actions`, `.title__scope`, `.onboard__card`/`.onboard__body` and the onboarding actions, `.sheet` (settings, privacy, pre-dive), `.stats` (results), `.journal`. The ocean canvas stays full-bleed.
  - **HUD:** apply `zoom: var(--ui-scale)` to `.hud__leave`, `.hud__settings`, `.hud__depth`, `.hud__ring`, `.hud__hint`, `.zone-card`, `.title__settings`, and the found toast. Widen `.hud__gauge` right offset to match. Use `zoom` (proportions stay exactly the app's), not per-property overrides.
  - Sheets that overflow scroll inside (`overflow-y: auto; max-height: 100%`). The page never scrolls.
- [ ] **Step 3: `mobile/index.html`.** Set `<title>Fathom</title>` (keep). Add `<meta name="description" content="A dive you take with your breath. A five-minute breathing game, measured live on your device.">`, `<meta name="theme-color" content="#030811">`, and a favicon from `docs/app-store/icon.svg` (copy it to the shared `public/favicon.svg`, replacing the old one). Keep the viewport meta as it is: the native build needs `user-scalable=no`, and desktop browsers ignore it.
- [ ] **Step 4: Verify by screenshot** with Playwright at 1440×900, 1920×1080 and 1280×720: title, each onboarding card, settings, privacy, pre-dive, dive (`?scripted`), results, journal (both tabs). Check: no text line wider than the column, the primary buttons column-width, the HUD readable and in proportion, nothing clipped at 1280×720.
- [ ] **Step 5: Verify the phone is unchanged.** Re-shoot the Step 1 set at 430×932 and compare them visually with the baselines. Identical layout is required.
- [ ] **Step 6: Commit.** `git commit -m "Lay the app out for a desktop screen: a centered column and a scaled HUD"`

### Task 5: The app is the website

**Files:**
- Modify: root `package.json` (scripts), `render.yaml`, `README.md`, `src/shell/strings/index.ts` (drop modules only the deleted pages used)
- Delete: `index.html` (root), `src/main.tsx`, `src/App.tsx`, `src/App.css`, `src/shell/HowItWorks.{tsx,css}`, `src/shell/Research.{tsx,css}`, `src/shell/SafetyScreen.{tsx,css}`, `src/shell/LanguageToggle.{tsx,css}`, `src/shell/router.ts`, `src/shell/studies.ts`, `src/game/scene/DiveView.{tsx,css}`, `src/game/surface/SurfaceScreen.{tsx,css}`, `src/game/input/dev/ScriptedEnginePanel.{tsx,css}`, `qa-gate-1280.png`
- Keep: `debug.html`, `src/breath/debug/`, `src/breath/recording.ts` (the signal engine's dev page); `src/index.css`, `src/shell/ui/` and `src/shell/CrisisRail.*` (the app imports them); every `*.test.ts` under `src/`; `public/privacy.html`, `public/support.html`, `public/legal.css`.

- [ ] **Step 1: Delete the files listed.** Remove the `strings/index.ts` entries (and their files) for `research`, `how` and `nav` only if `grep -rn "t\.\(research\|how\|nav\)" mobile/src src` finds nothing after the deletions.
- [ ] **Step 2: Root scripts.** `"dev": "npm run dev -w mobile"`, `"build": "npm run build -w mobile"`, `"preview": "npm run preview -w mobile"` (add `"preview": "vite preview"` to `mobile/package.json`), `"test": "node --import ./src/game/testing/resolve.mjs src/game/testing/run.ts && npm test -w mobile"`, `"debug": "vite --open /debug.html"`. Root `tsconfig.app.json`: if it `include`s `src` and now fails for want of an entry, narrow nothing. Just confirm `npx tsc -b` still passes, or drop the root `tsc -b` from scripts since the build now runs the mobile typecheck.
- [ ] **Step 3: `render.yaml`.** `buildCommand: npm ci && npm run build`, `staticPublishPath: ./mobile/dist`. Keep all three headers as they are. Update the top comment to say the site is the app's web build.
- [ ] **Step 4: Verify.** `npm run build` succeeds and `mobile/dist/` contains `index.html`, `breath-processor.js`, `privacy.html`, `support.html`, `legal.css`, the fonts, and a soundscape worklet chunk. Run `npm test`: both suites PASS. Run `npm run preview`, open it, and play the first onboarding card. The breath worklet must load: the network tab shows no 404s.
- [ ] **Step 5: README.** Update the run/build/deploy sections and links: the site is the app in a browser, `npm run dev` runs it, and the old Research and How It Works pages are gone. Keep the README's citations and claims language intact.
- [ ] **Step 6: Commit.** `git commit -m "Serve the app as the website and remove the old site's pages"`

### Task 6: End-to-end check

- [ ] **Step 1:** Clear localStorage and run through, at 1440×900 in Chromium (Playwright): first-run onboarding (all three cards) → title → Dive with `?scripted` (dev) to results → journal → settings (volume, language FR then back, privacy sheet) → Quick dive to results. Screenshot each. No console errors.
- [ ] **Step 2:** Repeat the title, dive and results screenshots at 1920×1080 and 1280×720.
- [ ] **Step 3:** Phone check at 430×932 against the Task 4 baselines.
- [ ] **Step 4:** `npm run build`, `npm test`, `npx tsc -p mobile/tsconfig.json`. All pass.
- [ ] **Step 5:** Report to the user with the screenshots. Hand them the two user tests the spec reserves: a real microphone dive in their own browser, and a mic dive on laptop speakers (the game mustn't move the diver on its own).
