# Azure Container Apps (Frontend + Backend)

This guide deploys the app to Azure Container Apps (ACA):
- ACR for images
- Container Apps for workloads
- Azure-managed HTTPS with custom domain

## Prerequisites
- Azure subscription and `az login`
- A domain you control

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

```bash
az acr login --name annualsportsacr
ACR_LOGIN_SERVER=$(az acr show --name annualsportsacr --query loginServer -o tsv)
```

## 3) Build and Push Images

```bash
docker build -f Dockerfile.backend -t "$ACR_LOGIN_SERVER/annual-sports-backend:latest" .
docker build -f Dockerfile.frontend --build-arg VITE_API_URL=/api \
  -t "$ACR_LOGIN_SERVER/annual-sports-frontend:latest" .

docker push "$ACR_LOGIN_SERVER/annual-sports-backend:latest"
docker push "$ACR_LOGIN_SERVER/annual-sports-frontend:latest"
```

`VITE_API_URL` is build-time; changing it requires a rebuild.

## 4) Create Container Apps Environment

```bash
az extension add --name containerapp --upgrade
az provider register --namespace Microsoft.App
az provider register --namespace Microsoft.OperationalInsights

az containerapp env create \
  --name ca-env-annual-sports \
  --resource-group rg-annual-sports \
  --location eastus
```

## 5) Create Backend App

```bash
az containerapp create \
  --name annual-sports-backend \
  --resource-group rg-annual-sports \
  --environment ca-env-annual-sports \
  --image "$ACR_LOGIN_SERVER/annual-sports-backend:latest" \
  --target-port 3001 \
  --ingress external \
  --registry-server "$ACR_LOGIN_SERVER" \
  --env-vars PORT=3001 \
            JWT_SECRET="your-strong-secret" \
            MONGODB_URI="mongodb+srv://<user>:<pass>@<cluster>/annual-sports" \
            GMAIL_USER="your-email@gmail.com" \
            GMAIL_APP_PASSWORD="your-16-char-app-password"
```

## 6) Create Frontend App

```bash
az containerapp create \
  --name annual-sports-frontend \
  --resource-group rg-annual-sports \
  --environment ca-env-annual-sports \
  --image "$ACR_LOGIN_SERVER/annual-sports-frontend:latest" \
  --target-port 80 \
  --ingress external \
  --registry-server "$ACR_LOGIN_SERVER"
```

## 7) Custom Domain + HTTPS

Use Azure-managed certificates for the frontend app:

```bash
az containerapp hostname add \
  --name annual-sports-frontend \
  --resource-group rg-annual-sports \
  --hostname your-domain.com
```

Follow the DNS verification output, then enable certificate:

```bash
az containerapp hostname bind \
  --name annual-sports-frontend \
  --resource-group rg-annual-sports \
  --hostname your-domain.com \
  --certificate managed
```

## 8) API Routing

Use a separate domain for the backend, or configure the frontend to call the backend
Container App URL directly. For custom domains, set:

```bash
VITE_API_URL=https://api.your-domain.com
```

## 9) Verify

```bash
curl -I https://your-domain.com
```

## Manual Setup (Portal)

Use Azure Portal to:
- Create ACR
- Create Container Apps Environment
- Create backend and frontend apps
- Configure custom domain + managed cert

## Teardown

```bash
az group delete --name rg-annual-sports --yes --no-wait
```

## Best Practices Notes
- Use Azure Key Vault for secrets.
- Use internal ingress for the backend if you do not need a public API.
- Pin image tags for releases.
