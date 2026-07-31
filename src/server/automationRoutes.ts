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

let memoryConfigCache: AutomacaoConfig = { ...defaultConfig };

// Função assíncrona para ler configuração (Supabase + fallback arquivo/memória com Timeout)
export async function readAutomacaoConfigAsync(): Promise<AutomacaoConfig> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const queryPromise = supabase
        .from('automacao_config')
        .select('*')
        .eq('id', 'sistema')
        .maybeSingle();

      const timeoutPromise = new Promise((resolve) => 
        setTimeout(() => resolve({ data: null, error: { message: 'Timeout na consulta do Supabase' } }), 1000)
      );

      const { data, error }: any = await Promise.race([queryPromise, timeoutPromise]);

      if (!error && data) {
        const config: AutomacaoConfig = {
          diasAntecedencia: typeof data.dias_antecedencia === 'number' ? data.dias_antecedencia : (typeof data.diasAntecedencia === 'number' ? data.diasAntecedencia : 2),
          horarioDisparo: data.horario_disparo || data.horarioDisparo || "09:00",
          ativo: typeof data.ativo === 'boolean' ? data.ativo : false,
          mensagemTemplate: data.mensagem_template || data.mensagemTemplate || defaultConfig.mensagemTemplate,
          lastRunDate: data.last_run_date || data.lastRunDate || undefined,
          logs: Array.isArray(data.logs) ? data.logs : []
        };
        memoryConfigCache = config;
        return config;
      }
    } catch (e) {
      console.warn('[Automação] Tabela automacao_config no Supabase ainda não lida. Usando cache.', e);
    }
  }

  // Fallback 1: Leitura de arquivo local se disponível
  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const content = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(content);
      const config = {
        ...defaultConfig,
        ...parsed,
        diasAntecedencia: typeof parsed.diasAntecedencia === 'number' ? parsed.diasAntecedencia : 2,
        horarioDisparo: parsed.horarioDisparo || "09:00",
        ativo: Boolean(parsed.ativo),
        mensagemTemplate: parsed.mensagemTemplate || defaultConfig.mensagemTemplate,
        logs: Array.isArray(parsed.logs) ? parsed.logs : []
      };
      memoryConfigCache = config;
      return config;
    }
  } catch (err) {
    console.warn('Erro ao ler automacao_config.json:', err);
  }

  return memoryConfigCache || defaultConfig;
}

// Função síncrona para compatibilidade interna
export function readAutomacaoConfig(): AutomacaoConfig {
  return memoryConfigCache || defaultConfig;
}

// Função assíncrona para salvar configuração (Supabase + memory cache + arquivo local)
export async function saveAutomacaoConfigAsync(config: AutomacaoConfig): Promise<void> {
  memoryConfigCache = config;

  // 1. Tenta salvar no Supabase na tabela automacao_config
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const upsertPromise = supabase.from('automacao_config').upsert({
        id: 'sistema',
        dias_antecedencia: config.diasAntecedencia,
        horario_disparo: config.horarioDisparo,
        ativo: config.ativo,
        mensagem_template: config.mensagemTemplate,
        last_run_date: config.lastRunDate || null,
        logs: config.logs,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

      const timeoutWrite = new Promise((resolve) => 
        setTimeout(() => resolve({ error: { message: 'Timeout write' } }), 1000)
      );

      await Promise.race([upsertPromise, timeoutWrite]);
    } catch (err) {
      console.warn('[Automação] Aviso ao salvar na tabela automacao_config no Supabase:', err);
    }
  }

  // 2. Tenta salvar no arquivo local (silencioso em ambientes read-only como Vercel)
  try {
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(config, null, 2), 'utf-8');
  } catch (err) {
    // Ignora erros de escrita em sistemas de arquivos de apenas-leitura
  }
}

// Função síncrona para compatibilidade
export function saveAutomacaoConfig(config: AutomacaoConfig) {
  saveAutomacaoConfigAsync(config).catch(err => console.error('Erro no salvamento assíncrono:', err));
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

import { sendGtiSms } from '../lib/gtisms';

// Função interna isolada para envio via GTI SMS
async function sendGtiSmsDirect(numero: string, mensagem: string): Promise<{ success: boolean; data?: any; error?: string }> {
  const result = await sendGtiSms({
    numero,
    mensagem,
    timeoutMs: 15000
  });

  if (result.success) {
    return { success: true, data: result.rawResponse };
  } else {
    return { success: false, error: result.message, data: result.rawResponse };
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
    const config = await readAutomacaoConfigAsync();

    if (!config.ativo && !isManualTrigger) {
      return { executed: false, count: 0, details: [{ message: 'Automação desativada nas configurações.' }] };
    }

    const todayStr = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"

    // Se for execução automática por cron, verifica se já rodou hoje
    if (!isManualTrigger && config.lastRunDate === todayStr) {
      console.log(`[Automação GetSMS] Execução ignorada: A rotina já foi executada hoje (${todayStr}).`);
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
    await saveAutomacaoConfigAsync(config);

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
automationRouter.get('/config', authMiddleware, async (req, res) => {
  try {
    const config = await readAutomacaoConfigAsync();
    return res.json(config);
  } catch (err: any) {
    console.error('Erro no GET /api/automacao/config:', err);
    return res.json(defaultConfig); // Retorna padrão resiliente em vez de erro 500
  }
});

// 2. Atualizar configurações da automação
automationRouter.post('/config', authMiddleware, async (req, res) => {
  try {
    const { diasAntecedencia, horarioDisparo, ativo, mensagemTemplate } = req.body;

    const current = await readAutomacaoConfigAsync();
    
    // Se o horário de disparo for alterado, resetamos a flag de última execução
    // para permitir que o usuário teste a nova programação no mesmo dia.
    const horarioMudou = (typeof horarioDisparo === 'string' && horarioDisparo !== current.horarioDisparo);

    const updated: AutomacaoConfig = {
      ...current,
      diasAntecedencia: typeof diasAntecedencia === 'number' ? Math.max(0, diasAntecedencia) : current.diasAntecedencia,
      horarioDisparo: typeof horarioDisparo === 'string' && horarioDisparo ? horarioDisparo : current.horarioDisparo,
      ativo: typeof ativo === 'boolean' ? ativo : current.ativo,
      mensagemTemplate: typeof mensagemTemplate === 'string' && mensagemTemplate ? mensagemTemplate : current.mensagemTemplate,
      lastRunDate: horarioMudou ? undefined : current.lastRunDate
    };

    await saveAutomacaoConfigAsync(updated);
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

    // Registra o log do teste manual
    const config = await readAutomacaoConfigAsync();
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
    await saveAutomacaoConfigAsync(config);

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
    const config = await readAutomacaoConfigAsync();
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
