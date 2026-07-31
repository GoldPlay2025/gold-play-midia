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

    let configData: any = null;
    try {
      const configPromise = Promise.resolve(supabase
        .from('automacao_config')
        .select('*')
        .eq('id', 'sistema')
        .maybeSingle());
        
      const configRes: any = await Promise.race([
        configPromise,
        new Promise(resolve => { const t = setTimeout(() => resolve({ data: null }), 3000); configPromise.finally(() => clearTimeout(t)); })
      ]);
      configData = configRes?.data;
    } catch (e) {
      console.warn("Erro ao buscar config no run-now:", e);
    }

    const config = {
      diasAntecedencia: configData && typeof configData.dias_antecedencia === 'number' ? configData.dias_antecedencia : 2,
      mensagemTemplate: configData?.mensagem_template || "Ola {cliente}, seu vencimento da mensalidade R$ {valor} e em {vencimento}. Chave PIX: {pix}",
      logs: configData && Array.isArray(configData.logs) ? configData.logs : []
    };

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + config.diasAntecedencia);
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

    let allClients: any[] = [];
    try {
      const clientsPromise = Promise.resolve(supabase
        .from('clientes')
        .select('*'));
        
      const clientsRes: any = await Promise.race([
        clientsPromise,
        new Promise(resolve => { const t = setTimeout(() => resolve({ data: [] }), 4000); clientsPromise.finally(() => clearTimeout(t)); })
      ]);
      allClients = clientsRes?.data || [];
    } catch (e) {
      console.warn("Erro ao buscar clientes no run-now:", e);
    }

    const clients = allClients.filter(cli => matchesTargetDate(cli.vencimento, targetIsoDate));

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
      const pixPromise = Promise.resolve(supabase.from('configuracoes').select('pix_key, pix_chave').eq('id', 'sistema').maybeSingle());
      const pixRes: any = await Promise.race([
        pixPromise,
        new Promise(resolve => { const t = setTimeout(() => resolve({ data: null }), 2000); pixPromise.finally(() => clearTimeout(t)); })
      ]);
      if (pixRes?.data) pixChave = pixRes.data.pix_key || pixRes.data.pix_chave || '';
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
        timeoutMs: 5000 // reduzido para não travar vercel
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

    try {
      const upsertPromise = supabase.from('automacao_config').upsert({
        id: 'sistema',
        logs: updatedLogs,
        last_run_date: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
      
      await Promise.race([
        upsertPromise,
        new Promise(resolve => setTimeout(() => resolve({}), 3000))
      ]);
    } catch(e) {}

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
