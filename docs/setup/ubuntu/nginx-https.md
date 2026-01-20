# Ubuntu - HTTPS with Nginx (Frontend + Backend)

Use this to secure the frontend and backend with HTTPS using Nginx + Let's Encrypt.
It assumes the services are already running locally on:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`

## Prerequisites
- A domain you own or control for the frontend (replace `your-domain.com`)
- A domain or subdomain for the backend API (replace `api.your-domain.com`)
- DNS A records pointing both domains to your server's public IP
- Nginx installed (`docs/setup/ubuntu/nginx-reverse-proxy.md`)

If you do not have a domain, you can still use HTTP with the reverse proxy guide,
but Let's Encrypt cannot issue certificates for a bare IP address.

## 1) Install Certbot

```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
```

## 2) Create Nginx Sites

You can use **two domains** (frontend + API subdomain) or a **single domain** with `/api`.
Pick one of the options below.

### Option A: Two domains (recommended)

Create the frontend site:

```bash
sudo nano /etc/nginx/sites-available/annual-sports-frontend
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Create the backend site:

```bash
sudo nano /etc/nginx/sites-available/annual-sports-backend
```

```nginx
server {
    listen 80;
    server_name api.your-domain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable both sites:

```bash
sudo ln -s /etc/nginx/sites-available/annual-sports-frontend /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/annual-sports-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Option B: Single domain with `/api`

Create a single site file:

```bash
sudo nano /etc/nginx/sites-available/annual-sports
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/annual-sports /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Note: If you previously enabled the two-domain sites, disable them to avoid duplicate
`server_name` conflicts, then reload Nginx:

```bash
sudo rm /etc/nginx/sites-enabled/annual-sports-frontend
sudo rm /etc/nginx/sites-enabled/annual-sports-backend
sudo nginx -t
sudo systemctl reload nginx
```

## 3) Issue HTTPS Certificates

```bash
sudo certbot --nginx -d your-domain.com -d api.your-domain.com
```

Certbot will update the Nginx configs and enable HTTPS automatically.

## 4) Update Frontend API URL

Set `VITE_API_URL` to your HTTPS backend URL and rebuild the frontend.

- Two domains: use `https://api.your-domain.com`.
- Single domain with `/api`: use `https://your-domain.com`.
- Local build: update `.env` and rebuild.
- Docker build: use `--build-arg VITE_API_URL=...`.

## 5) Verify

```bash
curl -I https://your-domain.com
curl -I https://api.your-domain.com
```

## 6) Auto-renew Certificates

```bash
sudo systemctl status certbot.timer
sudo certbot renew --dry-run
```
