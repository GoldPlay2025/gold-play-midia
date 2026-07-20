import React, { useState, useEffect } from 'react';
import { QrCode, Smartphone, LogOut, Send, AlertTriangle, Loader2, MessageCircle, HeartPulse, CheckCircle2, Link2 } from 'lucide-react';
import { motion } from 'motion/react';
import { fetchApi } from '../lib/api';

export function WhatsappPanel({ clientes, showToast, setActiveTab }: any) {
  const [status, setStatus] = useState<string>('close');
  const [qr, setQr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [template, setTemplate] = useState('Olá {nome}, sua fatura de manutenção Gold Play Mídia está disponível.');
  const [isSending, setIsSending] = useState(false);
  
  // Manual Send State
  const [manualNumber, setManualNumber] = useState('');
  const [manualMessage, setManualMessage] = useState('');
  const [isSendingManual, setIsSendingManual] = useState(false);

  // Debug Logs State
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  // Backend URL config state
  const [backendUrl, setBackendUrl] = useState(() => {
    try {
      const localSettings = typeof window !== 'undefined' ? localStorage.getItem('gpm_system_settings') : null;
      if (localSettings) {
        const parsed = JSON.parse(localSettings);
        return parsed?.backendUrl || '';
      }
    } catch (e) {
      console.error(e);
    }
    return '';
  });

  const handleSaveBackendUrl = () => {
    try {
      const localSettings = localStorage.getItem('gpm_system_settings');
      let parsed = {};
      if (localSettings) {
        parsed = JSON.parse(localSettings);
      }
      const updated = { ...parsed, backendUrl: backendUrl.trim() };
      localStorage.setItem('gpm_system_settings', JSON.stringify(updated));
      showToast?.('success', 'URL do servidor backend salva com sucesso! Atualizando conexão...');
      
      // Reload page to apply the new URL immediately
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (e) {
      console.error(e);
      showToast?.('error', 'Erro ao salvar URL do backend.');
    }
  };

  // Vercel Environment Check
  const isVercel = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');
  const hasBackendUrl = !!backendUrl;
  const showVercelAlert = isVercel && !hasBackendUrl;

  useEffect(() => {
    fetchStatus();
    fetchLogs();
    const interval = setInterval(() => {
      fetchStatus();
      if (showLogs) {
        fetchLogs();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [showLogs]);

  const fetchStatus = async () => {
    try {
      const res = await fetchApi('/api/whatsapp/status');
      const data = await res.json();
      setStatus(data.status);
      setQr(data.qr || null);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setStatus('close');
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetchApi('/api/whatsapp/debug');
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const connect = async () => {
    setLoading(true);
    try {
      await fetchApi('/api/whatsapp/connect', { method: 'POST' });
    } catch (err) {
      console.error(err);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await fetchApi('/api/whatsapp/logout', { method: 'POST' });
      setQr(null);
    } catch (err) {
      console.error(err);
    }
  };

  const startBilling = async () => {
    if (!clientes || clientes.length === 0) {
      showToast('error', 'Nenhum cliente cadastrado.');
      return;
    }
    setIsSending(true);
    try {
      const res = await fetchApi('/api/whatsapp/trigger-billing', {
        method: 'POST',
        body: JSON.stringify({ clients: clientes, template })
      });
      if (res.ok) {
        showToast('success', 'Envio de cobranças iniciado! (Processamento em segundo plano)');
      } else {
        showToast('error', 'Erro ao iniciar cobranças.');
      }
    } catch (err) {
      console.error(err);
      showToast('error', 'Erro ao conectar com o servidor.');
    } finally {
      setIsSending(false);
    }
  };

  const formatPhone = (val: string) => {
    const raw = val.replace(/\D/g, '');
    if (raw.length <= 2) return raw;
    if (raw.length <= 6) return `(${raw.slice(0, 2)}) ${raw.slice(2)}`;
    if (raw.length <= 10) return `(${raw.slice(0, 2)}) ${raw.slice(2, 6)}-${raw.slice(6)}`;
    return `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7, 11)}`;
  };

  const sendManualMessage = async () => {
    if (!manualNumber || !manualMessage) {
      showToast('error', 'Preencha o número e a mensagem.');
      return;
    }
    const cleanNumber = manualNumber.replace(/\D/g, '');
    if (cleanNumber.length < 10) {
      showToast('error', 'Número inválido.');
      return;
    }
    
    setIsSendingManual(true);
    try {
      const res = await fetchApi('/api/whatsapp/send', {
        method: 'POST',
        body: JSON.stringify({ number: cleanNumber, message: manualMessage })
      });
      if (res.ok) {
        showToast('success', 'Mensagem enviada com sucesso!');
        setManualMessage('');
        setManualNumber('');
      } else {
        const err = await res.json();
        showToast('error', 'Erro ao enviar mensagem: ' + (err.error || ''));
      }
    } catch (err) {
      console.error(err);
      showToast('error', 'Erro ao conectar com o servidor.');
    } finally {
      setIsSendingManual(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto pt-6">
      <div>
        <h2 className="text-3xl font-display font-light text-white mb-2 tracking-tight">WhatsApp Manager</h2>
        <p className="text-sm text-slate-500 font-light">Conecte seu WhatsApp para automatizar envios e realizar disparos manuais.</p>
      </div>

      {/* Card de Configuração de Servidor Backend (APIs / WhatsApp) */}
      <div className="bg-[#0f0f11] border border-white/5 rounded-3xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/10 rounded-full flex items-center justify-center border border-amber-500/20">
              <Link2 className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Servidor Backend de Integração (APIs / WhatsApp)</h3>
              <p className="text-[11px] text-slate-500 max-w-xl">
                Se o seu painel estiver hospedado na <b>Vercel</b> ou em outro ambiente serverless, cole aqui a <b>Shared App URL</b> do seu container persistente no AI Studio (ou VPS) para que a conexão do WhatsApp funcione normalmente de qualquer lugar.
              </p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto md:min-w-[400px]">
            <input
              type="url"
              value={backendUrl}
              onChange={(e) => setBackendUrl(e.target.value)}
              placeholder="Ex: https://ais-pre-v3o4yftcg3lues4kuk7y24-213224961605.us-west2.run.app"
              className="flex-1 bg-[#050505] border border-white/10 rounded-xl px-4 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-amber-500/50"
            />
            <button
              onClick={handleSaveBackendUrl}
              className="bg-amber-500 hover:bg-amber-400 text-black rounded-xl px-5 py-2.5 text-xs font-semibold transition-all whitespace-nowrap active:scale-95"
            >
              Salvar Servidor
            </button>
          </div>
        </div>
        
        {backendUrl ? (
          <div className="mt-3 text-[11px] text-emerald-400/80 font-mono leading-none flex items-center gap-1.5 sm:ml-13">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Conectado ao servidor persistente: <span className="underline select-all">{backendUrl}</span>
          </div>
        ) : (
          <div className="mt-3 text-[11px] text-amber-500/80 leading-none flex items-center gap-1.5 sm:ml-13">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            Usando backend local por padrão (se estiver hospedado na Vercel, o status do WhatsApp resultará em 404).
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Connection Card */}
        <div className="bg-[#0f0f11] border border-white/5 rounded-3xl p-8 flex flex-col items-center justify-center min-h-[420px] relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <Smartphone className="w-24 h-24 text-emerald-500" />
          </div>

          {/* Heartbeat Status */}
          <div className="absolute top-6 left-6 flex items-center gap-3">
            <div className="relative flex items-center justify-center w-8 h-8">
              {status === 'open' ? (
                <>
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-20 animate-ping"></span>
                  <HeartPulse className="w-5 h-5 text-emerald-500 relative z-10 animate-pulse" />
                </>
              ) : (
                <HeartPulse className="w-5 h-5 text-red-500 relative z-10" />
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Status Conexão</span>
              <span className={`text-sm font-medium ${status === 'open' ? 'text-emerald-500' : 'text-red-500'}`}>
                {status === 'open' ? 'ON-LINE' : 'OFF-LINE'}
              </span>
            </div>
          </div>

          {loading ? (
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin mt-12" />
          ) : status === 'open' ? (
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center text-center space-y-6 mt-8 z-10">
              <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20 shadow-[0_0_50px_rgba(16,185,129,0.15)] relative">
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              </div>
              <div>
                <h3 className="text-2xl font-medium text-white mb-2">WhatsApp Conectado</h3>
                <p className="text-sm text-slate-400 max-w-xs mx-auto">Dispositivo vinculado com sucesso. Você já pode realizar envios.</p>
              </div>
              <button
                onClick={logout}
                className="group flex items-center gap-2 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/20 hover:border-red-500 px-6 py-2.5 rounded-full transition-all text-sm font-medium"
              >
                <LogOut className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                Desconectar Dispositivo
              </button>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center text-center space-y-6 w-full mt-10 z-10">
              <div>
                <h3 className="text-xl font-medium text-white mb-2">Vincular Dispositivo</h3>
                <p className="text-sm text-slate-400 max-w-sm mx-auto">
                  Acesse <b>Aparelhos Conectados</b> no seu celular e aponte a câmera para o QR Code.
                </p>
              </div>

              {qr ? (
                <div className="bg-white p-3 rounded-3xl shadow-[0_0_40px_rgba(255,255,255,0.1)]">
                  <img src={qr} alt="WhatsApp QR Code" className="w-48 h-48 rounded-xl" />
                </div>
              ) : (
                <div className="w-48 h-48 bg-white/5 border border-white/10 rounded-3xl flex items-center justify-center relative overflow-hidden group">
                  {status === 'connecting' ? (
                    <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                  ) : (
                    <button
                      onClick={connect}
                      className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-amber-500 hover:bg-amber-400 text-black transition-colors"
                    >
                      <QrCode className="w-8 h-8 mb-2" />
                      <span className="font-medium text-sm">Gerar QR Code</span>
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </div>

        {/* Action Cards Container */}
        <div className="flex flex-col gap-6">
          
          {/* Manual Send Card */}
          <div className="bg-[#0f0f11] border border-white/5 rounded-3xl p-6 flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center border border-blue-500/20">
                <MessageCircle className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-white">Envio Manual</h3>
                <p className="text-xs text-slate-500">Envie mensagens avulsas rapidamente</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1.5">Número com DDD</label>
                <input
                  type="text"
                  placeholder="(11) 99999-9999"
                  value={manualNumber}
                  onChange={(e) => setManualNumber(formatPhone(e.target.value))}
                  className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1.5">Mensagem</label>
                <textarea
                  value={manualMessage}
                  onChange={(e) => setManualMessage(e.target.value)}
                  placeholder="Digite sua mensagem aqui..."
                  className="w-full h-24 bg-[#050505] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all resize-none"
                />
              </div>
              <button
                onClick={sendManualMessage}
                disabled={status !== 'open' || isSendingManual || !manualNumber || !manualMessage}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl transition-all font-medium text-sm ${
                  status !== 'open' || !manualNumber || !manualMessage
                    ? 'bg-white/5 text-slate-500 cursor-not-allowed'
                    : isSendingManual
                    ? 'bg-blue-500/50 text-white cursor-wait'
                    : 'bg-blue-500 hover:bg-blue-400 text-white'
                }`}
              >
                {isSendingManual ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {isSendingManual ? 'Enviando...' : 'Enviar Mensagem'}
              </button>
            </div>
          </div>

          {/* Automate / Batch Billing Card */}
          <div className="bg-[#0f0f11] border border-white/5 rounded-3xl p-6 flex flex-col flex-1">
            <h3 className="text-lg font-medium text-white mb-2">Envio em Lote (Cobranças)</h3>
            <p className="text-xs text-slate-500 mb-4">
              Dispara mensagens para todos os clientes. Variáveis: {'{nome}'}, {'{whatsapp}'}.
            </p>

            <div className="flex-1 flex flex-col">
              <textarea
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                className="w-full h-24 bg-[#050505] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500/50 transition-all resize-none mb-4"
              />
              
              <div className="mt-auto p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl mb-4">
                <div className="flex gap-2 items-start text-amber-500/80">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] uppercase font-mono tracking-wider">Atenção (Meta Terms)</p>
                    <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                      O envio utiliza delay dinâmico (5-15s) entre mensagens para simular uso humano e evitar bloqueios.
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={startBilling}
                disabled={status !== 'open' || isSending}
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-all font-medium text-sm ${
                  status !== 'open'
                    ? 'bg-white/5 text-slate-500 cursor-not-allowed'
                    : isSending
                    ? 'bg-amber-500/50 text-black cursor-wait'
                    : 'bg-amber-500 hover:bg-amber-400 text-black'
                }`}
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processando Lote...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Iniciar Envio em Lote
                  </>
                )}
              </button>
            </div>
          </div>
          
        </div>
      </div>

      {/* Seção de Logs de Depuração */}
      <div className="bg-[#0f0f11] border border-white/5 rounded-3xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/10 rounded-full flex items-center justify-center border border-amber-500/20 animate-pulse">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-white">Logs de Depuração do WhatsApp</h3>
              <p className="text-xs text-slate-500">Histórico de inicialização e erros de conexão em tempo real (Baileys)</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                fetchLogs();
                showToast?.('success', 'Logs atualizados.');
              }}
              className="bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl px-4 py-2 text-xs font-semibold transition-all"
            >
              Atualizar Logs
            </button>
            <button
              onClick={() => setShowLogs(!showLogs)}
              className="bg-amber-500 hover:bg-amber-400 text-black rounded-xl px-4 py-2 text-xs font-semibold transition-all"
            >
              {showLogs ? 'Ocultar Logs' : 'Exibir Logs'}
            </button>
          </div>
        </div>

        {showLogs && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-6 space-y-4"
          >
            <div className="bg-[#050505] border border-white/10 rounded-2xl p-4 max-h-64 overflow-y-auto font-mono text-xs text-slate-400 space-y-1.5 scrollbar-thin scrollbar-thumb-white/10">
              {logs.length === 0 ? (
                <p className="text-slate-600 text-center py-4">Nenhum log registrado ainda. Clique em "Gerar QR Code" acima para iniciar a conexão.</p>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className="border-b border-white/5 pb-1 last:border-0 leading-relaxed break-all">
                    {log}
                  </div>
                ))
              )}
            </div>
            <div className="text-[11px] text-slate-500 leading-relaxed flex items-start gap-1.5">
              <span className="text-amber-500 font-bold">Dica Técnica:</span>
              <span>
                Caso o WhatsApp fique travado, clique no botão "Desconectar Dispositivo" acima para limpar a pasta de sessão antiga em disco e forçar uma nova inicialização limpa.
              </span>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
