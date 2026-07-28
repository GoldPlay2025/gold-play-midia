import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Configurar cabeçalhos CORS e Content-Type
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-api-key'
    );
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
      return res.status(200).json({ ok: true });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Método não permitido.' });
    }

    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        console.error('Erro ao analisar JSON do req.body:', e);
      }
    }

    const { to, subject, html, text, smtpEmail, smtpPassword, smtpPort, smtpHost } = body || {};

    if (!to) {
      return res.status(400).json({ error: 'O campo "to" (destinatário) é obrigatório.' });
    }

    let finalEmail = smtpEmail || process.env.GMAIL_USER || process.env.SMTP_EMAIL || process.env.SMTP_USER;
    let finalPassword = smtpPassword || process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASS || process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
    let finalPort = Number(smtpPort || process.env.GMAIL_PORT || process.env.SMTP_PORT || 587);
    if (isNaN(finalPort) || !finalPort) finalPort = 587;
    let finalHost = smtpHost || process.env.GMAIL_HOST || process.env.SMTP_HOST || 'smtp.gmail.com';

    // Se faltar e-mail ou senha no body e variáveis, busca no Supabase
    if (!finalEmail || !finalPassword) {
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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
          console.warn('Erro ao buscar SMTP no Supabase:', dbErr);
        }
      }
    }

    // Limpa a senha do aplicativo Google (remove espaços ex: "abcd efgh ijkl mnop")
    if (finalPassword) {
      finalPassword = String(finalPassword).replace(/\s+/g, '');
    }

    if (!finalEmail || !finalPassword) {
      return res.status(400).json({
        error: 'Configuração de e-mail incompleta. Defina o E-mail e a Senha de Aplicativo Google na página Perfil ou nas Variáveis da Vercel.'
      });
    }

    // Resolvendo createTransport com compatibilidade total CJS/ESM
    const createTransport = (nodemailer as any)?.createTransport || (nodemailer as any)?.default?.createTransport || (nodemailer as any)?.default;
    if (typeof createTransport !== 'function') {
      return res.status(500).json({ error: 'Módulo Nodemailer não pôde ser inicializado no servidor.' });
    }

    const isGmail = finalHost.includes('gmail.com') || finalEmail.includes('@gmail.com');
    const useSecure = finalPort === 465;

    const baseTransportOpts = {
      host: finalHost,
      port: finalPort,
      secure: useSecure,
      auth: {
        user: finalEmail,
        pass: finalPassword,
      },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 4000,
      greetingTimeout: 4000,
      socketTimeout: 5000,
    };

    const mailOptions = {
      from: `"GOLD PLAY Digital Signage" <${finalEmail}>`,
      to,
      subject: subject || 'Notificação GOLD PLAY',
      text: text || (html ? html.replace(/<[^>]+>/g, '') : 'Mensagem do sistema GOLD PLAY'),
      html: html || `<div style="font-family: sans-serif; padding: 20px; color: #333;"><p>${text || 'Mensagem do sistema GOLD PLAY'}</p></div>`,
    };

    let info: any;
    try {
      const transporter = createTransport(baseTransportOpts);
      info = await transporter.sendMail(mailOptions);
    } catch (primaryErr: any) {
      console.warn('Falha na tentativa principal SMTP:', primaryErr?.message);

      // Se for Gmail e porta 587 falhou/deu timeout, tenta fallback automático na porta 465 (SSL)
      if (isGmail && finalPort === 587) {
        console.log('Tentando fallback para Gmail na porta 465 (SSL)...');
        const fallbackTransporter = createTransport({
          ...baseTransportOpts,
          port: 465,
          secure: true,
        });
        info = await fallbackTransporter.sendMail(mailOptions);
      } else if (isGmail && finalPort === 465) {
        console.log('Tentando fallback para Gmail na porta 587 (TLS)...');
        const fallbackTransporter = createTransport({
          ...baseTransportOpts,
          port: 587,
          secure: false,
        });
        info = await fallbackTransporter.sendMail(mailOptions);
      } else {
        throw primaryErr;
      }
    }

    console.log('E-mail enviado com sucesso:', info?.messageId);

    return res.status(200).json({
      success: true,
      message: 'E-mail enviado com sucesso!',
      messageId: info?.messageId || 'ok'
    });

  } catch (err: any) {
    console.error('Erro no envio de e-mail via SMTP:', err);
    return res.status(500).json({
      error: 'Falha no envio de e-mail: ' + (err?.message || String(err)),
      details: String(err?.stack || err?.message || err)
    });
  }
}
