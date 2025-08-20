// src/Internomex/altasInternomex.routes.js
import { Router } from 'express';
import { listAltasInternomex, getAlta } from './controllers/altas.get.js';
import { aceptarAlta, rechazarAlta, compartirAlta } from './controllers/altas.patch.js';
import { listGerentes } from './controllers/gerentes.get.js';
import { attachUser } from '../Oportunidades/middleware/attachUser.js';

const router = Router();
router.use(attachUser);

router.get('/altas', listAltasInternomex);
router.get('/altas/:id', getAlta);
router.patch('/altas/:id/aceptar', aceptarAlta);
router.patch('/altas/:id/rechazar', rechazarAlta);
router.patch('/altas/:id/compartir', compartirAlta);

// 👇 para el modal de compartir:
router.get('/gerentes', listGerentes);

export default router;
