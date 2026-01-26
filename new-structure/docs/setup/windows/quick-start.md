# Windows Quick Start (Local)

Use this for local development on Windows.

## Prerequisites
- Node.js 24+ (24 LTS recommended)
- Python 3.12+
- MongoDB Community Server (local or remote)
- Redis (local or remote)
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

## 3) Install Redis (Local)

Redis is not officially supported on Windows. Use one of:
- Docker: `docker run --name redis -p 6379:6379 -d redis:7-alpine`
- WSL + Redis
- A managed Redis service

## 4) Clone and Install Dependencies

```powershell
cd C:\
git clone <your-repo-url> annual-sports-event-full
cd annual-sports-event-full\new-structure
```

## 5) Configure Environment

```powershell
foreach ($svc in @(
  "identity-service",
  "enrollment-service",
  "department-service",
  "sports-participation-service",
  "event-configuration-service",
  "scheduling-service",
  "scoring-service",
  "reporting-service"
)) {
  Copy-Item "$svc\.env.example" "$svc\.env"
}
```

Update each `.env` with required values:
- `MONGODB_URI`
- `DATABASE_NAME`
- `JWT_SECRET`
- `REDIS_URL`
- `GMAIL_USER`
- `GMAIL_APP_PASSWORD`
- `EMAIL_FROM`

See `docs/setup/env-setup.md` for details.

## 6) Run with Docker Compose (Recommended)

```powershell
docker compose up --build
```

Open `http://localhost:5173`.

Notes for Docker Compose:
- Update service URLs in each `.env` to use Compose DNS names (e.g., `http://identity-service:8001`).
- Set `REDIS_URL=redis://redis:6379/0`.
- MongoDB is not included in the Compose file; use a managed MongoDB or add one.

## 7) Run Services Locally (No Docker)

Start each service in its own terminal:

```powershell
cd C:\annual-sports-event-full\new-structure\identity-service
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

Repeat for the remaining services with their ports:
- Enrollment: `8002`
- Department: `8003`
- Sports Participation: `8004`
- Event Configuration: `8005`
- Scheduling: `8006`
- Scoring: `8007`
- Reporting: `8008`

Start the frontend:

```powershell
cd C:\annual-sports-event-full\new-structure\frontend
npm install
npm run dev
```

If you are using the Vite dev server, API calls are proxied to the service ports above.
