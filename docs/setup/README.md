# Deployment Guides

This folder splits deployment instructions by operating system so you can follow a focused, beginner-friendly guide.

For general product and API documentation, see `docs/guides`.
For environment variable setup, see `docs/setup/env-setup.md`.

## Ubuntu (Linux)
- `ubuntu/quick-start.md` - Local setup and running the app
- `ubuntu/docker-engine-install.md` - Install Docker Engine + Compose
- `ubuntu/docker-compose.md` - Run the full stack with Compose
- `ubuntu/systemd-frontend.md` - Frontend as a systemd service
- `ubuntu/systemd-backend.md` - Backend as a systemd service (includes MongoDB)
- `ubuntu/nginx-reverse-proxy.md` - Nginx reverse proxy for frontend/backend
- `ubuntu/nginx-https.md` - HTTPS for frontend/backend with Nginx + Certbot
- `ubuntu/kubernetes-prereqs.md` - Kubernetes prerequisites (kubectl, minikube/k3s)
- `ubuntu/kubernetes.md` - Kubernetes deployment (frontend, backend, MongoDB)
- `ubuntu/troubleshooting.md` - Common service and port issues

## Windows
- `windows/quick-start.md` - Local setup and running the app
- `windows/docker-desktop.md` - Install Docker Desktop + WSL2
- `windows/docker-compose.md` - Run the full stack with Compose
- `windows/services.md` - Run frontend/backend as Windows services (NSSM)

## macOS
- `macos/quick-start.md` - Local setup and running the app
- `macos/docker-desktop.md` - Install Docker Desktop
- `macos/docker-compose.md` - Run the full stack with Compose
- `macos/launchd-services.md` - Run frontend/backend as launchd services

## Other Deployment Options
- `other-options.md` - Static hosting, PaaS, Docker without Compose, Kubernetes

## AWS
- `aws/eks.md` - AWS EKS deployment (ECR, ALB, TLS)
- `aws/eks-terraform.md` - AWS EKS with Terraform (infra + ALB)
- `aws/ecs.md` - AWS ECS Fargate deployment (ALB, TLS)
- `aws/ecs-terraform.md` - AWS ECS Fargate with Terraform

## Azure
- `azure/aks.md` - Azure AKS deployment (ACR, ingress, TLS)
- `azure/aks-terraform.md` - Azure AKS with Terraform
- `azure/container-apps.md` - Azure Container Apps deployment
- `azure/container-apps-terraform.md` - Azure Container Apps with Terraform

## GCP
- `gcp/gke.md` - Google Kubernetes Engine (GKE) deployment
- `gcp/gke-terraform.md` - GKE with Terraform
- `gcp/cloud-run.md` - Cloud Run deployment
- `gcp/cloud-run-terraform.md` - Cloud Run with Terraform
