# Deployment

The app must be served over **HTTPS** for Android to offer "Install app".

## 1. Docker (recommended)

```bash
git clone https://github.com/<you>/<repo>.git && cd <repo>
docker build -t n8n-mobile .
docker run -d --name n8n-mobile --restart unless-stopped \
  -p 8080:8080 -e N8N_URL=https://n8n.example.com n8n-mobile
```

### docker compose (next to an existing n8n service)

```yaml
services:
  n8n-mobile:
    build: .
    restart: unless-stopped
    environment:
      - N8N_URL=http://n8n:5678   # internal address works too
    ports:
      - "8080:8080"
```

## 2. Plain Node

```bash
N8N_URL=https://n8n.example.com PORT=8080 node server.js
```

Keep it running with systemd, pm2, or similar.

## 3. HTTPS with your reverse proxy

Caddy:

```
mobile.example.com {
    reverse_proxy localhost:8080
}
```

nginx:

```
server {
    listen 443 ssl;
    server_name mobile.example.com;
    # ssl_certificate ... ;
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
    }
}
```

You can also serve it under a path of the n8n domain, but a separate subdomain is simplest.

## 4. Static hosting without server.js

Host `public/` anywhere (GitHub Pages, Netlify, Cloudflare Pages). The app will call n8n directly, so add CORS on n8n's reverse proxy:

```
location ~ ^/(api|webhook)/ {
    add_header Access-Control-Allow-Origin "https://your-app-host" always;
    add_header Access-Control-Allow-Headers "X-N8N-API-KEY, Content-Type, Authorization" always;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, PATCH, DELETE, OPTIONS" always;
    if ($request_method = OPTIONS) { return 204; }
    proxy_pass http://127.0.0.1:5678;
}
```

## Environment variables

| Variable | Default | Meaning |
| --- | --- | --- |
| `N8N_URL` | (required) | Base URL of your n8n, e.g. `https://n8n.example.com` |
| `PORT` | `8080` | Port the app listens on |
| `ALLOW_ANY_TARGET` | unset | `1` lets the app choose the n8n URL. This is an open proxy: private networks only. |

## Install on the phone

Open the HTTPS address in Chrome → ⋮ → **Install app** / **Add to Home screen**.

## Updating

```bash
git pull && docker build -t n8n-mobile . && docker rm -f n8n-mobile && docker run ... (same command as above)
```
