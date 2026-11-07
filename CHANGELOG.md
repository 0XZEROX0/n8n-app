# Changelog

## 0.1.0 (2026-11-07)

First version.

- Sign in with n8n URL + API key, stored on the device.
- Overview: succeeded/failed counts, success rate, longest and average execution, most-failing and longest-running workflows.
- Workflows: cards with active/published state, triggers, tags, run counts; search and filters.
- Workflow details: details, flow (nodes in order), runs, version info; activate/deactivate.
- Run workflows through their Webhook trigger; open Form triggers.
- Executions: status filters, per-step timings, errors, output, retry.
- Android APK (Capacitor) that connects to n8n directly with no server or CORS setup, built by GitHub Actions and attached to releases.
- `server.js` app server and n8n API forwarder (no CORS setup), Dockerfile, installable PWA.
