import { OportunidadIntentoAlta } from '../model.oportunidadesIntentosDeAlta(1).js';
import { COLL_ES2, buildOwnershipFilter } from './_scope.js';

function safeLike(q=''){
  const s = String(q||'').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(s, 'i');
}

export async function listIntentosAlta(req, res){
  try{
    let { status = 'Pendientes', q = '' } = req.query || {};
    status = String(status || '').trim();
    const and = [];

    // alcance por rol
    const scope = buildOwnershipFilter(req.user);
    if (scope && Object.keys(scope).length) and.push(scope);

    // filtro estatus tolerante
    if (status && status !== 'Todas') {
      if (/^pendientes$/i.test(status)) {
        and.push({
          $or: [
            { estatus: { $exists: false } },
            { estatus: { $regex: '^pendiente(s)?$', $options: 'i' } },
            { estatus: '' }
          ]
        });
      } else if (/^aceptadas$/i.test(status)) {
        and.push({ estatus: { $regex: '^aceptadas$', $options: 'i' } });
      } else if (/^rechazadas$/i.test(status)) {
        and.push({ estatus: { $regex: '^rechazadas$', $options: 'i' } });
      }
    }

    // primer $match (por alcance/estatus)
    const pipeline = [];
    if (and.length) pipeline.push({ $match: { $and: and } });

    // ========= nombre coalesce =========
    // Variantes en raíz y anidadas
const namePaths = [
  '\ufeffNombre cliente',   // 👈 BOM (¡la PRIORIDAD!)
  'Nombre cliente',
  'Nombre Cliente',
  'Nombre','nombre',
  'Cliente','cliente',
  'solicitadorPor.\ufeffNombre cliente',
  'solicitadorPor.Nombre cliente',
  'solicitadorPor.Nombre Cliente',
  'solicitadorPor.Nombre','solicitadorPor.Cliente',
  'solicitadoPor.\ufeffNombre cliente',
  'solicitadoPor.Nombre cliente',
  'solicitadoPor.Nombre Cliente',
  'solicitadoPor.Nombre','solicitadoPor.Cliente',
];
    // construimos $ifNull anidado: ((( $a ?? $b ) ?? $c ) ?? '')
    const nameExpr = namePaths.reduceRight((acc, p) => ({ $ifNull: [ `$${p}`, acc ] }), '');

    pipeline.push({
      $addFields: {
        nombreCoalesced: nameExpr,
        estatusNorm: {
          $cond: [
            { $or: [
              { $eq: [ { $ifNull: ['$estatus', '' ] }, '' ] },
              { $regexMatch: { input: '$estatus', regex: /^pendiente(s)?$/i } }
            ]},
            'Pendientes',
            '$estatus'
          ]
        }
      }
    });

    // búsqueda (ahora que ya tenemos nombreCoalesced)
    if (q && String(q).trim()) {
      const rx = safeLike(q.trim());
      pipeline.push({
        $match: {
          $or: [
            { Lote: rx },
            { nombreCoalesced: rx },
            { GerenteDueno: rx },
            { GerenteSolicita: rx },
          ]
        }
      });
    }

    // proyección final
    pipeline.push({
      $project: {
        Lote:1, GerenteDueno:1, GerenteSolicita:1,
        estatus: '$estatusNorm',
        nombre: '$nombreCoalesced',
        createdAt:1
      }
    });
    pipeline.push({ $sort: { createdAt: -1 } });
    pipeline.push({ $limit: 500 });

    const items = await OportunidadIntentoAlta.aggregate(pipeline).collation(COLL_ES2);

    const mapped = items.map(it => ({
      id: String(it._id),
      nombre: it.nombre || '',
      lote: it.Lote || '',
      gerente: it.GerenteDueno || '',
      intentaAlta: it.GerenteSolicita || '',
      estatus: it.estatus || 'Pendientes',
    }));

    res.json({ ok:true, items: mapped });
  } catch(e){
    console.error('[listIntentosAlta] ', e);
    res.status(500).json({ ok:false, reason:'SERVER_ERROR' });
  }
}
export async function getIntentoAlta(req, res){
  try{
    const { id } = req.params;

    const namePaths = [
      'Nombre cliente','Nombre Cliente','Nombre','nombre',
      'Cliente','cliente',
      'solicitadorPor.Nombre cliente','solicitadorPor.Nombre Cliente',
      'solicitadorPor.Nombre','solicitadorPor.Cliente',
      'solicitadoPor.Nombre cliente','solicitadoPor.Nombre Cliente',
      'solicitadoPor.Nombre','solicitadoPor.Cliente',
    ];
    const nameExpr = namePaths.reduceRight((acc, p) => ({ $ifNull: [ `$${p}`, acc ] }), '');

    const [doc] = await OportunidadIntentoAlta.aggregate([
      { $match: { _id: new (await import('mongoose')).default.Types.ObjectId(id) } },
      { $addFields: {
          nombreCoalesced: nameExpr,
          estatusNorm: {
            $cond: [
              { $or: [
                { $eq: [ { $ifNull: ['$estatus', '' ] }, '' ] },
                { $regexMatch: { input: '$estatus', regex: /^pendiente(s)?$/i } }
              ]},
              'Pendientes',
              '$estatus'
            ]
          }
        }
      },
      { $project: { 
          Lote:1, GerenteDueno:1, GerenteSolicita:1,
          estatus:'$estatusNorm', nombre:'$nombreCoalesced',
          messages:1, aprobaciones:1, createdAt:1, updatedAt:1
        } 
      }
    ]).collation(COLL_ES2);

    if (!doc) return res.status(404).json({ ok:false, reason:'NOT_FOUND' });

    // alcance (mantenlo si quieres, usando findOne; o hazlo previo con pipeline)
    const scope = buildOwnershipFilter(req.user);
    if (scope && Object.keys(scope).length){
      const canSee = await OportunidadIntentoAlta.findOne({ _id:id, ...scope }).lean();
      if (!canSee && req.user?.rol!=='admin'){
        return res.status(403).json({ ok:false, reason:'FORBIDDEN' });
      }
    }

    res.json({ ok:true, item: doc });
  } catch(e){
    console.error('[getIntentoAlta] ', e);
    res.status(500).json({ ok:false, reason:'SERVER_ERROR' });
  }
}