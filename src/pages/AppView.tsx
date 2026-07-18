import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Monitor, Loader2, Link2, CheckCircle2, AlertTriangle, ArrowRight, HelpCircle, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';

type Tela = {
  id: string;
  nome_local: string;
  identificador_unico: string;
  clientes?: { nome_empresa: string };
};

export default function AppView() {
  const navigate = useNavigate();
  const [telas, setTelas] = useState<Tela[]>([]);
  const [deviceIdInput, setDeviceIdInput] = useState('');
  const [selectedScreenId, setSelectedScreenId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isPairing, setIsPairing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Check if already paired on load
  useEffect(() => {
    const savedScreenId = localStorage.getItem('gpm_paired_screen_id');
    if (savedScreenId) {
      navigate(`/player/${savedScreenId}`);
    } else {
      fetchTelas();
    }
  }, [navigate]);

  const fetchTelas = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('telas')
        .select(`
          id,
          nome_local,
          identificador_unico,
          clientes (
            nome_empresa
          )
        `)
        .order('nome_local', { ascending: true });

      if (error) throw error;
      setTelas(data as any[] || []);
    } catch (err: any) {
      console.error('Erro ao buscar telas para emparelhamento:', err);
      setError('Não foi possível conectar ao banco de dados. Verifique a conexão.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePairWithId = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceIdInput.trim()) return;

    setIsPairing(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('telas')
        .select('id, nome_local')
        .eq('identificador_unico', deviceIdInput.trim().toUpperCase())
        .single();

      if (error || !data) {
        throw new Error('ID de Dispositivo não encontrado. Verifique no painel de administração.');
      }

      localStorage.setItem('gpm_paired_screen_id', data.id);
      setSuccessMsg(`Conectado com sucesso a: ${data.nome_local}!`);
      
      setTimeout(() => {
        navigate(`/player/${data.id}`);
      }, 1500);

    } catch (err: any) {
      setError(err.message || 'Erro ao emparelhar dispositivo.');
    } finally {
      setIsPairing(false);
    }
  };

  const handlePairWithDropdown = () => {
    if (!selectedScreenId) return;

    const selectedTela = telas.find(t => t.id === selectedScreenId);
    if (!selectedTela) return;

    localStorage.setItem('gpm_paired_screen_id', selectedScreenId);
    setSuccessMsg(`Conectado com sucesso a: ${selectedTela.nome_local}!`);

    setTimeout(() => {
      navigate(`/player/${selectedScreenId}`);
    }, 1500);
  };

  if (isLoading) {
    return (
      <div className="w-screen h-screen bg-black flex flex-col items-center justify-center text-slate-500">
        <Loader2 className="w-12 h-12 text-amber-500 animate-spin mb-4" />
        <p className="font-mono text-xs uppercase tracking-widest">Iniciando ponte de conexão...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-slate-300 flex flex-col justify-between p-6 md:p-12 selection:bg-amber-500 selection:text-black">
      {/* Background elements */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/5 via-black/0 to-black/0 pointer-events-none" />

      {/* Header */}
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#0f0f11] border border-white/10 rounded-xl flex items-center justify-center shadow-lg">
            <Monitor className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h1 className="text-lg font-display font-medium text-white tracking-tight">GPM Player Link</h1>
            <p className="text-[10px] font-mono text-amber-500 uppercase tracking-widest">Ponte de Exibição BoxTV</p>
          </div>
        </div>
        <button 
          onClick={fetchTelas}
          className="p-2 bg-[#0f0f11] border border-white/5 rounded-lg hover:border-amber-500/30 transition-all text-slate-400 hover:text-white"
          title="Recarregar"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto w-full my-auto py-12 relative z-10 grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-center">
        {/* Left Column: Form / Pairing options */}
        <div className="md:col-span-7 space-y-6">
          <div className="space-y-2">
            <h2 className="text-3xl font-display font-light text-white tracking-tight">Conecte sua TV Box</h2>
            <p className="text-sm text-slate-500 font-light max-w-md">Emparelhe esta TV Box com uma das telas configuradas no painel administrativo para veicular as mídias.</p>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-4 py-3 rounded-xl flex items-center gap-2.5"
            >
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          {successMsg && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="bg-green-500/10 border border-green-500/20 text-green-400 text-xs px-4 py-3 rounded-xl flex items-center gap-2.5"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </motion.div>
          )}

          {/* Form Option 1: Pairing code */}
          <div className="bg-[#0f0f11] border border-white/5 p-6 rounded-3xl shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-3xl rounded-full" />
            <h3 className="text-xs font-mono text-amber-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
              Opção A: Por ID de Dispositivo
            </h3>
            
            <form onSubmit={handlePairWithId} className="flex gap-2">
              <input 
                type="text"
                value={deviceIdInput}
                onChange={e => setDeviceIdInput(e.target.value)}
                placeholder="Ex: A39F2"
                className="flex-1 bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 uppercase font-mono tracking-widest placeholder:normal-case placeholder:tracking-normal placeholder:slate-700"
                required
                disabled={isPairing}
              />
              <button
                type="submit"
                disabled={isPairing}
                className="bg-gradient-to-r from-amber-600 to-amber-500 text-black hover:from-amber-500 hover:to-amber-400 px-6 rounded-xl text-xs font-medium transition-all shadow-[0_0_15px_rgba(245,158,11,0.15)] flex items-center justify-center gap-2 shrink-0"
              >
                {isPairing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                Emparelhar
              </button>
            </form>
            <p className="text-[10px] text-slate-500 font-mono mt-2 uppercase">Digite o ID de 6 dígitos gerado no cadastro da Tela.</p>
          </div>

          {/* Separator */}
          <div className="flex items-center gap-4 text-xs font-mono text-slate-700">
            <div className="flex-1 h-[1px] bg-white/5" />
            <span>OU</span>
            <div className="flex-1 h-[1px] bg-white/5" />
          </div>

          {/* Form Option 2: Choose from list */}
          <div className="bg-[#0f0f11] border border-white/5 p-6 rounded-3xl shadow-2xl relative overflow-hidden group">
            <h3 className="text-xs font-mono text-amber-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
              Opção B: Selecionar da Lista
            </h3>

            <div className="space-y-4">
              <div className="relative">
                <select 
                  value={selectedScreenId}
                  onChange={e => setSelectedScreenId(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 appearance-none cursor-pointer"
                >
                  <option value="" className="text-slate-500">Selecione uma tela de exibição...</option>
                  {telas.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.nome_local} ({t.clientes?.nome_empresa || 'Sem Cliente'})
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                  <ArrowRight className="w-4 h-4 rotate-90" />
                </div>
              </div>

              <button
                type="button"
                onClick={handlePairWithDropdown}
                disabled={!selectedScreenId || isPairing}
                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white py-3 rounded-xl text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                Conectar Tela Selecionada
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Tips & Fully Kiosk recommendations */}
        <div className="md:col-span-5 space-y-6 bg-[#0f0f11]/40 border border-white/5 p-8 rounded-3xl backdrop-blur-sm">
          <div className="flex items-center gap-2 text-white">
            <HelpCircle className="w-5 h-5 text-amber-500" />
            <h4 className="text-sm font-semibold">Configuração Fully Kiosk</h4>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed font-light">
            Para garantir que as mídias sejam veiculadas sem interrupções em sua BoxTV, configure o app <strong className="text-slate-300">Fully Kiosk Browser</strong> com as seguintes opções recomendadas:
          </p>

          <ul className="space-y-4 text-xs font-light text-slate-400">
            <li className="flex gap-3">
              <div className="w-5 h-5 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 text-[10px] font-mono shrink-0 font-bold">1</div>
              <div>
                <p className="font-medium text-white mb-0.5">Start URL</p>
                <p className="text-[11px] text-slate-500">Insira a URL desta página como a inicial. O sistema irá memorizar a tela automaticamente.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <div className="w-5 h-5 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 text-[10px] font-mono shrink-0 font-bold">2</div>
              <div>
                <p className="font-medium text-white mb-0.5">Autoplay habilitado</p>
                <p className="text-[11px] text-slate-500">Ative <code className="font-mono bg-black/40 text-amber-500 px-1 py-0.5 rounded text-[10px]">Play Media on Touch/Start</code> para permitir reprodução de vídeo sem bloqueios.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <div className="w-5 h-5 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 text-[10px] font-mono shrink-0 font-bold">3</div>
              <div>
                <p className="font-medium text-white mb-0.5">Modo Kiosk & Tela Cheia</p>
                <p className="text-[11px] text-slate-500">Habilite para ocultar barras de navegação do Android e manter o foco exclusivamente na transmissão.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <div className="w-5 h-5 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 text-[10px] font-mono shrink-0 font-bold">4</div>
              <div>
                <p className="font-medium text-white mb-0.5">Prevenir Suspensão</p>
                <p className="text-[11px] text-slate-500">Mantenha a tela ligada permanentemente configurando <code className="font-mono bg-black/40 text-amber-500 px-1 py-0.5 rounded text-[10px]">Keep Screen On</code> nas opções de energia.</p>
              </div>
            </li>
          </ul>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto w-full border-t border-white/5 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-600 relative z-10">
        <p>© 2026 GPM Mídia. Todos os direitos reservados.</p>
        <p>Desenvolvido para BoxTV & Smart Signage</p>
      </footer>
    </div>
  );
}
