import { Oportunidad } from "../model.opotunidad.js";

const COLL_ES = { locale: "es", strength: 1 };

const norm = (s="") =>
  String(s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .toLowerCase().replace(/\s+/g," ").trim();

const pickFirstFuzzy = (row = {}, keys = []) => {
  const t = new Map(Object.entries(row).map(([k,v]) => [norm(k), v]));
  for (const k of keys) {
    const v = t.get(norm(k));
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return "";
};

const NAME_KEYS = [
  "Nombre cliente","Nombre Cliente","Nombre",
  "Cliente","NOMBRE CLIENTE","NOMBRE"
];

const LOTE_KEYS = [
  "Lote","Num Lote","Núm Lote","NUM LOTE","NUM. LOTE","NUMERO LOTE"
];

const SUBDIR_KEYS = ["Subdirector","subdirector","SUBDIRECTOR"];
const GERENTE_KEYS = ["Gerente","gerente","GERENTE"];
const COORD_KEYS = ["Coordinador","coordinador","COORDINADOR"];
const ASESOR_KEYS = ["Asesor","asesor","ASESOR"];
const ETAPA_KEYS = ["Etapa","etapa","ETAPA"];


export async function listOportunidades(req, res) {
  try {
    const docs = await Oportunidad.find({}, null, { collation: COLL_ES }).lean();

    const items = (docs || []).map(d => {
const { _id, ...rest } = d;

const nombre = pickFirstFuzzy(rest, NAME_KEYS) || "SIN NOMBRE";
const lote   = pickFirstFuzzy(rest, LOTE_KEYS) || rest.Lote || rest.lote || "";

// lee insensible a mayúsculas
const subdirector = pickFirstFuzzy(rest, SUBDIR_KEYS) || "";
const gerente     = pickFirstFuzzy(rest, GERENTE_KEYS) || "";
const coordinador = pickFirstFuzzy(rest, COORD_KEYS) || "";
const asesor      = pickFirstFuzzy(rest, ASESOR_KEYS) || "";
const etapa       = pickFirstFuzzy(rest, ETAPA_KEYS) || rest.etapa || "lead";

const content = [nombre, lote].filter(Boolean).join(" — ");

return {
  // conserva todo lo demás del doc
  ...rest,
  // y estandariza campos que usa el front:
  id: String(_id),
  etapa,
  content,
  subdirector,
  gerente,
  coordinador,
  asesor,
};
    });

    return res.json({ ok: true, items });
  } catch (e) {
    console.error("[listOportunidades] error", e);
    return res.status(500).json({ ok: false, reason: "ERROR_INTERNO" });
  }
}
