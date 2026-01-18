# Ubuntu - Frontend systemd Service

Runs the production frontend using Vite preview. Use Nginx for HTTPS and standard ports.

## 1) Build the Frontend

```bash
cd /var/www/annual-sports-event-full
npm install
npm run build
```

## 2) Create systemd Service

```bash
sudo nano /etc/systemd/system/annual-sports-frontend.service
```

Paste:

```ini
[Unit]
Description=Annual Sports Frontend - Vite Preview Server
After=network.target

[Service]
Type=simple
User=ubuntu
Group=ubuntu
WorkingDirectory=/var/www/annual-sports-event-full
Environment=NODE_ENV=production
Environment=PORT=5173
ExecStart=/usr/bin/npm run preview
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=annual-sports-frontend
PrivateTmp=true
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
```

## 3) Enable and Start

```bash
sudo systemctl daemon-reload
sudo systemctl enable annual-sports-frontend
sudo systemctl start annual-sports-frontend
sudo systemctl status annual-sports-frontend
```

## 4) Logs

```bash
sudo journalctl -u annual-sports-frontend -f
```

## 5) Restart After Updates

```bash
cd /var/www/annual-sports-event-full
npm install
npm run build
sudo systemctl restart annual-sports-frontend
```
