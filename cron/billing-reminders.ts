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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const supabase = getSupabase();
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase não configurado no Vercel' });
    }

    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = req.headers.authorization || '';
      const querySecret = req.query?.secret || req.headers['x-cron-secret'];
      const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : (authHeader as string);

      if (token !== cronSecret && querySecret !== cronSecret) {
        return res.status(401).json({ error: 'Não autorizado: CRON_SECRET inválido' });
      }
    }

    // 1. Busca configurações da automação
    const { data: configData } = await supabase
      .from('automacao_config')
      .select('*')
      .eq('id', 'sistema')
      .maybeSingle();

    const isAtivo = configData?.ativo === true || configData?.ativo === 'true';
    if (!isAtivo) {
      return res.status(200).json({
        success: true,
        action: 'billing_reminders_skipped',
        message: 'Robô de automação de cobrança está PAUSADO. Nenhuma mensagem disparada.',
        timestamp: new Date().toISOString()
      });
    }

    const diasAntecedencia = typeof configData?.dias_antecedencia === 'number' ? configData.dias_antecedencia : 2;
    const mensagemTemplate = configData?.mensagem_template || "Ola {cliente}, seu vencimento da mensalidade R$ {valor} e em {vencimento}. Chave PIX: {pix}";
    const existingLogs = Array.isArray(configData?.logs) ? configData.logs : [];

    // 2. Calcula data alvo (hoje + N dias)
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + diasAntecedencia);
    const targetIsoDate = targetDate.toISOString().split('T')[0];

    // Helper para comparar data de vencimento (aceita DD/MM/YYYY, ISO, timestamp)
    const matchesTargetDate = (vencimento: any, target: string) => {
      if (!vencimento) return false;
      const str = String(vencimento).trim();
      if (str.startsWith(target)) return true;
      if (str.includes('/')) {
        const parts = str.split('/');
        if (parts.length === 3) {
          const day = parts[0].padStart(2, '0');
          const month = parts[1].padStart(2, '0');
          const year = parts[2].trim();
          if (`${year}-${month}-${day}` === target) return true;
        }
      }
      try {
        const d = new Date(vencimento);
        if (!isNaN(d.getTime())) {
          if (d.toISOString().split('T')[0] === target) return true;
        }
      } catch (e) {}
      return false;
    };

    // 3. Busca clientes e filtra os que vencem na data alvo
    const { data: allClients, error: clientErr } = await supabase
      .from('clientes')
      .select('*');

    if (clientErr) {
      return res.status(500).json({ error: 'Erro ao buscar clientes no Vercel Cron: ' + clientErr.message });
    }

    const clients = (allClients || []).filter(cli => matchesTargetDate(cli.vencimento, targetIsoDate));

    if (!clients || clients.length === 0) {
      return res.status(200).json({
        success: true,
        action: 'billing_reminders_executed',
        message: `Nenhum cliente com vencimento em ${targetIsoDate} (antecedência de ${diasAntecedencia} dias).`,
        count: 0
      });
    }

    // 4. Busca chave PIX
    let pixChave = '';
    try {
      const { data: conf } = await supabase.from('configuracoes').select('pix_key, pix_chave').eq('id', 'sistema').maybeSingle();
      if (conf) pixChave = conf.pix_key || conf.pix_chave || '';
    } catch (e) {}

    let dispatched = 0;
    const newLogs: any[] = [];

    // 5. Dispara para cada cliente
    for (const client of clients) {
      const phoneRaw = client.whatsapp || client.telefone || client.contato;
      if (!phoneRaw) continue;

      const valorFormatted = client.valor ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(client.valor) : '0,00';
      const vencFormatted = client.vencimento ? new Date(client.vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '';

      const text = mensagemTemplate
        .replace('{cliente}', client.nome_empresa || 'Cliente')
        .replace('{valor}', valorFormatted)
        .replace('{vencimento}', vencFormatted)
        .replace('{pix}', pixChave || '');

      const smsRes = await sendGtiSms({
        numero: phoneRaw,
        mensagem: text,
        timeoutMs: 12000
      });

      if (smsRes.success) dispatched++;

      newLogs.push({
        id: 'cron-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        data: new Date().toISOString(),
        telefone: phoneRaw,
        clienteNome: client.nome_empresa,
        status: smsRes.success ? 'sucesso' : 'erro',
        mensagem: text,
        detalhe: smsRes.message,
        tipo: 'automatico'
      });
    }

    // 6. Atualiza logs
    const updatedLogs = [...newLogs, ...existingLogs].slice(0, 200);
    await supabase.from('automacao_config').upsert({
      id: 'sistema',
      last_run_date: new Date().toISOString(),
      logs: updatedLogs,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });

    return res.status(200).json({
      success: true,
      action: 'billing_reminders_executed',
      message: `Cron concluído com sucesso! Disparados ${dispatched} SMS(s) para ${clients.length} cliente(s).`,
      dispatchedCount: dispatched,
      eligibleCount: clients.length,
      targetDate: targetIsoDate
    });
  } catch (err: any) {
    console.error('Erro no cron de cobranças:', err);
    return res.status(500).json({ error: err.message || 'Erro no cron de cobranças' });
  }
}

