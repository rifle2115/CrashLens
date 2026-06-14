# ═══════════════════════════════════════════════════════════════════════════════
# Phase 5 - CloudWatch monitoring: log groups + IAM + alarms + dashboard
# ═══════════════════════════════════════════════════════════════════════════════

# ── Log groups (where container logs land) ────────────────────────────────────
# 7-day retention keeps us inside the 5 GB free tier and saves money long-term.
resource "aws_cloudwatch_log_group" "backend" {
  name              = "/crashlens/backend"
  retention_in_days = 7
}

resource "aws_cloudwatch_log_group" "frontend" {
  name              = "/crashlens/frontend"
  retention_in_days = 7
}

resource "aws_cloudwatch_log_group" "migrate" {
  name              = "/crashlens/migrate"
  retention_in_days = 7
}

# ── IAM: let the EC2 push logs to CloudWatch ──────────────────────────────────
# "Trust policy" defines WHO can assume this role (in this case, EC2 service).
data "aws_iam_policy_document" "ec2_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ec2" {
  name               = "crashlens-ec2-role"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume.json
}

# AWS-managed policy — least-effort way to grant CloudWatch Logs write perms.
resource "aws_iam_role_policy_attachment" "logs" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

# Instance profile is the wrapper that attaches an IAM role to an EC2 instance.
resource "aws_iam_instance_profile" "ec2" {
  name = "crashlens-ec2-profile"
  role = aws_iam_role.ec2.name
}

# ── SNS topic + email subscription (so alarms can email you) ──────────────────
resource "aws_sns_topic" "alarms" {
  name = "crashlens-alarms"
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = var.notification_email
}

# ── Metric alarms ─────────────────────────────────────────────────────────────
# EC2 CPU stuck > 80% for 10 minutes -> probably a hung container or runaway loop.
resource "aws_cloudwatch_metric_alarm" "ec2_cpu_high" {
  alarm_name          = "crashlens-ec2-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = 300              # 5 min
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "EC2 CPU > 80% for 10 minutes."
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]
  dimensions          = { InstanceId = aws_instance.app.id }
}

# RDS CPU high - similar idea, but for DB.
resource "aws_cloudwatch_metric_alarm" "rds_cpu_high" {
  alarm_name          = "crashlens-rds-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "RDS CPU > 80% for 10 minutes."
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]
  dimensions          = { DBInstanceIdentifier = aws_db_instance.main.id }
}

# RDS free storage < 2 GB -> approaching the 20 GB cap. Migrate / clean up.
resource "aws_cloudwatch_metric_alarm" "rds_storage_low" {
  alarm_name          = "crashlens-rds-storage-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 2 * 1024 * 1024 * 1024   # bytes - 2 GB
  alarm_description   = "RDS free storage < 2 GB."
  alarm_actions       = [aws_sns_topic.alarms.arn]
  dimensions          = { DBInstanceIdentifier = aws_db_instance.main.id }
}

# EC2 status check failed -> instance probably crashed / unhealthy.
resource "aws_cloudwatch_metric_alarm" "ec2_status_check" {
  alarm_name          = "crashlens-ec2-status-check"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "StatusCheckFailed"
  namespace           = "AWS/EC2"
  period              = 60
  statistic           = "Maximum"
  threshold           = 0
  alarm_description   = "EC2 status check failing - instance is unhealthy."
  alarm_actions       = [aws_sns_topic.alarms.arn]
  dimensions          = { InstanceId = aws_instance.app.id }
}

# ── Dashboard ─────────────────────────────────────────────────────────────────
# One page in CloudWatch showing the most useful metrics at a glance.
resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "crashlens"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0, y = 0, width = 12, height = 6
        properties = {
          title   = "EC2 CPU (%)"
          region  = var.region
          metrics = [["AWS/EC2", "CPUUtilization", "InstanceId", aws_instance.app.id]]
          period  = 60
          stat    = "Average"
        }
      },
      {
        type   = "metric"
        x      = 12, y = 0, width = 12, height = 6
        properties = {
          title   = "EC2 Network Out (bytes)"
          region  = var.region
          metrics = [["AWS/EC2", "NetworkOut", "InstanceId", aws_instance.app.id]]
          period  = 60
          stat    = "Sum"
        }
      },
      {
        type   = "metric"
        x      = 0, y = 6, width = 12, height = 6
        properties = {
          title   = "RDS CPU (%)"
          region  = var.region
          metrics = [["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", aws_db_instance.main.id]]
          period  = 60
          stat    = "Average"
        }
      },
      {
        type   = "metric"
        x      = 12, y = 6, width = 12, height = 6
        properties = {
          title   = "RDS Free Storage (GB)"
          region  = var.region
          metrics = [["AWS/RDS", "FreeStorageSpace", "DBInstanceIdentifier", aws_db_instance.main.id, { stat = "Average" }]]
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 0, y = 12, width = 24, height = 6
        properties = {
          title   = "RDS connections"
          region  = var.region
          metrics = [["AWS/RDS", "DatabaseConnections", "DBInstanceIdentifier", aws_db_instance.main.id]]
          period  = 60
          stat    = "Average"
        }
      }
    ]
  })
}

# ── Output: pre-baked URL to your dashboard ───────────────────────────────────
output "dashboard_url" {
  value       = "https://${var.region}.console.aws.amazon.com/cloudwatch/home?region=${var.region}#dashboards:name=${aws_cloudwatch_dashboard.main.dashboard_name}"
  description = "Open this in your browser to see live metrics."
}
