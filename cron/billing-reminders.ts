import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-cron-secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(503).json({ error: 'Supabase não configurado no Vercel' });
    }

    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = req.headers.authorization || '';
      const querySecret = req.query?.secret || req.headers['x-cron-secret'];
      const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : (authHeader as string);
      
      if (token !== cronSecret && querySecret !== cronSecret) {
        return res.status(401).json({ error: 'Não autorizado: CRON_SECRET inválido' });
      }
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch config
    const { data: config } = await supabase
      .from('configuracoes')
      .select('smtp_email, smtp_password, smtp_port, smtp_host, automacao_cobranca_ativa, automacao_dias_antes, automacao_horario, pix_key, pix_receiver, system_name')
      .eq('id', 'sistema')
      .maybeSingle();

    if (!config || !config.automacao_cobranca_ativa) {
      return res.status(200).json({ message: 'Automação de cobrança não está ativa.' });
    }

    // Check hour
    const [configHour] = (config.automacao_horario || '09:00').split(':');
    
    // We get current time in BRT (UTC-3) for simplicity or system timezone
    // The cron will run hourly. Let's get current hour in Sao Paulo
    const nowSp = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Sao_Paulo"}));
    const currentHour = nowSp.getHours();

    // Only run if the hours match exactly (since cron is hourly)
    // We allow running if req.query.force=true for testing
    if (currentHour !== parseInt(configHour) && req.query.force !== 'true') {
      return res.status(200).json({ message: `Horário não corresponde. Configurado: ${config.automacao_horario}, Atual (BRT): ${currentHour}h` });
    }

    const { data: clientes } = await supabase
      .from('clientes')
      .select('*')
      .not('email', 'is', null)
      .not('vencimento', 'is', null);

    if (!clientes || clientes.length === 0) {
      return res.status(200).json({ message: 'Nenhum cliente elegível encontrado.' });
    }

    let enviados = 0;
    const diasAntes = Number(config.automacao_dias_antes || 1);
    
    // Nodemailer setup
    const smtpEmail = config.smtp_email || process.env.SMTP_EMAIL;
    const smtpPassword = config.smtp_password || process.env.SMTP_PASSWORD;
    const smtpPort = Number(config.smtp_port || 587);
    const smtpHost = config.smtp_host || 'smtp.gmail.com';
    const systemName = config.system_name || 'GOLD PLAY';
    
    let transporter: any = null;
    
    if (smtpEmail && smtpPassword) {
      const nodemailerModule = await import('nodemailer');
      const nm = nodemailerModule.default || nodemailerModule;
      const createTransport = (nm as any)?.createTransport || (nm as any)?.default?.createTransport || (nm as any)?.default;
      if (typeof createTransport === 'function') {
        transporter = createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: {
            user: smtpEmail,
            pass: smtpPassword.replace(/\s+/g, ''),
          },
          tls: { rejectUnauthorized: false },
          connectionTimeout: 5000,
          greetingTimeout: 5000,
          socketTimeout: 5000
        });
      }
    }

    if (!transporter) {
       return res.status(500).json({ error: 'Configuração SMTP inválida para automação.' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const cliente of clientes) {
      if (!cliente.email) continue;
      
      const vData = new Date(cliente.vencimento);
      // vData might be interpreted as UTC midnight if it's YYYY-MM-DD
      // Let's normalize it to local midnight to avoid timezone offset shifts
      const vencimentoNormalizado = new Date(vData.getTime() + Math.abs(vData.getTimezoneOffset() * 60000));
      vencimentoNormalizado.setHours(0,0,0,0);
      
      const diffTime = vencimentoNormalizado.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      const isDiaAnterior = diffDays === diasAntes;
      const isNoDia = diffDays === 0;

      if (isDiaAnterior || isNoDia) {
        // Send email
        const tipoLembrete = isNoDia ? 'Vencimento Hoje' : `Vencimento em ${diasAntes} dia(s)`;
        const valorFormatado = cliente.valor ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cliente.valor) : 'Consulte';
        
        let pixInfo = '';
        if (config.pix_key) {
          pixInfo = `
            <div style="background: #1e293b; padding: 15px; border-radius: 8px; margin-top: 15px;">
              <h3 style="color: #38bdf8; margin-top: 0;">Dados para PIX</h3>
              <p style="margin: 5px 0; color: #cbd5e1;">Chave PIX: <strong>${config.pix_key}</strong></p>
              ${config.pix_receiver ? `<p style="margin: 5px 0; color: #cbd5e1;">Beneficiário: <strong>${config.pix_receiver}</strong></p>` : ''}
              <p style="margin: 5px 0; color: #cbd5e1;">Valor: <strong>${valorFormatado}</strong></p>
            </div>
          `;
        }

        const mailHtml = `
          <div style="font-family: Arial, sans-serif; padding: 20px; background: #0f0f11; color: #fff; border-radius: 12px; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #f59e0b; margin-bottom: 10px;">Lembrete de Pagamento - ${systemName}</h2>
            <p style="color: #cbd5e1; font-size: 16px;">Olá <strong>${cliente.nome_empresa}</strong>,</p>
            <p style="color: #cbd5e1; font-size: 14px;">Este é um lembrete automático sobre a sua assinatura. <strong>${tipoLembrete}</strong>.</p>
            <p style="color: #cbd5e1; font-size: 14px;">Data de vencimento: <strong>${vencimentoNormalizado.toLocaleDateString('pt-BR')}</strong></p>
            ${pixInfo}
            <p style="color: #94a3b8; font-size: 13px; margin-top: 20px;">Caso já tenha efetuado o pagamento, por favor, desconsidere este e-mail.</p>
            <hr style="border-color: #334155; margin: 20px 0;" />
            <p style="font-size: 12px; color: #64748b;">${systemName} <br/>Mensagem automática, não é necessário responder.</p>
          </div>
        `;

        try {
          await transporter.sendMail({
            from: `"${systemName}" <${smtpEmail}>`,
            to: cliente.email,
            subject: `Lembrete de Pagamento: ${tipoLembrete} - ${systemName}`,
            html: mailHtml
          });
          enviados++;
        } catch (mailErr) {
          console.error(`Erro ao enviar para ${cliente.email}:`, mailErr);
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: `Rotina finalizada. E-mails enviados: ${enviados}`,
      timestamp: new Date().toISOString()
    });

  } catch (err: any) {
    console.error('Erro no cron de cobranças:', err);
    return res.status(500).json({ error: err.message || 'Erro interno' });
  }
}
