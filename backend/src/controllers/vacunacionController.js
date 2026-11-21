const db = require("../config/db");

// Obtener catálogo de vacunas
const obtenerVacunas = async (req, res) => {
  try {
    const resultado = await db.query(
      "SELECT * FROM vacunas ORDER BY nombre ASC"
    );

    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener vacunas" });
  }
};

// Registrar vacuna en catálogo
const crearVacuna = async (req, res) => {
  try {
    const { nombre, descripcion, edad_recomendada, numero_dosis } = req.body;

    if (!nombre || !numero_dosis) {
      return res.status(400).json({
        mensaje: "Nombre y número de dosis son obligatorios",
      });
    }

    const resultado = await db.query(
      `INSERT INTO vacunas
       (nombre, descripcion, edad_recomendada, numero_dosis)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [nombre, descripcion, edad_recomendada, numero_dosis]
    );

    res.status(201).json({
      mensaje: "Vacuna registrada correctamente",
      vacuna: resultado.rows[0],
    });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al registrar vacuna" });
  }
};

// 3. Desactivar vacuna del catálogo
const desactivarVacuna = async (req, res) => {
  try {
    const { id } = req.params;

    const resultado = await db.query(
      `UPDATE vacunas
       SET estado = false
       WHERE id_vacuna = $1
       RETURNING *`,
      [id]
    );

    if (resultado.rowCount === 0) {
      return res.status(404).json({ mensaje: "Vacuna no encontrada" });
    }

    res.json({
      mensaje: "Vacuna desactivada correctamente",
      vacuna: resultado.rows[0],
    });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al desactivar vacuna" });
  }
};

// 4. Registrar vacuna aplicada
const registrarVacunacion = async (req, res) => {
  try {
    const {
      id_paciente,
      id_vacuna,
      dosis,
      fecha_aplicacion,
      lote,
      proxima_dosis,
      observaciones,
    } = req.body;

    if (!id_paciente || !id_vacuna || !dosis || !fecha_aplicacion) {
      return res.status(400).json({
        mensaje: "Paciente, vacuna, dosis y fecha son obligatorios",
      });
    }

    if (Number(dosis) <= 0) {
      return res.status(400).json({
        mensaje: "La dosis debe ser un número válido",
      });
    }

    const paciente = await db.query(
      "SELECT id_paciente FROM pacientes WHERE id_paciente = $1 AND estado = 'activo'",
      [id_paciente]
    );

    if (paciente.rowCount === 0) {
      return res.status(404).json({
        mensaje: "Paciente no encontrado o inactivo",
      });
    }

    const vacuna = await db.query(
      "SELECT id_vacuna FROM vacunas WHERE id_vacuna = $1 AND estado = true",
      [id_vacuna]
    );

    if (vacuna.rowCount === 0) {
      return res.status(404).json({
        mensaje: "Vacuna no encontrada o desactivada",
      });
    }

    const resultado = await db.query(
      `INSERT INTO vacunaciones
       (id_paciente, id_vacuna, id_usuario, dosis,
        fecha_aplicacion, lote, proxima_dosis, observaciones)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        id_paciente,
        id_vacuna,
        req.usuario.id,
        dosis,
        fecha_aplicacion,
        lote || null,
        proxima_dosis || null,
        observaciones || null,
      ]
    );

    res.status(201).json({
      mensaje: "Vacunación registrada correctamente",
      vacunacion: resultado.rows[0],
    });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al registrar vacunación" });
  }
};

// 5. Historial de vacunación de un paciente
const historialVacunacion = async (req, res) => {
  try {
    const { id } = req.params;

    const resultado = await db.query(
      `SELECT v.id_vacunacion, v.dosis, v.fecha_aplicacion,
              v.lote, v.proxima_dosis, v.observaciones,
              va.nombre AS vacuna,
              u.nombre AS registrado_por
       FROM vacunaciones v
       INNER JOIN vacunas va ON v.id_vacuna = va.id_vacuna
       LEFT JOIN usuarios u ON v.id_usuario = u.id_usuario
       WHERE v.id_paciente = $1
       ORDER BY v.fecha_aplicacion DESC`,
      [id]
    );

    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ mensaje: "Error al consultar historial" });
  }
};

// 6. Próximas dosis pendientes
const proximasDosis = async (req, res) => {
  try {
    const resultado = await db.query(
      `SELECT v.id_paciente, p.nombres, p.apellidos,
              va.nombre AS vacuna, v.dosis,
              v.proxima_dosis, v.lote
       FROM vacunaciones v
       INNER JOIN pacientes p ON v.id_paciente = p.id_paciente
       INNER JOIN vacunas va ON v.id_vacuna = va.id_vacuna
       WHERE v.proxima_dosis IS NOT NULL
         AND v.proxima_dosis >= CURRENT_DATE
         AND p.estado = 'activo'
       ORDER BY v.proxima_dosis ASC`
    );

    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({
      mensaje: "Error al consultar próximas dosis",
    });
  }
};

module.exports = {
  obtenerVacunas,
  crearVacuna,
  desactivarVacuna,
  registrarVacunacion,
  historialVacunacion,
  proximasDosis,
};