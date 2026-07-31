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
  
  if (!supabase) {
    return res.status(500).json({ erro: 'Credenciais do Supabase não configuradas nas variáveis de ambiente da Vercel.' });
  }

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase.from('automacao_config').select('*').maybeSingle();
      
      if (error || !data) {
        return res.status(200).json(defaultConfig);
      }
      return res.status(200).json(data);
    }

if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('automacao_config')
        .select('*')
        .eq('id', 'sistema')
        .maybeSingle();

      if (error || !data) {
        return res.status(200).json(defaultConfig);
      }

      return res.status(200).json({
        diasAntecedencia: typeof data.dias_antecedencia === 'number' ? data.dias_antecedencia : 2,
        horarioDisparo: data.horario_disparo || "09:00",
        ativo: typeof data.ativo === 'boolean' ? data.ativo : false,
        mensagemTemplate: data.mensagem_template || defaultConfig.mensagemTemplate,
        lastRunDate: data.last_run_date || undefined
      });
    } catch (err: any) {
      return res.status(200).json(defaultConfig);
    }
  }
