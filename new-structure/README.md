## Annual Sports (New Structure)

This folder contains the FastAPI microservices + Vite frontend for the annual sports application.

### Services

- Identity Service (`identity-service`)
- Enrollment Service (`enrollment-service`)
- Organization Service (`organization-service`)
- Sports Participation Service (`sports-participation-service`)
- Event Configuration Service (`event-configuration-service`)
- Scheduling Service (`scheduling-service`)
- Scoring Service (`scoring-service`)
- Reporting Service (`reporting-service`)
- Frontend (`frontend`)

### Prerequisites

- Docker + Docker Compose (recommended for local orchestration)
- Python 3.11+ for running services outside Docker
- Node 18+ for the frontend

### Environment Setup

- Each service ships a `.env.example`. Copy it to `.env` and fill values.
- Redis is required for all services via `REDIS_URL`.
- Service-to-service calls forward the incoming `Authorization: Bearer <token>` header.
  No per-service tokens are supported.

### Local Development

Run all services with Docker Compose from this folder:

```sh
docker compose up --build
```

Run a single service locally:

```sh
cd identity-service
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

Run the frontend:

```sh
cd frontend
npm install
npm run dev
```

### Notes

- The API gateway routes to the microservices via `nginx.conf`.
- Each service README includes endpoints, smoke tests, and validation notes.
