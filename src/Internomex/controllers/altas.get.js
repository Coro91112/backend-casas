// src/Internomex/controllers/altas.get.js
import { AltaInternomex } from '../model.altaInternomex.js';

const COLL_ES2 = { locale: 'es', strength: 1 };

function resolveBossName(user, type) { /* igual que ya tienes */ }
function buildOwnershipFilter(user) { /* igual que ya tienes */ }

export async function listAltasInternomex(req, res) {
  try {
    const { status = 'Todas', q = '' } = req.query || {};
    const and = [];

    const scope = buildOwnershipFilter(req.user);
    if (scope && Object.keys(scope).length) and.push(scope);

    if (status && status !== 'Todas') {
      if (status === 'Pendientes') {
        and.push({ $or: [ { estatus: { $exists: false } }, { estatus: 'Pendientes' } ] });
      } else {
        and.push({ estatus: status });
      }
    }

    if (q) {
      const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      and.push({ Lote: { $regex: safe, $options: 'i' } });
    }

    const query = and.length ? { $and: and } : {};

    const items = await AltaInternomex.find(query)
      .collation(COLL_ES2)
      .sort({ createdAt: -1 })
      .lean();

    res.json({ ok: true, items });
  } catch (err) {
    console.error('listAltasInternomex error', err);
    res.status(500).json({ ok: false, reason: 'SERVER_ERROR' });
  }
}

export async function getAlta(req, res) {
  try {
    const { id } = req.params;
    const item = await AltaInternomex.findById(id).lean();
    if (!item) return res.status(404).json({ ok: false, reason: 'NOT_FOUND' });
    return res.json({ ok: true, item });
  } catch (err) {
    console.error('getAlta error', err);
    return res.status(500).json({ ok: false, reason: 'SERVER_ERROR' });
  }
}
