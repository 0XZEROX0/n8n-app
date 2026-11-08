#!/usr/bin/env node
// n8n Mobile: tiny zero-dependency server.
// 1) Serves the PWA from ./public
// 2) Forwards /n8n/* to your n8n instance, so the browser never hits CORS.
//
// Usage:
//   N8N_URL=https://n8n.example.com PORT=8080 node server.js
//
// Env:
//   N8N_URL           Your n8n base URL (required unless ALLOW_ANY_TARGET=1)
//   PORT              Port to listen on (default 8080)
//   ALLOW_ANY_TARGET  "1" lets the app choose the n8n URL (sent in X-N8N-Target).
//                     Only use this on a private network: it is an open proxy.

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 8080);
const N8N_URL = (process.env.N8N_URL || '').replace(/\/+$/, '');
const ALLOW_ANY = process.env.ALLOW_ANY_TARGET === '1';
const PUBLIC_DIR = path.join(__dirname, 'public');

if (!N8N_URL && !ALLOW_ANY) {
  console.error('Set N8N_URL (e.g. N8N_URL=https://n8n.example.com node server.js)');
  process.exit(1);
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon',
};

function serveStatic(req, res) {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, p));
  if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) {
      // SPA fallback
      return fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (e2, idx) => {
        if (e2) { res.writeHead(404); return res.end('Not found'); }
        res.writeHead(200, { 'Content-Type': MIME['.html'] }); res.end(idx);
      });
    }
    const headers = { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' };
    if (p === '/sw.js') headers['Cache-Control'] = 'no-cache';
    res.writeHead(200, headers); res.end(buf);
  });
}

function proxy(req, res) {
  let base = N8N_URL;
  if (ALLOW_ANY && req.headers['x-n8n-target']) base = String(req.headers['x-n8n-target']).replace(/\/+$/, '');
  if (!base) { res.writeHead(400); return res.end('No n8n target configured'); }
  let target;
  try { target = new URL(base + req.url.replace(/^\/n8n/, '')); } catch { res.writeHead(400); return res.end('Bad target'); }
  if (!/^https?:$/.test(target.protocol)) { res.writeHead(400); return res.end('Bad protocol'); }

  const headers = { ...req.headers };
  delete headers.host; delete headers['x-n8n-target']; delete headers.origin; delete headers.referer;
  delete headers.cookie; delete headers.connection;
  headers.host = target.host;
  // Pass only n8n's own session cookie through (set when you sign in with email + password).
  const auth = (req.headers.cookie || '').split(/;\s*/).filter((c) => c.startsWith('n8n-auth='));
  if (auth.length) headers.cookie = auth.join('; ');
  const secure = req.socket.encrypted || /https/i.test(String(req.headers['x-forwarded-proto'] || ''));

  const lib = target.protocol === 'https:' ? https : http;
  const upstream = lib.request(target, { method: req.method, headers }, (up) => {
    const h = { ...up.headers };
    // Keep n8n's session cookie on this app's own address: drop its Domain, and its Secure
    // flag when the app itself is served over plain http (e.g. on your LAN).
    const cookies = [].concat(h['set-cookie'] || []).filter((c) => /^n8n-auth=/.test(c))
      .map((c) => c.replace(/;\s*Domain=[^;]*/i, '').replace(secure ? /$^/ : /;\s*Secure/i, ''));
    if (cookies.length) h['set-cookie'] = cookies; else delete h['set-cookie'];
    res.writeHead(up.statusCode || 502, h);
    up.pipe(res);
  });
  upstream.on('error', (e) => {
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Proxy could not reach n8n: ' + e.message }));
  });
  req.pipe(upstream);
}

http.createServer((req, res) => {
  if (req.url === '/app-config.json') {
    res.writeHead(200, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-cache' });
    return res.end(JSON.stringify({ proxy: true, n8nUrl: N8N_URL || null, allowAnyTarget: ALLOW_ANY }));
  }
  if (req.url.startsWith('/n8n/')) return proxy(req, res);
  serveStatic(req, res);
}).listen(PORT, () => {
  console.log(`n8n Mobile on http://0.0.0.0:${PORT}  ->  ${N8N_URL || '(target chosen in app)'}`);
});
