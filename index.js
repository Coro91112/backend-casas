import { Router } from 'express';

import LoginRoute from './src/Directorio/auth.routes.js';
import DirectorioRoutes from './src/Directorio/routes.js';
import OportunidadesRoutes from './src/Oportunidades/routes/index.js';

// OJO al case según tu carpeta real (Neodata vs neodata)

import InternomexRoutes from './src/Internomex/index.js';
import IntentosAltaRoutes from './src/IntentosAlta/index.js';
import ReporteDesechadosRoutes from "./src/Reportes/reporteDesechados.routes.js";

const router = Router();

router.use('/', LoginRoute);
router.use('/Directorio', DirectorioRoutes);
router.use('/Oportunidades', OportunidadesRoutes);
router.use('/Internomex', InternomexRoutes);
router.use('/IntentoAlta', IntentosAltaRoutes);
router.use('/ReporteDesechados', ReporteDesechadosRoutes);

export default router;
