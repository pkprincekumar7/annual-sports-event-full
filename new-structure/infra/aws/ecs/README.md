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

```bash
cd new-structure/infra/aws/ecs
```

Verify the environment-specific backend file (for example, `hcl/backend-dev.hcl`)
before running `terraform init`.

```bash
terraform init -backend-config=hcl/backend-dev.hcl
cp tfvars/dev.tfvars.example dev.tfvars
```

Verify the environment-specific tfvars file (for example, `dev.tfvars`) after
copying from the matching example file. Update values before `terraform plan`
and `terraform apply`.

```bash
terraform plan -var-file=dev.tfvars
terraform apply -var-file=dev.tfvars
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
- Configure Mongo Atlas URIs and secrets in your environment tfvars (for example, `dev.tfvars`).
- Set `route53_zone_id` in tfvars to have Terraform create Route 53 records for `domain` and `api_domain`.
- Redis is provisioned via ElastiCache; the services use that endpoint automatically.
- `VITE_API_URL` is build-time; rebuild the frontend image when it changes.
