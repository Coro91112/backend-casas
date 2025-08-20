// src/Internomex/model.usuarioActivo.js
import mongoose from 'mongoose';

// Modelo "flexible" solo para leer usuarios activos
const UsuarioActivoSchema = new mongoose.Schema(
  {},
  { collection: 'UsuariosActivos', strict: false }
);

export const UsuarioActivo = mongoose.model('UsuarioActivo', UsuarioActivoSchema);
