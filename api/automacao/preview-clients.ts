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
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-api-key'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const supabase = getSupabase();
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase não configurado no Vercel.' });
    }

    let configData: any = null;
    try {
      const configPromise = supabase
        .from('automacao_config')
        .select('*')
        .eq('id', 'sistema')
        .maybeSingle();
        
      let timer: any;
      const configRes: any = await Promise.race([
        configPromise,
        new Promise(resolve => {
          timer = setTimeout(() => resolve({ data: null }), 3000);
        })
      ]);
      clearTimeout(timer);
      configData = configRes?.data;
    } catch (e) {
      console.warn("Erro ao buscar config:", e);
    }

    const diasAntecedencia = configData && typeof configData.dias_antecedencia === 'number' ? configData.dias_antecedencia : 2;

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + diasAntecedencia);
    const targetIsoDate = targetDate.toISOString().split('T')[0];

    let allClients: any[] = [];
    try {
      const clientsPromise = supabase
        .from('clientes')
        .select('*');
        
      let timer: any;
      const clientsRes: any = await Promise.race([
        clientsPromise,
        new Promise(resolve => {
          timer = setTimeout(() => resolve({ data: [] }), 4000);
        })
      ]);
      clearTimeout(timer);
      allClients = clientsRes?.data || [];
    } catch (e) {
      console.warn("Erro ao buscar clientes:", e);
    }

    const clients = allClients.filter(cli => {
      if (!cli.vencimento) return false;
      try {
        const cliVencStr = new Date(cli.vencimento).toISOString().split('T')[0];
        return cliVencStr === targetIsoDate;
      } catch (e) {
        return String(cli.vencimento).startsWith(targetIsoDate);
      }
    });

    return res.status(200).json({
      count: clients.length || 0,
      targetDate: targetIsoDate,
      clients: clients || []
    });

  } catch (err: any) {
    console.error('Erro em /api/automacao/preview-clients:', err);
    return res.status(500).json({ error: 'Erro ao buscar prévia: ' + (err?.message || String(err)) });
  }
}
