import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendGtiSms } from '../../src/lib/gtisms';

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

    const smsResult = await sendGtiSms({
      numero,
      mensagem,
      timeoutMs: 5000
    });

    if (smsResult.success) {
      return res.status(200).json({ success: true, message: 'SMS enviado com sucesso', data: smsResult.rawResponse });
    } else {
      return res.status(400).json({ error: smsResult.message, details: smsResult });
    }
  } catch (err: any) {
    console.error('Erro ao enviar SMS:', err);
    return res.status(500).json({ error: 'Falha ao processar envio de SMS: ' + (err?.message || String(err)) });
  }
}

