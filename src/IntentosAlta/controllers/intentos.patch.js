import { OportunidadIntentoAlta } from '../model.oportunidadesIntentosDeAlta(1).js';
import { COLL_ES2, roleSideForApproval } from './_scope.js';

function recordAction(apr, action, user){
  apr.history = apr.history || [];
  apr.history.push({
    at: new Date(),
    by: { id:String(user?._id||''), nombre:user?.nombre||'', rol:user?.rol||'' },
    action
  });
}

export async function aceptarIntento(req, res){
  try{
    const { id } = req.params;
    const doc = await OportunidadIntentoAlta.findById(id);
    if (!doc) return res.status(404).json({ ok:false, reason:'NOT_FOUND' });

    const side = roleSideForApproval(doc, req.user);
    if (!side && req.user?.rol!=='admin'){
      return res.status(403).json({ ok:false, reason:'NO_ES_TU_APROBACION' });
    }

    // set flag
    if (!doc.aprobaciones) doc.aprobaciones = {};
    if (side === 'solicita') {
      doc.aprobaciones.solicita = true;
      recordAction(doc.aprobaciones, 'ACEPTAR_SOLICITA', req.user);
    } else if (side === 'dueno') {
      doc.aprobaciones.dueno = true;
      recordAction(doc.aprobaciones, 'ACEPTAR_DUENO', req.user);
    } else {
      // admin: marca ambas si quiere
      doc.aprobaciones.solicita = true;
      doc.aprobaciones.dueno = true;
      recordAction(doc.aprobaciones, 'ACEPTAR_ADMIN', req.user);
    }

    // si ambos true => Aceptadas
    if (doc.aprobaciones.solicita === true && doc.aprobaciones.dueno === true){
      doc.estatus = 'Aceptadas';
    }

    await doc.save();
    res.json({ ok:true, estatus: doc.estatus, aprobaciones: doc.aprobaciones });
  } catch(e){
    console.error('[aceptarIntento] ', e);
    res.status(500).json({ ok:false, reason:'SERVER_ERROR' });
  }
}

export async function rechazarIntento(req, res){
  try{
    const { id } = req.params;
    const doc = await OportunidadIntentoAlta.findById(id);
    if (!doc) return res.status(404).json({ ok:false, reason:'NOT_FOUND' });

    const side = roleSideForApproval(doc, req.user);
    if (!side && req.user?.rol!=='admin'){
      return res.status(403).json({ ok:false, reason:'NO_ES_TU_APROBACION' });
    }

    if (!doc.aprobaciones) doc.aprobaciones = {};
    if (side === 'solicita') {
      doc.aprobaciones.solicita = false;
      recordAction(doc.aprobaciones, 'RECHAZAR_SOLICITA', req.user);
    } else if (side === 'dueno') {
      doc.aprobaciones.dueno = false;
      recordAction(doc.aprobaciones, 'RECHAZAR_DUENO', req.user);
    } else {
      // admin rechaza directo
      doc.aprobaciones.solicita = false;
      doc.aprobaciones.dueno = false;
      recordAction(doc.aprobaciones, 'RECHAZAR_ADMIN', req.user);
    }

    doc.estatus = 'Rechazadas';
    await doc.save();
    res.json({ ok:true, estatus: doc.estatus, aprobaciones: doc.aprobaciones });
  } catch(e){
    console.error('[rechazarIntento] ', e);
    res.status(500).json({ ok:false, reason:'SERVER_ERROR' });
  }
}
