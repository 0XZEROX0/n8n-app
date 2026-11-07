# n8n API notes

The app uses n8n's public REST API (`/api/v1`) with an API key. Endpoints used:

| Feature | Endpoint |
| --- | --- |
| Test login, list workflows | `GET /workflows?limit=&cursor=` |
| Workflow details | `GET /workflows/{id}` |
| Activate / deactivate | `POST /workflows/{id}/activate`, `/deactivate` |
| Executions (overview, lists) | `GET /executions?limit=&cursor=&workflowId=` |
| Execution steps | `GET /executions/{id}?includeData=true` |
| Retry | `POST /executions/{id}/retry` (newer n8n only) |
| Run a workflow | its production webhook: `{METHOD} /webhook/{path}` |

## How fields map to the UI

- **Active**: `active`.
- **Published** (n8n 2.x): `activeVersionId` set → Published; differs from `versionId` → Unpublished changes; null → Not published. On older n8n without `activeVersionId`, Active is the published state and no badge is shown.
- **Owner**: owning project from `shared[]` (or `homeProject`). The API does not say who created a workflow.
- **Status**: execution `status` (`crashed` counted as failed); older versions fall back to `finished`/`stoppedAt`.
- **Duration**: `stoppedAt − startedAt`.

## Limits

- No API endpoint starts a workflow by ID, so the app needs a Webhook trigger to run one.
- No API endpoint lists past workflow versions; the History tab links to n8n's own history page.
- Stats only cover executions n8n still keeps (see `EXECUTIONS_DATA_MAX_AGE` / pruning settings) and the sample size set in the app.
