variable "project_name" {
  description = "Prefijo de recursos de SCCVI."
  type        = string
  default     = "sccvi"
}

variable "environment" {
  description = "Nombre del entorno; usa prod para el entorno real."
  type        = string
  default     = "prod"
}

variable "aws_region" {
  description = "Región principal para VPC, ECS, RDS, ALB y ECR."
  type        = string
  default     = "us-east-1"
}

variable "aws_profile" {
  description = "Perfil AWS CLI. Vacío utiliza las credenciales configuradas en el entorno."
  type        = string
  default     = ""
}

variable "vpc_cidr" {
  description = "Bloque CIDR privado para la VPC de SCCVI."
  type        = string
  default     = "10.40.0.0/16"
}

variable "az_count" {
  description = "Cantidad de zonas de disponibilidad para subredes y servicios."
  type        = number
  default     = 2
  validation {
    condition     = var.az_count >= 2 && var.az_count <= 3
    error_message = "az_count debe ser 2 o 3 para la arquitectura de alta disponibilidad."
  }
}

variable "single_nat_gateway" {
  description = "Usa un único NAT Gateway para reducir costos; en producción crítica se recomienda false (uno por AZ)."
  type        = bool
  default     = false
}

variable "frontend_domain_name" {
  description = "Dominio público del frontend, por ejemplo app.midominio.com. Requiere una zona pública Route 53."
  type        = string
  default     = ""
}

variable "api_domain_name" {
  description = "Dominio de origen del API, por ejemplo api.midominio.com. Debe pertenecer a la misma zona Route 53."
  type        = string
  default     = ""
}

variable "route53_zone_id" {
  description = "ID de una zona pública existente de Route 53 que administra ambos dominios."
  type        = string
  default     = ""
}

variable "require_custom_domains_for_production" {
  description = "Impide planificar prod sin dominios propios y HTTPS entre CloudFront y ALB."
  type        = bool
  default     = true
}

variable "db_name" {
  description = "Nombre inicial de la base PostgreSQL."
  type        = string
  default     = "sccvi"
}

variable "db_username" {
  description = "Usuario maestro inicial de RDS; su contraseña será administrada por Secrets Manager."
  type        = string
  default     = "sccvi_master"
}

variable "db_app_username" {
  description = "Usuario de aplicación con permisos mínimos; se creará durante la fase de migración SQL."
  type        = string
  default     = "sccvi_app"
}

variable "db_engine_version" {
  description = "Versión de PostgreSQL disponible en RDS. Se mantiene en la misma versión mayor que el entorno actual."
  type        = string
  default     = "18.6"
}

variable "db_instance_class" {
  description = "Clase compatible con PostgreSQL 18. La clase m9g se elige por compatibilidad; revisa el costo regional antes del apply."
  type        = string
  default     = "db.m9g.large"
}

variable "db_allocated_storage" {
  description = "Almacenamiento inicial RDS en GiB."
  type        = number
  default     = 30
  validation {
    condition     = var.db_allocated_storage >= 20
    error_message = "RDS PostgreSQL requiere al menos 20 GiB en esta configuración."
  }
}

variable "db_max_allocated_storage" {
  description = "Límite de autoscaling de almacenamiento RDS en GiB."
  type        = number
  default     = 100
}

variable "db_multi_az" {
  description = "Habilita RDS Multi-AZ para alta disponibilidad. Aumenta el costo."
  type        = bool
  default     = true
}

variable "api_desired_count" {
  description = "Tareas API activas. Se deja en cero durante la preparación hasta publicar imagen, cargar secretos y migrar la BD."
  type        = number
  default     = 0
  validation {
    condition     = var.api_desired_count >= 0 && var.api_desired_count <= 6
    error_message = "api_desired_count debe estar entre 0 y 6."
  }
}

variable "worker_desired_count" {
  description = "Tareas worker. Telegram long polling requiere exactamente una instancia activa; 0 mantiene el worker detenido."
  type        = number
  default     = 0
  validation {
    condition     = var.worker_desired_count == 0 || var.worker_desired_count == 1
    error_message = "worker_desired_count solo puede ser 0 o 1 para evitar múltiples pollers de Telegram."
  }
}

variable "container_image_tag" {
  description = "Etiqueta inmutable de la imagen backend/worker en ECR."
  type        = string
  default     = "bootstrap"
  validation {
    condition     = can(regex("^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$", var.container_image_tag))
    error_message = "container_image_tag contiene caracteres no permitidos."
  }
}

variable "smtp_host" {
  description = "Servidor SMTP usado por SCCVI."
  type        = string
  default     = "smtp.gmail.com"
}

variable "smtp_port" {
  description = "Puerto SMTP."
  type        = number
  default     = 587
}

variable "smtp_user" {
  description = "Cuenta de correo SMTP; no es la contraseña."
  type        = string
  default     = ""
}

variable "telegram_bot_username" {
  description = "Nombre público del bot Telegram sin @."
  type        = string
  default     = "SCCVIhBot"
}

variable "db_pool_max" {
  description = "Conexiones máximas por proceso Node hacia RDS."
  type        = number
  default     = 5
  validation {
    condition     = var.db_pool_max >= 1 && var.db_pool_max <= 20
    error_message = "db_pool_max debe estar entre 1 y 20."
  }
}
