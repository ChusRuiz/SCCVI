/* =====================================================================
   SCCVI - DATOS DE PRUEBA (DEMO)
   Base esperada: sccvi_db | PostgreSQL

   Inserta datos ficticios y marcados como DEMO:
   - 6 comunidades
   - 30 padres/tutores
   - 30 pacientes
   - 40 asociaciones padre-paciente
   - 8 vacunas de demostracion
   - 75 aplicaciones de vacunas
   - 60 controles de crecimiento
   - Hasta 240 evaluaciones OMS (4 indicadores por control)

   Seguro para volver a ejecutar: usa DPI/CUI/lotes/nombres identificables y
   evita duplicar los registros DEMO.

   IMPORTANTE:
   - Ejecutar solamente en desarrollo/pruebas, nunca en produccion.
   - Los datos no son registros clinicos reales ni un calendario oficial.
   - Los correos usan example.invalid y no pueden recibir correo.
   - No se crean usuarios, alertas, notificaciones, campanas ni carnets QR.
   ===================================================================== */

BEGIN;

DO $$
BEGIN
  IF current_database() <> 'sccvi_db' THEN
    RAISE EXCEPTION 'Este script esta restringido a sccvi_db. Base actual: %', current_database();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM usuarios WHERE estado = TRUE
  ) THEN
    RAISE EXCEPTION 'No existe un usuario activo para asociar controles y vacunaciones. Crea o activa un usuario primero.';
  END IF;

  IF (
    SELECT COUNT(*) FROM (
      SELECT DISTINCT indicador, sexo
      FROM referencias_crecimiento
      WHERE estado = TRUE
        AND indicador IN ('peso_edad', 'talla_edad', 'peso_talla', 'perimetro_cefalico')
        AND sexo IN ('masculino', 'femenino')
    ) refs
  ) < 8 THEN
    RAISE EXCEPTION 'Faltan referencias OMS activas para los cuatro indicadores y ambos sexos. Importa primero las referencias OMS.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM valores_referencia_oms) THEN
    RAISE EXCEPTION 'La tabla valores_referencia_oms esta vacia. Importa primero los archivos OMS.';
  END IF;
END $$;

/* 1) Usuario del sistema que firma registros de prueba. */
CREATE TEMP TABLE tmp_demo_usuario ON COMMIT DROP AS
SELECT id_usuario
FROM usuarios
WHERE estado = TRUE
ORDER BY CASE WHEN rol = 'admin' THEN 0 ELSE 1 END, id_usuario
LIMIT 1;

/* 2) Seis comunidades ficticias. */
INSERT INTO comunidades (nombre, ubicacion, familias_estimadas, estado)
SELECT v.nombre, v.ubicacion, v.familias_estimadas, 'activa'
FROM (VALUES
  ('DEMO SCCVI - Comunidad 01', 'Sector Centro, Jalapa (DEMO)', 85),
  ('DEMO SCCVI - Comunidad 02', 'Aldea El Rodeo, Jalapa (DEMO)', 62),
  ('DEMO SCCVI - Comunidad 03', 'Aldea Sanyuyo, Jalapa (DEMO)', 48),
  ('DEMO SCCVI - Comunidad 04', 'Aldea La Fuente, Jalapa (DEMO)', 71),
  ('DEMO SCCVI - Comunidad 05', 'Sector El Porvenir, Jalapa (DEMO)', 54),
  ('DEMO SCCVI - Comunidad 06', 'Aldea Los Izotes, Jalapa (DEMO)', 39)
) AS v(nombre, ubicacion, familias_estimadas)
WHERE NOT EXISTS (
  SELECT 1 FROM comunidades c WHERE c.nombre = v.nombre
);

CREATE TEMP TABLE tmp_demo_comunidades ON COMMIT DROP AS
SELECT
  id_comunidad,
  ROW_NUMBER() OVER (ORDER BY nombre)::INTEGER AS idx
FROM comunidades
WHERE nombre LIKE 'DEMO SCCVI - Comunidad %'
  AND estado = 'activa';

DO $$ BEGIN
  IF (SELECT COUNT(*) FROM tmp_demo_comunidades) <> 6 THEN
    RAISE EXCEPTION 'No se pudieron localizar las 6 comunidades DEMO activas. Revisa nombres y estados antes de continuar.';
  END IF;
END $$;

/* 3) Datos fuente de 30 pacientes. Edad actual aproximada: entre 6 y 59 meses. */
CREATE TEMP TABLE tmp_demo_personas (
  idx INTEGER PRIMARY KEY,
  nombres VARCHAR(150),
  apellidos VARCHAR(150),
  sexo VARCHAR(20),
  edad_meses INTEGER,
  comunidad_idx INTEGER
) ON COMMIT DROP;

INSERT INTO tmp_demo_personas (idx, nombres, apellidos, sexo, edad_meses, comunidad_idx)
VALUES
 (1, 'Mateo', 'Ramirez Soto', 'masculino', 8, 1),
 (2, 'Valentina', 'Lopez Garcia', 'femenino', 11, 2),
 (3, 'Santiago', 'Morales Diaz', 'masculino', 14, 3),
 (4, 'Camila', 'Castillo Mendez', 'femenino', 17, 4),
 (5, 'Sebastian', 'Perez Aguilar', 'masculino', 20, 5),
 (6, 'Isabella', 'Hernandez Cruz', 'femenino', 23, 6),
 (7, 'Daniel', 'Gomez Morales', 'masculino', 26, 1),
 (8, 'Luciana', 'Rivera Lopez', 'femenino', 29, 2),
 (9, 'Gabriel', 'Ortiz Ramirez', 'masculino', 32, 3),
 (10, 'Victoria', 'Mendez Flores', 'femenino', 35, 4),
 (11, 'Benjamin', 'Reyes Soto', 'masculino', 38, 5),
 (12, 'Emma', 'Ruiz Castillo', 'femenino', 41, 6),
 (13, 'Nicolas', 'Diaz Herrera', 'masculino', 44, 1),
 (14, 'Martina', 'Aguilar Perez', 'femenino', 47, 2),
 (15, 'Samuel', 'Flores Morales', 'masculino', 50, 3),
 (16, 'Renata', 'Cruz Ramirez', 'femenino', 53, 4),
 (17, 'Diego', 'Herrera Lopez', 'masculino', 56, 5),
 (18, 'Antonella', 'Soto Garcia', 'femenino', 59, 6),
 (19, 'Joaquin', 'Vargas Mendez', 'masculino', 6, 1),
 (20, 'Mia', 'Navarro Ruiz', 'femenino', 9, 2),
 (21, 'Leonardo', 'Ramos Castillo', 'masculino', 12, 3),
 (22, 'Regina', 'Iglesias Perez', 'femenino', 15, 4),
 (23, 'Thiago', 'Molina Reyes', 'masculino', 18, 5),
 (24, 'Elena', 'Cabrera Diaz', 'femenino', 21, 6),
 (25, 'Andres', 'Mejia Flores', 'masculino', 24, 1),
 (26, 'Alma', 'Pineda Morales', 'femenino', 30, 2),
 (27, 'Emiliano', 'Estrada Soto', 'masculino', 36, 3),
 (28, 'Abril', 'Campos Herrera', 'femenino', 42, 4),
 (29, 'Maximiliano', 'Orellana Cruz', 'masculino', 48, 5),
 (30, 'Julieta', 'Salazar Gomez', 'femenino', 54, 6);

/* 4) Treinta padres/tutores ficticios. DPI prefijo 98 = dato DEMO, no valido para tramites. */
INSERT INTO padres_familia (
  id_comunidad, nombres, apellidos, dpi, telefono, correo, canal_preferido, estado
)
SELECT
  c.id_comunidad,
  'DEMO ' || (ARRAY['Ana Lucia','Carlos Eduardo','Maria Fernanda','Jose Manuel','Rosa Elena',
         'Luis Alberto','Claudia Beatriz','Miguel Angel','Patricia Isabel','Jorge Andres',
         'Daniela Sofia','Oscar Alejandro','Brenda Marisol','Mario Estuardo','Silvia Carolina',
         'Hector Noe','Andrea Paola','Ricardo Jose','Monica Alejandra','Edgar Leonel',
         'Paola Andrea','Fernando Enrique','Teresa Isabel','Victor Manuel','Karla Vanessa',
         'Julio Cesar','Evelyn Susana','Marvin Roberto','Gabriela Carmen','Arturo Daniel'])[g.i],
  (ARRAY['Ramirez Soto','Lopez Garcia','Morales Diaz','Castillo Mendez','Perez Aguilar',
         'Hernandez Cruz','Gomez Morales','Rivera Lopez','Ortiz Ramirez','Mendez Flores',
         'Vargas Pineda','Navarro Ruiz','Ramos Castillo','Iglesias Perez','Molina Reyes',
         'Cabrera Diaz','Mejia Flores','Pineda Morales','Estrada Soto','Campos Herrera',
         'Orellana Cruz','Salazar Gomez','Cifuentes Rojas','Barrios Mendez','Fuentes Lara',
         'Aguilar Guerra','Sandoval Rivas','Palacios Vega','Rosales Marroquin','Chavez Alvarado'])[g.i],
  '98' || LPAD(g.i::TEXT, 11, '0'),
  LPAD((55500000 + g.i)::TEXT, 8, '0'),
  'sccvi.demo.padre' || LPAD(g.i::TEXT, 2, '0') || '@example.invalid',
  'email',
  'activo'
FROM generate_series(1, 30) AS g(i)
JOIN tmp_demo_comunidades c ON c.idx = ((g.i - 1) % 6) + 1
WHERE NOT EXISTS (
  SELECT 1 FROM padres_familia pf
  WHERE pf.dpi = '98' || LPAD(g.i::TEXT, 11, '0')
);

CREATE TEMP TABLE tmp_demo_padres ON COMMIT DROP AS
SELECT id_padre, RIGHT(dpi, 11)::INTEGER AS idx
FROM padres_familia
WHERE nombres LIKE 'DEMO %'
  AND dpi ~ '^98[0-9]{11}$'
  AND RIGHT(dpi, 11)::INTEGER BETWEEN 1 AND 30
  AND estado = 'activo';

DO $$ BEGIN
  IF (SELECT COUNT(*) FROM tmp_demo_padres) <> 30 THEN
    RAISE EXCEPTION 'Se requieren exactamente 30 padres DEMO activos. Puede existir una colision de DPI o registros DEMO inactivos.';
  END IF;
END $$;

/* 5) Treinta pacientes ficticios. CUI prefijo 97 = dato DEMO. */
INSERT INTO pacientes (
  nombres, apellidos, fecha_nacimiento, sexo, cui,
  nombre_encargado, telefono_encargado, direccion, id_comunidad, estado
)
SELECT
  'DEMO ' || d.nombres,
  d.apellidos,
  (CURRENT_DATE - (d.edad_meses || ' months')::INTERVAL)::DATE,
  d.sexo,
  '97' || LPAD(d.idx::TEXT, 11, '0'),
  pf.nombres || ' ' || pf.apellidos,
  pf.telefono,
  'Direccion ficticia DEMO ' || LPAD(d.idx::TEXT, 2, '0') || ', Jalapa',
  c.id_comunidad,
  'activo'
FROM tmp_demo_personas d
JOIN tmp_demo_padres dp ON dp.idx = d.idx
JOIN padres_familia pf ON pf.id_padre = dp.id_padre
JOIN tmp_demo_comunidades c ON c.idx = d.comunidad_idx
WHERE NOT EXISTS (
  SELECT 1 FROM pacientes p
  WHERE p.cui = '97' || LPAD(d.idx::TEXT, 11, '0')
);

CREATE TEMP TABLE tmp_demo_pacientes ON COMMIT DROP AS
SELECT
  p.id_paciente,
  RIGHT(p.cui, 11)::INTEGER AS idx,
  p.fecha_nacimiento,
  p.sexo,
  p.id_comunidad
FROM pacientes p
WHERE p.nombres LIKE 'DEMO %'
  AND p.cui ~ '^97[0-9]{11}$'
  AND RIGHT(p.cui, 11)::INTEGER BETWEEN 1 AND 30;

DO $$ BEGIN
  IF (SELECT COUNT(*) FROM tmp_demo_pacientes) <> 30 THEN
    RAISE EXCEPTION 'Se requieren exactamente 30 pacientes DEMO. Puede existir una colision de CUI o faltar una comunidad/padre.';
  END IF;
END $$;

/* 6) Treinta contactos principales y diez asociaciones secundarias para probar familias. */
INSERT INTO padres_pacientes (id_padre, id_paciente, parentesco, es_contacto_principal)
SELECT dp.id_padre, p.id_paciente, 'Madre/Padre', TRUE
FROM tmp_demo_pacientes p
JOIN tmp_demo_padres dp ON dp.idx = p.idx
ON CONFLICT (id_padre, id_paciente)
DO UPDATE SET parentesco = EXCLUDED.parentesco,
              es_contacto_principal = TRUE;

INSERT INTO padres_pacientes (id_padre, id_paciente, parentesco, es_contacto_principal)
SELECT dp.id_padre, p.id_paciente, 'Tutor secundario', FALSE
FROM tmp_demo_pacientes p
JOIN tmp_demo_padres dp ON dp.idx = ((p.idx + 9 - 1) % 30) + 1
WHERE p.idx % 3 = 0
ON CONFLICT (id_padre, id_paciente)
DO UPDATE SET parentesco = EXCLUDED.parentesco,
              es_contacto_principal = FALSE;

/* 7) Ocho vacunas de demostracion. No representan un calendario oficial. */
INSERT INTO vacunas (nombre, descripcion, edad_recomendada, numero_dosis, estado)
SELECT v.nombre, v.descripcion, v.edad_recomendada, v.numero_dosis, TRUE
FROM (VALUES
  ('DEMO SCCVI 01 - BCG', 'Vacuna ficticia para pruebas del catalogo SCCVI.', 'Al nacer (referencia DEMO)', 1),
  ('DEMO SCCVI 02 - Hepatitis B', 'Registro de ejemplo; no usar como indicacion clinica.', 'Al nacer / esquema DEMO', 3),
  ('DEMO SCCVI 03 - Pentavalente', 'Vacuna ficticia para pruebas de dosis multiples.', '2 meses (referencia DEMO)', 3),
  ('DEMO SCCVI 04 - Polio IPV', 'Registro de ejemplo para pruebas del historial.', '2 meses (referencia DEMO)', 3),
  ('DEMO SCCVI 05 - Rotavirus', 'Registro de ejemplo para pruebas de dosis.', '2 meses (referencia DEMO)', 2),
  ('DEMO SCCVI 06 - Neumococo', 'Vacuna ficticia para pruebas de reportes.', '2 meses (referencia DEMO)', 3),
  ('DEMO SCCVI 07 - Influenza', 'Registro ficticio para pruebas del catalogo.', '6 meses (referencia DEMO)', 2),
  ('DEMO SCCVI 08 - SRP', 'Registro ficticio para pruebas del catalogo.', '12 meses (referencia DEMO)', 2)
) AS v(nombre, descripcion, edad_recomendada, numero_dosis)
WHERE NOT EXISTS (
  SELECT 1 FROM vacunas x WHERE x.nombre = v.nombre
);

CREATE TEMP TABLE tmp_demo_vacunas ON COMMIT DROP AS
SELECT id_vacuna,
       CASE
         WHEN nombre LIKE 'DEMO SCCVI 01 %' THEN 1
         WHEN nombre LIKE 'DEMO SCCVI 02 %' THEN 2
         WHEN nombre LIKE 'DEMO SCCVI 03 %' THEN 3
         WHEN nombre LIKE 'DEMO SCCVI 04 %' THEN 4
         WHEN nombre LIKE 'DEMO SCCVI 05 %' THEN 5
         WHEN nombre LIKE 'DEMO SCCVI 06 %' THEN 6
         WHEN nombre LIKE 'DEMO SCCVI 07 %' THEN 7
         WHEN nombre LIKE 'DEMO SCCVI 08 %' THEN 8
       END AS idx
FROM vacunas
WHERE nombre LIKE 'DEMO SCCVI __ %' AND estado = TRUE;

DO $$ BEGIN
  IF (SELECT COUNT(*) FROM tmp_demo_vacunas) <> 8 THEN
    RAISE EXCEPTION 'Se requieren las 8 vacunas DEMO activas. Revisa si alguna fue desactivada.';
  END IF;
END $$;

/* 8) Setenta y cinco aplicaciones de ejemplo (BCG, Pentavalente/Polio y Rotavirus). */
WITH datos AS (
  SELECT p.*, pf.id_padre
  FROM tmp_demo_pacientes p
  JOIN tmp_demo_padres dp ON dp.idx = p.idx
  JOIN padres_familia pf ON pf.id_padre = dp.id_padre
), aplicaciones AS (
  SELECT
    d.id_paciente, v.id_vacuna, u.id_usuario,
    '1'::VARCHAR(50) AS dosis,
    (d.fecha_nacimiento + INTERVAL '1 day')::DATE AS fecha_aplicacion,
    'DEMO-LOTE-BCG-' || LPAD(d.idx::TEXT, 2, '0') AS lote,
    NULL::DATE AS proxima_dosis,
    'DATOS DE PRUEBA SCCVI; no es un registro clinico real.'::TEXT AS observaciones
  FROM datos d
  JOIN tmp_demo_vacunas v ON v.idx = 1
  CROSS JOIN tmp_demo_usuario u

  UNION ALL

  SELECT
    d.id_paciente,
    v.id_vacuna,
    u.id_usuario,
    CASE WHEN d.idx % 2 = 0 THEN '2' ELSE '1' END::VARCHAR(50),
    (d.fecha_nacimiento + INTERVAL '2 months')::DATE,
    'DEMO-LOTE-PENTA-' || LPAD(d.idx::TEXT, 2, '0'),
    CASE
      WHEN d.idx % 4 = 0 THEN CURRENT_DATE - 10
      WHEN d.idx % 4 = 1 THEN CURRENT_DATE + 20
      ELSE NULL
    END,
    'DATOS DE PRUEBA SCCVI; fecha/dosis ilustrativa.'::TEXT
  FROM datos d
  JOIN tmp_demo_vacunas v ON v.idx = 3
  CROSS JOIN tmp_demo_usuario u

  UNION ALL

  SELECT
    d.id_paciente,
    v.id_vacuna,
    u.id_usuario,
    '1'::VARCHAR(50),
    (d.fecha_nacimiento + INTERVAL '3 months')::DATE,
    'DEMO-LOTE-ROTA-' || LPAD(d.idx::TEXT, 2, '0'),
    CASE WHEN d.idx % 5 = 0 THEN CURRENT_DATE + 30 ELSE NULL END,
    'DATOS DE PRUEBA SCCVI; vacuna ilustrativa.'::TEXT
  FROM datos d
  JOIN tmp_demo_vacunas v ON v.idx = 5
  CROSS JOIN tmp_demo_usuario u
  WHERE d.idx % 2 = 0
)
INSERT INTO vacunaciones (
  id_paciente, id_vacuna, id_usuario, dosis,
  fecha_aplicacion, lote, proxima_dosis, observaciones
)
SELECT
  a.id_paciente, a.id_vacuna, a.id_usuario, a.dosis,
  a.fecha_aplicacion, a.lote, a.proxima_dosis, a.observaciones
FROM aplicaciones a
WHERE NOT EXISTS (
  SELECT 1 FROM vacunaciones x WHERE x.lote = a.lote
);

/* 9) Sesenta controles: dos por paciente, con datos ficticios plausibles.
      Algunos casos se separan deliberadamente para probar los reportes OMS.
      No usar para decisiones clinicas. */
WITH fechas AS (
  SELECT
    p.*,
    n.control_num,
    (CURRENT_DATE - CASE WHEN n.control_num = 1 THEN 35 ELSE 7 END)::DATE AS fecha_control
  FROM tmp_demo_pacientes p
  CROSS JOIN (VALUES (1), (2)) AS n(control_num)
), base AS (
  SELECT
    f.*,
    (EXTRACT(YEAR FROM AGE(f.fecha_control, f.fecha_nacimiento))::INTEGER * 12
      + EXTRACT(MONTH FROM AGE(f.fecha_control, f.fecha_nacimiento))::INTEGER) AS edad_control_meses
  FROM fechas f
), medidas AS (
  SELECT
    b.*,
    ROUND((5.8 + b.edad_control_meses * 0.235)::NUMERIC *
      CASE
        WHEN b.idx % 10 = 0 THEN 0.72
        WHEN b.idx % 10 = 1 THEN 1.20
        ELSE 1.0 + ((b.idx % 5) - 2) * 0.012
      END, 2) AS peso_demo,
    ROUND((63.5 + b.edad_control_meses * 0.79 + ((b.idx % 5) - 2) * 0.35)::NUMERIC, 1) AS talla_demo,
    ROUND((41.2 + b.edad_control_meses * 0.16 + ((b.idx % 3) - 1) * 0.20)::NUMERIC, 1) AS perimetro_demo
  FROM base b
)
INSERT INTO controles_crecimiento (
  id_paciente, id_usuario, fecha_control,
  peso_kg, talla_cm, talla_estandar_oms_cm,
  metodo_medicion_talla, perimetro_cefalico_cm, observaciones
)
SELECT
  m.id_paciente,
  u.id_usuario,
  m.fecha_control,
  m.peso_demo,
  m.talla_demo,
  m.talla_demo,
  CASE WHEN m.edad_control_meses < 24 THEN 'acostado' ELSE 'de_pie' END,
  m.perimetro_demo,
  'DEMO SCCVI|P' || LPAD(m.idx::TEXT, 2, '0') || '|C' || m.control_num ||
    '| Datos ficticios para pruebas; no usar clinicamente.'
FROM medidas m
CROSS JOIN tmp_demo_usuario u
WHERE NOT EXISTS (
  SELECT 1
  FROM controles_crecimiento c
  WHERE c.id_paciente = m.id_paciente
    AND c.observaciones LIKE
      'DEMO SCCVI|P' || LPAD(m.idx::TEXT, 2, '0') || '|C' || m.control_num || '%'
);

/* 10) Evaluaciones OMS ligadas a los controles DEMO.
       Z se calcula a partir de la medicion y parametros LMS de referencia mas cercana. */
WITH controles_demo AS (
  SELECT
    c.id_control,
    c.id_paciente,
    c.fecha_control,
    c.peso_kg,
    c.talla_estandar_oms_cm,
    c.perimetro_cefalico_cm,
    p.sexo,
    p.fecha_nacimiento,
    (EXTRACT(YEAR FROM AGE(c.fecha_control, p.fecha_nacimiento))::INTEGER * 12
      + EXTRACT(MONTH FROM AGE(c.fecha_control, p.fecha_nacimiento))::INTEGER) AS edad_meses
  FROM controles_crecimiento c
  JOIN pacientes p ON p.id_paciente = c.id_paciente
  WHERE c.observaciones LIKE 'DEMO SCCVI|%'
), referencias AS (
  /* Peso para la edad (WFA). */
  SELECT
    b.id_control, 'peso_edad'::VARCHAR(40) AS indicador,
    b.peso_kg::NUMERIC AS medicion, 'kg'::VARCHAR(20) AS unidad,
    ref.id_referencia, ref.id_valor, ref.l, ref.m, ref.s
  FROM controles_demo b
  CROSS JOIN LATERAL (
    SELECT r.id_referencia, v.id_valor, v.l, v.m, v.s
    FROM referencias_crecimiento r
    JOIN valores_referencia_oms v ON v.id_referencia = r.id_referencia
    WHERE r.indicador = 'peso_edad' AND r.sexo = b.sexo AND r.estado = TRUE
      AND LOWER(r.archivo_origen) LIKE 'wfa_%'
      AND v.edad_meses IS NOT NULL
    ORDER BY ABS(v.edad_meses - b.edad_meses)
    LIMIT 1
  ) ref

  UNION ALL

  /* Talla para la edad (LHFA), seleccionando el tramo OMS correcto. */
  SELECT
    b.id_control, 'talla_edad'::VARCHAR(40),
    b.talla_estandar_oms_cm::NUMERIC, 'cm'::VARCHAR(20),
    ref.id_referencia, ref.id_valor, ref.l, ref.m, ref.s
  FROM controles_demo b
  CROSS JOIN LATERAL (
    SELECT r.id_referencia, v.id_valor, v.l, v.m, v.s
    FROM referencias_crecimiento r
    JOIN valores_referencia_oms v ON v.id_referencia = r.id_referencia
    WHERE r.indicador = 'talla_edad' AND r.sexo = b.sexo AND r.estado = TRUE
      AND LOWER(r.archivo_origen) LIKE 'lhfa_%'
      AND v.edad_meses IS NOT NULL
      AND (
        (b.edad_meses < 24 AND LOWER(r.archivo_origen) LIKE '%0-to-2-years%')
        OR
        (b.edad_meses >= 24 AND LOWER(r.archivo_origen) LIKE '%2-to-5-years%')
      )
    ORDER BY ABS(v.edad_meses - b.edad_meses)
    LIMIT 1
  ) ref

  UNION ALL

  /* Peso para longitud/estatura (WFL/WFH). */
  SELECT
    b.id_control, 'peso_talla'::VARCHAR(40),
    b.peso_kg::NUMERIC, 'kg'::VARCHAR(20),
    ref.id_referencia, ref.id_valor, ref.l, ref.m, ref.s
  FROM controles_demo b
  CROSS JOIN LATERAL (
    SELECT r.id_referencia, v.id_valor, v.l, v.m, v.s
    FROM referencias_crecimiento r
    JOIN valores_referencia_oms v ON v.id_referencia = r.id_referencia
    WHERE r.indicador = 'peso_talla' AND r.sexo = b.sexo AND r.estado = TRUE
      AND v.medida_cm IS NOT NULL
      AND (
        (b.edad_meses < 24 AND LOWER(r.archivo_origen) LIKE 'wfl_%')
        OR
        (b.edad_meses >= 24 AND LOWER(r.archivo_origen) LIKE 'wfh_%')
      )
    ORDER BY ABS(v.medida_cm - b.talla_estandar_oms_cm)
    LIMIT 1
  ) ref

  UNION ALL

  /* Perimetro cefalico para la edad (HCFA). */
  SELECT
    b.id_control, 'perimetro_cefalico'::VARCHAR(40),
    b.perimetro_cefalico_cm::NUMERIC, 'cm'::VARCHAR(20),
    ref.id_referencia, ref.id_valor, ref.l, ref.m, ref.s
  FROM controles_demo b
  CROSS JOIN LATERAL (
    SELECT r.id_referencia, v.id_valor, v.l, v.m, v.s
    FROM referencias_crecimiento r
    JOIN valores_referencia_oms v ON v.id_referencia = r.id_referencia
    WHERE r.indicador = 'perimetro_cefalico' AND r.sexo = b.sexo AND r.estado = TRUE
      AND LOWER(r.archivo_origen) LIKE 'hcfa_%'
      AND v.edad_meses IS NOT NULL
    ORDER BY ABS(v.edad_meses - b.edad_meses)
    LIMIT 1
  ) ref
), z_calculado AS (
  SELECT
    x.*,
    CASE
      WHEN x.l IS NULL OR x.m IS NULL OR x.s IS NULL OR x.s = 0 OR x.m = 0 THEN NULL
      WHEN ABS(x.l) < 0.0000001 THEN LN(x.medicion / x.m) / x.s
      ELSE (POWER(x.medicion / x.m, x.l) - 1) / (x.l * x.s)
    END AS puntuacion_z
  FROM referencias x
)
INSERT INTO evaluaciones_crecimiento (
  id_control, indicador, sexo, edad_meses, medicion, unidad,
  puntuacion_z, estado, descripcion,
  id_referencia, id_valor_referencia,
  parametro_l, parametro_m, parametro_s
)
SELECT
  z.id_control,
  z.indicador,
  (SELECT p.sexo FROM controles_crecimiento c JOIN pacientes p ON p.id_paciente = c.id_paciente WHERE c.id_control = z.id_control),
  (SELECT EXTRACT(YEAR FROM AGE(c.fecha_control, p.fecha_nacimiento))::INTEGER * 12
          + EXTRACT(MONTH FROM AGE(c.fecha_control, p.fecha_nacimiento))::INTEGER
   FROM controles_crecimiento c JOIN pacientes p ON p.id_paciente = c.id_paciente
   WHERE c.id_control = z.id_control),
  z.medicion,
  z.unidad,
  ROUND(z.puntuacion_z::NUMERIC, 4),
  CASE
    WHEN z.puntuacion_z IS NULL THEN 'no_evaluable'
    WHEN z.indicador = 'peso_edad' AND z.puntuacion_z < -3 THEN 'peso_muy_bajo'
    WHEN z.indicador = 'peso_edad' AND z.puntuacion_z < -2 THEN 'peso_bajo'
    WHEN z.indicador = 'talla_edad' AND z.puntuacion_z < -3 THEN 'talla_muy_baja'
    WHEN z.indicador = 'talla_edad' AND z.puntuacion_z < -2 THEN 'talla_baja'
    WHEN z.indicador = 'peso_talla' AND z.puntuacion_z < -3 THEN 'desnutricion_aguda_severa'
    WHEN z.indicador = 'peso_talla' AND z.puntuacion_z < -2 THEN 'desnutricion_aguda'
    WHEN z.indicador = 'peso_talla' AND z.puntuacion_z > 3 THEN 'obesidad'
    WHEN z.indicador = 'peso_talla' AND z.puntuacion_z > 2 THEN 'sobrepeso'
    WHEN z.indicador = 'perimetro_cefalico' AND z.puntuacion_z < -2 THEN 'perimetro_bajo'
    WHEN z.indicador = 'perimetro_cefalico' AND z.puntuacion_z > 2 THEN 'perimetro_alto'
    ELSE 'normal'
  END,
  CASE
    WHEN z.puntuacion_z IS NULL THEN 'No fue posible calcular el Z-score para este registro DEMO.'
    WHEN z.puntuacion_z < -3 THEN 'Registro DEMO: medicion muy por debajo de la referencia OMS mas cercana.'
    WHEN z.puntuacion_z < -2 THEN 'Registro DEMO: medicion por debajo de la referencia OMS mas cercana.'
    WHEN z.puntuacion_z > 3 THEN 'Registro DEMO: medicion muy por encima de la referencia OMS mas cercana.'
    WHEN z.puntuacion_z > 2 THEN 'Registro DEMO: medicion por encima de la referencia OMS mas cercana.'
    ELSE 'Registro DEMO: medicion cercana a la referencia OMS mas cercana.'
  END,
  z.id_referencia,
  z.id_valor,
  z.l,
  z.m,
  z.s
FROM z_calculado z
WHERE z.puntuacion_z IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM evaluaciones_crecimiento e
    WHERE e.id_control = z.id_control
      AND e.indicador = z.indicador
  );

COMMIT;

/* 11) Resumen de lo insertado. */
SELECT 'comunidades_demo' AS tabla, COUNT(*) AS registros
FROM comunidades WHERE nombre LIKE 'DEMO SCCVI - Comunidad %'
UNION ALL
SELECT 'padres_demo', COUNT(*)
FROM padres_familia WHERE nombres LIKE 'DEMO %' AND dpi ~ '^98[0-9]{11}$'
  AND RIGHT(dpi, 11)::INTEGER BETWEEN 1 AND 30
UNION ALL
SELECT 'pacientes_demo', COUNT(*)
FROM pacientes WHERE nombres LIKE 'DEMO %' AND cui ~ '^97[0-9]{11}$'
  AND RIGHT(cui, 11)::INTEGER BETWEEN 1 AND 30
UNION ALL
SELECT 'asociaciones_demo', COUNT(*)
FROM padres_pacientes pp
JOIN padres_familia pf ON pf.id_padre = pp.id_padre
WHERE pf.nombres LIKE 'DEMO %' AND pf.dpi ~ '^98[0-9]{11}$' AND RIGHT(pf.dpi, 11)::INTEGER BETWEEN 1 AND 30
UNION ALL
SELECT 'vacunas_demo', COUNT(*)
FROM vacunas WHERE nombre LIKE 'DEMO SCCVI __ %'
UNION ALL
SELECT 'vacunaciones_demo', COUNT(*)
FROM vacunaciones WHERE lote LIKE 'DEMO-LOTE-%'
UNION ALL
SELECT 'controles_demo', COUNT(*)
FROM controles_crecimiento WHERE observaciones LIKE 'DEMO SCCVI|%'
UNION ALL
SELECT 'evaluaciones_demo', COUNT(*)
FROM evaluaciones_crecimiento e
JOIN controles_crecimiento c ON c.id_control = e.id_control
WHERE c.observaciones LIKE 'DEMO SCCVI|%'
ORDER BY tabla;
