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
      return res.status(200).json({ count: 0, targetDate: new Date().toISOString().split('T')[0], clients: [] });
    }

    const queryDias = req.query.dias ? Number(req.query.dias) : NaN;
    let diasAntecedencia = !isNaN(queryDias) ? queryDias : 2;

    if (isNaN(queryDias)) {
      try {
        const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 1500));
        const configPromise = (async () => {
          try {
            return await supabase.from('automacao_config').select('*').eq('id', 'sistema').maybeSingle();
          } catch (e) {
            return { data: null };
          }
        })();

        const configRes: any = await Promise.race([configPromise, timeoutPromise]);
        if (configRes?.data && typeof configRes.data.dias_antecedencia === 'number') {
          diasAntecedencia = configRes.data.dias_antecedencia;
        }
      } catch (e) {
        console.warn("Erro ao buscar config no preview:", e);
      }
    }

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + diasAntecedencia);
    const targetIsoDate = targetDate.toISOString().split('T')[0];

    let allClients: any[] = [];
    try {
      const timeoutPromise = new Promise(resolve => setTimeout(() => resolve([]), 2500));
      const clientsPromise = (async () => {
        try {
          const { data } = await supabase.from('clientes').select('*');
          return data || [];
        } catch (e) {
          return [];
        }
      })();

      const clientsRes: any = await Promise.race([clientsPromise, timeoutPromise]);
      allClients = Array.isArray(clientsRes) ? clientsRes : [];
    } catch (e) {
      console.warn("Erro ao buscar clientes no preview:", e);
    }

    const clients = allClients.filter(cli => {
      if (!cli.vencimento) return false;
      const str = String(cli.vencimento).trim();
      if (str.startsWith(targetIsoDate)) return true;
      try {
        if (str.includes('/')) {
          const parts = str.split('/');
          if (parts.length === 3) {
            const formatted = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            if (formatted === targetIsoDate) return true;
          }
        }
        const dStr = new Date(cli.vencimento).toISOString().split('T')[0];
        return dStr === targetIsoDate;
      } catch (e) {
        return false;
      }
    });

    return res.status(200).json({
      count: clients.length,
      targetDate: targetIsoDate,
      clients: clients
    });

  } catch (err: any) {
    console.error('Erro em /api/automacao/preview-clients:', err);
    return res.status(200).json({ count: 0, targetDate: new Date().toISOString().split('T')[0], clients: [] });
  }
}
