# Ubuntu - Kubernetes Deployment (Microservices)

This guide deploys the frontend and multiple FastAPI services on a Kubernetes cluster. It assumes you already have a working Kubernetes cluster and `kubectl` configured.

## Prerequisites
- A Kubernetes cluster (minikube, k3s, EKS, GKE, AKS, etc.)
- `kubectl` installed and connected to your cluster
- Container registry access (Docker Hub, GHCR, ECR, etc.)
- Docker login for your registry (required for pushing images)

If you are new to Kubernetes, follow `docs/setup/ubuntu/kubernetes-prereqs.md` first.

## 1) Build and Push Images

From the repo root:

```bash
docker login

for service in \
  identity-service \
  enrollment-service \
  department-service \
  sports-participation-service \
  event-configuration-service \
  scheduling-service \
  scoring-service \
  reporting-service; do
  docker build -t "your-registry/annual-sports-${service}:latest" "new-structure/$service"
  docker push "your-registry/annual-sports-${service}:latest"
done

docker build -t your-registry/annual-sports-frontend:latest \
  --build-arg VITE_API_URL=/ \
  new-structure/frontend
docker push your-registry/annual-sports-frontend:latest
```

`VITE_API_URL` is a build-time value for the frontend image, so changing it requires a rebuild and redeploy.

## 2) Create Namespace

```bash
kubectl create namespace annual-sports
```

If your registry is private, create an image pull secret:

```bash
kubectl -n annual-sports create secret docker-registry regcred \
  --docker-server=https://index.docker.io/v1/ \
  --docker-username=<your-username> \
  --docker-password=<your-password-or-token> \
  --docker-email=<your-email>
```

Attach it to the default service account:

```bash
kubectl -n annual-sports patch serviceaccount default \
  -p '{"imagePullSecrets":[{"name":"regcred"}]}'
```

## 3) Create Secrets and Config

Create one secret per service (or a shared secret if you prefer). Example for Identity:

```bash
kubectl -n annual-sports create secret generic identity-secrets \
  --from-literal=JWT_SECRET="your-strong-secret" \
  --from-literal=MONGODB_URI="mongodb://mongodb-0.mongodb:27017/annual-sports-identity" \
  --from-literal=DATABASE_NAME="annual-sports-identity" \
  --from-literal=REDIS_URL="redis://redis:6379/0" \
  --from-literal=GMAIL_USER="your-email@gmail.com" \
  --from-literal=GMAIL_APP_PASSWORD="your-16-char-app-password" \
  --from-literal=EMAIL_FROM="no-reply@your-domain.com"
```

Create the frontend config:

```bash
kubectl -n annual-sports create configmap frontend-config \
  --from-literal=VITE_API_URL="/"
```

## 4) Deploy MongoDB and Redis (Optional)

- For production, use managed MongoDB/Redis.
- For local clusters, you can deploy MongoDB (use `mongodb.yaml`) and a Redis chart or simple Deployment/Service.

If you are using an external MongoDB/Redis, update the service `.env` values accordingly.

## 5) Deploy Services

Create one Deployment and Service per microservice. Example for Identity:

```bash
cat <<'EOF' > identity-service.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: identity-service
  namespace: annual-sports
spec:
  replicas: 1
  selector:
    matchLabels:
      app: identity-service
  template:
    metadata:
      labels:
        app: identity-service
    spec:
      containers:
        - name: identity-service
          image: your-registry/annual-sports-identity-service:latest
          ports:
            - containerPort: 8001
          envFrom:
            - secretRef:
                name: identity-secrets
---
apiVersion: v1
kind: Service
metadata:
  name: identity-service
  namespace: annual-sports
spec:
  selector:
    app: identity-service
  ports:
    - name: http
      port: 8001
      targetPort: 8001
EOF

kubectl apply -f identity-service.yaml
```

Repeat for the other services and ports:
- Enrollment: `8002`
- Department: `8003`
- Sports Participation: `8004`
- Event Configuration: `8005`
- Scheduling: `8006`
- Scoring: `8007`
- Reporting: `8008`

## 6) Deploy Frontend

Create a Deployment/Service for the frontend image (port 80), then expose it via Ingress:

```bash
cat <<'EOF' > frontend.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: annual-sports-frontend
  namespace: annual-sports
spec:
  replicas: 1
  selector:
    matchLabels:
      app: annual-sports-frontend
  template:
    metadata:
      labels:
        app: annual-sports-frontend
    spec:
      containers:
        - name: frontend
          image: your-registry/annual-sports-frontend:latest
          ports:
            - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: annual-sports-frontend
  namespace: annual-sports
spec:
  selector:
    app: annual-sports-frontend
  ports:
    - name: http
      port: 80
      targetPort: 80
EOF

kubectl apply -f frontend.yaml
```

## 7) Ingress (Optional)

If you have an Ingress controller installed (NGINX, Traefik), create an `ingress.yaml`
with the content below. Update the `host` value and `ingressClassName` if your cluster
requires it, then apply the file.

```bash
cat <<'EOF' > ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: annual-sports-ingress
  namespace: annual-sports
spec:
  ingressClassName: nginx
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
          - path: /identities
            pathType: Prefix
            backend:
              service:
                name: identity-service
                port:
                  number: 8001
          - path: /enrollments
            pathType: Prefix
            backend:
              service:
                name: enrollment-service
                port:
                  number: 8002
          - path: /departments
            pathType: Prefix
            backend:
              service:
                name: department-service
                port:
                  number: 8003
          - path: /sports-participations
            pathType: Prefix
            backend:
              service:
                name: sports-participation-service
                port:
                  number: 8004
          - path: /event-configurations
            pathType: Prefix
            backend:
              service:
                name: event-configuration-service
                port:
                  number: 8005
          - path: /schedulings
            pathType: Prefix
            backend:
              service:
                name: scheduling-service
                port:
                  number: 8006
          - path: /scorings
            pathType: Prefix
            backend:
              service:
                name: scoring-service
                port:
                  number: 8007
          - path: /reportings
            pathType: Prefix
            backend:
              service:
                name: reporting-service
                port:
                  number: 8008
EOF

kubectl apply -f ingress.yaml
```

## 8) Verify

```bash
kubectl -n annual-sports get pods
kubectl -n annual-sports get svc
kubectl -n annual-sports get ingress
```

Check rollout history:

```bash
kubectl -n annual-sports rollout history deploy/identity-service
kubectl -n annual-sports rollout history deploy/annual-sports-frontend
```

Rollback (if needed):

```bash
kubectl -n annual-sports rollout undo deploy/identity-service
kubectl -n annual-sports rollout undo deploy/annual-sports-frontend
```

## 9) Apply Updated YAML

If a service manifest or the frontend manifest changes, re-apply and verify rollout:

```bash
kubectl apply -f identity-service.yaml
kubectl apply -f frontend.yaml

kubectl -n annual-sports rollout status deploy/identity-service
kubectl -n annual-sports rollout status deploy/annual-sports-frontend
```

If the image tag stays the same (e.g., `latest`), restart to pull the new image:

```bash
kubectl -n annual-sports rollout restart deploy/identity-service
kubectl -n annual-sports rollout restart deploy/annual-sports-frontend
```

## 10) Access the Frontend

If you are using minikube:

```bash
minikube service -n annual-sports annual-sports-frontend
```

If you get `xdg-open` / browser errors on a server VM, use the URL directly:

```bash
minikube service -n annual-sports annual-sports-frontend --url
```

If you kept the service as `ClusterIP`, use port-forwarding instead:

```bash
kubectl -n annual-sports port-forward svc/annual-sports-frontend 5173:80
```

If you are running on a remote Ubuntu instance and want to access from a local browser, bind the forward to all interfaces and open the port in your firewall/security group:

```bash
kubectl -n annual-sports port-forward svc/annual-sports-frontend 5173:80 --address 0.0.0.0
```

Then visit:

```
http://<PUBLIC_IP>:5173
```

For a systemd-based port-forward that survives SSH disconnects and VM reboots, see:
`docs/setup/ubuntu/kubectl-port-forward-systemd.md`.

If `minikube service` says "no node port", patch the service:

```bash
kubectl -n annual-sports patch svc annual-sports-frontend -p '{"spec":{"type":"NodePort"}}'
minikube service -n annual-sports annual-sports-frontend --url
```

## 11) Troubleshooting

### ImagePullBackOff

```bash
kubectl -n annual-sports get pods
kubectl -n annual-sports describe pod <pod-name>
```

Common fixes:
- Make sure the image exists in your registry
- Run `docker login` and re-push
- If private, create `regcred` and attach it to the service account

### CrashLoopBackOff (frontend)

Check logs:

```bash
kubectl -n annual-sports logs <frontend-pod>
```

## Notes
- The frontend expects base paths like `/identities` and `/enrollments` to reach each service.
- For production, use TLS via Ingress and move secrets to a secret manager.
