# Azure AKS with Terraform (Frontend + Backend)

Terraform-based AKS provisioning with ACR and ingress.

## Prerequisites
- Terraform 1.6+
- Azure CLI (`az login`)
- `kubectl` installed (for applying manifests)
- `helm` installed (for NGINX ingress option)
- A domain you control

## 1) Terraform Layout (Example)

```
aks-terraform/
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
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}
```

`main.tf` (shortened example):

```hcl
provider "azurerm" {
  features {}
}

resource "azurerm_resource_group" "rg" {
  name     = var.resource_group
  location = var.location
}

resource "azurerm_container_registry" "acr" {
  name                = var.acr_name
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  sku                 = "Basic"
  admin_enabled       = false
}

resource "azurerm_kubernetes_cluster" "aks" {
  name                = var.aks_name
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  dns_prefix          = var.aks_name

  default_node_pool {
    name       = "system"
    node_count = 2
    vm_size    = "Standard_B4ms"
  }

  identity {
    type = "SystemAssigned"
  }
}
```

`variables.tf`:

```hcl
variable "resource_group" { default = "rg-annual-sports" }
variable "location" { default = "eastus" }
variable "acr_name" {}
variable "aks_name" { default = "aks-annual-sports" }
```

`terraform.tfvars` (example):

```hcl
acr_name = "annualsportsacr"
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
az aks get-credentials --resource-group rg-annual-sports --name aks-annual-sports
```

## 5) Deploy App Manifests

Update `backend.yaml` and `frontend.yaml` to use ACR image URLs. Install an ingress
controller (NGINX or AGIC) before applying the ingress, then create an
`ingress.yaml` with TLS and your domain (NGINX example), replace the hosts, then apply it:

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
    kubernetes.io/ingress.class: nginx
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
- Add ACR pull permissions for AKS (managed identity).
- Use Key Vault for secrets.
- `VITE_API_URL` is build-time; rebuild frontend on change.
