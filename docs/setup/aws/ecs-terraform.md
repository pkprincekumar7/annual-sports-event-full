# AWS ECS Fargate with Terraform (Frontend + Backend)

This is the Terraform-based path for ECS Fargate. It provisions:
- VPC + subnets
- ECS cluster + services
- ECR repositories
- ALB + target groups + HTTPS listeners
- ACM certificate (TLS)

## Prerequisites
- Terraform 1.6+
- AWS CLI configured (`aws configure`)
- A domain you control (Route 53 or external DNS)

## 1) Terraform Layout (Example)

```
ecs-terraform/
  main.tf
  variables.tf
  outputs.tf
  versions.tf
  terraform.tfvars
```

## 2) Terraform Configuration (Example)

`versions.tf`:

```hcl
terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}
```

`main.tf` (shortened example):

```hcl
provider "aws" {
  region = var.aws_region
}

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"
  name    = var.cluster_name
  cidr    = "10.0.0.0/16"
  azs     = ["${var.aws_region}a", "${var.aws_region}b"]
  public_subnets  = ["10.0.1.0/24", "10.0.2.0/24"]
  private_subnets = ["10.0.11.0/24", "10.0.12.0/24"]
  enable_nat_gateway = true
  single_nat_gateway = true
}

resource "aws_ecr_repository" "backend" {
  name = "annual-sports-backend"
}

resource "aws_ecr_repository" "frontend" {
  name = "annual-sports-frontend"
}

resource "aws_ecs_cluster" "main" {
  name = var.cluster_name
}

resource "aws_acm_certificate" "app" {
  domain_name               = var.frontend_domain
  subject_alternative_names = [var.backend_domain]
  validation_method         = "DNS"
}

resource "aws_route53_record" "acm_validation" {
  for_each = {
    for dvo in aws_acm_certificate.app.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }
  zone_id = var.route53_zone_id
  name    = each.value.name
  type    = each.value.type
  records = [each.value.record]
  ttl     = 60
}

resource "aws_acm_certificate_validation" "app" {
  certificate_arn         = aws_acm_certificate.app.arn
  validation_record_fqdns = [for r in aws_route53_record.acm_validation : r.fqdn]
}

resource "aws_security_group" "alb" {
  name   = "${var.cluster_name}-alb"
  vpc_id = module.vpc.vpc_id
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_lb" "app" {
  name               = "${var.cluster_name}-alb"
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = module.vpc.public_subnets
}
```

`variables.tf` (minimum):

```hcl
variable "aws_region" {}
variable "cluster_name" { default = "annual-sports" }
variable "frontend_domain" {}
variable "backend_domain" {}
variable "route53_zone_id" {}
```

`terraform.tfvars` (example):

```hcl
aws_region      = "us-east-1"
frontend_domain = "your-domain.com"
backend_domain  = "api.your-domain.com"
route53_zone_id = "Z1234567890"
```

## 3) Terraform Commands

```bash
terraform init
terraform fmt
terraform validate
terraform plan -out=tfplan
terraform apply tfplan
```

## 4) Deploy ECS Services

After infra is up, create task definitions and services (backend and frontend) in ECS.
Attach them to ALB target groups and use HTTPS listeners.

## 5) Teardown

```bash
terraform destroy
```

If you created ECS services manually, delete them first.

## Notes
- Add IAM task execution roles and task roles for ECS (not shown here).
- Use Secrets Manager for backend secrets.
- `VITE_API_URL` is build-time; rebuild the frontend image when it changes.
