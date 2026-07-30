import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }
  return createClient(supabaseUrl, supabaseKey);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-api-key'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const bodyData = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const { numero, mensagemTeste } = bodyData;

    if (!numero || !String(numero).trim()) {
      return res.status(400).json({ error: 'Número de telefone de destino é obrigatório.' });
    }

    const testMsg = mensagemTeste || 'Ola! Este e um disparo de teste da Automacao Gold Play via GetSMS.';
    const smsToken = process.env.GTISMS_API_TOKEN;

    if (!smsToken) {
      return res.status(503).json({ error: 'Token da API GetSMS (GTISMS_API_TOKEN) não configurado nas variáveis de ambiente da Vercel.' });
    }

    const cleaned = String(numero).replace(/\D/g, '');
    const fullNumber = cleaned.startsWith('55') || cleaned.length > 11 ? cleaned : `55${cleaned}`;

    let smsUrl = process.env.GTISMS_API_URL || 'https://sms.gtisms.com/api/v3/sms/send';
    if (smsUrl.includes('/api/http') && !smsUrl.includes('sms/send')) {
      smsUrl = 'https://sms.gtisms.com/api/v3/sms/send';
    }
    const senderId = process.env.GTISMS_SENDER_ID || '';

    const sanitizeSms = (text: string) => {
      let sanitized = text.replace(/[\u00A0\u200B\u200C\u200D\u20FE\uFEFF]/g, ' ');
      sanitized = sanitized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      sanitized = sanitized.replace(/[^\x00-\x7F]/g, '');
      return sanitized;
    };

    const payload: any = {
      recipient: fullNumber,
      message: sanitizeSms(testMsg),
      type: 'plain'
    };
    if (senderId) payload.sender_id = senderId;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    let smsResp: Response;
    try {
      smsResp = await fetch(smsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${smsToken}`
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      return res.status(504).json({
        success: false,
        error: fetchErr.name === 'AbortError' ? 'Tempo de conexão esgotado ao acessar o servidor GetSMS.' : 'Erro ao conectar ao GetSMS: ' + fetchErr.message
      });
    }
    clearTimeout(timeoutId);

    const rawText = await smsResp.text();
    let smsData: any;
    try {
      smsData = JSON.parse(rawText);
    } catch (e) {
      smsData = { rawResponse: rawText };
    }

    const isSuccess = smsResp.ok && (smsData.status === 'success' || smsData.success === true);

    // Registrar log no Supabase se disponível (não bloqueante / com timeout rápido)
    const supabase = getSupabase();
    if (supabase) {
      try {
        const queryPromise = supabase
          .from('automacao_config')
          .select('*')
          .eq('id', 'sistema')
          .maybeSingle();

        const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve({ data: null }), 1500));
        const { data: configData }: any = await Promise.race([queryPromise, timeoutPromise]);

        const logs = configData && Array.isArray(configData.logs) ? configData.logs : [];
        const newLog = {
          id: 'test-' + Date.now(),
          data: new Date().toISOString(),
          telefone: fullNumber,
          status: isSuccess ? 'sucesso' : 'erro',
          mensagem: testMsg,
          detalhe: isSuccess ? 'Enviado com sucesso' : (smsData.message || rawText),
          tipo: 'manual'
        };

        logs.unshift(newLog);
        if (logs.length > 200) logs.pop();

        const upsertPromise = supabase.from('automacao_config').upsert({
          id: 'sistema',
          logs,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });

        const timeoutWrite = new Promise((resolve) => setTimeout(() => resolve(null), 1500));
        await Promise.race([upsertPromise, timeoutWrite]);
      } catch (logErr) {
        console.error('Erro ao gravar log de teste:', logErr);
      }
    }

    if (isSuccess) {
      return res.status(200).json({
        success: true,
        message: `SMS de teste enviado com sucesso para ${fullNumber}!`,
        response: smsData
      });
    } else {
      return res.status(400).json({
        success: false,
        error: smsData.message || 'Falha ao enviar SMS via GetSMS.',
        details: smsData
      });
    }
  } catch (err: any) {
    console.error('Erro em /api/automacao/test-sms:', err);
    return res.status(500).json({ error: 'Erro ao processar teste SMS: ' + (err?.message || String(err)) });
  }
}
