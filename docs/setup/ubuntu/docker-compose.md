# Ubuntu - Docker Compose (Frontend + Backend)

Run the full stack using Docker Compose.

## Prerequisites
- Docker Engine + Compose installed (`ubuntu/docker-engine-install.md`)
- `.env` configured (copy from `.env.example`)

## 1) Start Containers

```bash
docker compose up --build
```

## 2) Run in Background (Detached)

```bash
docker compose up -d --build
```

## 3) Rebuild Images (No Cache)

```bash
docker compose build --no-cache
```

## 4) Restart Containers

```bash
docker compose restart
```

## 5) Rebuild and Restart (One-liner)

```bash
docker compose up -d --build --force-recreate
```

## 6) Stop and Remove

```bash
docker compose down
```

## 7) Follow Logs

```bash
docker compose logs -f
```

## Ports
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`

## Notes
- The frontend build uses `VITE_API_URL=/api` and Nginx proxies `/api` to `annual-sports-backend:3001`.
