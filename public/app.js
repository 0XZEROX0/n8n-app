/* n8n Mobile: a small PWA client for the n8n public REST API (v1). */
(() => {
'use strict';

// ---------- tiny helpers ----------
const $ = (s, el = document) => el.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const app = $('#app');
// Running inside the Android APK (Capacitor)? Its native HTTP layer has no CORS limits.
const IS_NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

const ICONS = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  flows: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  runs: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  expand: '<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/>',
  shrink: '<path d="M4 14h6v6M20 10h-6V4M10 14l-7 7M14 10l7-7"/>',
  pen: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6"/>',
  link: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
  save: '<path d="M5 3h11l3 3v15H5zM8 3v5h7V3M8 21v-7h8v7"/>',
};
const icon = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[n]}</svg>`;

function fmtDur(ms) {
  if (ms == null || isNaN(ms)) return '–';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)} s`;
  const m = Math.floor(s / 60), rs = Math.round(s % 60);
  if (m < 60) return `${m}m ${rs}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
function fmtDate(d) {
  if (!d) return '–';
  const dt = new Date(d);
  return isNaN(dt) ? '–' : dt.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
function ago(d) {
  if (!d) return '–';
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (isNaN(diff)) return '–';
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(d).toLocaleDateString();
}
function hue(str) { let h = 0; for (const c of String(str)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }
function initials(name) {
  const w = String(name || '?').trim().split(/\s+/).filter(Boolean);
  return ((w[0]?.[0] || '?') + (w[1]?.[0] || '')).toUpperCase();
}
let toastTimer;
function toast(msg, bad = false, ms = 3500) {
  const t = $('#toast'); t.textContent = msg; t.className = 'toast' + (bad ? ' bad' : ''); t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), ms);
}

// ---------- storage ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem(k) ?? sessionStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v, persist = true) {
    try { (persist ? localStorage : sessionStorage).setItem(k, JSON.stringify(v)); (persist ? sessionStorage : localStorage).removeItem(k); } catch {}
  },
  del(k) { try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch {} },
};

// ---------- state ----------
const S = {
  cfg: { proxy: false, n8nUrl: null, allowAnyTarget: false }, // from /app-config.json when served by server.js
  // Signed-in server: { url, viaProxy, email, name, basic }. `basic` is base64 "user:pass" for a
  // password your reverse proxy asks for in front of n8n. n8n's own session is a cookie.
  conn: store.get('n8n.conn', null),
  prefs: store.get('n8n.prefs', { sample: 500 }),
  login: null, // sign-in flow: { step: 'url' | 'server' | 'signin' | 'mfa', url, email, password, info, error }
  tab: 'overview',
  workflows: [], executions: [], loading: false, loadedAt: null, error: null,
  wfFilter: 'all', wfQuery: '', exFilter: 'all',
};
// n8n ties its session cookie to a per-device id sent in the "browser-id" header.
const BROWSER_ID = (() => {
  let id = store.get('n8n.browserId', null);
  if (!id) { id = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()); store.set('n8n.browserId', id); }
  return id;
})();

// ---------- API ----------
// Uses n8n's own signed-in API (/rest), the same one the n8n editor uses, so it works with
// your email and password and can show edit history and run any workflow.
class ApiError extends Error { constructor(msg, status, code) { super(msg); this.status = status; this.code = code; } }

function baseUrl(conn = S.conn) { return (conn?.url || '').replace(/\/+$/, ''); }
function reqUrl(path, query, conn = S.conn) {
  const qs = query ? new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)])).toString() : '';
  return (conn?.viaProxy ? '/n8n' : baseUrl(conn)) + path + (qs ? '?' + qs : '');
}
async function rawFetch(path, { method = 'GET', query, body, headers = {}, conn = S.conn } = {}) {
  const h = { Accept: 'application/json', 'browser-id': BROWSER_ID, ...headers };
  if (conn?.basic && !h.Authorization) h.Authorization = 'Basic ' + conn.basic;
  if (conn?.viaProxy && S.cfg.allowAnyTarget) h['X-N8N-Target'] = baseUrl(conn);
  let payload = body;
  if (body !== undefined && typeof body !== 'string') { payload = JSON.stringify(body); h['Content-Type'] = 'application/json'; }
  try {
    return await fetch(reqUrl(path, query, conn), { method, headers: h, body: payload, credentials: 'include' });
  } catch (e) {
    throw new ApiError(IS_NATIVE
      ? 'Could not reach n8n. Check the address (it must start with https://) and that this phone can reach your server.'
      : conn?.viaProxy
      ? 'Could not reach the app server. Is server.js running?'
      : 'Could not reach n8n from this browser. Use the Android app, or run the web app through server.js (see README).', 0);
  }
}
async function readBody(res) {
  const text = await res.text();
  try { return text ? JSON.parse(text) : null; } catch { return text; }
}
async function api(path, opts = {}) {
  const res = await rawFetch('/rest' + path, opts);
  const data = await readBody(res);
  if (!res.ok) {
    const msg = (data && typeof data === 'object' && data.message) || `HTTP ${res.status}`;
    const code = data && typeof data === 'object' ? data.code : undefined;
    if (res.status === 401 && !opts.noSignOut && S.conn) { sessionEnded(); throw new ApiError('Your n8n session ended. Sign in again.', 401, code); }
    throw new ApiError(msg, res.status, code);
  }
  return data && typeof data === 'object' && 'data' in data ? data.data : data;
}

// n8n stores execution details in "flatted" form (JSON that can hold repeated references).
function unflatten(text) {
  const wrap = JSON.parse(text, (_k, v) => (typeof v === 'string' ? new String(v) : v));
  const input = wrap.map((v) => (v instanceof String ? String(v) : v));
  const seen = new Set();
  const revive = (obj) => {
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (v instanceof String) {
        const ref = input[+v];
        if (ref && typeof ref === 'object' && !seen.has(ref)) { seen.add(ref); obj[k] = revive(ref); } else obj[k] = ref;
      }
    }
    return obj;
  };
  const root = input[0];
  return root && typeof root === 'object' ? (seen.add(root), revive(root)) : root;
}

const WF_FIELDS = ['id', 'name', 'active', 'activeVersionId', 'versionId', 'isArchived', 'createdAt', 'updatedAt', 'tags', 'nodes', 'ownedBy', 'description'];
const API = {
  settings: (conn) => rawFetch('/rest/settings', { conn }),
  me: () => api('/login', { noSignOut: true }),
  login: (conn, body) => rawFetch('/rest/login', { method: 'POST', body, conn }),
  logout: () => api('/logout', { method: 'POST', noSignOut: true }),
  async workflows() {
    const out = [];
    for (let skip = 0; ; skip += 100) {
      const res = await rawFetch('/rest/workflows', { query: { select: WF_FIELDS, skip, take: 100 } });
      if (res.status === 400) return api('/workflows'); // older n8n without "select": plain list
      const page = await readBody(res);
      if (!res.ok) { if (res.status === 401) sessionEnded(); throw new ApiError(page?.message || `HTTP ${res.status}`, res.status); }
      const rows = Array.isArray(page?.data) ? page.data : [];
      out.push(...rows);
      if (rows.length < 100 || (page.count != null && out.length >= page.count)) return out;
    }
  },
  workflow: (id) => api(`/workflows/${encodeURIComponent(id)}`),
  async setActive(wf, on) {
    const id = encodeURIComponent(wf.id);
    try {
      return await api(`/workflows/${id}/${on ? 'activate' : 'deactivate'}`, { method: 'POST', body: on ? { versionId: wf.versionId } : {} });
    } catch (e) {
      if (e.status !== 404) throw e;
      // Older n8n: the switch is a field on the workflow.
      return api(`/workflows/${id}`, { method: 'PATCH', body: { active: on, versionId: wf.versionId } });
    }
  },
  async executions(filter = {}, max = 100) {
    const out = []; let cursor; let lastId;
    while (out.length < max) {
      const want = Math.min(100, max - out.length);
      // n8n 2.46+ pages with an opaque `cursor` (and rejects lastId); older versions page with lastId.
      const page = await api('/executions', { query: { filter, limit: want, cursor, lastId } });
      const rows = page?.results || (Array.isArray(page) ? page : []);
      out.push(...rows);
      if (page && 'nextCursor' in page) {
        if (!page.nextCursor || !rows.length) break;
        cursor = page.nextCursor;
      } else {
        if (rows.length < want) break;
        lastId = rows[rows.length - 1].id; // older n8n: next page is older than this id
      }
    }
    return out;
  },
  async execution(id) {
    const ex = await api(`/executions/${encodeURIComponent(id)}`);
    if (ex && typeof ex.data === 'string') { try { ex.data = unflatten(ex.data); } catch { ex.data = null; } }
    return ex;
  },
  retry: (id) => api(`/executions/${encodeURIComponent(id)}/retry`, { method: 'POST', body: { loadWorkflow: true } }),
  // Same as pressing "Execute workflow" in the editor, starting from the given trigger.
  run: (wf, triggerName) => api(`/workflows/${encodeURIComponent(wf.id)}/run`, { method: 'POST', body: { workflowData: wf, triggerToStartFrom: { name: triggerName } } }),
  history: (id) => api(`/workflow-history/workflow/${encodeURIComponent(id)}`, { query: { take: 50, skip: 0 } }),
  // Save an edited workflow, like the editor's Save. versionId lets n8n refuse it if someone else saved in between.
  saveWorkflow(wf, d) {
    const body = { name: d.name, nodes: d.nodes, connections: d.connections, settings: d.settings || {}, versionId: wf.versionId };
    if (wf.checksum) body.expectedChecksum = wf.checksum; // n8n 2.x checks this instead of versionId
    for (const k of ['description', 'pinData', 'meta']) if (k in d && JSON.stringify(d[k]) !== JSON.stringify(wf[k])) body[k] = d[k];
    if (Array.isArray(d.nodeGroups)) body.nodeGroups = d.nodeGroups;
    return api(`/workflows/${encodeURIComponent(wf.id)}`, { method: 'PATCH', body });
  },
};

// ---------- domain helpers ----------
function exStatus(e) {
  if (e.status) return e.status === 'crashed' ? 'error' : e.status;
  if (e.finished) return 'success';
  return e.stoppedAt ? 'error' : 'running';
}
function exDur(e) { return e.startedAt && e.stoppedAt ? new Date(e.stoppedAt) - new Date(e.startedAt) : null; }
const STATUS_UI = {
  success: ['Succeeded', 'ok'], error: ['Failed', 'bad'], canceled: ['Canceled', 'warn'],
  running: ['Running', 'info'], waiting: ['Waiting', 'info'], new: ['Queued', 'info'], unknown: ['Unknown', ''],
};
const statusBadge = (s) => { const [l, c] = STATUS_UI[s] || STATUS_UI.unknown; return `<span class="badge ${c}"><span class="dot"></span>${l}</span>`; };

function wfName(id) { return S.workflows.find((w) => String(w.id) === String(id))?.name || S.executions.find((e) => String(e.workflowId) === String(id))?.workflowName || `Workflow ${id}`; }
function owner(wf) {
  const sh = Array.isArray(wf.shared) ? wf.shared : [];
  const own = sh.find((s) => /owner/i.test(s.role || '')) || sh[0];
  return own?.project?.name || wf.homeProject?.name || wf.ownedBy?.email || null;
}
function publishState(wf) {
  if (wf.isArchived) return { label: 'Archived', cls: '' };
  if ('activeVersionId' in wf) {
    if (!wf.activeVersionId) return { label: 'Not published', cls: '' };
    if (wf.versionId && wf.activeVersionId !== wf.versionId) return { label: 'Unpublished changes', cls: 'warn' };
    return { label: 'Published', cls: 'info' };
  }
  return null; // older n8n: "active" is the published state
}
const TRIGGER_LABELS = {
  'n8n-nodes-base.webhook': 'Webhook', 'n8n-nodes-base.formTrigger': 'Form', 'n8n-nodes-base.manualTrigger': 'Manual',
  'n8n-nodes-base.scheduleTrigger': 'Schedule', 'n8n-nodes-base.cron': 'Cron', 'n8n-nodes-base.executeWorkflowTrigger': 'Sub-workflow',
  '@n8n/n8n-nodes-langchain.chatTrigger': 'Chat', 'n8n-nodes-base.errorTrigger': 'Error',
};
function isTrigger(n) { return /trigger$/i.test(n.type) || n.type === 'n8n-nodes-base.webhook' || n.type === 'n8n-nodes-base.cron'; }
function triggers(wf) { return (wf.nodes || []).filter(isTrigger); }
function triggerLabel(n) {
  return TRIGGER_LABELS[n.type] || n.type.split('.').pop().replace(/Trigger$/i, '').replace(/^\w/, (c) => c.toUpperCase()) + ' trigger';
}
function shortType(t) { return String(t || '').split('.').pop().replace(/([a-z])([A-Z])/g, '$1 $2'); }
function webhookInfo(n) {
  const p = n.parameters || {};
  const path = String(p.path || n.webhookId || '').replace(/^\/+/, '');
  return { method: (p.httpMethod || 'GET').toUpperCase(), path };
}
function orderedNodes(wf) {
  const nodes = wf.nodes || []; const byName = Object.fromEntries(nodes.map((n) => [n.name, n]));
  const conns = wf.connections || {}; const seen = new Set(); const out = [];
  const visit = (name) => {
    if (seen.has(name) || !byName[name]) return; seen.add(name); out.push(byName[name]);
    for (const outputs of Object.values(conns[name] || {})) for (const branch of outputs || []) for (const c of branch || []) visit(c.node);
  };
  triggers(wf).forEach((t) => visit(t.name));
  nodes.forEach((n) => visit(n.name));
  return out;
}
function wfRunStats(id) {
  const ex = S.executions.filter((e) => String(e.workflowId) === String(id));
  return { total: ex.length, ok: ex.filter((e) => exStatus(e) === 'success').length, bad: ex.filter((e) => exStatus(e) === 'error').length, last: ex[0] };
}

// ---------- data loading ----------
async function loadAll() {
  if (S.loading) return;
  S.loading = true; S.error = null; render();
  try {
    // Load both independently, so one failing doesn't blank the other.
    const [wfs, exs] = await Promise.allSettled([API.workflows(), API.executions({}, S.prefs.sample || 500)]);
    if (wfs.status === 'fulfilled') S.workflows = wfs.value.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    if (exs.status === 'fulfilled') S.executions = exs.value;
    const failed = [wfs, exs].filter((r) => r.status === 'rejected').map((r) => r.reason);
    if (failed.length) throw failed[0];
    S.loadedAt = Date.now();
  } catch (e) {
    S.error = e.message;
    if (e.status === 401) { toast(e.message, true); }
  } finally { S.loading = false; render(); }
}

// ---------- views ----------
function render() {
  if (!S.conn) { document.body.classList.add('no-nav'); return renderLogin(); }
  document.body.classList.remove('no-nav');
  const titles = { overview: 'Overview', workflows: 'Workflows', executions: 'Executions' };
  const host = baseUrl().replace(/^https?:\/\//, '');
  app.innerHTML = `
    <header class="topbar">
      <h1>${titles[S.tab]}<span class="sub">${esc(host)}${S.loadedAt ? ' · updated ' + ago(S.loadedAt) : ''}</span></h1>
      <button class="icon-btn ${S.loading ? 'spin' : ''}" id="btn-refresh" aria-label="Refresh">${icon('refresh')}</button>
      <button class="icon-btn" id="btn-settings" aria-label="Settings">${icon('gear')}</button>
    </header>
    <main class="wrap" id="view">${S.error ? `<div class="alert bad" style="margin-top:14px">${esc(S.error)}</div>` : ''}${viewHtml()}</main>
    <nav class="bottomnav">
      ${[['overview', 'Overview', 'home'], ['workflows', 'Workflows', 'flows'], ['executions', 'Executions', 'runs']]
        .map(([k, l, i]) => `<button data-tab="${k}" class="${S.tab === k ? 'on' : ''}">${icon(i)}${l}</button>`).join('')}
    </nav>`;
  $('#btn-refresh').onclick = loadAll;
  $('#btn-settings').onclick = openSettings;
  app.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { S.tab = b.dataset.tab; render(); window.scrollTo(0, 0); }));
  bindView();
}

function viewHtml() {
  if (S.loading && !S.loadedAt) return `<div class="stack" style="margin-top:16px">${'<div class="skeleton"></div>'.repeat(4)}</div>`;
  if (S.tab === 'overview') return overviewHtml();
  if (S.tab === 'workflows') return workflowsHtml();
  return executionsHtml();
}

function overviewHtml() {
  const ex = S.executions;
  const cnt = (s) => ex.filter((e) => exStatus(e) === s).length;
  const ok = cnt('success'), bad = cnt('error'), running = cnt('running') + cnt('waiting') + cnt('new'), canceled = cnt('canceled');
  const finished = ok + bad;
  const rate = finished ? Math.round((ok / finished) * 100) : null;
  const durs = ex.map((e) => [e, exDur(e)]).filter(([, d]) => d != null);
  const longest = durs.reduce((m, x) => (!m || x[1] > m[1] ? x : m), null);
  const avg = durs.length ? durs.reduce((s, [, d]) => s + d, 0) / durs.length : null;
  const active = S.workflows.filter((w) => w.active).length;
  const oldest = ex[ex.length - 1]?.startedAt;

  // per-workflow failures
  const fails = {};
  ex.forEach((e) => { if (exStatus(e) === 'error') fails[e.workflowId] = (fails[e.workflowId] || 0) + 1; });
  const topFails = Object.entries(fails).sort((a, b) => b[1] - a[1]).slice(0, 5);
  // per-workflow longest
  const longByWf = {};
  durs.forEach(([e, d]) => { if (!longByWf[e.workflowId] || d > longByWf[e.workflowId][1]) longByWf[e.workflowId] = [e, d]; });
  const topLong = Object.values(longByWf).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return `
    <div class="section-title">Executions${ex.length ? ` · last ${ex.length}${oldest ? ' since ' + new Date(oldest).toLocaleDateString() : ''}` : ''}</div>
    <div class="grid2">
      <div class="card stat ok"><div class="label">Succeeded</div><div class="value">${ok}</div><div class="hint">${rate != null ? rate + '% success rate' : 'no finished runs'}</div></div>
      <div class="card stat bad"><div class="label">Failed</div><div class="value">${bad}</div><div class="hint">${canceled ? canceled + ' canceled' : running ? running + ' running now' : '&nbsp;'}</div></div>
      <button class="card stat wide wf" ${longest ? `data-ex="${esc(longest[0].id)}"` : ''}>
        <div class="label">Longest execution</div>
        <div class="value">${longest ? fmtDur(longest[1]) : '–'}</div>
        <div class="hint">${longest ? esc(wfName(longest[0].workflowId)) + ' · ' + ago(longest[0].startedAt) : 'No finished executions yet'}</div>
      </button>
      <div class="card stat"><div class="label">Average duration</div><div class="value">${fmtDur(avg)}</div><div class="hint">${durs.length} timed runs</div></div>
      <div class="card stat"><div class="label">Workflows</div><div class="value">${S.workflows.length}</div><div class="hint">${active} active</div></div>
    </div>
    ${finished ? `<div class="bar" aria-label="Success vs failed"><span style="width:${(ok / finished) * 100}%;background:var(--ok)"></span><span style="width:${(bad / finished) * 100}%;background:var(--bad)"></span></div>` : ''}

    <div class="section-title">Most failures</div>
    ${topFails.length ? `<div class="list">${topFails.map(([id, n]) => `
      <button class="row" data-wf="${esc(id)}"><div class="main"><div class="title">${esc(wfName(id))}</div><div class="meta">ID ${esc(id)}</div></div>
      <div class="end"><span class="badge bad">${n} failed</span></div></button>`).join('')}</div>` : '<div class="card empty">No failures in this sample 🎉</div>'}

    <div class="section-title">Longest running workflows</div>
    ${topLong.length ? `<div class="list">${topLong.map(([e, d]) => `
      <button class="row" data-ex="${esc(e.id)}"><div class="main"><div class="title">${esc(wfName(e.workflowId))}</div><div class="meta">Execution #${esc(e.id)} · ${ago(e.startedAt)}</div></div>
      <div class="end"><b>${fmtDur(d)}</b></div></button>`).join('')}</div>` : '<div class="card empty">Nothing yet</div>'}
    <div class="spacer"></div>`;
}

function workflowsHtml() {
  const q = S.wfQuery.toLowerCase();
  let list = S.workflows.filter((w) => !q || w.name.toLowerCase().includes(q) || String(w.id).toLowerCase().includes(q) || (w.tags || []).some((t) => t.name.toLowerCase().includes(q)));
  const f = S.wfFilter;
  if (f === 'active') list = list.filter((w) => w.active);
  if (f === 'inactive') list = list.filter((w) => !w.active && !w.isArchived);
  if (f === 'failing') list = list.filter((w) => wfRunStats(w.id).bad > 0);
  if (f === 'archived') list = list.filter((w) => w.isArchived);
  else if (f !== 'all') list = list.filter((w) => !w.isArchived);
  const chips = [['all', 'All'], ['active', 'Active'], ['inactive', 'Inactive'], ['failing', 'Has failures'], ['archived', 'Archived']];
  return `
    <div class="search"><input class="input" id="wf-q" type="search" placeholder="Search name, ID or tag" value="${esc(S.wfQuery)}"></div>
    <div class="chips">${chips.map(([k, l]) => `<button class="chip ${f === k ? 'on' : ''}" data-wff="${k}">${l}</button>`).join('')}</div>
    <div class="section-title">${list.length} workflow${list.length === 1 ? '' : 's'}</div>
    <div class="wf-grid">${list.map(wfTile).join('') || '<div class="card empty">No workflows match</div>'}</div>
    <div class="spacer"></div>`;
}

function wfTile(w) {
  const st = wfRunStats(w.id); const pub = publishState(w); const trg = triggers(w);
  return `
  <button class="card wf" data-wf="${esc(w.id)}">
    <div class="wf-head">
      <div class="wf-icon" style="background:hsl(${hue(w.name)} 55% 50%)">${esc(initials(w.name))}</div>
      <div style="min-width:0;flex:1"><div class="wf-name">${esc(w.name)}</div>
      <div class="wf-meta mono">ID ${esc(w.id)}</div></div>
    </div>
    <div class="badges">
      ${w.active ? '<span class="badge ok"><span class="dot"></span>Active</span>' : '<span class="badge"><span class="dot"></span>Inactive</span>'}
      ${pub ? `<span class="badge ${pub.cls}">${pub.label}</span>` : ''}
      ${trg.slice(0, 2).map((t) => `<span class="badge">${esc(triggerLabel(t))}</span>`).join('')}
      ${(w.tags || []).slice(0, 2).map((t) => `<span class="badge">#${esc(t.name)}</span>`).join('')}
    </div>
    <div class="mini-stats">
      <span>✓ <b>${st.ok}</b></span><span>✗ <b>${st.bad}</b></span>
      <span>${(w.nodes || []).length} nodes</span>
      <span style="margin-left:auto">edited ${ago(w.updatedAt)}</span>
    </div>
  </button>`;
}

function executionsHtml() {
  const f = S.exFilter;
  const list = S.executions.filter((e) => f === 'all' || exStatus(e) === f || (f === 'running' && ['waiting', 'new'].includes(exStatus(e))));
  const chips = [['all', 'All'], ['success', 'Succeeded'], ['error', 'Failed'], ['running', 'Running'], ['canceled', 'Canceled']];
  return `
    <div class="chips" style="margin-top:12px">${chips.map(([k, l]) => `<button class="chip ${f === k ? 'on' : ''}" data-exf="${k}">${l}</button>`).join('')}</div>
    <div class="section-title">${list.length} execution${list.length === 1 ? '' : 's'}</div>
    ${list.length ? `<div class="list">${list.slice(0, 300).map(exRow).join('')}</div>` : '<div class="card empty">No executions</div>'}
    <div class="spacer"></div>`;
}
function exRow(e) {
  return `<button class="row" data-ex="${esc(e.id)}">
    <div class="main"><div class="title">${esc(wfName(e.workflowId))}</div>
    <div class="meta">#${esc(e.id)} · ${esc(e.mode || '')} · ${ago(e.startedAt)}</div></div>
    <div class="end">${statusBadge(exStatus(e))}<div style="margin-top:4px">${fmtDur(exDur(e))}</div></div></button>`;
}

function bindView() {
  const v = $('#view'); if (!v) return;
  v.querySelectorAll('[data-wf]').forEach((b) => (b.onclick = () => openWorkflow(b.dataset.wf)));
  v.querySelectorAll('[data-ex]').forEach((b) => (b.onclick = () => openExecution(b.dataset.ex)));
  v.querySelectorAll('[data-wff]').forEach((b) => (b.onclick = () => { S.wfFilter = b.dataset.wff; render(); }));
  v.querySelectorAll('[data-exf]').forEach((b) => (b.onclick = () => { S.exFilter = b.dataset.exf; render(); }));
  const q = $('#wf-q');
  if (q) q.oninput = () => {
    S.wfQuery = q.value; const pos = q.selectionStart; render();
    const nq = $('#wf-q'); nq.focus(); nq.setSelectionRange(pos, pos);
  };
}

// ---------- login ----------
// Steps: url → (server password, if a proxy in front of n8n asks) → email + password → (2FA code).
function cleanUrl(u) {
  u = String(u || '').trim().replace(/\/+$/, '').replace(/\/(home\/workflows|signin|api\/v1|rest)$/, '');
  if (u && !/^https?:\/\//i.test(u)) u = 'https://' + u;
  return u;
}
function renderLogin() {
  const L = S.login || (S.login = { step: 'url', url: (S.cfg.proxy && S.cfg.n8nUrl) || store.get('n8n.lastUrl', ''), email: store.get('n8n.lastEmail', '') });
  const fixed = S.cfg.proxy && S.cfg.n8nUrl;
  const host = L.url.replace(/^https?:\/\//, '');
  const back = `<button type="button" class="btn block" id="login-back" style="margin-top:8px">Back</button>`;
  let body = '';
  if (L.step === 'url') body = `
    <form id="login-form" autocomplete="on">
      <label class="field"><span>n8n address</span>
        <input class="input" name="url" type="url" inputmode="url" autocapitalize="off" placeholder="https://n8n.example.com" required
          value="${esc(L.url)}" ${fixed ? 'readonly' : 'autofocus'}></label>
      <p class="help" style="margin-top:-6px">The public link you open n8n with in a browser.</p>
      <button class="btn primary block" type="submit">Continue</button>
    </form>
    ${!IS_NATIVE && !S.cfg.proxy ? '<div class="alert warn" style="margin-top:14px">In a browser, signing in needs the app server (server.js). The Android app works on its own.</div>' : ''}`;
  if (L.step === 'server') body = `
    <div class="alert info">${esc(host)} is protected by a password before n8n opens (set on your server or reverse proxy). Enter that first.</div>
    <form id="login-form" autocomplete="on">
      <label class="field"><span>Server username</span><input class="input" name="user" autocapitalize="off" required autocomplete="username"></label>
      <label class="field"><span>Server password</span><input class="input" name="pass" type="password" required autocomplete="current-password"></label>
      <button class="btn primary block" type="submit">Continue</button>${back}
    </form>`;
  if (L.step === 'signin') body = `
    <p class="help" style="margin-top:0">Signing in to <b>${esc(host)}</b>${L.info?.version ? ` · n8n ${esc(L.info.version)}` : ''}</p>
    ${L.info?.ssoOnly ? '<div class="alert warn">This n8n is set up for single sign-on. If your account also has an n8n password (the owner account always does), use it here.</div>' : ''}
    <form id="login-form" autocomplete="on">
      <label class="field"><span>${L.info?.ldap ? 'Email or LDAP username' : 'Email'}</span>
        <input class="input" name="email" type="${L.info?.ldap ? 'text' : 'email'}" autocapitalize="off" required autocomplete="username" value="${esc(L.email)}" ${L.email ? '' : 'autofocus'}></label>
      <label class="field"><span>Password</span><input class="input" name="password" type="password" required autocomplete="current-password" ${L.email ? 'autofocus' : ''}></label>
      <button class="btn primary block" type="submit">Sign in</button>${fixed && !L.basic ? '' : back}
    </form>`;
  if (L.step === 'mfa') body = `
    <div class="alert info">Your account uses two-step verification. Enter the 6-digit code from your authenticator app.</div>
    <form id="login-form" autocomplete="off">
      <label class="field"><span>Verification code</span>
        <input class="input mono" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="${L.recovery ? 64 : 6}" required autofocus
          placeholder="${L.recovery ? 'Recovery code' : '123456'}"></label>
      <button class="btn primary block" type="submit">Verify</button>
      <button type="button" class="btn block" id="login-recovery" style="margin-top:8px">${L.recovery ? 'Use a 6-digit code instead' : 'Use a recovery code instead'}</button>
      ${back}
    </form>`;
  app.innerHTML = `
  <div class="login">
    <div class="brand"><img src="icons/icon.svg" alt=""><div><h1>n8n Mobile</h1><p>Your workflows, in your pocket</p></div></div>
    ${L.error ? `<div class="alert bad">${esc(L.error)}</div>` : ''}
    ${body}
  </div>`;
  const go = (patch) => { Object.assign(L, patch); renderLogin(); };
  const b = $('#login-back');
  if (b) b.onclick = () => go({ step: L.step === 'mfa' ? 'signin' : L.step === 'signin' && L.basic ? 'server' : 'url', error: null });
  const rc = $('#login-recovery'); if (rc) rc.onclick = () => go({ recovery: !L.recovery, error: null });
  const form = $('#login-form');
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const fd = new FormData(form); const btn = form.querySelector('[type=submit]');
    const label = btn.textContent; btn.disabled = true; btn.textContent = 'Please wait…';
    try {
      if (L.step === 'url') {
        L.url = cleanUrl(fd.get('url')); L.basic = null;
        await probe(L);
      } else if (L.step === 'server') {
        L.basic = btoa(unescape(encodeURIComponent(`${fd.get('user')}:${fd.get('pass')}`)));
        await probe(L);
      } else if (L.step === 'signin') {
        L.email = String(fd.get('email')).trim(); L.password = String(fd.get('password'));
        await signIn(L, {});
      } else if (L.step === 'mfa') {
        const code = String(fd.get('code')).replace(/\s+/g, '');
        await signIn(L, L.recovery ? { mfaRecoveryCode: code } : { mfaCode: code });
      }
    } catch (e) { L.error = e.message; }
    if (S.login) renderLogin(); else { btn.disabled = false; btn.textContent = label; }
  };
}

// Checks the address really is n8n, and whether something in front of it wants a password.
async function probe(L) {
  const conn = { url: L.url, viaProxy: S.cfg.proxy, basic: L.basic };
  const res = await API.settings(conn);
  const data = await readBody(res);
  if (res.status === 401) {
    if (L.step === 'server') throw new Error('That server username or password was not accepted.');
    Object.assign(L, { step: 'server', error: null }); return;
  }
  const st = data && typeof data === 'object' ? data.data || data : null;
  if (!res.ok || !st || !st.userManagement) {
    if (typeof data === 'string' && /<html/i.test(data)) {
      throw new Error(`${L.url} answered with a web page instead of n8n. If your server shows its own sign-in page before n8n (like Cloudflare Access or Authelia), this app can't get past it yet. Otherwise check the address.`);
    }
    throw new Error(res.status === 404 ? `No n8n found at ${L.url}. Check the address.` : `${L.url} did not answer like n8n (HTTP ${res.status}).`);
  }
  const um = st.userManagement || {}; const sso = st.sso || {};
  L.info = {
    version: st.versionCli,
    ldap: !!sso.ldap?.loginEnabled,
    ssoOnly: ['saml', 'oidc'].includes(um.authenticationMethod),
  };
  Object.assign(L, { step: 'signin', error: null });
}

async function signIn(L, extra) {
  const conn = { url: L.url, viaProxy: S.cfg.proxy, basic: L.basic };
  const res = await API.login(conn, { emailOrLdapLoginId: L.email, password: L.password, ...extra });
  const data = await readBody(res);
  if (!res.ok) {
    const code = data && typeof data === 'object' ? data.code : undefined;
    if (code === 998) { Object.assign(L, { step: 'mfa', error: null }); return; } // two-step verification needed
    if (res.status === 400 && data?.message && /emailOrLdapLoginId|email/.test(data.message)) {
      // n8n older than ~1.80 calls the field "email".
      const r2 = await API.login(conn, { email: L.email, password: L.password, ...extra });
      if (r2.ok) return finishSignIn(L, conn, await readBody(r2));
    }
    if (L.step === 'mfa') throw new Error('That code was not accepted. Codes change every 30 seconds; try the newest one.');
    throw new Error(res.status === 401 ? 'Wrong email or password.' : (data?.message || `Sign-in failed (HTTP ${res.status}).`));
  }
  finishSignIn(L, conn, data);
}
function finishSignIn(L, conn, data) {
  const u = data?.data || data || {};
  S.conn = { ...conn, email: u.email || L.email, name: [u.firstName, u.lastName].filter(Boolean).join(' ') };
  store.set('n8n.conn', S.conn); store.set('n8n.lastUrl', L.url); store.set('n8n.lastEmail', L.email);
  S.login = null; S.error = null;
  render(); loadAll();
}
function sessionEnded() {
  if (!S.conn) return;
  S.login = { step: 'signin', url: S.conn.url, basic: S.conn.basic, email: S.conn.email || '', error: 'Your n8n session ended. Sign in again.' };
  S.conn = null; store.del('n8n.conn'); S.workflows = []; S.executions = []; S.loadedAt = null;
  while (sheetStack.length) { sheetStack.pop(); } closeSheet();
  render();
}

// ---------- sheet ----------
const sheetStack = []; // [{ key, html, onBind }] so Android "back" walks back through sheets
function showSheet(top) {
  const sh = $('#sheet'), bd = $('#sheet-backdrop');
  sh.innerHTML = top.html; sh.hidden = false; bd.hidden = false;
  document.body.style.overflow = 'hidden';
  sh.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => history.back()));
  bd.onclick = () => history.back();
  top.onBind?.(sh);
}
// opts.redraw: called instead of re-showing old HTML when the user comes back to this sheet.
// opts.leave: called when the user leaves this sheet; return false to stay (e.g. to keep unsaved edits).
function openSheet(key, html, onBind, opts = {}) {
  const top = sheetStack[sheetStack.length - 1];
  if (top && top.key === key) { Object.assign(top, { html, onBind }, opts); const y = $('#sheet').scrollTop; showSheet(top); $('#sheet').scrollTop = y; return; }
  sheetStack.push({ key, html, onBind, ...opts }); history.pushState({ sheet: sheetStack.length }, '');
  showSheet(sheetStack[sheetStack.length - 1]); $('#sheet').scrollTop = 0;
}
const sheetIsOpen = (key) => sheetStack[sheetStack.length - 1]?.key === key; // only redraw if it's the visible sheet
function closeSheet() { $('#sheet').hidden = true; $('#sheet-backdrop').hidden = true; document.body.style.overflow = ''; }
window.addEventListener('popstate', () => {
  if (flowFullExit) { const f = flowFullExit; flowFullExit = null; f(); return; } // Back leaves a full-screen canvas first
  const leaving = sheetStack[sheetStack.length - 1];
  if (leaving?.leave && !leaving.leave()) { history.pushState({ sheet: sheetStack.length }, ''); return; } // stay
  sheetStack.pop();
  const top = sheetStack[sheetStack.length - 1];
  if (!top) closeSheet(); else if (top.redraw) top.redraw(); else showSheet(top);
  if (afterPop) { const f = afterPop; afterPop = null; f(); }
});
let afterPop = null; // run once after the next sheet is closed (to open another one in its place)

// ---------- Android back (edge swipe / back button) ----------
// MainActivity asks this before Android handles back: 'handled' keeps the app open, 'exit' lets it close.
// Order: close the top overlay or sheet, then go to Overview, then "swipe again to exit" within 2 s.
// Full-screen views that aren't sheets can register a closer: const off = onBack(() => close()); call off() when closed.
const backClosers = [];
function onBack(fn) { backClosers.push(fn); return () => { const i = backClosers.lastIndexOf(fn); if (i >= 0) backClosers.splice(i, 1); }; }
let lastBackAt = 0;
window.n8nBack = () => {
  if (backClosers.length) { backClosers.pop()(); return 'handled'; }
  if (sheetStack.length) { history.back(); return 'handled'; }
  if (S.conn && S.tab !== 'overview') { S.tab = 'overview'; render(); window.scrollTo(0, 0); lastBackAt = 0; return 'handled'; }
  if (Date.now() - lastBackAt < 2000) return 'exit';
  lastBackAt = Date.now(); toast('Swipe back again to exit', false, 2000);
  return 'handled';
};
// The Android home screen widget opens a workflow with this (MainActivity.openWorkflow).
window.n8nOpenWorkflow = (id) => { if (S.conn) openWorkflow(String(id)); return 'ok'; };
const sheetHead = (title, extra = '') => `<div class="sheet-head"><h2>${title}</h2>${extra}<button class="icon-btn" data-close aria-label="Close">${icon('close')}</button></div>`;

// ---------- workflow detail ----------
async function openWorkflow(id, tab = 'details') {
  const cached = S.workflows.find((w) => String(w.id) === String(id));
  let wf = cached; let runs = null; let runsErr = null; let hist = null; let histErr = null;
  // Edits go into a copy (draft) until Save, like the n8n editor. Only possible once the full workflow
  // (with its connections) has loaded.
  let draft = null; let saving = false;
  const ed = {
    get wf() { return draft || wf; },
    get dirty() { return !!draft; },
    get ready() { return !!wf?.connections; },
    begin() {
      if (!draft) { draft = JSON.parse(JSON.stringify(wf)); draft.nodes ||= []; draft.connections ||= {}; }
      return draft;
    },
    changed() { if (draft) flowLayouts.delete(draft); if (sheetIsOpen('wf:' + id)) draw(); },
    discard() { draft = null; draw(); },
    async save() {
      if (!draft || saving) return;
      saving = true; draw();
      try {
        const saved = await API.saveWorkflow(wf, draft);
        wf = { ...wf, ...saved }; draft = null;
        const i = S.workflows.findIndex((w) => String(w.id) === String(wf.id)); if (i >= 0) S.workflows[i] = { ...S.workflows[i], ...wf };
        const pub = publishState(wf);
        toast(pub?.label === 'Unpublished changes' ? 'Saved. Publish it to make the changes live.' : 'Workflow saved');
        hist = null; API.history(id).then((h) => { hist = Array.isArray(h) ? h : []; if (sheetIsOpen('wf:' + id)) draw(); }, () => {});
        render();
      } catch (e) {
        toast(e.status === 409 || /someone else|changes may be lost/i.test(e.message)
          ? 'Someone changed this workflow since you opened it. Discard your changes and open it again.' : e.message, true, 6000);
      }
      saving = false; draw();
    },
  };
  const draw = () => openSheet('wf:' + id, sheetHead(esc(ed.wf?.name || 'Workflow')) + `<div class="sheet-body">${wf ? wfDetailHtml(ed.wf, tab, runs, runsErr, hist, histErr, ed) : '<div class="skeleton"></div>'}</div>
    ${draft ? `<div class="savebar"><span>Unsaved changes</span><button class="btn" id="wf-discard" ${saving ? 'disabled' : ''}>Discard</button><button class="btn primary" id="wf-save" ${saving ? 'disabled' : ''}>${saving ? 'Saving…' : 'Save'}</button></div>` : ''}`, (sh) => {
    sh.querySelectorAll('[data-wtab]').forEach((b) => (b.onclick = () => { tab = b.dataset.wtab; draw(); if (tab === 'runs' && !runs) loadRuns(); }));
    sh.querySelectorAll('[data-ex]').forEach((b) => (b.onclick = () => openExecution(b.dataset.ex)));
    const tg = sh.querySelector('#wf-toggle');
    if (tg) tg.onclick = async () => {
      tg.disabled = true;
      try {
        wf = { ...wf, ...(await API.setActive(wf, !wf.active)) };
        const i = S.workflows.findIndex((w) => String(w.id) === String(wf.id)); if (i >= 0) S.workflows[i] = wf;
        toast(wf.active ? 'Workflow activated' : 'Workflow deactivated'); draw(); render();
      } catch (e) { toast(e.message, true); tg.disabled = false; }
    };
    const pb = sh.querySelector('#wf-publish');
    if (pb) pb.onclick = async () => {
      pb.disabled = true;
      try {
        wf = { ...wf, ...(await API.setActive(wf, true)) };
        const i = S.workflows.findIndex((w) => String(w.id) === String(wf.id)); if (i >= 0) S.workflows[i] = wf;
        toast('Changes published'); draw(); render();
      } catch (e) { toast(e.message, true); pb.disabled = false; }
    };
    const run = sh.querySelector('#wf-run'); if (run) run.onclick = () => openRun(wf);
    const ren = sh.querySelector('#wf-edit'); if (ren) ren.onclick = () => openWfEdit(ed);
    const sv = sh.querySelector('#wf-save'); if (sv) sv.onclick = () => ed.save();
    const dc = sh.querySelector('#wf-discard'); if (dc) dc.onclick = () => { if (confirm('Discard your unsaved changes?')) ed.discard(); };
    if (tab === 'flow') bindFlow(sh, ed.wf, draw, ed);
  }, {
    redraw: () => draw(),
    leave: () => !draft || confirm('Close without saving? Your changes to this workflow will be lost.'),
  });
  const loadRuns = async () => {
    try { runs = await API.executions({ workflowId: id }, 100); } catch (e) { runsErr = e.message; }
    if (sheetIsOpen('wf:' + id)) draw();
  };
  draw();
  // Edit history also tells us who created the workflow (its oldest saved version).
  API.history(id).then((h) => { hist = Array.isArray(h) ? h : []; }, (e) => { histErr = e.message; })
    .then(() => { if (sheetIsOpen('wf:' + id)) draw(); });
  try { wf = await API.workflow(id); if (sheetIsOpen('wf:' + id)) draw(); } catch (e) { if (!wf) { toast(e.message, true); history.back(); } }
  if (tab === 'runs') loadRuns();
}

// Name and description of the workflow.
function openWfEdit(ed) {
  const w = ed.wf;
  openSheet('wfedit', sheetHead('Edit workflow') + `<div class="sheet-body" style="padding-top:14px">
    <label class="field"><span>Name</span><input class="input" id="we-name" value="${esc(w.name)}" maxlength="128"></label>
    <label class="field"><span>Description</span><textarea class="input plain" id="we-desc" placeholder="What this workflow does">${esc(w.description || '')}</textarea></label>
    <p class="help">Changes are kept until you tap <b>Save</b> on the workflow.</p>
    <button class="btn primary block" data-close>Done</button><div class="spacer"></div></div>`, null, {
    leave: () => {
      const sh = $('#sheet'); const name = sh.querySelector('#we-name').value.trim(); const desc = sh.querySelector('#we-desc').value;
      if (!name) { toast('The workflow needs a name', true); return false; }
      if (name !== w.name || desc !== (w.description || '')) {
        const d = ed.begin(); d.name = name; d.description = desc || null; ed.changed();
      }
      return true;
    },
  });
}

function wfDetailHtml(wf, tab, runs, runsErr, hist, histErr, ed) {
  const tabs = [['details', 'Details'], ['flow', 'Flow'], ['runs', 'Runs'], ['history', 'History']];
  let body = '';
  if (tab === 'details') body = wfDetailsTab(wf, hist, ed);
  if (tab === 'flow') body = wfFlowTab(wf, ed);
  if (tab === 'runs') body = runs ? wfRunsTab(runs) : runsErr ? `<div class="alert bad">${esc(runsErr)}</div>` : '<div class="skeleton"></div>';
  if (tab === 'history') body = wfHistoryTab(wf, hist, histErr);
  return `<div class="tabs">${tabs.map(([k, l]) => `<button data-wtab="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>${body}<div class="spacer"></div>`;
}

function wfDetailsTab(wf, hist, ed) {
  // Creator = author of the very first saved version, if n8n still keeps it.
  const first = hist && hist.length ? hist[hist.length - 1] : null;
  const creator = first && Math.abs(new Date(first.createdAt) - new Date(wf.createdAt)) < 120000 ? first.authors : null;
  const pub = publishState(wf); const st = wfRunStats(wf.id); const trg = triggers(wf);
  const s = wf.settings || {};
  return `
    <div class="badges" style="margin-bottom:12px">
      ${wf.active ? '<span class="badge ok"><span class="dot"></span>Active</span>' : '<span class="badge"><span class="dot"></span>Inactive</span>'}
      ${pub ? `<span class="badge ${pub.cls}">${pub.label}</span>` : ''}
      ${(wf.tags || []).map((t) => `<span class="badge">#${esc(t.name)}</span>`).join('')}
    </div>
    <div class="btn-row">
      <button class="btn primary" id="wf-run">${icon('play').replace('<svg', '<svg width="16" height="16"')} Run</button>
      ${wf.isArchived ? '' : `<button class="btn ${wf.active ? 'danger' : ''}" id="wf-toggle">${wf.active ? 'Deactivate' : 'Activate'}</button>`}
    </div>
    ${pub?.label === 'Unpublished changes' && !ed?.dirty ? `<div class="alert warn" style="margin:12px 0 0">The saved version isn't live yet: n8n still runs the published one.
      <button class="btn primary block" id="wf-publish" style="margin-top:10px">Publish changes</button></div>` : ''}
    ${wf.isArchived ? '' : `<div class="btn-row" style="margin-top:8px">
      <button class="btn" id="wf-edit" ${ed?.ready ? '' : 'disabled'}>${icon('pen').replace('<svg', '<svg width="16" height="16"')} Rename</button>
      <button class="btn" data-wtab="flow" ${ed?.ready ? '' : 'disabled'}>Edit steps</button></div>`}
    <div class="section-title">Details</div>
    <div class="card"><dl class="kv">
      <dt>ID</dt><dd class="mono">${esc(wf.id)}</dd>
      <dt>Owner</dt><dd>${esc(owner(wf) || '–')}</dd>
      <dt>Created by</dt><dd>${hist ? esc(creator || 'Not kept by n8n') : '…'}</dd>
      ${wf.description ? `<dt>Description</dt><dd style="word-break:normal">${esc(wf.description)}</dd>` : ''}
      <dt>Created</dt><dd>${fmtDate(wf.createdAt)}</dd>
      <dt>Last edited</dt><dd>${fmtDate(wf.updatedAt)}</dd>
      <dt>Nodes</dt><dd>${(wf.nodes || []).length}</dd>
      <dt>Triggers</dt><dd>${trg.length ? trg.map((t) => esc(triggerLabel(t))).join(', ') : 'None'}</dd>
      ${s.timezone ? `<dt>Timezone</dt><dd>${esc(s.timezone)}</dd>` : ''}
      ${s.errorWorkflow ? `<dt>Error workflow</dt><dd>${esc(wfName(s.errorWorkflow))}</dd>` : ''}
      ${s.executionOrder ? `<dt>Execution order</dt><dd>${esc(s.executionOrder)}</dd>` : ''}
      ${wf.triggerCount != null ? `<dt>Active triggers</dt><dd>${esc(wf.triggerCount)}</dd>` : ''}
    </dl></div>
    <div class="section-title">Recent runs (from loaded sample)</div>
    <div class="grid2">
      <div class="card stat ok"><div class="label">Succeeded</div><div class="value">${st.ok}</div></div>
      <div class="card stat bad"><div class="label">Failed</div><div class="value">${st.bad}</div></div>
    </div>
    <div class="section-title">Open in n8n</div>
    <a class="btn block" href="${esc(baseUrl())}/workflow/${encodeURIComponent(wf.id)}" target="_blank" rel="noopener">Open editor</a>`;
}

// ---------- workflow canvas (like the n8n editor; edits go through the draft in openWorkflow) ----------
// Nodes sit at their saved editor positions (top-left, in canvas pixels) and connections are drawn as
// curves between their ports. AI sub-nodes (models, memory, tools…) are circles wired into the bottom of
// the node that uses them, with dashed lines, as in n8n.
const AI_INPUT_LABELS = {
  ai_languageModel: 'Model', ai_memory: 'Memory', ai_tool: 'Tool', ai_outputParser: 'Parser',
  ai_embedding: 'Embeddings', ai_vectorStore: 'Vector store', ai_document: 'Document', ai_textSplitter: 'Splitter',
  ai_retriever: 'Retriever', ai_reranker: 'Reranker', ai_chain: 'Chain', ai_agent: 'Agent',
};
const AI_ORDER = Object.keys(AI_INPUT_LABELS);
const isSticky = (n) => n.type === 'n8n-nodes-base.stickyNote';
const AI_SUB_TYPES = new Set(); // node types whose only outputs are AI connections (learnt from n8n's node descriptions)
const flowViews = {}; // per workflow: { k, tx, ty, auto, sel, full }
const flowLayouts = new WeakMap();
let flowFullExit = null; // set while a canvas is full screen, so Android's Back button just leaves full screen

// Node icons, the same files the n8n editor shows. Asked for once per node type and kept in memory.
// They are fetched through the app's own HTTP path (so a server password in front of n8n still works) and
// turned into data URLs. If anything fails the node keeps its coloured initials.
const nodeIcons = store.get('n8n.icons', {}); // type -> data URL | null (no icon) ; missing = not asked yet
// n8n's own nodes use icons built into its editor ("node:if", "fa:pen"), which can't be downloaded.
// Draw simple look-alike glyphs for the common ones, in the node's n8n colour.
const GLYPHS = {
  branch: 'M6 3v12M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9a9 9 0 0 1-9 9',
  merge: 'M6 3v6a6 6 0 0 0 12 0V3M12 15v6',
  code: 'M16 18l6-6-6-6M8 6l-6 6 6 6',
  pen: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  pointer: 'M4 4l7 17 2.5-7.5L21 11z',
  globe: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20',
  hook: 'M12 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM11 8.5L7 15.5M13 8.5l4 7M9 18h6',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  form: 'M5 3h14v18H5zM8 8h8M8 12h8M8 16h5',
  sub: 'M3 3h7v7H3zM14 14h7v7h-7zM10 6.5h4a3 3 0 0 1 3 3V14',
  reply: 'M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3',
  split: 'M12 3v8M12 11l-6 10M12 11l6 10',
  join: 'M6 3l6 10 6-10M12 13v8',
  chat: 'M21 12a8 8 0 0 1-12 7l-5 2 2-5A8 8 0 1 1 21 12z',
  db: 'M12 8c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3zM4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  bot: 'M5 9h14v11H5zM12 4v5M9 14v1M15 14v1M2 13v3M22 13v3',
  loop: 'M17 2l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  alert: 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  sort: 'M3 6h18M6 12h12M9 18h6',
  filter: 'M3 4h18l-7 9v6l-4 2v-8z',
};
const GLYPH_FOR = {
  'if': 'branch', 'switch': 'branch', 'filter': 'filter', 'merge': 'merge', 'code': 'code', 'fa:code': 'code', 'fa:pen': 'pen',
  'wait': 'clock', 'schedule-trigger': 'clock', 'fa:clock': 'clock', 'manual-trigger': 'pointer', 'fa:mouse-pointer': 'pointer',
  'http-request': 'globe', 'fa:globe': 'globe', 'webhook': 'hook', 'no-operation': 'arrow', 'fa:arrow-right': 'arrow', 'form-trigger': 'form', 'form': 'form',
  'sub-workflow-trigger': 'sub', 'execute-sub-workflow': 'sub', 'fa:sign-in-alt': 'sub', 'respond-to-webhook': 'reply',
  'split-out': 'split', 'aggregate': 'join', 'chat-trigger': 'chat', 'fa:comments': 'chat', 'simple-memory': 'db', 'fa:database': 'db',
  'ai-agent': 'bot', 'fa:robot': 'bot', 'basic-llm-chain': 'bot', 'fa:link': 'bot', 'fa:th-large': 'loop', 'fa:sync': 'loop', 'fa:sync-alt': 'loop', 'fa:redo': 'loop',
  'error-trigger': 'alert', 'fa:exclamation-triangle': 'alert', 'fa:bolt': 'bolt', 'sort': 'sort', 'fa:sort': 'sort',
};
const ICON_COLORS = {
  green: '#35a35a', azure: '#2f7fe0', amber: '#e3a008', blue: '#3a64d8', crimson: '#d0342c', neutral: '#8a879a', 'light-blue': '#3d9ee0',
  teal: '#1a9c92', magenta: '#c43c9a', violet: '#7a4fd8', 'orange-red': '#e2582b', orange: '#ec8a1c', purple: '#8b4fd8', red: '#d6403a',
  'dark-blue': '#2a4fb0', 'light-green': '#5cb85c', gray: '#8a879a', black: 'var(--fc-text)',
};
function glyphFor(d) {
  const name = typeof d?.icon === 'string' ? d.icon : d?.icon?.light;
  if (!name) return null;
  const key = name.startsWith('node:') ? name.slice(5) : name;
  const g = GLYPH_FOR[key] || (/trigger$/.test(key) ? 'bolt' : null);
  return g ? { g, c: ICON_COLORS[d.iconColor] || ICON_COLORS[d.defaults?.color] || d.defaults?.color || null } : null;
}
const dark = () => !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;
async function loadNodeIcons(wf) {
  const want = new Map();
  (wf.nodes || []).forEach((n) => { if (!isSticky(n) && !(n.type in nodeIcons) && !want.has(n.type)) want.set(n.type, n.typeVersion || 1); });
  if (!want.size) return false;
  want.forEach((_, t) => (nodeIcons[t] = null));
  let types;
  try { types = await api('/node-types', { method: 'POST', body: { nodeInfos: [...want].map(([name, version]) => ({ name, version })) } }); } catch { return false; }
  const toDataUrl = (blob) => new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = bad; r.readAsDataURL(blob); });
  // n8n answers in the order asked, with names that may drop the package prefix ("slack").
  const asked = [...want.keys()]; const list = Array.isArray(types) ? types : [];
  const typeOf = (d, i) => (list.length === asked.length ? asked[i] : asked.find((t) => t === d?.name || t.endsWith('.' + d?.name)));
  await Promise.all(list.map(async (d, i) => {
    const type = typeOf(d, i);
    let url = d?.iconUrl; if (url && typeof url === 'object') url = dark() ? url.dark || url.light : url.light || url.dark;
    if (!type) return;
    if (typeof url !== 'string') { nodeIcons[type] = glyphFor(d); return; } // built into the n8n editor: draw a look-alike
    try {
      const res = await rawFetch('/' + url.replace(/^\/+/, ''), { headers: { Accept: 'image/*' } });
      if (!res.ok) return;
      let blob = await res.blob();
      if (/\.svg$/i.test(url)) blob = new Blob([await blob.text()], { type: 'image/svg+xml' });
      nodeIcons[type] = await toDataUrl(blob);
    } catch {}
  }));
  // Keep them for next time (small SVGs; skip if the cache would grow past ~600 KB).
  const keep = Object.fromEntries(Object.entries(nodeIcons).filter(([, v]) => v));
  if (JSON.stringify(keep).length < 600000) store.set('n8n.icons', keep);
  return true;
}

function flowLayout(wf) {
  if (flowLayouts.has(wf)) return flowLayouts.get(wf);
  const all = wf.nodes || [];
  const conns = wf.connections || {};
  const nodes = all.filter((n) => !isSticky(n));
  const notes = all.filter(isSticky);
  const byName = Object.fromEntries(nodes.map((n) => [n.name, { n }]));
  const raw = []; // { from, type, out, to, in }
  for (const [from, types] of Object.entries(conns)) {
    if (!byName[from]) continue;
    for (const [type, outs] of Object.entries(types || {})) {
      (outs || []).forEach((branch, out) => (branch || []).forEach((c) => {
        if (c && byName[c.node]) raw.push({ from, type, out, to: c.node, in: c.index || 0 });
      }));
    }
  }
  for (const L of Object.values(byName)) {
    const { n } = L; const p = n.parameters || {};
    const outs = raw.filter((e) => e.from === n.name);
    const ins = raw.filter((e) => e.to === n.name);
    const mainOut = Math.max(0, ...outs.filter((e) => e.type === 'main').map((e) => e.out + 1));
    const aiOut = outs.some((e) => e.type !== 'main');
    L.aiIn = [...new Set(ins.filter((e) => e.type !== 'main').map((e) => e.type))]
      .sort((a, b) => (AI_ORDER.indexOf(a) + 1 || 99) - (AI_ORDER.indexOf(b) + 1 || 99));
    L.sub = (aiOut && !mainOut) || (!outs.length && AI_SUB_TYPES.has(n.type)); // a "sub-node" (model, memory, tool…)
    L.trigger = isTrigger(n);
    // outputs
    const t = n.type.split('.').pop();
    let labels = [];
    if (t === 'if') labels = ['true', 'false'];
    else if (t === 'switch') {
      // One output per rule (n8n 1.x+ Switch), plus "Fallback" when set to its own output.
      const rules = p.rules?.values || p.rules?.rules || [];
      const k = p.mode === 'expression' ? Number(p.numberOutputs) || 4 : (n.typeVersion || 1) < 3 ? 4 : rules.length;
      labels = Array.from({ length: k }, (_, i) => String((p.mode !== 'expression' && rules[i]?.renameOutput && rules[i]?.outputKey) || i));
      if (p.options?.fallbackOutput === 'extra') labels.push('Fallback');
    }
    else if (t === 'filter' && n.parameters?.options?.allowedOutputs) labels = ['kept', 'discarded'];
    else if (t === 'splitInBatches' && (n.typeVersion || 1) >= 3) labels = ['done', 'loop'];
    let nOut = L.sub ? 0 : Math.max(1, mainOut, labels.length);
    if (n.onError === 'continueErrorOutput' && !L.sub) {
      nOut = Math.max(nOut, (labels.length || 1) + 1);
      while (labels.length < nOut - 1) labels.push('');
      labels[nOut - 1] = 'error';
    }
    L.outLabels = labels; L.nOut = nOut;
    const mainIn = Math.max(0, ...ins.filter((e) => e.type === 'main').map((e) => e.in + 1));
    L.nIn = L.trigger || L.sub ? 0 : Math.max(1, mainIn, t === 'merge' ? Number(p.numberInputs) || 2 : 0);
    // size
    if (L.sub) { L.w = 80; L.h = 80; } else if (L.aiIn.length) { L.w = Math.max(240, L.aiIn.length * 80 + 40); L.h = 100; } else { L.w = 100; L.h = 100; }
    const [x, y] = Array.isArray(n.position) ? n.position : [0, 0];
    L.x = Number(x) || 0; L.y = Number(y) || 0;
  }
  const outPt = (L, i) => [L.x + L.w, L.y + (L.h * (i + 1)) / (L.nOut + 1)];
  const inPt = (L, i) => [L.x, L.y + (L.h * (i + 1)) / (L.nIn + 1)];
  const aiPt = (L, type) => { const i = Math.max(0, L.aiIn.indexOf(type)); return [L.x + (L.w * (i + 1)) / (L.aiIn.length + 1), L.y + L.h]; };
  const edges = raw.map((e) => {
    const A = byName[e.from], B = byName[e.to];
    if (e.type !== 'main') {
      const [sx, sy] = [A.x + A.w / 2, A.y]; const [tx, ty] = aiPt(B, e.type);
      const dy = Math.max(30, Math.abs(sy - ty) / 2);
      return { ...e, ai: true, d: `M${sx},${sy} C${sx},${sy - dy} ${tx},${ty + dy} ${tx},${ty}` };
    }
    const [sx, sy] = outPt(A, Math.min(e.out, A.nOut - 1)); const [tx, ty] = inPt(B, Math.min(e.in, Math.max(0, B.nIn - 1)));
    const err = A.outLabels[e.out] === 'error';
    if (tx - sx >= 40) {
      const c = Math.max(40, (tx - sx) / 2);
      return { ...e, err, d: `M${sx},${sy} C${sx + c},${sy} ${tx - c},${ty} ${tx},${ty}` };
    }
    // Goes backwards (a loop): run under both nodes, like n8n does.
    const by = Math.max(A.y + A.h, B.y + B.h) + 50;
    return { ...e, err, d: `M${sx},${sy} C${sx + 60},${sy} ${sx + 60},${by} ${sx},${by} L${tx},${by} C${tx - 60},${by} ${tx - 60},${ty} ${tx},${ty}` };
  });
  // bounds, including labels under nodes and sticky notes
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const grow = (x1, y1, x2, y2) => { minX = Math.min(minX, x1); minY = Math.min(minY, y1); maxX = Math.max(maxX, x2); maxY = Math.max(maxY, y2); };
  Object.values(byName).forEach((L) => grow(L.x - 30, L.y - 10, L.x + L.w + 30, L.y + L.h + (L.aiIn.length ? 40 : 52)));
  edges.forEach((e) => (e.d.match(/-?\d+(\.\d+)?,-?\d+(\.\d+)?/g) || []).forEach((pt) => { const [x, y] = pt.split(',').map(Number); grow(x, y, x, y); }));
  const stickies = notes.map((n) => {
    const p = n.parameters || {}; const [x, y] = Array.isArray(n.position) ? n.position : [0, 0];
    const s = { n, x: Number(x) || 0, y: Number(y) || 0, w: Number(p.width) || 240, h: Number(p.height) || 160, color: Number(p.color) || 1, text: String(p.content || '') };
    grow(s.x, s.y, s.x + s.w, s.y + s.h); return s;
  });
  // Node groups (n8n 2.x): a dashed frame with a title bar around the nodes it holds.
  const byId = Object.fromEntries(Object.values(byName).filter((L) => L.n.id).map((L) => [L.n.id, L]));
  const groups = (Array.isArray(wf.nodeGroups) ? wf.nodeGroups : []).map((grp) => {
    const mem = (grp.nodeIds || []).map((id) => byId[id]).filter(Boolean);
    if (!mem.length) return null;
    const x1 = Math.min(...mem.map((L) => L.x)) - 40, x2 = Math.max(...mem.map((L) => L.x + L.w)) + 40;
    const y1 = Math.min(...mem.map((L) => L.y)) - 90, y2 = Math.max(...mem.map((L) => L.y + L.h)) + 70;
    grow(x1, y1, x2, y2);
    return { name: String(grp.name || 'Group'), description: grp.description ? String(grp.description) : '', x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }).filter(Boolean);
  if (minX === Infinity) { minX = 0; minY = 0; maxX = 100; maxY = 100; }
  const out = { nodes: byName, edges, stickies, groups, raw, box: { x: minX, y: minY, w: maxX - minX, h: maxY - minY } };
  flowLayouts.set(wf, out);
  return out;
}

function nodeShape(L) {
  const { x, y, w, h } = L;
  if (L.sub) return `<circle cx="${x + w / 2}" cy="${y + h / 2}" r="${w / 2}"/>`;
  if (L.trigger) {
    const R = 36, r = 8;
    return `<path d="M${x + R},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} H${x + R} A${R},${R} 0 0 1 ${x},${y + h - R} V${y + R} A${R},${R} 0 0 1 ${x + R},${y} Z"/>`;
  }
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8"/>`;
}

function wrapLabel(text, perLine, maxLines) {
  const words = String(text).split(/\s+/); const lines = []; let cur = '';
  for (const wd of words) {
    if (!cur) cur = wd; else if ((cur + ' ' + wd).length <= perLine) cur += ' ' + wd; else { lines.push(cur); cur = wd; }
  }
  if (cur) lines.push(cur);
  const out = lines.slice(0, maxLines).map((l) => (l.length > perLine ? l.slice(0, perLine - 1) + '…' : l));
  if (lines.length > maxLines) out[maxLines - 1] = out[maxLines - 1].replace(/…?$/, '').slice(0, perLine - 1) + '…';
  return out;
}

function stickyText(md) {
  return md.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/^#+\s*/gm, '').replace(/[*_`~]/g, '').trim();
}

function flowSvgInner(wf, sel) {
  const F = flowLayout(wf);
  const stickies = F.stickies.map((s) => `<g class="fs fs-${Math.min(7, Math.max(1, s.color))}">
      <rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="6"/>
      <foreignObject x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}"><div xmlns="http://www.w3.org/1999/xhtml" class="fs-text">${esc(stickyText(s.text))}</div></foreignObject>
    </g>`).join('');
  const groups = F.groups.map((gr) => {
    const per = Math.max(8, Math.floor((gr.w - 32) / 8.5));
    return `<g class="fg">
      <rect class="fg-body" x="${gr.x}" y="${gr.y}" width="${gr.w}" height="${gr.h}" rx="10"/>
      <rect class="fg-head" x="${gr.x}" y="${gr.y}" width="${gr.w}" height="${gr.description ? 56 : 40}" rx="8"/>
      <text class="fg-name" x="${gr.x + 16}" y="${gr.y + 26}">${esc(wrapLabel(gr.name, per, 1)[0])}</text>
      ${gr.description ? `<text class="fg-desc" x="${gr.x + 16}" y="${gr.y + 45}">${esc(wrapLabel(gr.description, Math.floor(per * 1.25), 1)[0])}</text>` : ''}
    </g>`;
  }).join('');
  const edges = F.edges.map((e) => `<path class="fe${e.ai ? ' ai' : ''}${e.err ? ' err' : ''}${sel && (e.from === sel || e.to === sel) ? ' hl' : ''}" d="${e.d}"${e.ai ? '' : ' marker-end="url(#fa)"'}/>`).join('');
  const nodes = Object.values(F.nodes).map((L) => {
    const { n, x, y, w, h } = L; const cx = x + w / 2, cy = y + h / 2;
    const col = `hsl(${hue(n.type)} 60% 46%)`;
    const ports = [];
    for (let i = 0; i < L.nIn; i++) ports.push(`<rect class="fp" x="${x - 4}" y="${y + (h * (i + 1)) / (L.nIn + 1) - 6}" width="8" height="12" rx="2"/>`);
    for (let i = 0; i < L.nOut; i++) {
      const py = y + (h * (i + 1)) / (L.nOut + 1); const lab = L.outLabels[i];
      ports.push(`<circle class="fp" cx="${x + w}" cy="${py}" r="6"/>`);
      if (lab) ports.push(`<text class="fpl${lab === 'error' ? ' err' : ''}" x="${x + w + 10}" y="${py - 8}">${esc(lab)}</text>`);
    }
    L.aiIn.forEach((t, i) => {
      const px = x + (w * (i + 1)) / (L.aiIn.length + 1);
      ports.push(`<path class="fp" d="M${px},${y + h - 6} l6,6 l-6,6 l-6,-6 z"/><text class="fpl mid" x="${px}" y="${y + h + 24}">${esc(AI_INPUT_LABELS[t] || t.replace(/^ai_/, ''))}</text>`);
    });
    if (L.sub) ports.push(`<path class="fp" d="M${cx},${y - 6} l6,6 l-6,6 l-6,-6 z"/>`);
    const lines = wrapLabel(n.name, L.aiIn.length ? 30 : 18, 2);
    const ly = L.aiIn.length ? y + h + 44 : y + h + 20;
    const label = L.aiIn.length
      ? wrapLabel(n.name, Math.floor((w - 74) / 7.5), 2).map((l, i, a) => `<text class="fn-in" x="${x + 64}" y="${cy + 5 - (a.length - 1) * 8 + i * 16}">${esc(l)}</text>`).join('')
      : lines.map((l, i) => `<text class="fn-name" x="${cx}" y="${ly + i * 16}">${esc(l)}</text>`).join('');
    const icoX = L.aiIn.length ? x + 34 : cx;
    return `<g class="fnode${n.disabled ? ' off' : ''}${sel === n.name ? ' sel' : ''}" data-node="${esc(n.name)}">
      <g class="fbody">${nodeShape(L)}</g>
      ${nodeIcons[n.type]?.g && GLYPHS[nodeIcons[n.type].g]
        ? `<svg x="${icoX - 18}" y="${cy - 18}" width="36" height="36" viewBox="0 0 24 24" class="fglyph" style="stroke:${esc(nodeIcons[n.type].c || `hsl(${hue(n.type)} 60% 46%)`)}"><path d="${GLYPHS[nodeIcons[n.type].g]}"/></svg>`
        : typeof nodeIcons[n.type] === 'string'
        ? `<image href="${esc(nodeIcons[n.type])}" x="${icoX - 20}" y="${cy - 20}" width="40" height="40" preserveAspectRatio="xMidYMid meet"/>`
        : `<rect x="${icoX - 20}" y="${cy - 20}" width="40" height="40" rx="10" fill="${col}"/>
      <text class="fico" x="${icoX}" y="${cy + 6}">${esc(initials(shortType(n.type)))}</text>`}
      ${L.trigger ? `<path class="fbolt" d="M${x - 22},${cy - 12} l-7,13 h6 l-3,11 l9,-15 h-6 l4,-9 z"/>` : ''}
      ${n.disabled ? `<line class="foff" x1="${x + 6}" y1="${y + 6}" x2="${x + w - 6}" y2="${y + h - 6}"/>` : ''}
      ${ports.join('')}
      ${label}
    </g>`;
  }).join('');
  return `<defs><marker id="fa" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="fah"/></marker>
    <pattern id="fdots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" class="fdot"/></pattern></defs>
    ${stickies}${groups}<g class="fedges">${edges}</g>${nodes}`;
}

function wfFlowTab(wf, ed) {
  const real = (wf.nodes || []).filter((n) => !isSticky(n));
  if (!real.length) return `<div class="card empty">This workflow has no nodes.${ed?.ready ? '<br><br><button class="btn primary" id="fadd-first">Add a first step</button>' : ''}</div>`;
  const v = flowViews[wf.id] || {};
  const steps = orderedNodes(wf).filter((n) => !isSticky(n));
  return `<div class="fcanvas${v.full ? ' full' : ''}" id="fcanvas">
      <svg class="fsvg" xmlns="http://www.w3.org/2000/svg"><rect class="fbg" width="100%" height="100%"/>
        <g class="fview">${flowSvgInner(wf, v.sel)}</g></svg>
      <div class="ftools">
        <button class="icon-btn" data-fz="in" aria-label="Zoom in">${icon('plus')}</button>
        <button class="icon-btn" data-fz="out" aria-label="Zoom out">${icon('minus')}</button>
        <button class="icon-btn" data-fz="fit" aria-label="Fit to screen">${icon('fit')}</button>
        <button class="icon-btn" data-fz="full" aria-label="Full screen">${icon(v.full ? 'shrink' : 'expand')}</button>
        ${ed?.ready ? `<button class="icon-btn fadd" data-fz="add" aria-label="Add a step">${icon('plus')}</button>` : ''}
      </div>
      ${v.full && ed?.dirty ? `<button class="btn primary fsave" id="fsave">${icon('save').replace('<svg', '<svg width="16" height="16"')} Save</button>` : ''}
      <div class="finfo" id="finfo" ${v.sel ? '' : 'hidden'}>${v.sel ? flowInfoHtml(wf, v.sel, ed) : ''}</div>
    </div>
    <p class="help">${ed?.ready
      ? 'Drag to move around, pinch to zoom. Tap a step to edit, connect or delete it; drag a selected step to move it. Pink <b>+</b> adds a step. Nothing changes in n8n until you tap <b>Save</b>.'
      : 'Drag to move, pinch to zoom, tap a node for its details.'}</p>
    <details class="fsteps"><summary>Steps as a list (${steps.length})</summary>
    <div class="flow">${steps.map((n, i) => `${i ? '<div class="connector"></div>' : ''}
      <div class="node ${n.disabled ? 'disabled' : ''}">
        <div class="n-ico" style="${isTrigger(n) ? 'background:var(--accent);color:#fff' : ''}">${esc(initials(shortType(n.type)))}</div>
        <div class="n-main"><div class="n-name">${esc(n.name)}</div><div class="n-type">${esc(shortType(n.type))}${n.disabled ? ' · disabled' : ''}</div></div>
      </div>`).join('')}</div></details>`;
}

function flowInfoHtml(wf, name, ed) {
  const F = flowLayout(wf); const L = F.nodes[name]; if (!L) return '';
  const { n } = L;
  const to = [...new Set(F.raw.filter((e) => e.from === name).map((e) => e.to))];
  const from = [...new Set(F.raw.filter((e) => e.to === name).map((e) => e.from))];
  const params = n.parameters && Object.keys(n.parameters).length ? JSON.stringify(n.parameters, null, 2) : '';
  return `<div class="finfo-head"><div class="finfo-title"><b>${esc(n.name)}</b><span>${esc(shortType(n.type))}${n.typeVersion ? ' · v' + esc(n.typeVersion) : ''}${n.disabled ? ' · deactivated' : ''}${L.trigger ? ' · trigger' : ''}</span></div>
      <button class="icon-btn" data-fclose aria-label="Close">${icon('close')}</button></div>
    ${n.notes ? `<div class="finfo-notes">${esc(n.notes)}</div>` : ''}
    <dl class="kv">
      ${from.length ? `<dt>From</dt><dd>${from.map((x) => `<a href="#" data-fgo="${esc(x)}">${esc(x)}</a>`).join(', ')}</dd>` : ''}
      ${to.length ? `<dt>Goes to</dt><dd>${to.map((x) => `<a href="#" data-fgo="${esc(x)}">${esc(x)}</a>`).join(', ')}</dd>` : ''}
      ${n.credentials ? `<dt>Credentials</dt><dd>${Object.values(n.credentials).map((c) => esc(c?.name || '')).join(', ')}</dd>` : ''}
    </dl>
    ${params ? `<details><summary>Settings</summary><pre class="json">${esc(params)}</pre></details>` : ''}
    ${ed?.ready ? `<div class="btn-row finfo-acts">
      <button class="btn primary" data-fedit>${icon('pen').replace('<svg', '<svg width="16" height="16"')} Edit</button>
      ${L.sub ? '' : `<button class="btn" data-fadd>${icon('plus').replace('<svg', '<svg width="16" height="16"')} Add after</button>`}
      <button class="btn danger" data-fdel aria-label="Delete">${icon('trash').replace('<svg', '<svg width="16" height="16"')}</button></div>` : ''}`;
}

function bindFlow(root, wf, redraw, ed) {
  const first = root.querySelector('#fadd-first'); if (first) first.onclick = () => openAddNode(ed, null);
  const box = root.querySelector('#fcanvas'); if (!box) return;
  const svg = box.querySelector('svg'); const g = svg.querySelector('.fview');
  const v = (flowViews[wf.id] ||= { k: 1, tx: 0, ty: 0, auto: true, sel: null, full: false });
  const apply = () => g.setAttribute('transform', `translate(${v.tx},${v.ty}) scale(${v.k})`);
  const clampK = (k) => Math.min(3, Math.max(0.12, k));
  // Fit the whole workflow, but never so small that names can't be read on a phone: then start at
  // the left (where the trigger usually is) and let the user drag along.
  const fit = (all) => {
    const W = svg.clientWidth || 300, H = svg.clientHeight || 300, pad = 24, b = flowLayout(wf).box;
    const whole = Math.min((W - pad * 2) / b.w, (H - pad * 2) / b.h, 1.2);
    v.k = clampK(all ? whole : Math.max(whole, Math.min(0.55, (H - pad * 2) / b.h)));
    v.tx = b.w * v.k <= W - pad * 2 ? (W - b.w * v.k) / 2 - b.x * v.k : pad - b.x * v.k;
    v.ty = b.h * v.k <= H - pad * 2 ? (H - b.h * v.k) / 2 - b.y * v.k : pad - b.y * v.k;
    apply();
  };
  const zoomAt = (k, px, py) => {
    k = clampK(k); v.tx = px - ((px - v.tx) * k) / v.k; v.ty = py - ((py - v.ty) * k) / v.k; v.k = k; v.auto = false; apply();
  };
  if (v.auto) requestAnimationFrame(() => fit()); else apply();

  const info = box.querySelector('#finfo');
  const select = (name, center) => {
    v.sel = name;
    g.innerHTML = flowSvgInner(wf, name);
    info.hidden = !name; info.innerHTML = name ? flowInfoHtml(wf, name, ed) : '';
    bindInfo();
    if (name && center) {
      const L = flowLayout(wf).nodes[name]; const W = svg.clientWidth, H = svg.clientHeight;
      if (L) { v.tx = W / 2 - (L.x + L.w / 2) * v.k; v.ty = H / 3 - (L.y + L.h / 2) * v.k; v.auto = false; apply(); }
    }
  };
  const bindInfo = () => {
    info.querySelector('[data-fclose]')?.addEventListener('click', () => select(null));
    info.querySelectorAll('[data-fgo]').forEach((a) => a.addEventListener('click', (ev) => { ev.preventDefault(); select(a.dataset.fgo, true); }));
    info.querySelector('[data-fedit]')?.addEventListener('click', () => openNodeEditor(ed, v.sel));
    info.querySelector('[data-fadd]')?.addEventListener('click', () => openAddNode(ed, v.sel));
    info.querySelector('[data-fdel]')?.addEventListener('click', () => {
      const name = v.sel; if (!name || !confirm(`Delete the step “${name}”?`)) return;
      deleteNode(ed.begin(), name); v.sel = null; v.auto = false; ed.changed();
    });
  };
  bindInfo();
  loadNodeIcons(wf).then((got) => { if (got && box.isConnected) g.innerHTML = flowSvgInner(wf, v.sel); });
  const fsave = box.querySelector('#fsave'); if (fsave) fsave.onclick = () => ed.save();

  box.querySelectorAll('[data-fz]').forEach((b) => (b.onclick = () => {
    const W = svg.clientWidth, H = svg.clientHeight;
    if (b.dataset.fz === 'in') zoomAt(v.k * 1.3, W / 2, H / 2);
    if (b.dataset.fz === 'out') zoomAt(v.k / 1.3, W / 2, H / 2);
    if (b.dataset.fz === 'fit') { v.auto = false; fit(true); }
    if (b.dataset.fz === 'add') openAddNode(ed, v.sel);
    if (b.dataset.fz === 'full') {
      if (v.full) { history.back(); return; } // popstate runs flowFullExit
      v.full = true; v.auto = true; history.pushState({ flowFull: 1 }, '');
      flowFullExit = () => { v.full = false; v.auto = true; redraw(); };
      redraw();
    }
  }));

  // Pan with one finger (or the mouse), pinch with two. Dragging the selected step moves it.
  const pts = new Map(); let start = null; let moved = false; let drag = null; let frame = 0;
  const local = (ev) => { const r = svg.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };
  const hitNode = (ev) => document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.('[data-node]')?.dataset.node || null;
  const snapshot = () => {
    const p = [...pts.values()];
    if (p.length >= 2) {
      const [a, b] = p; start = { k: v.k, tx: v.tx, ty: v.ty, d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2 };
    } else if (p.length === 1) start = { k: v.k, tx: v.tx, ty: v.ty, x: p[0][0], y: p[0][1] };
  };
  svg.addEventListener('pointerdown', (ev) => {
    svg.setPointerCapture?.(ev.pointerId); pts.set(ev.pointerId, local(ev)); if (pts.size === 1) moved = false;
    drag = null;
    if (pts.size === 1 && ed?.ready && v.sel && hitNode(ev) === v.sel) {
      const n = (wf.nodes || []).find((x) => x.name === v.sel);
      if (n) drag = { name: n.name, pos: Array.isArray(n.position) ? n.position.map(Number) : [0, 0] };
    }
    snapshot();
  });
  svg.addEventListener('pointermove', (ev) => {
    if (!pts.has(ev.pointerId)) return; pts.set(ev.pointerId, local(ev)); const p = [...pts.values()];
    if (p.length >= 2 && start?.d) {
      drag = null;
      const [a, b] = p; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      const k = clampK(start.k * (d / start.d));
      v.tx = mx - ((start.mx - start.tx) * k) / start.k; v.ty = my - ((start.my - start.ty) * k) / start.k; v.k = k;
      moved = true; v.auto = false; apply();
    } else if (p.length === 1 && start && start.x != null) {
      const dx = p[0][0] - start.x, dy = p[0][1] - start.y;
      if (!moved && Math.hypot(dx, dy) < 6) return;
      moved = true; v.auto = false;
      if (drag) {
        if (wf !== ed.wf || !ed.dirty) wf = ed.begin();
        const n = wf.nodes.find((x) => x.name === drag.name); if (!n) return;
        const snap = (x) => Math.round(x / 20) * 20;
        n.position = [snap(drag.pos[0] + dx / v.k), snap(drag.pos[1] + dy / v.k)];
        flowLayouts.delete(wf);
        if (!frame) frame = requestAnimationFrame(() => { frame = 0; g.innerHTML = flowSvgInner(wf, v.sel); });
        return;
      }
      v.tx = start.tx + dx; v.ty = start.ty + dy; apply();
    }
  });
  const end = (ev) => {
    if (!pts.has(ev.pointerId)) return;
    pts.delete(ev.pointerId);
    if (!pts.size && drag) { drag = null; if (moved) { ed.changed(); return; } }
    if (!pts.size && !moved && ev.type === 'pointerup') select(hitNode(ev));
    snapshot();
  };
  svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
  svg.addEventListener('wheel', (ev) => {
    ev.preventDefault(); const [x, y] = local(ev); zoomAt(v.k * Math.exp(-ev.deltaY * 0.0015), x, y);
  }, { passive: false });
}

// ---------- editing workflows ----------
// All edits change the workflow's draft copy (see openWorkflow); nothing reaches n8n until Save.
const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); }));
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const reEsc = (t) => String(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const stripHtml = (t) => String(t || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');

function uniqueName(wf, base) {
  const names = new Set((wf.nodes || []).map((n) => n.name));
  if (!names.has(base)) return base;
  const stem = base.replace(/\d+$/, '');
  for (let i = 1; ; i++) if (!names.has(stem + i)) return stem + i;
}
function forEachBranch(wf, fn) { // fn(from, type, outIndex, branchArray)
  for (const [from, types] of Object.entries(wf.connections || {})) for (const [type, outs] of Object.entries(types || {})) (outs || []).forEach((b, i) => fn(from, type, i, b, outs));
}
function connectNodes(wf, from, type, out, to, input = 0) {
  const outs = ((wf.connections[from] ||= {})[type] ||= []);
  while (outs.length <= out) outs.push([]);
  outs[out] ||= [];
  if (!outs[out].some((c) => c.node === to && (c.index || 0) === input)) outs[out].push({ node: to, type, index: input });
}
function disconnectNodes(wf, from, type, out, to, input = 0) {
  const b = wf.connections[from]?.[type]?.[out];
  if (b) wf.connections[from][type][out] = b.filter((c) => !(c.node === to && (c.index || 0) === input));
}
function deleteNode(wf, name) {
  const node = wf.nodes.find((n) => n.name === name);
  // Like n8n: a step with one way in and one way out is cut out of the chain, joining its neighbours.
  const ins = []; forEachBranch(wf, (from, type, i, b) => (b || []).forEach((c) => { if (type === 'main' && c.node === name) ins.push({ from, out: i }); }));
  const outs = wf.connections[name]?.main || [];
  const heal = ins.length === 1 && outs.filter((b) => b?.length).length === 1 && outs[0]?.length ? outs[0].map((c) => ({ ...c })) : [];
  wf.nodes = wf.nodes.filter((n) => n.name !== name);
  delete wf.connections[name];
  forEachBranch(wf, (_f, _t, i, b, outs) => { if (Array.isArray(b)) outs[i] = b.filter((c) => c.node !== name); });
  if (wf.pinData) delete wf.pinData[name];
  if (node?.id && Array.isArray(wf.nodeGroups)) wf.nodeGroups.forEach((g) => { if (Array.isArray(g.nodeIds)) g.nodeIds = g.nodeIds.filter((x) => x !== node.id); });
  heal.forEach((c) => { if (c.node !== ins[0].from) connectNodes(wf, ins[0].from, 'main', ins[0].out, c.node, c.index || 0); });
}
// Expressions that point at a step by name ($('Name'), $node["Name"], $items("Name")) follow a rename, like in n8n.
function renameRefs(v, from, to) {
  if (typeof v === 'string') {
    if (!v.includes(from)) return v;
    const q = reEsc(from);
    return v.replace(new RegExp(`(\\$\\(\\s*|\\$node\\[\\s*|\\$items\\(\\s*)(['"\`])${q}\\2`, 'g'), (_m, a, c) => `${a}${c}${to}${c}`)
      .replace(new RegExp(`\\$node\\.${q}(?![\\w$])`, 'g'), /^[A-Za-z_$][\w$]*$/.test(to) ? `$node.${to}` : `$node["${to}"]`);
  }
  if (Array.isArray(v)) return v.map((x) => renameRefs(x, from, to));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, renameRefs(x, from, to)]));
  return v;
}
function renameNode(wf, from, to) {
  for (const n of wf.nodes) { if (n.name === from) n.name = to; n.parameters = renameRefs(n.parameters, from, to); }
  if (wf.connections[from]) { wf.connections[to] = wf.connections[from]; delete wf.connections[from]; }
  forEachBranch(wf, (_f, _t, _i, b) => (b || []).forEach((c) => { if (c.node === from) c.node = to; }));
  if (wf.pinData?.[from]) { wf.pinData[to] = wf.pinData[from]; delete wf.pinData[from]; }
}

// n8n node descriptions (fields, options, credentials), asked for per type and version.
const nodeDescs = {};
async function nodeDesc(type, version) {
  const k = `${type}@${version}`;
  if (!(k in nodeDescs)) {
    nodeDescs[k] = api('/node-types', { method: 'POST', body: { nodeInfos: [{ name: type, version }] } })
      .then((r) => { const d = Array.isArray(r) ? r[0] || null : null; noteSubType(type, d); return d; }, () => null);
  }
  return nodeDescs[k];
}
function noteSubType(type, d) {
  const outs = Array.isArray(d?.outputs) ? d.outputs.map((o) => (typeof o === 'string' ? o : o?.type)) : null;
  if (outs?.length && outs.every((o) => /^ai_/.test(o || ''))) AI_SUB_TYPES.add(type);
}
function aiOutputType(d) {
  const o = Array.isArray(d?.outputs) ? d.outputs.map((x) => (typeof x === 'string' ? x : x?.type)).find((x) => /^ai_/.test(x || '')) : null;
  return o || null;
}
let credCache = null;
async function credentialList() {
  if (!credCache) credCache = api('/credentials').then((r) => (Array.isArray(r) ? r : []), () => { credCache = null; return []; });
  return credCache;
}

// All node types this n8n has (the same list its editor loads), newest version of each.
let catalog = null;
async function nodeCatalog() {
  if (catalog) return catalog;
  const res = await rawFetch('/types/nodes.json');
  if (!res.ok) throw new ApiError(`Couldn't load the list of steps (HTTP ${res.status}).`, res.status);
  const all = await res.json();
  const best = new Map();
  for (const t of Array.isArray(all) ? all : []) {
    if (!t?.name || t.hidden || isSticky({ type: t.name })) continue;
    const ver = Array.isArray(t.version) ? Math.max(...t.version) : Number(t.version) || 1;
    const cur = best.get(t.name);
    if (!cur || ver > cur.ver) best.set(t.name, { ver, t });
  }
  catalog = [...best.values()].map(({ ver, t }) => {
    noteSubType(t.name, t);
    return {
      type: t.name, version: t.defaultVersion ?? ver, displayName: t.displayName || shortType(t.name), description: stripHtml(t.description),
      trigger: (t.group || []).includes('trigger') || /trigger$/i.test(t.name), defaultsName: t.defaults?.name,
      webhook: Array.isArray(t.webhooks) && t.webhooks.length > 0, sub: AI_SUB_TYPES.has(t.name), aiType: aiOutputType(t),
      search: `${t.displayName} ${t.name.split('.').pop()} ${(t.codex?.alias || []).join(' ')}`.toLowerCase(),
    };
  }).sort((a, b) => a.displayName.localeCompare(b.displayName));
  return catalog;
}

function placeNewNode(wf, after, sub) {
  const F = flowLayout(wf); const boxes = Object.values(F.nodes);
  const taken = (x, y) => boxes.some((L) => x < L.x + L.w + 40 && x + 100 > L.x - 40 && y < L.y + L.h + 40 && y + 100 > L.y - 40);
  let x = 0, y = 0;
  const A = after && F.nodes[after];
  if (A && sub) { x = A.x + 20; y = A.y + A.h + 120; }
  else if (A) { x = A.x + A.w + 120; y = A.y; }
  else if (boxes.length) {
    const roots = boxes.filter((L) => !L.sub);
    const R = (sub && roots.filter((L) => L.aiIn.length).pop()) || roots.reduce((m, L) => (!m || L.x + L.w > m.x + m.w ? L : m), null);
    if (R && sub) { x = R.x + 20; y = R.y + R.h + 120; } // AI parts go under the step that uses them
    else if (R) { x = R.x + R.w + 120; y = R.y; }
  }
  while (taken(x, y)) { if (sub) x += 120; else y += 140; }
  return [Math.round(x / 20) * 20, Math.round(y / 20) * 20];
}
function addNodeTo(ed, item, after) {
  const d = ed.begin();
  const name = uniqueName(d, item.defaultsName || item.displayName);
  const node = { parameters: {}, id: uuid(), name, type: item.type, typeVersion: item.version, position: placeNewNode(d, after, item.sub) };
  if (item.webhook) node.webhookId = uuid();
  d.nodes.push(node);
  const fromL = after && flowLayout(d).nodes[after];
  if (fromL && !fromL.sub && item.sub && item.aiType && /langchain/i.test(fromL.n.type) && !fromL.trigger) connectNodes(d, name, item.aiType, 0, after, 0); // a model/tool/memory for that step
  else if (fromL && !fromL.sub && !item.trigger && !item.sub) connectNodes(d, after, 'main', 0, name, 0);
  (flowViews[d.id] ||= { k: 1, tx: 0, ty: 0, auto: false, sel: null, full: false }).sel = name;
  flowViews[d.id].auto = false;
  ed.changed();
  return name;
}

function openAddNode(ed, after) {
  if (!ed?.ready) return;
  let q = ''; let list = null; let err = null;
  const draw = () => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const hits = list ? list.filter((t) => words.every((w) => t.search.includes(w)))
      .sort((a, b) => (words[0] ? (b.displayName.toLowerCase().startsWith(words[0]) - a.displayName.toLowerCase().startsWith(words[0])) : 0)) : [];
    const html = sheetHead('Add a step') + `<div class="sheet-body">
      ${after ? `<p class="help">It will run after <b>${esc(after)}</b> (AI models, memory and tools get attached to it instead).</p>` : '<p class="help">It won\'t be connected yet; connect it from its settings.</p>'}
      <div class="search"><input class="input" id="an-q" type="search" placeholder="Search steps, e.g. HTTP, Slack, Code" value="${esc(q)}" autocomplete="off"></div>
      ${err ? `<div class="alert bad">${esc(err)}</div>` : !list ? '<div class="skeleton"></div>'
        : `<div class="list">${hits.slice(0, 80).map((t) => `<button class="row" data-add="${esc(t.type)}">
            ${typeof nodeIcons[t.type] === 'string' ? `<img class="an-ico" src="${esc(nodeIcons[t.type])}" alt="">` : `<span class="an-ico ph" style="background:hsl(${hue(t.type)} 60% 46%)">${esc(initials(t.displayName))}</span>`}
            <div class="main"><div class="title">${esc(t.displayName)}</div><div class="meta">${esc(t.description || shortType(t.type))}</div></div>
            ${t.trigger ? '<span class="badge">Trigger</span>' : t.sub ? '<span class="badge">AI</span>' : ''}</button>`).join('') || '<div class="empty">No steps match</div>'}</div>
          ${hits.length > 80 ? `<p class="help">${hits.length - 80} more: type more to narrow it down.</p>` : ''}`}
      <div class="spacer"></div></div>`;
    openSheet('addnode', html, (sh) => {
      const inp = sh.querySelector('#an-q');
      inp.oninput = () => { q = inp.value; const pos = inp.selectionStart; draw(); const n = $('#an-q'); n.focus(); n.setSelectionRange(pos, pos); };
      sh.querySelectorAll('[data-add]').forEach((b) => (b.onclick = () => {
        const item = list.find((t) => t.type === b.dataset.add); if (!item) return;
        const name = addNodeTo(ed, item, after);
        afterPop = () => openNodeEditor(ed, name);
        history.back();
      }));
    });
  };
  draw();
  nodeCatalog().then((c) => { list = c; }, (e) => { err = e.message; }).then(() => { if (sheetIsOpen('addnode')) draw(); });
}

// ----- the step editor -----
// Shows the step's fields the way n8n describes them (only those that apply to the current choices),
// with a JSON view for anything else.
function condOk(cond, val) {
  if (cond && typeof cond === 'object' && cond._cnd) {
    const [op, arg] = Object.entries(cond._cnd)[0] || [];
    switch (op) {
      case 'eq': return val === arg; case 'not': return val !== arg;
      case 'gte': return val >= arg; case 'lte': return val <= arg; case 'gt': return val > arg; case 'lt': return val < arg;
      case 'between': return val >= arg?.from && val <= arg?.to;
      case 'startsWith': return String(val).startsWith(arg); case 'endsWith': return String(val).endsWith(arg);
      case 'includes': return String(val).includes(arg);
      case 'regex': try { return new RegExp(arg).test(String(val)); } catch { return true; }
      case 'exists': return val !== undefined && val !== null && val !== '';
      default: return true;
    }
  }
  return cond === val;
}
function propShown(p, node, params, vals, known) {
  const d = p.displayOptions; if (!d) return true;
  const get = (k) => {
    if (k === '@version') return Number(node.typeVersion) || 1;
    if (k === '@tool') return /Tool$/.test(node.type);
    const key = k.replace(/^\//, '');
    return key in params ? params[key] : vals[key];
  };
  const matches = (k, list) => {
    const v = get(k);
    if (v === undefined) return known?.has(k.replace(/^\//, '')) ? false : null; // a field that isn't shown: no match; unknown: don't decide on it
    const vs = Array.isArray(v) ? v : [v];
    return (Array.isArray(list) ? list : [list]).some((c) => vs.some((x) => condOk(c, x)));
  };
  for (const [k, list] of Object.entries(d.show || {})) if (matches(k, list) === false) return false;
  for (const [k, list] of Object.entries(d.hide || {})) if (matches(k, list) === true) return false;
  return true;
}
function visibleProps(desc, node, params) {
  const known = new Set((desc?.properties || []).map((p) => p?.name));
  let vals = {}; let out = [];
  // Twice, so a field can depend on one listed after it.
  for (let pass = 0, prev = {}; pass < 2; pass++, prev = vals) {
    vals = {}; out = []; const seen = new Set();
    for (const p of desc?.properties || []) {
      if (!p?.name || seen.has(p.name) || !propShown(p, node, params, { ...prev, ...vals }, known)) continue;
      seen.add(p.name); vals[p.name] = p.name in params ? params[p.name] : p.default; out.push(p);
    }
  }
  return { props: out, vals, known };
}
const NODE_SETTING_DEFAULTS = { notes: '', alwaysOutputData: false, executeOnce: false, retryOnFail: false, maxTries: 3, waitBetweenTries: 1000, onError: 'stopWorkflow' };

async function openNodeEditor(ed, name) {
  if (!ed?.ready) return;
  const orig = ed.wf.nodes.find((n) => n.name === name); if (!orig) return;
  const key = 'node:' + name;
  const st = { desc: undefined, creds: [], json: false, params: clone(orig.parameters || {}), cred: clone(orig.credentials || {}), fields: [] };
  const sheet = () => $('#sheet');

  // Fields → st.params. Returns an error message, or null.
  const sync = () => {
    const sh = sheet();
    if (st.json) {
      const ta = sh.querySelector('#ne-pjson'); if (!ta) return null;
      try { const v = JSON.parse(ta.value || '{}'); if (!v || typeof v !== 'object' || Array.isArray(v)) throw 0; st.params = v; } catch { return 'The parameters are not valid JSON.'; }
      return null;
    }
    for (const f of st.fields) {
      const els = [...sh.querySelectorAll(`[data-f="${f.i}"]`)]; if (!els.length) continue;
      const sig = els.map((e) => (e.type === 'checkbox' ? String(e.checked) : e.value)).join('\u0001');
      if (sig === f.sig) continue;
      const el = els[0]; let v;
      if (f.kind === 'bool') v = el.checked;
      else if (f.kind === 'num') { const t = el.value.trim(); v = t.startsWith('=') ? t : t === '' ? f.p.default : Number(t); if (typeof v === 'number' && isNaN(v)) return `“${f.p.displayName}” must be a number.`; }
      else if (f.kind === 'opt') { const ix = Number(el.value); v = ix < 0 ? f.cur : f.p.options[ix]?.value; }
      else if (f.kind === 'rl') {
        const mode = sh.querySelector(`[data-f="${f.i}"][data-part="mode"]`)?.value; const val = sh.querySelector(`[data-f="${f.i}"][data-part="value"]`)?.value ?? '';
        v = { __rl: true, value: val, mode: mode || f.cur?.mode || 'id' };
      } else if (f.kind === 'jv') { try { v = el.value.trim() ? JSON.parse(el.value) : undefined; } catch { return `“${f.p.displayName}” is not valid JSON.`; } }
      else v = el.value;
      if (v === undefined) delete st.params[f.p.name]; else st.params[f.p.name] = v;
      f.sig = sig; f.cur = v;
    }
    sh.querySelectorAll('[data-cred]').forEach((s) => {
      const t = s.dataset.cred; const c = st.creds.find((x) => String(x.id) === s.value);
      if (c) st.cred[t] = { id: String(c.id), name: c.name }; else if (s.value === '') delete st.cred[t];
    });
    return null;
  };

  const fieldHtml = (p, i) => {
    const cur = p.name in st.params ? st.params[p.name] : p.default;
    const isExpr = typeof cur === 'string' && cur.startsWith('=');
    const label = `<span>${esc(p.displayName || p.name)}${p.required ? ' *' : ''}</span>`;
    const hint = p.hint || p.description ? `<p class="help fhelp">${esc(stripHtml(p.hint || p.description)).slice(0, 300)}</p>` : '';
    const f = { i, p, cur, kind: 'str' };
    let ctl;
    const str = (v) => (v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));
    if (p.type === 'notice' || p.type === 'callout') return `<div class="alert info fnotice">${esc(stripHtml(p.displayName))}</div>`;
    if (p.type === 'hidden' || p.type === 'button' || p.type === 'curlImport') return '';
    if (p.type === 'boolean' && !isExpr) { f.kind = 'bool'; st.fields.push(f); return `<label class="check"><input type="checkbox" data-f="${i}" ${cur ? 'checked' : ''}> ${esc(p.displayName)}</label>${hint}`; }
    if (p.type === 'options' && !isExpr && Array.isArray(p.options) && p.options.length) {
      f.kind = 'opt'; const ix = p.options.findIndex((o) => o.value === cur);
      ctl = `<select class="input" data-f="${i}" data-live>${ix < 0 ? `<option value="-1" selected>${esc(str(cur) || '(not set)')}</option>` : ''}${p.options.map((o, k) => `<option value="${k}" ${k === ix ? 'selected' : ''}>${esc(o.name ?? o.value)}</option>`).join('')}</select>`;
    } else if (p.type === 'resourceLocator') {
      f.kind = 'rl'; const rl = cur && typeof cur === 'object' ? cur : { mode: 'id', value: cur ?? '' };
      const modes = (p.modes || []).map((m) => m.name);
      if (rl.mode && !modes.includes(rl.mode)) modes.unshift(rl.mode);
      ctl = `<div class="rl">${modes.length > 1 ? `<select class="input" data-f="${i}" data-part="mode">${modes.map((m) => `<option ${m === rl.mode ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select>` : `<input type="hidden" data-f="${i}" data-part="mode" value="${esc(rl.mode || modes[0] || 'id')}">`}
        <input class="input" data-f="${i}" data-part="value" value="${esc(str(rl.value))}" placeholder="${esc(rl.cachedResultName || (rl.mode === 'url' ? 'https://…' : 'ID'))}" autocapitalize="off"></div>`;
    } else if (p.type === 'number' || (p.type === 'boolean' && isExpr)) {
      f.kind = p.type === 'number' ? 'num' : 'str';
      ctl = `<input class="input" data-f="${i}" ${isExpr ? '' : 'inputmode="decimal"'} value="${esc(str(cur))}">`;
    } else if (['string', 'json', 'dateTime', 'color', 'options'].includes(p.type) || isExpr) {
      const long = p.type === 'json' || (p.typeOptions?.rows || 0) > 1 || p.typeOptions?.editor || str(cur).length > 60 || str(cur).includes('\n');
      ctl = long ? `<textarea class="input" data-f="${i}" rows="${Math.min(12, Math.max(3, p.typeOptions?.rows || 4))}" autocapitalize="off" spellcheck="false">${esc(str(cur))}</textarea>`
        : `<input class="input" data-f="${i}" ${p.typeOptions?.password ? 'type="password"' : ''} value="${esc(str(cur))}" autocapitalize="off" placeholder="${esc(p.placeholder || '')}">`;
    } else {
      f.kind = 'jv';
      return (st.fields.push(f), `<label class="field">${label.replace('</span>', ' <em>(JSON)</em></span>')}
        <textarea class="input" data-f="${i}" rows="4" autocapitalize="off" spellcheck="false">${esc(cur === undefined ? '' : JSON.stringify(cur, null, 2))}</textarea>${hint}</label>`);
    }
    st.fields.push(f);
    return `<label class="field">${label}${ctl}${hint}</label>`;
  };

  const paramsHtml = () => {
    st.fields = [];
    if (st.json || !st.desc) {
      return `${st.desc === null ? '<div class="alert warn">n8n didn\'t describe this step\'s fields, so they are shown as JSON.</div>' : ''}
        <textarea class="input ne-pjson" id="ne-pjson" rows="14" autocapitalize="off" spellcheck="false">${esc(JSON.stringify(st.params, null, 2))}</textarea>
        <p class="help">Values starting with <code>=</code> are n8n expressions, e.g. <code>={{ $json.email }}</code>.</p>`;
    }
    const node = { ...orig, parameters: st.params };
    const { props, vals, known } = visibleProps(st.desc, node, st.params);
    const creds = (st.desc.credentials || []).filter((c) => propShown(c, node, st.params, vals, known));
    const fields = props.map(fieldHtml).join('');
    const credHtml = creds.map((c) => {
      const mine = st.creds.filter((x) => x.type === c.name); const curId = st.cred[c.name]?.id;
      return `<label class="field"><span>Credential: ${esc(c.displayName || shortType(c.name))}${c.required ? ' *' : ''}</span>
        <select class="input" data-cred="${esc(c.name)}"><option value="">None</option>${curId && !mine.some((x) => String(x.id) === String(curId)) ? `<option value="${esc(curId)}" selected>${esc(st.cred[c.name]?.name || curId)}</option>` : ''}
        ${mine.map((x) => `<option value="${esc(x.id)}" ${String(x.id) === String(curId) ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
        ${!mine.length ? '<p class="help fhelp">You have no credential of this kind yet. Create it in n8n, then pick it here.</p>' : ''}</label>`;
    }).join('');
    return (credHtml + fields) || '<div class="card empty">This step has no settings.</div>';
  };
  const bindParams = () => {
    const sh = sheet(); const box = sh.querySelector('#ne-params'); if (!box) return;
    st.fields.forEach((f) => { const els = [...box.querySelectorAll(`[data-f="${f.i}"]`)]; f.sig = els.map((e) => (e.type === 'checkbox' ? String(e.checked) : e.value)).join('\u0001'); });
    // A choice can show or hide other fields (Resource → Operation → …): redraw them when it changes.
    box.querySelectorAll('[data-live], input[type=checkbox][data-f]').forEach((el) => (el.onchange = () => {
      const err = sync(); if (err) { toast(err, true); return; } box.innerHTML = paramsHtml(); bindParams();
    }));
  };

  const connsHtml = () => {
    const wf = ed.wf; const F = flowLayout(wf); const L = F.nodes[name]; if (!L) return '';
    const others = Object.values(F.nodes).filter((x) => x.n.name !== name && !x.sub && x.nIn > 0);
    const targetOpts = others.flatMap((x) => (x.nIn > 1 ? Array.from({ length: x.nIn }, (_, k) => [`${x.n.name}\u0001${k}`, `${x.n.name} (input ${k + 1})`]) : [[`${x.n.name}\u0001${0}`, x.n.name]]));
    const outLabel = (i) => L.outLabels[i] || (L.nOut > 1 ? `Output ${i + 1}` : 'Output');
    let h = '';
    if (L.sub) {
      const mine = F.raw.filter((e) => e.from === name && e.type !== 'main');
      const t = mine[0]?.type || aiOutputType(st.desc);
      h += `<div class="conn-group"><div class="conn-head">Used by</div>
        ${mine.map((e) => `<div class="conn">${esc(e.to)} <span class="help">${esc(AI_INPUT_LABELS[e.type] || e.type)}</span><button class="icon-btn" data-cdel="${esc([e.type, e.out, e.to, e.in].join('\u0001'))}" aria-label="Disconnect">${icon('close')}</button></div>`).join('')}
        ${t ? `<select class="input" data-cadd="${esc(t)}\u00010"><option value="">+ Connect to…</option>${Object.values(F.nodes).filter((x) => x.n.name !== name && !x.sub && !x.trigger).map((x) => `<option value="${esc(x.n.name)}\u00010">${esc(x.n.name)}</option>`).join('')}</select>` : ''}</div>`;
    } else {
      for (let i = 0; i < Math.max(L.nOut, 0); i++) {
        const targets = (wf.connections[name]?.main?.[i] || []).filter((c) => F.nodes[c.node]);
        h += `<div class="conn-group"><div class="conn-head">${esc(outLabel(i))} goes to</div>
          ${targets.map((c) => `<div class="conn">${esc(c.node)}${c.index ? ` <span class="help">input ${c.index + 1}</span>` : ''}<button class="icon-btn" data-cdel="${esc(['main', i, c.node, c.index || 0].join('\u0001'))}" aria-label="Disconnect">${icon('close')}</button></div>`).join('')}
          <select class="input" data-cadd="main\u0001${i}"><option value="">+ Connect to…</option>${targetOpts.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')}</select></div>`;
      }
    }
    const ins = F.raw.filter((e) => e.to === name);
    if (ins.length) h += `<div class="conn-group"><div class="conn-head">Comes from</div>${ins.map((e) => `<div class="conn">${esc(e.from)}${F.nodes[e.from]?.outLabels[e.out] ? ` <span class="help">${esc(F.nodes[e.from].outLabels[e.out])}</span>` : ''}${e.type !== 'main' ? ` <span class="help">${esc(AI_INPUT_LABELS[e.type] || e.type)}</span>` : ''}
      <button class="icon-btn" data-cin="${esc([e.from, e.type, e.out, e.in].join('\u0001'))}" aria-label="Disconnect">${icon('close')}</button></div>`).join('')}</div>`;
    return h || '<p class="help">Triggers start the workflow, so nothing connects into them.</p>';
  };
  const bindConns = () => {
    const box = sheet().querySelector('#ne-conns'); if (!box) return;
    const redo = () => { ed.changed(); box.innerHTML = connsHtml(); bindConns(); };
    box.querySelectorAll('[data-cdel]').forEach((b) => (b.onclick = () => { const [t, o, to, inp] = b.dataset.cdel.split('\u0001'); disconnectNodes(ed.begin(), name, t, +o, to, +inp); redo(); }));
    box.querySelectorAll('[data-cin]').forEach((b) => (b.onclick = () => { const [from, t, o, inp] = b.dataset.cin.split('\u0001'); disconnectNodes(ed.begin(), from, t, +o, name, +inp); redo(); }));
    box.querySelectorAll('[data-cadd]').forEach((s) => (s.onchange = () => {
      if (!s.value) return; const [t, o] = s.dataset.cadd.split('\u0001'); const [to, inp] = s.value.split('\u0001');
      connectNodes(ed.begin(), name, t, +o, to, +inp); redo();
    }));
  };

  const html = () => {
    const n = ed.wf.nodes.find((x) => x.name === name) || orig;
    const desc = st.desc;
    return sheetHead(esc(name), `<button class="icon-btn" id="ne-del" aria-label="Delete step">${icon('trash')}</button>`) + `<div class="sheet-body">
    ${desc === undefined ? '<div class="skeleton" style="margin-top:12px"></div>' : `
    <p class="help" style="margin-top:10px">${esc(desc?.displayName || shortType(n.type))} · v${esc(n.typeVersion)}${desc?.description ? ' · ' + esc(stripHtml(desc.description)) : ''}</p>
    <label class="field"><span>Name</span><input class="input" id="ne-name" value="${esc(n.name)}"></label>
    <label class="check"><input type="checkbox" id="ne-on" ${n.disabled ? '' : 'checked'}> Enabled (a disabled step passes its input straight through)</label>
    <div class="section-title row-title">Parameters<button class="linkbtn" id="ne-mode">${st.json ? 'Show as fields' : 'Edit as JSON'}</button></div>
    <div id="ne-params">${paramsHtml()}</div>
    <div class="section-title">Connections</div><div id="ne-conns">${connsHtml()}</div>
    <details class="ne-more"><summary>Step settings</summary>
      <label class="field"><span>Notes</span><textarea class="input plain" id="ne-notes" rows="3">${esc(n.notes || '')}</textarea></label>
      <label class="check"><input type="checkbox" id="ne-always" ${n.alwaysOutputData ? 'checked' : ''}> Always output data</label>
      <label class="check"><input type="checkbox" id="ne-once" ${n.executeOnce ? 'checked' : ''}> Execute once (first item only)</label>
      <label class="check"><input type="checkbox" id="ne-retry" ${n.retryOnFail ? 'checked' : ''}> Retry on fail</label>
      <div class="grid2"><label class="field"><span>Max tries</span><input class="input" id="ne-tries" inputmode="numeric" value="${esc(n.maxTries ?? 3)}"></label>
      <label class="field"><span>Wait between (ms)</span><input class="input" id="ne-wait" inputmode="numeric" value="${esc(n.waitBetweenTries ?? 1000)}"></label></div>
      <label class="field"><span>On error</span><select class="input" id="ne-onerr">${[['stopWorkflow', 'Stop workflow'], ['continueRegularOutput', 'Continue'], ['continueErrorOutput', 'Continue (using error output)']]
        .map(([v, l]) => `<option value="${v}" ${(n.onError || 'stopWorkflow') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    </details>
    <button class="btn primary block" data-close style="margin-top:14px">Done</button>
    <p class="help">Changes are kept until you tap <b>Save</b> on the workflow.</p>`}
    <div class="spacer"></div></div>`;
  };
  const bind = (sh) => {
    sh.querySelector('#ne-del').onclick = () => {
      if (!confirm(`Delete the step “${name}”?`)) return;
      deleteNode(ed.begin(), name); const v = flowViews[ed.wf.id]; if (v) v.sel = null;
      st.deleted = true; ed.changed(); history.back();
    };
    const mode = sh.querySelector('#ne-mode');
    if (mode) mode.onclick = () => {
      const err = sync(); if (err) { toast(err, true); return; }
      st.json = !st.json; mode.textContent = st.json ? 'Show as fields' : 'Edit as JSON';
      sh.querySelector('#ne-params').innerHTML = paramsHtml(); bindParams();
    };
    bindParams(); bindConns();
  };
  // Leaving the editor (Done, Back or swipe) keeps what was changed.
  const leave = () => {
    if (st.deleted || st.desc === undefined) return true;
    const sh = sheet(); const err = sync(); if (err) { toast(err, true); return false; }
    const newName = sh.querySelector('#ne-name').value.trim();
    if (!newName) { toast('The step needs a name', true); return false; }
    if (newName !== name && ed.wf.nodes.some((x) => x.name === newName)) { toast(`There is already a step called “${newName}”.`, true); return false; }
    const n0 = ed.wf.nodes.find((x) => x.name === name) || orig;
    const want = {
      disabled: !sh.querySelector('#ne-on').checked, notes: sh.querySelector('#ne-notes').value,
      alwaysOutputData: sh.querySelector('#ne-always').checked, executeOnce: sh.querySelector('#ne-once').checked,
      retryOnFail: sh.querySelector('#ne-retry').checked, maxTries: Number(sh.querySelector('#ne-tries').value) || 3,
      waitBetweenTries: Number(sh.querySelector('#ne-wait').value) || 0, onError: sh.querySelector('#ne-onerr').value,
    };
    const changes = [];
    if (JSON.stringify(st.params) !== JSON.stringify(n0.parameters || {})) changes.push((n) => { n.parameters = st.params; });
    if (JSON.stringify(st.cred) !== JSON.stringify(n0.credentials || {})) changes.push((n) => { if (Object.keys(st.cred).length) n.credentials = st.cred; else delete n.credentials; });
    if (want.disabled !== !!n0.disabled) changes.push((n) => { if (want.disabled) n.disabled = true; else delete n.disabled; });
    for (const [k, def] of Object.entries(NODE_SETTING_DEFAULTS)) {
      if (k === 'maxTries' || k === 'waitBetweenTries') { if (!want.retryOnFail && n0[k] === undefined) continue; }
      const have = n0[k] ?? def;
      if (want[k] !== have) changes.push((n) => { if (want[k] === def) delete n[k]; else n[k] = want[k]; });
    }
    if (!changes.length && newName === name) return true;
    const d = ed.begin(); const n = d.nodes.find((x) => x.name === name); if (!n) return true;
    changes.forEach((fn) => fn(n));
    if (newName !== name) {
      renameNode(d, name, newName);
      const v = flowViews[d.id]; if (v?.sel === name) v.sel = newName;
    }
    ed.changed();
    return true;
  };
  openSheet(key, html(), bind, { leave });
  const [desc, creds] = await Promise.all([nodeDesc(orig.type, orig.typeVersion || 1), credentialList()]);
  st.desc = desc || null; st.creds = creds; if (!desc) st.json = true;
  if (sheetIsOpen(key)) openSheet(key, html(), bind, { leave });
}

function wfRunsTab(runs) {
  if (!runs.length) return '<div class="card empty">No executions for this workflow yet.</div>';
  const ok = runs.filter((e) => exStatus(e) === 'success').length, bad = runs.filter((e) => exStatus(e) === 'error').length;
  const durs = runs.map(exDur).filter((d) => d != null);
  return `<div class="grid2">
      <div class="card stat ok"><div class="label">Succeeded</div><div class="value">${ok}</div></div>
      <div class="card stat bad"><div class="label">Failed</div><div class="value">${bad}</div></div>
      <div class="card stat"><div class="label">Longest</div><div class="value">${fmtDur(durs.length ? Math.max(...durs) : null)}</div></div>
      <div class="card stat"><div class="label">Average</div><div class="value">${fmtDur(durs.length ? durs.reduce((a, b) => a + b, 0) / durs.length : null)}</div></div>
    </div>
    <div class="section-title">Last ${runs.length} executions</div>
    <div class="list">${runs.map(exRow).join('')}</div>`;
}

function wfHistoryTab(wf, hist, histErr) {
  const editor = `<a class="btn block" style="margin-top:12px" href="${esc(baseUrl())}/workflow/${encodeURIComponent(wf.id)}/history" target="_blank" rel="noopener">Open version history in n8n</a>`;
  if (histErr) return `<div class="alert warn">Couldn't load the edit history (${esc(histErr)}).</div>${editor}`;
  if (!hist) return '<div class="skeleton"></div>';
  if (!hist.length) return `<div class="card empty">No saved versions yet.</div>${editor}`;
  const live = wf.activeVersionId || (wf.active && !('activeVersionId' in wf) ? wf.versionId : null);
  return `<p class="help">Every saved version, newest first. n8n keeps these for a limited time on the free plan.</p>
  <div class="list">${hist.map((v, i) => {
    const tags = [
      v.versionId === wf.versionId ? '<span class="badge info">Current</span>' : '',
      v.versionId === live ? '<span class="badge ok">Published</span>' : '',
      i === hist.length - 1 ? '<span class="badge">Oldest kept</span>' : '',
      v.autosaved ? '<span class="badge">Autosave</span>' : '',
    ].join('');
    return `<div class="row" style="cursor:default;align-items:flex-start"><div class="main">
      <div class="title">${esc(v.name || v.authors || 'Unknown editor')}</div>
      <div class="meta">${v.name && v.authors ? esc(v.authors) + ' · ' : ''}<span class="mono">${esc(String(v.versionId).slice(0, 8))}</span></div>
      ${tags ? `<div class="badges" style="margin-top:6px">${tags}</div>` : ''}</div>
      <div class="end">${fmtDate(v.createdAt)}<br>${ago(v.createdAt)}</div></div>`;
  }).join('')}</div>${editor}`;
}

// ---------- run a workflow ----------
function openRun(wf) {
  const hooks = (wf.nodes || []).filter((n) => n.type === 'n8n-nodes-base.webhook' && !n.disabled);
  const forms = (wf.nodes || []).filter((n) => n.type === 'n8n-nodes-base.formTrigger' && !n.disabled);
  // Triggers n8n can start on request, like pressing "Execute workflow" in the editor.
  const LISTENING = /webhook|formTrigger|chatTrigger|errorTrigger|executeWorkflowTrigger|mcpTrigger/i;
  const runnable = triggers(wf).filter((n) => !n.disabled && !LISTENING.test(n.type));
  let i = 0;
  const h = hooks[0] && webhookInfo(hooks[0]);
  const html = sheetHead('Run · ' + esc(wf.name)) + `<div class="sheet-body">
    ${!wf.active && (hooks.length || forms.length) ? '<div class="alert warn" style="margin-top:12px">This workflow is inactive. Production webhook and form URLs only work when it is active, so activate it first.</div>' : ''}
    ${hooks.length ? `
      <div class="section-title">Webhook trigger</div>
      ${hooks.length > 1 ? `<label class="field"><span>Trigger</span><select class="input" id="r-hook">${hooks.map((n, k) => `<option value="${k}">${esc(n.name)}</option>`).join('')}</select></label>` : ''}
      <label class="field"><span>Method</span><select class="input" id="r-method">${['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'].map((m) => `<option ${m === h.method ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
      <label class="field"><span>Path (after /webhook/)</span><input class="input mono" id="r-path" value="${esc(h.path)}"></label>
      <label class="field"><span>JSON body (optional)</span><textarea class="input" id="r-body" placeholder='{"hello": "world"}'></textarea></label>
      <label class="field"><span>Extra headers as JSON (optional, e.g. for webhook auth)</span><textarea class="input" id="r-headers" style="min-height:60px" placeholder='{"Authorization": "Bearer …"}'></textarea></label>
      <button class="btn primary block" id="r-go">${icon('play').replace('<svg', '<svg width="16" height="16"')} Send request</button>
      <div id="r-out" style="margin-top:12px"></div>` : ''}
    ${forms.length ? `<div class="section-title">Form trigger</div>${forms.map((n) => `<a class="btn block" style="margin-bottom:8px" target="_blank" rel="noopener" href="${esc(baseUrl())}/form/${esc(webhookInfo(n).path)}">Open form “${esc(n.name)}”</a>`).join('')}` : ''}
    ${runnable.length ? `
      <div class="section-title">Run now</div>
      ${runnable.length > 1 ? `<label class="field"><span>Start from</span><select class="input" id="r-trigger">${runnable.map((n) => `<option>${esc(n.name)}</option>`).join('')}</select></label>` : ''}
      <p class="help" style="margin-top:0">Runs the latest saved version once, like pressing <b>Execute workflow</b> in n8n${runnable.length === 1 ? ` (starting from “${esc(runnable[0].name)}”)` : ''}.</p>
      <button class="btn primary block" id="r-run">${icon('play').replace('<svg', '<svg width="16" height="16"')} Run now</button>
      <div id="r-run-out" style="margin-top:12px"></div>` : ''}
    ${!hooks.length && !forms.length && !runnable.length ? `<div class="alert info" style="margin-top:12px">
        This workflow has no trigger that can be started from here${triggers(wf).length ? ` (it starts from: ${triggers(wf).map((n) => esc(triggerLabel(n))).join(', ')})` : ''}.</div>
      <a class="btn block" href="${esc(baseUrl())}/workflow/${encodeURIComponent(wf.id)}" target="_blank" rel="noopener">Open in n8n editor</a>` : ''}
    <div class="spacer"></div></div>`;
  openSheet('run:' + wf.id, html, (sh) => {
    const sel = sh.querySelector('#r-hook');
    if (sel) sel.onchange = () => { i = +sel.value; const x = webhookInfo(hooks[i]); sh.querySelector('#r-method').value = x.method; sh.querySelector('#r-path').value = x.path; };
    const rr = sh.querySelector('#r-run');
    if (rr) rr.onclick = async () => {
      const out = sh.querySelector('#r-run-out'); const name = sh.querySelector('#r-trigger')?.value || runnable[0].name;
      rr.disabled = true; out.innerHTML = '<div class="skeleton" style="height:50px"></div>';
      try {
        const full = wf.connections ? wf : await API.workflow(wf.id);
        const r = await API.run(full, name);
        const id = r?.executionId;
        out.innerHTML = `<div class="alert info">Started${id ? ` as execution #${esc(id)}` : ''}.</div>`;
        toast('Workflow started');
        if (id) setTimeout(async () => { await loadAll(); openExecution(id); }, 1500); else setTimeout(loadAll, 1500);
      } catch (e) { out.innerHTML = `<div class="alert bad">${esc(e.message)}</div>`; }
      rr.disabled = false;
    };
    const go = sh.querySelector('#r-go'); if (!go) return;
    go.onclick = async () => {
      const out = sh.querySelector('#r-out');
      const method = sh.querySelector('#r-method').value; const path = sh.querySelector('#r-path').value.replace(/^\/+/, '');
      let body, headers = {};
      try {
        const b = sh.querySelector('#r-body').value.trim(); if (b && !['GET', 'HEAD'].includes(method)) body = JSON.parse(b);
        const hd = sh.querySelector('#r-headers').value.trim(); if (hd) headers = JSON.parse(hd);
      } catch { out.innerHTML = '<div class="alert bad">Body or headers are not valid JSON.</div>'; return; }
      go.disabled = true; out.innerHTML = '<div class="skeleton" style="height:60px"></div>';
      const t0 = performance.now();
      try {
        const res = await rawFetch('/webhook/' + path, { method, body, headers });
        const text = await res.text(); const ms = performance.now() - t0;
        let pretty = text; try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch {}
        out.innerHTML = `<div class="alert ${res.ok ? 'info' : 'bad'}">HTTP ${res.status} · ${fmtDur(ms)}${res.status === 404 ? '<br>404 usually means the workflow is not active, or the path/method does not match.' : ''}</div>
          ${pretty ? `<pre class="json">${esc(pretty.slice(0, 20000))}</pre>` : ''}`;
        if (res.ok) { toast('Workflow triggered'); setTimeout(loadAll, 1500); }
      } catch (e) { out.innerHTML = `<div class="alert bad">${esc(e.message)}</div>`; }
      go.disabled = false;
    };
  });
}

// ---------- execution detail ----------
async function openExecution(id) {
  const base = S.executions.find((e) => String(e.id) === String(id));
  const draw = (ex, err) => openSheet('ex:' + id, sheetHead('Execution #' + esc(id)) + `<div class="sheet-body">${ex ? exDetailHtml(ex) : err ? `<div class="alert bad" style="margin-top:12px">${esc(err)}</div>` : '<div class="skeleton" style="margin-top:12px"></div>'}</div>`, (sh) => {
    const wfb = sh.querySelector('[data-wf]'); if (wfb) wfb.onclick = () => openWorkflow(wfb.dataset.wf);
    const rt = sh.querySelector('#ex-retry');
    if (rt) rt.onclick = async () => {
      rt.disabled = true;
      try { const r = await API.retry(id); toast('Retry started' + (r?.id ? ` (#${r.id})` : '')); setTimeout(loadAll, 1500); }
      catch (e) { toast(e.status === 404 ? 'Retry is not supported by this n8n version' : e.message, true); rt.disabled = false; }
    };
  });
  draw(base ? { ...base, _partial: true } : null);
  try { const ex = await API.execution(id); if (sheetIsOpen('ex:' + id)) draw(ex); }
  catch (e) { if (sheetIsOpen('ex:' + id)) draw(base, base ? null : e.message); }
}

function exDetailHtml(ex) {
  const st = exStatus(ex);
  const rd = ex.data?.resultData || {};
  const runData = rd.runData || {};
  const errMsg = rd.error?.message || rd.error?.description;
  const errNode = rd.error?.node?.name || rd.lastNodeExecuted;
  const runs = Object.entries(runData).flatMap(([name, arr]) => (arr || []).map((r, k) => ({ name, k, ...r })))
    .sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
  const items = (r) => (r.data?.main || []).reduce((s, b) => s + (b?.length || 0), 0);
  const lastOut = runs.length ? runs[runs.length - 1] : null;
  const wfNodes = Object.fromEntries((ex.workflowData?.nodes || S.workflows.find((w) => String(w.id) === String(ex.workflowId))?.nodes || []).map((n) => [n.name, n]));
  return `
    <div class="badges" style="margin:12px 0">${statusBadge(st)}<span class="badge">${esc(ex.mode || 'unknown mode')}</span>${ex.retryOf ? `<span class="badge">retry of #${esc(ex.retryOf)}</span>` : ''}</div>
    <div class="card"><dl class="kv">
      <dt>Workflow</dt><dd><a href="#" data-wf="${esc(ex.workflowId)}" onclick="return false">${esc(wfName(ex.workflowId))}</a></dd>
      <dt>Started</dt><dd>${fmtDate(ex.startedAt)}</dd>
      <dt>Finished</dt><dd>${fmtDate(ex.stoppedAt)}</dd>
      <dt>Duration</dt><dd><b>${fmtDur(exDur(ex))}</b></dd>
      <dt>Execution ID</dt><dd class="mono">${esc(ex.id)}</dd>
    </dl></div>
    ${errMsg ? `<div class="section-title">Error${errNode ? ' in “' + esc(errNode) + '”' : ''}</div><div class="err-box">${esc(errMsg)}</div>` : ''}
    ${st === 'error' || st === 'canceled' ? '<button class="btn block" id="ex-retry" style="margin-top:12px">Retry this execution</button>' : ''}
    <div class="section-title">Steps${runs.length ? ` · ${runs.length}` : ''}</div>
    ${runs.length ? `<div class="flow">${runs.map((r, i) => `${i ? '<div class="connector"></div>' : ''}
      <div class="node ${r.error ? 'ran-bad' : 'ran-ok'}">
        <div class="n-ico">${i + 1}</div>
        <div class="n-main"><div class="n-name">${esc(r.name)}${r.k ? ` (run ${r.k + 1})` : ''}</div>
        <div class="n-type">${esc(shortType(wfNodes[r.name]?.type || ''))}${wfNodes[r.name] ? ' · ' : ''}${items(r)} item${items(r) === 1 ? '' : 's'}${r.error ? ' · ' + esc(r.error.message || 'error') : ''}</div></div>
        <div class="end mono">${fmtDur(r.executionTime)}</div>
      </div>`).join('')}</div>`
      : `<div class="card empty">${ex._partial ? 'Loading step details…' : 'No step data saved for this execution (check the workflow\'s "Save execution progress/data" settings).'}</div>`}
    ${lastOut && lastOut.data?.main?.[0]?.length ? `<div class="section-title">Output of “${esc(lastOut.name)}” (first item)</div>
      <pre class="json">${esc(JSON.stringify(lastOut.data.main[0][0]?.json ?? lastOut.data.main[0][0], null, 2).slice(0, 8000))}</pre>` : ''}
    <a class="btn block" style="margin-top:14px" href="${esc(baseUrl())}/workflow/${encodeURIComponent(ex.workflowId)}/executions/${encodeURIComponent(ex.id)}" target="_blank" rel="noopener">Open in n8n</a>
    <div class="spacer"></div>`;
}

// ---------- in-app updates (Android) ----------
// CI publishes every build of main as the rolling "android" release (see .github/workflows/android.yml).
// The app compares its own build number (public/build.json, stamped by CI) with the release's,
// downloads the new APK itself and hands it to Android's installer (AppUpdaterPlugin.java).
const RELEASE_API = 'https://api.github.com/repos/0XZEROX0/n8n-app/releases/tags/android';
let BUILD = 0; // 0 = local/dev build, which never offers updates
const U = { state: 'idle', update: null, pct: null, message: '' }; // idle | checking | latest | available | downloading | allow | error

async function loadBuild() {
  try { const r = await fetch('build.json', { cache: 'no-store' }); if (r.ok) BUILD = Number((await r.json()).build) || 0; } catch {}
}
async function checkForUpdate() {
  const res = await fetch(RELEASE_API, { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
  const rel = await res.json();
  const build = Number(/build (\d+)/.exec(rel.name || '')?.[1] || 0);
  const apk = (rel.assets || []).find((a) => a.name === 'n8n-mobile.apk');
  if (!BUILD || !apk || build <= BUILD) return null;
  // "- 12|Sign in with email and password": a change and the build that brought it.
  const changes = [...String(rel.body || '').matchAll(/^- (\d+)\|(.+)$/gm)].filter((m) => Number(m[1]) > BUILD).map((m) => m[2].trim());
  return { build, url: apk.browser_download_url, size: apk.size, changes };
}
const mb = (b) => `${(b / 1048576).toFixed(1)} MB`;

function updateCardHtml(inPrompt) {
  const u = U.update;
  if (U.state === 'available') return `
    <p>Build ${u.build} is ready (${mb(u.size)}); you have build ${BUILD}. Android will ask you to confirm the install.</p>
    ${u.changes.length ? `<div class="card" style="margin:10px 0"><b>What's new</b><ul style="margin:6px 0 0;padding-left:18px">${u.changes.slice(0, 8).map((c) => `<li>${esc(c)}</li>`).join('')}</ul>${u.changes.length > 8 ? `<p class="help">and ${u.changes.length - 8} more</p>` : ''}</div>` : ''}
    <div class="btn-row">${inPrompt ? '<button class="btn" data-close>Later</button>' : ''}<button class="btn primary" id="upd-install">Update now</button></div>`;
  if (U.state === 'downloading') return `
    <progress max="100" ${U.pct != null ? `value="${U.pct}"` : ''} style="width:100%"></progress>
    <p class="help">Downloading${U.pct != null ? ` ${U.pct}%` : '…'}</p>`;
  if (U.state === 'allow') return `<div class="alert warn">Turn on <b>Allow from this source</b> for n8n Mobile, then come back here to finish the update.</div>`;
  return `
    <button class="btn block" id="upd-check" ${U.state === 'checking' ? 'disabled' : ''}>${U.state === 'checking' ? 'Checking…' : 'Check for updates'}</button>
    ${U.state === 'latest' ? '<p class="help">You have the latest version.</p>' : ''}
    ${U.state === 'error' ? `<div class="alert bad" style="margin-top:10px">${esc(U.message)}</div>` : ''}`;
}
function bindUpdate(root) {
  const c = root.querySelector('#upd-check'); if (c) c.onclick = () => runCheck(false);
  const i = root.querySelector('#upd-install'); if (i) i.onclick = installUpdate;
}
function refreshUpdateUi() {
  const top = sheetStack[sheetStack.length - 1];
  if (top?.key === 'update') openUpdatePrompt();
  else if (top?.key === 'settings') { const box = $('#upd-box'); if (box) { box.innerHTML = updateCardHtml(false); bindUpdate(box); } }
}
async function runCheck(quiet) {
  if (U.state === 'downloading' || U.state === 'allow') return;
  if (!quiet) { U.state = 'checking'; refreshUpdateUi(); }
  try {
    const u = await checkForUpdate();
    if (u) Object.assign(U, { state: 'available', update: u }); else U.state = quiet ? 'idle' : 'latest';
  } catch (e) { Object.assign(U, quiet ? { state: 'idle' } : { state: 'error', message: `Couldn't check for updates (${e.message}).` }); }
  if (quiet && U.state === 'available' && !sheetStack.length) openUpdatePrompt(); else refreshUpdateUi();
}
async function installUpdate() {
  Object.assign(U, { state: 'downloading', pct: null }); refreshUpdateUi();
  const sub = window.Capacitor.addListener('AppUpdater', 'downloadProgress', (p) => {
    U.pct = p.total > 0 ? Math.round((p.downloaded * 100) / p.total) : null; refreshUpdateUi();
  });
  try {
    const r = await window.Capacitor.nativePromise('AppUpdater', 'downloadAndInstall', { url: U.update.url });
    U.state = r?.needsPermission ? 'allow' : 'available';
  } catch (e) { Object.assign(U, { state: 'error', message: `Update failed: ${e.message || e}` }); }
  sub?.remove?.(); refreshUpdateUi();
}
function openUpdatePrompt() {
  openSheet('update', sheetHead('An update is out') + `<div class="sheet-body" style="padding-top:12px">${updateCardHtml(true)}<div class="spacer"></div></div>`, bindUpdate);
}
function startUpdates() {
  if (!IS_NATIVE || !BUILD) return;
  runCheck(true);
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden) return;
    if (U.state === 'allow') {
      // Back from Android's "install unknown apps" screen: try the install again.
      try { const r = await window.Capacitor.nativePromise('AppUpdater', 'installDownloaded', {}); if (!r?.needsPermission) { U.state = 'available'; refreshUpdateUi(); } } catch {}
    } else if (U.state === 'idle') runCheck(true);
  });
}

// ---------- settings ----------
function openSettings() {
  openSheet('settings', sheetHead('Settings') + `<div class="sheet-body">
    <div class="section-title">Connection</div>
    <div class="card"><dl class="kv">
      <dt>Server</dt><dd>${esc(baseUrl())}</dd>
      <dt>Route</dt><dd>${IS_NATIVE ? 'Direct from the Android app' : S.conn.viaProxy ? 'Through app server (no CORS)' : 'Direct from browser'}</dd>
      <dt>Signed in as</dt><dd>${esc(S.conn.name || S.conn.email || '–')}${S.conn.name && S.conn.email ? `<br><span class="help">${esc(S.conn.email)}</span>` : ''}</dd>
    </dl></div>
    <div class="section-title">Statistics</div>
    <label class="field"><span>How many recent executions to analyse</span>
      <select class="input" id="set-sample">${[100, 250, 500, 1000, 2500].map((n) => `<option ${n === (S.prefs.sample || 500) ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <p class="help">Overview numbers are computed from this many of the most recent executions that n8n has kept (n8n prunes old executions on its own schedule).</p>
    <div class="section-title">App</div>
    ${IS_NATIVE ? `<p class="help" style="margin-top:0">n8n Mobile for Android, build ${BUILD || 'dev'}</p><div id="upd-box">${updateCardHtml(false)}</div>`
      : '<p class="help" style="margin-top:0">Web version: it updates itself whenever you reload the page.</p>'}
    <button class="btn danger block" id="set-logout" style="margin-top:18px">Sign out</button>
    <div class="spacer"></div></div>`, (sh) => {
    bindUpdate(sh);
    sh.querySelector('#set-sample').onchange = (e) => { S.prefs.sample = +e.target.value; store.set('n8n.prefs', S.prefs); loadAll(); };
    sh.querySelector('#set-logout').onclick = () => {
      API.logout().catch(() => {});
      S.login = { step: 'url', url: S.conn.url, email: S.conn.email || '' };
      store.del('n8n.conn'); S.conn = null; S.workflows = []; S.executions = []; S.loadedAt = null; S.error = null;
      history.back(); render();
    };
  });
}

// ---------- boot ----------
async function boot() {
  await loadBuild();
  try {
    const r = await fetch('app-config.json', { cache: 'no-store' });
    if (!IS_NATIVE && r.ok && (r.headers.get('content-type') || '').includes('json')) S.cfg = { ...S.cfg, ...(await r.json()) };
  } catch {}
  if (S.conn && S.cfg.proxy && S.cfg.n8nUrl) S.conn.url = S.cfg.n8nUrl; // server decides the target
  if (S.conn) S.conn.viaProxy = S.cfg.proxy;
  if (S.conn?.apiKey) {
    // Signed in with an API key by version 0.1.0: switch to email + password.
    S.login = { step: 'url', url: S.conn.url, email: '', error: null };
    S.conn = null; store.del('n8n.conn');
  }
  render();
  if (S.conn) {
    // Still signed in? (n8n sessions last about a week.)
    API.me().then((u) => { if (u?.email) { S.conn.email = u.email; S.conn.name = [u.firstName, u.lastName].filter(Boolean).join(' '); store.set('n8n.conn', S.conn); } loadAll(); })
      .catch((e) => { if (e.status === 401) sessionEnded(); else loadAll(); });
  }
  setInterval(() => { if (S.conn && !document.hidden && !S.loading && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) render(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && S.conn && S.loadedAt && Date.now() - S.loadedAt > 120000) loadAll(); });
  if (IS_NATIVE) {
    // Open n8n links (editor, forms, history) in the phone's browser instead of inside the app.
    document.addEventListener('click', (ev) => {
      const a = ev.target.closest && ev.target.closest('a[target="_blank"]');
      if (a && a.href) { ev.preventDefault(); window.location.href = a.href; } // Capacitor hands external URLs to the browser
    });
  } else if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  startUpdates();
}
boot();
})();
