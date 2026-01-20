# AWS EKS with Terraform (Frontend + Backend)

This is the Terraform-based path for the EKS deployment. It provisions:
- VPC + subnets
- EKS cluster + managed node group
- ECR repositories
- IAM OIDC + AWS Load Balancer Controller (Helm)
- ACM certificate (for ALB HTTPS)

You still deploy the Kubernetes manifests (`backend.yaml`, `frontend.yaml`, and an ingress manifest) with `kubectl`.

## Prerequisites
- Terraform 1.6+
- AWS CLI configured (`aws configure`)
- `kubectl` installed (for applying manifests)
- A domain you control (Route 53 or external DNS)

## 1) Terraform Layout (Example)

Create a folder (outside the app repo or inside `infra/`):

```
eks-terraform/
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
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.11"
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

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"
  cluster_name    = var.cluster_name
  cluster_version = "1.29"
  subnet_ids      = module.vpc.private_subnets
  vpc_id          = module.vpc.vpc_id

  eks_managed_node_groups = {
    default = {
      instance_types = ["t3.medium"]
      min_size       = 2
      max_size       = 4
      desired_size   = 2
    }
  }
}

resource "aws_ecr_repository" "backend" {
  name = "annual-sports-backend"
}

resource "aws_ecr_repository" "frontend" {
  name = "annual-sports-frontend"
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

data "aws_eks_cluster" "cluster" {
  name = module.eks.cluster_name
}

data "aws_eks_cluster_auth" "cluster" {
  name = module.eks.cluster_name
}

provider "helm" {
  kubernetes {
    host                   = data.aws_eks_cluster.cluster.endpoint
    cluster_ca_certificate = base64decode(data.aws_eks_cluster.cluster.certificate_authority[0].data)
    token                  = data.aws_eks_cluster_auth.cluster.token
  }
}

resource "helm_release" "alb_controller" {
  name       = "aws-load-balancer-controller"
  repository = "https://aws.github.io/eks-charts"
  chart      = "aws-load-balancer-controller"
  namespace  = "kube-system"

  set {
    name  = "clusterName"
    value = var.cluster_name
  }
  set {
    name  = "serviceAccount.create"
    value = "true"
  }
  set {
    name  = "region"
    value = var.aws_region
  }
  set {
    name  = "vpcId"
    value = module.vpc.vpc_id
  }
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

Update kubeconfig:

```bash
aws eks update-kubeconfig --name annual-sports --region <your-region>
```

## 4) Deploy App Manifests

Update `backend.yaml` and `frontend.yaml` to use ECR image URLs. Create an
`ingress.yaml` using ALB, replace the hosts and certificate ARN, then apply it:

```bash
kubectl create namespace annual-sports
kubectl apply -f backend.yaml
kubectl apply -f frontend.yaml
cat <<'EOF' > ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: annual-sports-ingress
  namespace: annual-sports
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTP":80},{"HTTPS":443}]'
    alb.ingress.kubernetes.io/certificate-arn: <acm-certificate-arn>
    alb.ingress.kubernetes.io/ssl-redirect: "443"
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
    - host: api.your-domain.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: annual-sports-backend
                port:
                  number: 3001
EOF

kubectl apply -f ingress.yaml
```

## 5) Teardown

```bash
terraform destroy
```

If you deployed Kubernetes resources manually, delete them first:

```bash
kubectl delete ingress -n annual-sports annual-sports-ingress
kubectl delete -f frontend.yaml
kubectl delete -f backend.yaml
kubectl delete namespace annual-sports
```

## Notes
- The ALB controller often requires additional IAM permissions. Use the official AWS policy for production.
- If ACM validation is not in Route 53, create the DNS validation records manually.
- `VITE_API_URL` is build-time; rebuild the frontend image when it changes.
