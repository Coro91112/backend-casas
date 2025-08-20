// src/Oportunidades/controllers/desecho.motivos.get.js
export async function desechoMotivos(req, res) {
  // TODO: después leer de una colección de ajustes / CMS
  const motivos = [
    "Incontactable",
    "No está interesado",
    "No tiene capital",
    "Quiere comprar más adelante",
  ];
  return res.json({ ok: true, motivos });
}
