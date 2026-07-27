import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-api-key'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const { to, subject, html, text, smtpEmail, smtpPassword, smtpPort, smtpHost } = req.body || {};

    if (!to) {
      return res.status(400).json({ error: 'O campo "to" (destinatário) é obrigatório.' });
    }

    let finalEmail = smtpEmail || process.env.GMAIL_USER || process.env.SMTP_EMAIL || process.env.SMTP_USER;
    let finalPassword = smtpPassword || process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASS || process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
    let finalPort = Number(smtpPort || process.env.GMAIL_PORT || process.env.SMTP_PORT || 587);
    let finalHost = smtpHost || process.env.GMAIL_HOST || process.env.SMTP_HOST || 'smtp.gmail.com';

    // Se faltar email ou senha, tenta buscar do Supabase
    if (!finalEmail || !finalPassword) {
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

      if (supabaseUrl && supabaseKey) {
        try {
          const supabase = createClient(supabaseUrl, supabaseKey);
          const { data } = await supabase
            .from('configuracoes')
            .select('smtp_email, smtp_password, smtp_port, smtp_host')
            .eq('id', 'sistema')
            .maybeSingle();

          if (data) {
            if (!finalEmail) finalEmail = data.smtp_email;
            if (!finalPassword) finalPassword = data.smtp_password;
            if (data.smtp_port) finalPort = Number(data.smtp_port);
            if (data.smtp_host) finalHost = data.smtp_host;
          }
        } catch (dbErr) {
          console.warn('Erro ao buscar SMTP do Supabase:', dbErr);
        }
      }
    }

    // Sanitize app password (remove spaces if pasted as "djzu xbpk whit uzck")
    if (finalPassword) {
      finalPassword = finalPassword.replace(/\s+/g, '');
    }

    if (!finalEmail || !finalPassword) {
      return res.status(400).json({
        error: 'Configuração de e-mail incompleta. Defina o E-mail e a Senha de Aplicativo Google na página Perfil ou nas Variáveis de Ambiente da Vercel (GMAIL_USER e GMAIL_APP_PASSWORD).'
      });
    }

    // Configurar o Transportador do Nodemailer
    const transporter = nodemailer.createTransport({
      host: finalHost,
      port: finalPort,
      secure: finalPort === 465, // true para 465, false para 587 ou outras portas
      auth: {
        user: finalEmail,
        pass: finalPassword,
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    const mailOptions = {
      from: `"GOLD PLAY Digital Signage" <${finalEmail}>`,
      to,
      subject: subject || 'Notificação GOLD PLAY',
      text: text || (html ? html.replace(/<[^>]+>/g, '') : 'Mensagem do sistema GOLD PLAY'),
      html: html || `<div style="font-family: sans-serif; padding: 20px; color: #333;"><p>${text || 'Mensagem do sistema GOLD PLAY'}</p></div>`,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('E-mail enviado com sucesso:', info.messageId);

    return res.status(200).json({
      success: true,
      message: 'E-mail enviado com sucesso!',
      messageId: info.messageId
    });

  } catch (err: any) {
    console.error('Erro ao enviar e-mail via SMTP:', err);
    return res.status(500).json({
      error: 'Falha no envio de e-mail: ' + (err?.message || String(err)),
      details: err
    });
  }
}
