import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Cloud, ExternalLink, Check, KeyRound, Save, Mail, Key } from 'lucide-react';
import { PillProgressButton } from './PillProgressButton';

interface FullyCloudLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function FullyCloudLoginModal({ isOpen, onClose, onSuccess }: FullyCloudLoginModalProps) {
  const [tokenInput, setTokenInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTokenInput(localStorage.getItem('fully_api_token') || '');
      setEmailInput(localStorage.getItem('fully_api_email') || '');
      setIsSaved(false);
    }
  }, [isOpen]);

  const handleSaveCredentials = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    localStorage.setItem('fully_api_token', tokenInput.trim());
    localStorage.setItem('fully_api_email', emailInput.trim());
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleDoneLogin = () => {
    handleSaveCredentials();
    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      if (onSuccess) onSuccess();
      onClose();
    }, 800);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/85 backdrop-blur-md z-50"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 20 }}
            transition={{ type: "spring", duration: 0.4 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-xl max-h-[92vh] flex flex-col bg-[#0d0d0f] border border-amber-500/30 rounded-3xl shadow-[0_0_50px_rgba(245,158,11,0.15)] z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/10 bg-gradient-to-r from-amber-500/10 via-black to-blue-500/10 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/10">
                  <Cloud className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white tracking-tight">Configurar Fully Cloud API</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono font-semibold border border-amber-500/30">
                      Credenciais
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">Insira seu API Token/Senha para autorizar comandos aos dispositivos.</p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white transition-colors p-2 rounded-xl hover:bg-white/5"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Main Area */}
            <div className="p-6 flex-1 overflow-y-auto space-y-5 bg-black/60">
              <form onSubmit={handleSaveCredentials} className="space-y-4">
                <div className="bg-[#121215] border border-white/10 p-4 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                      <Key className="w-4 h-4 text-amber-400" />
                      <span>API Token / Cloud Secret (Ou Senha Remote Admin)</span>
                    </label>
                    <a
                      href="https://cloud.fully-kiosk.com/cloud/settings"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-amber-400 hover:underline flex items-center gap-1"
                    >
                      <span>Obter na Conta</span> <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <input
                    type="password"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="Cole seu FULLY_API_TOKEN ou Chave Cloud..."
                    className="w-full bg-[#070709] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50 transition-all font-mono"
                  />
                  <p className="text-[10px] text-slate-400">
                    Sua chave é gerada em <strong>Cloud Settings &gt; Cloud Secret/API Key</strong> no painel do Fully Cloud.
                  </p>
                </div>

                <div className="bg-[#121215] border border-white/10 p-4 rounded-2xl space-y-3">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-amber-400" />
                    <span>E-mail da Conta Fully Cloud</span>
                  </label>
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="ex: seuemail@dominio.com"
                    className="w-full bg-[#070709] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50 transition-all font-mono"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <a
                    href="https://cloud.fully-kiosk.com/cloud/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors"
                  >
                    <span>Abrir Portal Fully Cloud</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <button
                    type="submit"
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-amber-500/20 active:scale-95"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSaved ? 'Credenciais Salvas!' : 'Salvar no Navegador'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Footer controls */}
            <div className="px-6 py-4 border-t border-white/10 bg-[#070709] flex items-center justify-between shrink-0">
              <span className="text-[11px] text-slate-400">
                Salva suas credenciais localmente para autorizar o envio de comandos.
              </span>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                >
                  Cancelar
                </button>

                <PillProgressButton
                  onClick={handleDoneLogin}
                  label="Salvar &amp; Confirmar"
                  loadingLabel="Verificando..."
                  icon={<Check className="w-4 h-4" />}
                  variant="amber"
                  isLoading={isVerifying}
                />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
