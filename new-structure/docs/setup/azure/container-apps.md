# Azure Container Apps (Frontend + Microservices)

This guide deploys the app to Azure Container Apps (ACA):
- ACR for images
- Container Apps for workloads
- Azure-managed HTTPS with custom domain
- Internal-only microservices with a public API gateway

## Prerequisites
- Azure subscription and `az login`
- Docker installed
- Python 3.12+ and Node.js 24+ for local builds
- A domain you control

## 1) Terraform (Recommended)

Terraform for ACA lives in:

`new-structure/infra/azure/aca`

Quick start:

```bash
cd new-structure/infra/azure/aca
terraform init -backend-config=hcl/backend-dev.hcl
cp tfvars/dev.tfvars.example dev.tfvars
terraform plan -var-file=dev.tfvars
terraform apply -var-file=dev.tfvars
```

Then continue with image build/push and verification below.

## 2) Create Resource Group + ACR

```bash
az group create --name rg-annual-sports --location eastus
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
for service in \
  identity-service \
  enrollment-service \
  department-service \
  sports-participation-service \
  event-configuration-service \
  scheduling-service \
  scoring-service \
  reporting-service; do
  docker build -t "annual-sports-${service}:latest" "new-structure/$service"
  docker tag "annual-sports-${service}:latest" \
    "$ACR_LOGIN_SERVER/annual-sports-${service}:latest"
  docker push "$ACR_LOGIN_SERVER/annual-sports-${service}:latest"
done

docker build -t annual-sports-frontend:latest \
  --build-arg VITE_API_URL=/ \
  new-structure/frontend
docker tag annual-sports-frontend:latest \
  "$ACR_LOGIN_SERVER/annual-sports-frontend:latest"
docker push "$ACR_LOGIN_SERVER/annual-sports-frontend:latest"
```

`VITE_API_URL` is a build-time value; changing it requires a rebuild.

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

Get the environment default domain (used for internal FQDNs):

```bash
az containerapp env show \
  --name ca-env-annual-sports \
  --resource-group rg-annual-sports \
  --query "properties.defaultDomain" -o tsv
```

## 5) Create Internal Microservices

Example for Identity (repeat per service; use `--ingress internal`):

```bash
az containerapp create \
  --name identity-service \
  --resource-group rg-annual-sports \
  --environment ca-env-annual-sports \
  --image "$ACR_LOGIN_SERVER/annual-sports-identity-service:latest" \
  --target-port 8001 \
  --ingress internal \
  --registry-server "$ACR_LOGIN_SERVER" \
  --env-vars PORT=8001 \
            JWT_SECRET="your-strong-secret" \
            MONGODB_URI="mongodb+srv://<user>:<pass>@<cluster>/annual-sports-identity" \
            DATABASE_NAME="annual-sports-identity" \
            REDIS_URL="redis://<redis-host>:6379/0" \
            GMAIL_USER="your-email@gmail.com" \
            GMAIL_APP_PASSWORD="your-16-char-app-password" \
            EMAIL_FROM="no-reply@your-domain.com"
```

Repeat for the remaining services on ports `8002`–`8008`.

## 6) Create API Gateway (Public)

Use an NGINX container app to route to the internal services. Create an `nginx.conf`
that points to internal FQDNs (replace `<env-domain>` with the ACA environment domain):

```nginx
events {}
http {
  server {
    listen 80;
    location /identities { proxy_pass http://identity-service.<env-domain>; }
    location /enrollments { proxy_pass http://enrollment-service.<env-domain>; }
    location /departments { proxy_pass http://department-service.<env-domain>; }
    location /sports-participations { proxy_pass http://sports-participation-service.<env-domain>; }
    location /event-configurations { proxy_pass http://event-configuration-service.<env-domain>; }
    location /schedulings { proxy_pass http://scheduling-service.<env-domain>; }
    location /scorings { proxy_pass http://scoring-service.<env-domain>; }
    location /reportings { proxy_pass http://reporting-service.<env-domain>; }
  }
}
```

Build an NGINX image that includes the config (for example, copy it to
`/etc/nginx/nginx.conf`), push it to ACR, then create the gateway app:

```bash
az containerapp create \
  --name annual-sports-gateway \
  --resource-group rg-annual-sports \
  --environment ca-env-annual-sports \
  --image "$ACR_LOGIN_SERVER/annual-sports-gateway:latest" \
  --target-port 80 \
  --ingress external \
  --registry-server "$ACR_LOGIN_SERVER"
```

## 7) Create Frontend (Public)

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

## 8) Custom Domain + HTTPS

Map domains to the frontend and gateway:

```bash
az containerapp hostname add \
  --name annual-sports-frontend \
  --resource-group rg-annual-sports \
  --hostname your-domain.com

az containerapp hostname add \
  --name annual-sports-gateway \
  --resource-group rg-annual-sports \
  --hostname api.your-domain.com
```

Follow the DNS verification output, then enable certificates:

```bash
az containerapp hostname bind \
  --name annual-sports-frontend \
  --resource-group rg-annual-sports \
  --hostname your-domain.com \
  --certificate managed

az containerapp hostname bind \
  --name annual-sports-gateway \
  --resource-group rg-annual-sports \
  --hostname api.your-domain.com \
  --certificate managed
```

## 9) Verify

```bash
curl -I https://your-domain.com
curl -I https://api.your-domain.com/identities/docs
```

## Manual Setup (Portal)

Use Azure Portal to:
- Create ACR
- Create Container Apps Environment
- Create internal microservices and public gateway
- Configure custom domains + managed certs

## Teardown

```bash
az group delete --name rg-annual-sports --yes --no-wait
```

## Best Practices Notes
- Use Azure Cache for Redis and MongoDB Atlas for production.
- Keep microservices internal-only; expose only the gateway and frontend.
- Pin image tags for releases.

## Terraform Option

If you want Infrastructure as Code, use `infra/azure/aca/README.md`.
