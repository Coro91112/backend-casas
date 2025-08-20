// src/Oportunidades/model.neodata.js
import mongoose from 'mongoose';

const NeodataReporteSchema = new mongoose.Schema({
  'Lote': { type: String, index: true },        // 👈 top-level Lote
  'Nombre cliente': { type: String },
  'Estatus cliente': { type: String },
  'Email': { type: String },
  'Desarrollo': { type: String },
  'Condominio': { type: String },
  'Precio lote': { type: String },
  'Adeudo capital': { type: String },
  'Superficie m²': { type: mongoose.Schema.Types.Mixed },
  'Escriturado': { type: String },
  'Direccion': { type: String },
  // lo demás que traiga el doc…
}, { collection: 'NeodataReporte', strict: false });

export const NeodataReporte = mongoose.model('NeodataReporte', NeodataReporteSchema);
