import type { VercelRequest, VercelResponse } from '@vercel/node';

const DEFAULT_COBRANCA_TEMPLATE = `Olá *[Nome]*! 👋

• 𝑷𝒂𝒔𝒔𝒂𝒏𝒅𝒐 𝒑𝒂𝒓𝒂 𝒍𝒆𝒎𝒃𝒓𝒂𝒓 𝒒𝒖𝒆 𝒔𝒖𝒂 𝒎𝒆𝒏𝒔𝒂𝒍𝒊𝒅𝒂𝒅𝒆:

*GOLD MÍDIAS*
---------------------
• Vence: *[Vencimento]*
• Valor: *[Valor]*

╰⊱❖ Gold Play ❖⊱╯

*Pagamento via Pix:*
Chave Pix: *[Pix]*

• Agradecemos a parceria e ficamos à disposição!`;

function formatCobrancaMessage(
  template: string | null | undefined,
  cliente: { nome_empresa?: string; nome?: string; valor?: number | string; vencimento?: string },
  pixKey?: string
): string {
  const tpl = (template && template.trim()) ? template : DEFAULT_COBRANCA_TEMPLATE;
  const nome = cliente.nome_empresa || cliente.nome || 'Cliente';
  
  let valorFormatado = 'R$ 0,00';
  if (cliente.valor != null && cliente.valor !== '') {
    if (typeof cliente.valor === 'number') {
      valorFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cliente.valor);
    } else {
      const cleaned = String(cliente.valor).replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
      const num = parseFloat(cleaned);
      valorFormatado = !isNaN(num)
        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num)
        : `R$ ${cliente.valor}`;
    }
  }

  let vencimentoFormatado = '-';
  if (cliente.vencimento) {
    const vStr = String(cliente.vencimento).trim();
    if (vStr.includes('/')) {
      vencimentoFormatado = vStr;
    } else {
      try {
        const parts = vStr.split('T')[0].split('-');
        if (parts.length === 3) {
          vencimentoFormatado = `${parts[2]}/${parts[1]}/${parts[0]}`;
        } else {
          vencimentoFormatado = new Date(vStr).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
        }
      } catch (e) {
        vencimentoFormatado = vStr;
      }
    }
  }

  const pix = (pixKey || '').trim() || 'Chave Pix não configurada';

  return tpl
    .replace(/\[Nome\]|\{Nome\}|\[NOME\]|\{NOME\}/gi, nome)
    .replace(/\[Valor\]|\{Valor\}|\[VALOR\]|\{VALOR\}/gi, valorFormatado)
    .replace(/\[Vencimento\]|\{Vencimento\}|\[VENCIMENTO\]|\{VENCIMENTO\}/gi, vencimentoFormatado)
    .replace(/\[Pix\]|\{Pix\}|\[PIX\]|\{PIX\}/gi, pix);
}

function matchesDate(vencimentoRaw: any, targetYYYYMMDD: string, targetDDMMYYYY: string): boolean {
  if (!vencimentoRaw) return false;
  const str = String(vencimentoRaw).trim();
  if (!str) return false;

  // Direto em string
  if (str.startsWith(targetYYYYMMDD) || str.includes(targetYYYYMMDD) || str.includes(targetDDMMYYYY)) {
    return true;
  }

  // Parse Date
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const uAno = d.getUTCFullYear();
      const uMes = String(d.getUTCMonth() + 1).padStart(2, '0');
      const uDia = String(d.getUTCDate()).padStart(2, '0');
      if (`${uAno}-${uMes}-${uDia}` === targetYYYYMMDD || `${uDia}/${uMes}/${uAno}` === targetDDMMYYYY) {
        return true;
      }
      const lAno = d.getFullYear();
      const lMes = String(d.getMonth() + 1).padStart(2, '0');
      const lDia = String(d.getDate()).padStart(2, '0');
      if (`${lAno}-${lMes}-${lDia}` === targetYYYYMMDD || `${lDia}/${lMes}/${lAno}` === targetDDMMYYYY) {
        return true;
      }
    }
  } catch (e) {}

  return false;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-cron-secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const cronSecret = process.env.CRON_SECRET;
    const urlStr = String(req.url || '');
    const isForce = req.query?.force === 'true' || req.query?.test === 'true' || urlStr.includes('force=true') || urlStr.includes('test=true');

    if (cronSecret && !isForce) {
      const authHeader = req.headers.authorization || '';
      const querySecret = req.query?.secret || req.headers['x-cron-secret'];
      const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : (authHeader as string);

      if (token !== cronSecret && querySecret !== cronSecret) {
        return res.status(401).json({ 
          error: 'Não autorizado. Token CRON_SECRET inválido ou não fornecido.'
        });
      }
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://v3o4yftcg3lues4kuk7y24.supabase.co';
    const supabaseKey = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    // Busca configuração do WhatsApp e Pix do Supabase
    let diasAntecedencia = 2;
    let agendamentoAtivo = true;
    let horarioEnvio = '09:00';
    let lastRunDate = '';
    let customTemplate = '';
    let pixKey = '';
    let dbAppKey = '';
    let dbAuthKey = '';

    if (supabaseUrl && supabaseKey) {
      try {
        // 1. Tabela configuracoes id = whatsapp_schedule
        const cfgRes = await fetch(`${supabaseUrl}/rest/v1/configuracoes?id=eq.whatsapp_schedule&select=*`, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
          }
        });
        if (cfgRes.ok) {
          const cfgData = await cfgRes.json();
          if (cfgData && cfgData.length > 0) {
            diasAntecedencia = cfgData[0].dias_antecedencia ?? 2;
            agendamentoAtivo = cfgData[0].agendamento_ativo ?? true;
            horarioEnvio = cfgData[0].horario_envio || '09:00';
            lastRunDate = cfgData[0].last_run_date || '';
            customTemplate = cfgData[0].template_cobranca || cfgData[0].template_mensagem || '';
            pixKey = cfgData[0].pix_key || '';
            dbAppKey = cfgData[0].app_key || '';
            dbAuthKey = cfgData[0].auth_key || '';
          }
        }

        // 2. Fallback da chave Pix e do sistema na tabela configuracoes id = sistema
        if (!pixKey) {
          const sisRes = await fetch(`${supabaseUrl}/rest/v1/configuracoes?id=eq.sistema&select=pix_key`, {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`
            }
          });
          if (sisRes.ok) {
            const sisData = await sisRes.json();
            if (sisData && sisData.length > 0) {
              pixKey = sisData[0].pix_key || '';
            }
          }
        }
      } catch (err) {
        console.warn('Aviso ao consultar configuracao de cobranca:', err);
      }
    }

    if (!agendamentoAtivo && !isForce) {
      return res.status(200).json({
        success: true,
        action: 'skipped',
        reason: 'Agendamento automático de cobrança está desativado no painel.'
      });
    }

    // Obtém horário e data atuais de Brasília
    const agoraBR = new Date();
    const formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(agoraBR);
    const h = parts.find(p => p.type === 'hour')?.value.padStart(2, '0') || '00';
    const m = parts.find(p => p.type === 'minute')?.value.padStart(2, '0') || '00';
    const horaMinutoAtual = `${h}:${m}`;

    const horarioEnvioClean = (horarioEnvio || '09:00').trim().slice(0, 5);
    const hojeDataStr = agoraBR.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    if (!isForce) {
      // Se não for horário programado, ignora
      if (horarioEnvioClean && horarioEnvioClean !== horaMinutoAtual) {
        return res.status(200).json({
          success: true,
          action: 'skipped',
          reason: `Horário atual em Brasília (${horaMinutoAtual}) não corresponde ao horário agendado (${horarioEnvioClean}).`
        });
      }

      // Se já executou hoje no horário programado, evita duplicidade
      if (lastRunDate === hojeDataStr) {
        return res.status(200).json({
          success: true,
          action: 'skipped',
          reason: `O agendamento do dia (${hojeDataStr}) já foi executado anteriormente.`
        });
      }
    }

    const defaultAppKey = '90d7b9ff-d861-49ae-a452-9ed6238f038d';
    const defaultAuthKey = 'kMo4v73UxTTdDFmUGe7eYjQYCpZjykRb7lqZtlQu9Z8iDXN6Td';

    const appKey = dbAppKey || process.env.BOTBOT_APP_KEY || process.env.WHATSAPP_APP_KEY || defaultAppKey;
    const authKey = dbAuthKey || process.env.BOTBOT_AUTH_KEY || process.env.WHATSAPP_AUTH_KEY || defaultAuthKey;

    // Data de hoje em Brasília
    const spTimeStr = agoraBR.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
    const hojeSp = new Date(spTimeStr);

    const anoHoje = hojeSp.getFullYear();
    const mesHoje = String(hojeSp.getMonth() + 1).padStart(2, '0');
    const diaHoje = String(hojeSp.getDate()).padStart(2, '0');
    const dataHojeFormatada = `${anoHoje}-${mesHoje}-${diaHoje}`;
    const dataHojeBR = `${diaHoje}/${mesHoje}/${anoHoje}`;

    // Data Alvo (hoje + diasAntecedencia)
    const targetSp = new Date(hojeSp);
    targetSp.setDate(targetSp.getDate() + Number(diasAntecedencia));

    const anoAlvo = targetSp.getFullYear();
    const mesAlvo = String(targetSp.getMonth() + 1).padStart(2, '0');
    const diaAlvo = String(targetSp.getDate()).padStart(2, '0');
    const dataAlvoFormatada = `${anoAlvo}-${mesAlvo}-${diaAlvo}`;
    const dataAlvoBR = `${diaAlvo}/${mesAlvo}/${anoAlvo}`;

    const supRes = await fetch(`${supabaseUrl}/rest/v1/clientes?select=*`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    const clientes = await supRes.json();

    if (!supRes.ok || !Array.isArray(clientes)) {
      return res.status(500).json({ error: 'Falha ao buscar clientes do Supabase' });
    }

    const resultados = [];

    for (const cliente of clientes) {
      const telefone = cliente.whatsapp || cliente.telefone || cliente.contato;
      const vencimento = cliente.vencimento;

      if (!telefone || !vencimento) continue;

      // Bate com a data alvo de antecedência OU vence hoje
      const isMatchAlvo = matchesDate(vencimento, dataAlvoFormatada, dataAlvoBR);
      const isMatchHoje = matchesDate(vencimento, dataHojeFormatada, dataHojeBR);

      if (isMatchAlvo || isMatchHoje) {
        let numeroLimpo = String(telefone).replace(/\D/g, '');
        if (numeroLimpo.length === 10 || numeroLimpo.length === 11) {
          numeroLimpo = '55' + numeroLimpo;
        }

        const textoMensagem = formatCobrancaMessage(customTemplate, cliente, pixKey);

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (appKey) headers['appKey'] = appKey;
        if (authKey) headers['authKey'] = authKey;

        const respostaBot = await fetch('https://botbot.chat/api/v2/sendText', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            to: numeroLimpo,
            message: textoMensagem
          })
        });

        const dadosBot = await respostaBot.json().catch(() => ({ success: respostaBot.ok }));
        resultados.push({
          cliente: cliente.nome_empresa || cliente.nome || 'Cliente',
          vencimento: vencimento,
          status: respostaBot.ok && dadosBot.success !== false ? 'Enviado com sucesso' : 'Falha',
          respostaBot: dadosBot
        });
      }
    }

    // Atualiza last_run_date no Supabase se não for teste/força
    if (supabaseUrl && supabaseKey && !isForce) {
      try {
        await fetch(`${supabaseUrl}/rest/v1/configuracoes?id=eq.whatsapp_schedule`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            last_run_date: hojeDataStr,
            updated_at: new Date().toISOString()
          })
        });
      } catch (e) {}
    }

    return res.status(200).json({
      success: true,
      dataAlvoCalculada: dataAlvoFormatada,
      totalProcessados: resultados.length,
      resultados
    });

  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Erro interno na execução do cron de cobrança' });
  }
}


