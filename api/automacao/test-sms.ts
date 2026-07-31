import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { sendGtiSms } from '../../src/lib/gtisms';

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

    // Executa disparo de SMS seguro via helper robusto
    const smsResult = await sendGtiSms({
      numero,
      mensagem: testMsg,
      timeoutMs: 5000
    });

    const cleaned = String(numero).replace(/\D/g, '');
    const fullNumber = cleaned.startsWith('55') || cleaned.length > 11 ? cleaned : `55${cleaned}`;

    // Tenta atualizar log no Supabase em background rápido
    const supabase = getSupabase();
    if (supabase) {
      const newLog = {
        id: 'test-' + Date.now(),
        data: new Date().toISOString(),
        telefone: fullNumber,
        status: smsResult.success ? 'sucesso' : 'erro',
        mensagem: testMsg,
        detalhe: smsResult.message,
        tipo: 'manual'
      };

      // Tenta log sem travar a resposta da Vercel Function
      (async () => {
        try {
          const { data: configData } = await supabase
            .from('automacao_config')
            .select('logs')
            .eq('id', 'sistema')
            .maybeSingle();

          const logs = configData && Array.isArray(configData.logs) ? configData.logs : [];
          logs.unshift(newLog);
          if (logs.length > 100) logs.pop();

          await supabase.from('automacao_config').upsert({
            id: 'sistema',
            logs,
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' });
        } catch (e) {}
      })();
    }

    if (smsResult.success) {
      return res.status(200).json({
        success: true,
        message: `SMS de teste enviado com sucesso para ${fullNumber}!`,
        details: smsResult
      });
    } else {
      return res.status(400).json({
        success: false,
        error: smsResult.message || 'Falha ao enviar SMS via GetSMS.',
        details: smsResult
      });
    }
  } catch (err: any) {
    console.error('Erro em /api/automacao/test-sms:', err);
    return res.status(500).json({ error: 'Erro ao processar teste SMS: ' + (err?.message || String(err)) });
  }
}

