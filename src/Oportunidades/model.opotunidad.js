// src/Oportunidades/model.opotunidad.js
import mongoose from 'mongoose';

const OportunidadSchema = new mongoose.Schema(
  {
    etapa:        { type: String, default: 'lead' },
    canal:        { type: String, default: '' },
    subdirector:  { type: String, default: '' },
    gerente:      { type: String, default: '' },
    coordinador:  { type: String, default: '' },
    asesor:       { type: String, default: '' },

    // 👇 NUEVO: se actualiza al mover a lost
    razonDesecho: { type: String, default: '' },

    estatusNeodata: { type: String, default: '' },
    neodataId:      { type: mongoose.Schema.Types.ObjectId, index: true },

    createdBy: {
      id:     { type: mongoose.Schema.Types.Mixed, default: null },
      nombre: { type: String, default: '' },
    },
  },
  {
    collection: 'oportunidades',
    timestamps: true,
    strict: false, // acepta TODAS las llaves del CSV (planas)
  }
);

OportunidadSchema.index(
  { Lote: 1 },
  { unique: true, name: 'uniq_Lote', collation: { locale: 'es', strength: 1 } }
);

OportunidadSchema.index({ neodataId: 1 }, { name: 'idx_neodataId' });

export const Oportunidad = mongoose.model('Oportunidad', OportunidadSchema);
