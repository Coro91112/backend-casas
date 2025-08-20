import { Oportunidad } from '../model.opotunidad.js';

const VALID_STAGES = [
  'lead','en-seguimiento','agendo','en-proceso','formalizo','ultimatum','lost'
];

const EDIT_PERMS = {
  admin:        ['etapa','razonDesecho'],
  subdirector:  ['etapa','razonDesecho'],
  gerente:      ['etapa','razonDesecho'],
  coordinador:  ['etapa','razonDesecho'],
  asesor:       ['etapa','razonDesecho'],
  asistente:    ['etapa','razonDesecho'],
  'asistente de subdirector': ['etapa','razonDesecho'],
};

const norm = (s="") =>
  String(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();

export async function moverOportunidad(req, res) {
  try {
    const { id, to, razonDesecho } = req.body || {};
    if (!id || !to) return res.status(400).json({ ok:false, reason:'BAD_REQUEST' });

    const etapa = String(to).trim();
    if (!VALID_STAGES.includes(etapa)) {
      return res.status(400).json({ ok:false, reason:'ETAPA_INVALIDA' });
    }

    const role = norm(req.user?.rol || req.user?.role || "asesor");
    const allowed = new Set(EDIT_PERMS[role] || []);
    if (!allowed.has('etapa')) return res.status(403).json({ ok:false, reason:'SIN_PERMISOS' });

    const set = { etapa };

    if (etapa === 'lost') {
      const rz = String(razonDesecho ?? '').trim();
      if (!rz) return res.status(400).json({ ok:false, reason:'FALTA_RAZON' });
      if (!allowed.has('razonDesecho')) return res.status(403).json({ ok:false, reason:'SIN_PERMISOS' });
      set.razonDesecho = rz;
    } else {
      set.razonDesecho = '';
    }

    const opp = await Oportunidad.findByIdAndUpdate(id, { $set: set }, { new: true }).lean();
    if (!opp) return res.status(404).json({ ok:false, reason:'NOT_FOUND' });

    return res.json({ ok:true, etapa: opp.etapa, razonDesecho: opp.razonDesecho });
  } catch (err) {
    console.error('[moverOportunidad] Error:', err);
    return res.status(500).json({ ok:false, reason:'ERROR_INTERNO' });
  }
}
