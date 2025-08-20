import {
  getUniqueDesarrollos, getDesechadosMonths,
  resolveGerenciaFromUser, countTeamSize, countAssignedInGerencia
} from '../utils/reparto.helpers.js';

export async function getRepartoOptions(req, res) {
  try {
    const [desarrollos, months] = await Promise.all([
      getUniqueDesarrollos(),
      getDesechadosMonths()
    ]);

    const gerencia = resolveGerenciaFromUser(req.user || {});
    const [teamSize, assigned] = await Promise.all([
      countTeamSize(gerencia),
      countAssignedInGerencia(gerencia)
    ]);

    return res.json({
      ok: true,
      desarrollos,
      desechadosMonths: months,
      gerencia,
      teamSize,
      assigned
    });
  } catch (e) {
    console.error('[reparto/options]', e);
    res.status(500).json({ ok:false, reason:'ERROR_INTERNO' });
  }
}
