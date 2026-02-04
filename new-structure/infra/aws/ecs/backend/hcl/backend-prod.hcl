bucket         = "your-terraform-state-bucket"
key            = "annual-sports/prod/ecs/terraform.tfstate"
region         = "us-east-1"
dynamodb_table = "terraform-locks"
encrypt        = true
