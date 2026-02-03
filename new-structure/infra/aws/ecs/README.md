# AWS ECS Fargate with Terraform (Frontend + Microservices)

Terraform for ECS is already scaffolded here:

`new-structure/infra/aws/ecs`

## Prerequisites
- Terraform 1.13+
- AWS CLI configured (`aws configure`)

## Usage

Before you run Terraform, create the S3 bucket and DynamoDB table manually. The
environment backend files are committed so everyone shares the same bucket/table.
Update the `hcl/backend-*.hcl` files with your actual bucket and table names
before `terraform init`.

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
- `cluster_name`
- `name_prefix` (short prefix like `as-dev` for shared AWS resource names)
- `service_discovery_namespace` (private DNS, example: `as-dev.local`)
- `public_subnets`, `private_subnets`, `availability_zones`
- `domain` (and `api_domain` if needed)
- `route53_zone_id` (optional, to auto-create DNS records)
- `acm_certificate_arn` (optional, enables HTTPS listener)
- `image_tag` (must match the tag you push)
- `database_names` (map; one DB per service)
- `jwt_secret_name`, `mongo_uri_secret_name`, and identity email secret names
- Optional app config: `jwt_expires_in`, `admin_reg_number`, `app_env`, `log_level`
- Optional email config: `email_provider`, `gmail_user`, `sendgrid_user`,
  `smtp_host`, `smtp_user`, `smtp_port`, `smtp_secure`, `email_from`, `email_from_name`
- Optional branding: `app_name`

Example `database_names` map:

```hcl
database_names = {
  "identity-service"             = "as-dev-identity"
  "enrollment-service"           = "as-dev-enrollment"
  "department-service"           = "as-dev-department"
  "sports-participation-service" = "as-dev-sports-part"
  "event-configuration-service"  = "as-dev-event-config"
  "scheduling-service"           = "as-dev-scheduling"
  "scoring-service"              = "as-dev-scoring"
  "reporting-service"            = "as-dev-reporting"
}
```

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
NAME_PREFIX=as-dev
```

Print values (if you used the AWS CLI defaults):

```bash
echo "$AWS_ACCOUNT_ID"
echo "$AWS_REGION"
echo "$IMAGE_TAG"

# Or populate and print:
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=$(aws configure get region)
IMAGE_TAG=<your-image-tag>
echo "$AWS_ACCOUNT_ID"
echo "$AWS_REGION"
echo "$IMAGE_TAG"
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
  docker build -t "${NAME_PREFIX}-${service}:${IMAGE_TAG}" "new-structure/$service"
  docker tag "${NAME_PREFIX}-${service}:${IMAGE_TAG}" \
    "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/${NAME_PREFIX}-${service}:${IMAGE_TAG}"
  docker push "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/${NAME_PREFIX}-${service}:${IMAGE_TAG}"
done

docker build -t ${NAME_PREFIX}-frontend:${IMAGE_TAG} --build-arg VITE_API_URL=/ \
  new-structure/frontend

docker tag ${NAME_PREFIX}-frontend:${IMAGE_TAG} \
  "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/${NAME_PREFIX}-frontend:${IMAGE_TAG}"

docker push "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/${NAME_PREFIX}-frontend:${IMAGE_TAG}"
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

Other useful outputs:

```bash
terraform output
```

See `outputs.tf` for available values (for example: `redis_endpoint`, `redis_url`,
`service_discovery_namespace`, `ecr_repository_urls`).

### 7) Connect to a Fargate Task (ECS Exec) + Run Curl

ECS Exec is already enabled in Terraform. If you just applied, wait for tasks
to restart (or force a new deployment) before connecting.

Set variables:

```bash
CLUSTER_NAME=<your-cluster-name>
SERVICE_NAME=<your-service-name>  # example: ${NAME_PREFIX}-identity-service
CONTAINER_NAME=<your-container-name> # example: identity-service
```

Get a running task ARN and open a shell:

```bash
TASK_ARN=$(aws ecs list-tasks --cluster "$CLUSTER_NAME" --service-name "$SERVICE_NAME" --query 'taskArns[0]' --output text)
aws ecs execute-command --cluster "$CLUSTER_NAME" --task "$TASK_ARN" --container "$CONTAINER_NAME" --interactive --command "/bin/sh"
```

Run curl from inside the container:

```bash
curl -I http://event-configuration-service.${SERVICE_NAMESPACE}:8005/health
```

If `curl` is not installed, install it based on your image base:

```bash
# Debian/Ubuntu-based images
apt-get update && apt-get install -y curl

# Alpine-based images
apk add --no-cache curl
```

## Updating Images

After pushing a new image to ECR, redeploy ECS services so tasks pull the new image.

If you use a **new tag** (recommended):
- Update `image_tag` in `dev.tfvars`
- Apply:

```bash
terraform apply -var-file=dev.tfvars
```

If you reuse the **same tag** (for example, `latest`), you may still need to
force a new deployment to refresh tasks:

```bash
CLUSTER_NAME=<your-cluster-name>
NAME_PREFIX=<your-name-prefix>
for svc in \
  ${NAME_PREFIX}-frontend \
  ${NAME_PREFIX}-identity-service \
  ${NAME_PREFIX}-enrollment-service \
  ${NAME_PREFIX}-department-service \
  ${NAME_PREFIX}-sports-participation-service \
  ${NAME_PREFIX}-event-configuration-service \
  ${NAME_PREFIX}-scheduling-service \
  ${NAME_PREFIX}-scoring-service \
  ${NAME_PREFIX}-reporting-service; do
  aws ecs update-service --cluster "$CLUSTER_NAME" --service "$svc" --force-new-deployment
done
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
- Configure Secrets Manager secret names in your environment tfvars (for example, `dev.tfvars`).
- The MongoDB URI secret is shared; each service selects the DB via `DATABASE_NAME`.
- Set `route53_zone_id` in tfvars to have Terraform create Route 53 records for `domain` and `api_domain`.
- Redis is provisioned via ElastiCache; the services use that endpoint automatically.
- Cloud Map service discovery is enabled; set an environment-specific `service_discovery_namespace` in tfvars.
- `VITE_API_URL` is build-time; rebuild the frontend image when it changes.
- ECS tasks run in private subnets; only the ALB is public.
