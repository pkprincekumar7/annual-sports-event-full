# Environment Setup (.env)

Each service ships a `.env.example` file. Copy it to `.env` and fill in real values.

## Steps

```bash
for service in \
  identity-service \
  enrollment-service \
  department-service \
  sports-participation-service \
  event-configuration-service \
  scheduling-service \
  scoring-service \
  reporting-service; do
  cp "$service/.env.example" "$service/.env"
done
```

Open each `.env` and update all values for your environment. Commonly updated values include:

- `MONGODB_URI`
- `DATABASE_NAME`
- `JWT_SECRET`
- `REDIS_URL`
- `GMAIL_USER`
- `GMAIL_APP_PASSWORD`
- `EMAIL_FROM`
- service base URLs (for service-to-service calls)

## Docker Compose notes

When running under Docker Compose, services cannot reach `localhost` for other services.
Update service URLs to use Compose DNS names instead, for example:

- `IDENTITY_URL=http://identity-service:8001`
- `ENROLLMENT_URL=http://enrollment-service:8002`
- `DEPARTMENT_URL=http://department-service:8003`
- `SPORTS_PARTICIPATION_URL=http://sports-participation-service:8004`
- `EVENT_CONFIGURATION_URL=http://event-configuration-service:8005`
- `SCHEDULING_URL=http://scheduling-service:8006`
- `SCORING_URL=http://scoring-service:8007`
- `REPORTING_URL=http://reporting-service:8008`

Set Redis to the Compose service name:

- `REDIS_URL=redis://redis:6379/0`

MongoDB is not included in the Compose file. Use a managed MongoDB or add a MongoDB
service and point `MONGODB_URI` to it.

If the frontend needs a custom API base URL outside Docker, create `frontend/.env` and set:

```bash
VITE_API_URL=/
```
