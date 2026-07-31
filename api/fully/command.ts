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
    const { deviceId, action, newUrl, customApiToken, customApiEmail } = req.body || {};
    
    let apiToken = (customApiToken || process.env.FULLY_API_TOKEN || process.env.FULLY_API_KEY || '').trim();
    let apiEmail = (customApiEmail || process.env.FULLY_API_EMAIL || '').trim();

    if (apiToken === 'YOUR_FULLY_API_TOKEN' || apiToken === 'MY_FULLY_API_TOKEN') {
      apiToken = '';
    }

    if (!apiToken) {
      return res.status(400).json({ 
        requiresConfig: true,
        error: "O Token de API do Fully Cloud não está configurado. Por favor, clique em 'Login / Configurar Fully Cloud' para salvar seu API Token e E-mail da conta." 
      });
    }

    if (!deviceId || !action) {
      return res.status(400).json({ error: 'O deviceId e a action são obrigatórios.' });
    }

    const cleanDeviceId = String(deviceId).trim();

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
      extraParams = `&url=${encodeURIComponent(newUrl.trim())}`;
    }

    const emailParam = apiEmail ? `&email=${encodeURIComponent(apiEmail)}&apiemail=${encodeURIComponent(apiEmail)}` : '';

    // Tenta 1º endpoint: Cloud REST API
    const cloudUrl = `https://cloud.fully-kiosk.com/api/?cmd=${fullyCmd}&devid=${encodeURIComponent(cleanDeviceId)}&password=${encodeURIComponent(apiToken)}&apikey=${encodeURIComponent(apiToken)}${emailParam}${extraParams}&type=json`;

    let response = await fetch(cloudUrl, { method: 'GET' });
    let responseText = await response.text();

    let data: any;
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch (e) {
      data = { status: 'Success', statustext: responseText };
    }

    // Se falhar no 1º endpoint, tenta Remote Admin API
    if (data?.status === 'Error' || (data?.statustext && data.statustext.toLowerCase().includes('login'))) {
      const remoteUrl = `https://api.fully-kiosk.com/remote/?cmd=${fullyCmd}&devid=${encodeURIComponent(cleanDeviceId)}&password=${encodeURIComponent(apiToken)}&apikey=${encodeURIComponent(apiToken)}${emailParam}${extraParams}&type=json`;
      const remoteResp = await fetch(remoteUrl, { method: 'GET' });
      const remoteText = await remoteResp.text();
      try {
        const remoteData = JSON.parse(remoteText);
        if (remoteData?.status === 'Success' || (remoteData?.statustext && !remoteData.statustext.toLowerCase().includes('login'))) {
          data = remoteData;
        }
      } catch (e) {}
    }

    if (data && (data.status === 'Error' || data.statustext?.toLowerCase().includes('error') || data.statustext?.toLowerCase().includes('login'))) {
      if (data.statustext?.toLowerCase().includes('login') || data.statustext?.toLowerCase().includes('key') || data.statustext?.toLowerCase().includes('access')) {
        return res.status(400).json({ 
          requiresConfig: true,
          error: `Erro de Autenticação no Fully Cloud: "${data.statustext}". Por favor, clique no botão 'Login / Configurar Fully Cloud' e salve seu API Token/Senha e E-mail da conta.` 
        });
      }
      return res.status(400).json({ error: data.statustext || 'Erro retornado pela API do Fully Kiosk.' });
    }

    return res.status(200).json(data);

  } catch (error: any) {
    console.error("Erro na API do Fully:", error);
    return res.status(500).json({ error: error.message || 'Falha de comunicação com o Fully Kiosk Cloud' });
  }
}
