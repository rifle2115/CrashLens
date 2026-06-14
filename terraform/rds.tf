# ═══════════════════════════════════════════════════════════════════════════════
# RDS Postgres - free tier (db.t3.micro, single AZ, 20 GB)
# ═══════════════════════════════════════════════════════════════════════════════

# Random password for the DB master user. Generated once, kept in tfstate.
resource "random_password" "db" {
  length  = 24
  special = false   # avoid url-unsafe chars in the connection string
}

# RDS needs a "subnet group" telling it which subnets it can live in.
# Using both public subnets, but the SG (rds-sg) keeps it private effectively.
resource "aws_db_subnet_group" "main" {
  name       = "crashlens-db-subnets"
  subnet_ids = aws_subnet.public[*].id
  tags       = { Name = "crashlens-db-subnets" }
}

resource "aws_db_instance" "main" {
  identifier        = "crashlens-db"
  engine            = "postgres"
  engine_version    = "16.6"      # supported in free tier; check AWS console for newest
  instance_class    = "db.t3.micro"
  allocated_storage = 20          # 20 GB = free tier max
  storage_type      = "gp2"
  storage_encrypted = true

  db_name  = "crashlens"
  username = "postgres"
  password = random_password.db.result

  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name

  publicly_accessible     = false  # SG rules only allow EC2 anyway
  multi_az                = false  # single AZ = free tier
  backup_retention_period = 0      # 0 days = no automated backups = free
  skip_final_snapshot     = true   # so `terraform destroy` won't get stuck

  tags = { Name = "crashlens-db" }
}

# Outputs the EC2 will need.
output "db_endpoint" {
  value       = aws_db_instance.main.address
  description = "RDS Postgres hostname (no port)."
}

output "db_password" {
  value       = random_password.db.result
  description = "Master password. Don't share."
  sensitive   = true
}
