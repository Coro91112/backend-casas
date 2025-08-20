import mongoose from 'mongoose';
import { OportunidadIntentoAlta } from '../model.oportunidadesIntentosDeAlta(1).js';

/* ===== helpers ===== */
const NAME_KEYS = ['Nombre cliente','Nombre Cliente','Nombre','Cliente','nombre','cliente'];

const norm = (s='') =>
  String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();

function pickFirstFuzzy(row = {}) {
  // raíz
  const root = new Map(Object.entries(row).map(([k,v]) => [norm(k), v]));
  for (const k of NAME_KEYS) {
    const v = root.get(norm(k));
    if (v != null && String(v).trim() !== '') return String(v);
  }
  // anidados más comunes
  for (const parent of ['solicitadoPor','solicitadorPor']) {
    const obj = row?.[parent];
    if (obj && typeof obj === 'object') {
      const m = new Map(Object.entries(obj).map(([k,v]) => [norm(k), v]));
      for (const k of NAME_KEYS) {
        const v = m.get(norm(k));
        if (v != null && String(v).trim() !== '') return String(v);
      }
    }
  }
  return '';
}

const safeStatus = (s) => {
  if (!s || /^pendiente(s)?$/i.test(s)) return 'Pendientes';
  if (/^aceptadas$/i.test(s)) return 'Aceptadas';
  if (/^rechazadas$/i.test(s)) return 'Rechazadas';
  return s;
};

function toPublic(it) {
  return {
    id: String(it._id),
    nombre: pickFirstFuzzy(it) || '',
    lote: it.Lote || '',
    gerente: it.GerenteDueno || '',
    intentaAlta: it.GerenteSolicita || '',
    estatus: safeStatus(it.estatus),
  };
}

/* ===== POST /debug/resolve  (body: { id? , lote? }) ===== */
export async function debugResolve(req, res) {
  try {
    const { id, lote } = req.body || {};
    if (!id && !lote) {
      return res.status(400).json({ ok:false, reason:'REQUIRE_ID_OR_LOTE' });
    }

    const filter = id
      ? { _id: new mongoose.Types.ObjectId(String(id)) }
      : { Lote: String(lote) };

    const doc = await OportunidadIntentoAlta.findOne(filter).lean();
    if (!doc) return res.status(404).json({ ok:false, reason:'NOT_FOUND' });

    return res.json({
      ok: true,
      item: toPublic(doc),
      raw: doc,               // ← para que veas el documento tal cual
      nameDebug: {
        picked: pickFirstFuzzy(doc),
        hasSolicitadoPor: !!doc?.solicitadoPor,
        hasSolicitadorPor: !!doc?.solicitadorPor
      }
    });
  } catch (e) {
    console.error('[debugResolve] ', e);
    res.status(500).json({ ok:false, reason:'SERVER_ERROR' });
  }
}

/* ===== POST /debug/list  (body: { status?, q? }) ===== */
export async function debugList(req, res) {
  try {
    let { status = 'Todas', q = '' } = req.body || {};
    status = String(status||'').trim();

    const and = [];
    // estatus tolerante
    if (status && status !== 'Todas') {
      if (/^pendientes$/i.test(status)) {
        and.push({
          $or: [
            { estatus: { $exists: false } },
            { estatus: { $regex: '^pendiente(s)?$', $options: 'i' } },
            { estatus: '' }
          ]
        });
      } else if (/^aceptadas$/i.test(status)) {
        and.push({ estatus: { $regex: '^aceptadas$', $options: 'i' } });
      } else if (/^rechazadas$/i.test(status)) {
        and.push({ estatus: { $regex: '^rechazadas$', $options: 'i' } });
      }
    }

    if (q && String(q).trim()) {
      const rx = new RegExp(String(q).trim(), 'i');
      and.push({ $or: [
        { Lote: rx },
        { GerenteDueno: rx },
        { GerenteSolicita: rx },
        { 'Nombre cliente': rx },
        { 'Nombre Cliente': rx },
        { 'Nombre': rx }, { 'nombre': rx },
        { 'Cliente': rx }, { 'cliente': rx },
        { 'solicitadoPor.Nombre cliente': rx },
        { 'solicitadoPor.Nombre Cliente': rx },
        { 'solicitadoPor.Nombre': rx }, { 'solicitadoPor.Cliente': rx },
        { 'solicitadorPor.Nombre cliente': rx },
        { 'solicitadorPor.Nombre Cliente': rx },
        { 'solicitadorPor.Nombre': rx }, { 'solicitadorPor.Cliente': rx },
      ]});
    }

    const where = and.length ? { $and: and } : {};

    const docs = await OportunidadIntentoAlta
      .find(where)
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    return res.json({
      ok:true,
      count: docs.length,
      items: docs.map(toPublic)
    });
  } catch (e) {
    console.error('[debugList] ', e);
    res.status(500).json({ ok:false, reason:'SERVER_ERROR' });
  }
}
