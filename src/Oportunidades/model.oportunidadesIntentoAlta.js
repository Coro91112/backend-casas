import mongoose from "mongoose";

const OportunidadIntentoAltaSchema = new mongoose.Schema(
  {
    // Copia PLANA del Neodata (strict:false permite todo)
    Lote: { type: String, index: true },

    // Dueño actual del alta
    SubdirectorDueno:  { type: String, default: "" },
    GerenteDueno:      { type: String, default: "" },
    CoordinadorDueno:  { type: String, default: "" },
    AsesorDueno:       { type: String, default: "" },

    // Quien solicita el intento
    SubdirectorSolicita: { type: String, default: "" },
    GerenteSolicita:     { type: String, default: "" },
    CoordinadorSolicita: { type: String, default: "" },
    AsesorSolicita:      { type: String, default: "" },

    solicitadoPor: {
      id:     { type: mongoose.Schema.Types.Mixed, default: null },
      nombre: { type: String, default: "" },
      rol:    { type: String, default: "" },
    },

    neodataId: { type: mongoose.Schema.Types.ObjectId, index: true },
  },
  {
    strict: false,
    timestamps: true,
    collection: "OportunidadesIntentosDeAlta",
  }
);

// (Opcional) evitar duplicados exactos del mismo solicitante sobre el mismo lote
OportunidadIntentoAltaSchema.index(
  { Lote: 1, SubdirectorSolicita: 1, GerenteSolicita: 1, CoordinadorSolicita: 1, AsesorSolicita: 1 },
  { unique: false, name: "idx_lote_solicitante" }
);

export const OportunidadIntentoAlta = mongoose.model(
  "OportunidadIntentoAlta",
  OportunidadIntentoAltaSchema
);
