\set ON_ERROR_STOP on
\pset pager off
\pset footer off
\echo '=== SCCVI | VALIDACION DE BASE DESTINO ==='

SELECT current_database() AS base_datos,
       current_user AS usuario_conexion,
       version() AS version_servidor,
       pg_size_pretty(pg_database_size(current_database())) AS tamano_base;

\echo '=== EXTENSIONES ==='
SELECT e.extname AS extension,
       e.extversion AS version,
       n.nspname AS esquema
FROM pg_extension e
JOIN pg_namespace n ON n.oid = e.extnamespace
ORDER BY e.extname;

\echo '=== OBJETOS DE USUARIO ==='
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

\echo '=== FOREIGN KEYS NO VALIDADAS ==='
SELECT connamespace::regnamespace AS esquema,
       conrelid::regclass AS tabla,
       conname AS restriccion
FROM pg_constraint
WHERE contype = 'f' AND NOT convalidated
ORDER BY 1, 2, 3;

\echo '=== INDICES INVALIDOS ==='
SELECT n.nspname AS esquema,
       t.relname AS tabla,
       i.relname AS indice
FROM pg_index x
JOIN pg_class i ON i.oid = x.indexrelid
JOIN pg_class t ON t.oid = x.indrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE (NOT x.indisvalid OR NOT x.indisready)
  AND n.nspname NOT LIKE 'pg_%'
  AND n.nspname <> 'information_schema'
ORDER BY 1, 2, 3;

\echo '=== PERMISOS DEL USUARIO DE APLICACION (si ya fue creado) ==='
SELECT rolname,
       rolsuper,
       rolcreatedb,
       rolcreaterole,
       rolcanlogin
FROM pg_roles
WHERE rolname IN ('sccvi_master', 'sccvi_app')
ORDER BY rolname;

\echo '=== FIN VALIDACION DESTINO ==='
