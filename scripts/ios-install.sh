#!/bin/bash
# Build hum. and install it on the iPhone. Works over Wi-Fi once the phone has
# been paired with this Mac by cable once (see ios/DEVICE-INSTALL.md).
set -euo pipefail

DEVICE="${HUM_DEVICE:-E074194E-20D2-5098-94C7-999CC766A7F5}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/ios/App/build-device/Build/Products/Debug-iphoneos/App.app"

cd "$ROOT"
npm run ios

cd ios/App
xcodebuild -project App.xcodeproj -scheme App \
  -destination "id=$DEVICE" \
  -allowProvisioningUpdates -derivedDataPath ./build-device build

xcrun devicectl device install app --device "$DEVICE" "$APP"
xcrun devicectl device launch --device "$DEVICE" net.aviwise.hum
