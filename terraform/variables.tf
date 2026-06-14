# Input variables — values you might want to change without editing main.tf.
# Override at the CLI with `-var="region=us-west-2"` or in a terraform.tfvars file.

variable "region" {
  description = "AWS region all resources are created in."
  type        = string
  default     = "us-east-1"   # cheapest + biggest free-tier coverage
}

variable "notification_email" {
  description = "Email that receives CloudWatch alarm notifications."
  type        = string
  default     = "belvis2115@gmail.com"
}
