import React, { useState, useEffect } from 'react';
import { QrCode, Smartphone, LogOut, Send, AlertTriangle, Loader2 } from 'lucide-react';

export function WhatsappPanel({ clientes, showToast }: any) {
  const [status, setStatus] = useState<string>('close');
  const [qr, setQr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [template, setTemplate] = useState('Olá {nome}, sua fatura de manutenção Gold Play Mídia está disponível.');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/whatsapp/status');
      const data = await res.json();
      setStatus(data.status);
      setQr(data.qr || null);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const connect = async () => {
    setLoading(true);
    try {
      await fetch('/api/whatsapp/connect', { method: 'POST' });
    } catch (err) {
      console.error(err);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await fetch('/api/whatsapp/logout', { method: 'POST' });
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
      const res = await fetch('/api/whatsapp/trigger-billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto pt-6">
      <div>
        <h2 className="text-3xl font-display font-light text-white mb-2 tracking-tight">WhatsApp (Beta)</h2>
        <p className="text-sm text-slate-500 font-light">Conecte seu WhatsApp para automatizar envio de cobranças e notificações.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#0f0f11] border border-white/5 rounded-3xl p-6 flex flex-col items-center justify-center min-h-[400px]">
          {loading ? (
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
          ) : status === 'open' ? (
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
                <Smartphone className="w-8 h-8 text-emerald-500" />
              </div>
              <div>
                <h3 className="text-xl font-medium text-white mb-1">WhatsApp Conectado</h3>
                <p className="text-sm text-slate-500">Seu dispositivo está vinculado e pronto para enviar mensagens.</p>
              </div>
              <button
                onClick={logout}
                className="mt-4 flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-4 py-2 rounded-xl transition-colors text-sm font-medium"
              >
                <LogOut className="w-4 h-4" />
                Desconectar
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center space-y-6 w-full">
              <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center border border-blue-500/20 mb-2">
                <QrCode className="w-6 h-6 text-blue-500" />
              </div>
              
              <div>
                <h3 className="text-lg font-medium text-white mb-2">Vincular Dispositivo</h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Abra o WhatsApp no seu celular, vá em <b>Aparelhos Conectados</b> e aponte a câmera para o QR Code abaixo.
                </p>
              </div>

              {qr ? (
                <div className="bg-white p-2 rounded-xl">
                  <img src={qr} alt="WhatsApp QR Code" className="w-48 h-48" />
                </div>
              ) : (
                <div className="w-48 h-48 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center">
                  {status === 'connecting' ? (
                    <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
                  ) : (
                    <button
                      onClick={connect}
                      className="bg-amber-500 hover:bg-amber-600 text-black px-4 py-2 rounded-lg font-medium transition-colors text-sm"
                    >
                      Gerar QR Code
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-[#0f0f11] border border-white/5 rounded-3xl p-6 flex flex-col">
          <h3 className="text-lg font-medium text-white mb-2">Automação de Cobranças</h3>
          <p className="text-xs text-slate-500 mb-6">
            O envio automático de cobranças ocorre todo <b>dia 10</b>. Configure abaixo a mensagem padrão. Variáveis disponíveis: {'{nome}'}, {'{whatsapp}'}.
          </p>

          <div className="flex-1">
            <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1.5">Template de Mensagem</label>
            <textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="w-full h-32 bg-[#050505] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500/50 transition-all resize-none"
            />
            
            <div className="mt-4 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
              <div className="flex gap-2 items-start text-amber-500/80">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="text-[10px] uppercase font-mono tracking-wider">Atenção aos termos do Meta</p>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                O envio utiliza um intervalo dinâmico de 5 a 15 segundos entre cada mensagem para simular uso humano e evitar bloqueios na sua conta do WhatsApp.
              </p>
            </div>
          </div>

          <button
            onClick={startBilling}
            disabled={status !== 'open' || isSending}
            className={`w-full mt-6 flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-all font-medium text-sm ${
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
                Enviando Lote...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Testar Envio em Lote Manual
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
