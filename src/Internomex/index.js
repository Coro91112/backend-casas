import { Router } from 'express';
import AltasInternomexRoutes from './altasInternomex.routes.js';

const InternomexRouter = Router();

// Todo lo de altasInternomex vive en "/"
InternomexRouter.use('/', AltasInternomexRoutes);

export default InternomexRouter;
