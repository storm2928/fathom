# Fathom — getting it onto a phone and into the App Store

What is already done in the repo, and the steps that need your Apple account.

## Done in the repo

- iOS project (`mobile/ios/`), portrait, iPhone only, status bar hidden.
- App icon (`docs/app-store/icon.svg` → `AppIcon-512@2x.png`, 1024 px, no
  alpha) and a launch screen in the app's own background colour.
- Microphone usage string; `ITSAppUsesNonExemptEncryption = NO` (no
  export-compliance questions); `UIRequiredDeviceCapabilities = arm64`.
- Apple Health: `App.entitlements` (HealthKit), `NSHealthUpdateUsageDescription`.
  With automatic signing Xcode enables HealthKit on the App ID; if it asks,
  confirm the HealthKit capability under Signing & Capabilities.
- Privacy policy in the app (Settings → Privacy policy) and as
  `public/privacy.html`; support page `public/support.html`.
- `PrivacyInfo.xcprivacy`: no tracking, no collected data; UserDefaults
  (CA92.1) and file timestamps (C617.1) declared.
- Store copy, privacy answers and review notes: `docs/app-store/listing.md`.
- Screenshots: `docs/app-store/screenshots/`.

## 1. Run it on your own iPhone (free, 7 days per install)

1. Xcode → Settings → Accounts → add your Apple ID.
2. Open `mobile/ios/App/App.xcodeproj`. Select the **App** target → Signing &
   Capabilities → tick *Automatically manage signing* → Team: your Personal
   Team.
3. If the bundle ID `com.colejasink.fathom` is taken, change it (also in
   `mobile/capacitor.config.ts`, then `npm run sync -w mobile`).
4. Plug in the iPhone, trust the computer, enable Developer Mode on the phone
   (Settings → Privacy & Security → Developer Mode).
5. Pick the phone as the run destination and press Run.

Things to check on the phone that the simulator cannot show:
- The microphone path in a quiet room, then with background noise.
- Haptics (the simulator has no Taptic Engine).
- **Microphone hint:** start a mic dive and stay silent for two prompted
  breaths out — "Not hearing your breath out…" should appear above the ring,
  and go as soon as you breathe out.
- **Apple Health:** Settings → Apple Health → allow; take a Quick dive; check
  Health → Mindfulness for a 90 s session. Then decline access on a fresh
  install and confirm the switch stays off with a note.
- **Large text:** iOS Settings → Accessibility → Display & Text Size → Larger
  Text, at the largest size; settings, onboarding and journal should still fit.
- **Speaker vs headphones:** with the phone speaker, the soundscape goes quiet
  while a breath out can be scored. Confirm a breath is still detected with
  the soundscape playing, and that the exhale rumble (touch dives only) feels
  right.

## 2. App Store (needs the Apple Developer Program, $99/year)

1. Enrol at developer.apple.com/programs.
2. In App Store Connect, create the app with the bundle ID.
3. Fill in the listing from `listing.md`, upload screenshots, set the privacy
   answers ("Data Not Collected"), add privacy policy and support URLs.
4. In Xcode: set the version (1.0) and build number, choose *Any iOS Device*,
   Product → Archive → Distribute App → App Store Connect → Upload.
5. In App Store Connect → TestFlight, install the build on your phone and run
   a few full dives.
6. Submit for review with the review notes from `listing.md`.

## Build commands

```bash
. ~/.nvm/nvm.sh && nvm use 24     # Node 24
npm run ios -w mobile             # build, sync, run on the simulator
npm run ios:autoplay -w mobile    # unattended scripted playthrough (never for release)
npm test -w mobile && npm run test:dsp -w mobile && npm run test:sound -w mobile
```

The autoplay switch is refused by any web build that is not `--mode
simulator`; `ios:autoplay` restores the normal bundle into the iOS project when
it finishes; and an Xcode build phase ("Refuse autoplay") fails any Release
build whose bundled web app still carries the autoplay marker. Before
archiving, run `npm run sync -w mobile` anyway.
