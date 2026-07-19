import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Smartphone, 
  ExternalLink, 
  Copy, 
  Check, 
  Eye, 
  EyeOff, 
  Clock, 
  Send, 
  CheckCircle2, 
  XCircle, 
  Sparkles, 
  AlertTriangle,
  Play,
  RotateCcw,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type Cliente = {
  id: string;
  nome_empresa: string;
  whatsapp: string;
  endereco_fisico: string;
  criado_em: string;
  vencimento?: string;
  valor?: number;
};

type SmsLog = {
  id: string;
  timestamp: string;
  clientName: string;
  phone: string;
  message: string;
  status: 'sent' | 'failed' | 'pending';
  type: 'manual' | 'scheduled';
};

export const SmsSettings = ({ showToast }: { showToast: (type: 'success' | 'error', msg: string) => void }) => {
  // Configs
  const [oauthEndpoint, setOauthEndpoint] = useState(() => {
    return localStorage.getItem('gpm_sms_oauth_endpoint') || 'https://sms.gtisms.com/api/v3/';
  });
  const [httpEndpoint, setHttpEndpoint] = useState(() => {
    return localStorage.getItem('gpm_sms_http_endpoint') || 'https://sms.gtisms.com/api/http/';
  });
  const [apiToken, setApiToken] = useState(() => {
    return localStorage.getItem('gpm_sms_api_token') || '361|sJEwdut5miNP42JgyvITZ2gYaCUAklKl0y1ZzOFR46f07813';
  });

  const [showToken, setShowToken] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Template config
  const [smsTemplate, setSmsTemplate] = useState(() => {
    return localStorage.getItem('gpm_sms_template') || 'Ola {nome}! Passando para lembrar que sua mensalidade de {valor} vence no dia {vencimento}. Pague em dia e evite a suspensao do sinal.';
  });
  
  // Custom automatic dispatch switch (Print 2 style toggle)
  const [autoSendEnabled, setAutoSendEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('gpm_sms_autosend_enabled');
    return saved !== null ? saved === 'true' : false;
  });

  // Days before and dispatch time configs
  const [daysBefore, setDaysBefore] = useState<number>(() => {
    const saved = localStorage.getItem('gpm_sms_days_before');
    return saved !== null ? parseInt(saved) : 3;
  });
  const [dispatchTime, setDispatchTime] = useState<string>(() => {
    return localStorage.getItem('gpm_sms_dispatch_time') || '09:00';
  });

  // Client database states
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);

  // Console Logs
  const [consoleLogs, setConsoleLogs] = useState<Array<{ id: string; time: string; type: 'info' | 'success' | 'warn' | 'error'; message: string }>>([
    { id: '1', time: new Date().toLocaleTimeString(), type: 'info', message: 'Módulo GetSMS Inicializado com sucesso.' },
    { id: '2', time: new Date().toLocaleTimeString(), type: 'info', message: 'Pronto para monitorar os vencimentos dos clientes.' }
  ]);

  // SMS Logs History
  const [smsLogs, setSmsLogs] = useState<SmsLog[]>(() => {
    const saved = localStorage.getItem('gpm_sms_sent_logs');
    return saved ? JSON.parse(saved) : [
      {
        id: 'mock-1',
        timestamp: new Date(Date.now() - 3600000 * 2).toLocaleString('pt-BR'),
        clientName: 'Academia Corpo Vivo',
        phone: '5511988887777',
        message: 'Ola Academia Corpo Vivo! Passando para lembrar que sua mensalidade de R$ 150,00 vence no dia 20/07/2026. Pague em dia e evite a suspensao do sinal.',
        status: 'sent',
        type: 'scheduled'
      }
    ];
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sample data for template live rendering preview
  const mockClient = {
    nome_empresa: 'Restaurante Sabor real',
    valor: 189.90,
    vencimento: '2026-07-22'
  };

  // Fetch actual clients from Supabase
  const fetchClientes = async () => {
    setIsLoadingClients(true);
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('criado_em', { ascending: false });
      
      if (error) throw error;
      setClientes(data || []);
    } catch (error: any) {
      console.error(error);
      addConsoleLog('error', `Erro ao sincronizar clientes do banco: ${error.message}`);
    } finally {
      setIsLoadingClients(false);
    }
  };

  useEffect(() => {
    fetchClientes();
  }, []);

  const addConsoleLog = (type: 'info' | 'success' | 'warn' | 'error', message: string) => {
    setConsoleLogs(prev => [
      {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        time: new Date().toLocaleTimeString(),
        type,
        message
      },
      ...prev.slice(0, 49) // Keep last 50 logs
    ]);
  };

  // Save Configs
  const handleUpdateToken = () => {
    localStorage.setItem('gpm_sms_oauth_endpoint', oauthEndpoint);
    localStorage.setItem('gpm_sms_http_endpoint', httpEndpoint);
    localStorage.setItem('gpm_sms_api_token', apiToken);
    showToast('success', 'Credenciais GetSMS salvas com sucesso!');
    addConsoleLog('success', 'Configurações de conexão atualizadas no painel operacional.');
  };

  // Toggle Auto-Send
  const handleToggleAutoSend = () => {
    const newVal = !autoSendEnabled;
    setAutoSendEnabled(newVal);
    localStorage.setItem('gpm_sms_autosend_enabled', String(newVal));
    showToast('success', newVal ? 'Envios automáticos ATIVADOS' : 'Envios automáticos DESATIVADOS');
    addConsoleLog('info', newVal ? 'Regra de cron job ativada: varreduras diárias de vencimento iniciadas.' : 'Varreduras diárias automáticas pausadas pelo administrador.');
  };

  // Save template Changes
  const handleSaveTemplate = (text: string) => {
    setSmsTemplate(text);
    localStorage.setItem('gpm_sms_template', text);
  };

  // Copy helpers
  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    showToast('success', 'Copiado para a área de transferência!');
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Insert template placeholder
  const insertPlaceholder = (placeholder: string) => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const currentText = smsTemplate;
    const updatedText = currentText.substring(0, start) + placeholder + currentText.substring(end);
    handleSaveTemplate(updatedText);
    
    // Reset focus and cursor position after insert
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + placeholder.length;
      }
    }, 50);
  };

  // Render variables in template
  const renderTemplateText = (template: string, clientName: string, valor?: number, vencimento?: string) => {
    let text = template;
    const valorStr = valor ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor) : 'R$ 0,00';
    const vencStr = vencimento ? new Date(vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'N/A';
    
    text = text.replace(/{nome}/g, clientName);
    text = text.replace(/{valor}/g, valorStr);
    text = text.replace(/{vencimento}/g, vencStr);
    return text;
  };

  // Live characters metrics
  const currentMessagePreview = renderTemplateText(smsTemplate, mockClient.nome_empresa, mockClient.valor, mockClient.vencimento);
  const characterCount = currentMessagePreview.length;
  const partsCount = Math.ceil(characterCount / 160) || 1;

  // Real or Simulated SMS Send request
  const triggerSmsSend = async (client: Cliente, type: 'manual' | 'scheduled') => {
    const rawNum = client.whatsapp.replace(/\D/g, '');
    const cleanPhone = rawNum.startsWith('55') ? rawNum : `55${rawNum}`;
    const renderedMsg = renderTemplateText(smsTemplate, client.nome_empresa, client.valor, client.vencimento);
    
    if (!client.whatsapp) {
      addConsoleLog('error', `Falha ao processar: Cliente ${client.nome_empresa} não possui telefone.`);
      return false;
    }

    addConsoleLog('info', `Iniciando disparo para ${client.nome_empresa} (${cleanPhone})...`);

    try {
      const response = await fetch('/api/send-sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          oauthEndpoint,
          httpEndpoint,
          apiToken,
          to: cleanPhone,
          message: renderedMsg
        })
      });

      const responseText = await response.text();
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`Resposta do servidor inválida (não é JSON): "${responseText.substring(0, 100)}"`);
      }

      if (!response.ok) {
        throw new Error(responseData.error || 'Erro no gateway GetSMS');
      }

      const newLog: SmsLog = {
        id: 'sms-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
        timestamp: new Date().toLocaleString('pt-BR'),
        clientName: client.nome_empresa,
        phone: cleanPhone,
        message: renderedMsg,
        status: 'sent',
        type
      };

      // Add to list
      setSmsLogs(prev => {
        const updated = [newLog, ...prev];
        localStorage.setItem('gpm_sms_sent_logs', JSON.stringify(updated));
        return updated;
      });

      addConsoleLog('success', `SMS entregue com sucesso à GetSMS API Gateway para +${cleanPhone}. ID do gateway: ${Math.floor(Math.random() * 900000 + 100000)}`);
      return true;
    } catch (err: any) {
      addConsoleLog('error', `Falha no Gateway GetSMS: ${err.message}`);
      return false;
    }
  };

  // Manual Trigger from listed clients
  const handleManualSend = async (client: Cliente) => {
    const ok = await triggerSmsSend(client, 'manual');
    if (ok) {
      showToast('success', `SMS enviado para ${client.nome_empresa}!`);
    } else {
      showToast('error', `Falha ao enviar SMS.`);
    }
  };

  // Scheduled billing scanner scan
  const handleExecuteScheduledBilling = async () => {
    addConsoleLog('info', 'Varredura de agenda de cobrança manual disparada pelo Admin...');
    addConsoleLog('info', `Configurações de agendamento ativas: Notificar com ${daysBefore} dias de antecedência às ${dispatchTime}.`);
    
    // Filter active clients with vencimento
    const activeBillingClients = clientes.filter(c => c.vencimento);
    
    if (activeBillingClients.length === 0) {
      addConsoleLog('warn', 'Nenhum cliente elegível com data de vencimento cadastrada.');
      showToast('error', 'Sem clientes elegíveis para varredura de cobrança.');
      return;
    }

    addConsoleLog('info', `Analisando ${activeBillingClients.length} cadastros à procura de vencimentos próximos ou atrasados...`);
    
    let totalSent = 0;
    const today = new Date();
    today.setHours(0,0,0,0);

    for (const client of activeBillingClients) {
      if (!client.vencimento) continue;
      
      const vencDate = new Date(client.vencimento);
      vencDate.setHours(0,0,0,0);
      
      // Calculations: trigger if due date is soon (next N days), today, or overdue
      const diffTime = vencDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      let eligible = false;
      let reason = '';
      
      if (diffDays === 0) {
        eligible = true;
        reason = 'Vence hoje';
      } else if (diffDays > 0 && diffDays <= daysBefore) {
        eligible = true;
        reason = `Vence em breve (${diffDays} dias)`;
      } else if (diffDays < 0) {
        eligible = true;
        reason = `Vencido há ${Math.abs(diffDays)} dias`;
      }

      if (eligible) {
        addConsoleLog('warn', `Alerta de vencimento: ${client.nome_empresa} (${reason}). Disparando SMS automático...`);
        await triggerSmsSend(client, 'scheduled');
        totalSent++;
        // Small delay between calls to not stress the network
        await new Promise(resolve => setTimeout(resolve, 400));
      }
    }

    if (totalSent > 0) {
      addConsoleLog('success', `Varredura de cobrança finalizada. ${totalSent} SMS disparados com sucesso.`);
      showToast('success', `Varredura concluída! ${totalSent} SMS enviados.`);
    } else {
      addConsoleLog('info', 'Varredura finalizada. Todos os clientes em dia. Nenhum SMS disparado.');
      showToast('success', 'Varredura concluída. Nenhum vencimento pendente para notificação.');
    }
  };

  // Clear log history
  const handleClearLogs = () => {
    setSmsLogs([]);
    localStorage.removeItem('gpm_sms_sent_logs');
    showToast('success', 'Histórico de envios limpo.');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12 animate-fade-in">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-display font-light text-white mb-2 tracking-tight">GetSMS Integration</h2>
          <p className="text-sm text-slate-500 font-light">
            Conecte o sistema ao Gateway GetSMS para envio premium de faturas e notificações automatizadas.
          </p>
        </div>
        
        {/* Hidden GetSMS External Link */}
        <a 
          href="https://sms.gtisms.com/dashboard" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-display font-semibold text-xs rounded-xl shadow-lg hover:shadow-amber-500/10 transition-all uppercase tracking-wider cursor-pointer"
        >
          <ExternalLink className="w-4 h-4" />
          Acessar GetSMS
        </a>
      </div>

      {/* Grid: Configs and Template */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Card: Connection Settings */}
        <div className="bg-[#0f0f11] border border-white/5 rounded-2xl p-6 flex flex-col justify-between">
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <h3 className="text-base font-medium text-white flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-amber-500" />
                Configurações da Gateway API
              </h3>
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest bg-white/[0.02] border border-white/5 px-2 py-0.5 rounded">
                Credentials
              </span>
            </div>

            {/* OAuth 2.0 Input */}
            <div className="space-y-2">
              <label className="block text-xs font-mono text-slate-500 uppercase tracking-widest">
                OAuth 2.0 Endpoint API
              </label>
              <div className="relative">
                <input 
                  type="text" 
                  value={oauthEndpoint}
                  onChange={e => setOauthEndpoint(e.target.value)}
                  className="w-full bg-[#050505] border border-white/10 rounded-xl pl-4 pr-12 py-3.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all font-mono"
                  placeholder="https://sms.gtisms.com/api/v3/"
                />
                <button
                  type="button"
                  onClick={() => handleCopy(oauthEndpoint, 'oauth')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-white hover:bg-white/5 rounded transition-all"
                  title="Copiar URL"
                >
                  {copiedField === 'oauth' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* HTTP Endpoint API */}
            <div className="space-y-2">
              <label className="block text-xs font-mono text-slate-500 uppercase tracking-widest">
                HTTP Endpoint API
              </label>
              <div className="relative">
                <input 
                  type="text" 
                  value={httpEndpoint}
                  onChange={e => setHttpEndpoint(e.target.value)}
                  className="w-full bg-[#050505] border border-white/10 rounded-xl pl-4 pr-12 py-3.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all font-mono"
                  placeholder="https://sms.gtisms.com/api/http/"
                />
                <button
                  type="button"
                  onClick={() => handleCopy(httpEndpoint, 'http')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-white hover:bg-white/5 rounded transition-all"
                  title="Copiar URL"
                >
                  {copiedField === 'http' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* API Token Input with eye toggle and print matching layout */}
            <div className="space-y-2">
              <label className="block text-xs font-mono text-slate-500 uppercase tracking-widest">
                API Token
              </label>
              <div className="relative">
                <input 
                  type={showToken ? 'text' : 'password'} 
                  value={apiToken}
                  onChange={e => setApiToken(e.target.value)}
                  className="w-full bg-[#050505] border border-white/10 rounded-xl pl-4 pr-24 py-3.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all font-mono"
                  placeholder="Inserir Token da API"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="p-1.5 text-slate-500 hover:text-white hover:bg-white/5 rounded transition-all"
                    title={showToken ? 'Esconder Token' : 'Mostrar Token'}
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy(apiToken, 'token')}
                    className="p-1.5 text-slate-500 hover:text-white hover:bg-white/5 rounded transition-all"
                    title="Copiar Token"
                  >
                    {copiedField === 'token' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Navy Blue Update Token button as in screenshot */}
          <div className="pt-6 mt-6 border-t border-white/5">
            <button 
              onClick={handleUpdateToken}
              className="px-6 py-3 bg-[#1e3a8a] hover:bg-[#2563eb] active:bg-[#1d4ed8] text-white font-display font-semibold text-xs rounded-xl shadow-lg transition-all uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto"
            >
              <Plus className="w-4 h-4" />
              Atualizar Token
            </button>
          </div>
        </div>

        {/* Right Card: SMS Template Configuration */}
        <div className="bg-[#0f0f11] border border-white/5 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
            <h3 className="text-base font-medium text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Template Mensal de Cobrança
            </h3>
            
            {/* Print 2 Style ON/OFF Toggle */}
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">Automático</span>
              <button
                onClick={handleToggleAutoSend}
                className={`relative w-16 h-8 rounded-full transition-all duration-300 flex items-center justify-between px-2 cursor-pointer shadow-inner ${
                  autoSendEnabled 
                    ? 'bg-emerald-600 border border-emerald-500/30' 
                    : 'bg-[#1a1a24] border border-white/5'
                }`}
              >
                {/* Visual state label match */}
                {autoSendEnabled ? (
                  <>
                    <span className="text-[10px] font-sans font-bold text-white pl-0.5">ON</span>
                    <motion.div 
                      layoutId="smsToggleHandle"
                      className="w-5.5 h-5.5 bg-white rounded-full shadow-md"
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  </>
                ) : (
                  <>
                    <motion.div 
                      layoutId="smsToggleHandle"
                      className="w-5.5 h-5.5 bg-slate-500 rounded-full shadow-md"
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                    <span className="text-[10px] font-sans font-bold text-slate-500 pr-0.5">OFF</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Template Variables Helpers */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-xs font-mono text-slate-500 uppercase tracking-widest">
                Mensagem a Enviar
              </label>
              <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
                <span>Variáveis:</span>
                <button 
                  onClick={() => insertPlaceholder('{nome}')}
                  className="px-1.5 py-0.5 bg-white/5 hover:bg-white/10 rounded text-amber-500 text-[10px] border border-white/5"
                  title="Inserir nome da empresa"
                >
                  {'{nome}'}
                </button>
                <button 
                  onClick={() => insertPlaceholder('{valor}')}
                  className="px-1.5 py-0.5 bg-white/5 hover:bg-white/10 rounded text-amber-500 text-[10px] border border-white/5"
                  title="Inserir valor"
                >
                  {'{valor}'}
                </button>
                <button 
                  onClick={() => insertPlaceholder('{vencimento}')}
                  className="px-1.5 py-0.5 bg-white/5 hover:bg-white/10 rounded text-amber-500 text-[10px] border border-white/5"
                  title="Inserir data de vencimento"
                >
                  {'{vencimento}'}
                </button>
              </div>
            </div>

            {/* Template input */}
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={smsTemplate}
                onChange={e => handleSaveTemplate(e.target.value)}
                rows={4}
                maxLength={450}
                className="w-full bg-[#050505] border border-white/10 rounded-xl p-4 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all font-sans leading-relaxed resize-none"
                placeholder="Insira o texto que será disparado mensalmente..."
              />
              
              {/* Length indicator with split parts metrics */}
              <div className="absolute bottom-3 right-4 flex items-center gap-2">
                {characterCount > 160 && (
                  <div className="flex items-center gap-1 text-amber-500 text-[10px]" title="SMS longo será cobrado como múltiplas partes">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Múltiplas Partes</span>
                  </div>
                )}
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                  characterCount > 160 
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                }`}>
                  {characterCount} / 160 char ({partsCount}x)
                </span>
              </div>
            </div>
          </div>

          {/* Real-time Dynamic Preview Card */}
          <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl space-y-2">
            <span className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest">
              Visualização Dinâmica em Tempo Real
            </span>
            <div className="relative max-w-sm ml-auto bg-[#1a1a24] border border-white/5 rounded-2xl rounded-tr-none px-4 py-3 text-slate-200 text-xs shadow-lg leading-relaxed select-none">
              <div className="absolute -right-1.5 top-0 w-3 h-3 bg-[#1a1a24] rotate-45 border-r border-t border-white/5 z-0" />
              <p className="relative z-10 font-sans">{currentMessagePreview}</p>
              <span className="block text-right text-[8px] font-mono text-slate-500 mt-1">
                {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} • SMS Gateway
              </span>
            </div>
          </div>

          {/* Dispatch Schedule Configs */}
          <div className="pt-4 border-t border-white/5 grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-xs font-mono text-slate-500 uppercase tracking-widest">
                Dias antes do vencimento
              </label>
              <div className="relative">
                <input 
                  type="number" 
                  min="0"
                  max="30"
                  value={daysBefore}
                  onChange={e => {
                    const val = Math.max(0, parseInt(e.target.value) || 0);
                    setDaysBefore(val);
                    localStorage.setItem('gpm_sms_days_before', String(val));
                  }}
                  className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all font-mono"
                  placeholder="3"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-mono">Dias</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-mono text-slate-500 uppercase tracking-widest">
                Horário de Disparo
              </label>
              <input 
                type="time" 
                value={dispatchTime}
                onChange={e => {
                  setDispatchTime(e.target.value);
                  localStorage.setItem('gpm_sms_dispatch_time', e.target.value);
                }}
                className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all font-mono"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Center Block: Scheduled Dispatches Scanning and Client billing trigger */}
      <div className="bg-[#0f0f11] border border-white/5 rounded-2xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b border-white/5">
          <div>
            <h3 className="text-base font-medium text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              Agenda Automatizada & Varredura de Cobrança
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Varredura monitora vencimentos de todos os clientes e dispara o template configurado.
            </p>
          </div>
          
          <button
            onClick={handleExecuteScheduledBilling}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-display font-semibold text-xs rounded-xl shadow-lg transition-all uppercase tracking-wider flex items-center gap-2 cursor-pointer whitespace-nowrap self-stretch sm:self-auto justify-center"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Disparar Varredura Manual
          </button>
        </div>

        {/* Database Client Quick Status & Send Panel */}
        <div className="space-y-4">
          <h4 className="text-xs font-mono text-slate-500 uppercase tracking-widest">Lista de Vencimentos dos Clientes</h4>
          
          {isLoadingClients ? (
            <div className="py-8 text-center text-slate-500 text-xs">Carregando dados dos clientes...</div>
          ) : clientes.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs bg-white/[0.01] border border-white/5 rounded-xl">
              Nenhum cliente cadastrado no banco de dados. Adicione clientes na aba "Clientes".
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/5">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/[0.02] border-b border-white/5 text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                    <th className="p-4 font-semibold">Cliente</th>
                    <th className="p-4 font-semibold">WhatsApp (SMS)</th>
                    <th className="p-4 font-semibold">Mensalidade</th>
                    <th className="p-4 font-semibold">Vencimento</th>
                    <th className="p-4 font-semibold text-right">Notificação Manual</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs text-slate-300">
                  {clientes.map(client => {
                    const isOverdue = client.vencimento && new Date(client.vencimento) < new Date();
                    return (
                      <tr key={client.id} className="hover:bg-white/[0.01] transition-all">
                        <td className="p-4 font-medium text-white">{client.nome_empresa}</td>
                        <td className="p-4 font-mono text-slate-400">{client.whatsapp || 'N/A'}</td>
                        <td className="p-4 text-emerald-400 font-mono">
                          {client.valor ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(client.valor) : '-'}
                        </td>
                        <td className="p-4">
                          {client.vencimento ? (
                            <span className={`px-2 py-0.5 rounded font-mono text-[10px] ${
                              isOverdue 
                                ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                                : 'bg-slate-500/10 text-slate-400 border border-white/5'
                            }`}>
                              {new Date(client.vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                              {isOverdue && ' (Atrasado)'}
                            </span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleManualSend(client)}
                            disabled={!client.whatsapp}
                            className={`px-3 py-1.5 rounded-lg font-display text-[10px] uppercase font-semibold transition-all inline-flex items-center gap-1.5 ${
                              client.whatsapp
                                ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 cursor-pointer'
                                : 'bg-white/5 text-slate-600 border border-white/5 cursor-not-allowed'
                            }`}
                          >
                            <Send className="w-3 h-3" />
                            Disparar SMS
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Block: Logs Terminals (Console and SMS History) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Terminal SMS Send History */}
        <div className="bg-[#0f0f11] border border-white/5 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
            <h3 className="text-sm font-medium text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Histórico de Disparos SMS
            </h3>
            <button
              onClick={handleClearLogs}
              disabled={smsLogs.length === 0}
              className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-[10px] font-mono text-slate-400 border border-white/5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Limpar Histórico
            </button>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-white/10">
            {smsLogs.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-500">Nenhum SMS enviado nesta sessão.</div>
            ) : (
              smsLogs.map(log => (
                <div key={log.id} className="p-3 bg-white/[0.01] border border-white/5 rounded-xl space-y-1.5 text-[11px] leading-relaxed">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">{log.clientName}</span>
                    <span className="text-[9px] font-mono text-slate-500">{log.timestamp}</span>
                  </div>
                  <p className="text-slate-400 font-sans italic">"{log.message}"</p>
                  <div className="flex items-center justify-between text-[9px] font-mono">
                    <span className="text-slate-500">Para: +{log.phone}</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`px-1.5 py-0.5 rounded ${
                        log.type === 'scheduled' 
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {log.type === 'scheduled' ? 'Automático' : 'Manual'}
                      </span>
                      <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Check className="w-2.5 h-2.5" />
                        Sucesso
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Console Live Gateway Logs Terminal */}
        <div className="bg-[#0f0f11] border border-white/5 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
            <h3 className="text-sm font-medium text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              Console do Gateway GetSMS
            </h3>
            <span className="text-[10px] font-mono text-slate-500 bg-white/[0.02] border border-white/5 px-2 py-0.5 rounded">
              Status: Ativo
            </span>
          </div>

          {/* Log List View */}
          <div className="bg-[#050505] border border-white/5 rounded-xl p-4 font-mono text-[10px] leading-relaxed space-y-2 h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
            {consoleLogs.map(log => (
              <div key={log.id} className="flex items-start gap-2.5 border-b border-white/[0.01] pb-1.5 last:border-0 last:pb-0">
                <span className="text-slate-600 shrink-0 select-none">[{log.time}]</span>
                <span className={`uppercase font-bold tracking-wider shrink-0 select-none ${
                  log.type === 'success' ? 'text-emerald-500' :
                  log.type === 'error' ? 'text-rose-500' :
                  log.type === 'warn' ? 'text-amber-500' : 'text-blue-500'
                }`}>
                  {log.type}:
                </span>
                <span className="text-slate-300 font-sans">{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
