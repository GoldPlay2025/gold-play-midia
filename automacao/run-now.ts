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
    const supabase = getSupabase();
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase não configurado no Vercel.' });
    }

    const { data: configData } = await supabase
      .from('automacao_config')
      .select('*')
      .eq('id', 'sistema')
      .maybeSingle();

    const config = {
      diasAntecedencia: configData && typeof configData.dias_antecedencia === 'number' ? configData.dias_antecedencia : 2,
      mensagemTemplate: configData?.mensagem_template || "Ola {cliente}, seu vencimento da mensalidade R$ {valor} e em {vencimento}. Chave PIX: {pix}",
      logs: configData && Array.isArray(configData.logs) ? configData.logs : []
    };

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + config.diasAntecedencia);
    const targetIsoDate = targetDate.toISOString().split('T')[0];

    const { data: allClients, error: clientErr } = await supabase
      .from('clientes')
      .select('*');

    if (clientErr) {
      return res.status(500).json({ error: 'Erro ao buscar clientes: ' + clientErr.message });
    }

    const clients = (allClients || []).filter(cli => {
      if (!cli.vencimento) return false;
      try {
        const cliVencStr = new Date(cli.vencimento).toISOString().split('T')[0];
        return cliVencStr === targetIsoDate;
      } catch (e) {
        return String(cli.vencimento).startsWith(targetIsoDate);
      }
    });

    if (clientErr) {
      return res.status(500).json({ error: 'Erro ao buscar clientes: ' + clientErr.message });
    }

    if (!clients || clients.length === 0) {
      return res.status(200).json({
        success: true,
        message: `Nenhum cliente elegível encontrado para o vencimento ${targetIsoDate}.`,
        count: 0
      });
    }

    // Busca chave PIX
    let pixChave = '';
    try {
      const { data: conf } = await supabase.from('configuracoes').select('pix_chave').eq('id', 'sistema').maybeSingle();
      if (conf?.pix_chave) pixChave = conf.pix_chave;
    } catch (e) {}

    let dispatched = 0;
    const newLogs: any[] = [];

    for (const client of clients) {
      const phoneRaw = client.whatsapp || client.telefone || client.contato;
      if (!phoneRaw) continue;

      const valorFormatted = client.valor ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(client.valor) : '0,00';
      const vencFormatted = client.vencimento ? new Date(client.vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '';

      const text = config.mensagemTemplate
        .replace('{cliente}', client.nome_empresa || 'Cliente')
        .replace('{valor}', valorFormatted)
        .replace('{vencimento}', vencFormatted)
        .replace('{pix}', pixChave || '');

      const smsResult = await sendGtiSms({
        numero: phoneRaw,
        mensagem: text,
        timeoutMs: 12000
      });

      if (smsResult.success) dispatched++;

      newLogs.push({
        id: 'auto-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        data: new Date().toISOString(),
        telefone: phoneRaw,
        clienteNome: client.nome_empresa,
        status: smsResult.success ? 'sucesso' : 'erro',
        mensagem: text,
        detalhe: smsResult.message,
        tipo: 'automatico'
      });
    }

    const updatedLogs = [...newLogs, ...config.logs].slice(0, 200);

    await supabase.from('automacao_config').upsert({
      id: 'sistema',
      logs: updatedLogs,
      last_run_date: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });

    return res.status(200).json({
      success: true,
      message: `Varredura concluída! ${dispatched} SMS(s) disparado(s) com sucesso de ${clients.length} elegíveis.`,
      count: dispatched
    });
  } catch (err: any) {
    console.error('Erro em /api/automacao/run-now:', err);
    return res.status(500).json({ error: 'Erro ao executar varredura: ' + (err?.message || String(err)) });
  }
}

