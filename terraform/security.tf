# ═══════════════════════════════════════════════════════════════════════════════
# Security groups — virtual firewalls around our resources
# ═══════════════════════════════════════════════════════════════════════════════

# ── EC2 security group ────────────────────────────────────────────────────────
# Allows SSH so you can shell in, and the two app ports so the web works.
# Egress is wide-open (the default) so the EC2 can pull Docker images, hit
# package mirrors, talk to RDS, etc.
resource "aws_security_group" "ec2" {
  name        = "crashlens-ec2-sg"
  description = "EC2 instance - allow SSH + HTTP for app ports"
  vpc_id      = aws_vpc.main.id

  # SSH from anywhere. Lock to your IP later for production:
  #   cidr_blocks = ["YOUR.IP.HERE/32"]
  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Frontend (Next.js)"
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Backend (FastAPI)"
    from_port   = 8000
    to_port     = 8000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # All outbound traffic allowed.
  egress {
    description = "All egress"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "crashlens-ec2-sg" }
}

# ── RDS security group ────────────────────────────────────────────────────────
# Postgres port 5432 is reachable ONLY from the EC2 SG, not from the internet.
# Using `security_groups` (not `cidr_blocks`) means "any resource in ec2-sg" —
# very precise, no IP juggling required.
resource "aws_security_group" "rds" {
  name        = "crashlens-rds-sg"
  description = "RDS Postgres - only EC2 can reach it"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Postgres from EC2 only"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ec2.id]
  }

  egress {
    description = "All egress"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "crashlens-rds-sg" }
}
