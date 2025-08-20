// src/Oportunidades/utils/mapUser.js
export function getSafe(val) {
  return (val ?? '').toString().trim();
}

export function getNombre(u) {
  return getSafe(u.nombre || u.NOMBRE);
}

export function getRol(u) {
  return getSafe(u.rol || u.ROL);
}

export function getSubdirector(u) {
  return getSafe(u.subdireccion || u.Subdireccion || u['subdirección']);
}

export function getGerente(u) {
  // En tu BD, el nombre del gerente está en el campo "gerencia"
  return getSafe(u.gerencia || u.Gerencia);
}

export function getCoordinador(u) {
  return getSafe(u.coordinador || u.Coordinador);
}

export function toLite(u) {
  return {
    id: String(u._id),
    nombre: getNombre(u),
    rol: getRol(u),
    subdirector: getSubdirector(u),
    gerente: getGerente(u),
    coordinador: getCoordinador(u),
  };
}
