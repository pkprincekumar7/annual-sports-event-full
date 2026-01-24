## Organization Service

FastAPI service for department management, porting routes from `routes/departments.js`.

### Setup

- Install dependencies: `pip install -r requirements.txt`
- Configure environment: copy `.env.example` to `.env` and fill values
- Run locally: `uvicorn main:app --reload --port 8003`

### Required Services

- Identity Service: `IDENTITY_URL`
- Event Configuration Service: `EVENT_CONFIGURATION_URL` (for registration deadline checks)
- Redis: `REDIS_URL`

### Auth Propagation

- Service-to-service calls forward the incoming `Authorization: Bearer <token>` header.
- No per-service tokens are supported.
### Endpoints

- `GET /api/departments`
- `POST /api/departments`
- `PUT /api/departments/{department_id}`
- `DELETE /api/departments/{department_id}`

### Checklist

- `GET /api/departments` returns departments sorted with `player_count`
- `POST /api/departments` enforces unique names and admin auth
- `PUT /api/departments/{department_id}` only updates `display_order`
- `DELETE /api/departments/{department_id}` blocks if players exist

### Smoke Test

Run the script below after setting `.env` and starting the service:

```sh
chmod +x scripts/smoke-test.sh
./scripts/smoke-test.sh
```

The smoke test requires `curl` and `jq` to be available in your shell.
