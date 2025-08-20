import mongoose from "mongoose";
import { Oportunidad } from "../model.opotunidad.js";
import { OportunidadDesechada } from "../model.oportunidadDesechada.js";
import { autoRepartoOnDesechar } from "../services/autoReparto.service.js";

/* ==== helpers de normalización & extracción ==== */
const norm = (s = "") =>
  String(s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const pickFirstFuzzy = (row = {}, keys = []) => {
  const t = new Map(Object.entries(row).map(([k, v]) => [norm(k), v]));
  for (const k of keys) {
    const v = t.get(norm(k));
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return "";
};

// nombres en CSV pueden variar
const NAME_KEYS = [
  "Nombre cliente", "Nombre Cliente", "Nombre",
  "Cliente", "NOMBRE CLIENTE", "NOMBRE"
];

// variaciones de “Lote”
const LOTE_KEYS = [
  "Lote", "Num Lote", "Núm Lote", "NUM LOTE", "NUM. LOTE", "NUMERO LOTE"
];

/* Devuelve el lote y nombre “normalizados” del documento */
function extractLoteAndNombre(row) {
  const nombre = pickFirstFuzzy(row, NAME_KEYS);
  let lote = row?.Lote || row?.lote || "";
  if (!String(lote || "").trim()) {
    lote = pickFirstFuzzy(row, LOTE_KEYS);
  }
  return { lote: String(lote || "").trim(), nombre: String(nombre || "").trim() };
}

/* Calcula el siguiente índice (2,3,4,...) para subdirectorN/gerenteN/... */
function nextChainIndex(doc = {}) {
  let max = 1;
  for (const k of Object.keys(doc || {})) {
    const m = /^(subdirector|gerente|coordinador|asesor)(\d+)$/.exec(k);
    if (m) {
      const n = parseInt(m[2], 10);
      if (!Number.isNaN(n) && n > max) max = n;
    }
  }
  return max + 1; // siguiente
}

/* Construye el payload base para un desecho “nuevo” (con sufijo 1) */
function buildNewDesechado(d) {
  const { _id, subdirector, gerente, coordinador, asesor, ...rest } = d;
  return {
    ...rest,                 // copia TODO lo demás (strict:false)
    originalId: _id,
    etapa: "lost",
    subdirector1: subdirector || "",
    gerente1:     gerente     || "",
    coordinador1: coordinador || "",
    asesor1:      asesor      || "",
    razonDesecho: d.razonDesecho || "",
    movedAt:      new Date(),
  };
}

/**
 * Mueve definitivamente a OportunidadesDesechados:
 * - Si mismo lote + mismo nombre => agrega ...2, ...3, ...
 * - Si mismo lote + NOMBRE DIFERENTE => borra doc viejo y crea uno nuevo con ...1
 * - Elimina la oportunidad original
 * body: { ids: [] }
 */
export async function desecharOportunidades(req, res) {
  const { ids = [] } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ ok: false, reason: "SIN_IDS" });
  }

  // Traer originales
  const docs = await Oportunidad
    .find({ _id: { $in: ids } }, null, { collation: { locale: "es", strength: 1 } })
    .lean();

  if (!docs.length) return res.json({ ok: true, moved: 0 });

  let session = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();

    let processed = 0;

    for (const d of docs) {
      const { lote, nombre } = extractLoteAndNombre(d);
      const nombreNorm = norm(nombre);

      // Buscar si YA hay un desechado de este lote (collation insensible)
      const existing = await OportunidadDesechada.findOne(
        { $or: [{ Lote: lote }, { "Num Lote": lote }, { "Núm Lote": lote }, { lote }] },
        null,
        { collation: { locale: "es", strength: 1 }, session }
      ).lean();

      if (existing) {
        const { nombre: exNombre } = extractLoteAndNombre(existing);
        const exNombreNorm = norm(exNombre);

        if (exNombreNorm === nombreNorm) {
          // —— Mismo dueño: agregamos subdirector2/gerente2/... y NO creamos doc nuevo
          const idx = nextChainIndex(existing);
          const set = {
            [`subdirector${idx}`]: d.subdirector || "",
            [`gerente${idx}`]:     d.gerente     || "",
            [`coordinador${idx}`]: d.coordinador || "",
            [`asesor${idx}`]:      d.asesor      || "",
            razonDesecho:          d.razonDesecho || existing.razonDesecho || "",
            etapa:                 "lost",
            movedAt:               new Date(),
          };

          await OportunidadDesechada.updateOne(
            { _id: existing._id },
            { $set: set },
            { session }
          );

          // Eliminamos la oportunidad original
          await Oportunidad.deleteOne({ _id: d._id }, { session });
          processed += 1;
        } else {
          // —— Cambió el dueño: borramos el doc viejo y arrancamos otro “1”
          await OportunidadDesechada.deleteOne({ _id: existing._id }, { session });
          const fresh = buildNewDesechado(d);
          await OportunidadDesechada.create([fresh], { session });
          await Oportunidad.deleteOne({ _id: d._id }, { session });
          processed += 1;
        }
      } else {
        // —— No hay desecho previo de este lote: crear nuevo con sufijo 1
        const fresh = buildNewDesechado(d);
        await OportunidadDesechada.create([fresh], { session });
        await Oportunidad.deleteOne({ _id: d._id }, { session });
        processed += 1;
      }
    }

    await session.commitTransaction();
    session.endSession();

    /* ========= AUTO-REPARTO (después de mover todo) ========= */
    try {
      // Usa al usuario logueado; la lógica interna resuelve gerencia y aplica settings
      await autoRepartoOnDesechar(req.user);
    } catch (e) {
      // No rompemos la operación de desechar si el reparto falla
      console.error("[autoReparto] fallo post-desechar:", e?.message || e);
    }
    /* ======================================================== */

    return res.json({ ok: true, moved: processed });
  } catch (err) {
    if (session) {
      try { await session.abortTransaction(); session.endSession(); } catch {}
    }
    console.warn("[desechar] transacción falló; intento sin transacción:", err?.message);

    // —— Fallback sin transacción
    try {
      let processed = 0;
      for (const d of docs) {
        const { lote, nombre } = extractLoteAndNombre(d);
        const nombreNorm = norm(nombre);

        const existing = await OportunidadDesechada.findOne(
          { $or: [{ Lote: lote }, { "Num Lote": lote }, { "Núm Lote": lote }, { lote }] },
          null,
          { collation: { locale: "es", strength: 1 } }
        ).lean();

        if (existing) {
          const { nombre: exNombre } = extractLoteAndNombre(existing);
          const exNombreNorm = norm(exNombre);

          if (exNombreNorm === nombreNorm) {
            const idx = nextChainIndex(existing);
            const set = {
              [`subdirector${idx}`]: d.subdirector || "",
              [`gerente${idx}`]:     d.gerente     || "",
              [`coordinador${idx}`]: d.coordinador || "",
              [`asesor${idx}`]:      d.asesor      || "",
              razonDesecho:          d.razonDesecho || existing.razonDesecho || "",
              etapa:                 "lost",
              movedAt:               new Date(),
            };
            await OportunidadDesechada.updateOne({ _id: existing._id }, { $set: set });
            await Oportunidad.deleteOne({ _id: d._id });
            processed += 1;
          } else {
            await OportunidadDesechada.deleteOne({ _id: existing._id });
            const fresh = buildNewDesechado(d);
            await OportunidadDesechada.create([fresh]);
            await Oportunidad.deleteOne({ _id: d._id });
            processed += 1;
          }
        } else {
          const fresh = buildNewDesechado(d);
          await OportunidadDesechada.create([fresh]);
          await Oportunidad.deleteOne({ _id: d._id });
          processed += 1;
        }
      }

      /* ========= AUTO-REPARTO (fallback) ========= */
      try {
        await autoRepartoOnDesechar(req.user);
      } catch (e) {
        console.error("[autoReparto] fallo post-desechar (fallback):", e?.message || e);
      }
      /* ========================================== */

      return res.json({ ok: true, moved: processed });
    } catch (e2) {
      console.error("[desechar] error final", e2);
      return res.status(500).json({ ok: false, reason: "ERROR_INTERNO" });
    }
  }
}
