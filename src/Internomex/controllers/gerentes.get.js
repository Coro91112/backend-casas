// src/Internomex/controllers/gerentes.get.js
import { UsuarioActivo } from '../model.usuarioActivo.js';

// Normaliza string seguro
const norm = (v) => String(v || '').trim();

export async function listGerentes(req, res) {
  try {
    // Buscamos por cualquier campo común que pueda traer el rol/puesto
    const roleRegex = /gerente/i;

    const docs = await UsuarioActivo.find(
      {
        $or: [
          { rol:     roleRegex },
          { ROL:     roleRegex },
          { puesto:  roleRegex },
          { PUESTO:  roleRegex },
        ],
      },
      {
        NOMBRE: 1,
        nombre: 1,
        Name:   1,
        _id:    0,
      }
    ).lean();

    // Extraer el nombre sin duplicados
    const namesSet = new Set();
    for (const d of docs) {
      const name =
        norm(d.NOMBRE) ||
        norm(d.nombre) ||
        norm(d.Name);
      if (name) namesSet.add(name);
    }

    const gerentes = Array.from(namesSet).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
    return res.json({ ok: true, gerentes });
  } catch (err) {
    console.error('listGerentes error', err);
    return res.status(500).json({ ok: false, reason: 'SERVER_ERROR' });
  }
}
