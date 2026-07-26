import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, apiKey, x-cron-secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const bodyData = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const numero = bodyData.numero || bodyData.number || bodyData.phone || req.query?.numero || '';
    const mensagem = bodyData.mensagem || bodyData.message || bodyData.text || req.query?.mensagem || '';
    const imagemUrl = bodyData.imagemUrl || bodyData.image || bodyData.caption || '';

    const cleaned = String(numero).replace(/\D/g, '');
    if (!cleaned) {
      return res.status(400).json({ error: 'Número de telefone é obrigatório.' });
    }

    if (!mensagem && !imagemUrl) {
      return res.status(400).json({ error: 'Mensagem ou imagem é obrigatória.' });
    }

    const fullNumber = cleaned.startsWith('55') || cleaned.length > 11 ? cleaned : `55${cleaned}`;

    const appKey = process.env.WHATSAPP_APP_KEY || process.env.BOTBOT_APP_KEY || '';
    const authKey = process.env.WHATSAPP_AUTH_KEY || process.env.BOTBOT_AUTH_KEY || process.env.BOTBOT_TOKEN || process.env.WHATSAPP_API_KEY || '';
    const apiUrl = process.env.WHATSAPP_API_URL || process.env.BOTBOT_API_URL || process.env.WHATSAPP_BOT_URL || 'https://api.botbot.chat/v1/send';

    const payload = {
      appkey: appKey,
      authkey: authKey,
      number: fullNumber,
      phone: fullNumber,
      recipient: fullNumber,
      message: mensagem,
      text: mensagem,
      caption: mensagem,
      image: imagemUrl
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (appKey) headers['appkey'] = appKey;
    if (authKey) {
      headers['authkey'] = authKey;
      headers['Authorization'] = `Bearer ${authKey}`;
      headers['x-api-key'] = authKey;
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    const resText = await response.text();
    let apiResponse: any = {};
    try {
      apiResponse = JSON.parse(resText);
    } catch (e) {
      apiResponse = { raw: resText };
    }

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: apiResponse.error || apiResponse.message || `Erro na API externa (${response.status}): ${resText}`
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Mensagem enviada com sucesso.',
      numero: fullNumber,
      apiResponse
    });
  } catch (err: any) {
    console.error('Erro em /api/send-whatsapp:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Erro interno ao conectar com a API do WhatsApp'
    });
  }
}
