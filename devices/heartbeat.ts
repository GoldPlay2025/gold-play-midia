import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const bodyData = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const { deviceId, telaId } = { ...req.query, ...bodyData } as any;
    const idToSearch = (deviceId || telaId || '').trim();

    if (!idToSearch) {
      return res.status(400).json({ error: 'deviceId ou telaId é obrigatório' });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(503).json({ error: 'Supabase não configurado' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    let screen: any = null;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idToSearch);
    
    if (isUuid) {
      const { data } = await supabase.from('telas').select('id, nome_local').eq('id', idToSearch).maybeSingle();
      if (data) screen = data;
    }

    if (!screen) {
      const { data } = await supabase
        .from('telas')
        .select('id, nome_local')
        .or(`fully_device_id.eq.${idToSearch},identificador_unico.eq.${idToSearch.toUpperCase()},identificador_unico.eq.${idToSearch}`)
        .maybeSingle();
      if (data) screen = data;
    }

    if (!screen) {
      return res.status(404).json({ error: 'Tela não encontrada para heartbeat', deviceId: idToSearch });
    }

    const nowIso = new Date().toISOString();
    await supabase
      .from('telas')
      .update({
        last_ping: nowIso,
        status_online: true,
        alert_sent: false
      })
      .eq('id', screen.id);

    return res.status(200).json({
      success: true,
      screenId: screen.id,
      nome_local: screen.nome_local,
      last_ping: nowIso,
      alert_sent_reset: true
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Erro interno no servidor' });
  }
}
