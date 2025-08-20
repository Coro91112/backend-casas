import mongoose from 'mongoose';
import { NeodataReporte } from '../model.neodata.js';
import { Oportunidad } from '../model.opotunidad.js';
import { OportunidadDesechada } from '../model.oportunidadDesechada.js';
import {
  resolveGerenciaFromUser, countTeamSize, countAssignedInGerencia,
  allocateByPerc
} from '../utils/reparto.helpers.js';

function pick(v, def='') { return (v===undefined||v===null)?def:v; }

async function fetchNeodataCandidatesByDesarrollo(desarrollo, limit) {
  const allowed = ['venta','liquidado'];
  const nd = await NeodataReporte.aggregate([
    { $match: { Desarrollo: desarrollo, 'Estatus cliente': { $exists: true } } },
    { $addFields: { e: { $toLower: { $trim: { input: '$Estatus cliente' } } } } },
    { $match: { e: { $in: allowed } } },
    { $project: { _id:1, Lote:1, doc:'$$ROOT' } },
  ]);

  const lotes = nd.map(x => String(x.Lote||'').trim()).filter(Boolean);
  if (!lotes.length) return [];

  const [opp, des] = await Promise.all([
    Oportunidad.find({ Lote: { $in: lotes } }).select({ Lote:1 }).lean(),
    OportunidadDesechada.find({ Lote: { $in: lotes } }).select({ Lote:1 }).lean()
  ]);
  const excl = new Set([
    ...opp.map(x => String(x.Lote||'').trim()),
    ...des.map(x => String(x.Lote||'').trim())
  ]);

  const elegibles = nd.filter(x => !excl.has(String(x.Lote||'').trim()));
  return elegibles.slice(0, limit);
}

async function fetchDesechadosByMonth(ym, limit) {
  const rows = await OportunidadDesechada.aggregate([
    { $addFields: { ym: { $dateToString: { format: '%Y-%m', date: '$createdAt' } } } },
    { $match: { ym } },
    { $limit: limit },
  ]);
  return rows;
}

export async function executeReparto(req, res) {
  const session = await mongoose.startSession();
  try {
    const { maxPerMember=0, source='NEODATA', payload={} } = req.body || {};
    const user = req.user || {};
    const gerencia = resolveGerenciaFromUser(user);

    const [teamSize, assigned] = await Promise.all([
      countTeamSize(gerencia),
      countAssignedInGerencia(gerencia)
    ]);
    const capacity = teamSize * Number(maxPerMember || 0);
    let owed = Math.max(0, capacity - assigned);
    if (owed === 0) return res.json({ ok:true, message:'SIN_DEUDA', created:0 });

    let creations = 0;
    const baseAsign = {
      etapa: 'lead',
      canal: 'REPARTO',
      subdirector: pick(user.subdirector || user.Subdirector || ''),
      gerente: gerencia,
      coordinador: pick(user.coordinador || user.Coordinador || ''),
      asesor: '',
      createdBy: { id: user?._id || null, nombre: user?.nombre || user?.NOMBRE || '' }
    };

    await session.withTransaction(async () => {
      if (source === 'NEODATA') {
        const list = (payload?.neodata || []).filter(x => x?.desarrollo && x?.pct>0);
        const alloc = allocateByPerc(owed, list.map(x => ({ key:x.desarrollo, pct:Number(x.pct) })));

        for (const { key:desarrollo, take } of alloc) {
          if (!take) continue;
          const cand = await fetchNeodataCandidatesByDesarrollo(desarrollo, take);
          for (const it of cand) {
            const doc = it.doc;
            const opp = {
              ...baseAsign,
              Lote: doc.Lote, lote: doc.Lote,
              neodataId: doc._id,
              estatusNeodata: doc['Estatus cliente'] || '',
              'Nombre cliente': doc['Nombre cliente'] || '',
              'Email': doc['Email'] || '',
              'Direccion': doc['Direccion'] || '',
              'Precio lote': doc['Precio lote'] || 0,
              'Adeudo capital': doc['Adeudo capital'] || 0,
              'Superficie m²': doc['Superficie m²'] || doc['Superficie m2'] || 0,
              'Escriturado': doc['Escriturado'] || ''
            };
            try {
              await Oportunidad.create([opp], { session });
              creations++; owed--;
              if (owed<=0) break;
            } catch (e) {
              if (e?.code !== 11000) throw e;
            }
          }
          if (owed<=0) break;
        }
      } else {
        const months = (payload?.months || []).filter(Boolean);
        const pct = 100 / (months.length || 1);
        const alloc = allocateByPerc(owed, months.map(m => ({ key:m, pct })));
        for (const { key:ym, take } of alloc) {
          if (!take) continue;
          const cand = await fetchDesechadosByMonth(ym, take);
          for (const it of cand) {
            const opp = {
              ...baseAsign,
              Lote: it.Lote || it.lote || '',
              lote: it.Lote || it.lote || '',
              estatusNeodata: '',
              'Nombre cliente': it['Nombre cliente'] || it.nombre || '',
              'Email': it['Email'] || it.correo || '',
              'Direccion': it['Direccion'] || it.direccion || '',
              'Precio lote': it['Precio lote'] || 0,
              'Adeudo capital': it['Adeudo capital'] || 0,
              'Superficie m²': it['Superficie m²'] || it['Superficie m2'] || 0,
              'Escriturado': it['Escriturado'] || ''
            };
            try {
              await Oportunidad.create([opp], { session });
              creations++; owed--;
              if (owed<=0) break;
            } catch (e) {
              if (e?.code !== 11000) throw e;
            }
          }
          if (owed<=0) break;
        }
      }
    });

    return res.json({ ok: true, created: creations, remainingDebt: Math.max(0, owed) });
  } catch (e) {
    console.error('[reparto/execute]', e);
    return res.status(500).json({ ok:false, reason:'ERROR_INTERNO' });
  } finally {
    session.endSession();
  }
}
