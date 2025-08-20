import { Router } from 'express';
import { User } from './model.js';
import { normalizeRole } from './roles.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { correo, contrasena } = req.body;
  if (!correo || !contrasena) {
    return res.status(400).json({ error: 'Correo y contraseña requeridos' });
  }

  try {
    // Búsqueda case-insensitive y traemos contraseña para comprobar
    const user = await User
      .findOne({ correo: { $regex: `^${correo}$`, $options: 'i' } })
      .select('+contrasena');

    if (!user || user.contrasena !== contrasena) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Normalizamos rol
    const role = normalizeRole(user.rol);


    // Limpieza de salida (respetando tu toJSON)
    const json = user.toJSON();
    json.rol = role; // aseguramos rol normalizado

    return res.json({
      message: 'Login exitoso',
      user: json,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
