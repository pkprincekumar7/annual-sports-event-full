## Identity Service

FastAPI service for authentication and player management. This ports routes from `routes/auth.js` and `routes/players.js`.

### Setup

- Install dependencies: `pip install -r requirements.txt`
- Configure environment: copy `.env.example` to `.env` and fill values
- Run locally: `uvicorn main:app --reload --port 8001`

### Required Services

- Event Configuration Service: `EVENT_CONFIGURATION_URL`
- Sports Participation Service: `SPORTS_PARTICIPATION_URL`
- Enrollment Service: `ENROLLMENT_URL`
- Organization Service: `ORGANIZATION_URL`
- Scheduling Service: `SCHEDULING_URL`
- Redis: `REDIS_URL`

### Auth Propagation

- Service-to-service calls forward the incoming `Authorization: Bearer <token>` header.
- No per-service tokens are supported.

### Endpoints

- `POST /api/login`
- `POST /api/change-password`
- `POST /api/reset-password`
- `GET /api/me`
- `GET /api/players`
- `POST /api/save-player`
- `PUT /api/update-player`
- `POST /api/bulk-player-enrollments`
- `DELETE /api/delete-player/{reg_number}`
- `POST /api/bulk-delete-players`

### Checklist

- `POST /api/login` returns `token`, `player`, and `change_password_required`
- `POST /api/change-password` enforces auth and clears `change_password_required`
- `POST /api/reset-password` sends email and updates password
- `GET /api/me` includes computed fields and `batch_name`
- `GET /api/players` supports search + pagination + computed fields
- `POST /api/save-player` validates department + batch + event context
- `PUT /api/update-player` enforces admin + gender immutability
- `POST /api/bulk-player-enrollments` returns enrollments + matches
- `DELETE /api/delete-player/{reg_number}` blocks team/match constraints
- `POST /api/bulk-delete-players` enforces constraints and returns details

### Smoke Test

Run the script below after setting `.env` and starting the service:

```sh
chmod +x scripts/smoke-test.sh
./scripts/smoke-test.sh
```

