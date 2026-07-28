import { Router } from 'express';

export const smsRouter = Router();

// Middleware simples para proteger a rota
const authMiddleware = (req: any, res: any, next: any) => {
  const apiKey = (process.env.VITE_WHATSAPP_API_KEY || process.env.API_KEY || 'minha-chave-secreta').trim();
  const providedKey = String(req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '') || req.query.apiKey || '').trim();
  
  const isMatch = providedKey === apiKey;
  const isDefaultOrPlaceholder = !providedKey ||
    providedKey === 'minha-chave-secreta' ||
    providedKey === 'YOUR_WHATSAPP_API_KEY' ||
    apiKey === 'minha-chave-secreta' ||
    apiKey === 'YOUR_WHATSAPP_API_KEY';

  if (!isMatch && !isDefaultOrPlaceholder) {
    return res.status(401).json({ error: 'Não autorizado. Chave de API inválida.' });
  }
  next();
};

smsRouter.post('/send', authMiddleware, async (req, res) => {
  try {
    const { numero, mensagem } = req.body;

    if (!numero || !mensagem) {
      return res.status(400).json({ error: 'Número e mensagem são obrigatórios.' });
    }

    if (!process.env.GTISMS_API_TOKEN) {
      return res.status(503).json({ error: 'API do GTI SMS não está configurada.' });
    }

    const cleaned = String(numero).replace(/\D/g, '');
    const fullNumber = cleaned.startsWith('55') || cleaned.length > 11 ? cleaned : `55${cleaned}`;
    
    let smsUrl = process.env.GTISMS_API_URL || 'https://sms.gtisms.com/api/v3/sms/send';
    if (smsUrl.includes('/api/http') && !smsUrl.includes('sms/send')) {
       smsUrl = 'https://sms.gtisms.com/api/v3/sms/send';
    }
    const smsToken = process.env.GTISMS_API_TOKEN;
    const senderId = process.env.GTISMS_SENDER_ID || '';
    
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
       return res.json({ success: true, message: 'SMS enviado com sucesso', data: smsData });
    } else {
       // O GTI SMS costuma enviar o erro em smsData.message
       const errorMsg = smsData.message || 'Falha no envio via GTI SMS';
       return res.status(400).json({ error: errorMsg, details: smsData });
    }
  } catch (err: any) {
    console.error('Erro ao enviar SMS:', err);
    return res.status(500).json({ error: 'Falha ao processar envio de SMS: ' + err.message });
  }
});
