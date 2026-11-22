data "aws_caller_identity" "current" {}

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_ec2_managed_prefix_list" "cloudfront_origin_facing" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_cache_policy" "caching_disabled" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_origin_request_policy" "all_viewer_except_host_header" {
  name = "Managed-AllViewerExceptHostHeader"
}

locals {
  name = "${var.project_name}-${var.environment}"
  azs  = slice(data.aws_availability_zones.available.names, 0, var.az_count)

  domains_empty = alltrue([
    var.frontend_domain_name == "",
    var.api_domain_name == "",
    var.route53_zone_id == ""
  ])

  custom_domains = alltrue([
    var.frontend_domain_name != "",
    var.api_domain_name != "",
    var.route53_zone_id != ""
  ])

  frontend_url        = local.custom_domains ? "https://${var.frontend_domain_name}" : "https://${aws_cloudfront_distribution.frontend.domain_name}"
  api_origin_domain   = local.custom_domains ? var.api_domain_name : aws_lb.api.dns_name
  api_origin_protocol = local.custom_domains ? "https-only" : "http-only"
  backend_image       = "${aws_ecr_repository.backend.repository_url}:${var.container_image_tag}"

  app_environment = [
    { name = "NODE_ENV", value = "production" },
    { name = "PORT", value = "3000" },
    { name = "DB_HOST", value = aws_db_instance.sccvi.address },
    { name = "DB_PORT", value = "5432" },
    { name = "DB_NAME", value = var.db_name },
    { name = "DB_USER", value = var.db_app_username },
    { name = "DB_SSL", value = "true" },
    { name = "DB_SSL_REJECT_UNAUTHORIZED", value = "true" },
    { name = "DB_POOL_MAX", value = tostring(var.db_pool_max) },
    { name = "DB_IDLE_TIMEOUT_MS", value = "30000" },
    { name = "DB_CONNECTION_TIMEOUT_MS", value = "10000" },
    { name = "DB_APPLICATION_NAME", value = "sccvi" },
    { name = "JWT_EXPIRES_IN", value = "8h" },
    { name = "FRONTEND_URL", value = local.frontend_url },
    { name = "CORS_ORIGINS", value = local.frontend_url },
    { name = "SWAGGER_ENABLED", value = "false" },
    { name = "SMTP_HOST", value = var.smtp_host },
    { name = "SMTP_PORT", value = tostring(var.smtp_port) },
    { name = "SMTP_SECURE", value = "false" },
    { name = "SMTP_USER", value = var.smtp_user },
    { name = "SMTP_FROM", value = "SCCVI <${var.smtp_user}>" },
    { name = "TELEGRAM_BOT_USERNAME", value = var.telegram_bot_username }
  ]

  app_secrets = [
    { name = "DB_PASSWORD", valueFrom = aws_secretsmanager_secret.db_app_password.arn },
    { name = "JWT_SECRET", valueFrom = aws_secretsmanager_secret.jwt_secret.arn },
    { name = "SMTP_PASS", valueFrom = aws_secretsmanager_secret.smtp_password.arn },
    { name = "TELEGRAM_BOT_TOKEN", valueFrom = aws_secretsmanager_secret.telegram_token.arn }
  ]
}

resource "terraform_data" "configuration_guard" {
  input = {
    environment     = var.environment
    custom_domains  = local.custom_domains
    desired_workers = var.worker_desired_count
  }

  lifecycle {
    precondition {
      condition     = local.domains_empty || local.custom_domains
      error_message = "Configura los tres valores juntos: frontend_domain_name, api_domain_name y route53_zone_id; o deja los tres vacíos."
    }

    precondition {
      condition     = !var.require_custom_domains_for_production || !contains(["prod", "production"], lower(var.environment)) || local.custom_domains
      error_message = "Para producción se requieren dominios propios en Route 53. Esto permite HTTPS entre CloudFront y el ALB."
    }
  }
}

resource "aws_ecr_repository" "backend" {
  name                 = "${local.name}-backend"
  image_tag_mutability = "IMMUTABLE"
  force_delete         = false

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "backend" {
  repository = aws_ecr_repository.backend.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Conservar las 10 imágenes más recientes"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = { type = "expire" }
    }]
  })
}

resource "aws_secretsmanager_secret" "db_app_password" {
  name                    = "${local.name}/db-app-password"
  description             = "Contraseña del usuario de aplicación PostgreSQL SCCVI. Se cargará durante la fase de migración."
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret" "jwt_secret" {
  name                    = "${local.name}/jwt-secret"
  description             = "Secreto JWT del backend SCCVI. El valor se cargará manualmente antes de iniciar ECS."
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret" "smtp_password" {
  name                    = "${local.name}/smtp-password"
  description             = "Contraseña de aplicación SMTP de SCCVI."
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret" "telegram_token" {
  name                    = "${local.name}/telegram-bot-token"
  description             = "Token del bot Telegram de SCCVI."
  recovery_window_in_days = 7
}
