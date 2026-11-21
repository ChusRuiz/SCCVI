const pool = require("../config/db");


const registrarControl = async (req, res) => {
  try {
    const {
      id_paciente,
      fecha_control,
      peso_kg,
      talla_cm,
      perimetro_cefalico_cm,
      observaciones,
    } = req.body;

    if (!id_paciente || !peso_kg || !talla_cm) {
      return res.status(400).json({
        mensaje: "Paciente, peso y talla son obligatorios",
      });
    }

    if (peso_kg <= 0 || talla_cm <= 0) {
      return res.status(400).json({
        mensaje: "El peso y la talla deben ser mayores a cero",
      });
    }

    if (
      perimetro_cefalico_cm !== undefined &&
      perimetro_cefalico_cm !== null &&
      perimetro_cefalico_cm !== "" &&
      perimetro_cefalico_cm <= 0
    ) {
      return res.status(400).json({
        mensaje: "El perímetro cefálico debe ser mayor a cero",
      });
    }

    const paciente = await pool.query(
      "SELECT id_paciente FROM pacientes WHERE id_paciente = $1 AND estado = 'activo'",
      [id_paciente]
    );

    if (paciente.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Paciente no encontrado o inactivo",
      });
    }

    const resultado = await pool.query(
      `INSERT INTO controles_crecimiento
      (id_paciente, id_usuario, fecha_control, peso_kg,
       talla_cm, perimetro_cefalico_cm, observaciones)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *`,
      [
        id_paciente,
        req.usuario.id,
        fecha_control || new Date().toISOString().slice(0, 10),
        peso_kg,
        talla_cm,
        perimetro_cefalico_cm || null,
        observaciones || null,
      ]
    );

    res.status(201).json({
      mensaje: "Control de crecimiento registrado",
      control: resultado.rows[0],
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      mensaje: "Error al registrar control de crecimiento",
    });
  }
};

// HISTORIAL DE CRECIMIENTO DE UN PACIENTE
const obtenerHistorial = async (req, res) => {
  try {
    const { id } = req.params;

    const resultado = await pool.query(
      `SELECT c.*, u.nombre AS usuario_registro
       FROM controles_crecimiento c
       LEFT JOIN usuarios u ON c.id_usuario = u.id_usuario
       WHERE c.id_paciente = $1
       ORDER BY c.fecha_control DESC, c.id_control DESC`,
      [id]
    );

    res.json(resultado.rows);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      mensaje: "Error al consultar historial de crecimiento",
    });
  }
};

// CONSULTAR UN CONTROL
const obtenerControl = async (req, res) => {
  try {
    const { id } = req.params;

    const resultado = await pool.query(
      `SELECT c.*, p.nombres, p.apellidos
       FROM controles_crecimiento c
       JOIN pacientes p ON c.id_paciente = p.id_paciente
       WHERE c.id_control = $1`,
      [id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Control no encontrado",
      });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      mensaje: "Error al consultar el control",
    });
  }
};

// ELIMINAR CONTROL
const eliminarControl = async (req, res) => {
  try {
    const { id } = req.params;

    const resultado = await pool.query(
      `DELETE FROM controles_crecimiento
       WHERE id_control = $1
       RETURNING id_control`,
      [id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Control no encontrado",
      });
    }

    res.json({
      mensaje: "Control eliminado correctamente",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      mensaje: "Error al eliminar el control",
    });
  }
};

module.exports = {
  registrarControl,
  obtenerHistorial,
  obtenerControl,
  eliminarControl,
};