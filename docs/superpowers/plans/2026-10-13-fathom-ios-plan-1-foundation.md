# Fathom iOS — Plan 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A native iOS app in `mobile/` that launches full screen into an always-on ocean, gates on the safety scope, and plays a complete breath-driven dive (microphone or touch-and-hold) through to a results card — runnable in the iOS Simulator.

**Architecture:** Capacitor 8 wraps a Vite + React app in `mobile/`. The app imports the existing breath engine, conductor, session machine, descent scoring and Pixi art from `fathom/src` through a `@fathom/*` alias (npm workspace, one `node_modules`). One `DiveScene` and one Pixi renderer live for the whole app lifetime on a single full-screen canvas; screens are overlays driven by a pure screen-flow state machine, and a framework-free `DiveController` owns each dive's engine/conductor/session wiring.

**Tech Stack:** Node 24 LTS, TypeScript ~6.0 (erasable syntax only), React 19, Pixi.js 8, Vite 8, Capacitor 8 (Swift Package Manager), Xcode 27, iOS Simulator (iPhone 18 Pro, id `B18E46D7-6BC1-40C9-8CB1-6C9336B91DB0`).

**Spec:** `docs/superpowers/specs/2026-10-13-fathom-ios-game-design.md`

## Roadmap (this plan is 1 of 6)

The spec covers several independent subsystems, so it ships as a series. Each later plan is written after the previous one lands, against the code as it then exists.

1. **Foundation (this plan)** — toolchain, `mobile/` + Capacitor iOS, touch input, screen flow, always-on ocean with surface light and depth pressure, dive wiring, HUD, minimal title / safety / pre-dive / results.
2. **Sound** — `FathomAudioSession` Swift plugin (play+record, voice processing off, route events), soundscape (surface, zone beds, low-pass with depth, breath bubbles, discovery ping), speaker-route ducking during the exhale window.
3. **Haptics** — `FathomHaptics` Swift plugin (Core Haptics continuous exhale rumble with live intensity), in-in taps, zone thud, discovery tick, settings toggle.
4. **Journal** — creature catalogue (18), seeded encounters, discovery rules, creature art, persistence via `@capacitor/preferences` (also migrates Plan 1's localStorage keys), journal + logbook screens.
5. **Screens & polish** — three-card onboarding, settings, title-screen art, surfacing camera, results with discoveries + share sheet export, edge distortion, motion polish (frontend-design pass).
6. **App Store** — icon, launch screen, splash fade, `PrivacyInfo.xcprivacy`, signing, store copy, screenshots, TestFlight.

## Global Constraints

- Node `>=22.12` required by Vite 8 and Capacitor 8 (`@capacitor/cli` engines `>=22.0.0`); this plan installs Node 24 LTS.
- Capacitor packages `^8.5.3` (`@capacitor/core`, `@capacitor/ios`, `@capacitor/cli`), `@capacitor/status-bar` `^8.0.4`.
- Shared versions stay as in the root `package.json`: `react ^19.2.8`, `pixi.js ^8.19.0`, `vite ^8.2.0`, `typescript ~6.0.2`, `@vitejs/plugin-react ^6.0.4`.
- TypeScript must stay `erasableSyntaxOnly` (no enums, no parameter properties, no namespaces) — tests run on the `.ts` sources with Node's type stripping.
- Tests use the in-repo harness (`src/game/testing/harness.ts`: `test`, `assert`, `equal`). No test framework dependency. Test files are `.ts`, never `.tsx`.
- Bundle ID `com.colejasink.fathom`, app name `Fathom` (owner may change the ID before Plan 6; nothing else depends on it).
- Portrait only, iPhone only.
- Microphone usage string, verbatim: `Fathom listens to the sound of your breath out to guide the dive. Audio is processed on your iPhone and never recorded or sent anywhere.`
- Claims language: "trains arousal regulation, measured live" — never treats / reduces / cures. Reuse existing `surface` and `safety` strings for every claim; do not write new claim sentences.
- Crisis lines (988 US · 9-8-8 Canada · findahelpline.com) appear on the safety gate and the results screen, via the existing `CrisisRail`.
- Depth comes only from `src/game/scene/descent.ts`; do not change its numbers. Difficulty only slows.
- No network calls. No analytics. Nothing leaves the device.
- Results exit only to the title. No "dive again" control anywhere.
- No website patterns in `mobile/`: no scrolling pages, no links styled as links, no hover styles, no top nav or tab bar.
- Commits: plain specific messages, no `Co-Authored-By` trailer (DEVELOPMENT.md rule 8).

## Review Focus

- **Microphone refused or unavailable in the iOS web view** → the dive must still start on touch-and-hold, and the results must say touch, not microphone. (Task 4 test: `startInput` with `fallbackCode: 'touch'`.)
- **Leaving mid-dive** → the session ends with `stopped`, the microphone is released, and the results card says "Left early". (Task 7 test: `stop()` releases the engine and reports `stopped`.)
- **Second dive after the first** → depth, light and zone start from the surface, not where the last dive ended, without recreating the WebGL context. (Task 5 test: `reset()` zeroes depth/light/zone and bumps `epoch`.)
- **Storage unavailable** (private mode / storage throwing) → the app still launches to the safety gate instead of a white screen. (Task 6 test: storage helpers swallow throws.)
- **Double-tap on Begin** → only one engine, conductor and session are built. (Task 7 test: a second `start()` while starting is ignored.)

---

## File Structure

**Shared code (`src/`) — modified:**
- `src/game/testing/resolve.mjs` — also resolve `@fathom/*` to `src/*` so mobile tests run.
- `src/game/input/spacebarEngine.ts` — public `beginHold()` / `endHold()` so touch can drive it.
- `src/game/input/spacebarEngine.test.ts` — new.
- `src/game/input/inputSource.ts` — `fallbackCode` on `InputPlan`.
- `src/game/input/inputSource.test.ts` — one new case.
- `src/game/surface/diveLog.ts` — `InputCode` gains `'touch'`.
- `src/shell/strings/setup.ts` — `inputTouch` label.
- `src/game/scene/DiveView.tsx` — add `touch` to its two `Record<InputCode, …>` tables.
- `src/game/scene/renderer.ts` — `SceneState.epoch`.
- `src/game/scene/diveScene.ts` — `reset()` and `epoch`.
- `src/game/scene/diveScene.test.ts` — new.
- `src/game/scene/art/depthLight.ts` — new: pure surface/ray/pressure maths.
- `src/game/scene/art/depthLight.test.ts` — new.
- `src/game/scene/art/surfaceLight.ts` — new: Pixi sky, surface line and god rays.
- `src/game/scene/pixiRenderer.ts` — epoch snap, surface light, pressure vignette.
- `src/game/scene/canvasRenderer.ts` — epoch snap.
- `src/game/surface/verdict.ts` — new: `MEANINGFUL_DELTA_RR` + `verdictFor()` shared by web and app.
- `src/game/surface/verdict.test.ts` — new.
- `src/game/surface/SurfaceScreen.tsx` — use `verdict.ts`.
- `src/game/testing/run.ts` — register the new suites.
- `package.json` (root) — `workspaces: ["mobile"]`.

**App (`mobile/`) — new:**
- `mobile/package.json`, `mobile/vite.config.ts`, `mobile/tsconfig.json`, `mobile/index.html`, `mobile/capacitor.config.ts`, `mobile/.gitignore`
- `mobile/ios/` — generated by Capacitor, then `Info.plist` and project edits.
- `mobile/src/main.tsx` — boot: status bar, React root.
- `mobile/src/App.tsx` — flow state → screens over the ocean.
- `mobile/src/styles/app.css` — full-screen, no scroll, safe areas, game UI primitives.
- `mobile/src/app/flow.ts` (+ `flow.test.ts`) — screen state machine.
- `mobile/src/app/storage.ts` (+ `storage.test.ts`) — acknowledgement + input choice, throw-safe.
- `mobile/src/world/OceanStage.tsx` — the one canvas, renderer and `DiveScene`; React context.
- `mobile/src/dive/diveController.ts` (+ `diveController.test.ts`) — per-dive wiring.
- `mobile/src/dive/inputs.ts` — production engine factories (mic, touch, scripted).
- `mobile/src/dive/DiveHud.tsx` — depth gauge, breath ring, zone card, leave, touch surface.
- `mobile/src/screens/SafetyGate.tsx`, `TitleScreen.tsx`, `PreDive.tsx`, `ResultsCard.tsx`
- `mobile/src/strings.ts` — EN/FR for app-only text.
- `mobile/src/testing/run.ts` — mobile test entry.

---

### Task 1: Toolchain on Node 24 and a green baseline

The existing test command fails on this Mac (`registerHooks` is missing from Node 20.13). Vite 8 and Capacitor 8 also need Node ≥ 22.

**Files:** none in the repo.

- [ ] **Step 1: Install Node 24 LTS**

Ask the user before running this (it changes their machine's Node). Preferred, no sudo:

```bash
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
nvm install 24 && nvm alias default 24
node -v
```

Expected: `v24.x.y`. In later shells, run `. "$HOME/.nvm/nvm.sh"` first if `node -v` still prints v20.

- [ ] **Step 2: Reinstall dependencies under Node 24**

```bash
cd /Users/fl/Desktop/fathom && npm install
```

Expected: completes without engine warnings for vite.

- [ ] **Step 3: Run the existing suite**

```bash
cd /Users/fl/Desktop/fathom && node --import ./src/game/testing/resolve.mjs src/game/testing/run.ts
```

Expected: last line `N/N passed`, exit 0. If any case fails, stop and report — the baseline must be green before changes.

- [ ] **Step 4: Typecheck and build the website**

```bash
cd /Users/fl/Desktop/fathom && npx tsc -b && npm run build
```

Expected: both succeed. No commit (nothing changed in the repo).

---

### Task 2: `mobile/` workspace that builds and shows the brand

**Files:**
- Modify: `package.json` (root)
- Modify: `src/game/testing/resolve.mjs`
- Create: `mobile/package.json`, `mobile/vite.config.ts`, `mobile/tsconfig.json`, `mobile/index.html`, `mobile/.gitignore`, `mobile/src/main.tsx`, `mobile/src/App.tsx`, `mobile/src/styles/app.css`, `mobile/src/testing/run.ts`, `mobile/src/testing/smoke.test.ts`

**Interfaces:**
- Produces: alias `@fathom/*` → `src/*` in Vite, TypeScript and the Node test resolver; `npm test -w mobile` runs `mobile/src/testing/run.ts`.

- [ ] **Step 1: Make the repo an npm workspace**

In root `package.json`, add after `"type": "module",`:

```json
  "workspaces": ["mobile"],
```

- [ ] **Step 2: Create `mobile/package.json`**

```json
{
  "name": "fathom-mobile",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -p tsconfig.json && vite build",
    "typecheck": "tsc -p tsconfig.json",
    "test": "node --import ../src/game/testing/resolve.mjs src/testing/run.ts",
    "sync": "npm run build && cap sync ios",
    "ios": "npm run sync && cap run ios --target B18E46D7-6BC1-40C9-8CB1-6C9336B91DB0"
  },
  "dependencies": {
    "@capacitor/core": "^8.5.3",
    "@capacitor/ios": "^8.5.3",
    "@capacitor/status-bar": "^8.0.4",
    "pixi.js": "^8.19.0",
    "react": "^19.2.8",
    "react-dom": "^19.2.8"
  },
  "devDependencies": {
    "@capacitor/cli": "^8.5.3",
    "@types/react": "^19.2.17",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.4",
    "typescript": "~6.0.2",
    "vite": "^8.2.0"
  }
}
```

- [ ] **Step 3: Create `mobile/vite.config.ts`**

```ts
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * The app shares the website's engine, scene and strings rather than copying
 * them: `@fathom/*` is `fathom/src/*`. The website's `public/` (the breath
 * worklet and the fonts) is served as this app's public dir too, because the
 * worklet is loaded by a relative URL at runtime and must sit at the web root.
 */
const shared = fileURLToPath(new URL('../src', import.meta.url));

export default defineConfig({
  plugins: [react()],
  base: './',
  publicDir: fileURLToPath(new URL('../public', import.meta.url)),
  resolve: {
    alias: { '@fathom': shared },
    // One React and one Pixi, whichever folder a module was imported from.
    dedupe: ['react', 'react-dom', 'pixi.js'],
  },
  server: { fs: { allow: ['..'] } },
  build: { outDir: 'dist', target: 'es2022' },
});
```

- [ ] **Step 4: Create `mobile/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "es2023",
    "lib": ["ES2023", "DOM"],
    "module": "esnext",
    "types": ["vite/client"],
    "allowArbitraryExtensions": true,
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true,
    "paths": { "@fathom/*": ["../src/*"] }
  },
  "include": ["src", "vite.config.ts", "capacitor.config.ts"]
}
```

- [ ] **Step 5: Create `mobile/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
    />
    <meta name="color-scheme" content="dark" />
    <title>Fathom</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create `mobile/.gitignore`**

```
node_modules
dist
ios/App/App/public
ios/App/App/capacitor.config.json
ios/App/App/config.xml
ios/App/build
ios/DerivedData
```

- [ ] **Step 7: Create `mobile/src/styles/app.css`**

```css
/*
 * The app is a game surface, not a page: nothing scrolls, nothing selects,
 * nothing hovers. Tokens and fonts come from the website's index.css.
 */
html,
body,
#root {
  position: fixed;
  inset: 0;
  margin: 0;
  overflow: hidden;
  overscroll-behavior: none;
  background: var(--scene-0);
  color: var(--hud-text);
  font-family: var(--font-sans);
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
  touch-action: none;
}

/* Every overlay respects the notch and the home indicator. */
.safe {
  position: absolute;
  inset: 0;
  padding: env(safe-area-inset-top) 20px env(safe-area-inset-bottom);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.wordmark {
  font-weight: 600;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  color: var(--hud-text);
}

/* Big, soft, game buttons. Pressed state replaces hover. */
.game-btn {
  appearance: none;
  border: 1px solid var(--hud-line);
  border-radius: 999px;
  background: rgba(4, 10, 18, 0.45);
  -webkit-backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
  color: var(--hud-text);
  font: 600 17px/1 var(--font-sans);
  letter-spacing: 0.04em;
  min-height: 56px;
  padding: 0 28px;
  width: 100%;
  transition: transform 120ms ease, background-color 120ms ease;
}
.game-btn:active {
  transform: scale(0.97);
  background: rgba(92, 227, 207, 0.16);
}
.game-btn--primary {
  background: var(--hud-accent);
  border-color: transparent;
  color: var(--on-accent);
}
.game-btn--primary:active {
  background: var(--accent-strong);
}
.game-btn--quiet {
  background: transparent;
  border-color: transparent;
  min-height: 44px;
  color: var(--hud-muted);
}

.fade-in {
  animation: fade-in 600ms ease both;
}
@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .fade-in {
    animation-duration: 1ms;
  }
}
```

- [ ] **Step 8: Create `mobile/src/App.tsx` (placeholder, replaced in Task 9)**

```tsx
export default function App() {
  return (
    <div className="safe" style={{ justifyContent: 'center', alignItems: 'center' }}>
      <span className="wordmark">Fathom</span>
    </div>
  );
}
```

- [ ] **Step 9: Create `mobile/src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fathom/index.css';
import './styles/app.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 10: Teach the test resolver the alias — write the failing smoke test first**

Create `mobile/src/testing/smoke.test.ts`:

```ts
import { test, equal } from '@fathom/game/testing/harness.ts';
import { metresForExhale } from '@fathom/game/scene/descent';

test('mobile tests can import shared code through @fathom', () => {
  equal(metresForExhale(0, 1), 0);
});
```

Create `mobile/src/testing/run.ts`:

```ts
/**
 * Mobile test entry. Same harness as the website's suite:
 *
 *     npm test -w mobile
 */
import './smoke.test.ts';
import { runAll } from '@fathom/game/testing/harness.ts';

await runAll();
```

- [ ] **Step 11: Install and run it to see it fail**

```bash
cd /Users/fl/Desktop/fathom && npm install && npm test -w mobile
```

Expected: FAIL — `Cannot find package '@fathom/game'` (or similar resolution error).

- [ ] **Step 12: Add `@fathom/*` to `src/game/testing/resolve.mjs`**

Replace the `registerHooks({...})` call with:

```js
/** `@fathom/x` is `src/x`, the alias the mobile app uses for shared code. */
const SRC = new URL('../../', import.meta.url);
const ALIAS = '@fathom/';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(ALIAS)) {
      const target = new URL(specifier.slice(ALIAS.length), SRC).href;
      return nextResolve(HAS_EXTENSION.test(target) ? target : `${target}.ts`, context);
    }
    if (specifier.startsWith('.') && !HAS_EXTENSION.test(specifier)) {
      try {
        return nextResolve(`${specifier}.ts`, context);
      } catch {
        // Fall through — let Node report the original failure rather than a
        // confusing one about a file nobody wrote.
      }
    }
    return nextResolve(specifier, context);
  },
});
```

Also update the file's header comment: it now serves the website suite and the mobile suite.

- [ ] **Step 13: Run tests, typecheck and build**

```bash
cd /Users/fl/Desktop/fathom && npm test -w mobile && node --import ./src/game/testing/resolve.mjs src/game/testing/run.ts && npm run build -w mobile
```

Expected: `1/1 passed`; website suite still all passed; `mobile/dist/index.html` exists and `ls mobile/dist` shows `breath-processor.js` and `fonts/`.

- [ ] **Step 14: Commit**

```bash
git add package.json package-lock.json src/game/testing/resolve.mjs mobile
git commit -m "Add the mobile workspace with shared-code alias and test entry"
```

---

### Task 3: Capacitor iOS project running in the Simulator

**Files:**
- Create: `mobile/capacitor.config.ts`, `mobile/ios/**` (generated)
- Modify: `mobile/ios/App/App/Info.plist`, `mobile/ios/App/App.xcodeproj/project.pbxproj`, `mobile/src/main.tsx`

**Interfaces:**
- Produces: `npm run ios -w mobile` builds, syncs and launches the app on the iPhone 18 Pro simulator.

- [ ] **Step 1: Create `mobile/capacitor.config.ts`**

```ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.colejasink.fathom',
  appName: 'Fathom',
  webDir: 'dist',
  backgroundColor: '#030811',
  ios: {
    // The page is a fixed game surface; the web view must not scroll or bounce.
    scrollEnabled: false,
    contentInset: 'never',
    backgroundColor: '#030811',
    preferredContentMode: 'mobile',
  },
};

export default config;
```

- [ ] **Step 2: Generate the iOS project**

```bash
cd /Users/fl/Desktop/fathom/mobile && npm run build && npx cap add ios
```

Expected: `mobile/ios/App/App.xcodeproj` exists; output mentions Swift Package Manager (no Podfile).

- [ ] **Step 3: Microphone string, portrait only, full screen, status bar hidden**

```bash
cd /Users/fl/Desktop/fathom/mobile/ios/App/App
PB=/usr/libexec/PlistBuddy
$PB -c "Add :NSMicrophoneUsageDescription string 'Fathom listens to the sound of your breath out to guide the dive. Audio is processed on your iPhone and never recorded or sent anywhere.'" Info.plist
$PB -c "Delete :UISupportedInterfaceOrientations" Info.plist
$PB -c "Add :UISupportedInterfaceOrientations array" Info.plist
$PB -c "Add :UISupportedInterfaceOrientations:0 string UIInterfaceOrientationPortrait" Info.plist
$PB -c "Delete :UISupportedInterfaceOrientations~ipad" Info.plist 2>/dev/null || true
$PB -c "Add :UIRequiresFullScreen bool true" Info.plist
$PB -c "Add :UIStatusBarHidden bool true" Info.plist
$PB -c "Print :NSMicrophoneUsageDescription" Info.plist
```

Expected: the last command prints the microphone sentence verbatim.

- [ ] **Step 4: iPhone only**

```bash
cd /Users/fl/Desktop/fathom/mobile/ios/App
sed -i '' 's/TARGETED_DEVICE_FAMILY = "1,2";/TARGETED_DEVICE_FAMILY = 1;/g' App.xcodeproj/project.pbxproj
grep -c 'TARGETED_DEVICE_FAMILY = 1;' App.xcodeproj/project.pbxproj
```

Expected: a count ≥ 2 (Debug and Release). If the generated project had no `TARGETED_DEVICE_FAMILY` line, add `TARGETED_DEVICE_FAMILY = 1;` to both `buildSettings` blocks of the App target instead.

- [ ] **Step 5: Hide the status bar at runtime too**

Replace `mobile/src/main.tsx` with:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { StatusBar } from '@capacitor/status-bar';
import '@fathom/index.css';
import './styles/app.css';
import App from './App';

// The ocean is the whole screen. On the web (vite dev) there is no status bar
// plugin, and that is fine.
if (Capacitor.isNativePlatform()) void StatusBar.hide().catch(() => {});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 6: Launch in the Simulator**

```bash
cd /Users/fl/Desktop/fathom && npm run ios -w mobile
```

Expected: build succeeds; the app opens on the iPhone 18 Pro simulator showing the FATHOM wordmark centred on near-black, no status bar, no Safari chrome.

- [ ] **Step 7: Screenshot and look at it**

```bash
xcrun simctl io B18E46D7-6BC1-40C9-8CB1-6C9336B91DB0 screenshot /tmp/fathom-task3.png
```

Open the PNG and confirm: wordmark visible, background `#030811`-dark, no white flash, no browser UI. A blank white frame is a failure — check `npx cap sync ios` copied `dist`.

- [ ] **Step 8: Commit**

```bash
git add mobile
git commit -m "Add the Capacitor iOS project: portrait, full screen, microphone string"
```

---

### Task 4: Touch-and-hold input, honestly labelled

**Files:**
- Modify: `src/game/input/spacebarEngine.ts`
- Create: `src/game/input/spacebarEngine.test.ts`
- Modify: `src/game/input/inputSource.ts`, `src/game/input/inputSource.test.ts`
- Modify: `src/game/surface/diveLog.ts:19`
- Modify: `src/shell/strings/setup.ts`
- Modify: `src/game/scene/DiveView.tsx:61-98`
- Modify: `src/game/testing/run.ts`

**Interfaces:**
- Produces: `SpacebarBreathEngine#beginHold(): void`, `SpacebarBreathEngine#endHold(): void`; `InputCode = 'microphone' | 'keyboard' | 'touch' | 'scripted'`; `InputPlan.fallbackCode?: InputCode` (default `'keyboard'`); `t.setup.inputTouch`.

- [ ] **Step 1: Write the failing engine tests**

Create `src/game/input/spacebarEngine.test.ts`:

```ts
import { test, assert, equal } from '../testing/harness.ts';
import { SpacebarBreathEngine } from './spacebarEngine.ts';
import type { BreathEventMap } from '../../breath/types.ts';

/**
 * The hold engine driven by something other than a key: a finger on a phone.
 * The rules must not change with the source — a tap is not a breath, a hold
 * is one, and nothing happens before start or after stop.
 *
 * Run: node --import ./src/game/testing/resolve.mjs src/game/testing/run.ts
 */

const quiet = { addEventListener() {}, removeEventListener() {} };
// start() listens for visibilitychange on document, which Node does not have.
const scope = globalThis as { document?: unknown };
scope.document ??= { ...quiet, visibilityState: 'visible' };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function record(engine: SpacebarBreathEngine) {
  const exhales: BreathEventMap['exhale-end'][] = [];
  const phases: string[] = [];
  engine.on('exhale-end', (e) => exhales.push(e));
  engine.on('phase-change', (e) => phases.push(e.phase));
  return { exhales, phases };
}

test('a held touch is one scored exhale', async () => {
  const engine = new SpacebarBreathEngine({ target: quiet, minHoldMs: 10, targetExhaleMs: 1_000 });
  const seen = record(engine);
  await engine.start();
  engine.beginHold();
  await sleep(40);
  engine.endHold();
  equal(seen.exhales.length, 1, 'the hold did not score');
  assert(seen.exhales[0].durationMs >= 30, `duration ${seen.exhales[0].durationMs}ms is too short`);
  equal(seen.phases.join(','), 'exhale,idle');
  engine.stop();
});

test('a tap is not a breath', async () => {
  const engine = new SpacebarBreathEngine({ target: quiet, minHoldMs: 400 });
  const seen = record(engine);
  await engine.start();
  engine.beginHold();
  engine.endHold();
  equal(seen.exhales.length, 0, 'a tap scored as an exhale');
  engine.stop();
});

test('holds before start are ignored', () => {
  const engine = new SpacebarBreathEngine({ target: quiet, minHoldMs: 0 });
  const seen = record(engine);
  engine.beginHold();
  engine.endHold();
  equal(seen.phases.length, 0, 'an engine that was never started emitted');
});

test('a second press while held does not restart the breath', async () => {
  const engine = new SpacebarBreathEngine({ target: quiet, minHoldMs: 10 });
  const seen = record(engine);
  await engine.start();
  engine.beginHold();
  await sleep(30);
  engine.beginHold();
  engine.endHold();
  equal(seen.exhales.length, 1);
  assert(seen.exhales[0].durationMs >= 25, 'the second press restarted the clock');
  engine.stop();
});
```

Add `import './../input/spacebarEngine.test.ts';` to `src/game/testing/run.ts` after the `inputSource` import.

- [ ] **Step 2: Run to see it fail**

```bash
cd /Users/fl/Desktop/fathom && node --import ./src/game/testing/resolve.mjs src/game/testing/run.ts
```

Expected: FAIL — `engine.beginHold is not a function`.

- [ ] **Step 3: Add `beginHold` / `endHold` and route the keys through them**

In `src/game/input/spacebarEngine.ts`, add these public methods after `get scoredExhales()`:

```ts
  /**
   * Start an exhale from any press: the spacebar, or a finger held on a phone
   * screen. Ignored before start, after stop, and while a hold is already open.
   */
  beginHold(): void {
    if (!this.running || this.holdStartedAt !== null) return;
    const at = this.elapsed();
    this.holdStartedAt = at;
    this.rate.mark(at);
    this.emitter.emit('phase-change', { phase: 'exhale', at });
  }

  /** End the hold `beginHold` opened, scoring it if it was long enough. */
  endHold(): void {
    if (!this.running) return;
    this.release();
  }
```

Replace the tail of `onKeyDown` (from `if (this.holdStartedAt !== null) return;` to the end of the handler body) with:

```ts
    if (this.holdStartedAt !== null) return;
    this.beginHold();
```

Update the class comment's first line to `Hold a key or a finger down for as long as you are exhaling.`

- [ ] **Step 4: Run to see it pass**

Same command as Step 2. Expected: all passed.

- [ ] **Step 5: Write the failing fallback-label test**

Append to `src/game/input/inputSource.test.ts`:

```ts
test('a refused microphone on a phone falls back to touch, and says so', async () => {
  const started = await startInput({
    primary: fakeEngine(new Error('Permission denied')),
    code: 'microphone',
    fallback: () => fakeEngine(),
    fallbackCode: 'touch',
  });
  equal(started.code, 'touch', 'a touch session was labelled as something else');
  equal(started.fellBack, true);
});
```

Run the suite. Expected: FAIL — a type error is not reported by Node, so the failure is `expected: touch / actual: keyboard`.

- [ ] **Step 6: Implement `fallbackCode` and the `touch` code**

In `src/game/surface/diveLog.ts` line 19:

```ts
export type InputCode = 'microphone' | 'keyboard' | 'touch' | 'scripted';
```

In `src/game/input/inputSource.ts`, add to `InputPlan` after `fallback?`:

```ts
  /**
   * What the fallback is, for the log and the results. The keyboard on the
   * website, a finger on the phone. Defaults to the keyboard.
   */
  fallbackCode?: InputCode;
```

and in `startInput`, replace `code: 'keyboard',` (and the two comment lines above it) with:

```ts
      // Named by the caller rather than derived, because an input that quietly
      // reports something else would put a wrong label in an exported log.
      code: plan.fallbackCode ?? 'keyboard',
```

Also replace the comment line `// The only fallback is the spacebar.` with `// The fallback is a hold input: the spacebar or a finger.`

In `src/shell/strings/setup.ts`, add `inputTouch: 'Touch and hold',` after `inputKeyboard` in `en`, and `inputTouch: 'Appui maintenu',` after `inputKeyboard` in `fr`.

In `src/game/scene/DiveView.tsx`, add `touch: (t) => t.setup.inputTouch,` to `CODE_LABEL` and `touch: null,` to `EXHALE_CAPTION`.

- [ ] **Step 7: Run tests and typecheck**

```bash
cd /Users/fl/Desktop/fathom && node --import ./src/game/testing/resolve.mjs src/game/testing/run.ts && npx tsc -b
```

Expected: all passed; no type errors.

- [ ] **Step 8: Commit**

```bash
git add src/game/input src/game/surface/diveLog.ts src/shell/strings/setup.ts src/game/scene/DiveView.tsx src/game/testing/run.ts
git commit -m "Let a finger drive the hold engine and label touch sessions as touch"
```

---

### Task 5: A scene that lives for the whole app — reset, surface light, depth pressure

**Files:**
- Modify: `src/game/scene/renderer.ts` (SceneState)
- Modify: `src/game/scene/diveScene.ts`
- Create: `src/game/scene/diveScene.test.ts`
- Create: `src/game/scene/art/depthLight.ts`, `src/game/scene/art/depthLight.test.ts`
- Create: `src/game/scene/art/surfaceLight.ts`
- Modify: `src/game/scene/pixiRenderer.ts`, `src/game/scene/canvasRenderer.ts`
- Modify: `src/game/testing/run.ts`

**Interfaces:**
- Produces: `SceneState.epoch: number`; `DiveScene#reset(): void`; `DiveScene#epoch: number` (getter); `surfaceY(depth: number, diverY: number): number`; `rayStrength(depth: number): number`; `pressure(depth: number): number`; constants `SURFACE_ABOVE_DIVER_PX = 70`, `RAYS_GONE_AT_METRES = 140`, `PRESSURE_VIGNETTE = 0.35`; class `SurfaceLight` with `container`, `layout(w, h)`, `update(f: Frame)`.

- [ ] **Step 1: Write the failing pure-maths tests**

Create `src/game/scene/art/depthLight.test.ts`:

```ts
import { test, assert, equal } from '../../testing/harness.ts';
import {
  PRESSURE_VIGNETTE,
  RAYS_GONE_AT_METRES,
  SURFACE_ABOVE_DIVER_PX,
  pressure,
  rayStrength,
  surfaceY,
} from './depthLight.ts';
import { PIXELS_PER_METRE } from '../renderer.ts';
import { DARKEST_AT_METRES } from '../descent.ts';

/**
 * The surface you leave behind, and the dark you sink into. Both are pure
 * functions of drawn depth so the camera can never disagree with the gauge.
 */

test('at the surface the waterline sits just above the diver', () => {
  equal(surfaceY(0, 400), 400 - SURFACE_ABOVE_DIVER_PX);
});

test('the waterline rises one base-layer metre per metre descended', () => {
  equal(surfaceY(10, 400) - surfaceY(11, 400), PIXELS_PER_METRE);
});

test('rays are full at the surface, fade monotonically, and are gone by the limit', () => {
  equal(rayStrength(0), 1);
  for (let d = 0; d < RAYS_GONE_AT_METRES; d += 5) {
    assert(rayStrength(d + 5) <= rayStrength(d), `rays brightened at ${d}m`);
  }
  equal(rayStrength(RAYS_GONE_AT_METRES), 0);
  equal(rayStrength(RAYS_GONE_AT_METRES * 3), 0);
});

test('pressure is 0 at the surface, 1 at the darkest depth, and never beyond', () => {
  equal(pressure(0), 0);
  equal(pressure(DARKEST_AT_METRES), 1);
  equal(pressure(DARKEST_AT_METRES * 2), 1);
  equal(pressure(-5), 0);
  assert(PRESSURE_VIGNETTE > 0 && PRESSURE_VIGNETTE < 1);
});
```

Add `import './../scene/art/depthLight.test.ts';` to `src/game/testing/run.ts` after the descent import. Run the suite. Expected: FAIL — module `./depthLight.ts` not found.

- [ ] **Step 2: Implement `src/game/scene/art/depthLight.ts`**

```ts
import { PIXELS_PER_METRE } from '../renderer';
import { DARKEST_AT_METRES } from '../descent';

/**
 * Where the surface is and how much daylight is left, as functions of drawn
 * depth. Lighting only: none of this feeds back into the descent or the score.
 */

/** At depth 0 the waterline sits this far above the diver's fixed point. */
export const SURFACE_ABOVE_DIVER_PX = 70;

/** Below this the god rays are gone; the water is lit only by what lives in it. */
export const RAYS_GONE_AT_METRES = 140;

/** How much darker the vignette gets at full pressure, added to the zone's own. */
export const PRESSURE_VIGNETTE = 0.35;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Screen y of the waterline. Moves with the base layer, so it rises as you sink. */
export function surfaceY(depth: number, diverY: number): number {
  return diverY - SURFACE_ABOVE_DIVER_PX - depth * PIXELS_PER_METRE;
}

/** 1 at the surface, 0 from RAYS_GONE_AT_METRES down; eased so it lingers then goes. */
export function rayStrength(depth: number): number {
  const k = 1 - clamp01(depth / RAYS_GONE_AT_METRES);
  return k * k;
}

/** 0 at the surface, 1 at DARKEST_AT_METRES and below. */
export function pressure(depth: number): number {
  return clamp01(depth / DARKEST_AT_METRES);
}
```

Run the suite. Expected: all passed.

- [ ] **Step 3: Write the failing `DiveScene.reset()` test**

Create `src/game/scene/diveScene.test.ts`:

```ts
import { test, assert, equal } from '../testing/harness.ts';
import { DiveScene } from './diveScene.ts';
import type { SceneRenderer, SceneState } from './renderer.ts';
import { BreathEmitter } from '../input/emitter.ts';
import { BreathConductor } from '../session/conductor.ts';
import type { BreathEngine, BreathEventMap } from '../../breath/types.ts';

/**
 * One scene for the whole app: dive after dive on the same renderer, so the
 * WebGL context is never torn down and rebuilt. That only works if a reset
 * really does put the diver back at the surface.
 */

class NullRenderer implements SceneRenderer {
  last: SceneState | null = null;
  render(state: SceneState): void {
    this.last = state;
  }
  resize(): void {}
  destroy(): void {}
}

// Depth only moves inside the frame loop, so the tests drive frames by hand.
const queued: FrameRequestCallback[] = [];
const g = globalThis as Record<string, unknown>;
g.requestAnimationFrame = (cb: FrameRequestCallback) => queued.push(cb);
g.cancelAnimationFrame = () => {};
g.ResizeObserver = class {
  observe() {}
  disconnect() {}
};
let clock = 0;

/** Run `count` frames 50 ms apart (the scene's own dt cap), never behind real time. */
function pump(count = 1): void {
  for (let i = 0; i < count; i += 1) {
    const cb = queued.shift();
    if (!cb) return;
    clock = Math.max(clock, performance.now()) + 50;
    cb(clock);
  }
}

function stubEngine(emitter: BreathEmitter): BreathEngine {
  return {
    start: () => Promise.resolve(),
    stop() {},
    calibrate: () => Promise.resolve({ baselineRR: 12, noiseFloor: 0, ok: true }),
    on: <K extends keyof BreathEventMap>(e: K, h: (p: BreathEventMap[K]) => void) =>
      emitter.on(e, h),
    setExhaleExpected() {},
    usingFallbackInput: true,
  };
}

const canvas = {} as HTMLCanvasElement;

test('reset puts the diver back at the surface and bumps the epoch', () => {
  const renderer = new NullRenderer();
  const scene = new DiveScene(renderer, canvas, { reducedMotion: true });
  const emitter = new BreathEmitter();
  scene.attach(stubEngine(emitter), new BreathConductor());
  scene.start();
  emitter.emit('phase-change', { phase: 'exhale', at: 0 });
  emitter.emit('exhale-end', { durationMs: 6_000, quality: 1 });
  scene.setZone(2);
  pump(3);
  assert((renderer.last?.depth ?? 0) > 5, 'the breath did not move the diver — test is not exercising depth');
  equal(renderer.last?.zone, 2);
  const before = scene.epoch;

  scene.reset();
  pump();

  equal(scene.depth, 0, 'depth survived the reset');
  equal(scene.drawnDepth, 0, 'drawn depth survived the reset');
  equal(scene.light, 0, 'light survived the reset');
  equal(renderer.last?.depth, 0, 'the renderer was still shown the old depth');
  equal(renderer.last?.zone, 0, 'zone survived the reset');
  equal(renderer.last?.epoch, before + 1, 'epoch did not advance');
  scene.stop();
});

test('reset detaches the previous dive’s engine', () => {
  const renderer = new NullRenderer();
  const scene = new DiveScene(renderer, canvas, { reducedMotion: true });
  const emitter = new BreathEmitter();
  scene.attach(stubEngine(emitter), new BreathConductor());
  scene.start();
  scene.reset();
  emitter.emit('phase-change', { phase: 'exhale', at: 0 });
  emitter.emit('exhale-end', { durationMs: 6_000, quality: 1 });
  pump(3);
  equal(renderer.last?.depth, 0, 'a stale engine still moved the diver after reset');
  scene.stop();
});
```

Add `import './../scene/diveScene.test.ts';` to `src/game/testing/run.ts` after the depthLight import. Run the suite. Expected: FAIL — `scene.reset is not a function`. (`DiveScene` reads `window.matchMedia` only when `reducedMotion` is not passed; the tests pass it, so Node needs no `window`.)

- [ ] **Step 4: Add `epoch` to `SceneState`**

In `src/game/scene/renderer.ts`, add to `SceneState` after `elapsedSeconds`:

```ts
  /**
   * Bumped by DiveScene.reset(). A renderer seeing a new epoch snaps its own
   * smoothing (scroll, light) to the state instead of easing across a jump
   * that is a new dive, not a movement.
   */
  epoch: number;
```

- [ ] **Step 5: Implement `reset()` and `epoch` in `DiveScene`**

In `src/game/scene/diveScene.ts`, add a field after `private zone = 0;`:

```ts
  private epochCount = 0;
```

add a public getter after `get light()`:

```ts
  /** Increments on every reset; renderers snap their smoothing when it changes. */
  get epoch(): number {
    return this.epochCount;
  }
```

add a public method after `setPose()`:

```ts
  /**
   * Back to the surface for the next dive, on the same renderer and canvas.
   * Detaches whatever engine and conductor were attached; the frame loop keeps
   * running if it was.
   */
  reset(): void {
    this.release();
    this.earnedDepth = 0;
    this.targetDepth = 0;
    this.shownDepth = 0;
    this.exhaleStartedAt = null;
    this.depthAtExhaleStart = 0;
    this.lastQuality = 0.7;
    this.lightCharge = 0;
    this.charging = false;
    this.promptStep = 'none';
    this.promptStartedAt = null;
    this.promptDurationMs = 0;
    this.pose = 'level';
    this.zone = 0;
    this.settling = false;
    this.restSeconds = 0;
    this.epochCount += 1;
  }
```

and in `snapshot()`, add `epoch: this.epochCount,` after `elapsedSeconds`.

Run the suite. Expected: all passed. Run `npx tsc -b`. Expected: errors only in the two renderers if they construct `SceneState` (they do not; they consume it) — so no errors. If `DiveView.tsx` or any other site builds a `SceneState` literal, add `epoch: 0` there.

- [ ] **Step 6: Snap renderer smoothing on a new epoch**

In `src/game/scene/pixiRenderer.ts` add a field `private epoch = 0;` after `private height = 0;`, and at the top of `render()` right after `const f = this.frame;`:

```ts
    // A reset is a new dive, not a movement: snap rather than glide 300m home.
    if (state.epoch !== this.epoch) {
      this.epoch = state.epoch;
      this.scroll = state.depth;
      this.lastDepth = state.depth;
      this.visualLight = state.light;
    }
```

In `src/game/scene/canvasRenderer.ts` add the same field after `private bubbleAccumulator = 0;` and the same block as the first lines of `render()`.

- [ ] **Step 7: Create the Pixi `SurfaceLight`**

Create `src/game/scene/art/surfaceLight.ts`:

```ts
import { Container, Graphics } from 'pixi.js';
import type { Frame } from './layers';
import { lerpTint, slow } from './layers';
import { rayStrength, surfaceY } from './depthLight';

/**
 * The world above you, receding. A dawn sky above a bright waterline at the
 * start of every dive, and a fan of god rays that thins out as you sink and is
 * gone by the time the zone lights are the only light left.
 *
 * Built once per layout; per frame only positions and alphas change.
 */

const SKY_TOP = 0x0b2a3d;
const SKY_HORIZON = 0x3f7f8c;
const WATERLINE = 0xbfeff0;
const RAY = 0x9fe7e6;
const RAY_COUNT = 7;
const SKY_BANDS = 24;

export class SurfaceLight {
  readonly container = new Container();
  private readonly sky = new Graphics();
  private readonly line = new Graphics();
  private readonly rays = new Container();
  private readonly rayShapes: Graphics[] = [];

  constructor() {
    for (let i = 0; i < RAY_COUNT; i += 1) {
      const ray = new Graphics();
      ray.blendMode = 'add';
      this.rayShapes.push(ray);
      this.rays.addChild(ray);
    }
    this.container.addChild(this.rays, this.sky, this.line);
  }

  layout(w: number, h: number): void {
    // The sky is painted in local space from -h to 0, so placing the container
    // at the waterline puts the horizon exactly on it.
    this.sky.clear();
    for (let i = 0; i < SKY_BANDS; i += 1) {
      const t = i / (SKY_BANDS - 1);
      this.sky
        .rect(0, -h + (h * i) / SKY_BANDS, w, h / SKY_BANDS + 1)
        .fill(lerpTint(SKY_TOP, SKY_HORIZON, t));
    }
    this.line.clear();
    this.line.rect(0, -1.5, w, 3).fill({ color: WATERLINE, alpha: 0.85 });

    // Rays hang down from the waterline, fanned slightly toward the diver.
    for (let i = 0; i < RAY_COUNT; i += 1) {
      const x = ((i + 0.5) / RAY_COUNT) * w;
      const spread = (x - w / 2) * 0.35;
      const top = w * (0.03 + 0.02 * (i % 3));
      const bottom = top * 4;
      const ray = this.rayShapes[i];
      ray.clear();
      ray
        .poly([x - top, 0, x + top, 0, x + spread + bottom, h * 1.2, x + spread - bottom, h * 1.2])
        .fill({ color: RAY, alpha: 1 });
    }
  }

  update(f: Frame): void {
    const y = surfaceY(f.depth, f.dy);
    const strength = rayStrength(f.depth);
    this.container.y = y;
    // Above the screen top the sky and line are off-canvas; skip drawing them.
    const skyVisible = y > -2;
    this.sky.visible = skyVisible;
    this.line.visible = skyVisible;
    this.rays.visible = strength > 0.001;
    if (!this.rays.visible) return;
    // Once the waterline has left the top of the screen, the rays keep coming
    // from just above it rather than from far off-screen.
    this.rays.y = Math.max(0, -y) * 0.9;
    for (let i = 0; i < this.rayShapes.length; i += 1) {
      // slow() is a sine in -1..1, so the shimmer swings between 0.5 and 1.
      const shimmer = f.reduced ? 1 : 0.75 + 0.25 * slow(f.t, 7 + i * 1.3, i * 0.9);
      this.rayShapes[i].alpha = 0.07 * strength * shimmer;
    }
  }
}
```

Note: `slow(t, periodSeconds, phase)` and `lerpTint(a, b, t)` already exist in `layers.ts`.

- [ ] **Step 8: Wire `SurfaceLight` and pressure into the Pixi renderer**

In `src/game/scene/pixiRenderer.ts`:

1. Imports: add `import { SurfaceLight } from './art/surfaceLight';` and `import { PRESSURE_VIGNETTE, pressure } from './art/depthLight';`.
2. Field after `private readonly vignette: Sprite;`: `private readonly surface = new SurfaceLight();`
3. In the constructor's `this.app.stage.addChild(...)`, insert `this.surface.container,` right after `this.waterB,`.
4. In `layout()`, after `this.vignette.height = h;`: `this.surface.layout(w, h);`
5. In `render()`, replace the line that sets `this.vignette.alpha = ...` with:

```ts
    const zoneVignette =
      fromLook.vignetteAlpha + (toLook.vignetteAlpha - fromLook.vignetteAlpha) * e;
    // Deeper is heavier: the edges close in on top of the zone's own vignette.
    this.vignette.alpha = Math.min(1, zoneVignette + PRESSURE_VIGNETTE * pressure(this.scroll));
```

6. In `render()`, after `this.rig.update(f, state, lightTint);` add `this.surface.update(f);`.

- [ ] **Step 9: Tests, typecheck, and look at it on the website**

```bash
cd /Users/fl/Desktop/fathom && node --import ./src/game/testing/resolve.mjs src/game/testing/run.ts && npx tsc -b && npx oxlint
```

Expected: all pass, no errors. Then `npm run dev`, open the site in the Playwright browser, choose the scripted fixture (dev build), start a Quick dive and screenshot at the start and ~10 s in. Confirm: sky + waterline above the diver at the start; waterline rises off the top; rays fade; edges darker deeper. Then go back to setup and start a second dive: it must begin at the surface again with no long upward glide.

- [ ] **Step 10: Commit**

```bash
git add src/game/scene src/game/testing/run.ts
git commit -m "Keep one scene across dives and show the surface receding with depth"
```

---

### Task 6: Screen flow and saved choices

**Files:**
- Create: `mobile/src/app/flow.ts`, `mobile/src/app/flow.test.ts`
- Create: `mobile/src/app/storage.ts`, `mobile/src/app/storage.test.ts`
- Modify: `mobile/src/testing/run.ts`

**Interfaces:**
- Produces:
  - `type Screen = 'safety' | 'title' | 'predive' | 'dive' | 'results'`
  - `type DivePlan = 'full' | 'quick'`; `type InputChoice = 'mic' | 'touch'`
  - `interface FlowState { screen: Screen; acknowledged: boolean; plan: DivePlan; input: InputChoice }`
  - `type FlowEvent = { type: 'acknowledge'; input: InputChoice } | { type: 'choose-dive'; plan: DivePlan } | { type: 'begin' } | { type: 'back' } | { type: 'surfaced' } | { type: 'done' }`
  - `initialFlow(saved: SavedChoices | null): FlowState`; `nextFlow(state: FlowState, event: FlowEvent): FlowState`
  - `interface SavedChoices { acknowledged: true; input: InputChoice }`; `loadChoices(store?: KeyValueStore): SavedChoices | null`; `saveChoices(choices: SavedChoices, store?: KeyValueStore): void`; `type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>`

- [ ] **Step 1: Write the failing flow tests**

Create `mobile/src/app/flow.test.ts`:

```ts
import { test, equal } from '@fathom/game/testing/harness.ts';
import { initialFlow, nextFlow } from './flow.ts';
import type { FlowEvent, FlowState } from './flow.ts';

/**
 * The app's one-way arc: scope first, then title → pre-dive → dive → results
 * → title. The results screen has exactly one way out, and it is not "again".
 */

const run = (state: FlowState, ...events: FlowEvent[]) => events.reduce(nextFlow, state);

test('first launch opens on the safety scope', () => {
  equal(initialFlow(null).screen, 'safety');
});

test('a returning player opens on the title with their input', () => {
  const state = initialFlow({ acknowledged: true, input: 'touch' });
  equal(state.screen, 'title');
  equal(state.input, 'touch');
});

test('nothing gets past the scope except acknowledging it', () => {
  const start = initialFlow(null);
  for (const event of [
    { type: 'choose-dive', plan: 'full' },
    { type: 'begin' },
    { type: 'surfaced' },
    { type: 'done' },
  ] as FlowEvent[]) {
    equal(nextFlow(start, event).screen, 'safety', `${event.type} skipped the scope`);
  }
  const after = nextFlow(start, { type: 'acknowledge', input: 'mic' });
  equal(after.screen, 'title');
  equal(after.acknowledged, true);
});

test('the full arc, and results lead only back to the title', () => {
  const state = run(
    initialFlow({ acknowledged: true, input: 'mic' }),
    { type: 'choose-dive', plan: 'quick' },
    { type: 'begin' },
    { type: 'surfaced' },
  );
  equal(state.screen, 'results');
  equal(state.plan, 'quick');
  equal(nextFlow(state, { type: 'begin' }).screen, 'results', 'results offered another dive');
  equal(nextFlow(state, { type: 'choose-dive', plan: 'full' }).screen, 'results');
  equal(nextFlow(state, { type: 'done' }).screen, 'title');
});

test('the title cannot jump straight into a dive', () => {
  const title = initialFlow({ acknowledged: true, input: 'mic' });
  equal(nextFlow(title, { type: 'begin' }).screen, 'title');
});

test('pre-dive can go back to the title', () => {
  const state = run(
    initialFlow({ acknowledged: true, input: 'mic' }),
    { type: 'choose-dive', plan: 'full' },
    { type: 'back' },
  );
  equal(state.screen, 'title');
});
```

Create `mobile/src/app/storage.test.ts`:

```ts
import { test, equal } from '@fathom/game/testing/harness.ts';
import { loadChoices, saveChoices } from './storage.ts';
import type { KeyValueStore } from './storage.ts';

function memory(): KeyValueStore {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
  };
}

const broken: KeyValueStore = {
  getItem() {
    throw new Error('SecurityError');
  },
  setItem() {
    throw new Error('QuotaExceededError');
  },
};

test('choices round-trip', () => {
  const store = memory();
  saveChoices({ acknowledged: true, input: 'touch' }, store);
  const loaded = loadChoices(store);
  equal(loaded?.input, 'touch');
  equal(loaded?.acknowledged, true);
});

test('nothing saved means first launch', () => {
  equal(loadChoices(memory()), null);
});

test('corrupt values mean first launch, not a crash', () => {
  const store = memory();
  store.setItem('fathom.app.choices', '{not json');
  equal(loadChoices(store), null);
  store.setItem('fathom.app.choices', JSON.stringify({ acknowledged: true, input: 'nose' }));
  equal(loadChoices(store), null);
});

test('a storage that throws is survivable', () => {
  equal(loadChoices(broken), null);
  saveChoices({ acknowledged: true, input: 'mic' }, broken);
});
```

Replace `mobile/src/testing/run.ts` imports so it reads:

```ts
import './smoke.test.ts';
import '../app/flow.test.ts';
import '../app/storage.test.ts';
import { runAll } from '@fathom/game/testing/harness.ts';

await runAll();
```

Run `npm test -w mobile`. Expected: FAIL — `./flow.ts` not found.

- [ ] **Step 2: Implement `mobile/src/app/flow.ts`**

```ts
import type { SavedChoices } from './storage';

/**
 * Where the player is in the app. Pure: the UI renders `screen` and sends
 * events; nothing else moves it.
 *
 * Two rules live here so no screen can break them: nothing is reachable before
 * the safety scope is acknowledged, and the results screen leads back to the
 * title only — never into another dive.
 */

export type Screen = 'safety' | 'title' | 'predive' | 'dive' | 'results';
export type DivePlan = 'full' | 'quick';
export type InputChoice = 'mic' | 'touch';

export interface FlowState {
  screen: Screen;
  acknowledged: boolean;
  plan: DivePlan;
  input: InputChoice;
}

export type FlowEvent =
  | { type: 'acknowledge'; input: InputChoice }
  | { type: 'choose-dive'; plan: DivePlan }
  | { type: 'begin' }
  | { type: 'back' }
  | { type: 'surfaced' }
  | { type: 'done' };

export function initialFlow(saved: SavedChoices | null): FlowState {
  return saved
    ? { screen: 'title', acknowledged: true, plan: 'full', input: saved.input }
    : { screen: 'safety', acknowledged: false, plan: 'full', input: 'mic' };
}

export function nextFlow(state: FlowState, event: FlowEvent): FlowState {
  if (!state.acknowledged) {
    return event.type === 'acknowledge'
      ? { ...state, screen: 'title', acknowledged: true, input: event.input }
      : state;
  }
  switch (state.screen) {
    case 'title':
      return event.type === 'choose-dive' ? { ...state, screen: 'predive', plan: event.plan } : state;
    case 'predive':
      if (event.type === 'begin') return { ...state, screen: 'dive' };
      if (event.type === 'back') return { ...state, screen: 'title' };
      return state;
    case 'dive':
      return event.type === 'surfaced' ? { ...state, screen: 'results' } : state;
    case 'results':
      return event.type === 'done' ? { ...state, screen: 'title' } : state;
    case 'safety':
      return event.type === 'done' ? { ...state, screen: 'title' } : state;
  }
}
```

- [ ] **Step 3: Implement `mobile/src/app/storage.ts`**

```ts
import type { InputChoice } from './flow';

/**
 * What the app remembers between launches in Plan 1: that the scope was read,
 * and which input was chosen. Plan 4 moves this to Capacitor Preferences.
 *
 * Every access is guarded. A web view with storage blocked must still open on
 * the safety screen rather than on a white one.
 */

export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

export interface SavedChoices {
  acknowledged: true;
  input: InputChoice;
}

const KEY = 'fathom.app.choices';

function defaultStore(): KeyValueStore | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadChoices(store: KeyValueStore | null = defaultStore()): SavedChoices | null {
  if (!store) return null;
  try {
    const raw = store.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedChoices>;
    if (parsed.acknowledged !== true) return null;
    if (parsed.input !== 'mic' && parsed.input !== 'touch') return null;
    return { acknowledged: true, input: parsed.input };
  } catch {
    return null;
  }
}

export function saveChoices(
  choices: SavedChoices,
  store: KeyValueStore | null = defaultStore(),
): void {
  if (!store) return;
  try {
    store.setItem(KEY, JSON.stringify(choices));
  } catch {
    // Not remembered this time; the player sees the scope again next launch.
  }
}
```

- [ ] **Step 4: Run tests and typecheck**

```bash
cd /Users/fl/Desktop/fathom && npm test -w mobile && npm run typecheck -w mobile
```

Expected: all passed; no type errors.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/app mobile/src/testing/run.ts
git commit -m "Add the app's screen flow and throw-safe saved choices"
```

---

### Task 7: `DiveController` — one dive's wiring, without React

**Files:**
- Create: `mobile/src/dive/diveController.ts`, `mobile/src/dive/diveController.test.ts`, `mobile/src/dive/inputs.ts`
- Modify: `mobile/src/testing/run.ts`

**Interfaces:**
- Consumes: `startInput`, `InputPlan`, `StartedInput` (`@fathom/game/input/inputSource`); `BreathConductor`, `PromptWindow` (`@fathom/game/session/conductor`); `SessionMachine`, `SessionPlan`, `SessionResult`, `SessionState` (`@fathom/game/session/sessionMachine`); `SpacebarBreathEngine` with `beginHold/endHold` (Task 4); `DiveScene#reset()` (Task 5).
- Produces:
  - `interface DiveSceneLike { attach(engine: BreathEngine, conductor: BreathConductor): () => void; setZone(zone: number): void; setPose(pose: DiverPose): void; reset(): void; settle(): void; readonly depth: number; readonly light: number }`
  - `interface DiveCallbacks { onState(state: SessionState): void; onPrompt(window: PromptWindow, sweepMs: number): void; onResult(result: SessionResult, input: InputCode): void }`
  - `type DiveInput = 'mic' | 'touch' | 'scripted'`
  - `interface InputFactories { mic(): BreathEngine; touch(): SpacebarBreathEngine; scripted(conductor: BreathConductor, timeScale: number): BreathEngine }`
  - `class DiveController { constructor(scene: DiveSceneLike, callbacks: DiveCallbacks, factories: InputFactories); start(config: { plan: SessionPlan; input: DiveInput; timeScale?: number }): Promise<StartedInput | null>; stop(): void; get touch(): SpacebarBreathEngine | null; get running(): boolean }`
  - `ZONE_FOR_STATE: Partial<Record<SessionState, number>>`
  - `productionInputs: InputFactories` (in `inputs.ts`)

- [ ] **Step 1: Write the failing controller tests**

Create `mobile/src/dive/diveController.test.ts`:

```ts
import { test, assert, equal } from '@fathom/game/testing/harness.ts';
import { DiveController } from './diveController.ts';
import type { DiveSceneLike, InputFactories } from './diveController.ts';
import { ScriptedBreathEngine } from '@fathom/game/input/scriptedEngine.ts';
import { SpacebarBreathEngine } from '@fathom/game/input/spacebarEngine.ts';
import type { SessionResult, SessionState } from '@fathom/game/session/sessionMachine.ts';
import type { BreathEngine, BreathEventMap, CalibrationResult } from '@fathom/breath/types.ts';
import type { InputCode } from '@fathom/game/surface/diveLog.ts';

/**
 * A whole Quick Dive, compressed 500x, through the same wiring the app uses.
 * The scene is a recorder: these tests are about who tells it what, and when.
 */

const quiet = { addEventListener() {}, removeEventListener() {} };
const scope = globalThis as { document?: unknown };
scope.document ??= { ...quiet, visibilityState: 'visible' };

class RecordingScene implements DiveSceneLike {
  calls: string[] = [];
  depth = 0;
  light = 0;
  attach() {
    this.calls.push('attach');
    return () => this.calls.push('detach');
  }
  setZone(zone: number) {
    this.calls.push(`zone:${zone}`);
  }
  setPose(pose: string) {
    this.calls.push(`pose:${pose}`);
  }
  reset() {
    this.calls.push('reset');
  }
  settle() {
    this.calls.push('settle');
  }
}

function refusingMic(): BreathEngine & { stopped: number } {
  let stopped = 0;
  return {
    start: () => Promise.reject(new Error('Permission denied')),
    stop() {
      stopped += 1;
    },
    calibrate: (): Promise<CalibrationResult> =>
      Promise.resolve({ baselineRR: 12, noiseFloor: 0, ok: true }),
    on: <K extends keyof BreathEventMap>(_e: K, _h: (p: BreathEventMap[K]) => void) => () => {},
    setExhaleExpected() {},
    usingFallbackInput: false,
    get stopped() {
      return stopped;
    },
  };
}

const factories = (overrides: Partial<InputFactories> = {}): InputFactories => ({
  mic: () => refusingMic(),
  touch: () => new SpacebarBreathEngine({ target: quiet, calibrationMs: 20 }),
  scripted: (conductor, timeScale) =>
    new ScriptedBreathEngine({ follow: conductor, timeScale, seed: 7 }),
  ...overrides,
});

function finished(controller: DiveController, start: () => Promise<unknown>) {
  return new Promise<void>((resolve, reject) => {
    const guard = setTimeout(() => reject(new Error('dive never surfaced')), 5_000);
    void start().then(() => {
      const poll = setInterval(() => {
        if (!controller.running) {
          clearInterval(poll);
          clearTimeout(guard);
          resolve();
        }
      }, 10);
    });
  });
}

test('a scripted quick dive runs start to surface and settles the scene', async () => {
  const scene = new RecordingScene();
  const states: SessionState[] = [];
  let result: SessionResult | null = null;
  let input: InputCode | null = null;
  const controller = new DiveController(
    scene,
    {
      onState: (s) => states.push(s),
      onPrompt: () => {},
      onResult: (r, code) => {
        result = r;
        input = code;
      },
    },
    factories(),
  );

  await finished(controller, () => controller.start({ plan: 'quick', input: 'scripted', timeScale: 500 }));

  equal(scene.calls[0], 'reset', 'the scene was not reset before the dive');
  assert(scene.calls.includes('attach'));
  assert(scene.calls.includes('zone:0'));
  assert(scene.calls.includes('settle'), 'the scene was never settled');
  equal(states[0], 'calibrating');
  assert(states.includes('zone-1'));
  equal(states[states.length - 1], 'ended');
  equal((result as SessionResult | null)?.ending, 'completed');
  equal(input, 'scripted');
});

test('a refused microphone becomes a touch dive, labelled touch', async () => {
  const scene = new RecordingScene();
  const mic = refusingMic();
  const controller = new DiveController(
    scene,
    { onState: () => {}, onPrompt: () => {}, onResult: () => {} },
    factories({ mic: () => mic }),
  );
  const started = await controller.start({ plan: 'quick', input: 'mic' });
  equal(started?.code, 'touch');
  equal(mic.stopped, 1, 'the refused microphone was not released');
  assert(controller.touch !== null, 'no touch engine to press');
  controller.stop();
});

test('leaving mid-dive reports stopped and releases the input', async () => {
  const scene = new RecordingScene();
  let result: SessionResult | null = null;
  const controller = new DiveController(
    scene,
    { onState: () => {}, onPrompt: () => {}, onResult: (r) => (result = r) },
    factories(),
  );
  await controller.start({ plan: 'full', input: 'touch' });
  controller.stop();
  equal((result as SessionResult | null)?.ending, 'stopped');
  equal(controller.running, false);
  equal(controller.touch, null, 'the touch engine outlived the dive');
  assert(scene.calls.includes('detach'), 'the scene kept listening to a stopped engine');
});

test('a second start while the first is starting is ignored', async () => {
  const scene = new RecordingScene();
  let built = 0;
  const controller = new DiveController(
    scene,
    { onState: () => {}, onPrompt: () => {}, onResult: () => {} },
    factories({
      touch: () => {
        built += 1;
        return new SpacebarBreathEngine({ target: quiet, calibrationMs: 20 });
      },
    }),
  );
  const first = controller.start({ plan: 'quick', input: 'touch' });
  const second = controller.start({ plan: 'quick', input: 'touch' });
  equal(await second, null, 'the second start was not refused');
  await first;
  equal(built, 1, 'two engines were built');
  controller.stop();
});
```

Add `import '../dive/diveController.test.ts';` to `mobile/src/testing/run.ts`. Run `npm test -w mobile`. Expected: FAIL — `./diveController.ts` not found.

- [ ] **Step 2: Implement `mobile/src/dive/diveController.ts`**

```ts
import type { BreathEngine } from '@fathom/breath/types';
import { startInput } from '@fathom/game/input/inputSource';
import type { InputPlan, StartedInput } from '@fathom/game/input/inputSource';
import type { SpacebarBreathEngine } from '@fathom/game/input/spacebarEngine';
import type { DiverPose } from '@fathom/game/scene/renderer';
import { BreathConductor } from '@fathom/game/session/conductor';
import type { PromptWindow } from '@fathom/game/session/conductor';
import { SessionMachine } from '@fathom/game/session/sessionMachine';
import type { SessionPlan, SessionResult, SessionState } from '@fathom/game/session/sessionMachine';
import type { InputCode } from '@fathom/game/surface/diveLog';

/**
 * One dive, wired: input → conductor → session → scene. The same order the
 * website's DiveView uses, without React, so it can be tested end to end.
 *
 * The input is started first and before any other await, because the
 * microphone's AudioContext must be created inside the tap that began the
 * dive — WebKit is strict about that.
 */

export interface DiveSceneLike {
  attach(engine: BreathEngine, conductor: BreathConductor): () => void;
  setZone(zone: number): void;
  setPose(pose: DiverPose): void;
  reset(): void;
  settle(): void;
  readonly depth: number;
  readonly light: number;
}

export interface DiveCallbacks {
  onState(state: SessionState): void;
  /** `sweepMs` is the window in wall-clock time, for the breath ring. */
  onPrompt(window: PromptWindow, sweepMs: number): void;
  onResult(result: SessionResult, input: InputCode): void;
}

export type DiveInput = 'mic' | 'touch' | 'scripted';

export interface InputFactories {
  mic(): BreathEngine;
  touch(): SpacebarBreathEngine;
  scripted(conductor: BreathConductor, timeScale: number): BreathEngine;
}

/** Which visual zone each stage of the arc belongs to. Surfacing keeps the last. */
export const ZONE_FOR_STATE: Partial<Record<SessionState, number>> = {
  calibrating: 0,
  'zone-1': 0,
  'zone-2': 1,
  'zone-3': 2,
};

/** The starting prompt rate. The arc only ever slows from here. */
const START_RR = 12;

export class DiveController {
  private readonly scene: DiveSceneLike;
  private readonly callbacks: DiveCallbacks;
  private readonly factories: InputFactories;

  private starting = false;
  private engine: BreathEngine | null = null;
  private touchEngine: SpacebarBreathEngine | null = null;
  private conductor: BreathConductor | null = null;
  private machine: SessionMachine | null = null;
  private detach: (() => void)[] = [];
  private code: InputCode = 'microphone';

  constructor(scene: DiveSceneLike, callbacks: DiveCallbacks, factories: InputFactories) {
    this.scene = scene;
    this.callbacks = callbacks;
    this.factories = factories;
  }

  get running(): boolean {
    return this.machine !== null;
  }

  /** The engine a finger presses, when the dive is on touch. */
  get touch(): SpacebarBreathEngine | null {
    return this.touchEngine;
  }

  /**
   * Begin a dive. Resolves with what actually started, or null if a dive is
   * already starting or running. Throws if no input could start at all.
   */
  async start(config: {
    plan: SessionPlan;
    input: DiveInput;
    timeScale?: number;
  }): Promise<StartedInput | null> {
    if (this.starting || this.running) return null;
    this.starting = true;
    try {
      // Only the fixture may run fast; a person breathes in real time.
      const timeScale = config.input === 'scripted' ? (config.timeScale ?? 1) : 1;
      const conductor = new BreathConductor({ targetRR: START_RR, timeScale });

      const started = await startInput(this.planFor(config.input, conductor, timeScale));
      this.engine = started.engine;
      this.code = started.code;
      this.touchEngine =
        started.code === 'touch' ? (started.engine as SpacebarBreathEngine) : null;
      conductor.attach(started.engine);
      this.conductor = conductor;

      this.scene.reset();
      this.detach.push(this.scene.attach(started.engine, conductor));
      this.detach.push(
        conductor.on((window) => this.callbacks.onPrompt(window, window.durationMs / timeScale)),
      );

      const machine = new SessionMachine(started.engine, conductor, {
        plan: config.plan,
        timeScale,
        onState: (state) => this.onState(state),
        onResult: (result) => this.onResult(result),
      });
      this.machine = machine;
      this.scene.setPose('level');
      // The machine starts the conductor once calibration is done (#29).
      void machine.start();
      return started;
    } finally {
      this.starting = false;
    }
  }

  /** Leave early. The session reports what it measured so far. */
  stop(): void {
    this.machine?.stop();
  }

  // ------------------------------------------------------------- internals

  private planFor(input: DiveInput, conductor: BreathConductor, timeScale: number): InputPlan {
    switch (input) {
      case 'mic':
        return {
          primary: this.factories.mic(),
          code: 'microphone',
          fallback: () => this.factories.touch(),
          fallbackCode: 'touch',
        };
      case 'touch':
        return { primary: this.factories.touch(), code: 'touch' };
      case 'scripted':
        return { primary: this.factories.scripted(conductor, timeScale), code: 'scripted' };
    }
  }

  private onState(state: SessionState): void {
    const zone = ZONE_FOR_STATE[state];
    if (zone !== undefined) this.scene.setZone(zone);
    if (state === 'calibrating' || state === 'surfacing') this.scene.setPose('level');
    else if (zone !== undefined) this.scene.setPose('descending');
    this.callbacks.onState(state);
  }

  private onResult(result: SessionResult): void {
    const code = this.code;
    this.teardown();
    this.scene.settle();
    this.callbacks.onResult(result, code);
  }

  private teardown(): void {
    for (const off of this.detach) off();
    this.detach = [];
    this.conductor?.stop();
    this.conductor = null;
    this.engine?.stop();
    this.engine = null;
    this.touchEngine = null;
    this.machine = null;
  }
}
```

Note: `SessionMachine.finish()` calls `onResult` synchronously from `stop()`, so `stop()` → `onResult` → `teardown()` releases everything in one call; the test "leaving mid-dive" depends on that.

- [ ] **Step 3: Run tests**

```bash
cd /Users/fl/Desktop/fathom && npm test -w mobile
```

Expected: all passed. If the scripted quick dive times out, print `states` in the guard rejection and check `ScriptedBreathEngine`'s `calibrationMs` default is divided by `timeScale` (it is, per its options doc).

- [ ] **Step 4: Production factories — `mobile/src/dive/inputs.ts`**

```ts
import { createBreathEngine } from '@fathom/breath/engine';
import { ScriptedBreathEngine } from '@fathom/game/input/scriptedEngine';
import { SpacebarBreathEngine } from '@fathom/game/input/spacebarEngine';
import type { InputFactories } from './diveController';

/** How long the baseline read listens on the inputs that measure one. */
const CALIBRATION_MS = 10_000;

export const productionInputs: InputFactories = {
  mic: () => createBreathEngine(),
  touch: () => new SpacebarBreathEngine({ calibrationMs: CALIBRATION_MS }),
  scripted: (conductor, timeScale) => new ScriptedBreathEngine({ follow: conductor, timeScale }),
};
```

- [ ] **Step 5: Typecheck and commit**

```bash
cd /Users/fl/Desktop/fathom && npm run typecheck -w mobile
git add mobile/src/dive mobile/src/testing/run.ts
git commit -m "Add the dive controller: input, conductor, session and scene in one place"
```

---

### Task 8: The always-on ocean and the shared verdict

**Files:**
- Create: `mobile/src/world/OceanStage.tsx`
- Create: `src/game/surface/verdict.ts`, `src/game/surface/verdict.test.ts`
- Modify: `src/game/surface/SurfaceScreen.tsx`
- Modify: `src/game/testing/run.ts`

**Interfaces:**
- Consumes: `createDiveRenderer`, `DiveScene` (`@fathom/game/scene/diveScene`).
- Produces:
  - `OceanStage` component (`{ children: ReactNode }`) rendering the full-screen canvas under its children.
  - `useOcean(): DiveScene | null` (null until the renderer is ready).
  - `MEANINGFUL_DELTA_RR = 0.5`; `type Verdict = 'slowed' | 'unchanged' | 'sped'`; `verdictFor(deltaRR: number): Verdict`.

- [ ] **Step 1: Write the failing verdict test**

Create `src/game/surface/verdict.test.ts`:

```ts
import { test, equal } from '../testing/harness.ts';
import { MEANINGFUL_DELTA_RR, verdictFor } from './verdict.ts';

/** One rule for every screen that states the result: inside the noise is "no change". */

test('a change inside the noise is no change, in both directions', () => {
  equal(verdictFor(0), 'unchanged');
  equal(verdictFor(MEANINGFUL_DELTA_RR - 0.01), 'unchanged');
  equal(verdictFor(-(MEANINGFUL_DELTA_RR - 0.01)), 'unchanged');
});

test('slowing and speeding up are reported as what they are', () => {
  equal(verdictFor(MEANINGFUL_DELTA_RR), 'slowed');
  equal(verdictFor(-MEANINGFUL_DELTA_RR), 'sped');
});
```

Add `import './../surface/verdict.test.ts';` to `src/game/testing/run.ts`. Run the website suite. Expected: FAIL — module not found.

- [ ] **Step 2: Implement `src/game/surface/verdict.ts` and use it in `SurfaceScreen`**

```ts
/**
 * How a before/after change is stated. Shared by the website's surface screen
 * and the app's results card so the two can never word the same dive
 * differently.
 */

/** Below this the change is inside the noise of the estimate. */
export const MEANINGFUL_DELTA_RR = 0.5;

export type Verdict = 'slowed' | 'unchanged' | 'sped';

/** `deltaRR` is baseline minus final: positive means breathing slowed. */
export function verdictFor(deltaRR: number): Verdict {
  if (deltaRR >= MEANINGFUL_DELTA_RR) return 'slowed';
  if (deltaRR <= -MEANINGFUL_DELTA_RR) return 'sped';
  return 'unchanged';
}
```

In `src/game/surface/SurfaceScreen.tsx`: delete the local `MEANINGFUL_DELTA_RR` constant and its comment; add `import { verdictFor } from './verdict';`; replace the two lines `const slowed = …` / `const sped = …` with:

```ts
  const verdict = verdictFor(deltaRR);
  const slowed = verdict === 'slowed';
  const sped = verdict === 'sped';
```

Run the website suite and `npx tsc -b`. Expected: all pass.

- [ ] **Step 3: Implement `mobile/src/world/OceanStage.tsx`**

```tsx
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { DiveScene, createDiveRenderer } from '@fathom/game/scene/diveScene';

/**
 * The ocean is always there. One canvas, one renderer and one DiveScene for
 * the life of the app; every screen is drawn over it. Building the renderer
 * once is also what keeps a second dive from losing its WebGL context.
 */

const OceanContext = createContext<DiveScene | null>(null);

export function useOcean(): DiveScene | null {
  return useContext(OceanContext);
}

export function OceanStage({ children }: { children: ReactNode }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [scene, setScene] = useState<DiveScene | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let built: DiveScene | null = null;
    void createDiveRenderer(canvas).then((renderer) => {
      // StrictMode mounts effects twice in development; the first build is
      // thrown away rather than leaked.
      if (disposed) {
        renderer.destroy();
        return;
      }
      built = new DiveScene(renderer, canvas);
      built.start();
      setScene(built);
    });
    return () => {
      disposed = true;
      built?.destroy();
      setScene(null);
    };
  }, []);

  return (
    <OceanContext.Provider value={scene}>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', display: 'block' }}
      />
      {children}
    </OceanContext.Provider>
  );
}
```

- [ ] **Step 4: Typecheck, commit**

```bash
cd /Users/fl/Desktop/fathom && npm run typecheck -w mobile && node --import ./src/game/testing/resolve.mjs src/game/testing/run.ts
git add mobile/src/world src/game/surface src/game/testing/run.ts
git commit -m "Add the always-on ocean stage and one shared verdict rule"
```

---

### Task 9: Screens — safety, title, pre-dive, dive HUD, results

**Files:**
- Create: `mobile/src/strings.ts`
- Create: `mobile/src/screens/SafetyGate.tsx`, `TitleScreen.tsx`, `PreDive.tsx`, `ResultsCard.tsx`
- Create: `mobile/src/dive/DiveHud.tsx`
- Create: `mobile/src/styles/screens.css`
- Modify: `mobile/src/App.tsx`

**Interfaces:**
- Consumes: `FlowState`, `nextFlow`, `initialFlow` (Task 6); `loadChoices`, `saveChoices` (Task 6); `DiveController`, `productionInputs` (Task 7); `OceanStage`, `useOcean` (Task 8); `verdictFor` (Task 8); `LanguageProvider`, `useLanguage`, `Rich` (`@fathom/shell/i18n`); `CrisisRail` (`@fathom/shell/CrisisRail`); `ProgressRing` (`@fathom/shell/ui`); `fill` (`@fathom/shell/strings`); `formatDecimal`, `formatMetres` (`@fathom/shell/format`).
- Produces: `useAppStrings(): AppStrings` from `mobile/src/strings.ts`.

- [ ] **Step 1: App strings — `mobile/src/strings.ts`**

```ts
import { useLanguage } from '@fathom/shell/i18n';

/**
 * Text that exists only in the app. Every claim, safety and result sentence
 * comes from the website's strings instead — those have already been read by
 * the people who check them.
 */
const en = {
  tagline: 'A dive you take with your breath.',
  scopeLine: 'Not therapy, not diagnosis, not for a crisis.',
  dive: 'Dive',
  diveLength: 'About five minutes',
  quick: 'Quick dive',
  quickLength: 'Ninety seconds',
  chooseInput: 'How will you breathe?',
  useMic: 'Use the microphone',
  useMicHint: 'Breathe out through your mouth. Nothing is recorded.',
  useTouch: 'Touch and hold',
  useTouchHint: 'Hold a finger on the screen for as long as you breathe out.',
  headphones: 'Headphones on for the full sound. Sit somewhere still.',
  begin: 'Begin',
  back: 'Back',
  holdHint: 'Hold anywhere while you breathe out',
  zones: ['Twilight', 'Midnight', 'Abyss'],
  zoneLabel: 'Zone',
  done: 'Done',
  micFellBack: 'The microphone was unavailable, so this dive is on touch and hold.',
};

const fr: typeof en = {
  tagline: 'Une plongée que vous menez avec votre souffle.',
  scopeLine: 'Ni une thérapie, ni un diagnostic, ni pour une crise.',
  dive: 'Plonger',
  diveLength: 'Environ cinq minutes',
  quick: 'Plongée rapide',
  quickLength: 'Quatre-vingt-dix secondes',
  chooseInput: 'Comment allez-vous respirer ?',
  useMic: 'Utiliser le microphone',
  useMicHint: 'Expirez par la bouche. Rien n’est enregistré.',
  useTouch: 'Appui maintenu',
  useTouchHint: 'Gardez un doigt sur l’écran pendant toute l’expiration.',
  headphones: 'Mettez des écouteurs pour le son complet. Installez-vous au calme.',
  begin: 'Commencer',
  back: 'Retour',
  holdHint: 'Maintenez n’importe où pendant l’expiration',
  zones: ['Crépuscule', 'Minuit', 'Abysses'],
  zoneLabel: 'Zone',
  done: 'Terminé',
  micFellBack: 'Le microphone était indisponible : cette plongée se fait par appui maintenu.',
};

export type AppStrings = typeof en;

export function useAppStrings(): AppStrings {
  const { language } = useLanguage();
  return language === 'fr' ? fr : en;
}
```

- [ ] **Step 2: Screen styles — `mobile/src/styles/screens.css`**

```css
/* Title */
.title {
  justify-content: space-between;
  padding-bottom: calc(env(safe-area-inset-bottom) + 24px);
}
.title__brand {
  margin-top: 18vh;
  text-align: center;
}
.title__brand .wordmark {
  font-size: 34px;
}
.title__tagline {
  margin: 14px 0 0;
  color: var(--hud-muted);
  font-size: 16px;
}
.title__actions {
  display: grid;
  gap: 12px;
}
.title__sub {
  display: block;
  margin-top: 4px;
  font-weight: 400;
  font-size: 13px;
  opacity: 0.75;
}
.title__actions .game-btn {
  min-height: 64px;
  line-height: 1.15;
}
.title__scope {
  margin: 14px 0 0;
  text-align: center;
  font-size: 12px;
  color: var(--hud-muted);
}

/* Sheet: a card that rises from the bottom over the water */
.sheet {
  margin-top: auto;
  margin-bottom: calc(env(safe-area-inset-bottom) + 12px);
  padding: 24px 20px;
  border-radius: 28px;
  background: rgba(4, 10, 18, 0.72);
  -webkit-backdrop-filter: blur(20px);
  backdrop-filter: blur(20px);
  border: 1px solid var(--hud-line);
  max-height: calc(100% - env(safe-area-inset-top) - 24px);
  overflow-y: auto;
  touch-action: pan-y;
  -webkit-overflow-scrolling: touch;
}
.sheet h1 {
  margin: 0 0 10px;
  font-size: 26px;
  font-weight: 600;
}
.sheet p,
.sheet li {
  color: var(--hud-muted);
  font-size: 15px;
  line-height: 1.5;
}
.sheet__actions {
  display: grid;
  gap: 10px;
  margin-top: 20px;
}
.choice {
  display: grid;
  gap: 10px;
  margin-top: 8px;
}
.choice__opt {
  text-align: left;
  border-radius: 18px;
  min-height: 72px;
  padding: 14px 18px;
}
.choice__opt[aria-pressed='true'] {
  border-color: var(--hud-accent);
  background: rgba(92, 227, 207, 0.12);
}
.choice__hint {
  display: block;
  margin-top: 4px;
  font-weight: 400;
  font-size: 13px;
  color: var(--hud-muted);
  letter-spacing: 0;
}

/* Dive HUD */
.hud {
  pointer-events: none;
}
.hud__press {
  position: absolute;
  inset: 0;
  pointer-events: auto;
}
.hud__leave {
  pointer-events: auto;
  position: absolute;
  top: calc(env(safe-area-inset-top) + 8px);
  left: 12px;
  width: 44px;
  height: 44px;
  min-height: 44px;
  padding: 0;
  font-size: 22px;
  line-height: 1;
}
.hud__gauge {
  position: absolute;
  right: 14px;
  top: 22%;
  bottom: 22%;
  width: 2px;
  background: var(--hud-track);
  border-radius: 2px;
}
.hud__gauge-mark {
  position: absolute;
  right: -4px;
  width: 10px;
  height: 2px;
  background: var(--hud-accent);
  transition: top 300ms linear;
}
.hud__depth {
  position: absolute;
  right: 26px;
  top: calc(env(safe-area-inset-top) + 16px);
  text-align: right;
  font-family: var(--font-mono);
}
.hud__depth-value {
  font-size: 28px;
  color: var(--hud-text);
}
.hud__depth-label {
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--hud-muted);
}
.hud__ring {
  position: absolute;
  left: 50%;
  bottom: calc(env(safe-area-inset-bottom) + 28px);
  transform: translateX(-50%);
}
.hud__hint {
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(env(safe-area-inset-bottom) + 8px);
  text-align: center;
  font-size: 12px;
  color: var(--hud-muted);
}
.zone-card {
  position: absolute;
  top: 30%;
  left: 0;
  right: 0;
  text-align: center;
  animation: zone-card 3.6s ease both;
}
.zone-card__over {
  font-size: 12px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--hud-muted);
}
.zone-card__name {
  margin-top: 6px;
  font-size: 30px;
  font-weight: 600;
  letter-spacing: 0.24em;
  text-transform: uppercase;
}
@keyframes zone-card {
  0% {
    opacity: 0;
    transform: translateY(10px);
  }
  20%,
  70% {
    opacity: 1;
    transform: none;
  }
  100% {
    opacity: 0;
  }
}

/* Results */
.results__figures {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin: 8px 0 12px;
}
.results__figure span {
  display: block;
}
.results__over {
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--hud-muted);
}
.results__num {
  font-family: var(--font-mono);
  font-size: 44px;
  color: var(--hud-text);
}
.results__unit {
  font-size: 12px;
  color: var(--hud-muted);
}
```

- [ ] **Step 3: Safety gate — `mobile/src/screens/SafetyGate.tsx`**

```tsx
import { useState } from 'react';
import { useLanguage } from '@fathom/shell/i18n';
import { CrisisRail } from '@fathom/shell/CrisisRail';
import type { InputChoice } from '../app/flow';
import { useAppStrings } from '../strings';

/**
 * The scope, before anything that could ask for a microphone. Plan 5 splits
 * this into the three onboarding cards; the wording here is the website's.
 */
export function SafetyGate({ onAcknowledge }: { onAcknowledge: (input: InputChoice) => void }) {
  const { t } = useLanguage();
  const a = useAppStrings();
  const [input, setInput] = useState<InputChoice>('mic');

  return (
    <div className="safe fade-in">
      <div className="sheet" role="dialog" aria-labelledby="safety-title">
        <h1 id="safety-title">{t.safety.title}</h1>
        <p>{t.safety.lead}</p>
        <p>{a.scopeLine}</p>
        <p>{t.safety.stopAnyTime}</p>

        <p style={{ marginTop: 18, color: 'var(--hud-text)' }}>{a.chooseInput}</p>
        <div className="choice">
          <button
            type="button"
            className="game-btn choice__opt"
            aria-pressed={input === 'mic'}
            onClick={() => setInput('mic')}
          >
            {a.useMic}
            <span className="choice__hint">{a.useMicHint}</span>
          </button>
          <button
            type="button"
            className="game-btn choice__opt"
            aria-pressed={input === 'touch'}
            onClick={() => setInput('touch')}
          >
            {a.useTouch}
            <span className="choice__hint">{a.useTouchHint}</span>
          </button>
        </div>

        <CrisisRail />

        <div className="sheet__actions">
          <button
            type="button"
            className="game-btn game-btn--primary"
            onClick={() => onAcknowledge(input)}
          >
            {t.safety.begin}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Title — `mobile/src/screens/TitleScreen.tsx`**

```tsx
import type { DivePlan } from '../app/flow';
import { useAppStrings } from '../strings';

export function TitleScreen({ onChoose }: { onChoose: (plan: DivePlan) => void }) {
  const a = useAppStrings();
  return (
    <div className="safe title fade-in">
      <div className="title__brand">
        <span className="wordmark">Fathom</span>
        <p className="title__tagline">{a.tagline}</p>
      </div>
      <div>
        <div className="title__actions">
          <button type="button" className="game-btn game-btn--primary" onClick={() => onChoose('full')}>
            {a.dive}
            <span className="title__sub">{a.diveLength}</span>
          </button>
          <button type="button" className="game-btn" onClick={() => onChoose('quick')}>
            {a.quick}
            <span className="title__sub">{a.quickLength}</span>
          </button>
        </div>
        <p className="title__scope">{a.scopeLine}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Pre-dive — `mobile/src/screens/PreDive.tsx`**

```tsx
import { useLanguage } from '@fathom/shell/i18n';
import type { DivePlan } from '../app/flow';
import { useAppStrings } from '../strings';

/** The last stop before the water. Begin is the tap that may open the microphone. */
export function PreDive({
  plan,
  busy,
  error,
  onBegin,
  onBack,
}: {
  plan: DivePlan;
  busy: boolean;
  error: string | null;
  onBegin: () => void;
  onBack: () => void;
}) {
  const { t } = useLanguage();
  const a = useAppStrings();
  return (
    <div className="safe fade-in">
      <div className="sheet">
        <h1>{plan === 'full' ? a.dive : a.quick}</h1>
        <p>{a.headphones}</p>
        <p>{t.dive.prompt.calibratingCaption}</p>
        {error && <p style={{ color: 'var(--alert)' }}>{error}</p>}
        <div className="sheet__actions">
          <button type="button" className="game-btn game-btn--primary" disabled={busy} onClick={onBegin}>
            {a.begin}
          </button>
          <button type="button" className="game-btn game-btn--quiet" onClick={onBack}>
            {a.back}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Dive HUD — `mobile/src/dive/DiveHud.tsx`**

```tsx
import { useEffect, useState } from 'react';
import type { PointerEvent } from 'react';
import { useLanguage } from '@fathom/shell/i18n';
import { formatMetres } from '@fathom/shell/format';
import { ProgressRing } from '@fathom/shell/ui';
import type { PromptStep } from '@fathom/game/session/conductor';
import type { SessionState } from '@fathom/game/session/sessionMachine';
import type { SpacebarBreathEngine } from '@fathom/game/input/spacebarEngine';
import { useAppStrings } from '../strings';

export interface RingView {
  step: PromptStep | 'calibrating' | null;
  sweepMs: number;
  seq: number;
}

/** Visual scale of the gauge: a full column is this many metres. */
const GAUGE_METRES = 400;

/**
 * Everything drawn over the water during a dive: depth, the breath ring, the
 * zone name as you enter it, a way out, and — on touch — the whole screen as
 * the thing you hold.
 */
export function DiveHud({
  state,
  zone,
  depth,
  ring,
  touch,
  notice,
  onLeave,
}: {
  state: SessionState;
  zone: number | null;
  depth: number;
  ring: RingView;
  touch: SpacebarBreathEngine | null;
  notice: string | null;
  onLeave: () => void;
}) {
  const { t, language } = useLanguage();
  const a = useAppStrings();
  const [cardZone, setCardZone] = useState<number | null>(null);

  // A zone card each time the arc enters a new zone; it animates itself out.
  useEffect(() => {
    if (zone !== null) setCardZone(zone);
  }, [zone]);

  const label =
    ring.step === 'calibrating'
      ? t.dive.prompt.calibrating
      : ring.step === 'inhale'
        ? t.dive.prompt.inhale
        : ring.step === 'top-up'
          ? t.dive.prompt.topUp
          : ring.step === 'exhale'
            ? t.dive.prompt.exhale
            : ring.step === 'rest'
              ? t.dive.prompt.rest
              : '';
  const caption =
    state === 'surfacing'
      ? t.dive.prompt.surfacing
      : ring.step === 'calibrating'
        ? t.dive.prompt.calibratingCaption
        : ring.step === 'exhale' && !touch
          ? t.dive.prompt.exhaleMic
          : undefined;

  const press = (down: boolean) => (event: PointerEvent<HTMLDivElement>) => {
    if (!touch) return;
    event.preventDefault();
    if (down) {
      event.currentTarget.setPointerCapture(event.pointerId);
      touch.beginHold();
    } else {
      touch.endHold();
    }
  };

  const gaugeTop = `${Math.min(100, (depth / GAUGE_METRES) * 100)}%`;

  return (
    <div className="safe hud">
      {touch && (
        <div
          className="hud__press"
          onPointerDown={press(true)}
          onPointerUp={press(false)}
          onPointerCancel={press(false)}
        />
      )}

      <div className="hud__depth" aria-live="off">
        <div className="hud__depth-value">{formatMetres(depth, t, language)}</div>
        <div className="hud__depth-label">{t.dive.depth}</div>
      </div>
      <div className="hud__gauge" aria-hidden="true">
        <div className="hud__gauge-mark" style={{ top: gaugeTop }} />
      </div>

      {cardZone !== null && (
        <div key={cardZone} className="zone-card" aria-live="polite">
          <div className="zone-card__over">
            {a.zoneLabel} {cardZone + 1}
          </div>
          <div className="zone-card__name">{a.zones[cardZone]}</div>
        </div>
      )}

      {notice && (
        <p style={{ position: 'absolute', top: '18%', left: 24, right: 24, textAlign: 'center' }}>
          {notice}
        </p>
      )}

      {ring.step && (
        <div className="hud__ring">
          <ProgressRing
            mode="sweep"
            tone="hud"
            size={132}
            durationMs={ring.sweepMs}
            seq={ring.seq}
            label={label}
            caption={caption}
            glow={ring.step === 'exhale'}
          />
        </div>
      )}
      {touch && <p className="hud__hint">{a.holdHint}</p>}

      <button
        type="button"
        className="game-btn hud__leave"
        aria-label={t.dive.leave}
        onClick={onLeave}
      >
        ×
      </button>
    </div>
  );
}
```

- [ ] **Step 7: Results — `mobile/src/screens/ResultsCard.tsx`**

```tsx
import { Rich, useLanguage } from '@fathom/shell/i18n';
import { CrisisRail } from '@fathom/shell/CrisisRail';
import { fill } from '@fathom/shell/strings';
import { formatDecimal, formatDuration } from '@fathom/shell/format';
import type { SessionResult } from '@fathom/game/session/sessionMachine';
import { verdictFor } from '@fathom/game/surface/verdict';
import { useAppStrings } from '../strings';

/**
 * What the dive measured, then the door. Same claims, same wording as the
 * website's surface screen; one exit, back to the title.
 */
export function ResultsCard({ result, onDone }: { result: SessionResult; onDone: () => void }) {
  const { t, language } = useLanguage();
  const a = useAppStrings();
  const s = t.surface;

  if (result.ending === 'signal-lost') {
    return (
      <div className="safe fade-in">
        <div className="sheet">
          <h1>{s.lostTitle}</h1>
          <p>{s.lostBody}</p>
          <p>{s.lostFix}</p>
          <CrisisRail />
          <div className="sheet__actions">
            <button type="button" className="game-btn game-btn--primary" onClick={onDone}>
              {a.done}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const verdict = verdictFor(result.deltaRR);
  const delta = formatDecimal(Math.abs(result.deltaRR), language, t);
  const sentence =
    verdict === 'slowed'
      ? fill(s.slowed, { delta })
      : verdict === 'sped'
        ? fill(s.sped, { delta })
        : s.unchanged;

  return (
    <div className="safe fade-in">
      <div className="sheet" role="dialog" aria-labelledby="results-title">
        <h1 id="results-title">{s.title}</h1>
        {result.ending === 'stopped' && <p>{s.stopped}</p>}
        <div className="results__figures">
          <div className="results__figure">
            <span className="results__over">{s.before}</span>
            <span className="results__num">{formatDecimal(result.baselineRR, language, t)}</span>
            <span className="results__unit">{s.unit}</span>
          </div>
          <div className="results__figure">
            <span className="results__over">{s.after}</span>
            <span className="results__num">{formatDecimal(result.finalRR, language, t)}</span>
            <span className="results__unit">{s.unit}</span>
          </div>
        </div>
        <p>
          <Rich text={sentence} />
        </p>
        <p>
          {s.duration}: {formatDuration(result.durationMs, t)}
        </p>
        <p style={{ fontSize: 13 }}>{result.usedFallbackInput ? s.noteFallback : s.note}</p>
        <p style={{ color: 'var(--hud-text)' }}>{s.exit}</p>
        <CrisisRail />
        <div className="sheet__actions">
          <button type="button" className="game-btn game-btn--primary" onClick={onDone}>
            {a.done}
          </button>
        </div>
      </div>
    </div>
  );
}
```

Check before writing: `s.unchanged` takes no placeholders and `s.slowed` / `s.sped` take `{delta}` (see `src/shell/strings/surface.ts:15-19`). If `s.unchanged` contains a `{…}` placeholder, pass the same values through `fill` as `SurfaceScreen.tsx` does.

- [ ] **Step 8: Compose it — replace `mobile/src/App.tsx`**

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { LanguageProvider, useLanguage } from '@fathom/shell/i18n';
import { fill } from '@fathom/shell/strings';
import type { SessionResult, SessionState } from '@fathom/game/session/sessionMachine';
import type { SpacebarBreathEngine } from '@fathom/game/input/spacebarEngine';
import { initialFlow, nextFlow } from './app/flow';
import type { FlowEvent, FlowState } from './app/flow';
import { loadChoices, saveChoices } from './app/storage';
import { DiveController, ZONE_FOR_STATE } from './dive/diveController';
import type { DiveInput } from './dive/diveController';
import { productionInputs } from './dive/inputs';
import { DiveHud } from './dive/DiveHud';
import type { RingView } from './dive/DiveHud';
import { OceanStage, useOcean } from './world/OceanStage';
import { SafetyGate } from './screens/SafetyGate';
import { TitleScreen } from './screens/TitleScreen';
import { PreDive } from './screens/PreDive';
import { ResultsCard } from './screens/ResultsCard';
import { useAppStrings } from './strings';
import './styles/screens.css';

/** Dev builds can drive a whole dive with the scripted fixture: add ?scripted to the URL. */
const SCRIPTED = import.meta.env.DEV && new URLSearchParams(location.search).has('scripted');
const CALIBRATION_MS = 10_000;

function Game() {
  const { t } = useLanguage();
  const a = useAppStrings();
  const scene = useOcean();
  const [flow, setFlow] = useState<FlowState>(() => initialFlow(loadChoices()));
  const send = (event: FlowEvent) => setFlow((state) => nextFlow(state, event));

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<SessionState>('idle');
  const [zone, setZone] = useState<number | null>(null);
  const [depth, setDepth] = useState(0);
  const [ring, setRing] = useState<RingView>({ step: null, sweepMs: 0, seq: 0 });
  const [touch, setTouch] = useState<SpacebarBreathEngine | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<SessionResult | null>(null);
  const timeScale = SCRIPTED ? 10 : 1;

  const controller = useMemo(
    () =>
      scene
        ? new DiveController(
            scene,
            {
              onState: (next) => {
                setState(next);
                const z = ZONE_FOR_STATE[next];
                if (next !== 'calibrating' && z !== undefined) setZone(z);
                if (next === 'calibrating') {
                  setRing((r) => ({ step: 'calibrating', sweepMs: CALIBRATION_MS / timeScale, seq: r.seq + 1 }));
                }
              },
              onPrompt: (window, sweepMs) =>
                setRing((r) => ({ step: window.step, sweepMs, seq: r.seq + 1 })),
              onResult: (finished) => {
                setResult(finished);
                setTouch(null);
                send({ type: 'surfaced' });
              },
            },
            productionInputs,
          )
        : null,
    [scene, timeScale],
  );

  // Depth is sampled, not pushed: a 60 Hz scene must not render React 60 times a second.
  const sampling = useRef<number | null>(null);
  useEffect(() => {
    if (flow.screen !== 'dive' || !scene) return;
    sampling.current = window.setInterval(() => setDepth(scene.depth), 100);
    return () => {
      if (sampling.current !== null) clearInterval(sampling.current);
    };
  }, [flow.screen, scene]);

  const begin = async () => {
    if (!controller) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    setZone(null);
    setDepth(0);
    setRing({ step: null, sweepMs: 0, seq: 0 });
    const input: DiveInput = SCRIPTED ? 'scripted' : flow.input;
    try {
      // Called directly from the tap so the microphone opens inside the gesture.
      const started = await controller.start({ plan: flow.plan, input, timeScale });
      if (!started) return;
      setTouch(controller.touch);
      if (started.fellBack) setNotice(a.micFellBack);
      send({ type: 'begin' });
    } catch (e) {
      setError(fill(t.setup.startError, { reason: e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusy(false);
    }
  };

  const done = () => {
    setResult(null);
    scene?.reset();
    // The scene stops itself after settling; the title wants the water moving.
    scene?.start();
    send({ type: 'done' });
  };

  switch (flow.screen) {
    case 'safety':
      return (
        <SafetyGate
          onAcknowledge={(input) => {
            saveChoices({ acknowledged: true, input });
            send({ type: 'acknowledge', input });
          }}
        />
      );
    case 'title':
      return <TitleScreen onChoose={(plan) => send({ type: 'choose-dive', plan })} />;
    case 'predive':
      return (
        <PreDive
          plan={flow.plan}
          busy={busy || !controller}
          error={error}
          onBegin={() => void begin()}
          onBack={() => send({ type: 'back' })}
        />
      );
    case 'dive':
      return (
        <DiveHud
          state={state}
          zone={zone}
          depth={depth}
          ring={ring}
          touch={touch}
          notice={notice}
          onLeave={() => controller?.stop()}
        />
      );
    case 'results':
      return result ? <ResultsCard result={result} onDone={done} /> : null;
  }
}

export default function App() {
  return (
    <LanguageProvider>
      <OceanStage>
        <Game />
      </OceanStage>
    </LanguageProvider>
  );
}
```

Check before writing: `t.setup.startError` exists with a `{reason}` placeholder (`DiveView.tsx` uses it that way). `DiveScene.start()` is public and restarts the loop after it has stopped itself (it returns early only while a frame is pending).

- [ ] **Step 9: Typecheck, test, build**

```bash
cd /Users/fl/Desktop/fathom && npm run typecheck -w mobile && npm test -w mobile && npm run build -w mobile && npx oxlint
```

Expected: no errors; all tests pass; build succeeds.

- [ ] **Step 10: Drive it in the browser first (fast loop)**

```bash
cd /Users/fl/Desktop/fathom && npm run dev -w mobile
```

In the Playwright browser at 393×852 (iPhone size), open `http://localhost:5173/?scripted`: acknowledge the scope → Quick dive → Begin. Screenshot the title, the dive at ~3 s and ~8 s (zone card, depth rising, waterline gone), and the results. Then Done → title, Quick dive again → the second dive starts at the surface. Fix anything broken before touching the simulator.

- [ ] **Step 11: Commit**

```bash
git add mobile/src
git commit -m "Add the app's screens: scope, title, pre-dive, dive HUD and results"
```

---

### Task 10: On the Simulator, end to end

**Files:** none new, unless fixes are needed.

- [ ] **Step 1: Build, sync, launch**

```bash
cd /Users/fl/Desktop/fathom && npm run ios -w mobile
```

Expected: the app launches on the iPhone 18 Pro simulator to the safety sheet over the moving ocean, full screen, no status bar.

- [ ] **Step 2: Walk the touch path**

On the simulator: choose **Touch and hold** → continue → **Quick dive** → **Begin**. Hold the mouse button on the screen for ~5 s at each "Breathe out". Screenshot (`xcrun simctl io B18E46D7-6BC1-40C9-8CB1-6C9336B91DB0 screenshot <file>`) at: title, calibration, mid-dive (zone card), results. Look at each: the ocean must fill the screen edge to edge; the HUD must clear the Dynamic Island; the results sheet must scroll if taller than the screen. Results must name no microphone claim for a touch dive (`noteFallback` text).

- [ ] **Step 3: Walk the microphone path**

Relaunch (`xcrun simctl terminate … com.colejasink.fathom` then launch), reset privacy so the prompt shows: `xcrun simctl privacy B18E46D7-6BC1-40C9-8CB1-6C9336B91DB0 reset microphone com.colejasink.fathom`. Settings in the app aren't built yet, so clear saved choices by uninstalling: `xcrun simctl uninstall B18E46D7-6BC1-40C9-8CB1-6C9336B91DB0 com.colejasink.fathom`, then `npm run ios -w mobile` again. Choose **Use the microphone** → Quick dive → Begin. Expected: the iOS microphone prompt with the exact usage string. Allow it, breathe out audibly at the Mac's mic and confirm depth rises. Then repeat with **Don't Allow** (after another privacy reset): expected the dive continues on touch with the "microphone was unavailable" notice.

If the microphone path fails inside the web view (no prompt, or `getUserMedia` undefined, or the worklet fails to load): capture the Safari Web Inspector console (Safari → Develop → Simulator → Fathom) and stop — record it as a finding for Plan 2, which owns the native audio session. Do not hack around it here.

- [ ] **Step 4: Leaving early and the second dive**

Start a dive, tap ×, confirm the results card shows the left-early sentence, tap Done, start another dive: it must begin at the surface with the waterline visible.

- [ ] **Step 5: Final checks and commit**

```bash
cd /Users/fl/Desktop/fathom && node --import ./src/game/testing/resolve.mjs src/game/testing/run.ts && npm test -w mobile && npx tsc -b && npm run typecheck -w mobile && npx oxlint && npm run build
```

Expected: everything green, and the website still builds.

```bash
git add -A mobile src
git commit -m "Fix issues found running the foundation build on the simulator"
```

(Skip the commit if nothing changed.)
