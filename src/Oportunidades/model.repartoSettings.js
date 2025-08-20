import mongoose from 'mongoose';

const RepartoSettingsSchema = new mongoose.Schema({
  gerencia: { type: String, unique: true, index: true },
  maxPerMember: { type: Number, default: 10 },
  source: { type: String, enum: ['NEODATA','DESECH'], default: 'NEODATA' },
  neodata: [{
    desarrollo: { type: String },
    pct: { type: Number, min: 0, max: 100 }
  }],
  months: [{ type: String }], // 'YYYY-MM'
  updatedBy: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now },
}, { collection: 'RepartoSettings' });

export const RepartoSettings = mongoose.model('RepartoSettings', RepartoSettingsSchema);
