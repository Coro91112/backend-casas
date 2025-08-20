// src/Oportunidades/controllers/opcionesAlta.get.js
import { UsuariosActivos } from '../model.usuariosActivos.js';
import { toLite, getNombre, getRol, getGerente, getSubdirector, getCoordinador } from '../utils/mapUser.js';

function uniqSorted(arr = []) {
  return [...new Set(arr.filter(Boolean))].sort((a,b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
}

export async function getOpcionesAlta(req, res) {
  try {
    // req.user viene del middleware de auth que ya usas en “Login con roles y permisos”
    const user = req.user || {};
    const miNombre = (user.nombreCompleto || user.nombre || user.NOMBRE || '').trim();
    const miRol = (user.rol || user.ROL || '').trim();

    // Traemos lo necesario de la colección (todo en memoria, rápido para ~miles)
    const raw = await UsuariosActivos.find({}, {
      nombre: 1, NOMBRE: 1, rol: 1, ROL: 1, subdireccion: 1, Subdireccion: 1,
      gerencia: 1, Gerencia: 1, coordinador: 1, Coordinador: 1
    }).lean();

    const all = raw.map(toLite);

    // Índices por relación
    const porSubdirector = new Map();  // subdirector -> [gerentes]
    const porGerente     = new Map();  // gerente -> [coordinadores]
    const porCoord       = new Map();  // coordinador -> [asesores]

    for (const u of all) {
      if (u.rol.toLowerCase() === 'gerente') {
        const s = u.subdirector;
        if (s) porSubdirector.set(s, [...(porSubdirector.get(s) || []), u.nombre]);
      }
      if (u.rol.toLowerCase() === 'coordinador') {
        const g = getGerente(u) || u.gerente || u.nombre; // gerente responsable en “gerencia”
        if (g) porGerente.set(g, [...(porGerente.get(g) || []), u.nombre]);
      }
      if (u.rol.toLowerCase() === 'asesor') {
        const c = u.coordinador;
        if (c) porCoord.set(c, [...(porCoord.get(c) || []), u.nombre]);
      }
    }

    // Limpieza/orden
    for (const [k, v] of porSubdirector) porSubdirector.set(k, uniqSorted(v));
    for (const [k, v] of porGerente)     porGerente.set(k,     uniqSorted(v));
    for (const [k, v] of porCoord)       porCoord.set(k,       uniqSorted(v));

    const subdirectores = uniqSorted(all.filter(u => u.rol.toLowerCase() === 'subdirector').map(u => u.nombre));
    const gerentes      = uniqSorted(all.filter(u => u.rol.toLowerCase() === 'gerente').map(u => u.nombre));
    const coordinadores = uniqSorted(all.filter(u => u.rol.toLowerCase() === 'coordinador').map(u => u.nombre));
    const asesores      = uniqSorted(all.filter(u => u.rol.toLowerCase() === 'asesor').map(u => u.nombre));

    // Defaults/locks según el rol que inició sesión
    const locks = { subdirector:false, gerente:false, coordinador:false, asesor:false };
    const preset = { subdirector:'', gerente:'', coordinador:'', asesor:'' };

    const rol = (miRol || '').toLowerCase();
    if (rol === 'admin') {
      // Nada bloqueado, listas completas
    } else if (rol === 'subdirector') {
      locks.subdirector = true;
      preset.subdirector = miNombre;

      // Gerentes solo de este subdirector
      const gers = porSubdirector.get(miNombre) || [];
      // Si solo hay uno, puedes autoseleccionarlo (opcional)
      // preset.gerente = gers[0] || '';
    } else if (rol === 'gerente') {
      // Buscamos al gerente en BD para saber su cadena
      const yo = all.find(u => u.nombre === miNombre && u.rol.toLowerCase() === 'gerente');
      const miSub = yo?.subdirector || '';
      locks.subdirector = true;
      locks.gerente = true;
      preset.subdirector = miSub;
      preset.gerente = miNombre;
    } else if (rol === 'coordinador') {
      const yo = all.find(u => u.nombre === miNombre && u.rol.toLowerCase() === 'coordinador');
      const miGer = getGerente(yo) || '';
      const miSub = yo?.subdirector || yo?.subdirector || '';
      locks.subdirector = true;
      locks.gerente = true;
      locks.coordinador = true;
      preset.subdirector = miSub;
      preset.gerente = miGer;
      preset.coordinador = miNombre;
    } else if (rol === 'asesor') {
      const yo = all.find(u => u.nombre === miNombre && u.rol.toLowerCase() === 'asesor');
      const miCoord = getCoordinador(yo) || '';
      const coordDoc = all.find(u => u.nombre === miCoord && u.rol.toLowerCase() === 'coordinador');
      const miGer = coordDoc ? (getGerente(coordDoc) || '') : '';
      const gerDoc = all.find(u => u.nombre === miGer && u.rol.toLowerCase() === 'gerente');
      const miSub = gerDoc ? (gerDoc.subdirector || '') : '';

      locks.subdirector = true;
      locks.gerente = true;
      locks.coordinador = true;
      locks.asesor = true;
      preset.subdirector = miSub;
      preset.gerente = miGer;
      preset.coordinador = miCoord;
      preset.asesor = miNombre;
    }

    return res.json({
      ok: true,
      options: {
        subdirectores,
        // Para la cascada
        gerentesBySub: Object.fromEntries([...porSubdirector.entries()]),
        coordinadoresByGer: Object.fromEntries([...porGerente.entries()]),
        asesoresByCoord: Object.fromEntries([...porCoord.entries()]),
        // Listas planas por si necesitas (admin)
        gerentes,
        coordinadores,
        asesores,
      },
      locks,
      preset,
    });
  } catch (e) {
    console.error('[getOpcionesAlta] error', e);
    return res.status(500).json({ ok:false, reason:'ERROR_INTERNO' });
  }
}
