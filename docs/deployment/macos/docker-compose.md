# macOS - Docker Compose (Frontend + Backend)

## Prerequisites
- Docker Desktop installed and running (`macos/docker-desktop.md`)
- `.env` configured (copy from `.env.example`)

## Start Containers

```bash
docker compose up --build
```

## Detached Mode

```bash
docker compose up -d --build
```

## Rebuild Images (No Cache)

```bash
docker compose build --no-cache
```

## Restart / Stop

```bash
docker compose restart
```

```bash
docker compose down
```

## Logs

```bash
docker compose logs -f
```

## Ports
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`
