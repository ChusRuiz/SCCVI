-- MIGRACIÓN DE LOS TRES ROLES OFICIALES SCCVI
-- Roles nuevos:
--   admin
--   personal_salud
--   encargado_centro
--
-- Mapeo de roles anteriores:
--   medico / enfermero -> personal_salud
--   recepcion / recepcionista -> encargado_centro
--   administrador -> admin
--
-- Haz un respaldo de sccvi_db antes de ejecutar este archivo.

BEGIN;

DO $$
DECLARE
    restriccion RECORD;
BEGIN
    IF to_regclass('public.usuarios') IS NULL THEN
        RAISE EXCEPTION 'No existe la tabla public.usuarios.';
    END IF;

    -- Quitar restricciones CHECK antiguas relacionadas con rol.
    FOR restriccion IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.usuarios'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%rol%'
    LOOP
        EXECUTE format(
            'ALTER TABLE public.usuarios DROP CONSTRAINT %I',
            restriccion.conname
        );
    END LOOP;
END $$;

-- Convertir a VARCHAR permite migrar bases que anteriormente usaban ENUM.
ALTER TABLE public.usuarios
    ALTER COLUMN rol DROP DEFAULT;

ALTER TABLE public.usuarios
    ALTER COLUMN rol TYPE VARCHAR(30)
    USING rol::TEXT;

UPDATE public.usuarios
SET rol = CASE LOWER(BTRIM(rol))
    WHEN 'administrador' THEN 'admin'
    WHEN 'admin' THEN 'admin'
    WHEN 'medico' THEN 'personal_salud'
    WHEN 'enfermero' THEN 'personal_salud'
    WHEN 'personal medico' THEN 'personal_salud'
    WHEN 'personal médico' THEN 'personal_salud'
    WHEN 'personal_salud' THEN 'personal_salud'
    WHEN 'recepcion' THEN 'encargado_centro'
    WHEN 'recepcionista' THEN 'encargado_centro'
    WHEN 'encargado' THEN 'encargado_centro'
    WHEN 'encargado_centro' THEN 'encargado_centro'
    ELSE LOWER(BTRIM(rol))
END;

DO $$
DECLARE
    roles_desconocidos TEXT;
BEGIN
    SELECT STRING_AGG(DISTINCT COALESCE(rol, '<NULL>'), ', ')
    INTO roles_desconocidos
    FROM public.usuarios
    WHERE rol IS NULL
       OR rol NOT IN ('admin', 'personal_salud', 'encargado_centro');

    IF roles_desconocidos IS NOT NULL THEN
        RAISE EXCEPTION
          'Hay roles que requieren asignación manual: %. Revisa SELECT rol, COUNT(*) FROM usuarios GROUP BY rol; y asígnalos a uno de los tres roles oficiales.',
          roles_desconocidos;
    END IF;
END $$;

ALTER TABLE public.usuarios
    ALTER COLUMN rol SET DEFAULT 'personal_salud';

ALTER TABLE public.usuarios
    DROP CONSTRAINT IF EXISTS usuarios_rol_sccvi_check;

ALTER TABLE public.usuarios
    ADD CONSTRAINT usuarios_rol_sccvi_check
    CHECK (rol IN ('admin', 'personal_salud', 'encargado_centro'));

COMMIT;

-- Verificación final
SELECT rol, COUNT(*) AS usuarios
FROM usuarios
GROUP BY rol
ORDER BY rol;
