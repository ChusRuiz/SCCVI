BEGIN;

-- La columna ya existe en el esquema actual de SCCVI, pero se incluye
-- IF NOT EXISTS para permitir ejecutar esta migración de forma segura.
ALTER TABLE padres_familia
  ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(100);

CREATE TABLE IF NOT EXISTS vinculaciones_telegram (
  id_vinculacion SERIAL PRIMARY KEY,
  id_padre INTEGER NOT NULL
    REFERENCES padres_familia(id_padre) ON DELETE CASCADE,
  codigo_hash CHAR(64) NOT NULL UNIQUE,
  estado VARCHAR(15) NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'vinculado', 'expirado', 'revocado', 'rechazado')),
  creado_por INTEGER
    REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  telegram_chat_id VARCHAR(100),
  telegram_username VARCHAR(100),
  telegram_nombre VARCHAR(150),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expira_en TIMESTAMPTZ NOT NULL,
  usado_en TIMESTAMPTZ,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS telegram_polling_state (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  last_update_id BIGINT NOT NULL DEFAULT 0,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO telegram_polling_state (id, last_update_id)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_vinculaciones_telegram_padre
  ON vinculaciones_telegram(id_padre, creado_en DESC);

CREATE INDEX IF NOT EXISTS idx_vinculaciones_telegram_pendientes
  ON vinculaciones_telegram(expira_en)
  WHERE estado = 'pendiente';

-- Solo puede existir un código pendiente por padre.
CREATE UNIQUE INDEX IF NOT EXISTS uq_vinculacion_telegram_pendiente_padre
  ON vinculaciones_telegram(id_padre)
  WHERE estado = 'pendiente';

-- Un chat privado de Telegram no puede pertenecer a dos padres.
-- Si hay datos duplicados heredados, la migración se detiene sin borrarlos.
DO $$
BEGIN
  IF EXISTS (
    SELECT telegram_chat_id
    FROM padres_familia
    WHERE telegram_chat_id IS NOT NULL
      AND BTRIM(telegram_chat_id) <> ''
    GROUP BY telegram_chat_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Hay telegram_chat_id duplicados en padres_familia. Corrígelos antes de crear el índice único.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_padres_telegram_chat_id
  ON padres_familia(telegram_chat_id)
  WHERE telegram_chat_id IS NOT NULL AND BTRIM(telegram_chat_id) <> '';

COMMIT;
