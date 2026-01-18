# Ubuntu - Kubernetes Deployment

This guide deploys the frontend and backend as separate services on a Kubernetes cluster and uses a MongoDB StatefulSet. It assumes you already have a working Kubernetes cluster and `kubectl` configured.

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
docker build -f Dockerfile.backend -t pkprincekumar7/annual-sports-backend:latest .
docker build -f Dockerfile.frontend --build-arg VITE_API_URL=/api -t pkprincekumar7/annual-sports-frontend:latest .

docker push pkprincekumar7/annual-sports-backend:latest
docker push pkprincekumar7/annual-sports-frontend:latest
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

## 2) Create Namespace

```bash
kubectl create namespace annual-sports
```

## 3) Create Secrets and Config

### Backend Secrets

```bash
kubectl -n annual-sports create secret generic backend-secrets \
  --from-literal=JWT_SECRET="your-strong-secret" \
  --from-literal=MONGODB_URI="mongodb://mongodb-0.mongodb:27017/annual-sports" \
  --from-literal=GMAIL_USER="your-gmail-address" \
  --from-literal=GMAIL_APP_PASSWORD="your-gmail-app-password"
```

### Frontend Config

```bash
kubectl -n annual-sports create configmap frontend-config \
  --from-literal=VITE_API_URL="/api"
```

## 4) Deploy MongoDB (StatefulSet)

Use the repo file `mongodb.yaml`. If you are using an external MongoDB, skip this step and update `MONGODB_URI` in the secret accordingly.
If your cluster does not have a default `StorageClass`, set `storageClassName` in `mongodb.yaml` before applying.

Apply:

```bash
kubectl apply -f mongodb.yaml
```

Wait for MongoDB:

```bash
kubectl -n annual-sports rollout status statefulset/mongodb
```

## 5) Deploy Backend

Use the repo file `backend.yaml` (update the image registry before applying if you are not using `pkprincekumar7`).

Apply:

```bash
kubectl apply -f backend.yaml
```

Wait for backend:

```bash
kubectl -n annual-sports rollout status deploy/annual-sports-backend
```

Restart backend after image updates:

```bash
kubectl -n annual-sports rollout restart deploy/annual-sports-backend
```

## 6) Deploy Frontend

Use the repo file `frontend.yaml` (update the image registry before applying if you are not using `pkprincekumar7`).

Apply:

```bash
kubectl apply -f frontend.yaml
```

Wait for frontend:

```bash
kubectl -n annual-sports rollout status deploy/annual-sports-frontend
```

Restart frontend after image updates:

```bash
kubectl -n annual-sports rollout restart deploy/annual-sports-frontend
```

## 7) Ingress (Optional)

If you have an Ingress controller installed (NGINX, Traefik), use the repo file `ingress.yaml`, update the host value, and set the correct `ingressClassName` if your cluster requires it.

Apply:

```bash
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
kubectl -n annual-sports rollout history deploy/annual-sports-backend
kubectl -n annual-sports rollout history deploy/annual-sports-frontend
```

Rollback (if needed):

```bash
kubectl -n annual-sports rollout undo deploy/annual-sports-backend
kubectl -n annual-sports rollout undo deploy/annual-sports-frontend
```

## 9) Apply Updated YAML

If `backend.yaml` or `frontend.yaml` changes, re-apply and verify rollout:

```bash
kubectl apply -f backend.yaml
kubectl apply -f frontend.yaml

kubectl -n annual-sports rollout status deploy/annual-sports-backend
kubectl -n annual-sports rollout status deploy/annual-sports-frontend
```

If the image tag stays the same (e.g., `latest`), restart to pull the new image:

```bash
kubectl -n annual-sports rollout restart deploy/annual-sports-backend
kubectl -n annual-sports rollout restart deploy/annual-sports-frontend
```

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
kubectl -n annual-sports port-forward svc/annual-sports-frontend 8080:80
```

If you are running on a remote Ubuntu instance and want to access from a local browser, bind the forward to all interfaces and open the port in your firewall/security group:

```bash
kubectl -n annual-sports port-forward svc/annual-sports-frontend 8080:80 --address 0.0.0.0
```

Then visit:

```
http://<PUBLIC_IP>:8080
```

To keep the port-forward running after you close your SSH session, create a systemd service on the VM:

```bash
sudo tee /etc/systemd/system/annual-sports-frontend-forward.service >/dev/null <<'EOF'
[Unit]
Description=Port forward annual-sports frontend
After=network.target minikube.service
Wants=minikube.service

[Service]
Type=simple
User=ubuntu
Environment=KUBECONFIG=/home/ubuntu/.kube/config
ExecStart=/usr/local/bin/kubectl -n annual-sports port-forward svc/annual-sports-frontend 8080:80 --address 0.0.0.0
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now annual-sports-frontend-forward
sudo systemctl status annual-sports-frontend-forward
```

If you want this to survive a VM reboot, ensure minikube starts on boot and is ready before the port-forward:

```bash
sudo tee /etc/systemd/system/minikube.service >/dev/null <<'EOF'
[Unit]
Description=Minikube
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/local/bin/minikube start --driver=docker
ExecStop=/usr/local/bin/minikube stop
User=ubuntu
Environment=KUBECONFIG=/home/ubuntu/.kube/config

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now minikube
```

Then update the port-forward unit to wait for minikube:

```bash
sudo systemctl stop annual-sports-frontend-forward
sudo systemctl enable --now annual-sports-frontend-forward
```

If `minikube service` says "no node port", patch the service:

```bash
kubectl -n annual-sports patch svc annual-sports-frontend -p '{"spec":{"type":"NodePort"}}'
minikube service -n annual-sports annual-sports-frontend --url
```

## 10) Troubleshooting

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
- The frontend expects `/api` to reach the backend (same as Docker Compose). Use Ingress or a reverse proxy to route `/api` to the backend service.
- For production, use TLS via Ingress and move secrets to a secret manager.
