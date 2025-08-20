// src/Oportunidades/controllers/directorio.get.js
import { UsuariosActivos } from '../model.usuariosActivos.js';
import { nameMatches as nmMatches } from '../utils/normalizeName.js'; // ← usa tu util

const F = {
  nombre:   ['nombre', 'NOMBRE'],
  rol:      ['rol', 'ROL', 'PUESTO'],
  subdir:   ['subdireccion', 'Subdireccion', 'subdirección', 'SUBDIRECCION'],
  gerencia: ['gerencia', 'Gerencia', 'GERENCIA'],
  coord:    ['coordinador', 'Coordinador', 'COORDINADOR'],
};

const sel = [
  'nombre','NOMBRE',
  'rol','ROL','PUESTO',
  'subdireccion','Subdireccion','subdirección','SUBDIRECCION',
  'gerencia','Gerencia','GERENCIA',
  'coordinador','Coordinador','COORDINADOR'
].join(' ');

const escapeRegex = (s='') => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const pickFirst = (doc, keys) => {
  for (const k of keys) {
    const v = doc?.[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
};

const ROLE_ALIASES = {
  Subdirector: ['Subdirector'],
  Gerente:     ['Gerente'],
  Coordinador: ['Coordinador'],
  Asesor:      ['Asesor', 'Vendedor'],
};

const qRoleCIAny = (roleNames=[]) => ({
  $or: roleNames.flatMap(r =>
    F.rol.map(k => ({ [k]: { $regex: `^${escapeRegex(r)}$`, $options: 'i' } }))
  )
});

function norm(str='') {
  return String(str).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

// separa "A, B ; C / D" -> ['A','B','C','D']
function splitPeopleList(s='') {
  return String(s)
    .split(/[,;\/\n]+/)
    .map(t => t.trim())
    .filter(Boolean);
}

// match difuso entre cadenas que pueden traer varias personas
function multiNameMatch(a='', b='') {
  const A = splitPeopleList(a);
  const B = splitPeopleList(b);
  if (!A.length && !B.length) return false;

  const listA = A.length ? A : [a];
  const listB = B.length ? B : [b];

  // match si CUALQUIER par (a,b) coincide en ambos sentidos (prefijos, sin acentos, etc.)
  for (const x of listA) {
    for (const y of listB) {
      if (nmMatches(x, y) || nmMatches(y, x)) return true;
    }
  }
  return false;
}

async function namesByRole(role, extra = {}) {
  const roles = ROLE_ALIASES[role] || [role];

  // 1) Traemos SOLO por rol (rápido; miles ok)
  const q = { $and: [ qRoleCIAny(roles) ] };
  const docs = await UsuariosActivos.find(q).select(sel).lean();

  // 2) Filtro en memoria por subcadena/fuzzy en subdir/gerente/coord
  const filtered = docs.filter(d => {
    if (extra.subdir) {
      const dSub = pickFirst(d, F.subdir);
      if (!multiNameMatch(extra.subdir, dSub)) return false;
    }
    if (extra.gerente) {
      const dGer = pickFirst(d, F.gerencia);
      if (!multiNameMatch(extra.gerente, dGer)) return false;
    }
    if (extra.coord) {
      const dCo = pickFirst(d, F.coord);
      if (!multiNameMatch(extra.coord, dCo)) return false;
    }
    return true;
  });

  const set = new Set(filtered.map(d => pickFirst(d, F.nombre)).filter(Boolean));
  return [...set].sort((a,b)=>a.localeCompare(b,'es',{sensitivity:'base'}));
}

async function getChainFor(userName) {
  // Para identificar al usuario que inició sesión sí conviene igualdad 1:1 (pero tolerante)
  const me = await UsuariosActivos.findOne({
    $or: F.nombre.map(k => ({ [k]: { $regex: `^${escapeRegex(userName)}$`, $options: 'i' } }))
  }).select(sel).lean();

  return {
    subdirector: pickFirst(me, F.subdir),
    gerente:     pickFirst(me, F.gerencia),   // puede venir "G1, G2"
    coordinador: pickFirst(me, F.coord),
  };
}

/**
 * GET /Oportunidades/directorio/opciones
 */
export async function directorioOpciones(req, res) {
  try {
    const nombre = (req.user?.nombre || req.user?.NOMBRE || '').trim();
    const role   = norm(req.user?.rol || req.user?.ROL || 'admin');

    // Filtros de cascada del front
    const qSub   = (req.query?.subdirector || '').trim();
    const qGer   = (req.query?.gerente || '').trim();
    const qCoord = (req.query?.coordinador || '').trim();

    const fixed = {};
    let options = { subdirectores: [], gerentes: [], coordinadores: [], asesores: [] };

    const isAsistenteSubdir  = role.includes('asistente') && role.includes('subdirector');
    const isAsistenteGerente = role === 'asistente' || (role.includes('asistente') && role.includes('gerente'));

    if (role === 'admin') {
      options.subdirectores = await namesByRole('Subdirector');
      options.gerentes      = await namesByRole('Gerente',     qSub   ? { subdir: qSub } : {});
      options.coordinadores = await namesByRole('Coordinador', qGer   ? { gerente: qGer } : {});
      options.asesores      = await namesByRole('Asesor',      qCoord ? { coord: qCoord } : {});
    }

    // Subdirector y Asistente de Subdirector
    else if (role === 'subdirector' || isAsistenteSubdir) {
      const chain = await getChainFor(nombre);
      const sub   = chain.subdirector || pickFirst(req.user, F.subdir) || nombre;

      fixed.subdirector = sub;
      options.gerentes  = await namesByRole('Gerente', { subdir: sub });

      options.coordinadores = qGer
        ? await namesByRole('Coordinador', { gerente: qGer })
        : await namesByRole('Coordinador', { subdir: sub });

      options.asesores = qCoord
        ? await namesByRole('Asesor', { coord: qCoord })
        : await namesByRole('Asesor', { subdir: sub });
    }

    // Gerente y Asistente (de Gerente) — soporta múltiples gerencias
    else if (role === 'gerente' || isAsistenteGerente) {
      const chain   = await getChainFor(nombre);
      const rawGer  = chain.gerente || pickFirst(req.user, F.gerencia) || '';
      const gerList = splitPeopleList(rawGer);
      const sub     = chain.subdirector || pickFirst(req.user, F.subdir) || '';

      if (sub) fixed.subdirector = sub;

      if (gerList.length <= 1) {
        const ger = gerList[0] || nombre;
        fixed.gerente = ger;

        options.coordinadores = await namesByRole('Coordinador', { gerente: ger });
        options.asesores      = qCoord
          ? await namesByRole('Asesor', { coord: qCoord })
          : await namesByRole('Asesor', { gerente: ger });

      } else {
        // 2+ gerentes -> select abierto con solo esos
        options.gerentes = gerList;

        if (qGer) {
          options.coordinadores = await namesByRole('Coordinador', { gerente: qGer });
          options.asesores      = qCoord
            ? await namesByRole('Asesor', { coord: qCoord })
            : await namesByRole('Asesor', { gerente: qGer });
        } else {
          options.coordinadores = [];
          options.asesores = [];
        }
      }
    }

    else if (role === 'coordinador') {
      const chain = await getChainFor(nombre);
      fixed.subdirector = chain.subdirector || pickFirst(req.user, F.subdir);
      fixed.gerente     = chain.gerente     || pickFirst(req.user, F.gerencia);
      fixed.coordinador = nombre;
      options.asesores  = await namesByRole('Asesor', { coord: nombre });
    }

    else { // asesor u otros
      const chain = await getChainFor(nombre);
      fixed.subdirector = chain.subdirector || pickFirst(req.user, F.subdir);
      fixed.gerente     = chain.gerente     || pickFirst(req.user, F.gerencia);
      fixed.coordinador = chain.coordinador || pickFirst(req.user, F.coord);
    }

    return res.json({ ok: true, role, fixed, options });
  } catch (err) {
    console.error('[directorioOpciones] Error:', err);
    return res.status(500).json({ ok: false, reason: 'ERROR_INTERNO' });
  }
}
