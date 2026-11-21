const readline = require("readline");
const bcrypt = require("bcrypt");
const pool = require("../config/db");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const preguntar = (texto) =>
  new Promise((resolve) => rl.question(texto, resolve));

async function crearAdministrador() {
  try {
    const nombre = await preguntar("Nombre del administrador: ");
    const correo = await preguntar("Correo: ");
    const password = await preguntar("Contraseña: ");

    const existe = await pool.query(
      "SELECT id_usuario FROM usuarios WHERE correo = $1",
      [correo]
    );

    if (existe.rows.length > 0) {
      console.log("Este correo ya está registrado.");
      return;
    }

    const hash = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO usuarios (nombre, correo, password, rol)
       VALUES ($1, $2, $3, 'admin')`,
      [nombre, correo, hash]
    );

    console.log("\nAdministrador creado correctamente.");
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    rl.close();
    await pool.end();
  }
}

crearAdministrador();