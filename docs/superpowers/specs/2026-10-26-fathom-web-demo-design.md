# Fathom web demo: the app, on a desktop screen

Date: 2026-10-26 · Base branch: `ios-foundation`

## Why

The iOS app (`mobile/`, on `ios-foundation`) is what Fathom is meant to be: a
game you play with your breath. The current website (`src/App.tsx` and the
`src/shell/` pages on `main`) reads like a report. The app can't be published
yet, but the team needs something people can open from a link so they can run
surveys and playtests. Feedback is collected separately (a Google Form). The
demo doesn't collect anything.

So the website becomes the app: same screens, same order, same look, same game
feel, laid out for a desktop browser. Stylistic changes may come after this
lands. This pass is about parity, not new design.

## Goals

- Opening the site's URL drops you into the app's flow: title screen (boat on
  the water), first-run onboarding (breathe to dive, input choice, safety
  scope), pre-dive, the dive, results, journal, settings, privacy.
- The ocean fills the whole browser window at any desktop size (tested at
  1280×720, 1440×900, 1920×1080). Overlays are sized for a big screen, not
  stretched to its width.
- The app's sound plays in the browser: ocean bed, per-zone generated music,
  the exhale swell, the inhale swell, the splash and the discovery ping.
- Microphone play works in desktop Chrome, Edge, Firefox and Safari, with
  the hold input as the fallback.
- It deploys from this repo to Render as a static site, same as today.

## Non-goals

- New visual design, new screens, new copy (beyond the device-wording
  variants below). The app is the spec.
- Anything that collects data: no analytics, no survey embed, no accounts.
  The "nothing stored server-side" rule stands.
- Haptics, Apple Health, the iOS share sheet. They already no-op in a browser,
  and the settings that only make sense on iPhone stay hidden.
- Phone browsers. If a phone opens the link it gets the app's own
  portrait layout, which already works. No extra effort goes there.

## Anti-goals (it fails even if it technically works)

- It still feels like a web page: scrolling, hover-underline links, a
  centred document column, a site nav.
- The game's own sound gets picked up as breath on laptop speakers.
- It claims anything the app doesn't. The claims and safety rules in
  `DEVELOPMENT.md` apply unchanged (crisis line on results, scope at onboarding,
  inhale is rhythm-prompted).

## What exists, and what's missing

`mobile/` is a Vite + React app that imports the website's engine, scene and
strings through the `@fathom/*` alias (`../src`). It already runs in a desktop
browser with `npm run dev -w mobile`. It falls back to the web AudioWorklet
breath engine (`src/breath/`) when not native (`mobile/src/dive/inputs.ts`),
and stores state in localStorage when not native (`mobile/src/main.tsx`,
`mobile/src/app/storage.ts`). The Pixi scene already composes well on a wide
canvas.

Missing in a browser:

1. **Layout.** Overlay CSS (`mobile/src/styles/*.css`, `onboarding.css`,
   `results.css`, `journal.css`) assumes a ~400px-wide portrait screen. On
   desktop, paragraphs run edge to edge, buttons are ~1,400px wide, and the HUD
   (leave/settings buttons, depth readout, depth gauge, breath ring) is
   phone-sized in the corners of a huge canvas.
2. **Sound.** Every sound is synthesized natively in Swift
   (`mobile/ios/App/App/Soundscape.swift`, `AmbientMusic.swift`,
   `FathomSoundPlugin.swift`). In a browser `useSoundscape` does nothing.
3. **Input wording and controls.** "Touch and hold" is phone language. On
   desktop it should be hold Space or hold the mouse button. Both already
   work: `SpacebarBreathEngine` handles Space and `DiveHud` handles pointer
   holds, mouse included. Only the wording is missing.
4. **Deployment.** `render.yaml` builds the root website (`npm run build` →
   `./dist`), not `mobile/`.

## Decisions

### Layout: the app's layout, scaled for a large screen (builder's call on exact numbers)

- The ocean canvas stays full-bleed. No letterboxing, no phone frame.
- Text-heavy overlays (onboarding steps, pre-dive, safety scope, settings,
  privacy, results card, journal) sit in a centered column with a max width
  (on the order of 480 to 640px) over the ocean, in the same vertical
  position as on the phone: the content block near the bottom, the primary
  button under it. Buttons take the column's width, not the window's.
- The HUD scales up with the viewport so it reads at desktop distance: corner
  buttons, depth readout, depth gauge, zone title card, breath ring. Use a
  single scale (a CSS custom property driven by a clamp() on the viewport) so
  proportions match the phone. The breath ring stays bottom-center.
- Applied by a desktop media query (wide **and** a fine pointer, or
  aspect wider than ~4:3), layered on the existing CSS. The phone layout must
  not change. The iOS build ships from the same files.
- No scrolling except inside sheets that are taller than the window, as on the
  phone.

### Sound: port the native synth to Web Audio

- Port `Soundscape.swift` and `AmbientMusic.swift` to an AudioWorklet
  (`mobile/src/sound/web/`), same arithmetic, same parameters
  (`SoundMixParams`). The mix is already decided in TypeScript
  (`soundDirector.ts`/`mixFor`), so the worklet only plays it. One-shots
  (inhale swell, splash, ping) come over too.
- `useSoundscape` and `playInhale/playPing/playSplash` pick native or web
  behind the same interface. No changes to `soundDirector`.
- **The no-feedback rule carries over.** A browser can't tell whether
  headphones are plugged in, so on the web `headphones` is always `false`.
  That means `highCut` (the steep 500 Hz low-pass on the whole output) is
  always on during a microphone dive. Checked: the web worklet
  (`public/breath-processor.js`, `VOICE_HIGH_SPLIT_HZ = 1000`) splits at 1 kHz
  like `BreathFrameProcessor.swift`, with echo cancellation and noise
  suppression off. So the 500 Hz cut protects the web detector the same way.
- Browsers block audio until a user gesture. Start the AudioContext on the
  first click or keypress (title screen buttons count). Never block the flow
  waiting for audio.
- Volume follows the app's existing volume setting.
- `mobile/scripts/sound-check` measures the Swift render offline. A parity
  check against the Swift output is nice to have, not required. The ear test
  is: it sounds like the app.

### Input on desktop

- Microphone stays the default choice, exactly as in the app.
- The second choice is labeled for desktop ("Hold to breathe out: hold
  Space, or hold the mouse button") on a fine-pointer device, and keeps the
  "Touch and hold" wording on touch devices. EN and FR strings both.
- If the microphone is refused, fall back the way the app already does.

### Device-specific wording (user decision)

Text that's only true on an iPhone gets a web version, EN and FR. Everything
else stays word for word. Known cases, all in `mobile/src/strings.ts` unless
noted:

- Touch language: the second input choice, `useTouchHint`, `holdHint`,
  `micFellBack`, `lostFixMic`, `lostFixTouch`, `micDeclined`. Web wording:
  hold Space or hold the mouse button. Touch devices keep the current text.
- `micUnheard` ("Bring the phone a little closer") becomes the computer or
  microphone equivalent.
- **Privacy policy** (`mobile/src/privacy/policy.ts`): a web variant that's
  true for the browser. Data lives in this browser's storage, clearing site
  data deletes it, the dive log downloads as a file, no Apple Health section,
  no iOS share sheet. The settings path names the web label. `public/privacy.html`
  (the public page that backs the App Store listing) stays the iOS policy.
  Adjust `policy.test.ts` so the iOS variant keeps its existing checks and
  the web variant gets equivalent ones (no "iPhone", no Health).
- Sweep `strings.ts`, `policy.ts` and `creatureStrings.ts` for any other
  "iPhone", "phone", "touch", "finger", "screen" or "app" wording and handle
  it the same way.

Pick the variant once at startup (native vs browser, and fine vs coarse
pointer for touch wording). Don't scatter checks through components.

### Settings shown on the web

- Shown: volume, language, re-read the intro, privacy.
- Hidden on the web: haptics and Apple Health. Health is already gated on
  availability. The haptics toggle in `SettingsSheet.tsx` is not gated yet;
  gate it on `Capacitor.isNativePlatform()`.

### What happens to the current website

- The root URL serves the app build. The old website entry
  (`index.html` → `src/main.tsx` → `src/App.tsx`) and the shell pages only it
  uses (Research, How It Works, SafetyScreen, the router, their CSS and
  strings) are removed. Anything `mobile/` imports through `@fathom/*` stays.
  Before deleting a file, confirm nothing under `mobile/src` reaches it.
- `public/privacy.html` and `public/support.html` stay as public pages.
- The README's links and "how to run" sections are updated to match.

### Build and deploy

- `render.yaml` builds the app workspace and publishes its `dist`. The
  security headers stay, especially `Permissions-Policy: microphone=(self)`.
  HTTPS is required for the mic, and Render provides it.
- Page `<title>`, favicon (from `docs/app-store/icon.svg`), meta description
  and `theme-color` are set for the web in `mobile/index.html`. Remove
  `user-scalable=no` / `maximum-scale=1` on desktop if they don't matter there.
  They're accessibility-hostile but the phone build wants them, so
  builder's call how to split.
- `npm run dev` at the root keeps working and runs the app.

### Branch

Work on a new branch `web-demo` cut from `ios-foundation`. Merging it into
`main`, and so going live on Render, is the user's call when it's done.

The hackathon's lane, issue and two-person sign-off rules in `DEVELOPMENT.md`
don't gate this work (user decision, 2026-10-26). The user handles
coordination with the team. The claims and safety rules still apply in full.
No commit trailers.

## Left to the builder

- Exact breakpoints, column widths and HUD scale curve.
- Exact wording of the web variants, kept as close to the app's text as
  possible.
- File layout of the Web Audio port.
- How to verify sound parity (by ear, or by rendering both offline).

## Done means

- `npm run build` and `npx tsc -p mobile/tsconfig.json` pass, and the mobile
  test suite (`npm test -w mobile`) passes.
- A full dive (scripted, `?scripted` in dev) and a full quick dive play through
  on desktop Chrome at 1440×900 and 1920×1080. Screenshots of title,
  onboarding, dive, results and journal show column-sized overlays and a
  readable HUD.
- A microphone dive works in a real desktop browser (user-tested).
- Sound plays after the first click, follows depth and zone, and
  the microphone dive isn't triggered by the game's own sound on laptop
  speakers (user-tested).
- The iPhone layout is unchanged: screenshots at 430×932 match the App Store
  screenshots' layout.
