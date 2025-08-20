import {
  countNeodataDisponibles, countDesechadosDisponibles,
  resolveGerenciaFromUser, countTeamSize, countAssignedInGerencia,
  allocateByPerc
} from '../utils/reparto.helpers.js';

export async function previewReparto(req, res) {
  try {
    const { maxPerMember=0, source='NEODATA', payload={} } = req.body || {};
    const gerencia = resolveGerenciaFromUser(req.user || {});
    const [teamSize, assigned] = await Promise.all([
      countTeamSize(gerencia),
      countAssignedInGerencia(gerencia)
    ]);
    const capacity = teamSize * Number(maxPerMember || 0);
    const owed = Math.max(0, capacity - assigned);

    let available = 0, breakdown = {}, allocation = [];

    if (source === 'NEODATA') {
      const list = (payload?.neodata || []).filter(x => x?.desarrollo && x?.pct>0);
      const devs = [...new Set(list.map(x => x.desarrollo))];
      const { total, breakdown: bd } = await countNeodataDisponibles(devs);
      available = total; breakdown = bd;

      const N = Math.min(owed, available);
      const percs = list.map(x => ({ key: x.desarrollo, pct: Number(x.pct) }));
      allocation = allocateByPerc(N, percs);
    } else {
      const months = (payload?.months || []).filter(Boolean);
      const { total, breakdown: bd } = await countDesechadosDisponibles(months);
      available = total; breakdown = bd;

      const N = Math.min(owed, available);
      const keys = Object.keys(breakdown);
      if (keys.length) {
        const pct = 100/keys.length;
        allocation = allocateByPerc(N, keys.map(k => ({ key:k, pct })));
      }
    }

    return res.json({
      ok: true,
      gerencia,
      teamSize, assigned, capacity, owed,
      available, source, breakdown, allocation
    });
  } catch (e) {
    console.error('[reparto/preview]', e);
    res.status(500).json({ ok:false, reason:'ERROR_INTERNO' });
  }
}
