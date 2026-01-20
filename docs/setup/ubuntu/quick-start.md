# Ubuntu Quick Start (Local)

Use this for local development on Ubuntu/Debian.

## Prerequisites
- Node.js 24+ (24 LTS recommended)
- npm (included with Node.js)
- MongoDB (local or remote)
- Git

## 1) Install Node.js 24

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_24.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list
sudo apt update
sudo apt install -y nodejs
node --version
npm --version
```

## 2) Install MongoDB (Local)

```bash
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update
sudo apt install -y mongodb-org
sudo systemctl enable mongod
sudo systemctl start mongod
```

## 3) Clone and Install Dependencies

```bash
cd /var/www
sudo git clone <your-repo-url> annual-sports-event-full
sudo chown -R $USER:$USER annual-sports-event-full
cd annual-sports-event-full
npm install
```

## 4) Configure Environment

```bash
cp .env.example .env
```

Update `.env` with required values:
- `PORT`
- `MONGODB_URI`
- `JWT_SECRET`
- `VITE_API_URL`
- `GMAIL_USER`
- `GMAIL_APP_PASSWORD`

See `docs/setup/env-setup.md` for details.

## 5) Run Backend + Frontend

Terminal 1 (backend):
```bash
npm run dev:server
```

Terminal 2 (frontend):
```bash
npm run dev
```

Open `http://localhost:5173`.
