import { Oportunidad } from "../model.opotunidad.js";

const VALID_STAGES = [
  "lead","en-seguimiento","agendo","en-proceso","formalizo","ultimatum","lost"
];

const EDIT_PERMS = {
  admin:        ["subdirector","gerente","coordinador","asesor","etapa","razonDesecho"],
  subdirector:  ["gerente","coordinador","asesor","etapa","razonDesecho"],
  gerente:      ["coordinador","asesor","etapa","razonDesecho"],
  coordinador:  ["asesor","etapa","razonDesecho"],
  asesor:       ["etapa","razonDesecho"],
  asistente:    ["coordinador","asesor","etapa","razonDesecho"],
  "asistente de subdirector": ["subdirector","gerente","coordinador","asesor","etapa","razonDesecho"],
};

const norm = (s="") =>
  String(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();

export async function bulkAsignarOportunidades(req, res) {
  try {
    const { ids = [], cambios = {} } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ ok: false, reason: "SIN_IDS" });
    }

    const role = norm(req.user?.rol || req.user?.role || "asesor");
    const allowed = new Set(EDIT_PERMS[role] || []);

    const set = {};

    // Cadena y asesor
    ["subdirector","gerente","coordinador","asesor"].forEach(k => {
      const v = cambios?.[k];
      if (allowed.has(k) && v && String(v).trim() !== "") set[k] = v;
    });

    // Etapa (+ razón si es lost)
    if (allowed.has("etapa") && cambios?.etapa) {
      const etapa = String(cambios.etapa).trim();
      if (!VALID_STAGES.includes(etapa)) {
        return res.status(400).json({ ok:false, reason:"ETAPA_INVALIDA" });
      }
      set.etapa = etapa;

      if (etapa === "lost") {
        if (!allowed.has("razonDesecho")) {
          return res.status(403).json({ ok:false, reason:"SIN_PERMISOS" });
        }
        const rz = String(cambios.razonDesecho || "").trim();
        if (!rz) return res.status(400).json({ ok:false, reason:"FALTA_RAZON" });
        set.razonDesecho = rz;
      } else {
        set.razonDesecho = ""; // salir de lost limpia razón
      }
    }

    if (Object.keys(set).length === 0) {
      return res.status(403).json({ ok: false, reason: "SIN_PERMISOS_O_SIN_CAMBIOS" });
    }

    const result = await Oportunidad.updateMany(
      { _id: { $in: ids } },
      { $set: set }
    );

    return res.json({ ok: true, modified: result.modifiedCount || 0 });
  } catch (e) {
    console.error("[bulkAsignarOportunidades] error", e);
    return res.status(500).json({ ok: false, reason: "ERROR_INTERNO" });
  }
}
