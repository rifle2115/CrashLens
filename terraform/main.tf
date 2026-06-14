# ═══════════════════════════════════════════════════════════════════════════════
# CrashLens — AWS infrastructure
# ═══════════════════════════════════════════════════════════════════════════════
# Workflow:  terraform init  →  terraform plan  →  terraform apply
# Tear it all down any time with:  terraform destroy
# ═══════════════════════════════════════════════════════════════════════════════

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.70"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.5"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "aws" {
  region = var.region

  default_tags {
    # Every resource we create gets tagged automatically so we can find them
    # later, audit costs, and `terraform destroy` won't surprise us.
    tags = {
      Project   = "crashlens"
      ManagedBy = "terraform"
      Env       = "dev"
    }
  }
}

# ── Read available AZs so we don't hardcode them ──────────────────────────────
# Names like "us-east-1a" can shift across accounts; reading them dynamically
# lets the same code work in any region.
data "aws_availability_zones" "available" {
  state = "available"
}

# ═══════════════════════════════════════════════════════════════════════════════
# Checkpoint A — VPC + 2 public subnets + Internet Gateway + routes
# ═══════════════════════════════════════════════════════════════════════════════

# ── VPC ───────────────────────────────────────────────────────────────────────
# 10.0.0.0/16 = a private IP range with room for ~65k addresses.
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true        # needed for RDS endpoints to resolve
  enable_dns_hostnames = true

  tags = { Name = "crashlens-vpc" }
}

# ── Internet Gateway ──────────────────────────────────────────────────────────
# The "door" between our VPC and the public internet.
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "crashlens-igw" }
}

# ── Public subnets (one per AZ for high availability) ─────────────────────────
# `count = 2` creates two of these. Each gets a different /24 slice of the VPC
# and lives in a different Availability Zone.
resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.${count.index + 1}.0/24"          # 10.0.1.0/24, 10.0.2.0/24
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true                                    # resources here get public IPs

  tags = { Name = "crashlens-public-${count.index + 1}" }
}

# ── Route table: any traffic for the internet → go via the IGW ────────────────
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"             # all destinations
    gateway_id = aws_internet_gateway.main.id
  }

  tags = { Name = "crashlens-public-rt" }
}

# ── Attach each subnet to the route table ─────────────────────────────────────
resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# ── Outputs — handy values printed after apply ────────────────────────────────
output "vpc_id" {
  value       = aws_vpc.main.id
  description = "VPC ID — referenced by later resources (RDS, ECS, ALB)."
}

output "public_subnet_ids" {
  value       = aws_subnet.public[*].id
  description = "Both public subnet IDs — ALB + ECS tasks will sit in these."
}
