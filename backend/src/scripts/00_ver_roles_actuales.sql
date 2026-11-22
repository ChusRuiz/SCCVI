-- Ejecuta primero esta consulta para ver qué roles existen actualmente.
SELECT rol, COUNT(*) AS usuarios
FROM usuarios
GROUP BY rol
ORDER BY rol;

-- Verifica el tipo de dato de la columna rol.
SELECT column_name, data_type, udt_name, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'usuarios'
  AND column_name = 'rol';
