# Azure Container Apps with Terraform (Frontend + Backend)

Terraform-based deployment for Azure Container Apps.

## Prerequisites
- Terraform 1.6+
- Azure CLI (`az login`)
- A domain you control

## 1) Terraform Layout (Example)

```
aca-terraform/
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

resource "azurerm_container_app_environment" "env" {
  name                = var.environment_name
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
}
```

`variables.tf`:

```hcl
variable "resource_group" { default = "rg-annual-sports" }
variable "location" { default = "eastus" }
variable "acr_name" {}
variable "environment_name" { default = "ca-env-annual-sports" }
```

## 3) Terraform Commands

```bash
terraform init
terraform fmt
terraform validate
terraform plan -out=tfplan
terraform apply tfplan
```

## 4) Deploy Apps

After infra is ready, create Container Apps for backend/frontend (CLI or Terraform).

## 5) Teardown

```bash
terraform destroy
```

## Notes
- Use Key Vault for secrets.
- `VITE_API_URL` is build-time; rebuild frontend on change.
