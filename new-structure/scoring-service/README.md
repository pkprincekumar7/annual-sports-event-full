## Scoring Service

FastAPI service for points table operations. This ports `routes/pointsTable.js` and related
helpers for points backfill.

### Setup

- Install dependencies: `pip install -r requirements.txt`
- Configure environment: copy `.env.example` to `.env` and fill values
- Run locally: `uvicorn main:app --reload --port 8007`

### Required Services

- Event Configuration Service: `EVENT_CONFIGURATION_URL`
- Sports Participation Service: `SPORTS_PARTICIPATION_URL`
- Scheduling Service: `SCHEDULING_URL`
- Identity Service: `IDENTITY_URL`
- Redis: `REDIS_URL`

### Auth Propagation

- Service-to-service calls forward the incoming `Authorization: Bearer <token>` header.
- No per-service tokens are supported.
### Endpoints

- `GET /api/points-table/{sport}`
- `POST /api/points-table/backfill/{sport}`
- `POST /api/internal/points-table/update` (internal)

### Checklist

- Points table responses match legacy payloads
- Backfill recalculates league match results for both genders

### Smoke Test

```sh
chmod +x scripts/smoke-test.sh
ADMIN_TOKEN=... EVENT_ID=... SPORT_NAME=... ./scripts/smoke-test.sh
```
