import { Oportunidad } from "../model.opotunidad.js";
import { NeodataReporte } from "../model.neodata.js";

const TEL_KEYS  = ["Teléfono","Telefono","TELÉFONO","TELEFONO","Tel","Teléfono 1","Telefono 1","Teléfono 2","Telefono 2","CELULAR","Celular"];
const MAIL_KEYS = ["Email","E-mail","EMAIL","email","Correo","correo","CORREO"];

function pickExistingKey(doc, keys, fallback){
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(doc, k)) return k;
  }
  return fallback;
}

/** Actualiza teléfono/correo en Oportunidad y (si existe) en NeodataReporte.
 *  👉 Actualiza la LLAVE que ya existe (p. ej. "Teléfono", "Email") en lugar de crear nuevas. */
export async function actualizarContacto(req, res) {
  try {
    const { id, telefono, correo } = req.body || {};
    if (!id) return res.status(400).json({ ok: false, reason: "SIN_ID" });

    // Traer la oportunidad para detectar las llaves reales
    const oppDoc = await Oportunidad.findById(id).lean();
    if (!oppDoc) return res.status(404).json({ ok: false, reason: "NO_OPORTUNIDAD" });

    const phoneKeyOpp = pickExistingKey(oppDoc, TEL_KEYS,  "Teléfono");
    const mailKeyOpp  = pickExistingKey(oppDoc, MAIL_KEYS, "Email");

    const setOpp   = {};
    const unsetOpp = {};
    if (telefono !== undefined) setOpp[phoneKeyOpp] = String(telefono || "");
    if (correo   !== undefined) setOpp[mailKeyOpp]  = String(correo   || "");

    // Si por error ya existen "telefono"/"correo" en minúsculas, los limpiamos
    if (phoneKeyOpp !== "telefono" && Object.prototype.hasOwnProperty.call(oppDoc, "telefono")) unsetOpp.telefono = "";
    if (mailKeyOpp  !== "correo"   && Object.prototype.hasOwnProperty.call(oppDoc, "correo"))   unsetOpp.correo   = "";

    await Oportunidad.updateOne(
      { _id: id },
      {
        ...(Object.keys(setOpp).length ? { $set: setOpp } : {}),
        ...(Object.keys(unsetOpp).length ? { $unset: unsetOpp } : {}),
      }
    );

    // Reflejar también en Neodata (si lo hay)
    if (oppDoc.neodataId) {
      const ndoc = await NeodataReporte.findById(oppDoc.neodataId).lean();
      if (ndoc) {
        const phoneKeyNd = pickExistingKey(ndoc, TEL_KEYS,  "Teléfono");
        const mailKeyNd  = pickExistingKey(ndoc, MAIL_KEYS, "Email");

        const setNd = {};
        if (telefono !== undefined) setNd[phoneKeyNd] = String(telefono || "");
        if (correo   !== undefined) setNd[mailKeyNd]  = String(correo   || "");

        if (Object.keys(setNd).length) {
          await NeodataReporte.updateOne({ _id: oppDoc.neodataId }, { $set: setNd });
        }
      }
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error("[actualizarContacto] error", e);
    return res.status(500).json({ ok: false, reason: "ERROR_INTERNO" });
  }
}
