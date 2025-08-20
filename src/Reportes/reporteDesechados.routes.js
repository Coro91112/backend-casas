import { Router } from "express";
import { getReporteDesechados } from "./controllers/reporteDesechados.get.js";

const router = Router();

// GET /ReporteDesechados?month=YYYY-MM  (ej. 2025-08)
router.get("/", getReporteDesechados);

export default router;
