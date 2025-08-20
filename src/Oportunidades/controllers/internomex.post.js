// src/Oportunidades/controllers/internomex.post.js
import { Oportunidad } from '../model.opotunidad.js';
import { OportunidadInternomex } from '../model.oportunidadInternomex.js';

// helpers
const norm = (s = '') =>
  String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // sin acentos
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();

const pick = (obj = {}, keys = []) => {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return '';
};

// intenta leer "Lote" desde varias variantes
const readLote = (src = {}) => pick(src, [
  'Lote','lote','LOTE','Codigo','Código','CODIGO','Codigo Lote','Código Lote','CodigoLote','CódigoLote'
]);

export async function pedirAltaInternomex(req, res) {
  try {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ ok: false, reason: 'MISSING_ID' });

    // 1) Doc fuente
    const src = await Oportunidad.findById(id).lean();
    if (!src) return res.status(404).json({ ok: false, reason: 'NOT_FOUND' });

    const loteRaw = readLote(src);
    const loteHas = Boolean(String(loteRaw || '').trim());
    const lote = loteHas ? loteRaw : '';
    const neodataId = src.neodataId || null;

    // 2) Verificaciones de existencia en Internomex (en orden de “más seguro” a “más probable”)

    // 2.1) Ya se copió este mismo doc antes (mismo _id de origen)
    const alreadyByCopy = await OportunidadInternomex.findOne({ copiadoDe: src._id }).lean();
    if (alreadyByCopy) {
      return res.status(409).json({
        ok: false,
        reason: 'ALREADY_COPIED',
        newId: alreadyByCopy._id,
        lote: alreadyByCopy.Lote || alreadyByCopy.lote || ''
      });
    }

    // 2.2) Coincidencia por Lote (case/acentos-insensible usando collation)
    if (loteHas) {
      const byLote = await OportunidadInternomex.findOne({ Lote: lote })
        .collation({ locale: 'es', strength: 1 })
        .lean();
      if (byLote) {
        return res.status(409).json({
          ok: false,
          reason: 'ALREADY_EXISTS_LOTE',
          lote
        });
      }
      // también probamos si alguien lo guardó como 'lote' minúsculas
      const byLoteLower = await OportunidadInternomex.findOne({ lote: lote })
        .collation({ locale: 'es', strength: 1 })
        .lean();
      if (byLoteLower) {
        return res.status(409).json({
          ok: false,
          reason: 'ALREADY_EXISTS_LOTE',
          lote
        });
      }
    }

    // 2.3) Coincidencia por neodataId (si viene)
    if (neodataId) {
      const byNeodata = await OportunidadInternomex.findOne({ neodataId }).lean();
      if (byNeodata) {
        return res.status(409).json({
          ok: false,
          reason: 'ALREADY_EXISTS_NEODATA',
          neodataId: String(neodataId)
        });
      }
    }

    // 3) Construir copia 1:1 (sin _id)
    const copy = { ...src };
    delete copy._id;

    // metadatos de copia
    copy.copiadoDe = src._id;
    copy.copiadoEn = new Date();

    // asegurar que “Lote” quede en una sola llave coherente si venía vacío
    if (!copy.Lote && loteHas) copy.Lote = lote;

    // 4) Crear
    const created = await OportunidadInternomex.create(copy);

    return res.json({
      ok: true,
      newId: created._id,
      lote: copy.Lote || copy.lote || ''
    });
  } catch (e) {
    console.error('[pedirAltaInternomex] error:', e);

    // duplicado por índices únicos (puede venir de uniq_Lote_internomex o uniq_copiadoDe_internomex)
    if (e?.code === 11000) {
      const dupKey = Object.keys(e?.keyPattern || {})[0] || 'unknown';
      let reason = 'ALREADY_EXISTS';
      if (dupKey === 'copiadoDe') reason = 'ALREADY_COPIED';
      if (dupKey === 'Lote' || dupKey === 'lote') reason = 'ALREADY_EXISTS_LOTE';
      return res.status(409).json({ ok: false, reason });
    }

    return res.status(500).json({ ok: false, reason: 'SERVER_ERROR' });
  }
}
