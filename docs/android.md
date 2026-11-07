# Android APK

Besides the installable web app (PWA), n8n Mobile ships as a normal Android app (APK) you can sideload.

**The APK talks to n8n directly** using Android's own networking, so you do **not** need `server.js`, Docker or any CORS setup. Just install it, enter your n8n URL and API key.

## Install

1. On your phone, open the [latest release](https://github.com/0XZEROX0/n8n-app/releases/latest) and download `n8n-mobile-<version>.apk`.
2. Open the file. Android will ask you to allow installs from your browser or Files app: allow it once.
3. Open **n8n Mobile**, enter `https://your-n8n-domain` and your API key (n8n → Settings → n8n API).

Your n8n must be reachable from the phone over **HTTPS** (Android blocks plain `http://` by default).

## How it is built

The app is wrapped with [Capacitor](https://capacitorjs.com/):

- `capacitor.config.json` points Capacitor at `public/` and turns on `CapacitorHttp`, which routes `fetch` through native HTTP (no CORS).
- `android/` is the generated Android Studio project. Icons and splash screens come from `assets/` (regenerate with `npm run android:assets`).
- `.github/workflows/android.yml` builds the APK on every push and pull request (download it from the run's *Artifacts*), and when a release is **published** it attaches the APK to that release.

To attach an APK to a release that already exists, open **Actions → Android APK → Run workflow** and type the tag (e.g. `v0.1.0`).

## Signing key (recommended)

Android only installs an update over an existing app if both are signed with the same key. Without your own key, CI signs each build with a throwaway debug key, so to update you'd have to uninstall first.

Create a key once (keep the file and passwords safe, you can't recover them):

```bash
keytool -genkeypair -v -keystore n8n-mobile.jks -alias n8n-mobile \
  -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 n8n-mobile.jks > n8n-mobile.jks.b64    # macOS: base64 -i n8n-mobile.jks
```

Then in GitHub → **Settings → Secrets and variables → Actions**, add:

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | contents of `n8n-mobile.jks.b64` |
| `ANDROID_KEYSTORE_PASSWORD` | the keystore password |
| `ANDROID_KEY_ALIAS` | `n8n-mobile` |
| `ANDROID_KEY_PASSWORD` | the key password (same as keystore password if you didn't set one) |

The first APK signed with your key needs one uninstall of any debug-signed version; after that, updates install over the top.

## Build locally

Needs Node 22, JDK 21 and the Android SDK (or Android Studio).

```bash
npm ci
npx cap sync android
cd android && ./gradlew assembleRelease
# APK: android/app/build/outputs/apk/release/app-release.apk
```

Or open the project in Android Studio with `npx cap open android`.
