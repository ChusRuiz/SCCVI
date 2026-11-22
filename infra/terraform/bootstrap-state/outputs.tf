output "terraform_state_bucket" {
  description = "Nombre del bucket creado para almacenar el estado remoto."
  value       = aws_s3_bucket.terraform_state.bucket
}

output "backend_hcl_example" {
  description = "Configuración que debes copiar a stack/backend.hcl y completar."
  value       = <<-EOT
bucket       = "${aws_s3_bucket.terraform_state.bucket}"
key          = "sccvi/prod/terraform.tfstate"
region       = "${var.aws_region}"
encrypt      = true
use_lockfile = true
EOT
}
