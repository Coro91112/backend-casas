import { OportunidadIntentoAlta } from '../model.oportunidadesIntentosDeAlta(1).js';

export async function postMessage(req, res){
  try{
    const { id } = req.params;
    const { text } = req.body || {};
    const doc = await OportunidadIntentoAlta.findById(id);
    if (!doc) return res.status(404).json({ ok:false, reason:'NOT_FOUND' });

    // (opcional) checar alcance aquí si quieres

    const msg = {
      at: new Date(),
      by: { id:String(req.user?._id||''), nombre:req.user?.nombre||'', rol:req.user?.rol||'' },
      text: String(text||'').trim(),
      files: []
    };
    doc.messages.push(msg);
    await doc.save();

    res.json({ ok:true, message: msg });
  } catch(e){
    console.error('[postMessage] ', e);
    res.status(500).json({ ok:false, reason:'SERVER_ERROR' });
  }
}

// Upload de imagen (multer mete req.file)
export async function postImage(req, res){
  try{
    const { id } = req.params;
    const doc = await OportunidadIntentoAlta.findById(id);
    if (!doc) return res.status(404).json({ ok:false, reason:'NOT_FOUND' });

    if (!req.file) return res.status(400).json({ ok:false, reason:'NO_FILE' });

    const fileObj = {
      url: `/uploads/intentos/${req.file.filename}`,
      name: req.file.originalname,
      mime: req.file.mimetype,
      size: req.file.size
    };

    const msg = {
      at: new Date(),
      by: { id:String(req.user?._id||''), nombre:req.user?.nombre||'', rol:req.user?.rol||'' },
      text: '',
      files: [fileObj]
    };

    doc.messages.push(msg);
    await doc.save();

    res.json({ ok:true, message: msg });
  } catch(e){
    console.error('[postImage] ', e);
    res.status(500).json({ ok:false, reason:'SERVER_ERROR' });
  }
}
