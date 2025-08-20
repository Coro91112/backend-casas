// Normaliza cualquier variante y corrige typos comunes (p. ej. "Coorinador")
export function normalizeRole(raw = "") {
  const r = String(raw).trim().toLowerCase();

  const aliases = {
    admin: "admin",
    administrador: "admin",

    subdirector: "subdirector",
    "sub director": "subdirector",

    gerente: "gerente",

    coordinador: "coordinador",
    coorinador: "coordinador", // typo reportado

    asesor: "asesor",
    vendedor: "asesor",

    asistente: "asistente",
"asistente de subdirector": "asistente de subdirector",

  };

  return aliases[r] || r || "asesor";
}
