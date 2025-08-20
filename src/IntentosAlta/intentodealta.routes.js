import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

import { attachUser } from '../Oportunidades/middleware/attachUser.js';
import { listIntentosAlta, getIntentoAlta } from './controllers/intentos.get.js';
import { aceptarIntento, rechazarIntento } from './controllers/intentos.patch.js';
import { postMessage, postImage } from './controllers/chat.post.js';
import { debugResolve, debugList } from './controllers/dedbug.post.js';

const router = Router();
router.use(attachUser);

// si no viene usuario, asumimos admin SOLO en endpoints de debug
const asAdminIfMissing = (req, _res, next) => {
  if (!req.user || !req.user.rol) {
    req.user = { nombre: 'Postman Debug', rol: 'admin' };
  }
  next();
};

/* ====== uploads ====== */
const UPLOAD_DIR = path.resolve('uploads/intentos');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ts = Date.now();
    const ext = path.extname(file.originalname || '');
    cb(null, `${ts}-${Math.random().toString(36).slice(2)}${ext}`);
  }
});
const upload = multer({ storage });

/* ====== Endpoints normales ====== */
router.get('/altas', listIntentosAlta);
router.get('/altas/:id', getIntentoAlta);
router.patch('/altas/:id/aceptar',  aceptarIntento);
router.patch('/altas/:id/rechazar', rechazarIntento);
router.post('/altas/:id/chat', postMessage);
router.post('/altas/:id/chat/image', upload.single('image'), postImage);

/* ====== Endpoints de debug (POST + body raw) ====== */
router.post('/debug/resolve', asAdminIfMissing, debugResolve); // body: { id? , lote? }
router.post('/debug/list',    asAdminIfMissing, debugList);    // body: { status?, q? }

export default router;
