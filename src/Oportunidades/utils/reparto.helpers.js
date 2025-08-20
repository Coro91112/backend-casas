import { NeodataReporte } from '../model.neodata.js';
import { Oportunidad } from '../model.opotunidad.js';
import { OportunidadDesechada } from '../model.oportunidadDesechada.js';
import { UsuariosActivos } from '../model.usuariosActivos.js';

export function norm(s='') {
  return String(s).normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().trim();
}

// Resuelve el “nombre gerencia” del usuario logueado
export function resolveGerenciaFromUser(user = {}) {
  const role = norm(user.rol || user.ROL || user.role || '');
  const nombre = (user.nombre || user.NOMBRE || '').trim();
  const gerenteCampo = (user.gerente || user.Gerente || user.gerencia || user.Gerencia || '').trim();

  if (role === 'gerente') return nombre || gerenteCampo;
  if (gerenteCampo) return gerenteCampo;
  return '';
}

// Tamaño del equipo (solo coordinadores + asesores) en esa gerencia (rol/ROL y gerencia/Gerencia)
export async function countTeamSize(gerenciaName='') {
  if (!gerenciaName) return 0;
  const rolesLower = ['coordinador','asesor'];
  const rolesUpper = rolesLower.map(r => r.toUpperCase());

  const rolMatch = {
    $or: [
      { rol: { $in: rolesLower } },
      { ROL: { $in: rolesUpper } },
    ]
  };
  const gerMatch = {
    $or: [
      { gerencia: { $regex: `^\\s*${gerenciaName}\\s*$`, $options: 'i' } },
      { Gerencia: { $regex: `^\\s*${gerenciaName}\\s*$`, $options: 'i' } },
    ]
  };

  return await UsuariosActivos.countDocuments({ ...rolMatch, ...gerMatch });
}

// Oportunidades ya asignadas a esa gerencia
export async function countAssignedInGerencia(gerenciaName='') {
  if (!gerenciaName) return 0;
  return await Oportunidad.countDocuments({
    $or: [
      { gerente:  { $regex: `^\\s*${gerenciaName}\\s*$`, $options: 'i' } },
      { gerente1: { $regex: `^\\s*${gerenciaName}\\s*$`, $options: 'i' } }
    ]
  });
}

// Desarrollos únicos desde NeodataReporte
export async function getUniqueDesarrollos() {
  const rows = await NeodataReporte.aggregate([
    { $match: { Desarrollo: { $exists: true, $ne: '' } } },
    { $group: { _id: '$Desarrollo' } },
    { $project: { _id: 0, desarrollo: '$_id' } },
    { $sort: { desarrollo: 1 } }
  ]);
  return rows.map(r => r.desarrollo);
}

// Meses disponibles en OportunidadesDesechados (por createdAt)
export async function getDesechadosMonths() {
  const rows = await OportunidadDesechada.aggregate([
    { $group: { _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } } } },
    { $project: { y: '$_id.y', m: '$_id.m', _id: 0 } },
    { $sort: { y: -1, m: -1 } }
  ]);
  return rows.map(({y,m}) => `${y}-${String(m).padStart(2,'0')}`);
}

// Conteo disponible para NEODATA por desarrollo (elegibles)
export async function countNeodataDisponibles(desarrollos=[]) {
  if (!desarrollos.length) return { total:0, breakdown:{} };
  const allowed = ['venta','liquidado'];

  const base = await NeodataReporte.find({
    Desarrollo: { $in: desarrollos },
    $expr: {
      $in: [
        { $toLower: { $trim: { input: '$Estatus cliente' } } },
        allowed
      ]
    }
  }).select({ _id:1, Lote:1, Desarrollo:1, 'Estatus cliente':1 }).lean();

  const lotes = base.map(d => String(d.Lote || '').trim()).filter(Boolean);
  if (!lotes.length) return { total:0, breakdown:{} };

  const [yaOpp, yaDesech] = await Promise.all([
    Oportunidad.find({ Lote: { $in: lotes } }).select({ Lote:1 }).lean(),
    OportunidadDesechada.find({ Lote: { $in: lotes } }).select({ Lote:1 }).lean(),
  ]);

  const excl = new Set([
    ...yaOpp.map(x => String(x.Lote||'').trim()),
    ...yaDesech.map(x => String(x.Lote||'').trim())
  ]);

  const elegibles = base.filter(d => !excl.has(String(d.Lote||'').trim()));
  const breakdown = {};
  for (const d of elegibles) {
    const k = d.Desarrollo || '—';
    breakdown[k] = (breakdown[k] || 0) + 1;
  }
  const total = elegibles.length;
  return { total, breakdown };
}

// Conteo disponible para DESECHADOS por meses YYYY-MM
export async function countDesechadosDisponibles(months=[]) {
  if (!months.length) return { total:0, breakdown:{} };
  const rows = await OportunidadDesechada.aggregate([
    { $addFields: { ym: { $dateToString: { format: '%Y-%m', date: '$createdAt' } } } },
    { $match: { ym: { $in: months } } },
    { $group: { _id: '$ym', c: { $sum: 1 } } },
    { $project: { _id: 0, ym: '$_id', c: 1 } },
    { $sort: { ym: 1 } }
  ]);
  const breakdown = {};
  let total = 0;
  for (const r of rows) { breakdown[r.ym] = r.c; total += r.c; }
  return { total, breakdown };
}

// Redondeo de porcentajes que suma exacto a N
export function allocateByPerc(total, items /* [{key, pct}] */) {
  const raw = items.map(it => ({ key: it.key, pct: it.pct, val: total * (it.pct/100) }));
  let floored = raw.map(r => ({ ...r, take: Math.floor(r.val) }));
  let used = floored.reduce((a,b)=>a+b.take,0);
  let rem = total - used;
  const byFrac = [...raw].sort((a,b)=> (b.val - Math.floor(b.val)) - (a.val - Math.floor(a.val)));
  for (let i=0; i<byFrac.length && rem>0; i++) {
    const k = byFrac[i].key;
    const idx = floored.findIndex(x => x.key===k);
    floored[idx].take += 1;
    rem--;
  }
  return floored.map(x => ({ key: x.key, take: x.take }));
}
