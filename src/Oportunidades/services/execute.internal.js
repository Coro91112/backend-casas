import { executeReparto } from '../controllers/reparto.execute.post.js';

export async function executeRepartoInternal(reqLike) {
  return new Promise((resolve) => {
    const res = {
      json: (d)=>resolve(d),
      status: ()=>({ json: (d)=>resolve(d) })
    };
    executeReparto(reqLike, res);
  });
}
