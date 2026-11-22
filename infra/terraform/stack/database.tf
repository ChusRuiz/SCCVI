resource "aws_db_parameter_group" "sccvi" {
  name        = "${local.name}-postgres18"
  family      = "postgres18"
  description = "Parámetros de seguridad PostgreSQL para SCCVI."

  parameter {
    name         = "rds.force_ssl"
    value        = "1"
    apply_method = "pending-reboot"
  }

  tags = { Name = "${local.name}-postgres18" }
}

resource "aws_db_instance" "sccvi" {
  identifier                  = "${local.name}-postgres"
  engine                      = "postgres"
  engine_version              = var.db_engine_version
  instance_class              = var.db_instance_class
  db_name                     = var.db_name
  username                    = var.db_username
  manage_master_user_password = true
  port                        = 5432

  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true

  db_subnet_group_name   = aws_db_subnet_group.sccvi.name
  vpc_security_group_ids = [aws_security_group.database.id]
  parameter_group_name   = aws_db_parameter_group.sccvi.name
  publicly_accessible    = false
  multi_az               = var.db_multi_az

  backup_retention_period         = 14
  backup_window                   = "06:00-07:00"
  maintenance_window              = "Sun:08:00-Sun:09:00"
  auto_minor_version_upgrade      = true
  apply_immediately               = false
  copy_tags_to_snapshot           = true
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  deletion_protection       = true
  skip_final_snapshot       = false
  final_snapshot_identifier = "${local.name}-postgres-final"

  lifecycle {
    prevent_destroy = true
  }

  depends_on = [aws_db_parameter_group.sccvi]
  tags       = { Name = "${local.name}-postgres" }
}
