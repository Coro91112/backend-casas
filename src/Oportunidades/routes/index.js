import { Router } from 'express';
import OportunidadesRoutes from './oportunidades.routes.js';

const router = Router();
router.use('/', OportunidadesRoutes);

export default router;
