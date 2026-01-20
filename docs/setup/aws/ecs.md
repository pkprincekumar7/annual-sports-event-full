# AWS ECS (Fargate) Deployment (Frontend + Backend)

This guide deploys the app to AWS ECS Fargate with best-practice components:
- ECR for images
- ECS Fargate for workloads
- ALB for HTTPS ingress
- ACM for TLS certificates

It assumes you already have a domain and can create DNS records.

## Prerequisites
- AWS account with permissions for ECS, ECR, IAM, ACM, and ALB
- AWS CLI installed (`aws configure`)
- A domain you control (Route 53 or external DNS)

## 1) Create ECR Repositories

```bash
aws ecr create-repository --repository-name annual-sports-backend
aws ecr create-repository --repository-name annual-sports-frontend
```

Get your account ID and region:

```bash
aws sts get-caller-identity --query Account --output text
aws configure get region
```

## 2) Build and Push Images

Set variables:

```bash
AWS_ACCOUNT_ID=<your-account-id>
AWS_REGION=<your-region>
```

Login to ECR:

```bash
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin \
  "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
```

Build and push:

```bash
docker build -f Dockerfile.backend -t annual-sports-backend:latest .
docker build -f Dockerfile.frontend --build-arg VITE_API_URL=/api -t annual-sports-frontend:latest .

docker tag annual-sports-backend:latest \
  "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/annual-sports-backend:latest"
docker tag annual-sports-frontend:latest \
  "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/annual-sports-frontend:latest"

docker push "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/annual-sports-backend:latest"
docker push "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/annual-sports-frontend:latest"
```

`VITE_API_URL` is a build-time value; changing it requires a rebuild.

## 3) Create a VPC (Console or Existing)

Use an existing VPC or create a new one with:
- 2+ public subnets (ALB)
- 2+ private subnets (Fargate tasks)
- NAT gateway for private subnets

## 4) Request ACM Certificate

Request a certificate in the same region as the ALB:
- `your-domain.com`
- `api.your-domain.com` (optional)

Validate via DNS.

## 5) Create an ECS Cluster

```bash
aws ecs create-cluster --cluster-name annual-sports
```

## 6) Create Task Definitions

Create two task definitions (one for backend, one for frontend). Use Fargate:
- CPU/memory (e.g., 512/1024)
- Container images from ECR
- Port mappings:
  - backend: 3001
  - frontend: 80
- Environment variables for backend:
  - `PORT=3001`
  - `MONGODB_URI`, `JWT_SECRET`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`

Best practice: store secrets in AWS Secrets Manager and reference them in the task definition.

## 7) Create an Application Load Balancer

Create an ALB with two target groups:
- `annual-sports-frontend` target group (port 80)
- `annual-sports-backend` target group (port 3001)

Create listeners:
- HTTPS 443 (use ACM cert) → forward `/` to frontend target group
- HTTPS 443 rule `/api/*` → backend target group

## 8) Create ECS Services

Create two services in the cluster (Fargate, private subnets):
- `annual-sports-frontend` → attach to frontend target group
- `annual-sports-backend` → attach to backend target group

Set desired count to 1+ and enable autoscaling as needed.

## 9) DNS Setup

Create DNS records pointing to the ALB:
- `your-domain.com` → ALB
- `api.your-domain.com` → ALB (optional)

If using a single domain with `/api`, only the root domain is required.

## 10) Verify

```bash
curl -I https://your-domain.com
curl -I https://your-domain.com/api/health
```

## Manual Setup (Console)

If you prefer the AWS Console:
- ECR: create two repositories.
- ECS: create cluster, task definitions, and services (Fargate).
- ALB: create HTTPS listener + rules, target groups.
- ACM: request/validate certificates.
- Route 53: create A/ALIAS records pointing to ALB.

## Teardown

```bash
aws ecs delete-service --cluster annual-sports --service annual-sports-frontend --force
aws ecs delete-service --cluster annual-sports --service annual-sports-backend --force
aws ecs delete-cluster --cluster annual-sports
```

Delete ALB, target groups, listeners, and security groups from the console or CLI.

Delete ECR repositories:

```bash
aws ecr delete-repository --repository-name annual-sports-backend --force
aws ecr delete-repository --repository-name annual-sports-frontend --force
```

Clean up ACM certificates and Route 53 records manually.

## Best Practices Notes
- Use MongoDB Atlas instead of self-hosting for production.
- Store secrets in AWS Secrets Manager and reference them in task defs.
- Use private subnets for tasks and restrict SGs to ALB only.
- Pin image tags (avoid `latest`) and enable ECR image scanning.
