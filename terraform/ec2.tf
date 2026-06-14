# ═══════════════════════════════════════════════════════════════════════════════
# EC2 instance - free tier (t3.micro, Amazon Linux 2023, Docker preinstalled)
# ═══════════════════════════════════════════════════════════════════════════════

# ── SSH key pair: generated locally, public half registered with AWS ──────────
resource "tls_private_key" "ssh" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

resource "aws_key_pair" "main" {
  key_name   = "crashlens-key"
  public_key = tls_private_key.ssh.public_key_openssh
}

# Save the private key to disk so you can SSH with it. Mode 0400 = read-only
# by owner (SSH refuses to use overly-permissive keys).
resource "local_sensitive_file" "ssh_key" {
  content         = tls_private_key.ssh.private_key_pem
  filename        = "${path.module}/crashlens-key.pem"
  file_permission = "0400"
}

# ── Look up the latest Amazon Linux 2023 AMI dynamically ──────────────────────
# Hardcoding AMI IDs breaks when AWS publishes a new one. This stays current.
data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-x86_64"]
  }
}

# ── User data: runs once on first boot to install Docker + git ────────────────
# heredoc syntax keeps the shell script readable.
locals {
  user_data = <<-EOF
    #!/bin/bash
    set -e
    dnf update -y
    dnf install -y docker git
    systemctl enable --now docker
    usermod -aG docker ec2-user

    # Docker Compose v2 as a CLI plugin
    mkdir -p /usr/local/lib/docker/cli-plugins
    curl -sSL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
      -o /usr/local/lib/docker/cli-plugins/docker-compose
    chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
  EOF
}

resource "aws_instance" "app" {
  ami           = data.aws_ami.amazon_linux.id
  instance_type = "t3.micro"          # free tier
  key_name      = aws_key_pair.main.key_name

  subnet_id                   = aws_subnet.public[0].id
  vpc_security_group_ids      = [aws_security_group.ec2.id]
  associate_public_ip_address = true

  # Lets the Docker daemon push container logs to CloudWatch.
  iam_instance_profile = aws_iam_instance_profile.ec2.name

  user_data = local.user_data

  root_block_device {
    volume_size = 30                  # GB; 30 GB EBS is free tier
    volume_type = "gp3"
  }

  # Don't replace the instance every time Amazon publishes a new AL2023 AMI.
  # `user_data` is ignored for the same reason - it only runs on first boot
  # anyway, so changing it after the fact would do nothing useful.
  lifecycle {
    ignore_changes = [ami, user_data]
  }

  tags = { Name = "crashlens-app" }
}

# ── Outputs ───────────────────────────────────────────────────────────────────
output "ec2_public_ip" {
  value       = aws_instance.app.public_ip
  description = "Public IPv4 of the EC2 instance."
}

output "ec2_public_dns" {
  value       = aws_instance.app.public_dns
  description = "Public DNS of the EC2 instance."
}

output "ssh_command" {
  value       = "ssh -i ${local_sensitive_file.ssh_key.filename} ec2-user@${aws_instance.app.public_ip}"
  description = "Copy-paste-able SSH command."
}
