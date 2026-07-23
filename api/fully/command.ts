import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Configure CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const { deviceId, action, newUrl } = req.body || {};
    
    const apiToken = process.env.FULLY_API_TOKEN || process.env.FULLY_API_KEY;
    const apiEmail = process.env.FULLY_API_EMAIL;

    if (!apiToken) {
      return res.status(503).json({ error: 'FULLY_API_TOKEN (ou FULLY_API_KEY) não configurado nas variáveis da Vercel.' });
    }

    if (!deviceId || !action) {
      return res.status(400).json({ error: 'O deviceId e a action são obrigatórios.' });
    }

    // Mapeamento de comandos
    let fullyCmd = action;
    if (action === 'reload') fullyCmd = 'loadStartUrl';
    if (action === 'restart') fullyCmd = 'restartApp';

    let extraParams = '';
    if (action === 'change_url' || action === 'loadURL') {
      if (!newUrl) {
        return res.status(400).json({ error: 'A propriedade newUrl é obrigatória para alterar a URL.' });
      }
      fullyCmd = 'loadURL';
      extraParams = `&url=${encodeURIComponent(newUrl)}`;
    }

    const emailParam = apiEmail ? `&apiemail=${encodeURIComponent(apiEmail)}` : '';
    const fullyUrl = `https://api.fully-kiosk.com/remote/?cmd=${fullyCmd}&devid=${encodeURIComponent(deviceId)}${emailParam}&apikey=${encodeURIComponent(apiToken)}${extraParams}&type=json`;

    const response = await fetch(fullyUrl, {
      method: 'GET',
    });

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("text/html")) {
      return res.status(502).json({ 
        error: "A API do Fully Cloud retornou HTML em vez de JSON. Verifique se FULLY_API_EMAIL, FULLY_API_TOKEN e o Device ID estão corretos." 
      });
    }

    const responseText = await response.text();
    
    let data;
    try {
      data = responseText ? JSON.parse(responseText) : { status: 'Success', statustext: 'Comando enviado com sucesso' };
    } catch (e) {
      data = { status: 'Success', text: responseText };
    }

    if (data && data.status === 'Error') {
      return res.status(400).json({ error: data.statustext || 'Erro retornado pela API do Fully Kiosk.' });
    }

    return res.status(200).json(data);

  } catch (error: any) {
    console.error("Erro na API do Fully:", error);
    return res.status(500).json({ error: error.message || 'Falha de comunicação com o Fully Kiosk Cloud' });
  }
}
