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

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(503).json({ error: 'Supabase não configurado no Vercel' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    let screen: any = null;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idToSearch);
    
    if (isUuid) {
      const { data } = await supabase
        .from('telas')
        .select('id, nome_local, status_online, alert_sent, identificador_unico, clientes(nome_empresa)')
        .eq('id', idToSearch)
        .maybeSingle();
      if (data) screen = data;
    }

    if (!screen) {
      const { data } = await supabase
        .from('telas')
        .select('id, nome_local, status_online, alert_sent, identificador_unico, clientes(nome_empresa)')
        .or(`id.ilike.${idToSearch}%,fully_device_id.eq.${idToSearch},identificador_unico.eq.${idToSearch.toUpperCase()},identificador_unico.eq.${idToSearch}`)
        .maybeSingle();
      if (data) screen = data;
    }

    if (!screen) {
      return res.status(404).json({ error: 'Tela não encontrada para heartbeat', deviceId: idToSearch });
    }

    const wasOffline = screen.status_online === false || screen.alert_sent === true;

    const nowIso = new Date().toISOString();
    await supabase
      .from('telas')
      .update({
        last_ping: nowIso,
        status_online: true,
        alert_sent: false
      })
      .eq('id', screen.id);

    // Se estava offline, dispara alerta de reconexão ONLINE
    if (wasOffline) {
      try {
        const { data: configData } = await supabase
          .from('configuracoes')
          .select('alerts_enabled, admin_phone')
          .eq('id', 'sistema')
          .maybeSingle();

        if (configData?.alerts_enabled && configData?.admin_phone?.trim()) {
          const adminPhone = configData.admin_phone.trim();
          const nomeTela = screen.nome_local || 'Tela sem nome';
          const nomeCliente = (screen as any).clientes?.nome_empresa || '';
          const idUnico = screen.identificador_unico || screen.id;
          const horarioText = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

          const onlineAlertMessage = `✅ *ALERTA GOLD PLAY MÍDIA*\n\n` +
            `A tela *${nomeTela}*${nomeCliente ? ` (${nomeCliente})` : ''} voltou a ficar *ONLINE*!\n` +
            `📍 *ID:* ${idUnico}\n` +
            `🕒 *Horário:* ${horarioText}\n` +
            `✅ *Status:* Conexão reestabelecida.`;

          const cleaned = adminPhone.replace(/\D/g, '');
          const fullNumber = cleaned.startsWith('55') || cleaned.length > 11 ? cleaned : `55${cleaned}`;

          // Envio de SMS via GTI SMS
          if (process.env.GTISMS_API_TOKEN) {
            try {
              let smsUrl = process.env.GTISMS_API_URL || 'https://sms.gtisms.com/api/v3/sms/send';
              if (!smsUrl.includes('sms/send')) {
                smsUrl = 'https://sms.gtisms.com/api/v3/sms/send';
              }
              const smsToken = process.env.GTISMS_API_TOKEN;
              let senderId = (process.env.GTISMS_SENDER_ID || '').trim();
              if (senderId.startsWith('http') || senderId.length > 11 || senderId.length === 0) {
                senderId = '';
              }

              const sanitizeSms = (text: string) => {
                let sanitized = text.replace(/[\u00A0\u200B\u200C\u200D\u20FE\uFEFF]/g, ' ');
                sanitized = sanitized.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
                sanitized = sanitized.replace(/[*_~`]/g, '');
                sanitized = sanitized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                sanitized = sanitized.replace(/[^\x00-\x7F]/g, '');
                return sanitized.trim();
              };

              const shortOnlineMsg = `Gold Play: A tela ${nomeTela}${nomeCliente ? ` (${nomeCliente})` : ''} voltou a ficar online.`;
              const finalOnlineMsg = sanitizeSms(shortOnlineMsg).substring(0, 155);

              const payload: any = {
                recipient: fullNumber,
                message: finalOnlineMsg,
                type: 'plain'
              };
              if (senderId) payload.sender_id = senderId;

              await fetch(smsUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                  'Authorization': `Bearer ${smsToken}`
                },
                body: JSON.stringify(payload)
              });
            } catch (smsErr) {
              console.error('Erro ao enviar SMS de reconexão:', smsErr);
            }
          }

          // Envio via BotBot / WhatsApp
          try {
            const targetUrl = process.env.BOTBOT_API_URL || process.env.WHATSAPP_BOT_URL || process.env.WHATSAPP_API_URL || 'https://api.botbot.chat/v1/send';
            const appKey = process.env.WHATSAPP_APP_KEY || process.env.BOTBOT_APP_KEY || '';
            const authKey = process.env.WHATSAPP_AUTH_KEY || process.env.BOTBOT_AUTH_KEY || process.env.BOTBOT_TOKEN || '';

            if (appKey || authKey) {
              const payload = {
                appkey: appKey,
                authkey: authKey,
                number: fullNumber,
                phone: fullNumber,
                recipient: fullNumber,
                message: onlineAlertMessage,
                text: onlineAlertMessage,
                caption: onlineAlertMessage
              };

              const headers: Record<string, string> = { 'Content-Type': 'application/json' };
              if (appKey) headers['appkey'] = appKey;
              if (authKey) {
                headers['authkey'] = authKey;
                headers['Authorization'] = `Bearer ${authKey}`;
                headers['x-api-key'] = authKey;
              }

              await fetch(targetUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
              });
            }
          } catch (botErr) {
            console.error('Erro ao enviar WhatsApp de reconexão:', botErr);
          }
        }
      } catch (errAlert) {
        console.error('Erro ao processar alerta online:', errAlert);
      }
    }

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
