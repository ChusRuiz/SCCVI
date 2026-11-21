const pool = require("../config/db");


const crearPaciente = async (req, res) => {
  try {
    const {
      nombres,
      apellidos,
      fecha_nacimiento,
      sexo,
      cui,
      nombre_encargado,
      telefono_encargado,
      direccion,
    } = req.body;

    if (
      !nombres ||
      !apellidos ||
      !fecha_nacimiento ||
      !sexo ||
      !nombre_encargado
    ) {
      return res.status(400).json({
        mensaje: "Completa los campos obligatorios",
      });
    }

    if (!["masculino", "femenino"].includes(sexo)) {
      return res.status(400).json({
        mensaje: "Sexo inválido",
      });
    }

    if (new Date(fecha_nacimiento) > new Date()) {
      return res.status(400).json({
        mensaje: "La fecha de nacimiento no puede ser futura",
      });
    }

    const resultado = await pool.query(
      `INSERT INTO pacientes
      (nombres, apellidos, fecha_nacimiento, sexo, cui,
       nombre_encargado, telefono_encargado, direccion)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *`,
      [
        nombres.trim(),
        apellidos.trim(),
        fecha_nacimiento,
            sexo,
        cui || null,
        nombre_encargado.trim(),
        telefono_encargado || null,
        direccion || null,
      ]
    );

    res.status(201).json({
      mensaje: "Paciente registrado correctamente",
      paciente: resultado.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        mensaje: "El CUI ya se encuentra registrado",
      });
    }

    console.error(error);

    res.status(500).json({
      mensaje: "Error al registrar paciente",
    });
  }
};

// LISTAR Y BUSCAR PACIENTES
const listarPacientes = async (req, res) => {
  try {
    const { buscar = "", estado = "activo" } = req.query;

    const resultado = await pool.query(
      `SELECT *
       FROM pacientes
       WHERE estado = $1
       AND (
         nombres ILIKE $2
         OR apellidos ILIKE $2
         OR COALESCE(cui, '') ILIKE $2
       )
       ORDER BY apellidos, nombres`,
      [estado, `%${buscar}%`]
    );

    res.json(resultado.rows);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      mensaje: "Error al consultar pacientes",
    });
  }
};

// CONSULTAR PACIENTE POR ID
const obtenerPaciente = async (req, res) => {
  try {
    const { id } = req.params;

    const resultado = await pool.query(
      "SELECT * FROM pacientes WHERE id_paciente = $1",
      [id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Paciente no encontrado",
      });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      mensaje: "Error al consultar paciente",
    });
  }
};

// ACTUALIZAR PACIENTE
const actualizarPaciente = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      nombres,
      apellidos,
      fecha_nacimiento,
      sexo,
      cui,
      nombre_encargado,
      telefono_encargado,
      direccion,
    } = req.body;

    if (
      !nombres ||
      !apellidos ||
      !fecha_nacimiento ||
      !sexo ||
      !nombre_encargado
    ) {
      return res.status(400).json({
        mensaje: "Completa los campos obligatorios",
      });
    }

    const resultado = await pool.query(
      `UPDATE pacientes
       SET nombres = $1,
           apellidos = $2,
           fecha_nacimiento = $3,
           sexo = $4,
           cui = $5,
           nombre_encargado = $6,
           telefono_encargado = $7,
           direccion = $8
       WHERE id_paciente = $9
       RETURNING *`,
      [
        nombres.trim(),
        apellidos.trim(),
        fecha_nacimiento,
        sexo,
        cui || null,
        nombre_encargado.trim(),
        telefono_encargado || null,
        direccion || null,
        id,
      ]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Paciente no encontrado",
      });
    }

    res.json({
      mensaje: "Paciente actualizado correctamente",
      paciente: resultado.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        mensaje: "El CUI ya está registrado",
      });
    }

    console.error(error);

    res.status(500).json({
      mensaje: "Error al actualizar paciente",
    });
  }
};

// DESACTIVAR PACIENTE
const desactivarPaciente = async (req, res) => {
  try {
    const { id } = req.params;

    const resultado = await pool.query(
      `UPDATE pacientes
       SET estado = 'inactivo'
       WHERE id_paciente = $1
       RETURNING *`,
      [id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Paciente no encontrado",
      });
    }

    res.json({
      mensaje: "Paciente desactivado correctamente",
      paciente: resultado.rows[0],
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      mensaje: "Error al desactivar paciente",
    });
  }
};

module.exports = {
  crearPaciente,
  listarPacientes,
  obtenerPaciente,
  actualizarPaciente,
  desactivarPaciente,
};