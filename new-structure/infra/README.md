# Infrastructure Prerequisites (Terraform + AWS CLI)

This folder contains Infrastructure as Code for AWS. Install Terraform and the
AWS CLI, then run `aws configure` before using any stack.

## Required Versions
- Terraform 1.13+
- AWS CLI v2

## Ubuntu

Terraform:

```bash
sudo apt-get update
sudo apt-get install -y gnupg software-properties-common
wget -O- https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" \
  | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt-get update
sudo apt-get install -y terraform
terraform version
```

AWS CLI v2:

```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
sudo apt-get install -y unzip
unzip awscliv2.zip
sudo ./aws/install
aws --version
```

Configure:

```bash
aws configure
```

## macOS

Terraform (Homebrew):

```bash
brew update
brew install terraform
terraform version
```

AWS CLI v2 (Homebrew):

```bash
brew install awscli
aws --version
```

Configure:

```bash
aws configure
```

## Windows

Terraform (winget):

```powershell
winget install HashiCorp.Terraform
terraform version
```

AWS CLI v2 (winget):

```powershell
winget install Amazon.AWSCLI
aws --version
```

Configure:

```powershell
aws configure
```
