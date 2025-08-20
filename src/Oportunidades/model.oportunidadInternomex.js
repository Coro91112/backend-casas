// src/Oportunidades/model.oportunidadInternomex.js
import mongoose from 'mongoose';

const OportunidadInternomexSchema = new mongoose.Schema(
  {
    etapa:        { type: String, default: 'lead' },
    canal:        { type: String, default: '' },
    subdirector:  { type: String, default: '' },
    gerente:      { type: String, default: '' },
    coordinador:  { type: String, default: '' },
    asesor:       { type: String, default: '' },

    // se conserva igual que en oportunidades
    razonDesecho: { type: String, default: '' },

    estatusNeodata: { type: String, default: '' },
    neodataId:      { type: mongoose.Schema.Types.ObjectId, index: true },

    createdBy: {
      id:     { type: mongoose.Schema.Types.Mixed, default: null },
      nombre: { type: String, default: '' },
    },
  },
  {
    collection: 'OportunidadesInternomex', // 👈 colección NUEVA
    timestamps: true,
    strict: false,
  }
);

// índices igualitos
OportunidadInternomexSchema.index(
  { Lote: 1 },
  { unique: true, name: 'uniq_Lote_internomex', collation: { locale: 'es', strength: 1 } }
);

OportunidadInternomexSchema.index({ neodataId: 1 }, { name: 'idx_neodataId_internomex' });

// evita duplicar la misma fuente
OportunidadInternomexSchema.index(
  { copiadoDe: 1 },
  { unique: true, sparse: true, name: 'uniq_copiadoDe_internomex' }
);

export const OportunidadInternomex = mongoose.model(
  'OportunidadInternomex',
  OportunidadInternomexSchema
);
