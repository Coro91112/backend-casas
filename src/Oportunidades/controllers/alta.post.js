// src/Oportunidades/controllers/alta.post.js
import { NeodataReporte } from '../model.neodata.js';
import { normalize, nameMatches } from '../utils/normalizeName.js';
import { Oportunidad } from '../model.opotunidad.js';

const COLL_ES = { locale: 'es', strength: 1 }; // ignora mayúsculas/acentos en collation
const CANAL_REUB = 'ALTA REUBICACION';

function escapeRegex(str = '') {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* ================= Helpers ================= */
const normKey = (s='') =>
  String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

function pickFirstFuzzy(row = {}, candidateKeys = []) {
  const table = new Map();
  for (const [k, v] of Object.entries(row)) table.set(normKey(k), v);
  for (const k of candidateKeys) {
    const v = table.get(normKey(k));
    if (v !== undefined && v !== null) {
      const s = String(v).trim();
      if (s) return s;
    }
  }
  return '';
}

/** Mongo no permite '.' ni '$' en nombres de llaves. Reemplazamos:
 * '.' → '·' (middle dot), '$' → '＄' (fullwidth dollar)
 */
function sanitizeKeys(input) {
  if (Array.isArray(input)) return input.map(sanitizeKeys);
  if (input && typeof input === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(input)) {
      const safeKey = String(k).replace(/\./g, '·').replace(/\$/g, '＄');
      out[safeKey] = sanitizeKeys(v);
    }
    return out;
  }
  return input;
}

/* ===== Búsqueda robusta por Lote (usa inputs SOLO para empatar) ===== */
async function findNeodataByLote(loteInput) {
  const raw = String(loteInput || '').trim();
  if (!raw) return null;

  // 1) igualdad con collation
  let doc = await NeodataReporte.findOne({ Lote: raw })
    .collation(COLL_ES)
    .lean();
  if (doc) return doc;

  // 2) regex exacta tolerando espacios múltiples
  const esc = escapeRegex(raw).replace(/\s+/g, '\\s+');
  doc = await NeodataReporte.findOne({
    Lote: { $regex: `^${esc}$`, $options: 'i' }
  }).lean();
  if (doc) return doc;

  // 3) candidatos por prefijo y comparar normalizado
  const head = raw.slice(0, 12);
  const candidates = await NeodataReporte.find({
    Lote: { $regex: escapeRegex(head), $options: 'i' }
  }).limit(300).lean();

  const target = normalize(raw);
  return candidates.find(d => normalize(String(d.Lote || '')) === target) || null;
}

/* ================= Controller: Alta “normal” ================= */
export async function pedirAlta(req, res) {
  try {
    const {
      lote,
      nombre,            // SOLO para validar contra Neodata
      canal = '',
      subdirector = '',
      gerente = '',
      coordinador = '',
      asesor = '',
    } = req.body || {};

    // Requeridos mínimos
    const requeridos = { lote, nombre, canal, subdirector, gerente, coordinador, asesor };
    for (const [k, v] of Object.entries(requeridos)) {
      if (!String(v ?? '').trim()) {
        return res.status(400).json({ ok: false, reason: 'FALTAN_CAMPOS', campo: k });
      }
    }

    // 1) Empatar Lote en Neodata
    const doc = await findNeodataByLote(lote);
    if (!doc) {
      return res.json({ ok: false, reason: 'LOTE_NO_EXISTE', lote: String(lote || '') });
    }

    // 2) Validar nombre si Neodata trae nombre
    const nombreCliente = pickFirstFuzzy(doc, [
      'Nombre cliente','Nombre Cliente','Nombre','Cliente','NOMBRE CLIENTE','NOMBRE'
    ]);
    if (nombreCliente && !nameMatches(nombre, nombreCliente)) {
      return res.json({
        ok: false,
        reason: 'NOMBRE_NO_COINCIDE',
        lote: doc.Lote,
        esperado: nombreCliente
      });
    }

    // 3) Validar estatus permitido
    const estatusOriginal = pickFirstFuzzy(doc, [
      'Estatus cliente','Estatus Cliente','Estatus del cliente','Estatus','ESTATUS CLIENTE','ESTATUS'
    ]);
    const estatusNorm = normalize(estatusOriginal);
    const permitido = estatusNorm === 'venta' || estatusNorm === 'liquidado';
    if (!permitido) {
      if (estatusNorm.includes('juridico') || estatusNorm.includes('jurídico')) {
        return res.json({ ok: false, reason: 'LOTE_EN_JURIDICO', lote: doc.Lote });
      }
      return res.json({ ok: false, reason: 'ESTATUS_NO_PERMITE_ALTA', lote: doc.Lote });
    }

    // 4) ¿Ya existe oportunidad por este Lote?
    const esc = escapeRegex(String(doc.Lote || '').trim()).replace(/\s+/g, '\\s+');
    const exists = await Oportunidad.findOne({
      $or: [
        { Lote: doc.Lote },
        { lote: doc.Lote }, // legacy
        { Lote: { $regex: `^\\s*${esc}\\s*$`, $options: 'i' } },
        { lote: { $regex: `^\\s*${esc}\\s*$`, $options: 'i' } },
      ]
    })
    .collation(COLL_ES)
    .select({ _id: 1, Lote: 1, lote: 1, subdirector: 1, gerente: 1, coordinador: 1, asesor: 1 })
    .lean();

    if (exists) {
      return res.json({
        ok: false,
        reason: 'OPORTUNIDAD_YA_EXISTE',
        opportunityId: exists._id,
        lote: exists.Lote || exists.lote || doc.Lote,
        asignadoA: {
          subdirector: exists.subdirector || '',
          gerente:     exists.gerente || '',
          coordinador: exists.coordinador || '',
          asesor:      exists.asesor || '',
        }
      });
    }

    // 5) Copia PLANA de Neodata (sanitizada) + extras
    const flatCsv = sanitizeKeys(doc);
    delete flatCsv._id;

    const payload = {
      ...flatCsv,
      Lote: doc.Lote,
      lote: doc.Lote,

      etapa: 'lead',
      canal,
      subdirector,
      gerente,
      coordinador,
      asesor,
      neodataId: doc._id,
      estatusNeodata: estatusOriginal || '',
      createdBy: {
        id: req.user?._id || null,
        nombre: (req.user?.nombre || req.user?.NOMBRE || '').trim(),
      },
    };

    // 6) Insertar
    let opp;
    try {
      opp = await Oportunidad.create(payload);
    } catch (e) {
      if (e?.code === 11000) {
        const dup = await Oportunidad.findOne({
          $or: [{ Lote: doc.Lote }, { lote: doc.Lote }]
        }).lean();
        return res.json({
          ok: false,
          reason: 'OPORTUNIDAD_YA_EXISTE',
          opportunityId: dup?._id,
          lote: dup?.Lote || dup?.lote || doc.Lote,
        });
      }
      throw e;
    }

    // 7) Respuesta (detalles para modal)
    const telefono   = pickFirstFuzzy(doc, ['telefono','Telefono','Teléfono','TELÉFONO','TELEFONO','Tel','Teléfono 1','Telefono 1']);
    const correo     = pickFirstFuzzy(doc, ['Email','email','correo','Correo','EMAIL','CORREO']);
    const direccion  = pickFirstFuzzy(doc, ['Direccion','Dirección','DIRECCION','DIRECCIÓN','Domicilio']);
    const precio     = pickFirstFuzzy(doc, ['Precio lote','Precio Lote','PRECIO LOTE','Precio','Precio Total']) || null;
    const adeudo     = pickFirstFuzzy(doc, ['Adeudo capital','Adeudo Capital','ADEUDO CAPITAL','Adeudo']) || null;
    const superficie = pickFirstFuzzy(doc, ['Superficie m²','Superficie m2','Superficie','SUPERFICIE']) || null;
    const escriturado= pickFirstFuzzy(doc, ['Escriturado','ESCRITURADO','Estatus Escriturado']) || '';

    return res.json({
      ok: true,
      message: 'ALTA_ASIGNADA',
      opportunityId: opp._id,
      lote: doc.Lote,
      nombre: nombreCliente || '',
      detalles: { telefono, correo, precio, adeudo, superficie, escriturado, direccion }
    });

  } catch (err) {
    console.error('[PedirAlta] Error inesperado:', err);
    return res.status(500).json({ ok:false, reason:'ERROR_INTERNO' });
  }
}

/* ================= Controller: Alta REUBICACIÓN ================= */
export async function pedirAltaReubicacion(req, res) {
  try {
    const {
      lote = '',
      nombre = '',
      subdirector = '',
      gerente = '',
      coordinador = '',
      asesor = '',
    } = req.body || {};

    // requeridos (canal es fijo)
    const requeridos = { lote, nombre, subdirector, gerente, coordinador, asesor };
    for (const [k, v] of Object.entries(requeridos)) {
      if (!String(v ?? '').trim()) {
        return res.status(400).json({ ok: false, reason: 'FALTAN_CAMPOS', campo: k });
      }
    }

    // 1) NO debe existir en Neodata
    const nd = await findNeodataByLote(lote);
    if (nd) {
      return res.json({ ok: false, reason: 'NEODATA_EXISTE', lote: nd.Lote });
    }

    // 2) ¿Ya existe oportunidad con ese Lote?
    const esc = escapeRegex(String(lote).trim()).replace(/\s+/g, '\\s+');
    const exists = await Oportunidad.findOne({
      $or: [
        { Lote: lote },
        { lote: lote },
        { Lote: { $regex: `^\\s*${esc}\\s*$`, $options: 'i' } },
        { lote: { $regex: `^\\s*${esc}\\s*$`, $options: 'i' } },
      ]
    })
    .collation(COLL_ES)
    .select({ _id: 1, Lote: 1, lote: 1, subdirector: 1, gerente: 1, coordinador: 1, asesor: 1 })
    .lean();

    if (exists) {
      return res.json({
        ok: false,
        reason: 'OPORTUNIDAD_YA_EXISTE',
        opportunityId: exists._id,
        lote: exists.Lote || exists.lote || lote,
        asignadoA: {
          subdirector: exists.subdirector || '',
          gerente:     exists.gerente || '',
          coordinador: exists.coordinador || '',
          asesor:      exists.asesor || '',
        }
      });
    }

    // 3) Crear oportunidad "en blanco" (para que después se sincronice al importar Neodata)
    const payload = {
      // espejo/clave
      Lote: lote,
      lote: lote,
      // mínimos
      etapa: 'lead',
      canal: CANAL_REUB,
      subdirector, gerente, coordinador, asesor,
      neodataId: null,
      estatusNeodata: '',
      createdBy: {
        id: req.user?._id || null,
        nombre: (req.user?.nombre || req.user?.NOMBRE || '').trim(),
      },
      // campos de contacto y valores por default
      'Teléfono': '',
      'Email': '',
      'Dirección': '',
      'Precio lote': 0,
      'Adeudo capital': 0,
      'Superficie m2': 0,
      'Escriturado': '',
      // nombre del cliente (guardamos en una de las variantes usadas)
      'Nombre cliente': nombre
    };

    let opp;
    try {
      opp = await Oportunidad.create(payload);
    } catch (e) {
      if (e?.code === 11000) {
        const dup = await Oportunidad.findOne({
          $or: [{ Lote: lote }, { lote }]
        }).lean();
        return res.json({
          ok: false,
          reason: 'OPORTUNIDAD_YA_EXISTE',
          opportunityId: dup?._id,
          lote: dup?.Lote || dup?.lote || lote,
        });
      }
      throw e;
    }

    // 4) Responder con estructura igual a la alta normal (detalles "vacíos")
    return res.json({
      ok: true,
      message: 'ALTA_REUBICACION_ASIGNADA',
      opportunityId: opp._id,
      lote,
      nombre,
      detalles: {
        telefono: '',
        correo: '',
        precio: 0,
        adeudo: 0,
        superficie: 0,
        escriturado: '',
        direccion: ''
      }
    });
  } catch (err) {
    console.error('[PedirAltaReubicacion] Error inesperado:', err);
    return res.status(500).json({ ok:false, reason:'ERROR_INTERNO' });
  }
}
