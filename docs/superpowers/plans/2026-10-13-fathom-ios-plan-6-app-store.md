# Fathom iOS — Plan 6: App Store Readiness

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans.

**Goal:** Everything the App Store needs that can be prepared without the owner's Apple Developer account.

1. App icon: `docs/app-store/icon.svg` rendered to the 1024 px `AppIcon-512@2x.png` (opaque, readable at 29 px).
2. Launch screen: solid `#030811`, the app's own first frame, so launch never flashes.
3. Info.plist: `UIRequiredDeviceCapabilities = arm64` (was the template's `armv7`); `ITSAppUsesNonExemptEncryption = NO`.
4. `PrivacyInfo.xcprivacy` bundled: no tracking, no collected data; UserDefaults (CA92.1) and file timestamps (C617.1) declared.
5. Store copy, privacy answers and review notes: `docs/app-store/listing.md`.
6. Screenshots at 6.9" (1320 × 2868): `docs/app-store/screenshots/`.
7. Owner steps (signing, device run, TestFlight, submission): `docs/app-store/release.md`.
