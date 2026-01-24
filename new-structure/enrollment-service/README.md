## Enrollment Service

FastAPI service for batch management. This ports routes from `routes/batches.js`.

### Setup

- Install dependencies: `pip install -r requirements.txt`
- Configure environment: copy `.env.example` to `.env` and fill values
- Run locally: `uvicorn main:app --reload --port 8002`

### Required Services

- Identity Service: `IDENTITY_URL`
- Event Configuration Service: `EVENT_CONFIGURATION_URL`
- Redis: `REDIS_URL`

### Auth Propagation

- Service-to-service calls forward the incoming `Authorization: Bearer <token>` header.
- No per-service tokens are supported.

### Endpoints

- `POST /api/add-batch`
- `DELETE /api/remove-batch`
- `GET /api/batches`
- `POST /api/batches/assign-player`
- `POST /api/batches/unassign-player`
- `POST /api/batches/unassign-players`

### Checklist

- `POST /api/add-batch` enforces admin + registration period
- `DELETE /api/remove-batch` blocks deletion when players exist
- `GET /api/batches` returns cached list with players array
- `POST /api/batches/assign-player` assigns player to a batch
- `POST /api/batches/unassign-player` removes player from a batch
- `POST /api/batches/unassign-players` removes players from batches

### Smoke Test

Run the script below after setting `.env` and starting the service:

```sh
chmod +x scripts/smoke-test.sh
ADMIN_TOKEN=... EVENT_ID=... ./scripts/smoke-test.sh
```
