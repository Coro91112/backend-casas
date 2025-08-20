// src/Oportunidades/middleware/attachUser.js
import { User } from '../../Directorio/model.js';
import { normalizeRole } from '../../Directorio/roles.js';

export async function attachUser(req, _res, next) {
  try {
    // si ya viene desde otro middleware, no hacemos nada
    if (req.user) return next();

    const userId   = req.headers['x-user-id'] || req.query.userId;
    const userName = req.headers['x-user-name'] || req.headers['x-nombre'] || req.query.nombre || req.query.NOMBRE;
    const userRole = req.headers['x-user-role'] || req.headers['x-rol']    || req.query.rol    || req.query.ROL;

    // Preferimos ID -> buscamos en BD
    if (userId) {
      const u = await User.findById(userId).lean();
      if (u) {
        req.user = {
          ...u,
          // garantizamos rol normalizado (admin/subdirector/gerente/coordinador/asesor)
          rol: normalizeRole(u.rol || u.PUESTO || '')
        };
        return next();
      }
    }

    // Si no hay ID, pero sí nombre/rol, lo pasamos tal cual
    if (userName || userRole) {
      req.user = {
        nombre: String(userName || '').trim(),
        rol: normalizeRole(userRole || '')
      };
    }

    return next();
  } catch (e) {
    console.error('[attachUser] error', e);
    return next(); // que no bloquee la petición
  }
}
