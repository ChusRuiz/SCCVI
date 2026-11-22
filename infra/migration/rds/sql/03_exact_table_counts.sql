\set ON_ERROR_STOP on
\set QUIET on
\pset format csv
\pset footer off

CREATE TEMP TABLE sccvi_migration_table_counts (
  table_name TEXT NOT NULL,
  row_count BIGINT NOT NULL
);

DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN
    SELECT n.nspname AS schema_name,
           c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('r', 'p')
      AND n.nspname NOT LIKE 'pg_%'
      AND n.nspname <> 'information_schema'
    ORDER BY n.nspname, c.relname
  LOOP
    EXECUTE format(
      'INSERT INTO pg_temp.sccvi_migration_table_counts(table_name, row_count) SELECT %L, COUNT(*)::BIGINT FROM %I.%I',
      t.schema_name || '.' || t.table_name,
      t.schema_name,
      t.table_name
    );
  END LOOP;
END $$;

SELECT table_name, row_count
FROM pg_temp.sccvi_migration_table_counts
ORDER BY table_name;
