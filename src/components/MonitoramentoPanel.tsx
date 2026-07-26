import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { PillProgressButton } from './PillProgressButton';
import { 
  Activity, 
  Bell, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Send, 
  Phone, 
  Wifi, 
  WifiOff, 
  Clock, 
  ShieldAlert, 
  Search, 
  Radio,
  ExternalLink,
  Power,
  Zap,
  Copy,
  Check,
  X,
  Database,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function MonitoramentoPanel() {
  const [adminPhone, setAdminPhone] = useState('');
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [telas, setTelas] = useState<any[]>([]);
  const [isLoadingTelas, setIsLoadingLoadingTelas] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [isTestingAlert, setIsTestingAlert] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; msg: string } | null>(null);

  const [isRunningCron, setIsRunningCron] = useState(false);
  const [cronResult, setCronResult] = useState<any | null>(null);

  // Estados de notificação e auxílio de SQL
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'warning' | 'info'; title: string; message: string } | null>(null);
  const [showSqlInstruction, setShowSqlInstruction] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const sqlScript = `-- Execute no SQL Editor do Supabase (Dashboard > SQL Editor):
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS admin_phone TEXT;
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS alerts_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE telas ADD COLUMN IF NOT EXISTS last_ping TIMESTAMP WITH TIME ZONE;
ALTER TABLE telas ADD COLUMN IF NOT EXISTS alert_sent BOOLEAN DEFAULT FALSE;`;

  // Auto-dismiss do Toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 7000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Carrega configurações e lista de telas
  const fetchData = async () => {
    setIsLoadingLoadingTelas(true);
    try {
      // 1. Carrega backup local primeiro para não zerar os campos
      const savedLocal = localStorage.getItem('gpm_monitoring_config');
      if (savedLocal) {
        try {
          const parsed = JSON.parse(savedLocal);
          if (parsed.admin_phone) setAdminPhone(parsed.admin_phone);
          if (typeof parsed.alerts_enabled === 'boolean') setAlertsEnabled(parsed.alerts_enabled);
        } catch (e) {}
      }

      // 2. Busca configurações do sistema no Supabase
      const { data: config, error: configError } = await supabase
        .from('configuracoes')
        .select('*')
        .eq('id', 'sistema')
        .maybeSingle();

      if (configError && (configError.message?.includes('schema cache') || configError.message?.includes('admin_phone'))) {
        setShowSqlInstruction(true);
      }

      if (config) {
        if (config.admin_phone !== undefined) setAdminPhone(config.admin_phone || '');
        if (config.alerts_enabled !== undefined) setAlertsEnabled(config.alerts_enabled ?? false);
      }

      // 3. Busca telas com informações do cliente
      const { data: dataTelas, error: errTelas } = await supabase
        .from('telas')
        .select('*, clientes(nome_empresa)')
        .order('nome_local', { ascending: true });

      if (errTelas) throw errTelas;
      setTelas(dataTelas || []);
    } catch (err: any) {
      console.error('Erro ao carregar dados de monitoramento:', err);
    } finally {
      setIsLoadingLoadingTelas(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Inscrição em tempo real para atualizações na tabela de telas
    const channel = supabase
      .channel('monitoramento-telas-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'telas' }, () => {
        fetchData();
      })
      .subscribe();

    // Auto-refresh a cada 30 segundos
    const refreshInterval = setInterval(() => {
      fetchData();
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(refreshInterval);
    };
  }, []);

  // Salvar Configurações de Alerta
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    setSaveSuccess(false);

    try {
      let cleanPhone = adminPhone.replace(/\D/g, '');
      if (cleanPhone && !cleanPhone.startsWith('55') && (cleanPhone.length === 10 || cleanPhone.length === 11)) {
        cleanPhone = `55${cleanPhone}`;
      }

      // 1. Salva localmente como backup garantido
      localStorage.setItem('gpm_monitoring_config', JSON.stringify({
        admin_phone: cleanPhone,
        alerts_enabled: alertsEnabled
      }));

      // 2. Tenta salvar no Supabase
      const { error } = await supabase
        .from('configuracoes')
        .upsert({
          id: 'sistema',
          admin_phone: cleanPhone,
          alerts_enabled: alertsEnabled
        }, { onConflict: 'id' });

      if (error) {
        if (error.message?.includes('admin_phone') || error.message?.includes('schema cache') || error.code === 'PGRST204' || error.code === '42703') {
          setShowSqlInstruction(true);
          setAdminPhone(cleanPhone);
          setToast({
            type: 'warning',
            title: 'Salvo em Backup Local',
            message: 'A configuração foi salva localmente. Para sincronizar no banco Supabase, execute o script SQL exibido abaixo no seu painel do Supabase.'
          });
          return;
        }
        throw error;
      }

      setAdminPhone(cleanPhone);
      setShowSqlInstruction(false);
      setSaveSuccess(true);
      setToast({
        type: 'success',
        title: 'Configurações Salvas!',
        message: 'Número do WhatsApp e preferências de alertas salvas com sucesso no Supabase.'
      });
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      console.error('Erro ao salvar configurações de alerta:', err);
      setToast({
        type: 'error',
        title: 'Erro ao Salvar no Banco',
        message: err.message || 'Não foi possível salvar no Supabase. Os dados foram mantidos localmente.'
      });
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Copiar SQL
  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlScript);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  // Testar Disparo de Alerta via WhatsApp
  const handleTestAlert = async () => {
    if (!adminPhone) {
      setToast({
        type: 'warning',
        title: 'Campo Obrigatório',
        message: 'Por favor, informe o número do WhatsApp para alertas antes de testar.'
      });
      return;
    }

    setIsTestingAlert(true);
    setTestResult(null);

    try {
      const apiKey = import.meta.env.VITE_WHATSAPP_API_KEY || 'minha-chave-secreta';
      const response = await fetch('/api/test-whatsapp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey
        },
        body: JSON.stringify({
          numero: adminPhone,
          mensagem: `🧪 *TESTE DE ALERTA GOLD PLAY MÍDIA*\n\nEste é um disparo de teste do sistema de monitoramento de telas.\n\nSeu WhatsApp está configurado corretamente para receber alertas automatizados de queda de telas!`
        })
      });

      const contentType = response.headers.get('content-type') || '';
      const resText = await response.text();

      if (!contentType.includes('application/json')) {
        const errorMsg = 'Erro de ambiente: A rota da API não respondeu corretamente. Teste no ambiente de produção da Vercel.';
        setTestResult({ success: false, msg: errorMsg });
        setToast({
          type: 'error',
          title: 'Erro de Ambiente',
          message: errorMsg
        });
        setIsTestingAlert(false);
        return;
      }

      let data: any = {};
      try {
        data = JSON.parse(resText);
      } catch (e) {
        const errorMsg = 'Erro de ambiente: A rota da API não retornou um JSON válido. Teste no ambiente de produção da Vercel.';
        setTestResult({ success: false, msg: errorMsg });
        setToast({
          type: 'error',
          title: 'Erro de Formato',
          message: errorMsg
        });
        setIsTestingAlert(false);
        return;
      }

      if (response.ok && data.success === true) {
        setTestResult({ success: true, msg: 'Mensagem de teste enviada com sucesso para ' + adminPhone + '!' });
        setToast({
          type: 'success',
          title: 'Teste Enviado!',
          message: 'Verifique seu WhatsApp para confirmar o recebimento.'
        });
      } else {
        const errorMsg = data.error || data.message || 'Erro de ambiente: A rota da API não respondeu corretamente. Teste no ambiente de produção da Vercel.';
        setTestResult({ success: false, msg: errorMsg });
        setToast({
          type: 'error',
          title: 'Falha no Envio',
          message: errorMsg
        });
      }
    } catch (err: any) {
      const errorMsg = 'Erro de ambiente: A rota da API não respondeu corretamente. Teste no ambiente de produção da Vercel.';
      setTestResult({ success: false, msg: errorMsg });
      setToast({
        type: 'error',
        title: 'Erro de Conexão',
        message: errorMsg
      });
    } finally {
      setIsTestingAlert(false);
    }
  };

  // Executar Checagem de Cron Manualmente
  const handleRunCron = async () => {
    setIsRunningCron(true);
    setCronResult(null);

    try {
      const cronSecret = import.meta.env.VITE_CRON_SECRET || 'minha-chave-secreta';
      const response = await fetch(`/api/cron/check-offline?secret=${encodeURIComponent(cronSecret)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cronSecret}`
        }
      });

      const contentType = response.headers.get('content-type') || '';
      const resText = await response.text();

      if (!contentType.includes('application/json')) {
        const errorMsg = 'Erro de ambiente: A rota da API não respondeu corretamente. Teste no ambiente de produção da Vercel.';
        setCronResult({
          success: false,
          status: response.status,
          message: errorMsg,
          preview: resText.slice(0, 200)
        });
        setToast({
          type: 'error',
          title: 'Erro de Ambiente',
          message: errorMsg
        });
        setIsRunningCron(false);
        return;
      }

      let data: any = {};
      try {
        data = JSON.parse(resText);
      } catch (e) {
        const errorMsg = 'Erro de ambiente: A rota da API não retornou um JSON válido. Teste no ambiente de produção da Vercel.';
        setCronResult({
          success: false,
          status: response.status,
          message: errorMsg,
          preview: resText.slice(0, 200)
        });
        setToast({
          type: 'error',
          title: 'Erro de Formato',
          message: errorMsg
        });
        setIsRunningCron(false);
        return;
      }

      setCronResult(data);
      fetchData(); // Recarrega lista atualizada

      if (response.ok && data.success === true) {
        setToast({
          type: 'success',
          title: 'Cron Executado',
          message: data.message || 'A verificação de telas offline foi executada com sucesso.'
        });
      } else {
        const errorMsg = data.message || data.error || 'Erro de ambiente: A rota da API não respondeu corretamente. Teste no ambiente de produção da Vercel.';
        setToast({
          type: 'error',
          title: 'Falha na Execução',
          message: errorMsg
        });
      }
    } catch (err: any) {
      const errorMsg = 'Erro de ambiente: A rota da API não respondeu corretamente. Teste no ambiente de produção da Vercel.';
      setCronResult({ error: errorMsg });
      setToast({
        type: 'error',
        title: 'Erro no Cron',
        message: errorMsg
      });
    } finally {
      setIsRunningCron(false);
    }
  };

  // Enviar Heartbeat de Teste Manual para uma tela
  const handleSendTestHeartbeat = async (deviceId: string) => {
    try {
      const res = await fetch('/api/devices/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId })
      });
      if (res.ok) {
        setToast({
          type: 'success',
          title: 'Heartbeat Recebido',
          message: `Sinal de heartbeat enviado com sucesso para o dispositivo ${deviceId}.`
        });
      } else {
        throw new Error('Falha no servidor');
      }
      fetchData();
    } catch (e) {
      setToast({
        type: 'error',
        title: 'Erro no Heartbeat',
        message: 'Não foi possível enviar o sinal de teste para a tela.'
      });
    }
  };

  // Função auxiliar para calcular status da tela (< 15 min = Online)
  const isScreenOnline = (lastPing: string | null) => {
    if (!lastPing) return false;
    const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;
    return new Date(lastPing).getTime() > fifteenMinutesAgo;
  };

  // Função para formatar o tempo decorrido do último ping
  const formatTimeAgo = (lastPing: string | null) => {
    if (!lastPing) return 'Nunca conectou';
    
    const diffMs = Date.now() - new Date(lastPing).getTime();
    const diffMin = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMin < 1) return 'Agora mesmo (há menos de 1 min)';
    if (diffMin < 60) return `Há ${diffMin} min`;
    if (diffHours < 24) return `Há ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
    return `Há ${diffDays} dia${diffDays > 1 ? 's' : ''}`;
  };

  // Filtro de pesquisa de telas
  const filteredTelas = telas.filter((t) => {
    const term = searchTerm.toLowerCase();
    const nome = (t.nome_local || '').toLowerCase();
    const cliente = (t.clientes?.nome_empresa || '').toLowerCase();
    const deviceId = (t.fully_device_id || t.identificador_unico || '').toLowerCase();
    return nome.includes(term) || cliente.includes(term) || deviceId.includes(term);
  });

  const totalTelas = telas.length;
  const onlineCount = telas.filter(t => isScreenOnline(t.last_ping)).length;
  const offlineCount = totalTelas - onlineCount;
  const alertedCount = telas.filter(t => t.alert_sent).length;

  return (
    <div className="space-y-8 pb-12">
      {/* Toast Notification Flutuante Elegante */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`p-4 rounded-2xl border backdrop-blur-xl shadow-2xl flex items-start gap-3.5 relative ${
              toast.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-300'
                : toast.type === 'warning'
                ? 'bg-amber-950/90 border-amber-500/40 text-amber-300'
                : toast.type === 'info'
                ? 'bg-blue-950/90 border-blue-500/40 text-blue-300'
                : 'bg-red-950/90 border-red-500/40 text-red-300'
            }`}
          >
            <div className="p-2 rounded-xl bg-white/10 shrink-0 mt-0.5">
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
              {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400" />}
              {toast.type === 'info' && <Info className="w-5 h-5 text-blue-400" />}
              {toast.type === 'error' && <ShieldAlert className="w-5 h-5 text-red-400" />}
            </div>
            <div className="flex-1 pr-6">
              <h4 className="text-sm font-bold text-white tracking-tight">{toast.title}</h4>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">{toast.message}</p>
            </div>
            <button
              onClick={() => setToast(null)}
              className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors absolute top-3 right-3"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Instrução do Banco de Dados Supabase (SQL) */}
      <AnimatePresence>
        {showSqlInstruction && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5 space-y-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Sincronização com o Banco de Dados (Supabase)</h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    As colunas <code className="text-amber-400">admin_phone</code> e <code className="text-amber-400">alerts_enabled</code> foram salvas localmente, mas precisam ser criadas no Supabase.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowSqlInstruction(false)}
                className="p-1 text-slate-500 hover:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-[#050507] border border-white/10 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-mono text-[11px] text-amber-500/80">SQL Script para o Supabase Editor</span>
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg text-xs font-medium border border-amber-500/30 transition-all"
                >
                  {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSql ? 'Copiado!' : 'Copiar Script SQL'}</span>
                </button>
              </div>

              <pre className="text-[11px] font-mono text-slate-300 overflow-x-auto p-2 bg-black/40 rounded-lg whitespace-pre-wrap">
                {sqlScript}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0a0a0d]/70 p-6 rounded-2xl border border-white/10 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500">
            <Activity className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Monitoramento & Alertas de Queda</h2>
            <p className="text-xs text-slate-400 mt-1">
              Painel de integridade das telas da rede com notificações automáticas via WhatsApp (Vercel Cron)
            </p>
          </div>
        </div>

        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl border border-white/10 text-xs font-medium transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${isLoadingTelas ? 'animate-spin' : ''}`} />
          <span>Atualizar Dados</span>
        </button>
      </div>

      {/* Cards de Métricas em Tempo Real */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0a0a0d]/60 border border-white/10 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Total de Telas</p>
            <h3 className="text-2xl font-bold text-white mt-1">{totalTelas}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Cadastradas na rede</p>
          </div>
          <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
            <Radio className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-[#0a0a0d]/60 border border-emerald-500/20 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-emerald-400">Telas Online</p>
            <h3 className="text-2xl font-bold text-emerald-400 mt-1">{onlineCount}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Ping nos últimos 15 min</p>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <Wifi className="w-6 h-6 animate-pulse" />
          </div>
        </div>

        <div className="bg-[#0a0a0d]/60 border border-red-500/20 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-red-400">Telas Offline</p>
            <h3 className="text-2xl font-bold text-red-400 mt-1">{offlineCount}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Sem ping {'>'} 15 min</p>
          </div>
          <div className="p-3 bg-red-500/10 text-red-400 rounded-xl border border-red-500/20">
            <WifiOff className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-[#0a0a0d]/60 border border-amber-500/20 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-amber-400">Alertas Disparados</p>
            <h3 className="text-2xl font-bold text-amber-400 mt-1">{alertedCount}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Aguardando reconexão</p>
          </div>
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
            <ShieldAlert className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Seção 1: Form de Configurações de Notificação */}
      <div className="bg-[#0a0a0d]/70 border border-white/10 rounded-2xl p-6 backdrop-blur-xl space-y-6">
        <div className="flex items-center gap-3 border-b border-white/10 pb-4">
          <Bell className="w-5 h-5 text-amber-500" />
          <div>
            <h3 className="text-base font-bold text-white">Configurações de Alertas de Queda (WhatsApp)</h3>
            <p className="text-xs text-slate-400">Configure o número de destino e ative o monitoramento contínuo.</p>
          </div>
        </div>

        <form onSubmit={handleSaveConfig} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
            {/* Campo WhatsApp */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-amber-500" />
                Número do WhatsApp para Alertas (admin_phone)
              </label>
              <input
                type="text"
                value={adminPhone}
                onChange={(e) => setAdminPhone(e.target.value)}
                placeholder="Ex: 5511999999999"
                className="w-full bg-[#050507] border border-white/10 focus:border-amber-500 rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-all placeholder:text-slate-600 font-mono"
              />
              <p className="text-[11px] text-slate-500">
                Inclua o código do país e DDD sem espaços ou traços (ex: 5511999999999).
              </p>
            </div>

            {/* Switch Toggle */}
            <div className="space-y-2 bg-[#050507] border border-white/10 rounded-xl p-3.5 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-white block">Ativar Alertas de Queda (alerts_enabled)</span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  Enviar mensagens de WhatsApp automaticamente quando uma tela ficar offline por mais de 20 minutos.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAlertsEnabled(!alertsEnabled)}
                className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  alertsEnabled ? 'bg-amber-500' : 'bg-slate-800'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    alertsEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <PillProgressButton
              type="submit"
              label="Salvar Configurações"
              loadingLabel="Salvando..."
              variant="amber"
              isLoading={isSavingConfig}
              className="px-6"
            />

            <button
              type="button"
              onClick={handleTestAlert}
              disabled={isTestingAlert || !adminPhone}
              className="flex items-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 disabled:opacity-40 text-slate-300 hover:text-white rounded-xl border border-white/10 text-xs font-medium transition-all"
            >
              <Send className="w-4 h-4 text-amber-500" />
              <span>{isTestingAlert ? 'Enviando Teste...' : 'Testar Alerta no WhatsApp'}</span>
            </button>

            <button
              type="button"
              onClick={handleRunCron}
              disabled={isRunningCron}
              className="flex items-center gap-2 px-4 py-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30 text-xs font-medium transition-all ml-auto"
            >
              <Zap className={`w-4 h-4 ${isRunningCron ? 'animate-bounce' : ''}`} />
              <span>{isRunningCron ? 'Executando Cron...' : 'Rodar Checagem do Cron Agora'}</span>
            </button>
          </div>

          {/* Feedback Messages */}
          {saveSuccess && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Configurações salvas com sucesso!</span>
            </div>
          )}

          {testResult && (
            <div
              className={`p-4 rounded-xl text-xs border flex items-center gap-2 ${
                testResult.success
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-red-500/10 border-red-500/20 text-red-400'
              }`}
            >
              {testResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
              <span className="font-medium">{testResult.msg}</span>
            </div>
          )}

          {cronResult && (
            <div className="p-4 bg-[#050507] border border-white/10 rounded-xl text-xs font-mono space-y-2 text-slate-300">
              <p className="text-amber-400 font-bold">Resultado da Execução do Cron (/api/cron/check-offline):</p>
              <pre className="text-[11px] overflow-x-auto whitespace-pre-wrap">{JSON.stringify(cronResult, null, 2)}</pre>
            </div>
          )}
        </form>
      </div>

      {/* Seção 2: Dashboard de Saúde da Rede */}
      <div className="bg-[#0a0a0d]/70 border border-white/10 rounded-2xl p-6 backdrop-blur-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <Radio className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-base font-bold text-white">Dashboard de Saúde da Rede</h3>
              <p className="text-xs text-slate-400">
                Acompanhamento individual de pings e heartbeat de cada dispositivo conectado.
              </p>
            </div>
          </div>

          {/* Barra de Pesquisa */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por tela, cliente ou ID..."
              className="w-full bg-[#050507] border border-white/10 focus:border-amber-500 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none transition-all placeholder:text-slate-600"
            />
          </div>
        </div>

        {/* Tabela de Dispositivos / Telas */}
        {isLoadingTelas ? (
          <div className="py-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
            <p className="text-xs font-mono">Carregando status das telas...</p>
          </div>
        ) : filteredTelas.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <p className="text-xs font-mono uppercase tracking-widest">Nenhuma tela encontrada.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 font-mono text-[10px] uppercase tracking-wider">
                  <th className="pb-3 px-3">Status</th>
                  <th className="pb-3 px-3">Tela / Local</th>
                  <th className="pb-3 px-3">Cliente</th>
                  <th className="pb-3 px-3">Device ID</th>
                  <th className="pb-3 px-3">Último Ping (Heartbeat)</th>
                  <th className="pb-3 px-3">Alerta Enviado</th>
                  <th className="pb-3 px-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredTelas.map((tela) => {
                  const online = isScreenOnline(tela.last_ping);
                  const deviceId = tela.fully_device_id || tela.identificador_unico || tela.id;

                  return (
                    <tr key={tela.id} className="hover:bg-white/[0.02] transition-colors">
                      {/* Badge Status */}
                      <td className="py-3.5 px-3">
                        {online ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                            Online
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            Offline
                          </span>
                        )}
                      </td>

                      {/* Nome da Tela */}
                      <td className="py-3.5 px-3 font-medium text-white">
                        {tela.nome_local}
                      </td>

                      {/* Cliente */}
                      <td className="py-3.5 px-3 text-slate-300">
                        {tela.clientes?.nome_empresa || 'Sem cliente'}
                      </td>

                      {/* Device ID */}
                      <td className="py-3.5 px-3 font-mono text-slate-400 text-[11px]">
                        {deviceId}
                      </td>

                      {/* Último Ping */}
                      <td className="py-3.5 px-3">
                        <div className="flex flex-col">
                          <span className="text-white font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-500" />
                            {formatTimeAgo(tela.last_ping)}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500 mt-0.5">
                            {tela.last_ping
                              ? new Date(tela.last_ping).toLocaleString('pt-BR')
                              : 'Sem histórico'}
                          </span>
                        </div>
                      </td>

                      {/* Alerta Enviado */}
                      <td className="py-3.5 px-3">
                        {tela.alert_sent ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <ShieldAlert className="w-3 h-3" />
                            Sim (Enviado)
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-slate-600">Não</span>
                        )}
                      </td>

                      {/* Ação */}
                      <td className="py-3.5 px-3 text-right">
                        <button
                          onClick={() => handleSendTestHeartbeat(deviceId)}
                          title="Simular Ping (Heartbeat) para esta tela"
                          className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg border border-white/10 text-[11px] transition-all inline-flex items-center gap-1"
                        >
                          <Zap className="w-3 h-3 text-amber-500" />
                          <span>Simular Ping</span>
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
  );
}
