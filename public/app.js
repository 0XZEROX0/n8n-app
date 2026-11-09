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
function toast(msg, bad = false) {
  const t = $('#toast'); t.textContent = msg; t.className = 'toast' + (bad ? ' bad' : ''); t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 3500);
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
function openSheet(key, html, onBind) {
  const top = sheetStack[sheetStack.length - 1];
  if (top && top.key === key) { Object.assign(top, { html, onBind }); const y = $('#sheet').scrollTop; showSheet(top); $('#sheet').scrollTop = y; return; }
  sheetStack.push({ key, html, onBind }); history.pushState({ sheet: sheetStack.length }, '');
  showSheet(sheetStack[sheetStack.length - 1]); $('#sheet').scrollTop = 0;
}
const sheetIsOpen = (key) => sheetStack[sheetStack.length - 1]?.key === key; // only redraw if it's the visible sheet
function closeSheet() { $('#sheet').hidden = true; $('#sheet-backdrop').hidden = true; document.body.style.overflow = ''; }
window.addEventListener('popstate', () => {
  sheetStack.pop();
  if (sheetStack.length) showSheet(sheetStack[sheetStack.length - 1]); else closeSheet();
});
const sheetHead = (title, extra = '') => `<div class="sheet-head"><h2>${title}</h2>${extra}<button class="icon-btn" data-close aria-label="Close">${icon('close')}</button></div>`;

// ---------- workflow detail ----------
async function openWorkflow(id, tab = 'details') {
  const cached = S.workflows.find((w) => String(w.id) === String(id));
  let wf = cached; let runs = null; let runsErr = null; let hist = null; let histErr = null;
  const draw = () => openSheet('wf:' + id, sheetHead(esc(wf?.name || 'Workflow')) + `<div class="sheet-body">${wf ? wfDetailHtml(wf, tab, runs, runsErr, hist, histErr) : '<div class="skeleton"></div>'}</div>`, (sh) => {
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
    const run = sh.querySelector('#wf-run'); if (run) run.onclick = () => openRun(wf);
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

function wfDetailHtml(wf, tab, runs, runsErr, hist, histErr) {
  const tabs = [['details', 'Details'], ['flow', 'Flow'], ['runs', 'Runs'], ['history', 'History']];
  let body = '';
  if (tab === 'details') body = wfDetailsTab(wf, hist);
  if (tab === 'flow') body = wfFlowTab(wf);
  if (tab === 'runs') body = runs ? wfRunsTab(runs) : runsErr ? `<div class="alert bad">${esc(runsErr)}</div>` : '<div class="skeleton"></div>';
  if (tab === 'history') body = wfHistoryTab(wf, hist, histErr);
  return `<div class="tabs">${tabs.map(([k, l]) => `<button data-wtab="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>${body}<div class="spacer"></div>`;
}

function wfDetailsTab(wf, hist) {
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

function wfFlowTab(wf) {
  const nodes = orderedNodes(wf);
  if (!nodes.length) return '<div class="card empty">This workflow has no nodes.</div>';
  return `<p class="help">Nodes in the order data flows through them, starting from the trigger.</p>
  <div class="flow">${nodes.map((n, i) => `${i ? '<div class="connector"></div>' : ''}
    <div class="node ${n.disabled ? 'disabled' : ''}">
      <div class="n-ico" style="${isTrigger(n) ? 'background:var(--accent);color:#fff' : ''}">${esc(initials(shortType(n.type)))}</div>
      <div class="n-main"><div class="n-name">${esc(n.name)}</div><div class="n-type">${esc(shortType(n.type))}${n.disabled ? ' · disabled' : ''}</div></div>
    </div>`).join('')}</div>`;
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
