# AWS ECS Fargate with Terraform (Frontend + Microservices)

Terraform for ECS is already scaffolded here:

`new-structure/infra/aws/ecs`

## Prerequisites
- Terraform 1.13+
- AWS CLI configured (`aws configure`)

## Usage

Before you run Terraform, create the S3 bucket and DynamoDB table manually. The
environment backend files are committed so everyone shares the same bucket/table.

Recommended bucket/table setup:
- S3 bucket: versioning enabled, default encryption enabled, public access blocked
- DynamoDB table: partition key `LockID` (string), on-demand billing

### 1) Configure Secrets Manager Names

Terraform creates the Secrets Manager resources. You only need to provide the
secret names in `tfvars`. After `terraform apply`, populate the secret values in
AWS Secrets Manager.

Required names:
- `jwt_secret_name`
- `mongo_uri_secret_name` (shared MongoDB URI; DB name comes from `DATABASE_NAME`)
- Identity-only email secret names:
  - `gmail_app_password_secret_name`
  - `sendgrid_api_key_secret_name`
  - `resend_api_key_secret_name`
  - `smtp_password_secret_name`

### 2) Initialize Terraform

```bash
cd new-structure/infra/aws/ecs
terraform init -backend-config=hcl/backend-dev.hcl
cp tfvars/dev.tfvars.example dev.tfvars
```

Update `dev.tfvars`:
- `aws_account_id`, `aws_region`
- `public_subnets`, `private_subnets`, `availability_zones`
- `domain` (and `api_domain` if needed)
- `route53_zone_id` (optional, to auto-create DNS records)
- `acm_certificate_arn` (optional, enables HTTPS listener)
- `image_tag` (must match the tag you push)
- `jwt_secret_name`, `mongo_uri_secret_name`, and identity email secret names

### 3) Create ECR Repositories (Target Apply)

Terraform manages ECR, so create repos first:

```bash
terraform apply -target=aws_ecr_repository.repos -var-file=dev.tfvars
```

### 4) Build and Push Images

Set variables:

```bash
AWS_ACCOUNT_ID=<your-account-id>
AWS_REGION=<your-region>
IMAGE_TAG=<your-image-tag>
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
  docker build -t "annual-sports-${service}:${IMAGE_TAG}" "new-structure/$service"
  docker tag "annual-sports-${service}:${IMAGE_TAG}" \
    "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/annual-sports-${service}:${IMAGE_TAG}"
  docker push "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/annual-sports-${service}:${IMAGE_TAG}"
done

docker build -t annual-sports-frontend:${IMAGE_TAG} --build-arg VITE_API_URL=/ \
  new-structure/frontend

docker tag annual-sports-frontend:${IMAGE_TAG} \
  "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/annual-sports-frontend:${IMAGE_TAG}"

docker push "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/annual-sports-frontend:${IMAGE_TAG}"
```

`VITE_API_URL` is a build-time value; changing it requires a rebuild.

### 5) Apply Full Stack

```bash
terraform apply -var-file=dev.tfvars
```

### 6) Verify

Get ALB DNS:

```bash
terraform output -raw alb_dns_name
```

Then test:

```bash
curl -I http://<alb-dns-name>
curl -I http://<alb-dns-name>/identities/docs
```

If you provided `acm_certificate_arn` and DNS, use HTTPS and your domain:

```bash
curl -I https://your-domain.com
curl -I https://your-domain.com/identities/docs
```

## Multiple Environments

Use the environment-specific backend files and tfvars templates:

Available environments:
- `dev` → `hcl/backend-dev.hcl`, `tfvars/dev.tfvars.example`
- `qa` → `hcl/backend-qa.hcl`, `tfvars/qa.tfvars.example`
- `stg` → `hcl/backend-stg.hcl`, `tfvars/stg.tfvars.example`
- `perf` → `hcl/backend-perf.hcl`, `tfvars/perf.tfvars.example`
- `prod` → `hcl/backend-prod.hcl`, `tfvars/prod.tfvars.example`

```bash
cd new-structure/infra/aws/ecs
terraform init -backend-config=hcl/backend-dev.hcl
cp tfvars/dev.tfvars.example dev.tfvars
terraform plan -var-file=dev.tfvars
terraform apply -var-file=dev.tfvars
```

Repeat with `qa`, `stg`, `perf`, or `prod` by swapping the backend/tfvars files
(for example, `hcl/backend-qa.hcl` + `tfvars/qa.tfvars.example`).

## Notes
- Configure Secrets Manager ARNs in your environment tfvars (for example, `dev.tfvars`).
- The MongoDB URI secret is shared; each service selects the DB via `DATABASE_NAME`.
- Set `route53_zone_id` in tfvars to have Terraform create Route 53 records for `domain` and `api_domain`.
- Redis is provisioned via ElastiCache; the services use that endpoint automatically.
- Cloud Map service discovery is enabled; set an environment-specific `service_discovery_namespace` in tfvars.
- `VITE_API_URL` is build-time; rebuild the frontend image when it changes.
- ECS tasks run in private subnets; only the ALB is public.
