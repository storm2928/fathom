# Fathom as iOS and Android apps — design

Date: 2026-10-05 · Branch: `app` (worktree at `~/Desktop/fathom-app`)

## Intent

What the owner asked for:

- Publish Fathom on the Apple App Store and Google Play.
- Phones are the main priority, but keep one integrated codebase so features
  ship to the website and the apps together. If that proves unsustainable,
  phones win.
- Work happens in a separate Desktop folder.
- Use Capacitor, because it is the easiest to maintain alongside the existing
  codebase.

Decisions made during brainstorming:

| Question | Decision |
|---|---|
| Folder | Git worktree of this repo on an `app` branch, merged to `main` when ready |
| Phone features in v1 | Touch-and-hold fallback, keep screen awake, haptics |
| Dive log export | Hidden in the apps; the website keeps it |
| App ID | Placeholder `dev.fathom.placeholder` until store submission |
| Orientation | Portrait only |
| Store accounts | None yet — build and test on simulators and a real phone first |

Success for this phase: the game installs on a real iPhone and a real Android
phone, the microphone drives a full dive on both, the touch fallback works
when the microphone is refused, and `npm run build` still produces the
unchanged website.

Out of scope for this phase: developer accounts, final app ID, store icons and
screenshots, privacy labels, submission. These get their own checklist later.

## Approach

Capacitor wraps the existing Vite build in native iOS and Android projects.
The built files ship inside the app, so it runs offline and loads nothing
from a server. Pixi.js, the AudioWorklet, i18n and the session logic run
unchanged in the platform WebView (WKWebView on iOS 14.5+, Chromium WebView
on Android).

Rejected: a React Native / Expo rewrite (splits the codebase, rewrites the
renderer and audio capture) and a PWA / Trusted Web Activity wrapper (Apple
does not accept it).

Main risk: getUserMedia plus AudioWorklet inside WKWebView. This is proven on a
real iPhone as the first implementation milestone, before any other work.

Store risk: Apple guideline 4.2 (minimum functionality) rejects thin website
wrappers. Bundled offline assets, native haptics, keep-awake and the touch
input are the mitigations.

## Structure

```
fathom-app/
  capacitor.config.ts     appId, appName, webDir: 'dist'
  ios/                    generated Xcode project (committed)
  android/                generated Android Studio project (committed)
  src/platform/           the only code that knows which platform it is on
  src/...                 everything else unchanged in shape
```

- New script `npm run build:app`: `npm run build && npx cap sync`.
- `npm run build`, `render.yaml` and the website deploy do not change.
- Capacitor plugins: `@capacitor/core`, `@capacitor/ios`, `@capacitor/android`,
  `@capacitor/haptics`, `@capacitor-community/keep-awake`.

### `src/platform/`

One small module with a stable interface; game code calls it and never checks
the platform itself.

- `isNativeApp(): boolean` — wraps `Capacitor.isNativePlatform()`.
- `keepAwake(on: boolean): Promise<void>` — app: keep-awake plugin; website:
  Screen Wake Lock API where available, otherwise a no-op. Never throws.
- `haptic(kind: 'prompt' | 'surface'): void` — app: light impact for prompts,
  medium for surfacing; website: no-op. Never throws.

Failures in these wrappers are swallowed: none of them is allowed to stop a
dive.

## Phone features

All of these live in shared code, so the website gets them too unless noted.

### Touch-and-hold input

- `src/game/input/touchHoldEngine.ts`, modelled on `spacebarEngine.ts`:
  pointer down on the dive surface = exhale starts, pointer up/cancel = exhale
  ends. Same `BreathEngine` contract, same calibration options.
- New `InputCode` value `'touch'` so the dive log records it honestly.
- `startInput` currently hard-codes the fallback code as `'keyboard'`.
  `InputPlan` gains a `fallbackCode: InputCode` field and the result reports
  it, keeping the "named, not derived" rule from #32.
- Selection: on devices without a fine pointer/keyboard
  (`matchMedia('(pointer: coarse)')`), the touch engine replaces the spacebar
  as both the explicit choice and the microphone's fallback. Desktop keeps the
  spacebar.
- Prompts and setup text get touch wording in English and French.

### Keep awake

`keepAwake(true)` when a dive starts, `keepAwake(false)` when it surfaces or
the view unmounts.

### Haptics

App only. `haptic('prompt')` on inhale, top-up and exhale prompts from the
conductor; `haptic('surface')` on surfacing.

### Dive log

The save button on the surface screen is not rendered when `isNativeApp()`.

### Portrait and safe areas

- Portrait locked in `Info.plist` (`UISupportedInterfaceOrientations`) and the
  Android manifest (`android:screenOrientation="portrait"`).
- `index.html` already sets `viewport-fit=cover`; screens use
  `env(safe-area-inset-*)` padding so nothing sits under the notch or home
  indicator.
- Each screen (safety, how it works, research, dive, surface) is checked and
  tuned at phone portrait sizes.

## Microphone

- iOS: `NSMicrophoneUsageDescription` stating that breath is analysed on the
  device and nothing is recorded or sent. WKWebView manages the audio session
  itself; the device check confirms capture works and that other apps' audio
  resumes after a dive. Native audio-session code is added only if that
  check fails.
- Android: `RECORD_AUDIO` and `MODIFY_AUDIO_SETTINGS` in the manifest;
  Capacitor's WebView grants the page's request after the runtime prompt.
- `public/breath-processor.js` loads from the bundled files, so the worklet
  works offline.
- Refused or broken microphone → the existing fallback path, now landing on
  the touch engine on phones, with the existing explanatory message.

## Testing

- Existing tests keep passing:
  `node --import ./src/game/testing/resolve.mjs src/game/testing/run.ts`.
- New unit tests: `touchHoldEngine` (press/release → exhale events,
  calibration), `startInput` reporting `fallbackCode`, `src/platform`
  wrappers falling back and never throwing.
- `npm run build` and `npm run lint` pass; website behaviour unchanged on
  desktop.
- Manual device checks, in order:
  1. Microphone-driven dive on a real iPhone (risk milestone).
  2. Same on a real Android phone.
  3. Refused microphone → touch fallback on both.
  4. Screen stays on through a full dive; haptics fire; no dive-log button.
  5. Portrait layout and safe areas on a notched iPhone and an Android phone.

## Setup the owner must do

- Install Xcode (Mac App Store) and Android Studio. Claude will guide setup.
- A real iPhone and Android phone for the device checks. Running on your own
  iPhone works with a free Apple ID; no paid account needed yet.
