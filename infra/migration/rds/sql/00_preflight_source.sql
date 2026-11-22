\set ON_ERROR_STOP on
\pset pager off
\pset footer off
\echo '=== SCCVI | PREFLIGHT DE BASE DE DATOS DE ORIGEN ==='

SELECT current_database() AS base_datos,
       current_user AS usuario_conexion,
       version() AS version_servidor;

SELECT pg_size_pretty(pg_database_size(current_database())) AS tamano_base,
       pg_encoding_to_char(d.encoding) AS encoding,
       d.datcollate AS collation,
       d.datctype AS character_type
FROM pg_database d
WHERE d.datname = current_database();

\echo '=== EXTENSIONES INSTALADAS ==='
SELECT e.extname AS extension,
       e.extversion AS version,
       n.nspname AS esquema
FROM pg_extension e
JOIN pg_namespace n ON n.oid = e.extnamespace
ORDER BY e.extname;

\echo '=== ESQUEMAS DE USUARIO ==='
SELECT nspname AS esquema,
       pg_get_userbyid(nspowner) AS propietario
FROM pg_namespace
WHERE nspname NOT LIKE 'pg_%'
  AND nspname <> 'information_schema'
ORDER BY nspname;

\echo '=== TABLAS Y TAMAÑOS (n_live_tup ES ESTIMADO) ==='
SELECT schemaname AS esquema,
       relname AS objeto,
       n_live_tup AS filas_estimadas,
       pg_size_pretty(pg_total_relation_size(relid)) AS tamano_total
FROM pg_stat_user_tables
ORDER BY schemaname, relname;

\echo '=== CONTEO DE OBJETOS POR ESQUEMA ==='
SELECT n.nspname AS esquema,
       c.relkind AS tipo_objeto,
       COUNT(*) AS cantidad
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname NOT LIKE 'pg_%'
  AND n.nspname <> 'information_schema'
  AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
GROUP BY n.nspname, c.relkind
ORDER BY n.nspname, c.relkind;

\echo '=== RESTRICCIONES FOREIGN KEY NO VALIDADAS ==='
SELECT connamespace::regnamespace AS esquema,
       conrelid::regclass AS tabla,
       conname AS restriccion,
       pg_get_constraintdef(oid) AS definicion
FROM pg_constraint
WHERE contype = 'f'
  AND NOT convalidated
ORDER BY 1, 2, 3;

\echo '=== INDICES INVALIDOS ==='
SELECT n.nspname AS esquema,
       t.relname AS tabla,
       i.relname AS indice,
       pg_get_indexdef(i.oid) AS definicion
FROM pg_index x
JOIN pg_class i ON i.oid = x.indexrelid
JOIN pg_class t ON t.oid = x.indrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE (NOT x.indisvalid OR NOT x.indisready)
  AND n.nspname NOT LIKE 'pg_%'
  AND n.nspname <> 'information_schema'
ORDER BY 1, 2, 3;

\echo '=== SECUENCIAS ==='
SELECT schemaname AS esquema,
       sequencename AS secuencia,
       data_type,
       start_value,
       min_value,
       max_value,
       increment_by,
       cycle
FROM pg_sequences
WHERE schemaname NOT LIKE 'pg_%'
  AND schemaname <> 'information_schema'
ORDER BY schemaname, sequencename;

\echo '=== FIN PREFLIGHT ==='
