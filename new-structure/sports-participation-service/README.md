## Sports Participation Service

FastAPI service for sports, captains, coordinators, teams, and participants. This ports routes from
`routes/sports.js`, `routes/captains.js`, `routes/coordinators.js`, `routes/teams.js`, and `routes/participants.js`.

### Setup

- Install dependencies: `pip install -r requirements.txt`
- Configure environment: copy `.env.example` to `.env` and fill values
- Run locally: `uvicorn main:app --reload --port 8004`

### Required Services

- Event Configuration Service: `EVENT_CONFIGURATION_URL`
- Enrollment Service: `ENROLLMENT_URL`
- Identity Service: `IDENTITY_URL`
- Scheduling Service: `SCHEDULING_URL`
- Scoring Service: `SCORING_URL`
- Redis: `REDIS_URL`

### Auth Propagation

- Service-to-service calls forward the incoming `Authorization: Bearer <token>` header.
- No per-service tokens are supported.
### Endpoints

- `GET /api/sports`
- `POST /api/sports`
- `PUT /api/sports/{id}`
- `DELETE /api/sports/{id}`
- `GET /api/sports-counts`
- `GET /api/sports/{name}`
- `POST /api/add-captain`
- `DELETE /api/remove-captain`
- `GET /api/captains-by-sport`
- `POST /api/add-coordinator`
- `DELETE /api/remove-coordinator`
- `GET /api/coordinators-by-sport`
- `POST /api/update-team-participation`
- `GET /api/teams/{sport}`
- `POST /api/update-team-player`
- `DELETE /api/delete-team`
- `POST /api/validate-participations`
- `GET /api/participants/{sport}`
- `GET /api/participants-count/{sport}`
- `GET /api/player-enrollments/{reg_number}`
- `POST /api/update-participation`
- `DELETE /api/remove-participation`

### Checklist

- Public `/api/sports` and `/api/sports/{name}` responses match legacy payloads
- Team validations enforce batch + gender + captain rules
- Coordinator/captain assignment rules mirror legacy logic
- Cache invalidation follows the Node.js behavior

### Smoke Test

Run the script below after setting `.env` and starting the service:

```sh
chmod +x scripts/smoke-test.sh
ADMIN_TOKEN=... EVENT_ID=... REG_NUMBER=... SPORT_TYPE=... SPORT_CATEGORY=... ./scripts/smoke-test.sh
```
