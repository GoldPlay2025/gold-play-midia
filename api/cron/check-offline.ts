import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';
import { sendGtiSms } from '../../src/lib/gtisms';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-cron-secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Validação de segurança via CRON_SECRET
    const cronSecret = process.env.CRON_SECRET;
    const urlStr = String(req.url || '');
    const isForce = req.query?.force === 'true' || req.query?.test === 'true' || urlStr.includes('force=true') || urlStr.includes('test=true') || (req.body && req.body.force === true);

    if (cronSecret && !isForce) {
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

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(503).json({ error: 'Supabase não configurado no Vercel' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // a) Busca configurações de alertas de forma segura
    let alertsEnabled = true;
    let adminPhone = process.env.ADMIN_PHONE || '';
    let smtpEmail = process.env.GMAIL_USER || process.env.SMTP_EMAIL || process.env.SMTP_USER || '';
    let smtpPassword = process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASS || process.env.SMTP_PASS || process.env.SMTP_PASSWORD || '';
    let smtpPort = Number(process.env.GMAIL_PORT || process.env.SMTP_PORT || 587);
    let smtpHost = process.env.GMAIL_HOST || process.env.SMTP_HOST || 'smtp.gmail.com';

    try {
      const { data: configData, error: configError } = await supabase
        .from('configuracoes')
        .select('*')
        .eq('id', 'sistema')
        .maybeSingle();

      if (configData) {
        alertsEnabled = configData.alerts_enabled ?? true;
        if (configData.admin_phone) adminPhone = configData.admin_phone.trim();
        if (configData.smtp_email) smtpEmail = configData.smtp_email.trim();
        if (configData.smtp_password) smtpPassword = configData.smtp_password.trim();
        if (configData.smtp_port) smtpPort = Number(configData.smtp_port);
        if (configData.smtp_host) smtpHost = configData.smtp_host.trim();
      }
    } catch (errConfig) {
      console.warn('Aviso ao consultar configuracoes no cron:', errConfig);
    }

    if (!alertsEnabled && !isForce) {
      return res.status(200).json({
        success: true,
        action: 'skipped',
        reason: 'Alertas desativados nas configurações (ative os Alertas de Tela no painel Perfil & Sistema)',
        alertsEnabled
      });
    }

    // b) Busca telas onde last_ping seja maior que 3 minutos atrás (ou criadas há > 3m sem ping)
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();

    const { data: screens, error: queryErr } = await supabase
      .from('telas')
      .select('*, clientes(nome_empresa)');

    if (queryErr) {
      return res.status(500).json({ error: 'Falha ao consultar telas', details: queryErr.message });
    }

    const offlineScreens = (screens || []).filter((tela: any) => {
      if (!isForce && tela.alert_sent) return false;

      if (tela.last_ping) {
        return new Date(tela.last_ping).getTime() < new Date(threeMinutesAgo).getTime();
      }

      if (tela.criado_em) {
        return new Date(tela.criado_em).getTime() < new Date(threeMinutesAgo).getTime();
      }

      return true;
    });

    if (offlineScreens.length === 0) {
      if (isForce) {
        // Quando forçado o teste manual, simula 1 tela offline para disparar o alerta de teste
        offlineScreens.push({
          id: 'test-simulated-id',
          nome_local: 'TELA DE TESTE SIMULADA',
          identificador_unico: 'TESTE-OFFLINE',
          last_ping: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
          clientes: { nome_empresa: 'Cliente Teste Gold Play' }
        });
      } else {
        return res.status(200).json({
          success: true,
          action: 'checked',
          message: 'Todas as telas estão online ou já notificadas.',
          offlineCount: 0
        });
      }
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
        `⚠️ *Status:* Parou de responder há mais de 3 minutos.\n\n` +
        `_Ação recomendada: Verifique a conexão Wi-Fi/Rede ou a alimentação elétrica da TV Box._`;

      let sentSuccess = false;
      let smsResultMsg = '';

      // Disparo via BotBot.chat ou API do WhatsApp
      if (adminPhone) {
        try {
          const cleaned = adminPhone.replace(/\D/g, '');
          const fullNumber = cleaned.startsWith('55') || cleaned.length > 11 ? cleaned : `55${cleaned}`;
          
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
              message: alertMessage,
              text: alertMessage,
              caption: alertMessage
            };

            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (appKey) headers['appkey'] = appKey;
            if (authKey) {
              headers['authkey'] = authKey;
              headers['Authorization'] = `Bearer ${authKey}`;
              headers['x-api-key'] = authKey;
            }

            const botResp = await fetch(targetUrl, { method: 'POST', headers, body: JSON.stringify(payload) });
            if (botResp.ok) sentSuccess = true;
          }
        } catch (e) {
          console.error('Erro no BotBot:', e);
        }

        // Disparo seguro via GTI SMS helper
        try {
          const smsRes = await sendGtiSms({
            numero: adminPhone,
            mensagem: alertMessage,
            timeoutMs: 10000
          });
          smsResultMsg = smsRes.message;
          if (smsRes.success) {
            sentSuccess = true;
          }
        } catch (smsErr: any) {
          console.error('Erro no envio GTI SMS:', smsErr);
          smsResultMsg = smsErr.message || String(smsErr);
        }
      }

      // Disparo de E-mail de Alerta para o Administrador
      if (smtpEmail && smtpPassword) {
        try {
          const createTransport = (nodemailer as any)?.createTransport || (nodemailer as any)?.default?.createTransport || (nodemailer as any)?.default;

          if (typeof createTransport === 'function') {
            const sanitizedPassword = smtpPassword.replace(/\s+/g, '');
            const transporter = createTransport({
              host: smtpHost || 'smtp.gmail.com',
              port: smtpPort || 587,
              secure: smtpPort === 465,
              auth: { user: smtpEmail, pass: sanitizedPassword },
              tls: { rejectUnauthorized: false },
              connectionTimeout: 5000,
              greetingTimeout: 5000,
              socketTimeout: 5000
            });

            const mailHtml = `<div style="font-family: Arial, sans-serif; padding: 24px; background: #0f0f11; color: #f8fafc; border-radius: 16px; border: 1px solid #1e293b;">
              <h2 style="color: #f43f5e; margin-bottom: 12px; font-size: 20px;">🚨 ALERTA GOLD PLAY - TELA OFFLINE</h2>
              <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">A tela <strong>${nomeTela}</strong>${nomeCliente ? ` (${nomeCliente})` : ''} foi detectada como <strong>OFFLINE</strong>.</p>
              <div style="background-color: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 16px; margin: 16px 0;">
                <ul style="color: #e2e8f0; font-size: 13px; line-height: 1.8; margin: 0; padding-left: 20px;">
                  <li><strong>Identificador da Tela:</strong> <span style="font-family: monospace; color: #fbbf24;">${idUnico}</span></li>
                  <li><strong>Último Sinal:</strong> ${lastPingText}</li>
                  <li><strong>Data do Alerta:</strong> ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</li>
                </ul>
              </div>
              <p style="font-size: 12px; color: #94a3b8; margin-top: 15px;">Ação recomendada: Verifique a conexão com a Internet e a energia elétrica do aparelho.</p>
            </div>`;

            await transporter.sendMail({
              from: `"GOLD PLAY Alertas" <${smtpEmail}>`,
              to: smtpEmail,
              subject: `🚨 ALERTA OFFLINE: Tela ${nomeTela} - GOLD PLAY`,
              html: mailHtml,
            });
            sentSuccess = true;
          }
        } catch (emailErr) {
          console.error('Erro ao enviar e-mail de alerta offline:', emailErr);
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
        smsResultMsg,
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
