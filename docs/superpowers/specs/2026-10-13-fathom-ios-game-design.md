# Fathom for iOS — design

Date: 2026-10-13
Status: approved in conversation, awaiting written-spec review

## Intent

Turn Fathom from a website into a real iPhone game, shipped through the App
Store, that makes you feel like you are actually diving. Keep the existing art
style and theme (bioluminescent ocean, the diver, twilight / midnight / abyss)
and the breath-as-controller mechanic. It must not read as a website anywhere:
no scrolling pages, no links, no hover, no text walls — touch, motion, sound.

What stays non-negotiable from the original product:

- The breath engine is the controller: double inhale lights the dive light, a
  long slow exhale descends. Depth comes from `src/game/scene/descent.ts`
  unchanged — longer beats shorter, slower beats faster, holding does nothing.
- Difficulty may only ever slow breathing targets.
- Not therapy, not diagnosis, not for crisis. Claims stay "trains arousal
  regulation, measured live". Crisis lines (988 US · 9-8-8 Canada ·
  findahelpline.com) stay on the results screen.
- Nothing leaves the device. No account, no server, no analytics.
- Each session ends and sends you away. No streaks, no notifications, no
  "dive again" prompt.

Project context: Fathom is now a personal project. The hackathon lane rules in
DEVELOPMENT.md no longer apply; shared code under `src/` may be changed where
that keeps the website and app in sync.

## Decisions

| Question | Decision |
|---|---|
| Goal | Ship to the App Store |
| Progression | Discovery journal; no streaks, ranks, totals or nagging |
| Immersion | Sound design, haptics, camera & depth (no tilt control) |
| Approach | Capacitor native shell around the existing TS engine and Pixi art, plus Swift plugins where native matters |
| Location | `fathom/mobile/` in this repo, importing from `fathom/src` |

Rejected: a SwiftUI + SpriteKit rewrite (re-ports the tuned, tested detector
and all art — weeks of work and real risk to detection quality); native Swift
mic capture (two detectors to keep in sync; revisit only if the WKWebView mic
path fails on hardware).

## 1. App shape and screen flow

One continuous world: the ocean is always on screen and every menu floats over
it.

1. **Launch** — native launch screen fades into the title.
2. **Onboarding (first run only)** — three swipeable cards over the water:
   how to breathe (animated demo), why the mic (then the iOS permission
   prompt, or choose touch input), and the safety scope (not therapy /
   diagnosis / crisis + the "take care" points). Stored once; reachable again
   from Settings. A one-line scope note stays on the title screen so it is
   never fully out of view.
3. **Title** — water surface at dawn, FATHOM wordmark, the diver sitting on
   the tube of a small inflatable dive boat (added 2026-10-16). Begin plays a
   ~3 s backward roll off the boat into the water before calibration starts;
   nothing is measured during it, and Reduce Motion replaces it with a fade.
   Actions: **Dive** (full, ~5 min), **Quick dive** (90 s), **Journal**.
   Gear icon → **Settings**: language (EN/FR), sound, haptics, input
   (mic / touch), safety, research.
4. **Pre-dive** — "headphones recommended for the full soundscape", then
   calibration presented as the diver breathing at the surface before going
   under.
5. **Dive** — full screen, no chrome. HUD: depth gauge, breath prompt ring,
   zone title cards.
6. **Surfacing** — camera rises back through the zones to the light, then a
   results card: breathing rate before → after (from the existing session
   result, worded as today's surface screen words it), creatures discovered
   this dive with a "new" badge, crisis lines.
7. **Done** — returns to the title. No dive-again prompt.

Removed: web top nav, tab bar, scrolling reading pages, file download. The
dive log exports through the native share sheet.

## 2. The dive

### Camera & depth

- A continuous water column. The camera follows the diver down through the
  zones instead of crossfading between them. Surface light shrinks overhead,
  god rays fade by midnight, water darkens along the existing palette.
- Marine snow streams upward past the diver while descending — the primary
  falling cue.
- 4–5 parallax layers: near particles, mid creatures, far silhouettes/ridges,
  background haze.
- Exhale is propulsion: the diver kicks and glides; the camera surges gently
  and settles. Respect the existing motion brief: no lurching, strobing or
  flashes.
- Inhale is light: the double inhale widens a soft light cone; as it decays
  the world closes in. The light is the main way creatures are revealed.
- Pressure: deeper zones add vignette, slight edge distortion and muted
  colour. In the abyss only what the light touches is visible.
- HUD: thin depth gauge on the right edge, breath ring near the bottom
  (*in-in* / *out*), zone title card on entry ("TWILIGHT · 200 m").

### Sound (Web Audio, under a native audio session)

- Surface: waves and wind. Going under applies a low-pass filter that closes
  with depth.
- Zone beds: twilight airy, midnight with distant whale song, abyss a deep hum
  with rare clicks.
- Breath voice: bubble stream on exhale, soft rise on the double inhale.
- Discoveries: a soft sonar ping or chime.
- **Mic safety:** on the speaker route, the mix ducks to near-silence while an
  exhale is in its scoring window, so playback cannot read as an exhale. The
  detector already high-passes below 100 Hz and wants broadband energy above
  1 kHz. On headphones the full mix plays. The native audio-session plugin
  reports the current route.

### Haptics (Core Haptics)

- Continuous soft rumble during an exhale, intensity following smoothness.
- Two light taps on the *in-in* prompt, so the rhythm can be followed eyes
  closed.
- A deep thud on crossing into a zone; a delicate tick on a discovery.
- Calm only: no error buzzes, no slot-machine rewards.

## 3. Discovery journal

### Catalogue (~18 entries, existing silhouette + glow style)

- Twilight: lanternfish shoal, moon jelly, hatchetfish, manta ray,
  siphonophore chain, glass squid.
- Midnight: sperm whale (passing far off), vampire squid, comb jelly, giant
  isopod, firefly squid swarm, barreleye.
- Abyss: anglerfish, whale fall, hydrothermal vent, sea pig, dumbo octopus,
  tripod fish.

Each entry has: id, zone, depth band within the zone, rarity, art, a two-line
real fact (EN + FR).

### Rules

- Each dive rolls a seeded set of possible encounters placed at depths in each
  zone's column. The set is fixed at dive start and does not grow with dive
  length or session count.
- An encounter is discovered when the diver passes it with the dive light lit
  (double inhale done) and is mid-exhale or just finished one.
- Rarer entries sit deeper in a zone, reached only by slower, longer exhales
  through the existing descent model.
- Never rewarded: breath-holds, fast breathing, extra dives.
- Pacing target: 3–5 entries on a first dive; a full journal in roughly 8–12
  dives.

### Journal screen

- A field notebook on dark paper; one page per zone with "???" silhouettes and
  depth markers for undiscovered entries.
- Tap a discovered entry → card with animated glowing art, the fact, the depth
  where first found, and the date.
- A "Dive logbook" tab lists past dives: date, length, before → after
  breathing rate. Personal history only — no totals, ranks, bests or
  comparisons.

### Storage (device only, Capacitor Preferences)

- Discovered entries with date and depth.
- Past dive summaries.
- Settings and the onboarding-complete flag.

## 4. Native app and App Store

- Capacitor 8 (Swift Package Manager), Xcode project at `mobile/ios/`.
- Plugins: `@capacitor/haptics`, `@capacitor/status-bar` (hidden in dive),
  `@capacitor/splash-screen`, `@capacitor/preferences`, `@capacitor/share`.
- Custom Swift plugins:
  - `FathomAudioSession` — `.playAndRecord`, default to speaker, voice
    processing off (echo cancellation / noise suppression would erase breath,
    matching the web build's constraints), emits headphone route changes.
  - `FathomHaptics` — Core Haptics continuous player with live intensity for
    the exhale rumble, plus the transient patterns.
- Portrait, iPhone only for v1. Fully offline; everything bundled.
- App Store checklist:
  - App icon (brand mark on deep water), all sizes; native launch screen.
  - `NSMicrophoneUsageDescription`: "Fathom listens to the sound of your
    breath out to guide the dive. Audio is processed on your iPhone and never
    recorded or sent anywhere."
  - Privacy label "Data Not Collected"; `PrivacyInfo.xcprivacy` declaring the
    UserDefaults required-reason API.
  - Store copy uses the existing claims language. Age rating 4+, Health &
    Fitness.
- Needs from the owner: Apple Developer Program membership (this Mac has no
  signing identities today), a bundle ID (suggest `com.<name>.fathom`), store
  listing approval. Screenshots generated from the simulator.

## 5. Code structure

```
mobile/
  package.json, vite.config.ts, capacitor.config.ts, tsconfig.json
  index.html                      full-screen, no scroll, safe-area aware
  ios/                            Capacitor Xcode project + Swift plugins
  src/
    main.tsx, App.tsx             screen state machine
    native/                       typed plugin bridges with web no-op fallbacks
    world/                        ocean, water column, parallax, camera, creatures
    dive/                         HUD; session + conductor + breath engine wiring
    sound/                        soundscape, filters, ducking
    haptics/                      patterns driven by breath/dive events
    journal/                      catalogue, discovery rules, persistence, screens
    screens/                      title, onboarding, settings, results, journal UI
    strings/                      EN/FR for new text
```

- Reused from `fathom/src` through a `@fathom/*` alias: breath engine +
  AudioWorklet, conductor, session machine, `descent.ts`, palette, diver and
  zone art, safety/claims strings. Where they need extending (camera and
  parallax hooks on the Pixi renderer, live depth from the session), change
  them in `src/` so the website stays in sync.
- Touch fallback: press-and-hold anywhere = exhale, using
  `SpacebarBreathEngine` logic with touch events.
- The screen state machine enforces: no dive without the safety
  acknowledgement and an input choice; results exit only to the title.

## 6. Testing

- Existing runner keeps covering respiration rate, descent and conductor.
- New unit tests:
  - Discovery: breath-hold discovers nothing; fast breathing cannot reach deep
    entries; encounter set does not grow with dive length; progress survives
    reload.
  - Sound: speaker route ducks during the exhale scoring window; headphone
    route does not.
  - Screen machine: gates and the single exit hold.
- Running the app: the scripted breath engine drives full dives in the iOS
  Simulator (dev-only hidden menu), with screenshots at each stage.
- Hardware-only checks: mic path in WKWebView and haptics need a real iPhone —
  developer account, or a free Apple ID's 7-day sideload as an interim.

## 7. Build order

Each step ends with a build that runs in the simulator.

1. Shell and native setup (Capacitor project, full-screen page, plugins wired
   with web fallbacks).
2. World and camera (continuous column, parallax, marine snow, pressure).
3. Dive wired to breath (session, conductor, HUD, touch fallback).
4. Sound.
5. Haptics.
6. Journal (catalogue, rules, persistence, screens).
7. Screens and polish (title, onboarding, settings, surfacing, results).
8. App Store assets (icon, launch screen, privacy manifest, copy,
   screenshots).

## Risks

- **Speaker playback leaking into the mic.** Mitigated by ducking during the
  exhale window and by keeping beds out of the detector's bands; verify on
  hardware with the debug page's live features.
- **WKWebView AudioWorklet / getUserMedia behaviour** differs from Safari in
  small ways (permissions, sample rate). Verify early in step 3 on hardware;
  the native-mic hybrid is the fallback.
- **App Review guideline 4.2 (minimum functionality).** Addressed by being a
  native-feeling game with native audio session, Core Haptics, share sheet
  and offline storage rather than a wrapped site.
