variable "aws_region" {
  description = "Región AWS donde se alojará el bucket del estado Terraform."
  type        = string
  default     = "us-east-1"
}

variable "aws_profile" {
  description = "Perfil de AWS CLI. Déjalo vacío si usas AWS_PROFILE o credenciales SSO por defecto."
  type        = string
  default     = ""
}

variable "bucket_prefix" {
  description = "Prefijo globalmente único para el bucket del estado."
  type        = string
  default     = "sccvi-tfstate"

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]{2,35}[a-z0-9]$", var.bucket_prefix))
    error_message = "bucket_prefix debe contener 4-37 caracteres en minúsculas, números o guiones y empezar/terminar con letra o número."
  }
}
