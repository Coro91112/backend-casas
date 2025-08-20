// src/Directorio/controller.js
import mongoose from 'mongoose';
import { User } from './model.js';

/* ───────── Helpers ───────── */
const pickFirst = (...vals) => vals.find(v => v !== undefined && v !== null && v !== '');

const toDateOrNull = (v) => {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v) ? null : v;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

// separa por coma, slash, pipe, &, " y "
const splitNames = (s = '') =>
  String(s || '')
    .split(/\s*(?:,|\/|\||&| y )\s*/i)
    .map(x => x.trim())
    .filter(Boolean);

// si el rol NO es "asistente", deja solo una gerencia (la primera)
const normalizeGerenciaForRole = (rol = '', gerencia = '') => {
  const r = String(rol || '').trim().toLowerCase();
  // Asistentes (de cualquier tipo) pueden tener varias gerencias
  if (r === 'asistente' || r === 'asistente de subdirector') {
    return (gerencia || '').toString().trim();
  }
  const parts = splitNames(gerencia);
  return parts[0] || '';
};


// Normaliza un doc (con llaves legacy en MAYÚSCULAS) a la forma canónica para el frontend
const normalizeUser = (doc) => {
  const o = doc?.toObject ? doc.toObject() : doc;

  const nombre       = pickFirst(o.nombre, o.NOMBRE);
  const correo       = pickFirst(o.correo, o['CORREO ELECTRONICO']);
  const telefono     = pickFirst(o.telefono, o.TELEFONO, o['TELEFONO ']);
  const rol          = pickFirst(o.rol, o.PUESTO);
  const coordinador  = pickFirst(o.coordinador, o.COORDINADOR);
  const gerencia     = pickFirst(o.gerencia, o.GERENCIA);
  const subdireccion = pickFirst(o.subdireccion, o.SUBDIRECCION);
  const fechaBruta   = pickFirst(o.fechaIngreso, o['FECHA DE INGRESO GERENCIA']);

  let fechaIngreso = fechaBruta;
  if (typeof fechaBruta === 'string') {
    const d = new Date(fechaBruta);
    if (!isNaN(d.getTime())) fechaIngreso = d;
  }

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

return {
  _id: o._id,
  nombre:       clean(nombre),
  correo:       clean(correo),
  telefono:     clean(telefono),
  rol:          clean(rol),
  coordinador:  clean(coordinador),
  gerencia:     clean(gerencia),
  subdireccion: clean(subdireccion),
  fechaIngreso,
};

};

// Construye el $set canónico desde el body del PATCH
const buildCanonicalUpdate = (body = {}) => {
  const u = {};
  if (body.nombre !== undefined)       u.nombre = body.nombre?.trim();
  if (body.correo !== undefined)       u.correo = (body.correo || '').toString().trim().toLowerCase();
  if (body.telefono !== undefined)     u.telefono = (body.telefono ?? '').toString().trim();
  if (body.rol !== undefined)          u.rol = (body.rol || '').toString().trim();
  if (body.coordinador !== undefined)  u.coordinador = (body.coordinador || '').toString().trim();
  if (body.gerencia !== undefined)     u.gerencia = (body.gerencia || '').toString().trim();
  if (body.subdireccion !== undefined) u.subdireccion = (body.subdireccion || '').toString().trim();
  if (body.fechaIngreso !== undefined) {
    const d = toDateOrNull(body.fechaIngreso);
    if (d) u.fechaIngreso = d;
    else if (body.fechaIngreso === null || body.fechaIngreso === '') u.fechaIngreso = null;
  }
  return u;
};

// Claves legacy a limpiar
const LEGACY_KEYS = [
  'NOMBRE', 'CORREO ELECTRONICO', 'TELEFONO', 'TELEFONO ',
  'PUESTO', 'COORDINADOR', 'GERENCIA', 'FECHA DE INGRESO GERENCIA',
  'SUBDIRECCION',
];

/* ───────── Controllers ───────── */

// GET /Directorio/users
export const listUsers = async (req, res) => {
  try {
    const { q = '', role = '', page = 1, limit = 25, sort = 'nombre', order = 'asc' } = req.query;

    const pageNum   = Math.max(parseInt(page, 10) || 1, 1);
    const MAX_LIMIT = 10000;
    const limitNum  = Math.min(Math.max(parseInt(limit, 10) || 25, 1), MAX_LIMIT);
    const skip      = (pageNum - 1) * limitNum;

    const and = [];

    if (q && q.trim()) {
      const rx = new RegExp(q.trim(), 'i');
      and.push({
        $or: [
          { nombre: rx }, { NOMBRE: rx },
          { correo: rx }, { 'CORREO ELECTRONICO': rx },
          { telefono: rx }, { TELEFONO: rx }, { 'TELEFONO ': rx },
          { rol: rx }, { PUESTO: rx },
          { coordinador: rx }, { COORDINADOR: rx },
          { gerencia: rx }, { GERENCIA: rx },
          { subdireccion: rx }, { SUBDIRECCION: rx },
        ]
      });
    }

    if (role && String(role).trim()) {
      const rxRole = new RegExp(`^${String(role).trim()}$`, 'i'); // match exact, case-insensitive
      and.push({ $or: [ { rol: rxRole }, { PUESTO: rxRole } ] });
    }

    const filter = and.length ? { $and: and } : {};

    const sortObj = (order === 'desc')
      ? { [sort]: -1, [String(sort).toUpperCase()]: -1, _id: 1 }
      : { [sort]:  1, [String(sort).toUpperCase()]:  1, _id: 1 };

    const [items, total] = await Promise.all([
      User.find(filter)
        .collation({ locale: 'es', strength: 1 })
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum),
      User.countDocuments(filter),
    ]);

    res.json({
      page: pageNum,
      limit: limitNum,
      total,
      items: items.map(normalizeUser),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se puede obtener el directorio' });
  }
};

// GET /Directorio/subdirectores
export const listSubdirectores = async (req, res) => {
  try {
    const rxRole = new RegExp('^subdirector$', 'i');
    const items = await User.find({ $or: [ { rol: rxRole }, { PUESTO: rxRole } ] })
      .collation({ locale: 'es', strength: 1 })
      .sort({ nombre: 1, NOMBRE: 1, _id: 1 });

    const normed = items.map(normalizeUser);
    res.json({ total: normed.length, items: normed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se puede obtener la lista de subdirectores' });
  }
};

// GET /Directorio/users/:id
export const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(normalizeUser(user));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
};

// PATCH /Directorio/users/:id
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const $set = buildCanonicalUpdate(req.body);

    // Si se envía gerencia y **también** se envía rol distinto de asistente, colapsar a una sola
    if ($set.gerencia !== undefined && $set.rol !== undefined) {
      $set.gerencia = normalizeGerenciaForRole($set.rol, $set.gerencia);
    }

    // Autocompletar subdirección desde gerente si corresponde
    if ($set.gerencia !== undefined && (req.body.subdireccion === undefined || String(req.body.subdireccion).trim() === '')) {
      const auto = await getSubdireccionFromGerenteName($set.gerencia);
      if (auto) $set.subdireccion = auto;
    }

    if (Object.keys($set).length === 0) {
      return res.status(400).json({ error: 'Sin cambios' });
    }

    const $unset = LEGACY_KEYS.reduce((acc, k) => { acc[k] = ''; return acc; }, {});
    const updated = await User.findByIdAndUpdate(
      id,
      { $set, $unset },
      { new: true, lean: false, runValidators: false, upsert: false }
    );

    if (!updated) return res.status(404).json({ error: 'Usuario no encontrado' });

    return res.json(normalizeUser(updated));
  } catch (err) {
    if (err?.code === 11000 && err?.keyPattern?.correo) {
      return res.status(409).json({ error: 'El correo ya existe' });
    }
    console.error(err);
    res.status(500).json({ error: 'No se pudo actualizar' });
  }
};

// POST /Directorio/users
export const createUser = async (req, res) => {
  try {
    const body = req.body || {};
    const nombre       = (body.nombre ?? '').toString().trim();
    const correo       = (body.correo ?? '').toString().trim().toLowerCase();
    const telefono     = (body.telefono ?? '').toString().trim();
    const rol          = (body.rol ?? '').toString().trim();
    const coordinador  = (body.coordinador ?? '').toString().trim();

    // 👉 normalizamos gerencia según el rol (si no es asistente, dejamos solo 1)
    const gerenciaRaw  = (body.gerencia ?? '').toString().trim();
    const gerencia     = normalizeGerenciaForRole(rol, gerenciaRaw);

    let   subdireccion = (body.subdireccion ?? '').toString().trim();

    if (!nombre || !correo) {
      return res.status(400).json({ error: 'nombre y correo son requeridos' });
    }

    // AUTOCOMPLETA subdirección desde el gerente si no vino explícita
    if (!subdireccion && gerencia) {
      subdireccion = await getSubdireccionFromGerenteName(gerencia);
    }

    const hoy = new Date();
    const fechaIngreso = toDateOrNull(body.fechaIngreso) || hoy;

    const doc = await User.create({
      nombre,
      correo,
      telefono,
      rol,
      coordinador,
      gerencia,
      subdireccion,
      fechaIngreso,
      contrasena: '1234'
    });

    return res.status(201).json(normalizeUser(doc));
  } catch (err) {
    if (err?.code === 11000 && err?.keyPattern?.correo) {
      return res.status(409).json({ error: 'El correo ya existe' });
    }
    console.error(err);
    return res.status(500).json({ error: 'No se pudo crear el usuario' });
  }
};

// DELETE /Directorio/users/:id
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const deleted = await User.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: 'Usuario no encontrado' });

    return res.json({ ok: true, id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'No se pudo eliminar' });
  }
};

// Devuelve la subdirección del gerente cuyo nombre coincida exactamente (case-insensitive)
const getSubdireccionFromGerenteName = async (gerenciaName = '') => {
  const name = (gerenciaName || '').toString().trim();
  if (!name) return '';

  const rxName = new RegExp(`^${name}$`, 'i');
  const rxGerente = new RegExp('^gerente$', 'i');

  const doc = await User.findOne({
    $and: [
      { $or: [{ rol: rxGerente }, { PUESTO: rxGerente }] },
      { $or: [{ nombre: rxName }, { NOMBRE: rxName }] }
    ]
  }).lean();

  if (!doc) return '';
  return pickFirst(doc.subdireccion, doc.SUBDIRECCION) || '';
};


// POST /Directorio/users/findByLeaders
export const findByLeaders = async (req, res) => {
  try {
    const {
      subdirector = "",   // nombre exacto visible en el select
      gerente = "",       // nombre exacto del gerente
      coordinador = "",   // nombre exacto del coordinador
      role = "",          // opcional: filtra por rol (e.g. "Asesor")
      page = 1,
      limit = 200,
      sort = "nombre",
      order = "asc",
    } = req.body || {};

    const pageNum   = Math.max(parseInt(page, 10) || 1, 1);
    const MAX_LIMIT = 10000;
    const limitNum  = Math.min(Math.max(parseInt(limit, 10) || 200, 1), MAX_LIMIT);
    const skip      = (pageNum - 1) * limitNum;

    const esc = (s="") => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rxEq = (s="") => new RegExp(`^\\s*${esc(String(s).trim())}\\s*$`, 'i');

    const and = [];

    if (subdirector && String(subdirector).trim()) {
      const rx = rxEq(subdirector);
      and.push({ $or: [{ subdireccion: rx }, { SUBDIRECCION: rx }] });
    }

    if (gerente && String(gerente).trim()) {
      const rx = rxEq(gerente);
      and.push({ $or: [{ gerencia: rx }, { GERENCIA: rx }] });
    }

    if (coordinador && String(coordinador).trim()) {
      const rx = rxEq(coordinador);
      and.push({ $or: [{ coordinador: rx }, { COORDINADOR: rx }] });
    }

    if (role && String(role).trim()) {
      const rxR = rxEq(role);
      and.push({ $or: [{ rol: rxR }, { PUESTO: rxR }] });
    }

    const filter = and.length ? { $and: and } : {};

    const sortObj = (order === 'desc')
      ? { [sort]: -1, [String(sort).toUpperCase()]: -1, _id: 1 }
      : { [sort]:  1, [String(sort).toUpperCase()]:  1, _id: 1 };

    const [items, total] = await Promise.all([
      User.find(filter)
        .collation({ locale: 'es', strength: 1 }) // sin acentos / case-insensitive
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum),
      User.countDocuments(filter),
    ]);

    return res.json({
      page: pageNum,
      limit: limitNum,
      total,
      items: items.map(normalizeUser),
      filterUsed: { subdirector, gerente, coordinador, role },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'No se pudo filtrar por líderes' });
  }
};
