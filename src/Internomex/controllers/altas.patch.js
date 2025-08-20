// src/Internomex/controllers/altas.patch.js
import { AltaInternomex } from '../model.altaInternomex.js';

function getUserName(req) {
  // saca un nombre legible de req.user si existe
  const u = req.user || {};
  return u.nombre || u.name || u.correo || u.email || String(u._id || '');
}

export async function aceptarAlta(req, res) {
  try {
    const { id } = req.params;
    const updated = await AltaInternomex.findByIdAndUpdate(
      id,
      {
        $set: {
          estatus: 'Aceptadas',              // 👈 EXACTO como lo filtras
          motivoRechazo: '',
          acceptedAt: new Date(),
          acceptedBy: getUserName(req),
          rejectedAt: null,
          rejectedBy: ''
        }
      },
      { new: true }
    ).lean();

    if (!updated) return res.status(404).json({ ok: false, reason: 'NOT_FOUND' });
    return res.json({ ok: true, item: updated });
  } catch (err) {
    console.error('aceptarAlta error', err);
    return res.status(500).json({ ok: false, reason: 'SERVER_ERROR' });
  }
}

export async function rechazarAlta(req, res) {
  try {
    const { id } = req.params;
    const motivo = String(req.body?.motivo || '').trim();
    if (!motivo) return res.status(400).json({ ok: false, reason: 'MISSING_MOTIVO' });

    const updated = await AltaInternomex.findByIdAndUpdate(
      id,
      {
        $set: {
          estatus: 'Rechazadas',             // 👈 EXACTO
          motivoRechazo: motivo,
          rejectedAt: new Date(),
          rejectedBy: getUserName(req),
          acceptedAt: null,
          acceptedBy: ''
        }
      },
      { new: true }
    ).lean();

    if (!updated) return res.status(404).json({ ok: false, reason: 'NOT_FOUND' });
    return res.json({ ok: true, item: updated });
  } catch (err) {
    console.error('rechazarAlta error', err);
    return res.status(500).json({ ok: false, reason: 'SERVER_ERROR' });
  }
}

export async function compartirAlta(req, res) {
  try {
    const { id } = req.params;
    const { gerente } = req.body || {};
    const nombre = String(gerente || '').trim();
    if (!nombre) return res.status(400).json({ ok: false, reason: 'MISSING_GERENTE' });

    const doc = await AltaInternomex.findByIdAndUpdate(
      id,
      { $addToSet: { gerentes: nombre } },  // agrega sin duplicar
      { new: true }
    ).lean();

    if (!doc) return res.status(404).json({ ok: false, reason: 'NOT_FOUND' });
    res.json({ ok: true, item: doc });
  } catch (err) {
    console.error('compartirAlta error', err);
    res.status(500).json({ ok: false, reason: 'SERVER_ERROR' });
  }
}
