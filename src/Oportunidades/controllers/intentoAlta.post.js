import { NeodataReporte } from "../model.neodata.js";
import { Oportunidad } from "../model.opotunidad.js";
import { OportunidadIntentoAlta } from "../model.oportunidadesIntentoAlta.js";

const COLL_ES = { locale: "es", strength: 1 };

function escapeRegex(str = "") {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
const sanitizeKeys = (input) => {
  if (Array.isArray(input)) return input.map(sanitizeKeys);
  if (input && typeof input === "object") {
    const out = {};
    for (const [k, v] of Object.entries(input)) {
      const safeKey = String(k).replace(/\./g, "·").replace(/\$/g, "＄");
      out[safeKey] = sanitizeKeys(v);
    }
    return out;
  }
  return input;
};

export async function intentoAlta(req, res) {
  try {
    const { lote, dueno = {}, solicita = {} } = req.body || {};
    const lotestr = String(lote || "").trim();
    if (!lotestr) return res.status(400).json({ ok: false, reason: "FALTAN_CAMPOS", campo: "lote" });

    // 1) Encontrar en Neodata (para clonar campos del reporte)
    //    Igual que en pedirAlta: exacto o regex tolerante
    const esc = escapeRegex(lotestr).replace(/\s+/g, "\\s+");
    let doc = await NeodataReporte.findOne({ Lote: lotestr }).collation(COLL_ES).lean();
    if (!doc) {
      doc = await NeodataReporte.findOne({ Lote: { $regex: `^${esc}$`, $options: "i" } }).lean();
    }
    if (!doc) {
      return res.json({ ok: false, reason: "LOTE_NO_EXISTE", lote: lotestr });
    }

    // 2) Revalidar dueños actuales desde Oportunidades (por si cambió)
    const opp = await Oportunidad.findOne({
      $or: [
        { Lote: doc.Lote },
        { lote: doc.Lote },
        { Lote: { $regex: `^\\s*${esc}\\s*$`, $options: "i" } },
        { lote: { $regex: `^\\s*${esc}\\s*$`, $options: "i" } },
      ],
    })
      .collation(COLL_ES)
      .select({ subdirector: 1, gerente: 1, coordinador: 1, asesor: 1 })
      .lean();

    const owner = {
      subdirector: opp?.subdirector || dueno.subdirector || "",
      gerente:     opp?.gerente     || dueno.gerente     || "",
      coordinador: opp?.coordinador || dueno.coordinador || "",
      asesor:      opp?.asesor      || dueno.asesor      || "",
    };

    // 3) Insertar intento (copia plana del CSV + metadatos)
    const flat = sanitizeKeys(doc);
    delete flat._id;

    await OportunidadIntentoAlta.create({
      ...flat,
      Lote: doc.Lote,
      neodataId: doc._id,

      SubdirectorDueno:  owner.subdirector,
      GerenteDueno:      owner.gerente,
      CoordinadorDueno:  owner.coordinador,
      AsesorDueno:       owner.asesor,

      SubdirectorSolicita: solicita.subdirector || "",
      GerenteSolicita:     solicita.gerente     || "",
      CoordinadorSolicita: solicita.coordinador || "",
      AsesorSolicita:      solicita.asesor      || "",

      solicitadoPor: {
        id:     req.user?._id ?? null,
        nombre: req.user?.nombre || req.user?.name || "",
        rol:    req.user?.rol || req.user?.role || "",
      },
    });

    return res.json({ ok: true });
  } catch (e) {
    console.error("[intentoAlta] error:", e);
    return res.status(500).json({ ok: false, reason: "ERROR_INTERNO" });
  }
}
