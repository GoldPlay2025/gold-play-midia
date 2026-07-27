import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

export const monitoringRouter = Router();

function getSupabaseClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('placeholder')) {
    return null;
  }
  return createClient(supabaseUrl, supabaseKey);
}

// 1. Heartbeat route for Player/TV Box
monitoringRouter.post('/heartbeat', async (req, res) => {
  try {
    const { deviceId, telaId } = req.body || req.query || {};
    const idToSearch = (deviceId || telaId || '').trim();

    if (!idToSearch) {
      return res.status(400).json({ error: 'deviceId ou telaId é obrigatório' });
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(503).json({ error: 'Cliente Supabase não configurado no servidor' });
    }

    // Tenta encontrar a tela por UUID, fully_device_id ou identificador_unico
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

    // Atualiza last_ping, status_online e reseta alert_sent para false
    const nowIso = new Date().toISOString();
    const { error: updateErr } = await supabase
      .from('telas')
      .update({
        last_ping: nowIso,
        status_online: true,
        alert_sent: false
      })
      .eq('id', screen.id);

    if (updateErr) {
      console.error('Erro ao atualizar heartbeat:', updateErr);
      return res.status(500).json({ error: updateErr.message });
    }

    return res.json({
      success: true,
      screenId: screen.id,
      nome_local: screen.nome_local,
      last_ping: nowIso,
      alert_sent_reset: true
    });
  } catch (err: any) {
    console.error('Erro no /api/devices/heartbeat:', err);
    return res.status(500).json({ error: err.message || 'Erro interno no servidor' });
  }
});

monitoringRouter.get('/heartbeat', async (req, res) => {
  const { deviceId, telaId } = req.query as any;
  if (!deviceId && !telaId) {
    return res.json({ status: 'ok', message: 'API de Heartbeat ativa' });
  }

  req.body = { deviceId: deviceId || telaId };
  // Trata como POST
  return res.redirect(307, '/api/devices/heartbeat');
});

// 2. Rota de Cron para checagem de telas offline e disparo de alertas WhatsApp
monitoringRouter.all('/check-offline', async (req, res) => {
  try {
    // Validação de segurança via CRON_SECRET
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = req.headers.authorization || '';
      const querySecret = req.query?.secret || req.headers['x-cron-secret'];
      const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : (authHeader as string);

      if (token !== cronSecret && querySecret !== cronSecret) {
        return res.status(401).json({ 
          error: 'Não autorizado. Token CRON_SECRET inválido ou não fornecido.',
          message: 'Envie o token no cabeçalho Authorization: Bearer <CRON_SECRET> ou parâmetro ?secret=<CRON_SECRET>'
        });
      }
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase não configurado no servidor' });
    }

    // a) Busca configurações de alertas de forma segura
    let alertsEnabled = false;
    let adminPhone = '';

    try {
      const { data: configData } = await supabase
        .from('configuracoes')
        .select('*')
        .eq('id', 'sistema')
        .maybeSingle();

      if (configData) {
        alertsEnabled = configData.alerts_enabled ?? false;
        adminPhone = (configData.admin_phone || '').trim();
      }
    } catch (errConfig) {
      console.warn('Aviso ao consultar configuracoes em monitoringRoutes:', errConfig);
    }

    if (!alertsEnabled || !adminPhone) {
      return res.json({
        success: true,
        action: 'skipped',
        reason: !alertsEnabled ? 'Alertas desativados ou pendentes de criação no banco' : 'Número do WhatsApp do Administrador não configurado',
        alertsEnabled,
        adminPhone
      });
    }

    // b) Busca telas com last_ping > 20 minutos ou sem ping criadas há > 20 minutos e alert_sent = false
    const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();

    const { data: screens, error: queryErr } = await supabase
      .from('telas')
      .select('*, clientes(nome_empresa)');

    if (queryErr) {
      return res.status(500).json({ error: 'Falha ao consultar telas', details: queryErr.message });
    }

    const offlineScreens = (screens || []).filter((tela: any) => {
      // Já recebeu alerta? Não spama
      if (tela.alert_sent) return false;

      // Se tem last_ping, verifica se foi há mais de 20 minutos
      if (tela.last_ping) {
        return new Date(tela.last_ping).getTime() < new Date(twentyMinutesAgo).getTime();
      }

      // Se não tem last_ping, verifica se foi criada há mais de 20 minutos
      if (tela.criado_em) {
        return new Date(tela.criado_em).getTime() < new Date(twentyMinutesAgo).getTime();
      }

      return true;
    });

    if (offlineScreens.length === 0) {
      return res.json({
        success: true,
        action: 'checked',
        message: 'Todas as telas estão online ou já notificadas.',
        offlineCount: 0
      });
    }

    const alertsSentResults: any[] = [];

    for (const tela of offlineScreens) {
      const nomeTela = tela.nome_local || 'Tela sem nome';
      const nomeCliente = tela.clientes?.nome_empresa || '';
      const idUnico = tela.identificador_unico || tela.id;
      const lastPingText = tela.last_ping 
        ? new Date(tela.last_ping).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
        : 'Nenhum sinal registrado';

      const alertMessage = `🚨 *ALERTA GOLD PLAY MÍDIA*\n\n` +
        `A tela *${nomeTela}*${nomeCliente ? ` (${nomeCliente})` : ''} está *OFFLINE*!\n` +
        `📍 *ID:* ${idUnico}\n` +
        `🕒 *Último Sinal:* ${lastPingText}\n` +
        `⚠️ *Status:* Parou de responder há mais de 20 minutos.\n\n` +
        `_Ação recomendada: Verifique a conexão Wi-Fi/Rede ou a alimentação elétrica da TV Box._`;

      let sentSuccess = false;

      // 1. Tenta envio interno via WhatsApp do sistema
      try {
        const port = process.env.PORT || 3000;
        const apiDomain = process.env.VERCEL_URL 
          ? `https://${process.env.VERCEL_URL}` 
          : `http://localhost:${port}`;
        
        const apiKey = process.env.VITE_WHATSAPP_API_KEY || process.env.API_KEY || 'minha-chave-secreta';

        const waResp = await fetch(`${apiDomain}/api/whatsapp/send-manual`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey
          },
          body: JSON.stringify({
            numero: adminPhone,
            mensagem: alertMessage
          })
        });

        if (waResp.ok) {
          sentSuccess = true;
        } else {
          const errText = await waResp.text();
          console.warn('Falha no envio interno do WhatsApp:', errText);
        }
      } catch (waErr) {
        console.warn('Erro ao disparar mensagem via WhatsApp interno:', waErr);
      }

      // 2. Tenta envio secundário via BotBot/Webhook externo se configurado
      if (!sentSuccess) {
        try {
          const cleaned = (adminPhone || '').replace(/\D/g, '');
          const fullNumber = cleaned.startsWith('55') || cleaned.length > 11 ? cleaned : `55${cleaned}`;
          
          const botUrl = process.env.BOTBOT_API_URL || process.env.WHATSAPP_BOT_URL || process.env.WHATSAPP_API_URL || 'https://api.botbot.chat/v1/send';
          const appKey = process.env.WHATSAPP_APP_KEY || process.env.BOTBOT_APP_KEY || '';
          const botToken = process.env.WHATSAPP_AUTH_KEY || process.env.BOTBOT_AUTH_KEY || process.env.BOTBOT_TOKEN || '';

          const payload = {
            appkey: appKey,
            authkey: botToken,
            number: fullNumber,
            phone: fullNumber,
            recipient: fullNumber,
            message: alertMessage,
            text: alertMessage,
            caption: alertMessage
          };

          const headers: Record<string, string> = {
            'Content-Type': 'application/json'
          };
          if (appKey) headers['appkey'] = appKey;
          if (botToken) {
            headers['authkey'] = botToken;
            headers['Authorization'] = `Bearer ${botToken}`;
            headers['x-api-key'] = botToken;
          }

          const botResp = await fetch(botUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
          });
          
          if (botResp.ok) {
            sentSuccess = true;
          } else {
            console.error('Erro na API BotBot:', await botResp.text());
          }
        } catch (botErr) {
          console.error('Erro no envio via API BotBot:', botErr);
        }
      }

      // 3. Tenta envio via SMS (GTI SMS) se configurado
      if (process.env.GTISMS_API_TOKEN) {
        try {
          const cleaned = (adminPhone || '').replace(/\D/g, '');
          const fullNumber = cleaned.startsWith('55') || cleaned.length > 11 ? cleaned : `55${cleaned}`;
          
          const smsUrl = process.env.GTISMS_API_URL || 'https://sms.gtisms.com/api/v3/sms/send';
          const smsToken = process.env.GTISMS_API_TOKEN;
          const senderId = process.env.GTISMS_SENDER_ID || '';
          
          const payload: any = {
            recipient: fullNumber,
            message: alertMessage,
            type: 'plain'
          };
          
          if (senderId) {
            payload.sender_id = senderId;
          }

          const smsResp = await fetch(smsUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': `Bearer ${smsToken}`
            },
            body: JSON.stringify(payload)
          });
          
          let smsData;
          try {
            smsData = await smsResp.json();
          } catch(e) {
            console.error('Erro na requisição API GTI SMS:', await smsResp.text());
          }

          if (smsResp.ok && smsData && smsData.status === 'success') {
             sentSuccess = true;
             console.log('Alerta enviado via SMS com sucesso!');
          } else if (smsData) {
             console.error('Erro retornado pela API GTI SMS:', smsData);
          }
        } catch (smsErr) {
          console.error('Erro no envio via API GTI SMS:', smsErr);
        }
      }

      // c) Atualiza a flag alert_sent = true no Supabase
      await supabase
        .from('telas')
        .update({ alert_sent: true, status_online: false })
        .eq('id', tela.id);

      alertsSentResults.push({
        telaId: tela.id,
        nomeTela,
        sentSuccess,
        adminPhone
      });
    }

    return res.json({
      success: true,
      action: 'alerts_processed',
      totalOffline: offlineScreens.length,
      alerts: alertsSentResults
    });
  } catch (err: any) {
    console.error('Erro no /api/cron/check-offline:', err);
    return res.status(500).json({ error: err.message || 'Erro interno no servidor' });
  }
});
