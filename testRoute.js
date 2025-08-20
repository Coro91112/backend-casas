import { Router } from 'express';

const router = Router();
router.post('/echo', async (req, res) => {
  try {
    const { text } = req.body || {};
    if (typeof text !== 'string') {
      return res.status(400).json({ ok: false, error: 'text is required (string)' });
    }
    return res.json({ ok: true, echo: text });
  } catch (err) {
    console.error('Echo error:', err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

export default router;
