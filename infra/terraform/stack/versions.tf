terraform {
  required_version = ">= 1.10.0, < 2.0.0"

  backend "s3" {}

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "= 6.73.0"
    }
  }
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile != "" ? var.aws_profile : null

  default_tags {
    tags = {
      Project     = "SCCVI"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# CloudFront solo acepta certificados ACM emitidos en us-east-1.
provider "aws" {
  alias   = "use1"
  region  = "us-east-1"
  profile = var.aws_profile != "" ? var.aws_profile : null

  default_tags {
    tags = {
      Project     = "SCCVI"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}
