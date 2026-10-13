#!/bin/sh
# Build the iOS app and launch it on a simulator.
#
# Not `cap run ios`: that builds into ios/DerivedData inside the repo, and this
# repo lives on an iCloud-synced Desktop. iCloud tags files there with Finder
# metadata, and codesign refuses a bundle carrying it ("resource fork, Finder
# information, or similar detritus not allowed"). Building outside the synced
# folder avoids it.
set -eu

SIM="${SIM:-B18E46D7-6BC1-40C9-8CB1-6C9336B91DB0}"
DERIVED="$HOME/Library/Developer/Xcode/DerivedData/fathom-mobile"
APP="$DERIVED/Build/Products/Debug-iphonesimulator/App.app"
cd "$(dirname "$0")/.."

xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
  -destination "id=$SIM" -derivedDataPath "$DERIVED" -quiet build
xcrun simctl boot "$SIM" 2>/dev/null || true
xcrun simctl install "$SIM" "$APP"
xcrun simctl launch "$SIM" com.colejasink.fathom
