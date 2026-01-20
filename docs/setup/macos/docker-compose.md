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

## Notes
- The frontend build uses `VITE_API_URL=/api` and Nginx proxies `/api` to `annual-sports-backend:3001`.
- `VITE_API_URL` is a build-time value; changing it requires a rebuild.
