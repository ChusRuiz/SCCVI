CREATE TABLE IF NOT EXISTS notificaciones (
    id_notificacion SERIAL PRIMARY KEY,

    id_alerta INTEGER NOT NULL
        REFERENCES alertas(id_alerta)
        ON DELETE CASCADE,

    id_padre INTEGER NOT NULL
        REFERENCES padres_familia(id_padre)
        ON DELETE RESTRICT,

    canal VARCHAR(15) NOT NULL
        CHECK (canal IN ('email', 'telegram')),

    destinatario VARCHAR(255) NOT NULL,

    estado VARCHAR(15) NOT NULL DEFAULT 'pendiente'
        CHECK (estado IN (
            'pendiente',
            'procesando',
            'enviada',
            'error'
        )),

    asunto VARCHAR(180),
    mensaje TEXT NOT NULL,

    intentos INTEGER NOT NULL DEFAULT 0,
    max_intentos INTEGER NOT NULL DEFAULT 5,

    error_detalle TEXT,

    fecha_programada TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ultimo_intento_en TIMESTAMPTZ,
    procesando_en TIMESTAMPTZ,
    enviado_en TIMESTAMPTZ,

    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT notificacion_unica
        UNIQUE (id_alerta, id_padre, canal),

    CONSTRAINT intentos_validos
        CHECK (intentos >= 0 AND max_intentos > 0)
);

CREATE INDEX IF NOT EXISTS idx_notificaciones_estado
ON notificaciones(estado);

CREATE INDEX IF NOT EXISTS idx_notificaciones_programada
ON notificaciones(fecha_programada);

CREATE INDEX IF NOT EXISTS idx_notificaciones_padre
ON notificaciones(id_padre);

CREATE INDEX IF NOT EXISTS idx_notificaciones_alerta
ON notificaciones(id_alerta);