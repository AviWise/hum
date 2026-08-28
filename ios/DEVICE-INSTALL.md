# Putting hum. on a real iPhone

**TestFlight is only needed to reach other people's phones.** With Xcode and a
paid Apple developer account, installing to your own device needs no TestFlight,
no App Store review, and no workaround for an expired distribution profile.
Treating TestFlight as the blocker cost time on 2026-08-28.

Phone plugged in and unlocked, then:

```bash
xcrun devicectl list devices          # confirm State = connected
```

```bash
cd ~/dc-hotspots && npm run ios       # vite build --base=/ + cap sync
```

```bash
cd ios/App && xcodebuild -project App.xcodeproj -scheme App \
  -destination 'id=E074194E-20D2-5098-94C7-999CC766A7F5' \
  -allowProvisioningUpdates -derivedDataPath ./build-device build
```

```bash
xcrun devicectl device install app --device E074194E-20D2-5098-94C7-999CC766A7F5 \
  ios/App/build-device/Build/Products/Debug-iphoneos/App.app
```

```bash
xcrun devicectl device launch --device E074194E-20D2-5098-94C7-999CC766A7F5 net.aviwise.hum
```

## Notes

- Device id above is Avi's iPhone 16. `xcrun devicectl list devices` gives you
  any other.
- Signing is already `Automatic` against team `4MTZKJ982P`, bundle
  `net.aviwise.hum`. `-allowProvisioningUpdates` mints the profile with no
  developer-dashboard work.
- **No "Untrusted Developer" prompt** — a paid account signs with a real
  development certificate, unlike a free personal team.
- The first device build is slow: Capacitor resolves its Swift packages into a
  clean derived-data path. Later builds are quick.
- A development build **stops launching when its provisioning profile lapses**
  (~a year) and has to be re-installed. This is the same class of thing that
  bit `briefed-ios`.

## What does not work in the native shell

- **Google sign-in** — needs the `capacitor://localhost` redirect, unbuilt.
  Email/password is fine: a direct API call with no redirect.
- **Push** — iOS does not speak web push; this needs APNs.

Both also gate TestFlight, so they are the two things standing between here and
distributing to anyone else.

## For students, use the PWA instead

No cable, no trust prompt, no profile expiry, no invite limit:
<https://aviwise.github.io/hum/> → Share → Add to Home Screen.
