import { Router } from 'express';
import IntentoAltaRoutes from './intentodealta.routes.js';

const IntentosAltaRouter = Router();
IntentosAltaRouter.use('/', IntentoAltaRoutes);

export default IntentosAltaRouter;
