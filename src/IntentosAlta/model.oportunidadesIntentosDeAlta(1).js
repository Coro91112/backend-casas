import mongoose from 'mongoose';

const FileSchema = new mongoose.Schema({
  url: String,         // ruta pública (e.g. /uploads/intentos/xxxxx.jpg)
  name: String,
  mime: String,
  size: Number,
}, { _id:false });

const MessageSchema = new mongoose.Schema({
  at:   { type: Date, default: Date.now },
  by:   {
    id:     String,   // req.user._id o ''
    nombre: String,   // req.user.nombre
    rol:    String,   // admin/subdirector/gerente/coordinador/asesor
  },
  text:  String,
  files: [FileSchema],
}, { _id: false });

const AprobacionesSchema = new mongoose.Schema({
  solicita:  { type: Boolean, default: null }, // gerente que solicita
  dueno:     { type: Boolean, default: null }, // gerente dueño (pertenece a)
  history:   [{
    at: { type: Date, default: Date.now },
    by: { id:String, nombre:String, rol:String },
    action: String, // 'ACEPTAR_SOLICITA' | 'ACEPTAR_DUENO' | 'RECHAZAR_SOLICITA' | 'RECHAZAR_DUENO'
  }]
}, { _id:false });

const IntentoAltaSchema = new mongoose.Schema({
  // --- Campos clave que muestras en la tabla ---
  Lote:           { type: String, index: true },
  GerenteDueno:   { type: String, index: true },   // "Pertenece a"
  GerenteSolicita:{ type: String, index: true },   // "Intenta alta"
  solicitadorPor: {                                 // (obj original que mandas; opcional)
    neodatdat: String
  },

  // Mapeos del doc fuente (del screenshot)
  'Nombre cliente': String,
  neodataId:        String,
  'Estatus cliente':  String,
  Teléfono:         String,
  Email:            String,
  Desarrollo:       String,
  Condominio:       String,
  'Núm. Lote':      String,
  // ... agrega lo que quieras, no es obligado para esta pantalla

  // Alcances
  SubdirectorDueno:  String,
  GerenteDuenoId:    String,
  CoordinadorDueno:  String,
  AsesorDueno:       String,

  SubdirectorSolicita:String,
  GerenteSolicitaId:  String,
  CoordinadorSolicita:String,
  AsesorSolicita:     String,

  // Estado del flujo
  estatus: { type: String, enum: ['Pendientes','Aceptadas','Rechazadas'], default: 'Pendientes', index:true },
  aprobaciones: AprobacionesSchema,

  // Chat
  messages: [MessageSchema],

  // Metas
  createdAt: { type: Date, default: Date.now, index:true },
  updatedAt: { type: Date, default: Date.now }
}, { collection: 'OportunidadesIntentosDeAlta', collation: { locale:'es', strength:1 } });

IntentoAltaSchema.pre('save', function(next){
  this.updatedAt = new Date();
  next();
});

export const OportunidadIntentoAlta = mongoose.model('OportunidadIntentoAlta(1)', IntentoAltaSchema);
