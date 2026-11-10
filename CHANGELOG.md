# Changelog

## Unreleased

- Widget: the play button no longer gets cut off on 2x2 tiles. It now sits next to the workflow name, and the details below are shorter so the last-10-runs dots fit too.
- Widget: each workflow now takes a 2x2 space (2x2 = 1, 4x2 = 2, 4x4 = 4) and shows more: the result of the last run, when it ran and how long it took, what starts it and whether it is active, and the last 10 runs as coloured dots with an OK/failed count.
- Fix: the app crashed after picking workflows for the home screen widget (Android 14 and newer). The widget's background refresh needs a permission to wait for network; it now has it.
- **Home screen widget** (Android app): one resizable widget. Each home screen cell holds one workflow, so 1x1 shows one, 2x1 two, 2x2 four, and bigger sizes more. Each shows the last run (OK / Failed / Running, with the time) and a play button that starts it. Tap a workflow to open it in the app; pick and order the workflows when you add it, or later with the ⚙ button (or "Reconfigure" on Android 12+). Refreshes every 30 minutes, when you leave the app, after a run, and with the ↻ button.
## 0.4.0

- **Edit workflows from the phone.** Rename a workflow and change its description. In the **Flow** tab, tap a step and then **Edit** to change its fields (the same fields the n8n editor shows, following your choices such as Resource and Operation; anything complex, or the whole step, can be edited as JSON), its credential, its name (expressions like `$('Old name')` are updated), whether it is enabled, and its settings (retry on fail, on error, always output data, execute once, notes). Connect and disconnect steps, including If/Switch outputs, Merge inputs and AI models/memory/tools.
- Drag a selected step to move it. **Add after** or the pink **+** adds any step your n8n has, searchable; **Delete** removes a step and joins its neighbours like n8n does.
- Edits are kept as a draft with an **Unsaved changes** bar (Save / Discard) and a Save button in full screen; closing the workflow asks before throwing changes away. On n8n 2.x, a saved change to a published workflow shows **Publish changes**.

## 0.3.0

- The workflow **Flow** tab now draws the workflow like the n8n editor: nodes as blocks with their n8n icons at their saved positions, connected by lines, with If/Loop/error outputs labelled, AI sub-nodes (model, memory, tools) wired in with dashed lines, node groups as titled dashed frames, and sticky notes, in n8n's own canvas colours. Drag to move, pinch or use the buttons to zoom, go full screen, and tap a node to see what it connects to and its settings. Read-only. The old step list is still there under the canvas.
- Android back (edge swipe or back button) no longer closes the app straight away. It closes the open sheet first, then goes to Overview from another tab, and on Overview a second back within 2 seconds exits ("Swipe back again to exit").

## 0.2.1

- Fix: on n8n 2.46 and newer, the Overview stayed at 0 with "Use cursor to load execution pages" once there were more than 100 executions. Executions now page with n8n's cursor (older n8n keeps working).
- Workflows still show if loading executions fails, and the other way round.

## 0.2.0

- Sign in like n8n itself: enter the address, tap Continue, then email and password. Asks for a two-step verification code (or recovery code) and for a server password (basic auth in front of n8n) when needed. No API key any more.
- Uses n8n's signed-in API, which adds: **Run now** for Manual/Schedule workflows, the full **edit history** with who saved each version, and **Created by**.
- In-app updates on Android: every build of `main` is published as the rolling `android` release; the app offers it with what changed and installs it without a browser.
- APKs are signed with a committed key, so updates install over the top.

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
