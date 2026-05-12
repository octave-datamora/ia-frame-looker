/**
 * Vercel Serverless Proxy — GA4 Assistant
 * =========================================
 * Problème résolu : Google Apps Script renvoie un 302 sur les requêtes POST.
 * fetch() suit ce redirect en changeant POST → GET (spec HTTP/1.1 §10.3.3),
 * ce qui fait que GAS reçoit un GET sans body → répond avec la page HTML Google.
 *
 * Solution : redirect:'manual' + suivi manuel en POST pour préserver le body.
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée.' });

  const gasUrl = req.query.to;
  if (!gasUrl) return res.status(400).json({ error: 'Paramètre ?to= manquant.' });

  const body = typeof req.body === 'string'
    ? req.body
    : JSON.stringify(req.body);

  // Suit les redirects en gardant POST + body (max 5 sauts)
  async function postWithRedirects(url, attempt = 1) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        // User-Agent navigateur pour éviter les blocages anti-bot de Google
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
      },
      body,
      redirect: 'manual', // On intercepte le redirect manuellement
    });

    // 301 / 302 / 303 / 307 / 308 → on suit en POST (pas en GET)
    if (response.status >= 300 && response.status < 400 && attempt < 6) {
      const location = response.headers.get('location');
      if (location) {
        console.log(`[proxy] Redirect ${response.status} → ${location} (tentative ${attempt})`);
        return postWithRedirects(location, attempt + 1);
      }
    }

    return response;
  }

  try {
    const gasRes = await postWithRedirects(gasUrl);
    const text = await gasRes.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      // Aide au debug : on logue le début de la réponse inattendue
      console.error('[proxy] Réponse non-JSON (status', gasRes.status, ') :', text.slice(0, 400));
      return res.status(502).json({
        error: 'Réponse GAS non-JSON (status ' + gasRes.status + ') : ' + text.slice(0, 200),
      });
    }

    return res.status(200).json(data);

  } catch (err) {
    console.error('[proxy] Erreur fetch :', err);
    return res.status(500).json({ error: 'Proxy error : ' + err.message });
  }
}
