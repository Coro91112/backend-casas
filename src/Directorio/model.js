// src/Directorio/model.js
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    nombre: { type: String, trim: true },
    correo: { type: String, trim: true, unique: true, index: true },
    telefono: { type: String, trim: true },
    rol: { 
      type: String, 
      trim: true,
      set: v => String(v || "").trim()
    },
    coordinador: { type: String, trim: true },
    gerencia: { type: String, trim: true },
    subdireccion: { type: String, trim: true }, // 👈 NUEVO
    fechaIngreso: { type: Date },
    contrasena: { type: String, select: false },
  },
  {
    collection: 'UsuariosActivos',
    timestamps: true,
    strict: false, // <— permite leer también NOMBRE, TELEFONO, etc.
  }
);

// salida limpia
userSchema.set('toJSON', {
  transform: (_, ret) => {
    delete ret.__v;
    delete ret.contrasena;
    return ret;
  }
});

// índice de texto (incluye subdireccion)
userSchema.index({
  nombre: 'text',
  correo: 'text',
  telefono: 'text',
  rol: 'text',
  coordinador: 'text',
  gerencia: 'text',
  subdireccion: 'text', // 👈 NUEVO
}, { name: 'dir_text_index' });

export const User = mongoose.model('User', userSchema);
