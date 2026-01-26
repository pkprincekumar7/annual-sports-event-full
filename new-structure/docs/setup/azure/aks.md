# Azure AKS Deployment (Frontend + Backend)

This guide deploys the app to Azure Kubernetes Service (AKS) with best practices:
- ACR for images
- AKS for workloads
- Application Gateway Ingress Controller (AGIC) or NGINX Ingress
- Azure DNS + TLS certs (App Gateway or cert-manager)

It assumes you already have a domain and can create DNS records.

## Prerequisites
- Azure subscription with permissions for AKS, ACR, and networking
- Azure CLI installed (`az login`)
- `helm` installed (for NGINX ingress option)
- A domain you control (Azure DNS or external DNS)

## 1) Create Resource Group

```bash
az group create --name rg-annual-sports --location eastus
```

## 2) Create ACR

```bash
az acr create \
  --resource-group rg-annual-sports \
  --name annualsportsacr \
  --sku Basic
```

Get the login server:

```bash
az acr show --name annualsportsacr --query loginServer -o tsv
```

## 3) Build and Push Images

```bash
ACR_LOGIN_SERVER=<your-acr-login-server>

az acr login --name annualsportsacr

docker build -f Dockerfile.backend -t "$ACR_LOGIN_SERVER/annual-sports-backend:latest" .
docker build -f Dockerfile.frontend --build-arg VITE_API_URL=/api \
  -t "$ACR_LOGIN_SERVER/annual-sports-frontend:latest" .

docker push "$ACR_LOGIN_SERVER/annual-sports-backend:latest"
docker push "$ACR_LOGIN_SERVER/annual-sports-frontend:latest"
```

`VITE_API_URL` is a build-time value; changing it requires a rebuild.

## 4) Create AKS Cluster

```bash
az aks create \
  --resource-group rg-annual-sports \
  --name aks-annual-sports \
  --node-count 2 \
  --node-vm-size Standard_B4ms \
  --enable-managed-identity \
  --attach-acr annualsportsacr \
  --generate-ssh-keys
```

Get credentials:

```bash
az aks get-credentials --resource-group rg-annual-sports --name aks-annual-sports
```

## 5) Install Ingress Controller

Option A: NGINX Ingress (simpler):

```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx --create-namespace
```

Option B: Application Gateway Ingress Controller (best for Azure-native):
Follow the official AGIC guide and create an App Gateway in the same VNet.

## 6) Create Namespace and Secrets

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

## 7) Deploy MongoDB (Optional)

For production, use Azure Cosmos DB (Mongo API) or MongoDB Atlas.

```bash
kubectl apply -f mongodb.yaml
kubectl -n annual-sports rollout status statefulset/mongodb
```

## 8) Deploy Backend and Frontend

Update `backend.yaml` and `frontend.yaml` with ACR image URLs, then:

```bash
kubectl apply -f backend.yaml
kubectl apply -f frontend.yaml
```

## 9) Ingress + TLS

Create an `ingress.yaml` with TLS and your domain (NGINX example), replace the hosts, then apply it:

```bash
cat <<'EOF' > ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: annual-sports-ingress
  namespace: annual-sports
  annotations:
    kubernetes.io/ingress.class: nginx
spec:
  tls:
    - hosts:
        - your-domain.com
      secretName: annual-sports-tls
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

Use cert-manager or upload TLS certs to a Kubernetes secret.

## 10) DNS Setup

Create a DNS record for `your-domain.com` pointing to the ingress IP.

## 11) Verify

```bash
curl -I https://your-domain.com
curl -I https://your-domain.com/api/health
```

## Manual Setup (Portal)

Use Azure Portal to:
- Create ACR
- Create AKS (attach ACR)
- Install ingress
- Create DNS records
- Upload TLS certs or configure cert-manager

Then deploy with `kubectl`.

## Teardown

```bash
az group delete --name rg-annual-sports --yes --no-wait
```

## Best Practices Notes
- Use Cosmos DB (Mongo API) or MongoDB Atlas for production.
- Store secrets in Azure Key Vault and sync to Kubernetes.
- Use node pools for separation (system vs workloads).
- Pin image tags and enable ACR image scanning.
