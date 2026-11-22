# SCCVI — Fase 5: preparación de migración PostgreSQL a Amazon RDS

## Estado de esta fase

Esta entrega prepara la inspección y exportación segura de la base PostgreSQL local. **No se conecta a AWS, no crea una instancia RDS, no restaura datos y no modifica la base de origen.** El respaldo contiene información potencialmente sensible de niñas, niños, familiares y personal; debe permanecer protegido localmente.

## Lo que comprobamos en el repositorio

La rama SCCVI contiene algunos scripts SQL de migración (roles, notificaciones y vinculación Telegram) y un script de datos de demostración, pero no contiene un único archivo de esquema base que reconstruya toda la base de datos operativa. Por eso, para esta migración, el origen de verdad será un `pg_dump` de la base real que utiliza tu aplicación, no una reconstrucción a partir de scripts parciales.

**No ejecutes `backend/src/scripts/01_insertar_datos_demo.sql` en RDS de producción.** Es un archivo de datos ficticios para pruebas. Tampoco vuelvas a ejecutar automáticamente las migraciones SQL de roles, notificaciones o Telegram después de restaurar: el respaldo completo ya incluye los objetos que existen en la base de origen.

## Versiones y nombre de la base

- La configuración Terraform actual define `db_engine_version = "18.6"`, `db_instance_class = "db.m9g.large"` y `db_name = "sccvi"` como valores predeterminados.
- AWS publica PostgreSQL 18.6 para Amazon RDS, y la matriz oficial de clases incluye `db.m9g.large` para PostgreSQL 18.1 y versiones posteriores. Por tanto, la combinación configurada es compatible según esa matriz; aun así, verifica la disponibilidad exacta en tu región/cuenta antes de aplicar. `terraform validate` no comprueba disponibilidad regional ni cuotas.
- La base local puede tener otro nombre (por ejemplo, el valor de `DB_NAME` de tu `backend/.env`). El formato custom de `pg_dump` permite restaurar esa base en otra base destino: por defecto, origen local `DB_NAME` y destino RDS `sccvi`.
- En el task de ECS, `DB_NAME` se toma de `var.db_name`, por lo que el valor final debe coincidir con la base restaurada.

Consulta solo las variables no secretas del archivo local, sin mostrar la contraseña:

```powershell
Select-String -Path .\backend\.env -Pattern '^(DB_HOST|DB_PORT|DB_NAME|DB_USER)='
```

No compartas el contenido completo de `.env` ni pegues `DB_PASSWORD` en el chat.

Para consultar la disponibilidad regional exacta antes de un futuro `terraform plan`, AWS CLI puede consultar las opciones ordenables sin crear recursos:

```powershell
aws rds describe-orderable-db-instance-options --engine postgres --engine-version 18.6 --db-instance-class db.m9g.large --region us-east-1 --query "OrderableDBInstanceOptions[*].[EngineVersion,DBInstanceClass,AvailabilityZones[0].Name]" --output table
```

La clase `db.m9g.large` tiene 2 vCPU y 8 GiB de memoria según la tabla de hardware de RDS; es una clase inicial, no una recomendación definitiva de capacidad. La elección final debe revisarse con tamaño real, carga esperada y costo regional.

## Herramientas requeridas en Windows

Instala los PostgreSQL client tools de versión 18 o superior y verifica que `pg_dump`, `pg_restore` y `psql` estén en PATH:

```powershell
pg_dump --version
pg_restore --version
psql --version
```

Se requiere un cliente `pg_dump` que no sea de una versión mayor inferior a la del servidor. PostgreSQL documenta que `pg_dump` no puede exportar desde un servidor de versión mayor que su propio cliente. El script de esta fase exige cliente 18 o posterior.

## Paso 1 — inspeccionar el origen

Lee el host, puerto, nombre de base y usuario de `backend/.env`, sin compartir la contraseña. Ejecuta el exportador desde la carpeta `infra\migration\rds` del proyecto:

```powershell
.\EXPORTAR_FUENTE.ps1 `
  -SourceHost "localhost" `
  -SourcePort 5432 `
  -SourceDatabase "NOMBRE_REAL_DE_DB_NAME" `
  -SourceUser "USUARIO_REAL_DE_DB_USER"
```

Ajusta host, puerto, base y usuario a los valores de tu `.env`. Para la exportación, usa preferentemente el propietario de la base o un usuario administrativo local con lectura de todos los esquemas, tablas, secuencias y extensiones; el rol limitado que usa la aplicación podría no tener permisos de lectura para todo. El script solicitará la contraseña con entrada oculta; la usa temporalmente en memoria para las herramientas PostgreSQL y la elimina del entorno del proceso al terminar. No guarda la contraseña en el respaldo ni en el manifiesto.

El proceso crea una carpeta fuera del repositorio, por defecto en `%USERPROFILE%\SCCVI-backups\SCCVI-AAAAMMDD-HHMMSS`, con:

- `source_preflight.txt`: versión PostgreSQL, tamaño, codificación, collation, extensiones, esquemas, objetos, secuencias, FKs no validadas e índices inválidos.
- `source_exact_table_counts.csv`: conteo exacto de filas por tabla. Puede tardar si hay tablas grandes.
- `sccvi_source.dump`: respaldo lógico completo en formato custom.
- `sccvi_schema.sql`: solo estructura, para revisión técnica.
- `restore_toc.txt`: índice interno del archivo de respaldo.
- `sccvi_source.dump.sha256` y `manifest.json`: integridad y metadatos del respaldo, sin contraseñas.

El formato custom (`-Fc`) se restaura mediante `pg_restore`. Se exporta sin propietario ni ACL para que no dependa de los roles locales; después se concederán permisos explícitos al usuario de aplicación de RDS.

## Paso 2 — proteger y verificar el respaldo

El archivo `sccvi_source.dump` contiene datos clínicos y personales. No lo guardes dentro del repositorio, OneDrive sincronizado, un directorio público, ni lo subas a GitHub o al chat. Utiliza una unidad protegida con BitLocker o un medio cifrado aprobado, limita quién puede acceder y conserva una copia protegida independiente.

Verifica el respaldo:

```powershell
.\VALIDAR_BACKUP.ps1 -BackupDirectory "$env:USERPROFILE\SCCVI-backups\CARPETA_GENERADA"
```

La validación comprueba tamaño, índice legible con `pg_restore --list` y SHA-256. **Esto no demuestra por sí solo que una restauración completa funcione**; eso se prueba restaurando una copia en un destino de ensayo vacío cuando exista RDS de prueba.

## Paso 3 — revisar el preflight

Antes de restaurar, revisa `source_preflight.txt` y `source_exact_table_counts.csv`:

1. Confirma que la versión de origen sea PostgreSQL 18.x. Si es otra versión mayor, detén el proceso y revisa compatibilidad antes de continuar.
2. Revisa extensiones instaladas y versiones: deben estar disponibles en RDS PostgreSQL 18.6. No asumas que cualquier extensión local puede instalarse en RDS.
3. Revisa esquemas. El script de permisos posterior cubre el esquema `public`, que es el usado por los scripts SQL actuales de SCCVI. Si el preflight muestra otros esquemas de aplicación, agrega sus GRANT antes de conectar la aplicación.
4. Revisa restricciones no validadas e índices inválidos. Resuelve cualquier anomalía antes de la migración.
5. Guarda los conteos exactos por tabla como referencia para la comparación posterior.

## Paso 4 — restauración de ensayo en RDS (posterior a la creación aprobada)

Este paso **no debe ejecutarse todavía** porque aún no se ha creado RDS. Cuando exista una instancia RDS de ensayo o un destino expresamente aprobado:

1. Comprueba endpoint, puerto 5432, base destino (por defecto `sccvi`) y conexión TLS.
2. Confirma que la base destino está vacía y que la instancia está en la versión objetivo.
3. Comprueba extensiones admitidas. Si alguna extensión del preflight no existe en RDS 18.6, no fuerces la restauración; revisa una alternativa compatible.
4. La base que RDS crea inicialmente ya contiene el esquema `public`. En una base destino recién creada y vacía, elimina y recrea solo ese esquema antes de restaurar para que el archivo pueda recrear los objetos del esquema:

```sql
-- Ejecutar solo en la base destino NUEVA, vacía, antes de restaurar.
DROP SCHEMA public CASCADE;
CREATE SCHEMA public AUTHORIZATION sccvi_master;
```

Si cambiaste `db_username` en Terraform, reemplaza `sccvi_master` por ese usuario maestro. No ejecutes este bloque sobre la base local ni sobre una base RDS que ya tenga datos.

5. Restaura con el usuario maestro, sin `--clean` ni `--create`:

```powershell
pg_restore `
  --host="ENDPOINT_RDS" `
  --port=5432 `
  --username="sccvi_master" `
  --dbname="sccvi" `
  --no-owner `
  --no-acl `
  --exit-on-error `
  --verbose `
  "$env:USERPROFILE\SCCVI-backups\CARPETA_GENERADA\sccvi_source.dump"
```

La herramienta solicitará la contraseña del usuario maestro. No la incluyas en el comando, archivos ni capturas. Si la restauración falla a mitad del proceso, no la vuelvas a ejecutar encima de esa base parcialmente restaurada: limpia/recrea un destino aislado y repite la prueba desde cero. Para una base grande, el tiempo y los parámetros de restauración se ajustarán después de la primera prueba.

6. Ejecuta `sql\02_validar_destino.sql` y `sql\03_exact_table_counts.sql` contra la base destino. Compara el CSV exacto por nombre de tabla con `source_exact_table_counts.csv`. Cualquier diferencia debe investigarse; no des por terminada la migración solo porque `pg_restore` haya acabado sin error.
7. Ejecuta pruebas funcionales: login, pacientes, padres, comunidades, crecimiento OMS, vacunas, alertas, notificaciones, campañas, reportes y carnet QR. Verifica conteos y secuencias para que los nuevos registros no reutilicen IDs existentes.

## Paso 5 — usuario de aplicación de privilegios mínimos

Terraform define por defecto:

- usuario maestro RDS: `sccvi_master` (contraseña administrada por RDS/Secrets Manager);
- usuario de aplicación: `sccvi_app` (secreto separado `sccvi/db-app-password`).

El backend debe conectarse como `sccvi_app`, nunca con la cuenta maestra. Después de restaurar como maestro, ejecuta desde `infra\migration\rds`:

```powershell
psql -X --host="ENDPOINT_RDS" --port=5432 --username="sccvi_master" --dbname="sccvi" --file=".\sql\01_preparar_usuario_aplicacion.psql"
```

El script crea/verifica `sccvi_app` sin privilegios de superusuario, concede operaciones DML y permisos de secuencias en `public` y configura privilegios por defecto para objetos nuevos creados por `sccvi_master`. Después conecta de forma interactiva como maestro y establece la contraseña sin escribirla en un archivo:

```sql
\password sccvi_app
```

La contraseña generada se guardará manualmente en el secreto `sccvi/db-app-password` de Secrets Manager. No se escribe en Terraform, `.env`, SQL, Git o chat.

## Paso 6 — corte a producción (no ejecutar todavía)

La estrategia inicial es una migración lógica con ventana de mantenimiento. `pg_dump` produce una copia consistente, pero los cambios que ocurran en el origen después de iniciar el dump no se reflejan en ese archivo. Por eso, el corte final requiere:

1. Anunciar mantenimiento y detener escrituras en el sistema local.
2. Confirmar que las tareas API/worker del destino siguen apagadas durante la carga inicial.
3. Generar un dump final después de detener escrituras.
4. Restaurar y validar conteos, relaciones, secuencias y pruebas funcionales.
5. Configurar `DB_HOST`, `DB_NAME`, `DB_USER=sccvi_app`, `DB_PASSWORD` desde Secrets Manager y `DB_SSL=true` en ECS.
6. Probar API y worker controladamente; habilitar una única tarea worker para evitar dos pollers Telegram.
7. Cambiar frontend/API a producción, verificar carnet QR, correo y Telegram, y mantener el origen intacto como punto de retorno durante la ventana acordada.

No borres ni reutilices la base local después del corte hasta aceptar formalmente la migración y comprobar los respaldos RDS.

## Decisiones y límites

- Para una migración homogénea (PostgreSQL a PostgreSQL) de una base completa, AWS recomienda considerar primero las herramientas nativas de PostgreSQL. AWS DMS puede ser apropiado si el tamaño o la necesidad de replicación/casi cero downtime lo justifican; esa decisión depende del volumen y la ventana de mantenimiento.
- `pg_dump` exporta una base individual y no transfiere roles globales del clúster. No usamos `pg_dumpall` para RDS.
- La base de ejemplo y la base productiva se deben separar. Nunca importar el SQL `01_insertar_datos_demo.sql` en producción.
- Terraform `validate` no crea infraestructura ni consulta los precios, disponibilidad de clases, cuota de servicio ni permisos reales de AWS.
- No ejecutar `terraform apply`, crear RDS ni restaurar datos como parte de esta entrega.

## Referencias técnicas

- AWS — Importing data into PostgreSQL on Amazon RDS: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/PostgreSQL.Procedural.Importing.html
- AWS — RDS for PostgreSQL versions: https://docs.aws.amazon.com/AmazonRDS/latest/PostgreSQLReleaseNotes/postgresql-versions.html
- PostgreSQL 18 — pg_dump: https://www.postgresql.org/docs/18/app-pgdump.html
- PostgreSQL 18 — pg_restore: https://www.postgresql.org/docs/18/app-pgrestore.html
