output "frontend_url" {
  description = "URL pública del frontend SCCVI."
  value       = local.frontend_url
}

output "cloudfront_domain_name" {
  description = "Dominio AWS de CloudFront."
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "frontend_bucket_name" {
  description = "Bucket privado para publicar frontend/dist."
  value       = aws_s3_bucket.frontend.bucket
}

output "cloudfront_distribution_id" {
  description = "ID para invalidar la caché de CloudFront después de publicar."
  value       = aws_cloudfront_distribution.frontend.id
}

output "api_load_balancer_dns" {
  description = "DNS del ALB. El Security Group permite tráfico solo desde CloudFront."
  value       = aws_lb.api.dns_name
}

output "backend_ecr_repository_url" {
  description = "Repositorio ECR para la imagen Docker usada por API y worker."
  value       = aws_ecr_repository.backend.repository_url
}

output "ecs_cluster_name" {
  description = "Nombre del clúster ECS."
  value       = aws_ecs_cluster.sccvi.name
}

output "rds_endpoint" {
  description = "Endpoint privado de PostgreSQL RDS; no es accesible desde Internet."
  value       = aws_db_instance.sccvi.address
}

output "rds_managed_secret_arn" {
  description = "ARN del secreto administrado automáticamente por RDS. No contiene la contraseña en Terraform."
  value       = aws_db_instance.sccvi.master_user_secret[0].secret_arn
}

output "db_app_password_secret_arn" {
  description = "Secret ARN para cargar la contraseña del usuario sccvi_app después de crear el rol de BD en la fase de migración."
  value       = aws_secretsmanager_secret.db_app_password.arn
}

output "jwt_secret_arn" {
  description = "Secret ARN para cargar JWT_SECRET desde AWS Secrets Manager."
  value       = aws_secretsmanager_secret.jwt_secret.arn
}

output "smtp_password_secret_arn" {
  description = "Secret ARN para cargar SMTP_PASS desde AWS Secrets Manager."
  value       = aws_secretsmanager_secret.smtp_password.arn
}

output "telegram_token_secret_arn" {
  description = "Secret ARN para cargar TELEGRAM_BOT_TOKEN desde AWS Secrets Manager."
  value       = aws_secretsmanager_secret.telegram_token.arn
}
