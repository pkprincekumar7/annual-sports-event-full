# AWS EKS Deployment (Frontend + Backend)

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

## 2) Create ECR Repositories

```bash
aws ecr create-repository --repository-name annual-sports-backend
aws ecr create-repository --repository-name annual-sports-frontend
```

Get your account ID and region:

```bash
aws sts get-caller-identity --query Account --output text
aws configure get region
```

## 3) Build and Push Images

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
docker build -f Dockerfile.backend -t annual-sports-backend:latest .
docker build -f Dockerfile.frontend --build-arg VITE_API_URL=/api -t annual-sports-frontend:latest .

docker tag annual-sports-backend:latest \
  "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/annual-sports-backend:latest"
docker tag annual-sports-frontend:latest \
  "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/annual-sports-frontend:latest"

docker push "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/annual-sports-backend:latest"
docker push "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/annual-sports-frontend:latest"
```

`VITE_API_URL` is a build-time value; changing it requires a rebuild.

## 4) Create an EKS Cluster

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

## 5) Install AWS Load Balancer Controller

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

## 6) Create Namespace and Secrets

```bash
kubectl create namespace annual-sports
```

Create backend secrets:

```bash
kubectl -n annual-sports create secret generic backend-secrets \
  --from-literal=JWT_SECRET="your-strong-secret" \
  --from-literal=MONGODB_URI="mongodb://mongodb-0.mongodb:27017/annual-sports" \
  --from-literal=GMAIL_USER="your-email@gmail.com" \
  --from-literal=GMAIL_APP_PASSWORD="your-16-char-app-password"
```

Create frontend config:

```bash
kubectl -n annual-sports create configmap frontend-config \
  --from-literal=VITE_API_URL="/api"
```

## 7) Deploy MongoDB (Optional)

If you want MongoDB inside the cluster, use `mongodb.yaml`.
For production, use a managed database (MongoDB Atlas) and update `MONGODB_URI`.

```bash
kubectl apply -f mongodb.yaml
kubectl -n annual-sports rollout status statefulset/mongodb
```

## 8) Deploy Backend and Frontend

Update `backend.yaml` and `frontend.yaml` to use your ECR image URLs, then apply:

```bash
kubectl apply -f backend.yaml
kubectl apply -f frontend.yaml
```

Wait for rollouts:

```bash
kubectl -n annual-sports rollout status deploy/annual-sports-backend
kubectl -n annual-sports rollout status deploy/annual-sports-frontend
```

## 9) Create an Ingress (ALB)

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

Get the ALB hostname:

```bash
kubectl -n annual-sports get ingress
```

Create DNS records pointing your domains to the ALB hostname.

## 10) Update Frontend API URL

If you are using a separate API domain:
- Set `VITE_API_URL=https://api.your-domain.com` and rebuild the frontend image.

If you are using `/api` on the same domain:
- Set `VITE_API_URL=https://your-domain.com` and rebuild.

Push the new image and update the deployment.

## 11) Verify

```bash
curl -I https://your-domain.com
curl -I https://your-domain.com/api/health
```

## Manual Setup (Console)

If you prefer the AWS Console:
- ECR: create two repositories (`annual-sports-backend`, `annual-sports-frontend`).
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
kubectl delete -f backend.yaml
kubectl delete -f mongodb.yaml
kubectl delete namespace annual-sports
```

Remove the load balancer controller:

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
aws ecr delete-repository --repository-name annual-sports-backend --force
aws ecr delete-repository --repository-name annual-sports-frontend --force
```

Clean up ACM certificates and Route 53 records manually.

## Best Practices Notes
- Use MongoDB Atlas instead of in-cluster MongoDB for production.
- Store secrets in AWS Secrets Manager and sync them to Kubernetes (external-secrets).
- Use separate namespaces per environment (dev/staging/prod).
- Pin image tags (avoid `latest`) and enable image scanning in ECR.
- Enable cluster autoscaling and set resource limits/requests.

## Terraform Option

If you want Infrastructure as Code, use `docs/setup/aws/eks-terraform.md`.
