# Windows - Run as Services (NSSM)

This uses **NSSM** (Non-Sucking Service Manager) to run the frontend preview server and backend API as Windows services.

## 1) Install NSSM

Download: https://nssm.cc/download

Extract and add the folder to PATH or reference the full path to `nssm.exe`.

## 2) Configure Environment

```powershell
cd C:\annual-sports-event-full
copy .env.example .env
```

Set `VITE_API_URL` to your backend URL before building.

## 3) Build the Frontend

```powershell
cd C:\annual-sports-event-full
npm install
npm run build
```

## 4) Create Frontend Service

```powershell
nssm install AnnualSportsFrontend "C:\\Program Files\\nodejs\\npm.cmd" "run preview"
```

Set:
- **Startup directory**: `C:\annual-sports-event-full`
- **Environment**: `NODE_ENV=production`, `PORT=5173`

Start the service:
```powershell
nssm start AnnualSportsFrontend
```

## 5) Create Backend Service

```powershell
nssm install AnnualSportsBackend "C:\\Program Files\\nodejs\\npm.cmd" "start"
```

Set:
- **Startup directory**: `C:\annual-sports-event-full`
- **Environment**: `NODE_ENV=production`, `PORT=3001`

Start the service:
```powershell
nssm start AnnualSportsBackend
```

## 6) Manage Services

```powershell
nssm status AnnualSportsFrontend
nssm restart AnnualSportsFrontend
nssm stop AnnualSportsFrontend
```

```powershell
nssm status AnnualSportsBackend
nssm restart AnnualSportsBackend
nssm stop AnnualSportsBackend
```
