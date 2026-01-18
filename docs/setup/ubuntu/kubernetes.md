# Ubuntu - Kubernetes Deployment

This guide deploys the frontend and backend as separate services on a Kubernetes cluster and uses a MongoDB StatefulSet. It assumes you already have a working Kubernetes cluster and `kubectl` configured.

## Prerequisites
- A Kubernetes cluster (minikube, k3s, EKS, GKE, AKS, etc.)
- `kubectl` installed and connected to your cluster
- Container registry access (Docker Hub, GHCR, ECR, etc.)

If you are new to Kubernetes, follow `docs/setup/ubuntu/kubernetes-prereqs.md` first.

## 1) Build and Push Images

From the repo root:

```bash
docker build -f Dockerfile.backend -t <registry>/annual-sports-backend:latest .
docker build -f Dockerfile.frontend -t <registry>/annual-sports-frontend:latest .

docker push <registry>/annual-sports-backend:latest
docker push <registry>/annual-sports-frontend:latest
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
  --from-literal=MONGODB_URI="mongodb://mongodb-0.mongodb:27017/annual-sports"
```

### Frontend Config

```bash
kubectl -n annual-sports create configmap frontend-config \
  --from-literal=VITE_API_URL="/api"
```

## 4) Deploy MongoDB (StatefulSet)

Create `mongodb.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: mongodb
  namespace: annual-sports
spec:
  ports:
    - port: 27017
      name: mongo
  clusterIP: None
  selector:
    app: mongodb
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mongodb
  namespace: annual-sports
spec:
  serviceName: mongodb
  replicas: 1
  selector:
    matchLabels:
      app: mongodb
  template:
    metadata:
      labels:
        app: mongodb
    spec:
      containers:
        - name: mongodb
          image: mongo:7
          ports:
            - containerPort: 27017
          volumeMounts:
            - name: mongo-data
              mountPath: /data/db
  volumeClaimTemplates:
    - metadata:
        name: mongo-data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 5Gi
```

Apply:

```bash
kubectl apply -f mongodb.yaml
```

## 5) Deploy Backend

Create `backend.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: annual-sports-backend
  namespace: annual-sports
spec:
  replicas: 1
  selector:
    matchLabels:
      app: annual-sports-backend
  template:
    metadata:
      labels:
        app: annual-sports-backend
    spec:
      containers:
        - name: backend
          image: <registry>/annual-sports-backend:latest
          ports:
            - containerPort: 3001
          env:
            - name: PORT
              value: "3001"
            - name: JWT_SECRET
              valueFrom:
                secretKeyRef:
                  name: backend-secrets
                  key: JWT_SECRET
            - name: MONGODB_URI
              valueFrom:
                secretKeyRef:
                  name: backend-secrets
                  key: MONGODB_URI
---
apiVersion: v1
kind: Service
metadata:
  name: annual-sports-backend
  namespace: annual-sports
spec:
  selector:
    app: annual-sports-backend
  ports:
    - port: 3001
      targetPort: 3001
```

Apply:

```bash
kubectl apply -f backend.yaml
```

## 6) Deploy Frontend

Create `frontend.yaml`:

```yaml
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
          image: <registry>/annual-sports-frontend:latest
          ports:
            - containerPort: 80
          envFrom:
            - configMapRef:
                name: frontend-config
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
    - port: 80
      targetPort: 80
```

Apply:

```bash
kubectl apply -f frontend.yaml
```

## 7) Ingress (Optional)

If you have an Ingress controller installed (NGINX, Traefik), create an Ingress to route `/` to frontend and `/api` to backend.

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: annual-sports-ingress
  namespace: annual-sports
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
```

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

If you are using minikube:

```bash
minikube service -n annual-sports annual-sports-frontend
```

## Notes
- The frontend expects `/api` to reach the backend (same as Docker Compose). Use Ingress or a reverse proxy to route `/api` to the backend service.
- For production, use TLS via Ingress and move secrets to a secret manager.
