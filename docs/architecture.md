# Architecture

```
 Android (Chrome / installed PWA)
        │  HTTPS
        ▼
 server.js  ──────────────►  your n8n  (N8N_URL)
  • serves public/            /rest/*     (n8n session cookie + browser-id)
  • /n8n/*  → N8N_URL/*       /webhook/*  (to run workflows)
  • /app-config.json
```

## Why a server at all?

Browsers only let a page call another site's API if that site sends CORS headers. n8n does not send them, and browsers won't send n8n's session cookie to another site either, so a page on `mobile.example.com` cannot use `n8n.example.com/rest/...`. `server.js` sits on the same origin as the app and forwards the calls, so the browser never makes a cross-site request.

`server.js` has no dependencies (Node 18+ built-ins only). It:

- serves `public/` with an SPA fallback,
- forwards every request under `/n8n/` to `N8N_URL`, passing only n8n's `n8n-auth` session cookie and stripping `Origin`,
- answers `/app-config.json` with `{ proxy: true, n8nUrl }` so the app knows to route through it and pre-fills the URL.

If the app is hosted without `server.js` (static hosting), `/app-config.json` is missing and the app calls n8n directly, which needs CORS on your n8n reverse proxy (see [deployment.md](deployment.md)).

## Front end

Plain JavaScript, no framework or build step. Everything is in `public/app.js`:

| Part | What it does |
| --- | --- |
| `API` | Thin wrapper over n8n's public API, with cursor pagination. |
| `loadAll()` | Loads all workflows and the last N executions (default 500, Settings). |
| Overview / Workflows / Executions | The three tabs, rendered from that loaded state. |
| Sheets | Workflow detail, run, execution detail and settings open as bottom sheets. A small stack keeps the Android back button working. |
| `sw.js` | Caches the app shell for fast start. n8n data is never cached. |

## Data and privacy

- The app never stores your n8n password. The session is n8n's own `n8n-auth` cookie: `server.js` passes only that cookie between the browser and n8n; the Android app keeps it in Android's cookie store. A server (basic auth) password, if you use one, is kept on the device so every request can send it.
- `server.js` does not log or store requests.
