# Google Cloud GKE Deployment (Frontend + Backend)

This guide deploys the app to Google Kubernetes Engine (GKE):
- Artifact Registry for images
- GKE for workloads
- GKE Ingress (HTTP(S) Load Balancer)
- Cloud DNS + managed TLS

## Prerequisites
- GCP project with billing enabled
- `gcloud` installed and authenticated
- `kubectl` installed (or use `gcloud` to install it)
- A domain you control (Cloud DNS or external DNS)

## 1) Set Project and Region

```bash
gcloud config set project <your-project-id>
gcloud config set compute/region us-central1
gcloud config set compute/zone us-central1-a
```

## 2) Create Artifact Registry

```bash
gcloud artifacts repositories create annual-sports \
  --repository-format=docker \
  --location=us-central1 \
  --description="Annual Sports images"
```

Configure Docker auth:

```bash
gcloud auth configure-docker us-central1-docker.pkg.dev
```

## 3) Build and Push Images

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

## 4) Create GKE Cluster

```bash
gcloud container clusters create annual-sports \
  --region us-central1 \
  --num-nodes 2 \
  --machine-type e2-standard-2
```

Get credentials:

```bash
gcloud container clusters get-credentials annual-sports --region us-central1
```

## 5) Create Namespace and Secrets

```bash
kubectl create namespace annual-sports
```

```bash
kubectl -n annual-sports create secret generic backend-secrets \
  --from-literal=JWT_SECRET="your-strong-secret" \
  --from-literal=MONGODB_URI="mongodb://mongodb-0.mongodb:27017/annual-sports" \
  --from-literal=GMAIL_USER="your-email@gmail.com" \
  --from-literal=GMAIL_APP_PASSWORD="your-16-char-app-password"
```

```bash
kubectl -n annual-sports create configmap frontend-config \
  --from-literal=VITE_API_URL="/api"
```

## 6) Deploy MongoDB (Optional)

For production, use MongoDB Atlas or a managed Mongo service.

```bash
kubectl apply -f mongodb.yaml
kubectl -n annual-sports rollout status statefulset/mongodb
```

## 7) Deploy Backend and Frontend

Update `backend.yaml` and `frontend.yaml` to use Artifact Registry image URLs:

```bash
kubectl apply -f backend.yaml
kubectl apply -f frontend.yaml
```

## 8) Ingress + TLS

Create an `ingress.yaml`, replace the host, then apply it:

```bash
cat <<'EOF' > ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: annual-sports-ingress
  namespace: annual-sports
  annotations:
    kubernetes.io/ingress.class: "gce"
spec:
  rules:
    - host: your-domain.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: annual-sports-frontend
                port:
                  number: 80
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: annual-sports-backend
                port:
                  number: 3001
EOF

kubectl apply -f ingress.yaml
```

Create a managed certificate (optional but recommended):

```yaml
apiVersion: networking.gke.io/v1
kind: ManagedCertificate
metadata:
  name: annual-sports-cert
  namespace: annual-sports
spec:
  domains:
    - your-domain.com
```

Attach it by adding annotation:

```yaml
metadata:
  annotations:
    networking.gke.io/managed-certificates: annual-sports-cert
```

## 9) DNS Setup

Point `your-domain.com` to the load balancer IP from the ingress.

## 10) Verify

```bash
curl -I https://your-domain.com
curl -I https://your-domain.com/api/health
```

## Manual Setup (Console)

Use Cloud Console to:
- Create Artifact Registry
- Create GKE cluster
- Create DNS records
- Configure HTTPS load balancer

Then deploy with `kubectl`.

## Teardown

```bash
gcloud container clusters delete annual-sports --region us-central1
```

Delete Artifact Registry:

```bash
gcloud artifacts repositories delete annual-sports --location us-central1
```

## Best Practices Notes
- Use MongoDB Atlas for production.
- Store secrets in Secret Manager and sync to Kubernetes.
- Pin image tags and enable image scanning.
