# Google Cloud GKE with Terraform (Frontend + Backend)

Terraform-based GKE provisioning with Artifact Registry.

## Prerequisites
- Terraform 1.6+
- `gcloud` authenticated
- `kubectl` installed (for applying manifests)
- A GCP project with billing enabled

## 1) Terraform Layout (Example)

```
gke-terraform/
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

resource "google_artifact_registry_repository" "repo" {
  location      = var.region
  repository_id = "annual-sports"
  format        = "DOCKER"
}

resource "google_container_cluster" "gke" {
  name     = var.cluster_name
  location = var.region
  initial_node_count = 2
}
```

`variables.tf`:

```hcl
variable "project_id" {}
variable "region" { default = "us-central1" }
variable "cluster_name" { default = "annual-sports" }
```

## 3) Terraform Commands

```bash
terraform init
terraform fmt
terraform validate
terraform plan -out=tfplan
terraform apply tfplan
```

## 4) Get Cluster Credentials

```bash
gcloud container clusters get-credentials annual-sports --region us-central1
```

## 5) Deploy App Manifests

Update `backend.yaml` and `frontend.yaml` to use Artifact Registry image URLs. Create an
`ingress.yaml`, replace the host, then apply it:

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
    kubernetes.io/ingress.class: "gce"
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
EOF

kubectl apply -f ingress.yaml
```

## 6) Teardown

```bash
terraform destroy
```

## Notes
- Use Secret Manager for backend secrets.
- `VITE_API_URL` is build-time; rebuild frontend on change.
