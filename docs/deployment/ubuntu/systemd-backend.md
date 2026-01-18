# Ubuntu - Backend systemd Service

Runs the Express API as a systemd service.

## 1) Install MongoDB (Local)

```bash
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update
sudo apt install -y mongodb-org
sudo systemctl enable mongod
sudo systemctl start mongod
```

## 2) Configure Environment

```bash
cd /var/www/annual-sports-event-full
cp .env.example .env
nano .env
```

Required values:
- `PORT=3001`
- `MONGODB_URI=...`
- `JWT_SECRET=...`

## 3) Create systemd Service

```bash
sudo nano /etc/systemd/system/annual-sports-backend.service
```

Paste:

```ini
[Unit]
Description=Annual Sports Backend - Express.js API Server
After=network.target mongod.service

[Service]
Type=simple
User=ubuntu
Group=ubuntu
WorkingDirectory=/var/www/annual-sports-event-full
Environment=NODE_ENV=production
Environment=PORT=3001
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=annual-sports-backend
PrivateTmp=true
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
```

## 4) Enable and Start

```bash
sudo systemctl daemon-reload
sudo systemctl enable annual-sports-backend
sudo systemctl start annual-sports-backend
sudo systemctl status annual-sports-backend
```

## 5) Logs

```bash
sudo journalctl -u annual-sports-backend -f
```

## 6) Restart After Updates

```bash
cd /var/www/annual-sports-event-full
npm install
sudo systemctl restart annual-sports-backend
```
