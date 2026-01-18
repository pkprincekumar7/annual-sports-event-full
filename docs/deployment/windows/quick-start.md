# Windows Quick Start (Local)

Use this for local development on Windows.

## Prerequisites
- Node.js 16+ (18 LTS recommended)
- MongoDB Community Server (local or remote)
- Git

## 1) Install Node.js

Download and install from: https://nodejs.org/

Verify:
```powershell
node --version
npm --version
```

## 2) Install MongoDB (Local)

Download and install from: https://www.mongodb.com/try/download/community

Start the MongoDB service from Services or run:
```powershell
net start MongoDB
```

## 3) Clone and Install Dependencies

```powershell
cd C:\
git clone <your-repo-url> annual-sports-event-full
cd annual-sports-event-full
npm install
```

## 4) Configure Environment

```powershell
copy .env.example .env
```

Update `.env` with at least:
- `MONGODB_URI`
- `JWT_SECRET`
- `VITE_API_URL`

## 5) Run Backend + Frontend

Terminal 1 (backend):
```powershell
npm run dev:server
```

Terminal 2 (frontend):
```powershell
npm run dev
```

Open `http://localhost:5173`.
