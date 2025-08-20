import { previewReparto } from '../controllers/reparto.preview.post.js';

export async function previewRepartoInternal(reqLike) {
  return new Promise((resolve) => {
    const res = {
      json: (d)=>resolve(d),
      status: ()=>({ json: (d)=>resolve(d) })
    };
    previewReparto(reqLike, res);
  });
}
