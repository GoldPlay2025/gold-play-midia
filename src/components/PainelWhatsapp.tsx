import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageCircle, 
  Send, 
  Zap, 
  Clock, 
  Calendar, 
  Terminal, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Copy, 
  Trash2,
  Tv,
  Loader2,
  ShieldCheck,
  Smartphone,
  Save,
  Check,
  BellRing,
  Lock,
  Unlock,
  FileText,
  Plus,
  RotateCcw,
  QrCode
} from 'lucide-react';
import { enviarAlertaStatusTela } from '../lib/whatsappAlert';
import { supabase } from '../lib/supabase';
import { formatCobrancaMessage, DEFAULT_COBRANCA_TEMPLATE } from '../lib/cobrancaTemplate';

interface PainelWhatsappProps {
  showToast?: (type: 'success' | 'error' | 'info', message: string) => void;
}

export function PainelWhatsapp({ showToast }: PainelWhatsappProps) {
  const [diasAntes, setDiasAntes] = useState<number | string>(2);
  const [horarioEnvio, setHorarioEnvio] = useState('09:00');
  const [agendamentoAtivo, setAgendamentoAtivo] = useState(true);
  const [salvandoAgendamento, setSalvandoAgendamento] = useState(false);

  // Template e Chave Pix
  const [templateCobranca, setTemplateCobranca] = useState<string>(DEFAULT_COBRANCA_TEMPLATE);
  const [pixKey, setPixKey] = useState<string>('');
  const [salvandoTemplate, setSalvandoTemplate] = useState(false);

  const [telefoneTeste, setTelefoneTeste] = useState('5544991762249');
  const [mensagemTeste, setMensagemTeste] = useState('Teste de disparo oficial do Gold Play Mídia.');
  
  const [adminPhone, setAdminPhone] = useState('');
  const [nomeTelaTeste, setNomeTelaTeste] = useState('Tela Recepção');

  // Chaves do BotBot API
  const [appKey, setAppKey] = useState('90d7b9ff-d861-49ae-a452-9ed6238f038d');
  const [authKey, setAuthKey] = useState('kMo4v73UxTTdDFmUGe7eYjQYCpZjykRb7lqZtlQu9Z8iDXN6Td');
  const [chavesDesbloqueadas, setChavesDesbloqueadas] = useState(false);
  const [copiedAppKey, setCopiedAppKey] = useState(false);
  const [copiedAuthKey, setCopiedAuthKey] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [loadingLote, setLoadingLote] = useState(false);
  const [loadingAlerta, setLoadingAlerta] = useState(false);
  const [apiStatus, setApiStatus] = useState<{ connected: boolean; message: string; checking: boolean }>({
    connected: false,
    message: 'Verificando status...',
    checking: true
  });

  const [resultado, setResultado] = useState<any>(null);
  const [logHistory, setLogHistory] = useState<Array<{ timestamp: string; action: string; data: any }>>([]);

  // Verificação inicial do status da API de WhatsApp
  const checarStatusApi = async () => {
    setApiStatus(prev => ({ ...prev, checking: true }));
    try {
      const res = await fetch('/api/whatsapp');
      const data = await res.json().catch(() => null);
      if (res.ok && data?.status) {
        setApiStatus({ connected: true, message: data.mensagem || 'API Online', checking: false });
      } else {
        setApiStatus({ connected: false, message: 'API não respondeu com sucesso', checking: false });
      }
    } catch (err) {
      setApiStatus({ connected: false, message: 'Erro ao conectar na API local', checking: false });
    }
  };

  useEffect(() => {
    checarStatusApi();

    // Carrega configuração de agendamento salva no localStorage
    if (typeof window !== 'undefined') {
      const savedSchedule = localStorage.getItem('gpm_whatsapp_schedule');
      if (savedSchedule) {
        try {
          const parsed = JSON.parse(savedSchedule);
          if (parsed.diasAntes !== undefined) setDiasAntes(parsed.diasAntes);
          if (parsed.horarioEnvio) setHorarioEnvio(parsed.horarioEnvio);
          if (parsed.agendamentoAtivo !== undefined) setAgendamentoAtivo(parsed.agendamentoAtivo);
        } catch (e) {}
      }

      // Template salvo no localStorage
      const savedTpl = localStorage.getItem('gpm_whatsapp_template');
      if (savedTpl) {
        setTemplateCobranca(savedTpl);
      }

      // Chave Pix salva no localStorage
      const savedSys = localStorage.getItem('gpm_system_settings');
      if (savedSys) {
        try {
          const sysObj = JSON.parse(savedSys);
          if (sysObj.pixKey) setPixKey(sysObj.pixKey);
        } catch (e) {}
      }

      // Carrega chaves do BotBot salvas
      const savedKeys = localStorage.getItem('gpm_botbot_keys');
      if (savedKeys) {
        try {
          const parsed = JSON.parse(savedKeys);
          if (parsed.appKey) setAppKey(parsed.appKey);
          if (parsed.authKey) setAuthKey(parsed.authKey);
        } catch (e) {}
      }
    }

    // Carrega número do Admin, Pix e Agendamento do Supabase
    async function loadAdminData() {
      try {
        let phoneFound = '';

        // Tabela configuracoes id = sistema (pix_key, admin_phone)
        const { data: configSistema } = await supabase
          .from('configuracoes')
          .select('*')
          .eq('id', 'sistema')
          .maybeSingle();

        if (configSistema) {
          if (configSistema.admin_phone) phoneFound = configSistema.admin_phone;
          if (configSistema.pix_key) setPixKey(configSistema.pix_key);
        }

        // Tabela configuracoes id = whatsapp_schedule
        const { data: configSchedule } = await supabase
          .from('configuracoes')
          .select('*')
          .eq('id', 'whatsapp_schedule')
          .maybeSingle();

        if (configSchedule) {
          if (configSchedule.dias_antecedencia !== undefined) setDiasAntes(configSchedule.dias_antecedencia);
          if (configSchedule.horario_envio) setHorarioEnvio(configSchedule.horario_envio);
          if (configSchedule.agendamento_ativo !== undefined) setAgendamentoAtivo(configSchedule.agendamento_ativo);
          if (configSchedule.template_cobranca || configSchedule.template_mensagem) {
            setTemplateCobranca(configSchedule.template_cobranca || configSchedule.template_mensagem);
          }
          if (configSchedule.pix_key) setPixKey(configSchedule.pix_key);
          if (configSchedule.app_key) setAppKey(configSchedule.app_key);
          if (configSchedule.auth_key) setAuthKey(configSchedule.auth_key);
        }

        if (phoneFound) {
          setAdminPhone(phoneFound);
        }
      } catch (e) {
        console.warn('Erro ao carregar dados do admin/configurações:', e);
      }
    }

    loadAdminData();
  }, []);

  const lastTriggeredRef = useRef<string>('');

  // Verificador de disparo agendado em segundo plano no frontend
  useEffect(() => {
    if (!agendamentoAtivo) return;

    const interval = setInterval(() => {
      const nowStr = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).slice(0, 5);
      const targetStr = (horarioEnvio || '').trim().slice(0, 5);
      const todayStr = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      const triggerKey = `${todayStr}-${targetStr}`;

      if (targetStr && targetStr === nowStr && lastTriggeredRef.current !== triggerKey) {
        lastTriggeredRef.current = triggerKey;
        console.log('[WhatsApp Schedule Client] Disparando lote agendado no horário:', nowStr);
        fetch('/api/cron/cobranca?force=true', { method: 'POST' })
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              addLog('Disparo Agendamento Automático', data);
              if (showToast) showToast('success', `Agendamento Automático: ${data.totalProcessados ?? 0} mensagens enviadas!`);
            }
          })
          .catch(err => console.warn('Erro no agendamento automático:', err));
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [agendamentoAtivo, horarioEnvio, diasAntes]);

  const salvarChavesBotBot = () => {
    if (!chavesDesbloqueadas) return;
    if (typeof window !== 'undefined') {
      localStorage.setItem('gpm_botbot_keys', JSON.stringify({ appKey, authKey }));
      if (showToast) showToast('success', 'Chaves do BotBot salvas com sucesso!');
      setChavesDesbloqueadas(false);
    }
  };

  const salvarAgendamento = async () => {
    setSalvandoAgendamento(true);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('gpm_whatsapp_schedule', JSON.stringify({
          diasAntes: Number(diasAntes),
          horarioEnvio,
          agendamentoAtivo
        }));
      }

      // Upsert em configuracoes -> whatsapp_schedule
      try {
        await supabase.from('configuracoes').upsert({
          id: 'whatsapp_schedule',
          dias_antecedencia: Number(diasAntes),
          horario_envio: horarioEnvio,
          agendamento_ativo: agendamentoAtivo,
          template_cobranca: templateCobranca,
          pix_key: pixKey,
          last_run_date: null,
          updated_at: new Date().toISOString()
        });
      } catch (sbErr) {
        console.warn('[PainelWhatsapp] Erro ao salvar agendamento via Supabase client:', sbErr);
      }

      const res = await fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salvar_agendamento: true,
          dias_antecedencia: Number(diasAntes),
          horario_envio: horarioEnvio,
          agendamento_ativo: agendamentoAtivo,
          template_cobranca: templateCobranca,
          pix_key: pixKey,
          appKey,
          authKey
        })
      });

      const data = await res.json().catch(() => ({ sucesso: false }));
      addLog('Salvar Agendamento', data);

      if (showToast) {
        showToast('success', `Configuração de agendamento salva! ${agendamentoAtivo ? `Disparos ativos às ${horarioEnvio}` : '(Pausado)'}`);
      }
    } catch (err: any) {
      if (showToast) showToast('error', 'Erro ao salvar agendamento.');
    } finally {
      setSalvandoAgendamento(false);
    }
  };

  const insertVariable = (varTag: string) => {
    setTemplateCobranca(prev => prev + ` ${varTag}`);
  };

  const restaurarTemplatePadrao = () => {
    setTemplateCobranca(DEFAULT_COBRANCA_TEMPLATE);
    if (showToast) showToast('info', 'Template restaurado para o padrão elegante.');
  };

  const salvarTemplate = async () => {
    setSalvandoTemplate(true);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('gpm_whatsapp_template', templateCobranca);
        const savedSys = localStorage.getItem('gpm_system_settings');
        let sysObj = savedSys ? JSON.parse(savedSys) : {};
        sysObj.pixKey = pixKey;
        localStorage.setItem('gpm_system_settings', JSON.stringify(sysObj));
      }

      // Upsert em configuracoes -> whatsapp_schedule
      try {
        await supabase.from('configuracoes').upsert({
          id: 'whatsapp_schedule',
          dias_antecedencia: Number(diasAntes),
          horario_envio: horarioEnvio,
          agendamento_ativo: agendamentoAtivo,
          template_cobranca: templateCobranca,
          pix_key: pixKey,
          app_key: appKey,
          auth_key: authKey,
          last_run_date: null,
          updated_at: new Date().toISOString()
        });
      } catch (e) {}

      // Upsert em configuracoes -> sistema (para o pix_key ser global)
      try {
        await supabase.from('configuracoes').upsert({
          id: 'sistema',
          pix_key: pixKey,
          updated_at: new Date().toISOString()
        });
      } catch (e) {}

      // Chama endpoint /api/whatsapp para persistência
      await fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salvar_template: true,
          template_cobranca: templateCobranca,
          pix_key: pixKey,
          dias_antecedencia: Number(diasAntes),
          horario_envio: horarioEnvio,
          agendamento_ativo: agendamentoAtivo
        })
      });

      if (showToast) showToast('success', 'Template de cobrança e Chave Pix salvos com sucesso!');
    } catch (err) {
      if (showToast) showToast('error', 'Erro ao salvar o template de cobrança.');
    } finally {
      setSalvandoTemplate(false);
    }
  };

  const addLog = (action: string, data: any) => {
    const timestamp = new Date().toLocaleTimeString('pt-BR');
    setResultado(data);
    setLogHistory(prev => [{ timestamp, action, data }, ...prev.slice(0, 19)]);
  };

  // Executa teste individual de mensagem
  const executarTeste = async () => {
    if (!telefoneTeste || !mensagemTeste) {
      if (showToast) showToast('error', 'Preencha o número de telefone e a mensagem.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: telefoneTeste, message: mensagemTeste, appKey, authKey })
      });
      const data = await res.json().catch(() => ({ sucesso: false, erro: 'Resposta inválida' }));
      addLog('Teste Individual', data);

      if (data.sucesso) {
        if (showToast) showToast('success', 'Mensagem de teste enviada com sucesso!');
      } else {
        if (showToast) showToast('error', data.erro || 'Falha ao enviar teste de WhatsApp.');
      }
    } catch (err: any) {
      const errorData = { sucesso: false, erro: err?.message || 'Erro de conexão com a API.' };
      addLog('Teste Individual (Erro)', errorData);
      if (showToast) showToast('error', 'Erro de conexão ao enviar WhatsApp.');
    } finally {
      setLoading(false);
    }
  };

  const getDataAlvoPreview = (dias: number | string) => {
    const d = Number(dias) || 0;
    const target = new Date();
    target.setHours(target.getHours() - 3);
    target.setDate(target.getDate() + d);
    const dia = String(target.getDate()).padStart(2, '0');
    const mes = String(target.getMonth() + 1).padStart(2, '0');
    const ano = target.getFullYear();
    return `${dia}/${mes}/${ano}`;
  };

  // Executa disparo em lote de cobrança
  const executarDisparoLote = async () => {
    const dataAlvoBR = getDataAlvoPreview(diasAntes);
    if (!window.confirm(`Deseja executar o disparo automático em lote para os clientes com vencimento em ${diasAntes} dia(s) (${dataAlvoBR})?`)) {
      return;
    }

    setLoadingLote(true);
    try {
      const res = await fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disparar_lote: true, dias_antecedencia: Number(diasAntes), appKey, authKey })
      });
      const data = await res.json().catch(() => ({ sucesso: false, erro: 'Erro na resposta do servidor' }));
      addLog('Disparo em Lote (Supabase)', data);

      if (data.sucesso) {
        if (data.totalProcessados > 0) {
          if (showToast) showToast('success', `Lote processado com sucesso! Total: ${data.totalProcessados} envio(s).`);
        } else {
          if (showToast) showToast('info', data.mensagem || `Nenhum cliente com vencimento para ${dataAlvoBR}.`);
        }
      } else {
        if (showToast) showToast('error', data.erro || 'Falha ao processar lote.');
      }
    } catch (err: any) {
      const errorData = { sucesso: false, erro: err?.message || 'Erro de conexão no lote.' };
      addLog('Disparo em Lote (Erro)', errorData);
      if (showToast) showToast('error', 'Erro de conexão ao processar lote de disparo.');
    } finally {
      setLoadingLote(false);
    }
  };

  // Executa teste de alerta de status de tela para admin
  const testarAlertaStatusTela = async (status: 'OFF' | 'ON') => {
    setLoadingAlerta(true);
    try {
      const res = await enviarAlertaStatusTela(status, nomeTelaTeste);
      addLog(`Alerta de Tela (${status})`, res);

      if (res.sucesso) {
        if (showToast) showToast('success', `Alerta de tela ${status} enviado para o administrador!`);
      } else {
        if (showToast) showToast('error', res.erro || 'Falha ao enviar alerta de tela.');
      }
    } catch (err: any) {
      const errRes = { sucesso: false, erro: err?.message || 'Erro ao disparar alerta.' };
      addLog(`Alerta de Tela ${status} (Erro)`, errRes);
      if (showToast) showToast('error', 'Erro ao processar alerta.');
    } finally {
      setLoadingAlerta(false);
    }
  };

  const copyJsonLog = () => {
    if (resultado) {
      navigator.clipboard.writeText(JSON.stringify(resultado, null, 2));
      if (showToast) showToast('info', 'JSON copiado para a área de transferência!');
    }
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pt-1 pb-10 animate-fade-in">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-1">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-[#0f0f11] border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg shadow-emerald-500/5">
            <MessageCircle className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-light text-white tracking-tight flex items-center gap-2">
              Painel de Automação — WhatsApp
            </h1>
            <p className="text-xs text-slate-400 font-light mt-0.5">
              Gerencie disparos automáticos de cobrança, testes individuais e alertas de queda/retorno de telas.
            </p>
          </div>
        </div>

        {/* Badge de Status da API */}
        <div className="flex items-center gap-2.5 bg-[#0a0a0c] px-3.5 py-2 rounded-xl border border-white/10 shrink-0 shadow-md">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${apiStatus.connected ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-red-500'}`} />
            <span className="text-xs font-semibold text-slate-200">
              {apiStatus.checking ? 'Verificando API...' : apiStatus.connected ? 'API Online' : 'API Desconectada'}
            </span>
          </div>
          <button 
            onClick={checarStatusApi} 
            disabled={apiStatus.checking}
            className="p-1 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Atualizar Status da API"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${apiStatus.checking ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Grid com os Cards Principais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* CARD 1: CONFIGURAÇÃO DE ENVIO EM LOTE */}
        <div className="bg-[#0f0f11] p-5 rounded-2xl border border-white/5 shadow-xl flex flex-col justify-between relative overflow-hidden group hover:border-white/10 transition-all">
          <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none">
            <Calendar className="w-20 h-20 text-emerald-400" />
          </div>

          <div>
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-white/5">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white tracking-tight">Regras de Vencimento & Lote</h2>
                <p className="text-[11px] text-slate-400">Notificações automáticas via Supabase</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" /> Dias de Antecedência para Lembrete:
                </label>
                <input 
                  type="number" 
                  min="0"
                  max="30"
                  value={diasAntes} 
                  onChange={(e) => setDiasAntes(e.target.value)}
                  className="w-full bg-[#050505] border border-white/10 text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 transition-all font-mono"
                  placeholder="2"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  O disparo será direcionado aos clientes com vencimento exatamente em {diasAntes} dia(s).
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" /> Horário de Envio Automático (Cron):
                </label>
                <input 
                  type="time" 
                  value={horarioEnvio} 
                  onChange={(e) => setHorarioEnvio(e.target.value)}
                  className="w-full bg-[#050505] border border-white/10 text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 transition-all font-mono"
                />
              </div>

              {/* Status e Agendamento Automático */}
              <div className="bg-[#050505] p-2.5 rounded-xl border border-white/5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <BellRing className="w-3.5 h-3.5 text-amber-400" /> Agendamento Automático Diário
                  </span>
                  <button
                    type="button"
                    onClick={() => setAgendamentoAtivo(!agendamentoAtivo)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${agendamentoAtivo ? 'bg-amber-500' : 'bg-slate-700'}`}
                  >
                    <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${agendamentoAtivo ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  {agendamentoAtivo ? (
                    <span className="text-emerald-400 flex items-center gap-1 font-medium text-[11px]">
                      <CheckCircle2 className="w-3 h-3 shrink-0" /> Ativo: Disparos diários programados para às <code className="font-mono text-white bg-white/5 px-1 py-0.2 rounded text-[10px]">{horarioEnvio}</code> ({diasAntes} dias antes do vencimento).
                    </span>
                  ) : (
                    <span className="text-amber-400/80 text-[11px]">
                      ⏸️ Pausado: Os disparos automáticos diários estão temporariamente desativados.
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/5 space-y-2">
            {/* Botão de Salvar Configuração de Agendamento */}
            <button 
              onClick={salvarAgendamento}
              disabled={salvandoAgendamento}
              className="w-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/40 font-semibold text-xs py-2 px-3 rounded-xl transition-all shadow-md active:scale-[0.99] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {salvandoAgendamento ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                  <span>Salvando Agendamento...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 text-amber-400" />
                  <span>Salvar Configuração de Agendamento</span>
                </>
              )}
            </button>

            {/* Botão de Execução Imediata */}
            <button 
              onClick={executarDisparoLote}
              disabled={loadingLote}
              className="w-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400/90 border border-emerald-500/20 font-medium text-[11px] py-2 px-3 rounded-xl transition-all active:scale-[0.99] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {loadingLote ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                  <span>Consultando Supabase e enviando...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Executar Disparo em Lote Agora ({diasAntes}d antecedência — Data Alvo: {getDataAlvoPreview(diasAntes)})</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* CARD 2: TESTE RÁPIDO INDIVIDUAL */}
        <div className="bg-[#0f0f11] p-5 rounded-2xl border border-white/5 shadow-xl flex flex-col justify-between relative overflow-hidden group hover:border-white/10 transition-all">
          <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none">
            <Smartphone className="w-20 h-20 text-sky-400" />
          </div>

          <div>
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-white/5">
              <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                <Send className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white tracking-tight">Teste de Envio Individual</h2>
                <p className="text-[11px] text-slate-400">Valide o envio para qualquer número do WhatsApp</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-sky-400" /> Número (com DDD):
                </label>
                <input 
                  type="text" 
                  value={telefoneTeste} 
                  onChange={(e) => setTelefoneTeste(e.target.value)}
                  className="w-full bg-[#050505] border border-white/10 text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 transition-all font-mono"
                  placeholder="Ex: 5544991762249"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Mensagem de Teste:
                </label>
                <textarea 
                  rows={2}
                  value={mensagemTeste} 
                  onChange={(e) => setMensagemTeste(e.target.value)}
                  className="w-full bg-[#050505] border border-white/10 text-white text-xs rounded-xl p-2.5 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 transition-all resize-none"
                  placeholder="Digite a mensagem de teste..."
                />
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/5">
            <button 
              onClick={executarTeste}
              disabled={loading}
              className="w-full bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 border border-sky-500/40 font-semibold text-xs py-2 px-3 rounded-xl transition-all shadow-md active:scale-[0.99] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
                  <span>Enviando teste...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5 text-sky-400" />
                  <span>Enviar Mensagem de Teste</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>

      {/* CARD: TEMPLATE EDITÁVEL DE MENSAGEM DE COBRANÇA */}
      <div className="bg-[#0f0f11] p-5 rounded-2xl border border-white/5 shadow-xl space-y-4 group hover:border-white/10 transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">Template Editável de Cobrança (WhatsApp)</h2>
              <p className="text-[11px] text-slate-400">Mensagem elegante utilizada nos disparos automáticos e manuais de clientes</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={restaurarTemplatePadrao}
              className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer"
              title="Restaurar template padrão"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Restaurar Padrão</span>
            </button>
            <button
              onClick={salvarTemplate}
              disabled={salvandoTemplate}
              className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-400 font-semibold text-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {salvandoTemplate ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
              ) : (
                <Save className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>Salvar Template & Pix</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Lado Esquerdo: Editor e Variáveis (7 Colunas) */}
          <div className="lg:col-span-7 space-y-3.5">
            {/* Campo Chave Pix */}
            <div className="bg-[#050505] p-3 rounded-xl border border-white/5 space-y-1">
              <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5 text-emerald-400" /> Chave Pix do Sistema (Variável [Pix]):
              </label>
              <input
                type="text"
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                placeholder="Ex: (44) 99176-2249 ou CNPJ / E-mail / Chave aleatória"
                className="w-full bg-[#0f0f11] border border-white/10 text-emerald-400 text-xs font-mono rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 transition-all"
              />
              <p className="text-[10px] text-slate-500">
                Esta chave Pix será lida automaticamente e substituída na tag <code className="text-emerald-400 font-mono">[Pix]</code> do template.
              </p>
            </div>

            {/* Chips de Inserção de Variáveis */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
                <span>Clique para inserir variáveis dinâmicas no texto:</span>
              </label>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => insertVariable('[Nome]')}
                  className="px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 text-xs font-mono flex items-center gap-1 transition-all cursor-pointer"
                >
                  <Plus className="w-3 h-3 text-emerald-400" /> [Nome]
                </button>
                <button
                  type="button"
                  onClick={() => insertVariable('[Valor]')}
                  className="px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 text-xs font-mono flex items-center gap-1 transition-all cursor-pointer"
                >
                  <Plus className="w-3 h-3 text-emerald-400" /> [Valor]
                </button>
                <button
                  type="button"
                  onClick={() => insertVariable('[Vencimento]')}
                  className="px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 text-xs font-mono flex items-center gap-1 transition-all cursor-pointer"
                >
                  <Plus className="w-3 h-3 text-emerald-400" /> [Vencimento]
                </button>
                <button
                  type="button"
                  onClick={() => insertVariable('[Pix]')}
                  className="px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 text-xs font-mono flex items-center gap-1 transition-all cursor-pointer"
                >
                  <Plus className="w-3 h-3 text-emerald-400" /> [Pix]
                </button>
              </div>
            </div>

            {/* Textarea */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Texto do Template de Cobrança:
              </label>
              <textarea
                rows={10}
                value={templateCobranca}
                onChange={(e) => setTemplateCobranca(e.target.value)}
                className="w-full bg-[#050505] border border-white/10 text-slate-200 text-xs rounded-xl p-3 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 font-sans leading-relaxed resize-y transition-all"
                placeholder="Monte a mensagem de cobrança..."
              />
            </div>
          </div>

          {/* Lado Direito: Simulador Visual do WhatsApp (5 Colunas) */}
          <div className="lg:col-span-5 flex flex-col justify-between bg-[#050505] p-4 rounded-xl border border-white/5 relative overflow-hidden min-h-[300px]">
            <div>
              <div className="text-xs font-semibold text-slate-400 mb-3 flex items-center justify-between border-b border-white/5 pb-2">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <Smartphone className="w-4 h-4" /> Pré-visualização no WhatsApp
                </span>
                <span className="text-[10px] text-slate-500">Exemplo Real</span>
              </div>

              {/* Chat Bubble Simulation */}
              <div className="bg-[#18181b] rounded-2xl rounded-tl-sm p-3.5 border border-white/10 shadow-lg relative">
                <div className="text-emerald-400 text-[10px] font-semibold mb-1 uppercase tracking-wider flex items-center gap-1">
                  <MessageCircle className="w-3 h-3" /> Gold Play Mídia
                </div>
                <div className="text-slate-100 text-[12px] leading-relaxed whitespace-pre-wrap font-sans">
                  {formatCobrancaMessage(templateCobranca, {
                    nome_empresa: 'RedeMed Drogaria',
                    valor: 120,
                    vencimento: '01/08/2026'
                  }, pixKey || '44991762249')}
                </div>
                <div className="text-[9px] text-slate-500 text-right mt-2 flex items-center justify-end gap-1">
                  <span>09:00</span>
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                </div>
              </div>
            </div>

            <p className="text-[10px] text-slate-500 mt-3 italic text-center">
              * O cliente receberá a mensagem exatamente neste formato com seus dados reais.
            </p>
          </div>
        </div>
      </div>

      {/* CARD ADICIONAL: ALERTA DE QUEDA / RETORNO DE TELAS (ADMIN) */}
      <div className="bg-[#0f0f11] p-5 rounded-2xl border border-white/5 shadow-xl group hover:border-white/10 transition-all">
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-white/5">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <Tv className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white tracking-tight">Alertas Automáticos de Status de Tela (Admin)</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Notifica o número do Administrador cadastrado em <span className="text-amber-400 font-mono font-medium">perfil</span> no Supabase via WhatsApp se qualquer tela ficar OFF ou voltar a ficar ON.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              WhatsApp Admin Cadastrado:
            </label>
            <input 
              type="text" 
              value={adminPhone || 'Pendente de cadastro no perfil'} 
              readOnly
              className="w-full bg-[#050505] border border-white/10 text-amber-400 text-xs font-mono rounded-xl px-3 py-2 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Nome da Tela para Teste:
            </label>
            <input 
              type="text" 
              value={nomeTelaTeste} 
              onChange={(e) => setNomeTelaTeste(e.target.value)}
              className="w-full bg-[#050505] border border-white/10 text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500/60 transition-all"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => testarAlertaStatusTela('OFF')}
              disabled={loadingAlerta}
              className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 font-semibold text-xs py-2 px-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <AlertTriangle className="w-3.5 h-3.5" /> Testar OFF
            </button>
            <button
              onClick={() => testarAlertaStatusTela('ON')}
              disabled={loadingAlerta}
              className="flex-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 font-semibold text-xs py-2 px-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Testar ON
            </button>
          </div>
        </div>
      </div>

      {/* CARD: CREDENCIAIS DA API BOTBOT (CHAVES DE ACESSO) */}
      <div className="bg-[#0f0f11] p-5 rounded-2xl border border-white/5 shadow-xl space-y-3.5 group hover:border-white/10 transition-all">
        <div className="flex items-center gap-3 pb-3 border-b border-white/5">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white tracking-tight">Credenciais de Autenticação BotBot (WhatsApp)</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Chaves enviadas nos cabeçalhos <code className="text-amber-400 font-mono font-semibold">appKey</code> e <code className="text-amber-400 font-mono font-semibold">authKey</code> para a API BotBot.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* Chave do App */}
          <div className="bg-[#050505] p-3 rounded-xl border border-white/5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200">
                Chave do App
              </label>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(appKey);
                  setCopiedAppKey(true);
                  setTimeout(() => setCopiedAppKey(false), 2000);
                  if (showToast) showToast('info', 'Chave do App copiada!');
                }}
                className="px-2.5 py-0.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-[11px] font-semibold rounded-lg border border-amber-500/20 transition-all flex items-center gap-1 cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                <span>{copiedAppKey ? 'Copiado!' : 'Copiar'}</span>
              </button>
            </div>
            <input
              type="text"
              value={appKey}
              readOnly={!chavesDesbloqueadas}
              onChange={(e) => setAppKey(e.target.value)}
              className={`w-full bg-[#0f0f11] border border-white/10 text-xs font-mono rounded-lg px-3 py-2 transition-all focus:outline-none ${
                !chavesDesbloqueadas 
                  ? 'text-slate-400 opacity-80 cursor-not-allowed select-all' 
                  : 'text-slate-100 focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30'
              }`}
              placeholder="90d7b9ff-d861-49ae-a452-9ed6238f038d"
            />
          </div>

          {/* Chave de Autenticação */}
          <div className="bg-[#050505] p-3 rounded-xl border border-white/5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200">
                Chave de Autenticação
              </label>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(authKey);
                  setCopiedAuthKey(true);
                  setTimeout(() => setCopiedAuthKey(false), 2000);
                  if (showToast) showToast('info', 'Chave de Autenticação copiada!');
                }}
                className="px-2.5 py-0.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-[11px] font-semibold rounded-lg border border-amber-500/20 transition-all flex items-center gap-1 cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                <span>{copiedAuthKey ? 'Copiado!' : 'Copiar'}</span>
              </button>
            </div>
            <input
              type="text"
              value={authKey}
              readOnly={!chavesDesbloqueadas}
              onChange={(e) => setAuthKey(e.target.value)}
              className={`w-full bg-[#0f0f11] border border-white/10 text-xs font-mono rounded-xl px-3 py-2 transition-all focus:outline-none ${
                !chavesDesbloqueadas 
                  ? 'text-slate-400 opacity-80 cursor-not-allowed select-all' 
                  : 'text-slate-100 focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30'
              }`}
              placeholder="kMo4v73UxTTdDFmUGe7eYjQYCpZjykRb7lqZtlQu9Z8iDXN6Td"
            />
          </div>
        </div>

        {/* Rodapé de Trava e Ação de Salvar */}
        <div className="pt-3 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400 hover:text-slate-200 transition-colors select-none">
            <input
              type="checkbox"
              checked={chavesDesbloqueadas}
              onChange={(e) => setChavesDesbloqueadas(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-white/10 bg-[#050505] text-amber-500 focus:ring-amber-500/20 focus:ring-offset-0 cursor-pointer"
            />
            <span className="flex items-center gap-1.5 font-mono text-[11px]">
              {chavesDesbloqueadas ? <Unlock className="w-3.5 h-3.5 text-amber-400" /> : <Lock className="w-3.5 h-3.5 text-slate-500" />}
              Desbloquear para modificar e salvar
            </span>
          </label>

          <button
            type="button"
            disabled={!chavesDesbloqueadas}
            onClick={salvarChavesBotBot}
            className={`px-4 py-2 border rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 ${
              chavesDesbloqueadas
                ? 'border-amber-500/40 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 cursor-pointer shadow-md active:scale-95'
                : 'border-white/5 bg-white/[0.02] text-slate-600 opacity-40 cursor-not-allowed select-none'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Salvar Chaves de API
          </button>
        </div>
      </div>

      {/* ÁREA DE TERMINAL / LOG DE RETORNO ESTILIZADO */}
      <div className="bg-[#0f0f11] rounded-2xl border border-white/5 shadow-xl overflow-hidden">
        {/* Barra superior do Terminal */}
        <div className="bg-[#050505] px-4 py-2.5 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
            </div>
            <span className="text-xs font-mono text-slate-400 font-semibold flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-emerald-400" /> Terminal / Response Log Output
            </span>
          </div>

          <div className="flex items-center gap-2">
            {resultado && (
              <button 
                onClick={copyJsonLog}
                className="px-3 py-1 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium rounded-lg border border-white/10 transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Copiar JSON"
              >
                <Copy className="w-3 h-3" /> Copiar JSON
              </button>
            )}
            {logHistory.length > 0 && (
              <button 
                onClick={() => { setResultado(null); setLogHistory([]); }}
                className="px-3 py-1 bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-300 text-xs font-medium rounded-lg border border-white/10 transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Limpar Histórico"
              >
                <Trash2 className="w-3 h-3" /> Limpar
              </button>
            )}
          </div>
        </div>

        {/* Conteúdo do Log */}
        <div className="p-5 bg-[#050505] min-h-[180px] max-h-[400px] overflow-y-auto font-mono text-xs">
          {resultado ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-slate-400 text-[11px]">
                  Último retorno capturado:
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${resultado.sucesso !== false ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                  {resultado.sucesso !== false ? 'HTTP 200 OK / SUCESSO' : 'ERRO NA API'}
                </span>
              </div>
              <pre className={`p-4 rounded-xl leading-relaxed overflow-x-auto ${resultado.sucesso !== false ? 'text-emerald-400 bg-[#0a0a0c] border border-white/5' : 'text-red-400 bg-[#0a0a0c] border border-white/5'}`}>
                {JSON.stringify(resultado, null, 2)}
              </pre>
            </div>
          ) : (
            <div className="h-32 flex flex-col items-center justify-center text-slate-600 gap-2">
              <Terminal className="w-8 h-8 opacity-40" />
              <p className="text-xs font-mono">Nenhum log de disparo recente. Execute um teste ou lote para visualizar a resposta JSON.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
