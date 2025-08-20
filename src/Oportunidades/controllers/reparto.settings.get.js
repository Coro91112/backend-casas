import { RepartoSettings } from '../model.repartoSettings.js';
import { resolveGerenciaFromUser } from '../utils/reparto.helpers.js';

export async function getRepartoSettings(req, res) {
  try {
    const gerencia = resolveGerenciaFromUser(req.user || {});
    if (!gerencia) return res.json({ ok:true, settings:null, gerencia:'' });
    const s = await RepartoSettings.findOne({ gerencia }).lean();
    return res.json({ ok:true, gerencia, settings: s || null });
  } catch (e) {
    console.error('[reparto/settings GET]', e);
    res.status(500).json({ ok:false, reason:'ERROR_INTERNO' });
  }
}
