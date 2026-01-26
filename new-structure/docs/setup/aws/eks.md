# AWS EKS Deployment (Frontend + Microservices)

This guide deploys the app to AWS EKS with best-practice components:
- ECR for images
- EKS for workloads
- AWS Load Balancer Controller (ALB) for ingress
- ACM for TLS certificates

It assumes you already have a domain and can create DNS records.

## Prerequisites
- AWS account with permissions for EKS, ECR, IAM, and ACM
- `aws`, `kubectl`, `eksctl`, and `helm` installed
- A domain you control in Route 53 or another DNS provider

## 1) Configure AWS CLI

```bash
aws configure
```

## 2) Terraform (Recommended)

Terraform for EKS lives in:

`new-structure/infra/aws/eks`

Quick start:

```bash
cd new-structure/infra/aws/eks
terraform init -backend-config=hcl/backend-dev.hcl
cp tfvars/dev.tfvars.example dev.tfvars
terraform plan -var-file=dev.tfvars
terraform apply -var-file=dev.tfvars
```

Then continue with image build/push and verification below.

## 3) Create ECR Repositories

```bash
aws ecr create-repository --repository-name annual-sports-identity-service
aws ecr create-repository --repository-name annual-sports-enrollment-service
aws ecr create-repository --repository-name annual-sports-department-service
aws ecr create-repository --repository-name annual-sports-sports-participation-service
aws ecr create-repository --repository-name annual-sports-event-configuration-service
aws ecr create-repository --repository-name annual-sports-scheduling-service
aws ecr create-repository --repository-name annual-sports-scoring-service
aws ecr create-repository --repository-name annual-sports-reporting-service
aws ecr create-repository --repository-name annual-sports-frontend
```

Get your account ID and region:

```bash
aws sts get-caller-identity --query Account --output text
aws configure get region
```

## 4) Build and Push Images

Set variables:

```bash
AWS_ACCOUNT_ID=<your-account-id>
AWS_REGION=<your-region>
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
  docker build -t "annual-sports-${service}:latest" "new-structure/$service"
  docker tag "annual-sports-${service}:latest" \
    "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/annual-sports-${service}:latest"
  docker push "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/annual-sports-${service}:latest"
done

docker build -t annual-sports-frontend:latest \
  --build-arg VITE_API_URL=/ \
  new-structure/frontend
docker tag annual-sports-frontend:latest \
  "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/annual-sports-frontend:latest"

docker push "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/annual-sports-frontend:latest"
```

`VITE_API_URL` is a build-time value; changing it requires a rebuild.

## 5) Create an EKS Cluster

Create a cluster with managed nodes:

```bash
eksctl create cluster \
  --name annual-sports \
  --region "$AWS_REGION" \
  --nodegroup-name standard \
  --node-type t3.medium \
  --nodes 2 \
  --nodes-min 2 \
  --nodes-max 4 \
  --managed
```

Verify access:

```bash
kubectl get nodes
```

## 6) Install AWS Load Balancer Controller

Associate IAM OIDC provider:

```bash
eksctl utils associate-iam-oidc-provider \
  --region "$AWS_REGION" \
  --cluster annual-sports \
  --approve
```

Create the IAM policy for the controller:

```bash
curl -o iam_policy.json https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/main/docs/install/iam_policy.json
POLICY_ARN=$(aws iam create-policy \
  --policy-name AWSLoadBalancerControllerIAMPolicy \
  --policy-document file://iam_policy.json \
  --query 'Policy.Arn' --output text)
```

Install the controller (recommended via Helm):

```bash
helm repo add eks https://aws.github.io/eks-charts
helm repo update

VPC_ID=$(aws eks describe-cluster \
  --name annual-sports \
  --region "$AWS_REGION" \
  --query "cluster.resourcesVpcConfig.vpcId" \
  --output text)

eksctl create iamserviceaccount \
  --cluster annual-sports \
  --namespace kube-system \
  --name aws-load-balancer-controller \
  --attach-policy-arn "$POLICY_ARN" \
  --approve

helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=annual-sports \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller \
  --set region="$AWS_REGION" \
  --set vpcId="$VPC_ID"
```

## 7) Create Namespace and Secrets

```bash
kubectl create namespace annual-sports
```

Create one secret per service (or a shared secret if you prefer). Example for Identity:

```bash
kubectl -n annual-sports create secret generic identity-secrets \
  --from-literal=JWT_SECRET="your-strong-secret" \
  --from-literal=MONGODB_URI="mongodb://mongodb-0.mongodb:27017/annual-sports-identity" \
  --from-literal=DATABASE_NAME="annual-sports-identity" \
  --from-literal=REDIS_URL="redis://redis:6379/0" \
  --from-literal=GMAIL_USER="your-email@gmail.com" \
  --from-literal=GMAIL_APP_PASSWORD="your-16-char-app-password" \
  --from-literal=EMAIL_FROM="no-reply@your-domain.com"
```

Create frontend config:

```bash
kubectl -n annual-sports create configmap frontend-config \
  --from-literal=VITE_API_URL="/"
```

## 8) Deploy MongoDB and Redis (Optional)

If you want MongoDB inside the cluster, use `mongodb.yaml`.
For production, use a managed database (MongoDB Atlas) and update `MONGODB_URI`.
Deploy Redis via Helm or a simple Deployment/Service if you do not use a managed Redis.

```bash
kubectl apply -f mongodb.yaml
kubectl -n annual-sports rollout status statefulset/mongodb
```

## 9) Deploy Services and Frontend

Create one Deployment/Service per microservice (example in `docs/setup/ubuntu/kubernetes.md`),
then apply `frontend.yaml` with the frontend image. Verify rollouts:

```bash
kubectl -n annual-sports rollout status deploy/identity-service
kubectl -n annual-sports rollout status deploy/annual-sports-frontend
```

## 10) Create an Ingress (ALB)

Request certificates in ACM (same region as the cluster):
- `your-domain.com`
- `api.your-domain.com` (optional, if using a separate API subdomain)

Create an `ingress.yaml` using ALB, replace the hosts and certificate ARN, then apply it:

```bash
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
          - path: /identities
            pathType: Prefix
            backend:
              service:
                name: identity-service
                port:
                  number: 8001
          - path: /enrollments
            pathType: Prefix
            backend:
              service:
                name: enrollment-service
                port:
                  number: 8002
          - path: /departments
            pathType: Prefix
            backend:
              service:
                name: department-service
                port:
                  number: 8003
          - path: /sports-participations
            pathType: Prefix
            backend:
              service:
                name: sports-participation-service
                port:
                  number: 8004
          - path: /event-configurations
            pathType: Prefix
            backend:
              service:
                name: event-configuration-service
                port:
                  number: 8005
          - path: /schedulings
            pathType: Prefix
            backend:
              service:
                name: scheduling-service
                port:
                  number: 8006
          - path: /scorings
            pathType: Prefix
            backend:
              service:
                name: scoring-service
                port:
                  number: 8007
          - path: /reportings
            pathType: Prefix
            backend:
              service:
                name: reporting-service
                port:
                  number: 8008
    - host: api.your-domain.com
      http:
        paths:
          - path: /identities
            pathType: Prefix
            backend:
              service:
                name: identity-service
                port:
                  number: 8001
          - path: /enrollments
            pathType: Prefix
            backend:
              service:
                name: enrollment-service
                port:
                  number: 8002
          - path: /departments
            pathType: Prefix
            backend:
              service:
                name: department-service
                port:
                  number: 8003
          - path: /sports-participations
            pathType: Prefix
            backend:
              service:
                name: sports-participation-service
                port:
                  number: 8004
          - path: /event-configurations
            pathType: Prefix
            backend:
              service:
                name: event-configuration-service
                port:
                  number: 8005
          - path: /schedulings
            pathType: Prefix
            backend:
              service:
                name: scheduling-service
                port:
                  number: 8006
          - path: /scorings
            pathType: Prefix
            backend:
              service:
                name: scoring-service
                port:
                  number: 8007
          - path: /reportings
            pathType: Prefix
            backend:
              service:
                name: reporting-service
                port:
                  number: 8008
EOF

kubectl apply -f ingress.yaml
```

Get the ALB hostname:

```bash
kubectl -n annual-sports get ingress
```

Create DNS records pointing your domains to the ALB hostname.

## 11) Update Frontend API URL

If you are using a separate API domain:
- Set `VITE_API_URL=https://api.your-domain.com` and rebuild the frontend image.

If you are using a single domain:
- Set `VITE_API_URL=https://your-domain.com` and rebuild.

Push the new image and update the deployment.

## 12) Verify

```bash
curl -I https://your-domain.com
curl -I https://your-domain.com/identities/docs
```

## Manual Setup (Console)

If you prefer the AWS Console:
- ECR: create repositories for each service plus `annual-sports-frontend`.
- EKS: create a cluster with managed node group (2+ nodes), then update kubeconfig.
- IAM OIDC: enable the OIDC provider for the cluster.
- Load Balancer Controller: create the IAM role + service account (IRSA), then install the Helm chart.
- ACM: request certificates for your domains and validate via DNS.
- Route 53: create A/ALIAS records pointing to the ALB hostname.

You will still apply Kubernetes manifests with `kubectl`.

## Teardown

Remove Kubernetes resources:

```bash
kubectl delete ingress -n annual-sports annual-sports-ingress
kubectl delete -f frontend.yaml
kubectl delete -f identity-service.yaml
kubectl delete -f mongodb.yaml
kubectl delete namespace annual-sports
```

Repeat for the remaining service manifests, then remove the load balancer controller:

```bash
helm uninstall aws-load-balancer-controller -n kube-system
eksctl delete iamserviceaccount \
  --cluster annual-sports \
  --namespace kube-system \
  --name aws-load-balancer-controller
```

Delete the EKS cluster:

```bash
eksctl delete cluster --name annual-sports --region "$AWS_REGION"
```

Delete ECR repositories:

```bash
aws ecr delete-repository --repository-name annual-sports-identity-service --force
aws ecr delete-repository --repository-name annual-sports-frontend --force
```

Repeat for the remaining service repositories, then clean up ACM certificates and Route 53 records manually.

## Best Practices Notes
- Use MongoDB Atlas instead of in-cluster MongoDB for production.
- Store secrets in AWS Secrets Manager and sync them to Kubernetes (external-secrets).
- Use separate namespaces per environment (dev/staging/prod).
- Pin image tags (avoid `latest`) and enable image scanning in ECR.
- Enable cluster autoscaling and set resource limits/requests.

## Terraform Option

If you want Infrastructure as Code, use `infra/aws/eks/README.md`.
