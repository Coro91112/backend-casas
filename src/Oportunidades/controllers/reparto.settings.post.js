import { RepartoSettings } from '../model.repartoSettings.js';
import { resolveGerenciaFromUser } from '../utils/reparto.helpers.js';

export async function saveRepartoSettings(req, res) {
  try {
    const gerencia = resolveGerenciaFromUser(req.user || {});
    if (!gerencia) return res.status(400).json({ ok:false, reason:'GERENCIA_DESCONOCIDA' });

    const { maxPerMember=10, source='NEODATA', neodata=[], months=[] } = req.body || {};
    const payload = {
      gerencia,
      maxPerMember: Number(maxPerMember || 0),
      source,
      neodata: (Array.isArray(neodata)? neodata: []).filter(x => x?.desarrollo && Number(x.pct)>0),
      months: (Array.isArray(months)? months: []).filter(Boolean),
      updatedBy: (req.user?.nombre || req.user?.NOMBRE || ''),
      updatedAt: new Date()
    };

    const doc = await RepartoSettings.findOneAndUpdate(
      { gerencia },
      { $set: payload },
      { new: true, upsert: true }
    ).lean();

    return res.json({ ok:true, settings: doc });
  } catch (e) {
    console.error('[reparto/settings POST]', e);
    res.status(500).json({ ok:false, reason:'ERROR_INTERNO' });
  }
}
