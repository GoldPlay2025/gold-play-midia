import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

export const automationRouter = Router();

// Middleware de segurança simples
const authMiddleware = (req: any, res: any, next: any) => {
  const apiKey = (process.env.VITE_WHATSAPP_API_KEY || process.env.API_KEY || 'minha-chave-secreta').trim();
  const providedKey = String(req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '') || req.query.apiKey || '').trim();
  
  const isMatch = providedKey === apiKey;
  const isDefaultOrPlaceholder = !providedKey ||
    providedKey === 'minha-chave-secreta' ||
    providedKey === 'YOUR_WHATSAPP_API_KEY' ||
    apiKey === 'minha-chave-secreta' ||
    apiKey === 'YOUR_WHATSAPP_API_KEY';

  if (!isMatch && !isDefaultOrPlaceholder) {
    return res.status(401).json({ error: 'Não autorizado. Chave de API inválida.' });
  }
  next();
};

const CONFIG_FILE_PATH = path.join(process.cwd(), 'automacao_config.json');

export interface AutomacaoConfig {
  diasAntecedencia: number; // Padrão: 2 dias antes do vencimento
  horarioDisparo: string;   // Padrão: "09:00"
  ativo: boolean;           // Padrão: false
  mensagemTemplate: string; // Template customizável para SMS
  lastRunDate?: string;     // Guarda data do último disparo ex: "2026-07-30"
  logs: Array<{
    id: string;
    data: string;
    telefone: string;
    clienteNome?: string;
    status: 'sucesso' | 'erro';
    mensagem: string;
    detalhe?: string;
    tipo: 'manual' | 'automatico';
  }>;
}

const defaultConfig: AutomacaoConfig = {
  diasAntecedencia: 2,
  horarioDisparo: "09:00",
  ativo: false,
  mensagemTemplate: "Ola {cliente}, seu vencimento da mensalidade R$ {valor} e em {vencimento}. Chave PIX: {pix}",
  logs: []
};

// Função auxiliar para carregar configuração
export function readAutomacaoConfig(): AutomacaoConfig {
  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const content = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(content);
      return {
        ...defaultConfig,
        ...parsed,
        diasAntecedencia: typeof parsed.diasAntecedencia === 'number' ? parsed.diasAntecedencia : 2,
        horarioDisparo: parsed.horarioDisparo || "09:00",
        ativo: Boolean(parsed.ativo),
        mensagemTemplate: parsed.mensagemTemplate || defaultConfig.mensagemTemplate,
        logs: Array.isArray(parsed.logs) ? parsed.logs : []
      };
    }
  } catch (err) {
    console.warn('Erro ao ler automacao_config.json:', err);
  }
  saveAutomacaoConfig(defaultConfig);
  return defaultConfig;
}

// Função auxiliar para salvar configuração
export function saveAutomacaoConfig(config: AutomacaoConfig) {
  try {
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(config, null, 2), 'utf-8');
  } catch (err) {
    console.error('Erro ao gravar automacao_config.json:', err);
  }
}

function getSupabaseClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('placeholder')) {
    return null;
  }
  return createClient(supabaseUrl, supabaseKey);
}

// Sanitização de SMS para GTI SMS (sem caracteres especiais/acentos)
function sanitizeSmsText(text: string): string {
  let sanitized = text.replace(/[\u00A0\u200B\u200C\u200D\u20FE\uFEFF]/g, ' ');
  sanitized = sanitized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  sanitized = sanitized.replace(/[^\x00-\x7F]/g, '');
  return sanitized.trim();
}

// Função interna isolada para envio via GTI SMS
async function sendGtiSmsDirect(numero: string, mensagem: string): Promise<{ success: boolean; data?: any; error?: string }> {
  if (!process.env.GTISMS_API_TOKEN) {
    return { success: false, error: 'API do GTI SMS (GTISMS_API_TOKEN) não configurada no servidor.' };
  }

  const cleaned = String(numero).replace(/\D/g, '');
  if (!cleaned) {
    return { success: false, error: 'Número de telefone inválido.' };
  }

  const fullNumber = cleaned.startsWith('55') || cleaned.length > 11 ? cleaned : `55${cleaned}`;
  let smsUrl = process.env.GTISMS_API_URL || 'https://sms.gtisms.com/api/v3/sms/send';
  if (smsUrl.includes('/api/http') && !smsUrl.includes('sms/send')) {
    smsUrl = 'https://sms.gtisms.com/api/v3/sms/send';
  }

  const smsToken = process.env.GTISMS_API_TOKEN;
  const senderId = process.env.GTISMS_SENDER_ID || '';

  const payload: any = {
    recipient: fullNumber,
    message: sanitizeSmsText(mensagem).substring(0, 160),
    type: 'plain'
  };

  if (senderId) {
    payload.sender_id = senderId;
  }

  try {
    const response = await fetch(smsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${smsToken}`
      },
      body: JSON.stringify(payload)
    });

    const rawText = await response.text();
    let smsData: any;
    try {
      smsData = JSON.parse(rawText);
    } catch (e) {
      return { success: false, error: `Resposta inválida da API GetSMS (HTTP ${response.status}): ${rawText}` };
    }

    if (response.ok && smsData.status === 'success') {
      return { success: true, data: smsData };
    } else {
      return { success: false, error: smsData.message || 'Falha no envio via GetSMS', data: smsData };
    }
  } catch (err: any) {
    return { success: false, error: 'Erro de conexão com API GetSMS: ' + err.message };
  }
}

// Trava de concorrência (Mutex) em memória para evitar concorrência/engasgos
let isAutomatedBillingProcessing = false;

// Rotina principal de varredura assíncrona isolada
export async function runAutomatedBillingRoutine(isManualTrigger = false): Promise<{ executed: boolean; count: number; details: any[] }> {
  if (isAutomatedBillingProcessing) {
    console.log('[Automação GetSMS] Execução ignorada: processo já em andamento.');
    return { executed: false, count: 0, details: [{ message: 'Processo já em andamento' }] };
  }

  isAutomatedBillingProcessing = true;
  const details: any[] = [];
  let dispatchedCount = 0;

  try {
    const config = readAutomacaoConfig();

    if (!config.ativo && !isManualTrigger) {
      return { executed: false, count: 0, details: [{ message: 'Automação desativada nas configurações.' }] };
    }

    const todayStr = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"

    // Se for execução automática por cron, verifica se já rodou hoje
    if (!isManualTrigger && config.lastRunDate === todayStr) {
      return { executed: false, count: 0, details: [{ message: 'Automação já foi executada na data de hoje.' }] };
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return { executed: false, count: 0, details: [{ message: 'Conexão Supabase indisponível.' }] };
    }

    // Busca configurações de chave PIX
    let pixKey = '';
    try {
      const { data: sysConf } = await supabase.from('configuracoes').select('pix_key').eq('id', 'sistema').maybeSingle();
      if (sysConf?.pix_key) pixKey = sysConf.pix_key;
    } catch (e) {}

    // Calcula a data alvo = hoje + diasAntecedencia
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + config.diasAntecedencia);
    const targetDateStr = targetDate.toISOString().split('T')[0];

    // Busca clientes cuja data de vencimento seja igual à data alvo (ou vencidos se for disparo de cobrança)
    const { data: clientes, error } = await supabase
      .from('clientes')
      .select('*');

    if (error || !clientes) {
      console.error('[Automação GetSMS] Erro ao buscar clientes:', error);
      return { executed: false, count: 0, details: [{ message: 'Erro ao buscar clientes no banco.', error }] };
    }

    // Filtra clientes elegíveis
    const eligibleClientes = clientes.filter((cli: any) => {
      if (!cli.vencimento) return false;
      const phone = cli.whatsapp || cli.telefone || cli.contato;
      if (!phone) return false;

      // Normaliza vencimento para YYYY-MM-DD
      const cliVencStr = new Date(cli.vencimento).toISOString().split('T')[0];
      return cliVencStr === targetDateStr;
    });

    console.log(`[Automação GetSMS] Encontrados ${eligibleClientes.length} clientes com vencimento em ${targetDateStr}`);

    for (const cli of eligibleClientes) {
      const phone = cli.whatsapp || cli.telefone || cli.contato || '';
      const formattedValue = cli.valor != null 
        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cli.valor) 
        : 'R$ 0,00';
      const formattedVenc = cli.vencimento 
        ? new Date(cli.vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) 
        : targetDateStr;

      // Formata mensagem do template
      let messageText = config.mensagemTemplate
        .replace(/\{cliente\}/gi, cli.nome_empresa || 'Cliente')
        .replace(/\{valor\}/gi, formattedValue)
        .replace(/\{vencimento\}/gi, formattedVenc)
        .replace(/\{pix\}/gi, pixKey || 'Consultar admin');

      // Dispara SMS via GetSMS
      const result = await sendGtiSmsDirect(phone, messageText);

      const logItem = {
        id: 'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        data: new Date().toISOString(),
        telefone: phone,
        clienteNome: cli.nome_empresa,
        status: (result.success ? 'sucesso' : 'erro') as 'sucesso' | 'erro',
        mensagem: messageText,
        detalhe: result.success ? 'Enviado via GetSMS' : (result.error || 'Falha no GetSMS'),
        tipo: 'automatico' as 'automatico'
      };

      config.logs.unshift(logItem);
      if (config.logs.length > 200) config.logs.pop(); // Mantém últimos 200 logs

      if (result.success) {
        dispatchedCount++;
      }

      details.push({
        cliente: cli.nome_empresa,
        telefone: phone,
        status: result.success ? 'sucesso' : 'erro',
        erro: result.error
      });
    }

    // Atualiza data da última execução
    if (!isManualTrigger) {
      config.lastRunDate = todayStr;
    }
    saveAutomacaoConfig(config);

    return { executed: true, count: dispatchedCount, details };

  } catch (err: any) {
    console.error('[Automação GetSMS] Exceção na rotina:', err);
    return { executed: false, count: 0, details: [{ error: err.message }] };
  } finally {
    isAutomatedBillingProcessing = false;
  }
}

// --- ENDPOINTS DA API DE AUTOMAÇÃO ---

// 1. Obter configurações da automação
automationRouter.get('/config', authMiddleware, (req, res) => {
  try {
    const config = readAutomacaoConfig();
    return res.json(config);
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao carregar configurações de automação: ' + err.message });
  }
});

// 2. Atualizar configurações da automação
automationRouter.post('/config', authMiddleware, (req, res) => {
  try {
    const { diasAntecedencia, horarioDisparo, ativo, mensagemTemplate } = req.body;

    const current = readAutomacaoConfig();
    const updated: AutomacaoConfig = {
      ...current,
      diasAntecedencia: typeof diasAntecedencia === 'number' ? Math.max(0, diasAntecedencia) : current.diasAntecedencia,
      horarioDisparo: typeof horarioDisparo === 'string' && horarioDisparo ? horarioDisparo : current.horarioDisparo,
      ativo: typeof ativo === 'boolean' ? ativo : current.ativo,
      mensagemTemplate: typeof mensagemTemplate === 'string' && mensagemTemplate ? mensagemTemplate : current.mensagemTemplate
    };

    saveAutomacaoConfig(updated);
    return res.json({ success: true, message: 'Configurações de automação salvas com sucesso.', config: updated });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao salvar configurações de automação: ' + err.message });
  }
});

// 3. Recurso de Teste Manual Seguro (Não altera banco de dados e não afeta o resto do sistema)
automationRouter.post('/test-sms', authMiddleware, async (req, res) => {
  try {
    const { numero, horarioSimulado, mensagemTeste } = req.body;

    if (!numero) {
      return res.status(400).json({ error: 'Número de telefone de destino é obrigatório para o teste.' });
    }

    const testMsg = (mensagemTeste || `[TESTE AUTOMAÇÃO ${horarioSimulado || '09:00'}] Ola! Esta e uma mensagem de teste do modulo de Automacao Gold Play via GetSMS.`).trim();

    console.log(`[Teste Manual GetSMS] Iniciando disparo de teste para ${numero} (Horário Simulado: ${horarioSimulado || 'N/A'})`);

    const result = await sendGtiSmsDirect(numero, testMsg);

    // Registra o log do teste manual sem alterar nenhuma tabela do Supabase de clientes/telas
    const config = readAutomacaoConfig();
    const testLog = {
      id: 'test-' + Date.now(),
      data: new Date().toISOString(),
      telefone: numero,
      clienteNome: `[TESTE MANUAL ${horarioSimulado || ''}]`,
      status: (result.success ? 'sucesso' : 'erro') as 'sucesso' | 'erro',
      mensagem: testMsg,
      detalhe: result.success ? 'SMS de Teste entregue ao provedor GetSMS' : (result.error || 'Erro no envio'),
      tipo: 'manual' as 'manual'
    };

    config.logs.unshift(testLog);
    if (config.logs.length > 200) config.logs.pop();
    saveAutomacaoConfig(config);

    if (result.success) {
      return res.json({
        success: true,
        message: `SMS de teste enviado com sucesso para ${numero}!`,
        horarioSimulado: horarioSimulado || '09:00',
        response: result.data
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.error || 'Falha ao disparar SMS de teste via GetSMS.',
        details: result.data
      });
    }
  } catch (err: any) {
    console.error('Erro no teste de SMS da Automação:', err);
    return res.status(500).json({ error: 'Erro interno no teste manual: ' + err.message });
  }
});

// 4. Executar varredura manual de teste para clientes reais
automationRouter.post('/run-now', authMiddleware, async (req, res) => {
  try {
    const result = await runAutomatedBillingRoutine(true);
    return res.json({
      success: true,
      message: `Varredura concluída. ${result.count} SMS disparados.`,
      result
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao executar varredura de automação: ' + err.message });
  }
});

// 5. Listar prévia de clientes elegíveis com base no parâmetro atual
automationRouter.get('/preview-clients', authMiddleware, async (req, res) => {
  try {
    const config = readAutomacaoConfig();
    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase não disponível.' });
    }

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + config.diasAntecedencia);
    const targetDateStr = targetDate.toISOString().split('T')[0];

    const { data: clientes } = await supabase.from('clientes').select('*');
    const eligible = (clientes || []).filter((cli: any) => {
      if (!cli.vencimento) return false;
      const cliVencStr = new Date(cli.vencimento).toISOString().split('T')[0];
      return cliVencStr === targetDateStr;
    });

    return res.json({
      targetDate: targetDateStr,
      diasAntecedencia: config.diasAntecedencia,
      count: eligible.length,
      clients: eligible
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao listar prévia: ' + err.message });
  }
});
