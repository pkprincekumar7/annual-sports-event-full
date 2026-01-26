# AWS ECS (Fargate) Deployment (Frontend + Microservices)

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

## 1) Terraform (Recommended)

Terraform for ECS lives in:

`new-structure/infra/aws/ecs`

Quick start:

```bash
cd new-structure/infra/aws/ecs
terraform init -backend-config=hcl/backend-dev.hcl
cp tfvars/dev.tfvars.example dev.tfvars
terraform plan -var-file=dev.tfvars
terraform apply -var-file=dev.tfvars
```

Then continue with image build/push and verification below.

## 2) Create ECR Repositories

```bash
aws ecr create-repository --repository-name annual-sports-identity-service
aws ecr create-repository --repository-name annual-sports-enrollment-service
aws ecr create-repository --repository-name annual-sports-department-service
aws ecr create-repository --repository-name annual-sports-sports-participation-service
aws ecr create-repository --repository-name annual-sports-event-configuration-service
aws ecr create-repository --repository-name annual-sports-scheduling-service
aws ecr create-repository --repository-name annual-sports-scoring-service
aws ecr create-repository --repository-name annual-sports-reporting-service
aws ecr create-repository --repository-name annual-sports-frontend
```

Get your account ID and region:

```bash
aws sts get-caller-identity --query Account --output text
aws configure get region
```

## 3) Build and Push Images

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
    "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/annual-sports-${service}:latest"
  docker push "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/annual-sports-${service}:latest"
done

docker build -t annual-sports-frontend:latest --build-arg VITE_API_URL=/ \
  new-structure/frontend

docker tag annual-sports-frontend:latest \
  "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/annual-sports-frontend:latest"

docker push "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/annual-sports-frontend:latest"
```

`VITE_API_URL` is a build-time value; changing it requires a rebuild.

## 4) Create a VPC (Console or Existing)

Use an existing VPC or create a new one with:
- 2+ public subnets (ALB)
- 2+ private subnets (Fargate tasks)
- NAT gateway for private subnets

## 5) Request ACM Certificate

Request a certificate in the same region as the ALB:
- `your-domain.com`
- `api.your-domain.com` (optional)

Validate via DNS.

## 6) Create an ECS Cluster

```bash
aws ecs create-cluster --cluster-name annual-sports
```

## 7) Create Task Definitions

Create a task definition per microservice plus one for the frontend. Use Fargate:
- CPU/memory (e.g., 512/1024)
- Container images from ECR
- Port mappings:
  - services: `8001`–`8008`
  - frontend: `80`
- Environment variables per service from the corresponding `.env.example`

Best practice: store secrets in AWS Secrets Manager and reference them in the task definition.

## 8) Create an Application Load Balancer

Create an ALB with two target groups:
- `annual-sports-frontend` target group (port 80)
- one target group per service (ports 8001–8008)

Create listeners:
- HTTPS 443 (use ACM cert) → forward `/` to frontend target group
- HTTPS 443 rules for `/identities`, `/enrollments`, `/departments`, `/sports-participations`,
  `/event-configurations`, `/schedulings`, `/scorings`, `/reportings`

## 9) Create ECS Services

Create services in the cluster (Fargate, private subnets):
- `annual-sports-frontend` → attach to frontend target group
- one service per microservice → attach to its target group

Set desired count to 1+ and enable autoscaling as needed.

## 10) DNS Setup

Create DNS records pointing to the ALB:
- `your-domain.com` → ALB
- `api.your-domain.com` → ALB (optional)

If using a single domain, only the root domain is required.

## 11) Verify

```bash
curl -I https://your-domain.com
curl -I https://your-domain.com/identities/docs
```

## Manual Setup (Console)

If you prefer the AWS Console:
- ECR: create repositories for each service plus frontend.
- ECS: create cluster, task definitions, and services (Fargate).
- ALB: create HTTPS listener + rules, target groups per service.
- ACM: request/validate certificates.
- Route 53: create A/ALIAS records pointing to ALB.

## Teardown

```bash
aws ecs delete-service --cluster annual-sports --service annual-sports-frontend --force
aws ecs delete-service --cluster annual-sports --service annual-sports-identity-service --force
aws ecs delete-cluster --cluster annual-sports
```

Repeat for the remaining services, then delete the ALB, target groups, listeners, and security groups from the console or CLI.

Delete ECR repositories:

```bash
aws ecr delete-repository --repository-name annual-sports-identity-service --force
aws ecr delete-repository --repository-name annual-sports-frontend --force
```

Repeat for the remaining service repositories, then clean up ACM certificates and Route 53 records manually.

## Best Practices Notes
- Use MongoDB Atlas instead of self-hosting for production.
- Store secrets in AWS Secrets Manager and reference them in task defs.
- Use private subnets for tasks and restrict SGs to ALB only.
- Pin image tags (avoid `latest`) and enable ECR image scanning.
