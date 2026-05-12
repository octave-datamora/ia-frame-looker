/**
 * Vercel Serverless Proxy — GA4 Assistant
 * =========================================
 * Reçoit la requête du frontend (même origine → pas de CORS/sandbox Looker)
 * et la retransmet à Google Apps Script côté serveur (serveur→serveur, pas de CORS).
 *
 * Usage : POST /api/proxy?to=<GAS_URL_encodée>
 */

export default async function handler(req, res) {
  // Headers CORS permissifs pour le frontend (même si même origine, par sécurité)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée.' });
  }

  const gasUrl = req.query.to;
  if (!gasUrl) {
    return res.status(400).json({ error: 'Paramètre ?to= manquant (URL GAS).' });
  }

  try {
    // Appel GAS server-to-server — Content-Type text/plain pour éviter le preflight côté GAS
    const body = typeof req.body === 'string'
      ? req.body
      : JSON.stringify(req.body);

    const gasRes = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body,
      redirect: 'follow',
    });

    const text = await gasRes.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      // GAS a renvoyé quelque chose d'inattendu
      return res.status(502).json({ error: 'Réponse GAS non-JSON : ' + text.slice(0, 200) });
    }

    return res.status(200).json(data);

  } catch (err) {
    console.error('[proxy] Erreur fetch GAS :', err);
    return res.status(500).json({ error: 'Proxy error : ' + err.message });
  }
}
