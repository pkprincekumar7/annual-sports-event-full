# Windows - Docker Compose (Frontend + Backend)

## Prerequisites
- Docker Desktop installed and running (`windows/docker-desktop.md`)
- `.env` configured (copy from `.env.example`)

## Start Containers

```powershell
docker compose up --build
```

## Detached Mode

```powershell
docker compose up -d --build
```

## Rebuild Images (No Cache)

```powershell
docker compose build --no-cache
```

## Restart / Stop

```powershell
docker compose restart
```

```powershell
docker compose down
```

## Logs

```powershell
docker compose logs -f
```

## Ports
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`
