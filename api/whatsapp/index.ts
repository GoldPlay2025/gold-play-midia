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
  if (str.startsWith(targetYYYYMMDD) || str.startsWith(targetDDMMYYYY) || str.includes(targetYYYYMMDD) || str.includes(targetDDMMYYYY)) {
    return true;
  }

  if (str.substring(0, 10) === targetYYYYMMDD || str.substring(0, 10) === targetDDMMYYYY) {
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
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, apiKey, x-cron-secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. Status da API (GET)
  if (req.method === 'GET') {
    return res.status(200).json({ 
      status: "Online!", 
      mensagem: "A API do WhatsApp está ativa e pronta!" 
    });
  }

  // 2. Processamento de Envios (POST)
  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const { 
        phone, 
        number, 
        to, 
        message, 
        mensagem, 
        disparar_lote, 
        dias_antecedencia, 
        alerta_status_tela, 
        status, 
        nomeTela 
      } = body;

      const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://v3o4yftcg3lues4kuk7y24.supabase.co';
      const supabaseKey = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

      const defaultAppKey = '90d7b9ff-d861-49ae-a452-9ed6238f038d';
      const defaultAuthKey = 'kMo4v73UxTTdDFmUGe7eYjQYCpZjykRb7lqZtlQu9Z8iDXN6Td';

      const appKey = body.appKey || body.app_key || body.appkey || req.headers['appkey'] || process.env.BOTBOT_APP_KEY || process.env.WHATSAPP_APP_KEY || defaultAppKey;
      const authKey = body.authKey || body.auth_key || body.authkey || req.headers['authkey'] || process.env.BOTBOT_AUTH_KEY || process.env.WHATSAPP_AUTH_KEY || defaultAuthKey;

      // 0. SALVAR CONFIGURAÇÃO DE AGENDAMENTO AUTOMÁTICO E TEMPLATE
      if (body.salvar_agendamento || body.salvar_configuracao || body.salvar_template) {
        const diasAntesConfig = body.dias_antecedencia ?? 2;
        const horarioEnvioConfig = body.horario_envio || '09:00';
        const agendamentoAtivoConfig = body.agendamento_ativo ?? true;
        const templateCobrancaConfig = body.template_cobranca || body.template_mensagem || body.template;
        const pixKeyConfig = body.pix_key || body.pixKey;
        const appKeyConfig = body.app_key || body.appKey;
        const authKeyConfig = body.auth_key || body.authKey;

        if (supabaseUrl && supabaseKey) {
          try {
            const updatePayload: Record<string, any> = {
              dias_antecedencia: Number(diasAntesConfig),
              horario_envio: horarioEnvioConfig,
              agendamento_ativo: agendamentoAtivoConfig,
              last_run_date: null,
              updated_at: new Date().toISOString()
            };

            if (templateCobrancaConfig !== undefined) updatePayload.template_cobranca = templateCobrancaConfig;
            if (pixKeyConfig !== undefined) updatePayload.pix_key = pixKeyConfig;
            if (appKeyConfig !== undefined) updatePayload.app_key = appKeyConfig;
            if (authKeyConfig !== undefined) updatePayload.auth_key = authKeyConfig;

            // 1. Tenta PATCH para atualizar se a linha 'whatsapp_schedule' já existir
            const patchRes = await fetch(`${supabaseUrl}/rest/v1/configuracoes?id=eq.whatsapp_schedule`, {
              method: 'PATCH',
              headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
              },
              body: JSON.stringify(updatePayload)
            });

            const patchData = await patchRes.json().catch(() => []);

            // 2. Se nenhuma linha foi atualizada, faz o POST
            if (!patchRes.ok || !Array.isArray(patchData) || patchData.length === 0) {
              await fetch(`${supabaseUrl}/rest/v1/configuracoes`, {
                method: 'POST',
                headers: {
                  'apikey': supabaseKey,
                  'Authorization': `Bearer ${supabaseKey}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  id: 'whatsapp_schedule',
                  ...updatePayload
                })
              });
            }

            // Se pix_key foi passado, atualiza também a tabela configuracoes id=sistema para manter sincronizado
            if (pixKeyConfig) {
              fetch(`${supabaseUrl}/rest/v1/configuracoes?id=eq.sistema`, {
                method: 'PATCH',
                headers: {
                  'apikey': supabaseKey,
                  'Authorization': `Bearer ${supabaseKey}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  pix_key: pixKeyConfig,
                  updated_at: new Date().toISOString()
                })
              }).catch(() => {});
            }

          } catch (err) {
            console.warn('[WhatsApp API] Aviso ao salvar agendamento no Supabase:', err);
          }
        }

        return res.status(200).json({
          sucesso: true,
          mensagem: 'Configuração de WhatsApp e Template salvas com sucesso!',
          configuracao: {
            dias_antecedencia: Number(diasAntesConfig),
            horario_envio: horarioEnvioConfig,
            agendamento_ativo: agendamentoAtivoConfig
          }
        });
      }

      // A. ALERTA DE STATUS DE TELA (OFF/ON) PARA O ADMINISTRADOR
      if (alerta_status_tela || (status && nomeTela)) {
        let adminPhone = phone || number || to || '';

        // Se não fornecido no corpo, busca no Supabase (tabela configuracoes id=sistema ou perfil)
        if (!adminPhone && supabaseUrl && supabaseKey) {
          try {
            const cfgRes = await fetch(`${supabaseUrl}/rest/v1/configuracoes?id=eq.sistema&select=admin_phone,whatsapp`, {
              headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
              }
            });
            if (cfgRes.ok) {
              const cfgData = await cfgRes.json();
              if (cfgData && cfgData.length > 0) {
                adminPhone = cfgData[0].admin_phone || cfgData[0].whatsapp || '';
              }
            }
          } catch (err) {
            console.warn('[WhatsApp API] Aviso ao buscar configuracoes:', err);
          }

          if (!adminPhone) {
            try {
              const perfilRes = await fetch(`${supabaseUrl}/rest/v1/perfil?select=admin_phone,whatsapp,telefone&limit=1`, {
                headers: {
                  'apikey': supabaseKey,
                  'Authorization': `Bearer ${supabaseKey}`
                }
              });
              if (perfilRes.ok) {
                const perfilData = await perfilRes.json();
                if (perfilData && perfilData.length > 0) {
                  adminPhone = perfilData[0].admin_phone || perfilData[0].whatsapp || perfilData[0].telefone || '';
                }
              }
            } catch (err) {
              console.warn('[WhatsApp API] Aviso ao buscar perfil do admin:', err);
            }
          }
        }

        if (!adminPhone) {
          adminPhone = process.env.ADMIN_PHONE || '5544991762249';
        }

        const statusUpper = String(status || 'OFF').toUpperCase();
        const textoAlerta = message || mensagem || `⚠️ ALERTA: A tela ${nomeTela || 'Desconhecida'} acabou de ficar ${statusUpper}.`;

        let numeroLimpo = String(adminPhone).replace(/\D/g, '');
        if (numeroLimpo.length === 10 || numeroLimpo.length === 11) {
          numeroLimpo = '55' + numeroLimpo;
        }

        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };
        if (appKey) headers['appKey'] = appKey;
        if (authKey) headers['authKey'] = authKey;

        const respostaBot = await fetch('https://botbot.chat/api/v2/sendText', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            to: numeroLimpo,
            message: textoAlerta
          })
        });

        const dadosBot = await respostaBot.json().catch(() => ({ success: respostaBot.ok }));

        return res.status(200).json({
          sucesso: respostaBot.ok && dadosBot.success !== false,
          tipo: 'alerta_status_tela',
          statusHttpBot: respostaBot.status,
          respostaDoBotBot: dadosBot
        });
      }

      // B. DISPARO EM LOTE (Puxando do Supabase)
      if (disparar_lote) {
        // 1. Corrige o nome da variável de antecedência e garante que seja número
        const diasAntecedencia = dias_antecedencia !== undefined ? Number(dias_antecedencia) : 2;

        // 2. Ajusta para o horário de Brasília (UTC-3)
        const dataAlvo = new Date();
        dataAlvo.setHours(dataAlvo.getHours() - 3); 
        dataAlvo.setDate(dataAlvo.getDate() + diasAntecedencia);

        // 3. Prepara os dois formatos (ISO e BR) para evitar falha no Supabase
        const dataIso = dataAlvo.toISOString().split('T')[0]; // Ex: 2026-08-03
        
        const dia = String(dataAlvo.getDate()).padStart(2, '0');
        const mes = String(dataAlvo.getMonth() + 1).padStart(2, '0');
        const ano = dataAlvo.getFullYear();
        const dataBr = `${dia}/${mes}/${ano}`; // Ex: 03/08/2026

        if (!supabaseUrl || !supabaseKey) {
          return res.status(500).json({ 
            sucesso: false, 
            erro: 'Variáveis SUPABASE_URL ou SUPABASE_KEY não configuradas.' 
          });
        }

        // Tenta buscar template e Pix no Supabase se não passados no body
        let templateCobranca = body.template_cobranca || body.template || message || mensagem;
        let pixKey = body.pix_key || body.pixKey;

        if (!templateCobranca || !pixKey) {
          try {
            const cfgRes = await fetch(`${supabaseUrl}/rest/v1/configuracoes?id=eq.whatsapp_schedule&select=*`, {
              headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            if (cfgRes.ok) {
              const cfgData = await cfgRes.json();
              if (cfgData && cfgData.length > 0) {
                if (!templateCobranca) templateCobranca = cfgData[0].template_cobranca || cfgData[0].template_mensagem;
                if (!pixKey) pixKey = cfgData[0].pix_key;
              }
            }
            if (!pixKey) {
              const sisRes = await fetch(`${supabaseUrl}/rest/v1/configuracoes?id=eq.sistema&select=pix_key`, {
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
              });
              if (sisRes.ok) {
                const sisData = await sisRes.json();
                if (sisData && sisData.length > 0) pixKey = sisData[0].pix_key;
              }
            }
          } catch (e) {}
        }

        const supRes = await fetch(`${supabaseUrl}/rest/v1/clientes?select=*`, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
          }
        });

        const clientes = await supRes.json();

        if (!supRes.ok) {
          throw new Error(clientes?.message || 'Erro ao consultar a tabela de clientes no Supabase');
        }

        if (!clientes || !Array.isArray(clientes) || clientes.length === 0) {
          return res.status(200).json({ 
            sucesso: true, 
            mensagem: 'Nenhum cliente cadastrado no Supabase.',
            totalProcessados: 0,
            resultados: []
          });
        }

        const resultados = [];
        const vencimentosEncontrados: string[] = [];

        for (const cliente of clientes) {
          const telefone = cliente.whatsapp || cliente.telefone || cliente.contato;
          const nome = cliente.nome_empresa || cliente.nome || 'Cliente';
          const vencimento = cliente.vencimento; 

          if (vencimento) {
            vencimentosEncontrados.push(`${nome}: ${vencimento}`);
          }

          if (!telefone || !vencimento) continue;

          const vencStr = String(vencimento).trim();
          
          // 4. Aceita bater com formato ISO ou Brasileiro
          const isMatch = vencStr.startsWith(dataIso) || 
                          vencStr.startsWith(dataBr) || 
                          matchesDate(vencStr, dataIso, dataBr);

          if (isMatch) {
            let numeroLimpo = String(telefone).replace(/\D/g, '');
            if (numeroLimpo.length === 10 || numeroLimpo.length === 11) {
              numeroLimpo = '55' + numeroLimpo;
            }

            const textoMensagem = formatCobrancaMessage(templateCobranca, cliente, pixKey);

            const headers: Record<string, string> = {
              'Content-Type': 'application/json'
            };
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
              cliente: nome,
              vencimento: vencimento,
              status: respostaBot.ok && dadosBot.success !== false ? 'Enviado com sucesso' : 'Falha',
              respostaBot: dadosBot
            });
          }
        }

        return res.status(200).json({
          sucesso: true,
          datasBuscadas: { iso: dataIso, br: dataBr },
          diasAntecedencia,
          totalClientesAnalisados: clientes.length,
          totalProcessados: resultados.length,
          mensagem: resultados.length === 0 
            ? `Nenhum cliente encontrado com vencimento em ${dataBr} ou ${dataIso} (antecedência de ${diasAntecedencia} dia(s)).` 
            : `Cobranças disparadas com sucesso para ${resultados.length} cliente(s).`,
          amostraVencimentosCadastrados: vencimentosEncontrados.slice(0, 10),
          resultados
        });
      }

      // C. TESTE OU ENVIO INDIVIDUAL
      const numAlvo = phone || number || to;
      const msgAlvo = message || mensagem;

      if (!numAlvo || !msgAlvo) {
        return res.status(400).json({ sucesso: false, erro: 'Informe o número e a mensagem.' });
      }

      let numeroLimpo = String(numAlvo).replace(/\D/g, '');
      if (numeroLimpo.length === 10 || numeroLimpo.length === 11) {
        numeroLimpo = '55' + numeroLimpo;
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (appKey) headers['appKey'] = appKey;
      if (authKey) headers['authKey'] = authKey;

      const respostaBot = await fetch('https://botbot.chat/api/v2/sendText', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          to: numeroLimpo,
          message: msgAlvo
        })
      });

      const dadosBot = await respostaBot.json().catch(() => ({ success: respostaBot.ok }));

      return res.status(200).json({
        sucesso: respostaBot.ok && dadosBot.success !== false,
        statusHttpBot: respostaBot.status,
        respostaDoBotBot: dadosBot
      });

    } catch (err: any) {
      console.error('[API WhatsApp Index] Erro no processamento:', err);
      return res.status(500).json({ sucesso: false, erro: err?.message || 'Erro interno no servidor.' });
    }
  }

  return res.status(405).json({ erro: 'Método não permitido' });
}
