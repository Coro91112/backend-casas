import { Router } from 'express';
import {
  listUsers,
  getUser,
  updateUser,
  createUser,
  deleteUser,
  listSubdirectores,
  findByLeaders,      // ← agrega este import
} from './controller.js';

const router = Router();

router.get('/users', listUsers);
router.get('/users/:id', getUser);
router.patch('/users/:id', updateUser);
router.post('/users', createUser);
router.delete('/users/:id', deleteUser);

router.get('/subdirectores', listSubdirectores);

// 🔎 nuevo endpoint de prueba para Postman:
router.post('/users/findByLeaders', findByLeaders);

export default router;
