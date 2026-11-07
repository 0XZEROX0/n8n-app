# n8n Mobile

A small installable web app (PWA) for Android that connects to your self-hosted n8n and lets you see and run your workflows from your phone.

<p>
  <img src="docs/screenshots/overview.png" width="230" alt="Overview">
  <img src="docs/screenshots/workflows.png" width="230" alt="Workflows">
  <img src="docs/screenshots/execution.png" width="230" alt="Execution details">
</p>

**Two ways to use it:** install the **Android APK** from [Releases](https://github.com/0XZEROX0/n8n-app/releases/latest) (no server needed, see [docs/android.md](docs/android.md)), or host it as a web app next to n8n (below).

More docs: [Android APK](docs/android.md) · [Deployment](docs/deployment.md) · [Architecture](docs/architecture.md) · [n8n API notes](docs/n8n-api-notes.md) · [Changelog](CHANGELOG.md)

## Features

- **Overview**: succeeded vs failed executions, success rate, longest execution (and which workflow), average duration, active workflow count, the workflows that fail most, and the longest-running ones.
- **Workflows**: one card per workflow with Active/Inactive, Published / Unpublished changes / Not published (n8n 2.x), trigger type, tags, ID, success/fail counts and last edit. Search and filter (active, inactive, has failures, archived).
- **Workflow details**: ID, owner, created/edited dates, nodes, triggers, settings, a *Flow* view of the nodes in order, a *Runs* tab with that workflow's stats, and a *History* tab (current and published version; see limits below). Activate / deactivate from the phone.
- **Run**: workflows with a Webhook trigger get a Run button (method, path, JSON body, optional auth headers) and show the response. Form triggers open the form.
- **Executions**: filter by status, open any run to see each step, its time, items, the error message, and the output. Retry failed runs.

## How you sign in

n8n's public API uses an **API key** (not email/password). In n8n go to **Settings → n8n API → Create an API key**, then paste your n8n URL and the key into the app. The key is stored only on your phone (uncheck "Keep me signed in" to forget it when the browser closes).

## Android APK (easiest)

Download `n8n-mobile-<version>.apk` from the [latest release](https://github.com/0XZEROX0/n8n-app/releases/latest), open it on your phone, and allow the install. The APK connects to n8n directly, so no server or CORS setup is needed. Details and signing: [docs/android.md](docs/android.md).

## Running it as a web app (next to your n8n)

Browsers block a web page from calling another site's API unless that site allows it (CORS), and n8n's API doesn't allow it by default. So the app comes with a tiny server (`server.js`, no dependencies) that serves the app **and** forwards API calls to n8n. No CORS setup needed.

### Option A: Docker (same host as n8n)

```bash
docker build -t n8n-mobile .
docker run -d --name n8n-mobile --restart unless-stopped -p 8080:8080 \
  -e N8N_URL=https://n8n.example.com n8n-mobile
```

### Option B: plain Node 18+

```bash
N8N_URL=https://n8n.example.com PORT=8080 node server.js
```

Then put it behind HTTPS (required for "Install app" on Android), e.g. with the reverse proxy you already use for n8n:

```
# Caddy
mobile.example.com {
    reverse_proxy localhost:8080
}
```

```
# nginx
server {
    server_name mobile.example.com;
    location / { proxy_pass http://127.0.0.1:8080; proxy_set_header Host $host; }
    # ... your usual ssl settings
}
```

### Install on Android

Open `https://mobile.example.com` in Chrome → menu ⋮ → **Install app** (or "Add to Home screen"). It opens full-screen like a normal app.

### Option C: static hosting, no server (advanced)

You can host the `public/` folder anywhere static (GitHub Pages, Netlify…). The browser then calls n8n directly, so your n8n reverse proxy must send CORS headers for `/api/` and `/webhook/`, for example in nginx:

```
location ~ ^/(api|webhook)/ {
    add_header Access-Control-Allow-Origin "https://your-app-host" always;
    add_header Access-Control-Allow-Headers "X-N8N-API-KEY, Content-Type, Authorization" always;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, PATCH, DELETE, OPTIONS" always;
    if ($request_method = OPTIONS) { return 204; }
    proxy_pass http://127.0.0.1:5678;
}
```

## Security notes

- `server.js` only forwards to the single `N8N_URL` you set. It does not store anything. (`ALLOW_ANY_TARGET=1` lets the app choose the URL, which makes it an open proxy; only use that on a private network.)
- Your API key has full access to n8n. Treat your phone like any device that's signed in to n8n. You can revoke the key in n8n at any time.

## Known limits of n8n's API (v1)

- **Running a workflow**: the API has no "execute" endpoint, so the app runs workflows through their **Webhook** trigger. Add a Webhook trigger (and activate the workflow) to run it from the phone.
- **Edit history**: the API exposes the current version and the published version, not the full list of past versions. The History tab links to n8n's version history page.
- **Creator**: the API returns the owning project (shown as owner), not who originally created the workflow.
- **Stats** are computed from the most recent N executions n8n still keeps (default 500, change in Settings). n8n prunes old executions on its own schedule.
- **Retry** needs a recent n8n version.

## Files

```
server.js            app server + n8n API forwarder (zero dependencies)
Dockerfile
public/index.html    app shell
public/app.js        all app logic
public/styles.css    mobile-first styles (light/dark)
public/sw.js         offline app shell cache (never caches n8n data)
public/manifest.webmanifest, public/icons/
capacitor.config.json  Android wrapper settings (Capacitor, native HTTP)
android/             Android Studio project for the APK
assets/              icon and splash sources for the APK
.github/workflows/android.yml   builds the APK and attaches it to releases
```
