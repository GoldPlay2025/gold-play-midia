import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const defaultConfig = {
  diasAntecedencia: 2,
  horarioDisparo: "09:00",
  ativo: false,
  mensagemTemplate: "Ola {cliente}, seu vencimento da mensalidade R$ {valor} e em {vencimento}. Chave PIX: {pix}",
  logs: []
};

function getSupabase() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }
  return createClient(supabaseUrl, supabaseKey);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Configuração CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-api-key'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supabase = getSupabase();

  if (req.method === 'GET') {
    try {
      if (supabase) {
        const queryPromise = supabase
          .from('automacao_config')
          .select('*')
          .eq('id', 'sistema')
          .maybeSingle();

        const timeoutPromise = new Promise((resolve) => 
          setTimeout(() => resolve({ data: null, error: { message: 'Timeout' } }), 1000)
        );

        const { data, error }: any = await Promise.race([queryPromise, timeoutPromise]);

        if (!error && data) {
          return res.status(200).json({
            diasAntecedencia: typeof data.dias_antecedencia === 'number' ? data.dias_antecedencia : 2,
            horarioDisparo: data.horario_disparo || "09:00",
            ativo: typeof data.ativo === 'boolean' ? data.ativo : false,
            mensagemTemplate: data.mensagem_template || defaultConfig.mensagemTemplate,
            lastRunDate: data.last_run_date || undefined,
            logs: Array.isArray(data.logs) ? data.logs : []
          });
        }
      }
      return res.status(200).json(defaultConfig);
    } catch (err: any) {
      console.error('Erro no Vercel handler GET /api/automacao/config:', err);
      return res.status(200).json(defaultConfig);
    }
  }

  if (req.method === 'POST') {
    try {
      const bodyData = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const { diasAntecedencia, horarioDisparo, ativo, mensagemTemplate } = bodyData;

      const updated = {
        diasAntecedencia: typeof diasAntecedencia === 'number' ? Math.max(0, diasAntecedencia) : 2,
        horarioDisparo: typeof horarioDisparo === 'string' && horarioDisparo.trim() ? horarioDisparo.trim() : "09:00",
        ativo: typeof ativo === 'boolean' ? ativo : false,
        mensagemTemplate: typeof mensagemTemplate === 'string' && mensagemTemplate ? mensagemTemplate : defaultConfig.mensagemTemplate,
        logs: []
      };

      if (supabase) {
        const upsertPromise = supabase.from('automacao_config').upsert({
          id: 'sistema',
          dias_antecedencia: updated.diasAntecedencia,
          horario_disparo: updated.horarioDisparo,
          ativo: updated.ativo,
          mensagem_template: updated.mensagemTemplate,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });

        const timeoutWrite = new Promise((resolve) => 
          setTimeout(() => resolve({ error: { message: 'Timeout write' } }), 1000)
        );

        // Executa sem travar a resposta HTTP
        Promise.race([upsertPromise, timeoutWrite]).catch(err => {
          console.warn('[Vercel config] Upsert em segundo plano:', err);
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Configurações salvas com sucesso.',
        config: updated
      });
    } catch (err: any) {
      console.error('Erro no Vercel handler POST /api/automacao/config:', err);
      return res.status(500).json({ error: 'Erro ao salvar configurações: ' + (err?.message || String(err)) });
    }
  }

  return res.status(405).json({ error: 'Método não permitido.' });
}
