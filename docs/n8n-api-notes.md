# n8n API notes

The app signs in like the n8n editor does and uses n8n's own REST API (`/rest`), with n8n's session cookie (`n8n-auth`). Every request also sends a `browser-id` header: n8n ties the session to it.

| Feature | Endpoint |
| --- | --- |
| Check the address is n8n | `GET /rest/settings` (no sign-in needed; 401 here means a password in front of n8n) |
| Sign in | `POST /rest/login` `{ emailOrLdapLoginId, password, mfaCode?, mfaRecoveryCode? }` (older n8n: `email`) |
| Two-step verification needed | `401` with `code: 998` → ask for the code and sign in again with `mfaCode` |
| Who am I / still signed in? | `GET /rest/login` |
| Sign out | `POST /rest/logout` |
| Workflows | `GET /rest/workflows?select=[...]&skip&take` |
| Workflow details | `GET /rest/workflows/{id}` |
| Activate / deactivate | `POST /rest/workflows/{id}/activate` `{ versionId }`, `/deactivate` (older n8n: `PATCH` with `active`) |
| Run now | `POST /rest/workflows/{id}/run` `{ workflowData, triggerToStartFrom: { name } }` |
| Node icons (Flow tab) | `POST /rest/node-types` `{ nodeInfos: [{ name, version }] }`, then each type's `iconUrl` (e.g. `icons/n8n-nodes-base/dist/nodes/Slack/slack.svg`) |
| Save edits | `PATCH /rest/workflows/{id}` `{ name, description, nodes, connections, settings, nodeGroups, versionId, expectedChecksum }` (n8n 2.x uses `expectedChecksum` = the `checksum` from GET to catch someone else's save; Community edition skips that check) |
| Publish saved changes (n8n 2.x) | `POST /rest/workflows/{id}/activate` `{ versionId }` with the new `versionId` |
| Step fields, credentials (editor) | `POST /rest/node-types` (full description: `properties`, `displayOptions`, `credentials`), `GET /rest/credentials` |
| All step types (Add a step) | `GET /types/nodes.json` (signed in; about 18 MB, 1.6 MB gzipped; one entry per type and version) |
| Edit history | `GET /rest/workflow-history/workflow/{id}?take=50&skip=0` |
| Executions | `GET /rest/executions?filter={...}&limit=&lastId=` → `{ results, count }` |
| Execution steps | `GET /rest/executions/{id}`; its `data` is in "flatted" form, decoded in the app |
| Retry | `POST /rest/executions/{id}/retry` `{ loadWorkflow: true }` |
| Webhook workflows | the production webhook: `{METHOD} /webhook/{path}` |

Tested against n8n 2.46.6. This API is n8n's internal one and isn't versioned, so a future n8n release could change it.

## How fields map to the UI

- **Active**: `active`.
- **Published** (n8n 2.x): `activeVersionId` set → Published; differs from `versionId` → Unpublished changes; null → Not published.
- **Owner**: owning project (`homeProject` / `shared`). **Created by**: authors of the oldest saved version, if it dates from when the workflow was created.
- **Status**: execution `status` (`crashed` counted as failed).
- **Duration**: `stoppedAt − startedAt`.
