# macOS Quick Start (Local)

Use this for local development on macOS.

## Prerequisites
- Homebrew
- Node.js 24+ (24 LTS recommended)
- MongoDB (local or remote)
- Git

## 1) Install Homebrew (if needed)

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

## 2) Install Node.js

```bash
brew install node
node --version
npm --version
```

## 3) Install MongoDB (Local)

```bash
brew tap mongodb/brew
brew install mongodb-community@7.0
brew services start mongodb-community@7.0
```

## 4) Clone and Install Dependencies

```bash
cd ~/projects
git clone <your-repo-url> annual-sports-event-full
cd annual-sports-event-full
npm install
```

## 5) Configure Environment

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

## 6) Run Backend + Frontend

Terminal 1 (backend):
```bash
npm run dev:server
```

Terminal 2 (frontend):
```bash
npm run dev
```

Open `http://localhost:5173`.
