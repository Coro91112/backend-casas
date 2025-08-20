import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import tz from "dayjs/plugin/timezone.js";
dayjs.extend(utc); dayjs.extend(tz);

import { OportunidadDesechada } from "../../Oportunidades/model.oportunidadDesechada.js";
import { OportunidadInternomex } from "../../Oportunidades/model.oportunidadInternomex.js";

const COLL_ES = { locale: "es", strength: 1 };

// coalesce helper (agarra el 1ro no vacío)
const coalesce = (...vals) => {
  for (const v of vals) {
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return "";
};

// normaliza semana: regresa inicio y fin (local)
function monthRange(monthStr) {
  // monthStr: "2025-08" (YYYY-MM). Si no viene, usa mes actual.
  const m = monthStr && /^\d{4}-\d{2}$/.test(monthStr)
    ? dayjs.tz(`${monthStr}-01`, "America/Mexico_City")
    : dayjs.tz(new Date(), "America/Mexico_City").startOf("month");

  const start = m.startOf("month").toDate();
  const end   = m.endOf("month").toDate();
  return { start, end, month: m };
}

/**
 * GET /ReporteDesechados?month=YYYY-MM
 * Responde:
 * {
 *   semanas: [{ label, start, end, counts: { [gerente]: n }, total }],
 *   razones: [{ name, value, pct }],
 *   ventas  : [{ cliente, lote, desechadoPor, vendidoPor }]
 * }
 */
export async function getReporteDesechados(req, res) {
  try {
    const { month } = req.query || {};
    const { start, end, month: m } = monthRange(month);

    // ===== Base: leer docs del mes de OportunidadesDesechados =====
    const base = await OportunidadDesechada.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      // proyecta campos que nos interesan con coalesce
      {
        $project: {
          createdAt: 1,
          razonDesecho: 1,
          gerenteRaw: { $ifNull: ["$gerente1", "$gerente"] },
          loteUpper: { $ifNull: ["$Lote", "$lote"] },
nombreCliente: {
  $ifNull: [
    "$Nombre cliente",  // 👈 nuevo alias correcto
    "$Nombre",
    "$nombre",
    "$cliente",
    "$Cliente"
  ]
},
        }
      },
    ]).collation(COLL_ES);

    // === 1) Tabla por semanas y gerente ===
    // Construimos cortes de semana (lun-dom) del mes pedido
    const weeks = [];
    let cur = m.startOf("month").startOf("week"); // lunes
    const endMonth = m.endOf("month").endOf("week");
    while (cur.isBefore(endMonth)) {
      const wStart = cur;
      const wEnd   = cur.endOf("week");
      weeks.push({ start: wStart.toDate(), end: wEnd.toDate() });
      cur = cur.add(1, "week").startOf("week");
    }

    // bucketize
    const semanas = weeks.map(({ start: ws, end: we }) => {
      const slice = base.filter(d => d.createdAt >= ws && d.createdAt <= we);
      const counts = {};
      for (const d of slice) {
        const g = coalesce(d.gerenteRaw, "Sin gerente");
        counts[g] = (counts[g] || 0) + 1;
      }
      const total = Object.values(counts).reduce((a,b)=>a+b,0);
      const label = `${dayjs(ws).format("DD")}–${dayjs(we).format("DD")} ${m.format("MMM")}`;
      return { label, start: ws, end: we, counts, total };
    });

    // === 2) Razones de desecho (pie) ===
    const reasonMap = new Map();
    for (const d of base) {
      const r = coalesce(d.razonDesecho, "Sin razón");
      reasonMap.set(r, (reasonMap.get(r) || 0) + 1);
    }
    const totalRaz = Array.from(reasonMap.values()).reduce((a,b)=>a+b,0) || 1;
    const razones = Array.from(reasonMap.entries())
      .map(([name, value]) => ({
        name, value,
        pct: Math.round((value * 100) / totalRaz)
      }))
      .sort((a,b)=> b.value - a.value);

    // === 3) Ventas desecheadas (join por lote con Internomex) ===
    // Trae internomex del mismo mes (para acotar búsqueda)
    const inx = await OportunidadInternomex.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      {
        $project: {
          createdAt: 1,
          gerenteRaw: { $ifNull: ["$gerente1", "$gerente"] },
          loteUpper: { $ifNull: ["$Lote", "$lote"] },
          nombreCliente: {
            $ifNull: ["$Nombre", "$nombre", "$cliente", "$Cliente"]
          }
        }
      },
    ]).collation(COLL_ES);

    // Index por lote para lookup rápido
    const inxByLote = new Map();
    for (const r of inx) {
      const key = String(r.loteUpper || "").trim().toLowerCase();
      if (!key) continue;
      // conserva el primero
      if (!inxByLote.has(key)) inxByLote.set(key, r);
    }

    const ventas = [];
    const seen = new Set();
    for (const d of base) {
      const key = String(d.loteUpper || "").trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      const match = inxByLote.get(key);
      if (match) {
        ventas.push({
          cliente: coalesce(d.nombreCliente, match.nombreCliente, "-"),
          lote: coalesce(d.loteUpper, "-"),
          desechadoPor: coalesce(d.gerenteRaw, "—"),
          vendidoPor: coalesce(match.gerenteRaw, "—"),
        });
        seen.add(key);
      }
    }

    res.json({ ok: true, semanas, razones, ventas });
  } catch (err) {
    console.error("ReporteDesechados error:", err);
    res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
}
