import { Router } from 'express';
import { pedirAlta, pedirAltaReubicacion } from '../controllers/alta.post.js';
import { intentoAlta } from '../controllers/intentoAlta.post.js';
import { directorioOpciones } from '../controllers/directorio.get.js';
import { syncFromNeodata } from '../controllers/syncFromNedodata.post.js';
import { attachUser } from '../middleware/attachUser.js';
import { listOportunidades } from '../controllers/list.get.js';
import { bulkAsignarOportunidades } from '../controllers/bulkAssign.post.js';
import { actualizarContacto } from '../controllers/contacto.post.js';
import { moverOportunidad } from '../controllers/move.post.js';
import { desecharOportunidades } from '../controllers/desechar.post.js';
import { pedirAltaInternomex } from '../controllers/internomex.post.js';

// ==== NUEVO Reparto ====
import { getRepartoOptions } from '../controllers/reparto.options.get.js';
import { previewReparto } from '../controllers/reparto.preview.post.js';
import { executeReparto } from '../controllers/reparto.execute.post.js';
import { getRepartoSettings } from '../controllers/reparto.settings.get.js';
import { saveRepartoSettings } from '../controllers/reparto.settings.post.js';

const router = Router();
router.use(attachUser);

router.post('/altas/pedir', pedirAlta);
router.post('/altas/reubicacion', pedirAltaReubicacion);
router.post('/altas/intentarlo', intentoAlta);

router.get('/directorio/opciones', directorioOpciones);
router.get('/list', listOportunidades);

router.post('/bulk/asignar', bulkAsignarOportunidades);
router.post('/contacto/actualizar', actualizarContacto);

router.post('/mover', moverOportunidad);
router.post('/desechar', desecharOportunidades);

// Internomex
router.post('/internomex/pedir', pedirAltaInternomex);

router.post('/sync', syncFromNeodata);

// ==== NUEVO: Reparto (config + cálculo + ejecución) ====
router.get('/reparto/options', getRepartoOptions);
router.get('/reparto/settings', getRepartoSettings);
router.post('/reparto/settings', saveRepartoSettings);
router.post('/reparto/preview', previewReparto);
router.post('/reparto/execute', executeReparto);

export default router;
