import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Cloud, ExternalLink, Check, ShieldAlert, RefreshCw, KeyRound } from 'lucide-react';
import { PillProgressButton } from './PillProgressButton';

interface FullyCloudLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function FullyCloudLoginModal({ isOpen, onClose, onSuccess }: FullyCloudLoginModalProps) {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleDoneLogin = () => {
    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      if (onSuccess) onSuccess();
      onClose();
    }, 1200);
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
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-2xl max-h-[92vh] flex flex-col bg-[#0d0d0f] border border-amber-500/30 rounded-3xl shadow-[0_0_50px_rgba(245,158,11,0.15)] z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/10 bg-gradient-to-r from-amber-500/10 via-black to-blue-500/10 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/10">
                  <Cloud className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white tracking-tight">Login no Fully Cloud</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono font-semibold border border-amber-500/30">
                      Sessão Expirada
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">Faça o login abaixo para revalidar os comandos dos dispositivos.</p>
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

            {/* Sub-header notification */}
            <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2.5 flex items-center justify-between text-xs text-amber-200 shrink-0">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                <span>O Fully Cloud deslogou por inatividade. Faça login para reativar o envio.</span>
              </div>
              <a
                href="https://cloud.fully-kiosk.com/cloud/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-semibold text-amber-300 hover:text-white underline flex items-center gap-1 shrink-0 ml-2"
              >
                Abrir em Nova Aba <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* Iframe Viewport */}
            <div className="p-4 flex-1 overflow-hidden relative bg-black/60 flex flex-col items-center justify-center min-h-[460px]">
              {!iframeLoaded && (
                <div className="absolute inset-0 bg-[#0d0d0f] z-10 flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
                  <p className="text-xs text-slate-400 font-mono">Carregando painel do Fully Cloud...</p>
                </div>
              )}

              <iframe
                src="https://cloud.fully-kiosk.com/cloud/"
                className="w-full h-full min-h-[440px] rounded-2xl border border-white/10 bg-white shadow-2xl"
                onLoad={() => setIframeLoaded(true)}
                title="Fully Cloud Login"
                sandbox="allow-forms allow-modals allow-popups allow-same-origin allow-scripts"
              />
            </div>

            {/* Footer controls */}
            <div className="px-6 py-4 border-t border-white/10 bg-[#070709] flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <span>Após digitar e clicar em OK no login, clique em <strong>Concluí o Login</strong>.</span>
              </div>

              <div className="flex items-center gap-3 ml-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                >
                  Cancelar
                </button>

                <PillProgressButton
                  onClick={handleDoneLogin}
                  label="Concluí o Login"
                  loadingLabel="Verificando Conexão..."
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
