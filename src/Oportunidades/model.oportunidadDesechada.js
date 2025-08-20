import mongoose from "mongoose";

const OportunidadDesechadaSchema = new mongoose.Schema(
  {
    originalId:   { type: mongoose.Schema.Types.ObjectId},
    razonDesecho: { type: String, default: "" },
    subdirector1: { type: String, default: "" },
    gerente1:     { type: String, default: "" },
    coordinador1: { type: String, default: "" },
    asesor1:      { type: String, default: "" },
    etapa:   { type: String, default: "lost" },
    movedAt: { type: Date, default: Date.now },
  },
  {
    strict: false,
    timestamps: true,
    collection: "OportunidadesDesechados",
  }
);

OportunidadDesechadaSchema.index({ originalId: 1 }, { unique: true, sparse: true });

export const OportunidadDesechada = mongoose.model(
  "OportunidadDesechada",
  OportunidadDesechadaSchema
);
