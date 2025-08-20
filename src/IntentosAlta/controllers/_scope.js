// Collation español consistente
export const COLL_ES2 = { locale: 'es', strength: 1 };

export function normalize(s=''){ return String(s||'').trim(); }

/**
 * Construye el filtro de "alcance" según el rol conectado.
 * - admin: ve todo
 * - subdirector: por SubdirectorDueno o SubdirectorSolicita = su nombre
 * - gerente:     por GerenteDueno   o GerenteSolicita     = su nombre
 * - coordinador: por CoordinadorDueno/CoordinadorSolicita = su nombre
 * - asesor:      por AsesorDueno/AsesorSolicita           = su nombre
 */
export function buildOwnershipFilter(user){
  if (!user || !user.rol) return {};
  const nombre = normalize(user.nombre || user.Nombre || user.name || '');

  switch (user.rol) {
    case 'admin': return {};
    case 'subdirector':
      return { $or:[
        { SubdirectorDueno:   nombre },
        { SubdirectorSolicita:nombre }
      ]};
    case 'gerente':
      return { $or:[
        { GerenteDueno:   nombre },
        { GerenteSolicita:nombre }
      ]};
    case 'coordinador':
      return { $or:[
        { CoordinadorDueno:   nombre },
        { CoordinadorSolicita:nombre }
      ]};
    case 'asesor':
      return { $or:[
        { AsesorDueno:   nombre },
        { AsesorSolicita:nombre }
      ]};
    default:
      return {};
  }
}

/** Determina si el user es el gerente que solicita o el dueño del lote */
export function roleSideForApproval(doc, user){
  const n = normalize(user?.nombre);
  if (n && n === normalize(doc.GerenteSolicita)) return 'solicita';
  if (n && n === normalize(doc.GerenteDueno))     return 'dueno';
  return null; // no le toca
}
