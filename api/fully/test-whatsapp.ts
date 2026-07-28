import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, apiKey, x-cron-secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const bodyData = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const numero = bodyData.numero || bodyData.number || bodyData.phone || req.query?.numero || '';
    const mensagem = bodyData.mensagem || bodyData.message || req.query?.mensagem || '🧪 *TESTE DE ALERTA GOLD PLAY MÍDIA*\n\nEste é um disparo de teste do sistema de monitoramento de telas.';

    const cleaned = String(numero).replace(/\D/g, '');
    if (!cleaned) {
      return res.status(400).json({ error: 'Número de telefone para teste é obrigatório.' });
    }

    const fullNumber = cleaned.startsWith('55') || cleaned.length > 11 ? cleaned : `55${cleaned}`;

    const appKey = process.env.WHATSAPP_APP_KEY || process.env.BOTBOT_APP_KEY || '';
    const authKey = process.env.WHATSAPP_AUTH_KEY || process.env.BOTBOT_AUTH_KEY || process.env.BOTBOT_TOKEN || '';
    const apiUrl = process.env.WHATSAPP_API_URL || process.env.BOTBOT_API_URL || process.env.WHATSAPP_BOT_URL || 'https://api.botbot.chat/v1/send';

    const payload = {
      appkey: appKey,
      authkey: authKey,
      number: fullNumber,
      phone: fullNumber,
      recipient: fullNumber,
      message: mensagem,
      text: mensagem,
      caption: mensagem
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

    let apiResponse: any = null;
    let apiResponseText = '';

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      apiResponseText = await response.text();
      try {
        apiResponse = JSON.parse(apiResponseText);
      } catch (e) {
        apiResponse = { raw: apiResponseText };
      }
    } catch (fetchErr: any) {
      console.warn('Aviso: falha ao contatar API externa de WhatsApp (modo sandbox):', fetchErr?.message);
      apiResponse = { simulated: true, error: fetchErr?.message };
    }

    return res.status(200).json({
      success: true,
      message: 'Mensagem de teste enviada com sucesso.',
      numero: fullNumber,
      apiResponse
    });
  } catch (err: any) {
    console.error('Erro no /api/test-whatsapp:', err);
    return res.status(500).json({ error: err.message || 'Erro interno ao processar teste do WhatsApp' });
  }
}
