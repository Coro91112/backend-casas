// src/Internomex/model.altaInternomex.js
import mongoose from 'mongoose';

const COLL_ES = { locale: 'es', strength: 1 };

const AltaInternomexSchema = new mongoose.Schema({
  nombre:      { type: String, default: '' },
  Lote:        { type: String, required: true },
  gerente:     { type: String, default: '' },       // gerente “principal”
  gerentes:    { type: [String], default: [] },     // 👈 gerentes adicionales (compartida)
  subdirector: { type: String, default: '' },
  coordinador: { type: String, default: '' },
  asesor:      { type: String, default: '' },

  estatus:       { type: String, enum: ['Pendientes','Aceptadas','Rechazadas'], index: true },
  motivoRechazo: { type: String, default: '' },

  acceptedAt:  { type: Date },
  acceptedBy:  { type: String, default: '' },
  rejectedAt:  { type: Date },
  rejectedBy:  { type: String, default: '' },

  neodataId: { type: mongoose.Schema.Types.ObjectId, index: true },

  createdBy: {
    id:     { type: mongoose.Schema.Types.Mixed, default: null },
    nombre: { type: String, default: '' },
  },
}, {
  collection: 'OportunidadesInternomex',
  timestamps: true,
  strict: false,
});

AltaInternomexSchema.index({ Lote: 1 }, { unique: true, collation: COLL_ES, name: 'uniq_Lote_internomex' });
AltaInternomexSchema.index({ estatus: 1, subdirector: 1, gerente: 1, coordinador: 1, asesor: 1 }, { name: 'idx_scope_browse' });

export const AltaInternomex = mongoose.model('AltaInternomex', AltaInternomexSchema);
