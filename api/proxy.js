export default async function handler(req, res) {
  // 1. Headers CORS standard
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée.' });

  // 2. Récupération de l'URL Google Apps Script
  const GAS_URL = process.env.GAS_API_URL || 'https://script.google.com/macros/s/AKfycbxBy16eBpB5hlS7E95-Cjx-JSXI4E90A6FjT_Rfn4vdeBLxFlvf1DXSLtHtsm3IXrlBxg/exec';

  const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

  try {
    // 3. Appel à Google (fetch suit le redirect 302 nativement, comme Google l'attend)
    const gasRes = await fetch(GAS_URL, {
      method: 'POST',
      headers: {
        // Le content-type 'text/plain' est obligatoire pour éviter 
        // le blocage CORS preflight (OPTIONS) de Google Apps Script.
        'Content-Type': 'text/plain'
      },
      body: body
    });

    const text = await gasRes.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.error('[proxy] Réponse invalide:', text.slice(0, 300));
      return res.status(502).json({ error: 'Erreur format réponse Google : ' + text.slice(0, 150) });
    }

    // 4. Renvoi du JSON valide au frontend
    return res.status(200).json(data);

  } catch (err) {
    console.error('[proxy] Erreur réseau:', err);
    return res.status(500).json({ error: 'Erreur proxy interne : ' + err.message });
  }
}