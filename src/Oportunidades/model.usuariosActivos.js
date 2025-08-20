import mongoose from 'mongoose';

const UsuariosActivosSchema = new mongoose.Schema({
  nombre: { type: String, index: true },
  NOMBRE: { type: String, index: true },
  rol: { type: String, index: true },
  ROL: { type: String, index: true },
  subdireccion: { type: String, index: true },
  Subdireccion: { type: String, index: true },
  'subdirección': { type: String, index: true },
  gerencia: { type: String, index: true },
  Gerencia: { type: String, index: true },
  coordinador: { type: String, index: true },
  Coordinador: { type: String, index: true },
}, { collection: 'UsuariosActivos', strict: false });

export const UsuariosActivos = mongoose.model('UsuariosActivos', UsuariosActivosSchema);
