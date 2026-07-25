import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(503).json({ error: 'Supabase não configurado no Vercel' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // a) Busca configurações de alertas
    const { data: configData } = await supabase
      .from('configuracoes')
      .select('admin_phone, alerts_enabled')
      .eq('id', 'sistema')
      .maybeSingle();

    const alertsEnabled = configData?.alerts_enabled ?? false;
    const adminPhone = (configData?.admin_phone || '').trim();

    if (!alertsEnabled || !adminPhone) {
      return res.status(200).json({
        success: true,
        action: 'skipped',
        reason: !alertsEnabled ? 'Alertas desativados' : 'Número do administrador não configurado',
        alertsEnabled,
        adminPhone
      });
    }

    // b) Busca telas onde last_ping seja maior que 20 minutos atrás (ou criadas há > 20m sem ping) e alert_sent = false
    const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();

    const { data: screens, error: queryErr } = await supabase
      .from('telas')
      .select('*, clientes(nome_empresa)');

    if (queryErr) {
      return res.status(500).json({ error: 'Falha ao consultar telas', details: queryErr.message });
    }

    const offlineScreens = (screens || []).filter((tela: any) => {
      if (tela.alert_sent) return false;

      if (tela.last_ping) {
        return new Date(tela.last_ping).getTime() < new Date(twentyMinutesAgo).getTime();
      }

      if (tela.criado_em) {
        return new Date(tela.criado_em).getTime() < new Date(twentyMinutesAgo).getTime();
      }

      return true;
    });

    if (offlineScreens.length === 0) {
      return res.status(200).json({
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

      // Disparo via BotBot.chat ou API do WhatsApp
      if (process.env.BOTBOT_API_URL || process.env.WHATSAPP_BOT_URL) {
        try {
          const botUrl = process.env.BOTBOT_API_URL || process.env.WHATSAPP_BOT_URL;
          const botToken = process.env.BOTBOT_TOKEN || process.env.WHATSAPP_BOT_TOKEN;
          await fetch(botUrl!, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': botToken ? `Bearer ${botToken}` : ''
            },
            body: JSON.stringify({
              number: adminPhone,
              message: alertMessage
            })
          });
          sentSuccess = true;
        } catch (e) {
          console.error('Erro no BotBot:', e);
        }
      }

      // Se falhar ou não tiver BotBot URL externo, tenta endpoint relativo/local
      if (!sentSuccess) {
        try {
          const host = req.headers.host || 'localhost:3000';
          const protocol = host.includes('localhost') ? 'http' : 'https';
          const apiKey = process.env.VITE_WHATSAPP_API_KEY || process.env.API_KEY || 'minha-chave-secreta';

          const waResp = await fetch(`${protocol}://${host}/api/whatsapp/send-manual`, {
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

          if (waResp.ok) sentSuccess = true;
        } catch (e) {
          console.error('Erro na chamada WhatsApp interna:', e);
        }
      }

      // Marca alert_sent = true
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

    return res.status(200).json({
      success: true,
      action: 'alerts_processed',
      totalOffline: offlineScreens.length,
      alerts: alertsSentResults
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Erro interno na checagem de cron' });
  }
}
