# Google Cloud Run Deployment (Frontend + Backend)

This guide deploys the app to Cloud Run:
- Artifact Registry for images
- Cloud Run services for backend and frontend
- Cloud Load Balancing + Cloud DNS for HTTPS

## Prerequisites
- GCP project with billing enabled
- `gcloud` authenticated
- A domain you control

## 1) Create Artifact Registry

```bash
gcloud config set project <your-project-id>
gcloud artifacts repositories create annual-sports \
  --repository-format=docker \
  --location=us-central1 \
  --description="Annual Sports images"
```

```bash
gcloud auth configure-docker us-central1-docker.pkg.dev
```

## 2) Build and Push Images

```bash
PROJECT_ID=<your-project-id>
REGION=us-central1
REPO=annual-sports

docker build -f Dockerfile.backend -t "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/annual-sports-backend:latest" .
docker build -f Dockerfile.frontend --build-arg VITE_API_URL=/api \
  -t "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/annual-sports-frontend:latest" .

docker push "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/annual-sports-backend:latest"
docker push "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/annual-sports-frontend:latest"
```

`VITE_API_URL` is a build-time value; changing it requires a rebuild.

## 3) Deploy Backend Service

```bash
gcloud run deploy annual-sports-backend \
  --image "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/annual-sports-backend:latest" \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3001 \
  --set-env-vars PORT=3001 \
  --set-env-vars JWT_SECRET="your-strong-secret" \
  --set-env-vars MONGODB_URI="mongodb+srv://<user>:<pass>@<cluster>/annual-sports" \
  --set-env-vars GMAIL_USER="your-email@gmail.com" \
  --set-env-vars GMAIL_APP_PASSWORD="your-16-char-app-password"
```

## 4) Deploy Frontend Service

```bash
gcloud run deploy annual-sports-frontend \
  --image "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/annual-sports-frontend:latest" \
  --region us-central1 \
  --allow-unauthenticated \
  --port 80
```

## 5) HTTPS and Custom Domain

Use Cloud Run domain mappings for each service:
- `your-domain.com` → frontend
- `api.your-domain.com` → backend

```bash
gcloud run domain-mappings create \
  --service annual-sports-frontend \
  --domain your-domain.com \
  --region us-central1
```

```bash
gcloud run domain-mappings create \
  --service annual-sports-backend \
  --domain api.your-domain.com \
  --region us-central1
```

## 6) Verify

```bash
curl -I https://your-domain.com
curl -I https://api.your-domain.com
```

## Manual Setup (Console)

Use Cloud Console to:
- Create Artifact Registry
- Deploy Cloud Run services
- Configure custom domains

## Teardown

```bash
gcloud run services delete annual-sports-frontend --region us-central1
gcloud run services delete annual-sports-backend --region us-central1
gcloud artifacts repositories delete annual-sports --location us-central1
```

## Best Practices Notes
- Use Secret Manager for backend secrets.
- Use separate Cloud Run services for frontend/backend.
- Pin image tags for releases.
