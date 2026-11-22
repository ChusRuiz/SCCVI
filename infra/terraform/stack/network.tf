resource "aws_vpc" "sccvi" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "${local.name}-vpc" }
}

resource "aws_internet_gateway" "sccvi" {
  vpc_id = aws_vpc.sccvi.id
  tags   = { Name = "${local.name}-igw" }
}

resource "aws_subnet" "public" {
  count                   = var.az_count
  vpc_id                  = aws_vpc.sccvi.id
  availability_zone       = local.azs[count.index]
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index)
  map_public_ip_on_launch = false
  tags                    = { Name = "${local.name}-public-${count.index + 1}" }
}

resource "aws_subnet" "app" {
  count                   = var.az_count
  vpc_id                  = aws_vpc.sccvi.id
  availability_zone       = local.azs[count.index]
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index + 10)
  map_public_ip_on_launch = false
  tags                    = { Name = "${local.name}-app-private-${count.index + 1}" }
}

resource "aws_subnet" "database" {
  count                   = var.az_count
  vpc_id                  = aws_vpc.sccvi.id
  availability_zone       = local.azs[count.index]
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index + 20)
  map_public_ip_on_launch = false
  tags                    = { Name = "${local.name}-database-isolated-${count.index + 1}" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.sccvi.id
  tags   = { Name = "${local.name}-public-rt" }
}

resource "aws_route" "public_internet" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.sccvi.id
}

resource "aws_route_table_association" "public" {
  count          = var.az_count
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_eip" "nat" {
  count  = var.single_nat_gateway ? 1 : var.az_count
  domain = "vpc"
  tags   = { Name = "${local.name}-nat-eip-${count.index + 1}" }
}

resource "aws_nat_gateway" "nat" {
  count         = var.single_nat_gateway ? 1 : var.az_count
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id
  depends_on    = [aws_internet_gateway.sccvi]
  tags          = { Name = "${local.name}-nat-${count.index + 1}" }
}

resource "aws_route_table" "app" {
  count  = var.az_count
  vpc_id = aws_vpc.sccvi.id
  tags   = { Name = "${local.name}-app-rt-${count.index + 1}" }
}

resource "aws_route" "app_nat" {
  count                  = var.az_count
  route_table_id         = aws_route_table.app[count.index].id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.nat[var.single_nat_gateway ? 0 : count.index].id
}

resource "aws_route_table_association" "app" {
  count          = var.az_count
  subnet_id      = aws_subnet.app[count.index].id
  route_table_id = aws_route_table.app[count.index].id
}

# Las subredes de base de datos no tienen ruta a Internet ni NAT.
resource "aws_db_subnet_group" "sccvi" {
  name        = "${local.name}-db-subnets"
  subnet_ids  = aws_subnet.database[*].id
  description = "Subredes privadas aisladas para RDS SCCVI."
  tags        = { Name = "${local.name}-db-subnets" }
}

resource "aws_security_group" "alb" {
  name        = "${local.name}-alb-sg"
  description = "Permite tráfico de origen únicamente desde CloudFront."
  vpc_id      = aws_vpc.sccvi.id

  # Un solo puerto usa la lista administrada de CloudFront para respetar la
  # cuota de reglas de Security Groups (la lista puede consumir varias reglas).
  dynamic "ingress" {
    for_each = local.custom_domains ? [] : [1]
    content {
      description     = "CloudFront hacia el listener HTTP del entorno sin dominio propio."
      from_port       = 80
      to_port         = 80
      protocol        = "tcp"
      prefix_list_ids = [data.aws_ec2_managed_prefix_list.cloudfront_origin_facing.id]
    }
  }

  dynamic "ingress" {
    for_each = local.custom_domains ? [1] : []
    content {
      description     = "CloudFront hacia el listener HTTPS con dominio propio."
      from_port       = 443
      to_port         = 443
      protocol        = "tcp"
      prefix_list_ids = [data.aws_ec2_managed_prefix_list.cloudfront_origin_facing.id]
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${local.name}-alb-sg" }
}

resource "aws_security_group" "api" {
  name        = "${local.name}-api-sg"
  description = "API Fargate sin acceso directo desde Internet; solo recibe del ALB."
  vpc_id      = aws_vpc.sccvi.id

  ingress {
    description     = "Tráfico API desde el ALB."
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${local.name}-api-sg" }
}

resource "aws_security_group" "worker" {
  name        = "${local.name}-worker-sg"
  description = "Worker Fargate sin puertos entrantes."
  vpc_id      = aws_vpc.sccvi.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${local.name}-worker-sg" }
}

resource "aws_security_group" "database" {
  name        = "${local.name}-db-sg"
  description = "PostgreSQL accesible solo desde API y worker SCCVI."
  vpc_id      = aws_vpc.sccvi.id

  ingress {
    description     = "PostgreSQL desde API."
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.api.id]
  }

  ingress {
    description     = "PostgreSQL desde worker."
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.worker.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${local.name}-db-sg" }
}
