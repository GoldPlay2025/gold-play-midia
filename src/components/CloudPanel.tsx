import React, { useState } from 'react';
import { motion } from 'motion/react';
import { RefreshCw, Power, Monitor, Loader2, Cloud, CheckCircle2, AlertCircle, Send, Globe, Play, Copy, Film, Check, ExternalLink, Tv, KeyRound } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchApi } from '../lib/api';
import { PillProgressButton } from './PillProgressButton';
import { FullyCloudLoginModal } from './FullyCloudLoginModal';
import { MediaThumbnail } from './MediaThumbnail';

type CloudPanelProps = {
  telas: any[];
  showToast: (type: 'success' | 'error', message: string) => void;
  fetchDashboardData: () => void;
};

export function CloudPanel({ telas, showToast, fetchDashboardData }: CloudPanelProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [actionProgress, setActionProgress] = useState<Record<string, number>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deviceIdInput, setDeviceIdInput] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [newUrls, setNewUrls] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showFullyLoginModal, setShowFullyLoginModal] = useState(false);

  // Persistence for screen active media in localStorage
  const [updatedMidias, setUpdatedMidias] = useState<Record<string, { id: string; titulo_video: string; url_storage: string }>>(() => {
    try {
      const saved = localStorage.getItem('fully_screen_media_cache');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const updateScreenMediaState = (telaId: string, mediaObj: { id: string; titulo_video: string; url_storage: string }) => {
    setUpdatedMidias(prev => {
      const next = { ...prev, [telaId]: mediaObj };
      try {
        localStorage.setItem('fully_screen_media_cache', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const syncNewMediaToDatabase = async (tela: any, newUrl: string) => {
    if (!tela) return;

    let cleanTitle = newUrl.split('/').pop()?.split('?')[0] || 'Mídia Atualizada';
    try {
      cleanTitle = decodeURIComponent(cleanTitle);
    } catch (e) {}
    if (!cleanTitle || cleanTitle.trim() === '' || cleanTitle.length > 60) {
      cleanTitle = 'Mídia Atualizada';
    }

    // Immediately update local state & localStorage so the UI updates instantly
    const newMediaItem = {
      id: 'active-' + Date.now(),
      titulo_video: cleanTitle,
      url_storage: newUrl
    };
    updateScreenMediaState(tela.id, newMediaItem);

    // Persist to Supabase in background
    try {
      const { data: existingMidias } = await supabase
        .from('midias')
        .select('*')
        .eq('url_storage', newUrl)
        .limit(1);

      let midiaId = '';
      let midiaTitle = cleanTitle;

      if (existingMidias && existingMidias.length > 0) {
        midiaId = existingMidias[0].id;
        midiaTitle = existingMidias[0].titulo_video || cleanTitle;

        await supabase.from('playlists').delete().eq('tela_id', tela.id);
        await supabase.from('playlists').insert([{
          tela_id: tela.id,
          midia_id: midiaId,
          ordem_exibicao: 0
        }]);

        updateScreenMediaState(tela.id, { id: midiaId, titulo_video: midiaTitle, url_storage: newUrl });

        if (fetchDashboardData) {
          fetchDashboardData();
        }
      }
    } catch (err) {
      console.warn('Sincronização no banco falhou, mantendo mídia em cache local:', err);
    }
  };

  const handleCommand = async (telaId: string, fullyDeviceId: string, action: string, extraData?: { newUrl?: string }) => {
    const actionKey = `${telaId}-${action}`;
    setLoadingAction(actionKey);
    setActionProgress(prev => ({ ...prev, [actionKey]: 12 }));

    // Timer para incrementar o progresso animado do botão
    const progressInterval = setInterval(() => {
      setActionProgress(prev => {
        const curr = prev[actionKey] || 12;
        if (curr >= 92) return prev;
        const next = curr + Math.floor(Math.random() * 12 + 6);
        return { ...prev, [actionKey]: Math.min(92, next) };
      });
    }, 150);

    try {
      const payload: any = { deviceId: fullyDeviceId, action };
      if (extraData?.newUrl) {
        payload.newUrl = extraData.newUrl;
      }

      const response = await fetch('/api/fully/command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      
      const responseText = await response.text();
      let data;
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (e) {
        throw new Error('O servidor retornou uma resposta inválida.');
      }
      
      if (!response.ok) {
        if (response.status === 401 || data?.requiresLogin) {
          setShowFullyLoginModal(true);
        }
        throw new Error(data.error || 'Erro ao enviar comando para a API.');
      }

      // Conclui o progresso com 100%
      clearInterval(progressInterval);
      setActionProgress(prev => ({ ...prev, [actionKey]: 100 }));
      await new Promise(r => setTimeout(r, 500));
      
      let successMessage = 'Comando enviado com sucesso!';
      if (action === 'loadStartUrl') successMessage = 'Recarregar Mídia enviado com sucesso!';
      if (action === 'restartApp') successMessage = 'Reiniciar TV enviado com sucesso!';
      if (action === 'change_url') successMessage = 'Nova URL enviada para o APP com sucesso!';

      showToast('success', successMessage);

      // Se for alteração de URL, sincroniza no banco e atualiza a miniatura
      if (action === 'change_url' && extraData?.newUrl) {
        const targetTela = telas.find(t => t.id === telaId);
        await syncNewMediaToDatabase(targetTela, extraData.newUrl);
      }
    } catch (err: any) {
      clearInterval(progressInterval);
      console.error(err);
      let msg = err.message || 'Erro ao enviar comando.';
      if (msg.includes('Sessão do Fully Cloud') || msg.includes('login') || msg.includes('Acesso negado')) {
        setShowFullyLoginModal(true);
      }
      if (msg === 'Failed to fetch' || err.name === 'TypeError') {
        msg = 'Falha de conexão com o servidor da aplicação. Verifique a chave FULLY_API_TOKEN ou se a API do Fully Cloud está acessível.';
      }
      showToast('error', msg);
    } finally {
      clearInterval(progressInterval);
      setLoadingAction(null);
      setActionProgress(prev => {
        const next = { ...prev };
        delete next[actionKey];
        return next;
      });
    }
  };

  const handleSaveDeviceId = async (tela: any) => {
    setSavingId(tela.id);
    try {
      const { error } = await supabase
        .from('telas')
        .update({ fully_device_id: deviceIdInput })
        .eq('id', tela.id);
        
      if (error) throw error;
      
      showToast('success', 'Device ID salvo com sucesso.');
      setEditingId(null);
      fetchDashboardData();
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Erro ao salvar Device ID: ' + err.message);
    } finally {
      setSavingId(null);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    showToast('success', `URL da ${label} copiada para a área de transferência!`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pt-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-blue-500/10 flex items-center justify-center border border-amber-500/20 shadow-lg shadow-amber-500/5">
            <Cloud className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h2 className="text-3xl font-display font-light text-white tracking-tight">Fully Cloud Manager</h2>
            <p className="text-sm text-slate-400 font-light mt-1">Gerencie e envie mídias diretamente para cada tela cadastrada.</p>
          </div>
        </div>

        <button
          onClick={() => setShowFullyLoginModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 hover:border-amber-500/30 rounded-2xl text-xs font-semibold transition-all shrink-0 active:scale-95 shadow-lg shadow-amber-500/5"
        >
          <KeyRound className="w-4 h-4 text-amber-400" />
          <span>Login Fully Cloud</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {telas.map((tela) => {
          // Identifica a mídia ativa cadastrada especificamente para esta tela (ou a mídia recém-atualizada pelo Fully)
          const playlists = tela.playlists || [];
          const dbMidiaRaw = playlists.length > 0 ? playlists[0]?.midias : null;
          const dbMidia = Array.isArray(dbMidiaRaw) ? dbMidiaRaw[0] : dbMidiaRaw;
          const activeMidia = updatedMidias[tela.id] || dbMidia;
          const telaPlayerUrl = `${window.location.origin}/player/${tela.id}`;
          const currentTargetUrl = activeMidia?.url_storage || telaPlayerUrl;

          return (
            <div key={tela.id} className="bg-[#0f0f11] border border-white/5 rounded-3xl p-6 relative overflow-hidden group hover:border-white/10 transition-all flex flex-col shadow-xl">
              {/* Header do Card da Tela */}
              <div className="flex items-start justify-between mb-5 pb-4 border-b border-white/5">
                <div className="flex items-center gap-3.5 min-w-0 pr-2">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0 ${tela.status_online ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                    <Monitor className={`w-6 h-6 ${tela.status_online ? 'text-emerald-500' : 'text-red-400'}`} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-white truncate">{tela.nome_local}</h3>
                    <p className="text-xs text-slate-400 truncate">{tela.clientes?.nome_empresa || 'Sem Cliente'}</p>
                  </div>
                </div>

                <a
                  href="https://cloud.fully-kiosk.com/cloud/devices"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Abrir no Fully Cloud"
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 hover:border-blue-500/30 rounded-xl text-xs font-semibold transition-all shrink-0"
                >
                  <Cloud className="w-4 h-4 text-blue-400" />
                  <span>Cloud</span>
                </a>
              </div>

              <div className="flex-1 space-y-4">
                {/* Exibição da Mídia Atual Veiculada NESTA Tela */}
                <div className="bg-[#050505] p-4 rounded-2xl border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400 font-semibold flex items-center gap-1.5">
                      <Tv className="w-3.5 h-3.5 text-amber-400" /> Mídia da Tela
                    </span>
                    <span className="text-[9px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                      Ativa
                    </span>
                  </div>

                  {activeMidia ? (
                    <div className="flex items-center gap-4 p-3 bg-white/[0.02] rounded-2xl border border-white/5">
                      {/* Miniatura Aumentada e Arredondada */}
                      <MediaThumbnail
                        url={activeMidia.url_storage}
                        title={activeMidia.titulo_video}
                        className="w-20 h-20"
                      />

                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="text-sm font-semibold text-white truncate" title={activeMidia.titulo_video}>
                          {activeMidia.titulo_video}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate font-mono">
                          {activeMidia.url_storage}
                        </p>
                        <div className="flex items-center gap-2 pt-1 flex-wrap">
                          <button
                            onClick={() => {
                              setNewUrls({ ...newUrls, [tela.id]: activeMidia.url_storage });
                              showToast('success', `URL da mídia "${activeMidia.titulo_video}" inserida!`);
                            }}
                            className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1 rounded-lg border border-amber-500/20 shrink-0"
                          >
                            <Send className="w-3 h-3" /> Inserir já
                          </button>
                          <button
                            onClick={() => copyToClipboard(activeMidia.url_storage, tela.nome_local)}
                            className="text-[11px] font-medium text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 shrink-0 border border-white/5"
                          >
                            {copiedId === activeMidia.url_storage ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            Copiar
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4 p-3 bg-white/[0.02] rounded-2xl border border-white/5">
                      <div className="w-20 h-20 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                        <Monitor className="w-8 h-8" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="text-xs font-semibold text-slate-200 truncate">Player Oficial ({tela.nome_local})</p>
                        <p className="text-[11px] text-slate-500 truncate font-mono">{telaPlayerUrl}</p>
                        <div className="pt-1">
                          <button
                            onClick={() => {
                              setNewUrls({ ...newUrls, [tela.id]: telaPlayerUrl });
                              showToast('success', `URL do Player de ${tela.nome_local} inserida!`);
                            }}
                            className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1 rounded-lg border border-amber-500/20"
                          >
                            <Send className="w-3 h-3" /> Inserir já
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Configuração do Device ID */}
                <div className="bg-[#050505] p-3.5 rounded-2xl border border-white/5">
                  <p className="text-[10px] uppercase font-mono tracking-widest text-slate-400 font-semibold mb-2">Device ID (Fully Cloud)</p>
                  
                  {editingId === tela.id ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={deviceIdInput}
                        onChange={(e) => setDeviceIdInput(e.target.value)}
                        placeholder="Ex: 86b9e7b2-3c..."
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500/50"
                      />
                      <button 
                        onClick={() => handleSaveDeviceId(tela)}
                        disabled={savingId === tela.id}
                        className="bg-amber-500 hover:bg-amber-600 text-black px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
                      >
                        {savingId === tela.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      </button>
                      <button 
                        onClick={() => setEditingId(null)}
                        className="bg-white/5 hover:bg-white/10 text-white px-2.5 py-1.5 rounded-xl text-xs transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-mono text-slate-300 truncate pr-4">
                        {tela.fully_device_id ? tela.fully_device_id : <span className="text-slate-600 italic">Não configurado</span>}
                      </p>
                      <button 
                        onClick={() => {
                          setDeviceIdInput(tela.fully_device_id || '');
                          setEditingId(tela.id);
                        }}
                        className="text-xs text-amber-400 hover:text-amber-300 transition-colors font-medium shrink-0"
                      >
                        Editar
                      </button>
                    </div>
                  )}
                </div>

                {/* Atualizar Mídia no APP */}
                <div className="bg-[#050505] p-3.5 rounded-2xl border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] uppercase font-mono tracking-widest text-slate-400 font-semibold">
                      Atualizar Mídia no APP
                    </label>
                    {newUrls[tela.id] && (
                      <button
                        onClick={() => setNewUrls({ ...newUrls, [tela.id]: '' })}
                        className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                  
                  <div className="space-y-2.5">
                    <input
                      type="url"
                      placeholder={`Cole a URL para a tela ${tela.nome_local}...`}
                      value={newUrls[tela.id] || ''}
                      onChange={(e) => setNewUrls({ ...newUrls, [tela.id]: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all font-mono"
                    />
                    <PillProgressButton
                      label="Enviar URL"
                      loadingLabel="Enviando URL..."
                      icon={<Send className="w-3.5 h-3.5" />}
                      variant="amber"
                      isLoading={loadingAction === `${tela.id}-change_url`}
                      progress={actionProgress[`${tela.id}-change_url`]}
                      onClick={() => {
                        const url = newUrls[tela.id];
                        if (!url || !url.trim()) {
                          showToast('error', 'Digite ou insira uma URL válida antes de enviar.');
                          return;
                        }
                        handleCommand(tela.id, tela.fully_device_id!, 'change_url', { newUrl: url.trim() });
                      }}
                      disabled={!tela.fully_device_id || !newUrls[tela.id]?.trim() || loadingAction !== null}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>

              {/* Botões Inferiores de Ação com Layout Elegante */}
              <div className="mt-6 pt-4 border-t border-white/5 grid grid-cols-2 gap-3">
                <PillProgressButton
                  label="Recarregar Mídia"
                  loadingLabel="Recarregando..."
                  icon={<RefreshCw className="w-4 h-4" />}
                  variant="emerald"
                  isLoading={loadingAction === `${tela.id}-loadStartUrl`}
                  progress={actionProgress[`${tela.id}-loadStartUrl`]}
                  onClick={() => handleCommand(tela.id, tela.fully_device_id!, 'loadStartUrl')}
                  disabled={!tela.fully_device_id || loadingAction !== null}
                  className="w-full"
                />
                
                <PillProgressButton
                  label="Reiniciar TV"
                  loadingLabel="Reiniciando..."
                  icon={<Power className="w-4 h-4" />}
                  variant="rose"
                  isLoading={loadingAction === `${tela.id}-restartApp`}
                  progress={actionProgress[`${tela.id}-restartApp`]}
                  onClick={() => handleCommand(tela.id, tela.fully_device_id!, 'restartApp')}
                  disabled={!tela.fully_device_id || loadingAction !== null}
                  className="w-full"
                />
              </div>
            </div>
          );
        })}
        
        {telas.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-500">
            <AlertCircle className="w-8 h-8 mx-auto mb-3 opacity-50" />
            <p>Nenhuma tela cadastrada no sistema.</p>
          </div>
        )}
      </div>

      <FullyCloudLoginModal
        isOpen={showFullyLoginModal}
        onClose={() => setShowFullyLoginModal(false)}
        onSuccess={() => {
          showToast('success', 'Sessão revalidada! Você já pode enviar comandos para as telas.');
        }}
      />
    </div>
  );
}
