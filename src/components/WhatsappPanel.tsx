import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  QrCode, 
  Power, 
  PowerOff, 
  Send, 
  MessageSquare, 
  Users, 
  Loader2, 
  Search, 
  Image as ImageIcon, 
  UploadCloud, 
  X, 
  Sparkles,
  FileText,
  CheckCircle,
  Smartphone
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const DEFAULT_TEMPLATE = `Olá [Nome], aqui é da Gold Mídias.

Lembramos que a sua fatura do plano [Plano] no valor de [Valor] possui vencimento agendado para [Vencimento].

Evite a suspensão do serviço realizando o pagamento em dia. Agradecemos a parceria!`;

export function WhatsappPanel({ showToast }: { showToast: (type: 'success' | 'error', msg: string) => void }) {
  const [isConnected, setIsConnected] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Form de Disparo Avulso
  const [numeroManual, setNumeroManual] = useState('');
  const [mensagemManual, setMensagemManual] = useState('');
  const [imagemManualBase64, setImagemManualBase64] = useState<string | null>(null);
  const [isSendingManual, setIsSendingManual] = useState(false);

  // Template Editor e Banner
  const [templateText, setTemplateText] = useState(() => {
    return localStorage.getItem('gpm_wa_template_text') || DEFAULT_TEMPLATE;
  });
  const [templateImage, setTemplateImage] = useState<string | null>(() => {
    return localStorage.getItem('gpm_wa_template_image') || null;
  });

  const [isSendingBilling, setIsSendingBilling] = useState(false);
  const [clientesCount, setClientesCount] = useState(0);
  const [showBillingModal, setShowBillingModal] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const manualFileInputRef = useRef<HTMLInputElement>(null);

  const apiUrl = '/api/whatsapp';
  const apiKey = import.meta.env.VITE_WHATSAPP_API_KEY || 'minha-chave-secreta';

  const defaultHeaders = {
    'x-api-key': apiKey,
    'Content-Type': 'application/json'
  };

  const checkStatus = async () => {
    try {
      const res = await fetch(`${apiUrl}/status`, { headers: { 'x-api-key': apiKey } });
      const data = await res.json();
      setIsConnected(data.connected);
    } catch (err) {
      console.error('Erro ao checar status:', err);
    }
  };

  const loadClientesCount = async () => {
    try {
      const { data, count, error } = await supabase
        .from('clientes')
        .select('*', { count: 'exact' });
      if (!error && data) {
        setClientesCount(data.length);
      }
    } catch (err) {
      console.error('Erro ao carregar clientes:', err);
    }
  };

  useEffect(() => {
    checkStatus();
    loadClientesCount();
  }, []);

  // Salvar template e imagem no localStorage
  useEffect(() => {
    localStorage.setItem('gpm_wa_template_text', templateText);
  }, [templateText]);

  useEffect(() => {
    if (templateImage) {
      localStorage.setItem('gpm_wa_template_image', templateImage);
    } else {
      localStorage.removeItem('gpm_wa_template_image');
    }
  }, [templateImage]);

  // Máscara de formatação automática para Telefone: (XX) XXXXX-XXXX
  const formatPhoneDisplay = (val: string) => {
    const nums = val.replace(/\D/g, '');
    if (nums.length <= 2) return nums;
    if (nums.length <= 6) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`;
    if (nums.length <= 10) return `(${nums.slice(0, 2)}) ${nums.slice(2, 6)}-${nums.slice(6)}`;
    return `(${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7, 11)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneDisplay(e.target.value);
    setNumeroManual(formatted);
  };

  // Inserção de variáveis no Template Textarea
  const insertVariable = (varName: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setTemplateText(prev => prev + ` ${varName}`);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = templateText;
    const inserted = text.substring(0, start) + varName + text.substring(end);
    
    setTemplateText(inserted);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + varName.length, start + varName.length);
    }, 50);
  };

  // Upload de imagem do template
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast('error', 'A imagem deve ter no máximo 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setTemplateImage(reader.result as string);
      showToast('success', 'Imagem do template adicionada com sucesso!');
    };
    reader.readAsDataURL(file);
  };

  // Upload de imagem para disparo manual
  const handleManualImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast('error', 'A imagem deve ter no máximo 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImagemManualBase64(reader.result as string);
      showToast('success', 'Imagem anexada ao disparo avulso!');
    };
    reader.readAsDataURL(file);
  };

  const handleConnect = async () => {
    setIsLoading(true);
    setQrCode(null);
    try {
      const res = await fetch(`${apiUrl}/connect`, { headers: { 'x-api-key': apiKey } });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao conectar');
      }
      
      if (data.connected) {
        setIsConnected(true);
        showToast('success', 'WhatsApp conectado com sucesso!');
      } else if (data.qrCode) {
        setQrCode(data.qrCode);
        showToast('success', 'Escaneie o QR Code com seu WhatsApp.');
        
        const interval = setInterval(async () => {
          const statusRes = await fetch(`${apiUrl}/status`, { headers: { 'x-api-key': apiKey } });
          const statusData = await statusRes.json();
          if (statusData.connected) {
            setIsConnected(true);
            setQrCode(null);
            clearInterval(interval);
            showToast('success', 'WhatsApp conectado!');
          }
        }, 3000);
      }
    } catch (error: any) {
      showToast('error', error.message || 'Erro ao iniciar conexão.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await fetch(`${apiUrl}/logout`, { method: 'POST', headers: { 'x-api-key': apiKey } });
      setIsConnected(false);
      setQrCode(null);
      showToast('success', 'Sessão encerrada com sucesso.');
    } catch (error) {
      showToast('error', 'Erro ao desconectar.');
    }
  };

  const handleSendManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!numeroManual) {
      return showToast('error', 'Preencha o número de telefone.');
    }
    if (!mensagemManual && !imagemManualBase64) {
      return showToast('error', 'Digite uma mensagem ou anexe uma imagem.');
    }
    
    setIsSendingManual(true);
    try {
      const res = await fetch(`${apiUrl}/send-manual`, {
        method: 'POST',
        headers: defaultHeaders,
        body: JSON.stringify({ 
          numero: numeroManual, 
          mensagem: mensagemManual,
          imagemBase64: imagemManualBase64
        })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Falha ao enviar');
      
      showToast('success', 'Mensagem enviada com sucesso!');
      setNumeroManual('');
      setMensagemManual('');
      setImagemManualBase64(null);
    } catch (error: any) {
      showToast('error', error.message || 'Erro ao enviar mensagem.');
    } finally {
      setIsSendingManual(false);
    }
  };

  const handleSendBilling = async () => {
    setIsSendingBilling(true);
    setShowBillingModal(false);
    try {
      const { data: clientes, error } = await supabase.from('clientes').select('*');
      if (error) throw error;
      
      if (!clientes || clientes.length === 0) {
        showToast('error', 'Nenhum cliente encontrado no banco de dados para disparo.');
        return;
      }

      const res = await fetch(`${apiUrl}/send-billing`, {
        method: 'POST',
        headers: defaultHeaders,
        body: JSON.stringify({ 
          clientes,
          templateText,
          imagemBase64: templateImage
        })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Falha ao agendar disparos');
      
      showToast('success', `${clientes.length} disparos de cobrança iniciados com sucesso!`);
    } catch (error: any) {
      showToast('error', error.message || 'Erro ao iniciar cobranças.');
    } finally {
      setIsSendingBilling(false);
    }
  };

  // Preview dinâmico com dados de exemplo
  const getPreviewText = () => {
    return templateText
      .replace(/\[Nome\]|\{Nome\}|\[nome\]|\{nome\}/g, 'Empresa Lumaé')
      .replace(/\[Plano\]|\{Plano\}|\[plano\]|\{plano\}/g, 'Gold Premium 4K')
      .replace(/\[Valor\]|\{Valor\}|\[valor\]|\{valor\}/g, 'R$ 150,00')
      .replace(/\[Vencimento\]|\{Vencimento\}|\[vencimento\]|\{vencimento\}/g, '25/07/2026');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Padronizado do Sistema */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <MessageSquare className="w-6 h-6 text-emerald-500" />
            WhatsApp Gold
          </h2>
          <p className="text-xs text-slate-400 mt-1">Central de disparos e automações de mensagens de cobrança.</p>
        </div>
        
        {/* Status Indicator */}
        <div className={`px-3.5 py-1.5 rounded-lg border flex items-center gap-2 self-start sm:self-auto text-xs font-medium ${isConnected ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-rose-400 animate-pulse'}`} />
          <span>{isConnected ? 'Conectado' : 'Desconectado'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Conexão com QR Code */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-4 space-y-4"
        >
          <div className="bg-[#0f0f11] border border-white/5 p-6 rounded-2xl shadow-xl flex flex-col items-center justify-center min-h-[300px] text-center relative overflow-hidden">
            {!isConnected && !qrCode ? (
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-4">
                  <QrCode className="w-8 h-8 text-emerald-500" />
                </div>
                <h3 className="text-base font-semibold text-white mb-1">Conectar Dispositivo</h3>
                <p className="text-xs text-slate-400 mb-6 px-2">Escanear o QR Code para parear o WhatsApp e habilitar os disparos.</p>
                <button
                  onClick={handleConnect}
                  disabled={isLoading}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-xs font-medium transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
                  Gerar QR Code
                </button>
              </div>
            ) : !isConnected && qrCode ? (
              <div className="relative z-10 flex flex-col items-center">
                <h3 className="text-sm font-semibold text-white mb-3">Escaneie com seu Celular</h3>
                <div className="bg-white p-2.5 rounded-xl mb-3 shadow-xl">
                  <img src={qrCode} alt="WhatsApp QR Code" className="w-44 h-44" />
                </div>
                <p className="text-[11px] text-slate-400 max-w-[210px]">Abra o WhatsApp &gt; Aparelhos Conectados &gt; Conectar um Aparelho.</p>
              </div>
            ) : (
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center mb-3 ring-4 ring-emerald-500/10">
                  <CheckCircle className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 className="text-base font-semibold text-white mb-1">Sessão Ativa</h3>
                <p className="text-xs text-slate-400 mb-5">WhatsApp pronto para disparar mensagens e relatórios.</p>
                <button
                  onClick={handleDisconnect}
                  className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 px-5 py-2.5 rounded-xl text-xs font-medium transition-all flex items-center gap-2"
                >
                  <PowerOff className="w-4 h-4" />
                  Desconectar Sessão
                </button>
              </div>
            )}
          </div>

          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3.5">
            <p className="text-[11px] text-amber-500/90 leading-relaxed font-mono">
              <span className="font-bold">Nota:</span> A sessão permanece ativa no servidor. Você não precisa re-escanear o QRCode a cada acesso.
            </p>
          </div>
        </motion.div>

        {/* Áreas de Disparo */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Template de Cobrança PREMIUM */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-[#0f0f11] border border-white/5 p-6 rounded-2xl shadow-xl relative overflow-hidden"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 border-b border-white/5 pb-3">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  Template de Cobrança PREMIUM
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Configure o texto e banner visual enviados a cada cliente.</p>
              </div>
              <div className="bg-white/5 px-2.5 py-1 rounded-md border border-white/10 self-start sm:self-auto">
                <span className="text-xs font-mono text-slate-300">Base: <strong className="text-emerald-400">{clientesCount}</strong> clientes</span>
              </div>
            </div>

            {/* Variáveis pré-definidas */}
            <div className="mb-4">
              <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-2">
                Inserir Variáveis Dinâmicas
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => insertVariable('[Nome]')}
                  className="bg-white/5 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1"
                >
                  + [Nome]
                </button>
                <button
                  type="button"
                  onClick={() => insertVariable('[Plano]')}
                  className="bg-white/5 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1"
                >
                  + [Plano]
                </button>
                <button
                  type="button"
                  onClick={() => insertVariable('[Vencimento]')}
                  className="bg-white/5 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1"
                >
                  + [Vencimento]
                </button>
                <button
                  type="button"
                  onClick={() => insertVariable('[Valor]')}
                  className="bg-white/5 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1"
                >
                  + [Valor]
                </button>
              </div>
            </div>

            {/* Editor Textarea */}
            <div className="mb-4">
              <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                Texto do Mensagem (com formatação WhatsApp)
              </label>
              <textarea
                ref={textareaRef}
                value={templateText}
                onChange={e => setTemplateText(e.target.value)}
                rows={5}
                className="w-full bg-[#050505] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all font-sans leading-relaxed resize-y"
                placeholder="Monte seu template aqui..."
              />
            </div>

            {/* Banner/Upload de Imagem */}
            <div className="mb-5">
              <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                Imagem de Capa (Modo Caption)
              </label>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
              />

              {templateImage ? (
                <div className="relative group rounded-xl overflow-hidden border border-white/10 bg-[#050505] p-2 flex items-center gap-3">
                  <img 
                    src={templateImage} 
                    alt="Template Banner" 
                    className="w-20 h-20 object-cover rounded-lg border border-white/10" 
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white font-medium truncate">Banner de Cobrança Anexado</p>
                    <p className="text-[10px] text-emerald-400 mt-0.5">Enviado no topo no modo Caption</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTemplateImage(null)}
                    className="p-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 rounded-lg transition-all"
                    title="Remover imagem"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full bg-[#050505] hover:bg-white/[0.02] border border-dashed border-white/15 hover:border-emerald-500/40 rounded-xl p-3 flex items-center justify-center gap-2 text-xs text-slate-400 hover:text-white transition-all group"
                >
                  <UploadCloud className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                  <span>Upload de Imagem para o Disparo (opcional)</span>
                </button>
              )}
            </div>

            {/* Preview Box - WhatsApp Style */}
            <div className="mb-6 bg-[#080d08] border border-emerald-500/20 rounded-xl p-3.5">
              <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest block mb-2 font-bold">
                Pré-visualização do Envio Real:
              </span>
              <div className="bg-[#111b15] border border-emerald-500/10 p-3 rounded-lg text-xs text-slate-200 shadow-md">
                {templateImage && (
                  <img 
                    src={templateImage} 
                    alt="Preview Caption" 
                    className="w-full max-h-48 object-cover rounded-md mb-2 border border-white/10"
                  />
                )}
                <div className="whitespace-pre-wrap leading-relaxed">
                  {getPreviewText()}
                </div>
              </div>
            </div>

            {/* Botão de Disparo */}
            <button
              onClick={() => {
                if (!isConnected) {
                  showToast('error', 'WhatsApp não está conectado.');
                  return;
                }
                setShowBillingModal(true);
              }}
              disabled={!isConnected || isSendingBilling}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-xl font-bold text-xs tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
            >
              {isSendingBilling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {isSendingBilling ? 'Processando Disparos...' : 'Disparar Cobranças do Dia'}
            </button>
          </motion.div>

          {/* Modal de Confirmação de Disparo */}
          {showBillingModal && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-[#0f0f11] border border-white/10 p-6 rounded-2xl max-w-md w-full shadow-2xl relative"
              >
                <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-emerald-400" />
                    Confirmar Disparo de Cobrança
                  </h3>
                  <button 
                    onClick={() => setShowBillingModal(false)}
                    className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3 mb-6">
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Você está prestes a iniciar o envio automático do template de cobrança para toda a sua base de clientes cadastrados no banco de dados.
                  </p>
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">Total de clientes na base:</span>
                    <strong className="text-emerald-400 font-bold text-sm">{clientesCount}</strong>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    O sistema enviará as mensagens de forma cadenciada (com intervalo de segurança de 3s a 5s por cliente) para evitar bloqueios.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={() => setShowBillingModal(false)}
                    className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-white/5 transition-colors font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSendBilling}
                    disabled={isSendingBilling}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                  >
                    {isSendingBilling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Confirmar e Disparar
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {/* Disparo Avulso */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-[#0f0f11] border border-white/5 p-6 rounded-2xl shadow-xl"
          >
            <h3 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
              <Send className="w-4 h-4 text-slate-400" />
              Disparo Avulso
            </h3>
            <p className="text-xs text-slate-400 mb-4">Envie uma mensagem direta para qualquer número com formatação automática.</p>

            <form onSubmit={handleSendManual} className="space-y-4">
              <div>
                <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                  Telefone com DDD (captado automaticamente)
                </label>
                <div className="relative">
                  <Smartphone className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={numeroManual}
                    onChange={handlePhoneChange}
                    placeholder="(11) 99999-9999"
                    maxLength={15}
                    className="w-full bg-[#050505] border border-white/10 rounded-xl pl-10 pr-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                  Mensagem
                </label>
                <textarea
                  value={mensagemManual}
                  onChange={e => setMensagemManual(e.target.value)}
                  placeholder="Digite a mensagem direta..."
                  rows={3}
                  className="w-full bg-[#050505] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all resize-none"
                />
              </div>

              {/* Anexo de imagem opcional no avulso */}
              <div>
                <input
                  type="file"
                  ref={manualFileInputRef}
                  onChange={handleManualImageUpload}
                  accept="image/*"
                  className="hidden"
                />
                {imagemManualBase64 ? (
                  <div className="flex items-center justify-between bg-[#050505] border border-white/10 p-2 rounded-xl text-xs text-slate-300">
                    <span className="truncate max-w-[200px]">Imagem Anexada</span>
                    <button
                      type="button"
                      onClick={() => setImagemManualBase64(null)}
                      className="text-rose-400 hover:text-rose-300 p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => manualFileInputRef.current?.click()}
                    className="text-xs text-slate-400 hover:text-emerald-400 transition-colors flex items-center gap-1.5"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Anexar imagem ao disparo avulso</span>
                  </button>
                )}
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={!isConnected || isSendingManual}
                  className="bg-white/10 hover:bg-white/20 text-white px-6 py-2.5 rounded-xl text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSendingManual ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Enviar Agora
                </button>
              </div>
            </form>
          </motion.div>

        </div>
      </div>
    </div>
  );
}
