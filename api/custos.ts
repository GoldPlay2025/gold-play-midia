import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-api-key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supabase = getSupabase();

  if (req.method === 'GET') {
    try {
      if (supabase) {
        const { data, error } = await supabase.from('custos').select('*').order('data_pagamento', { ascending: false });
        if (!error && Array.isArray(data)) {
          return res.status(200).json(data);
        }
      }
      return res.status(200).json([]);
    } catch (e) {
      return res.status(200).json([]);
    }
  }

  if (req.method === 'POST') {
    try {
      const bodyData = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const { id, descricao, valor, data_pagamento, recorrencia, categoria, observacoes } = bodyData;
      const costId = id || ('cost-' + Date.now());
      const newCost = {
        id: costId,
        descricao,
        valor: Number(valor) || 0,
        data_pagamento: data_pagamento || new Date().toISOString().split('T')[0],
        recorrencia: recorrencia || 'Anual',
        categoria: categoria || 'Licença Fully Kiosk',
        observacoes: observacoes || ''
      };

      if (supabase) {
        await supabase.from('custos').upsert(newCost, { onConflict: 'id' });
      }

      return res.status(200).json(newCost);
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Erro ao salvar custo' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { id } = req.query;
      if (id && supabase) {
        await supabase.from('custos').delete().eq('id', String(id));
      }
      return res.status(200).json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Erro ao deletar custo' });
    }
  }

  return res.status(405).json({ error: 'Método não permitido' });
}
