# Android APK

Besides the installable web app (PWA), n8n Mobile ships as a normal Android app (APK) you can sideload.

**The APK talks to n8n directly** using Android's own networking, so you do **not** need `server.js`, Docker or any CORS setup. Install it, enter your n8n address, and sign in with your n8n email and password.

## Install

1. On your phone, download [n8n-mobile.apk](https://github.com/0XZEROX0/n8n-app/releases/download/android/n8n-mobile.apk) (always the newest build).
2. Open the file. Android will ask you to allow installs from your browser or Files app: allow it once.
3. Open **n8n Mobile**, enter `https://your-n8n-domain`, tap Continue, and sign in.

After that you never need to download it again: the app updates itself (see below).

Your n8n must be reachable from the phone over **HTTPS** (Android blocks plain `http://` by default).

## Home screen widget

Long-press your home screen → **Widgets** → **n8n Mobile** → drag **n8n workflows** out. Pick the workflows to show (in the order you tick them) and tap **Add widget**.

Then resize it like any widget. **Each workflow takes a 2x2 space**:

| Size | Shows |
|---|---|
| 2x2 | 1 workflow with its details |
| 4x2 | 2 side by side |
| 4x4 | 4 |
| bigger | one more per 2x2 block (up to 8x8) |

Smaller than 2x2 (1x1, 2x1…) it shows one workflow in a compact tile (name, last result and time, play).

Each workflow shows:

- its name, and the result of the last run: **Succeeded**, **Failed**, **Running now**, *Never ran*…
- **Last run: Today 14:02 · took 3 s** (when it last ran and how long it took)
- what starts it and whether it's on, e.g. **Schedule · Active**
- the **last 10 runs** as coloured dots (newest on the right) and a count, e.g. *Last 10: 9 OK · 1 failed*
- a **play** button

What you can tap:

- **Play** starts it, the same as **Run now** in the app (Manual / Schedule triggers), or calls its production webhook if it only has a Webhook trigger and is active. The tile shows *Starting…* and then follows the run until it finishes.
- Workflows that can only start from their own trigger (form, chat, an app event) show an **open** button instead, which opens them in the app.
- **Tap the workflow** to open it in the app.
- Free cells show **Add workflow**. **⚙** (or long-press → *Reconfigure* on Android 12+) changes the list.

It refreshes every 30 minutes, every time you leave the app, after you start a run, and when you tap ↻.

The widget uses the app's sign-in: open the app and sign in first. If your n8n session ends, the widget says so; open the app and sign in again. (Code: `android/app/src/main/java/io/github/n8nmobile/app/widget/`. When you leave the app, `MainActivity` hands the widget the server address and n8n's per-device browser id; the n8n session cookie is already in Android's cookie store.)

## How it is built

The app is wrapped with [Capacitor](https://capacitorjs.com/):

- `capacitor.config.json` points Capacitor at `public/` and turns on `CapacitorHttp`, which routes `fetch` through native HTTP (no CORS).
- `android/` is the generated Android Studio project. Icons and splash screens come from `assets/` (regenerate with `npm run android:assets`).
- `.github/workflows/android.yml` builds the APK on every push and pull request (download it from the run's *Artifacts*). Every push to `main` also replaces the rolling **`android`** release with the new `n8n-mobile.apk`, titled with its build number, and with notes listing what changed (`scripts/release-notes.mjs`). Publishing a versioned release (e.g. `v0.2.0`) also attaches the APK to it.
- To attach an APK to an older release, open **Actions → Android APK → Run workflow** and type its tag.

## In-app updates

CI stamps the build number into `public/build.json`. When the app opens (and when you come back to it) it reads the `android` release from GitHub; if its build is newer, it shows **An update is out** with the changes. **Update now** downloads the APK inside the app and opens Android's installer (`AppUpdaterPlugin.java`, the same approach as Monthly Budget). The first time, Android asks you to allow installs from n8n Mobile: turn it on and come back, and the install continues.

## Signing key

Android only installs an update over the app if both are signed with the same key. Builds are signed with `android/app/shared-debug.keystore`, committed to the repo, so every build has the same signature and updates install over the top.

Anyone who can read the repo could sign an APK with that key. If that matters to you, use your own key instead (you'll need to uninstall once when switching):

```bash
keytool -genkeypair -v -keystore n8n-mobile.jks -alias n8n-mobile -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 n8n-mobile.jks > n8n-mobile.jks.b64    # macOS: base64 -i n8n-mobile.jks
```

Then add these in GitHub → **Settings → Secrets and variables → Actions**: `ANDROID_KEYSTORE_BASE64` (contents of the .b64 file), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`n8n-mobile`), `ANDROID_KEY_PASSWORD`.

**Upgrading from v0.1.0:** that APK was signed with a one-off key, so uninstall it once and install the new one. From then on, updates install from inside the app.

## Build locally

Needs Node 22, JDK 21 and the Android SDK (or Android Studio).

```bash
npm ci
npx cap sync android
cd android && ./gradlew assembleRelease
# APK: android/app/build/outputs/apk/release/app-release.apk
```

Or open the project in Android Studio with `npx cap open android`.
