# Google Cloud Run with Terraform (Frontend + Backend)

Terraform-based Cloud Run provisioning.

## Prerequisites
- Terraform 1.6+
- `gcloud` authenticated
- A GCP project with billing enabled

## 1) Terraform Layout (Example)

```
cloud-run-terraform/
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
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}
```

`main.tf` (shortened example):

```hcl
provider "google" {
  project = var.project_id
  region  = var.region
}

resource "google_cloud_run_service" "frontend" {
  name     = "annual-sports-frontend"
  location = var.region
  template {
    spec {
      containers {
        image = var.frontend_image
      }
    }
  }
}

resource "google_cloud_run_service" "backend" {
  name     = "annual-sports-backend"
  location = var.region
  template {
    spec {
      containers {
        image = var.backend_image
        env {
          name  = "PORT"
          value = "3001"
        }
      }
    }
  }
}
```

`variables.tf`:

```hcl
variable "project_id" {}
variable "region" { default = "us-central1" }
variable "frontend_image" {}
variable "backend_image" {}
```

## 3) Terraform Commands

```bash
terraform init
terraform fmt
terraform validate
terraform plan -out=tfplan
terraform apply tfplan
```

## 4) Teardown

```bash
terraform destroy
```

## Notes
- Add domain mappings and IAM bindings for public access.
- Use Secret Manager for backend secrets.
- `VITE_API_URL` is build-time; rebuild frontend on change.
