// src/Oportunidades/controllers/syncFromNeodata.post.js
import mongoose from 'mongoose';
import { Oportunidad } from '../model.opotunidad.js';
import { NeodataReporte } from '../model.neodata.js';
import { normalize, nameMatches } from '../utils/normalizeName.js';

const COLL_ES = { locale: 'es', strength: 1 }; // ignora mayúsculas/acentos

// ── Helpers ──────────────────────────────────────────────────────────────────
const normStr = (s='') => normalize(String(s || '').trim());

const normKey = (s='') =>
  String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

function pickFirstFuzzy(row = {}, aliases = []) {
  const table = new Map();
  for (const [k, v] of Object.entries(row)) table.set(normKey(k), v);
  for (const a of aliases) {
    const v = table.get(normKey(a));
    if (v !== undefined && v !== null) return String(v);
  }
  return '';
}

function safeEq(a, b) {
  if (a === b) return true;
  return String(a ?? '') === String(b ?? '');
}

// Aliases que sincronizamos
const F_PRECIO     = ['Precio lote','Precio Lote','PRECIO LOTE','Precio','Precio Total'];
const F_ADEUDO     = ['Adeudo capital','Adeudo Capital','ADEUDO CAPITAL','Adeudo'];
const F_SUPERFICIE = ['Superficie m²','Superficie m2','Superficie','SUPERFICIE'];
const F_ESCRIT     = ['Escriturado','ESCRITURADO','Estatus Escriturado'];
const F_ESTATUS    = ['Estatus cliente','Estatus Cliente','Estatus del cliente','Estatus','ESTATUS CLIENTE','ESTATUS'];
const F_NOMBRE     = ['Nombre cliente','Nombre Cliente','Nombre','Cliente','NOMBRE CLIENTE','NOMBRE'];

export async function syncFromNeodata(req, res) {
  try {
    // Parámetros
    const dryRun = String(req.body?.dryRun ?? 'true').toLowerCase() !== 'false'; // default true
    const force  = Boolean(req.body?.force);

    // 1) Cargar NEODATA (lo necesario)
    const neos = await NeodataReporte.find({}, {
      _id: 1, Lote: 1,
      'Nombre cliente': 1,
      'Estatus cliente': 1,
      'Precio lote': 1,
      'Adeudo capital': 1,
      'Superficie m²': 1,
      'Escriturado': 1,
    }).collation(COLL_ES).lean();

    const neodataCount = neos.length;

    // Guardas para evitar “barrida” con Neodata vacía/incompleta
    if (!force) {
      if (neodataCount === 0) {
        return res.status(409).json({ ok:false, reason:'NEODATA_VACIO_ABORT', hint:'Ejecuta tras el import completo o usa force:true' });
      }
      if (neodataCount < 100) {
        return res.status(409).json({ ok:false, reason:'NEODATA_BAJO_UMBRAL', count:neodataCount, hint:'Usa force:true si estás seguro' });
      }
    }

    // Índice por Lote normalizado
    const nx = new Map();
    for (const d of neos) {
      const key = normStr(d.Lote);
      if (key) nx.set(key, d);
    }

    // 2) Cargar OPORTUNIDADES (planas)
    const opps = await Oportunidad.find({}, {
      _id: 1,
      Lote: 1, lote: 1,                  // soporte a docs viejos (lote minúscula)
      'Nombre cliente': 1,
      'Estatus cliente': 1,
      'Precio lote': 1,
      'Adeudo capital': 1,
      'Superficie m²': 1,
      'Escriturado': 1,
      estatusNeodata: 1,
    }).lean();

    const toDelete = [];  // { _id, Lote, reason, ... }
    const toUpdate = [];  // { _id, set }

    for (const opp of opps) {
      const loteOpp = opp.Lote || opp.lote || '';
      const key = normStr(loteOpp);
      const nd  = key ? nx.get(key) : null;

      // 1) Si ya no existe en Neodata → eliminar
      if (!nd) {
        toDelete.push({ _id: opp._id, Lote: loteOpp, reason: 'MISSING_IN_NEODATA' });
        continue;
      }

      // 2) Estatus permitido (Venta/Liquidado)
      const estOri  = pickFirstFuzzy(nd, F_ESTATUS);
      const estNorm = normStr(estOri);
      const okStatus = (estNorm === 'venta' || estNorm === 'liquidado');
      if (!okStatus) {
        toDelete.push({ _id: opp._id, Lote: loteOpp, reason: 'STATUS_NOT_ALLOWED', estatus: estOri });
        continue;
      }

      // 3) Cambió propietario → eliminar
      const nameN = pickFirstFuzzy(nd,  F_NOMBRE);
      const nameO = pickFirstFuzzy(opp, F_NOMBRE);
      if (nameN && nameO && !nameMatches(nameO, nameN)) {
        toDelete.push({ _id: opp._id, Lote: loteOpp, reason: 'OWNER_CHANGED', before: nameO, now: nameN });
        continue;
      }

      // 4) Preparar $set SOLO para los campos sincronizables
      const set = {};

      const precioNew     = pickFirstFuzzy(nd, F_PRECIO);
      const adeudoNew     = pickFirstFuzzy(nd, F_ADEUDO);
      const supNew        = pickFirstFuzzy(nd, F_SUPERFICIE);
      const escritNew     = pickFirstFuzzy(nd, F_ESCRIT);
      const estatusNew    = pickFirstFuzzy(nd, F_ESTATUS);

      const precioCur     = pickFirstFuzzy(opp, F_PRECIO);
      const adeudoCur     = pickFirstFuzzy(opp, F_ADEUDO);
      const supCur        = pickFirstFuzzy(opp, F_SUPERFICIE);
      const escritCur     = pickFirstFuzzy(opp, F_ESCRIT);
      const estatusCur    = pickFirstFuzzy(opp, F_ESTATUS);

      if (!safeEq(precioCur,  precioNew))  set['Precio lote']   = precioNew;
      if (!safeEq(adeudoCur,  adeudoNew))  set['Adeudo capital']= adeudoNew;
      if (!safeEq(supCur,     supNew))     set['Superficie m²'] = supNew;
      if (!safeEq(escritCur,  escritNew))  set['Escriturado']   = escritNew;
      if (!safeEq(estatusCur, estatusNew)) set['Estatus cliente']= estatusNew;

      // Siempre reflejamos el estatus también en nuestro espejo simple
      if (!safeEq(opp.estatusNeodata, estOri)) set.estatusNeodata = estOri;

      // Corrige docs viejos: si no tienen "Lote" y sí "lote"
      if (!opp.Lote && opp.lote) set.Lote = opp.lote;

      if (Object.keys(set).length) {
        toUpdate.push({ _id: opp._id, set });
      }
    }

    if (dryRun) {
      return res.json({
        ok: true,
        dryRun: true,
        summary: {
          neodataCount,
          oportunidadesCount: opps.length,
          toDelete: toDelete.length,
          toUpdate: toUpdate.length,
        },
        toDelete: toDelete.slice(0, 50),
        toUpdate: toUpdate.slice(0, 50),
      });
    }

    // 5) Aplicar cambios (bulk)
    const ops = [];
    for (const u of toUpdate) {
      ops.push({ updateOne: {
        filter: { _id: new mongoose.Types.ObjectId(u._id) },
        update: { $set: u.set }
      }});
    }
    if (toDelete.length) {
      ops.push({ deleteMany: {
        filter: { _id: { $in: toDelete.map(x => new mongoose.Types.ObjectId(x._id)) } }
      }});
    }

    let bulkResult = null;
    if (ops.length) bulkResult = await Oportunidad.bulkWrite(ops, { ordered: false });

    return res.json({
      ok: true,
      dryRun: false,
      summary: {
        neodataCount,
        oportunidadesCount: opps.length,
        updated: toUpdate.length,
        deleted: toDelete.length,
      },
      bulkResult
    });

  } catch (e) {
    console.error('[syncFromNeodata] error', e);
    return res.status(500).json({ ok:false, reason:'ERROR_INTERNO' });
  }
}
