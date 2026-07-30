import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Configuração do CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-api-key'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const { numero, mensagem } = req.body || {};

    if (!numero || !mensagem) {
      return res.status(400).json({ error: 'Número e mensagem são obrigatórios.' });
    }

    const smsToken = process.env.GTISMS_API_TOKEN;
    if (!smsToken) {
      return res.status(503).json({ error: 'A variável de ambiente GTISMS_API_TOKEN não está configurada no Vercel.' });
    }

    const cleaned = String(numero).replace(/\D/g, '');
    const fullNumber = cleaned.startsWith('55') || cleaned.length > 11 ? cleaned : `55${cleaned}`;
    
    let smsUrl = process.env.GTISMS_API_URL || 'https://sms.gtisms.com/api/v3/sms/send';
    if (smsUrl.includes('/api/http') && !smsUrl.includes('sms/send')) {
       smsUrl = 'https://sms.gtisms.com/api/v3/sms/send';
    }
    let senderId = process.env.GTISMS_SENDER_ID || '';
    if (senderId.startsWith('http') || senderId.length > 20) {
      senderId = '';
    }
    
    const sanitizeSms = (text: string) => {
      let sanitized = text.replace(/[\u00A0\u200B\u200C\u200D\u20FE\uFEFF]/g, ' ');
      sanitized = sanitized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      sanitized = sanitized.replace(/[^\x00-\x7F]/g, '');
      return sanitized;
    };
    
    const payload: any = {
      recipient: fullNumber,
      message: sanitizeSms(mensagem),
      type: 'plain'
    };
    
    if (senderId) {
      payload.sender_id = senderId;
    }

    const smsResp = await fetch(smsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${smsToken}`
      },
      body: JSON.stringify(payload)
    });
    
    const rawText = await smsResp.text();
    let smsData: any;
    try {
       smsData = JSON.parse(rawText);
    } catch(e) {
       return res.status(500).json({ error: `Erro na API GTI SMS: HTTP ${smsResp.status}`, details: rawText });
    }

    if (smsResp.ok && smsData.status === 'success') {
       return res.status(200).json({ success: true, message: 'SMS enviado com sucesso', data: smsData });
    } else {
       const errorMsg = smsData.message || 'Falha no envio via GTI SMS';
       return res.status(400).json({ error: errorMsg, details: smsData });
    }
  } catch (err: any) {
    console.error('Erro ao enviar SMS:', err);
    return res.status(500).json({ error: 'Falha ao processar envio de SMS: ' + (err?.message || String(err)) });
  }
}
