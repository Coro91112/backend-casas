import { RepartoSettings } from '../model.repartoSettings.js';
import { resolveGerenciaFromUser } from '../utils/reparto.helpers.js';
import { previewRepartoInternal } from './preview.internal.js';
import { executeRepartoInternal } from './execute.internal.js';

export async function autoRepartoOnDesechar(user) {
  const gerencia = resolveGerenciaFromUser(user || {});
  if (!gerencia) return;

  const settings = await RepartoSettings.findOne({ gerencia }).lean();
  if (!settings) return;

  const reqLike = {
    user,
    body: {
      maxPerMember: settings.maxPerMember,
      source: settings.source,
      payload: settings.source === 'NEODATA'
        ? { neodata: settings.neodata }
        : { months: settings.months }
    }
  };

  const prev = await previewRepartoInternal(reqLike);
  const N = Math.min(prev?.owed || 0, prev?.available || 0);
  if (N <= 0) return;

  await executeRepartoInternal(reqLike);
}
