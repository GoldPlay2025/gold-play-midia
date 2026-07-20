import React, { useState } from 'react';
import { motion } from 'motion/react';
import { RefreshCw, Power, Monitor, Loader2, Cloud, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchApi } from '../lib/api';

type CloudPanelProps = {
  telas: any[];
  showToast: (type: 'success' | 'error', message: string) => void;
  fetchDashboardData: () => void;
};

export function CloudPanel({ telas, showToast, fetchDashboardData }: CloudPanelProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deviceIdInput, setDeviceIdInput] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const handleCommand = async (telaId: string, fullyDeviceId: string, action: string) => {
    setLoadingAction(`${telaId}-${action}`);
    try {
      const response = await fetchApi('/api/fully/command', {
        method: 'POST',
        body: JSON.stringify({ deviceId: fullyDeviceId, action })
      });
      
      const responseText = await response.text();
      let data;
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (e) {
        throw new Error('O servidor retornou uma resposta inválida (não-JSON).');
      }
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao enviar comando.');
      }
      
      showToast('success', `Comando ${action === 'loadStartUrl' ? 'Recarregar' : 'Reiniciar'} enviado com sucesso!`);
    } catch (err: any) {
      console.error(err);
      showToast('error', err.message);
    } finally {
      setLoadingAction(null);
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

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pt-6">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
          <Cloud className="w-6 h-6 text-blue-500" />
        </div>
        <div>
          <h2 className="text-3xl font-display font-light text-white tracking-tight">Fully Cloud Manager</h2>
          <p className="text-sm text-slate-500 font-light mt-1">Gerencie os aparelhos TV Box remotamente via API do Fully Kiosk.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {telas.map((tela) => (
          <div key={tela.id} className="bg-[#0f0f11] border border-white/5 rounded-3xl p-6 relative overflow-hidden group hover:border-white/10 transition-colors flex flex-col">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${tela.status_online ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                  <Monitor className={`w-5 h-5 ${tela.status_online ? 'text-emerald-500' : 'text-red-500'}`} />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-white">{tela.nome_local}</h3>
                  <p className="text-xs text-slate-500">{tela.clientes?.nome_empresa || 'Sem Cliente'}</p>
                </div>
              </div>

              <a
                href="https://cloud.fully-kiosk.com/cloud/devices"
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir no Fully Cloud"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 hover:border-blue-500/30 rounded-xl text-xs font-semibold transition-all hover:scale-[1.02] active:scale-95 shrink-0"
              >
                <Cloud className="w-3.5 h-3.5 text-blue-400" />
                <span>Cloud</span>
              </a>
            </div>

            <div className="flex-1 space-y-4">
              <div className="bg-[#050505] p-4 rounded-2xl border border-white/5">
                <p className="text-[10px] uppercase font-mono tracking-widest text-slate-500 mb-2">Device ID (Fully Cloud)</p>
                
                {editingId === tela.id ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={deviceIdInput}
                      onChange={(e) => setDeviceIdInput(e.target.value)}
                      placeholder="Ex: 86b9e7b2-3c..."
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
                    />
                    <button 
                      onClick={() => handleSaveDeviceId(tela)}
                      disabled={savingId === tela.id}
                      className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-xl transition-colors disabled:opacity-50"
                    >
                      {savingId === tela.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    </button>
                    <button 
                      onClick={() => setEditingId(null)}
                      className="bg-white/5 hover:bg-white/10 text-white p-2 rounded-xl transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-mono text-slate-300 truncate pr-4">
                      {tela.fully_device_id ? tela.fully_device_id : <span className="text-slate-600 italic">Não configurado</span>}
                    </p>
                    <button 
                      onClick={() => {
                        setDeviceIdInput(tela.fully_device_id || '');
                        setEditingId(tela.id);
                      }}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      Editar
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/5 grid grid-cols-2 gap-3">
              <button
                onClick={() => handleCommand(tela.id, tela.fully_device_id!, 'loadStartUrl')}
                disabled={!tela.fully_device_id || loadingAction !== null}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  !tela.fully_device_id 
                    ? 'bg-white/5 text-slate-600 cursor-not-allowed' 
                    : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20'
                }`}
              >
                {loadingAction === `${tela.id}-loadStartUrl` ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Recarregar Mídia
              </button>
              
              <button
                onClick={() => handleCommand(tela.id, tela.fully_device_id!, 'restartApp')}
                disabled={!tela.fully_device_id || loadingAction !== null}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  !tela.fully_device_id 
                    ? 'bg-white/5 text-slate-600 cursor-not-allowed' 
                    : 'bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20'
                }`}
              >
                {loadingAction === `${tela.id}-restartApp` ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Power className="w-4 h-4" />
                )}
                Reiniciar TV
              </button>
            </div>
          </div>
        ))}
        
        {telas.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-500">
            <AlertCircle className="w-8 h-8 mx-auto mb-3 opacity-50" />
            <p>Nenhuma tela cadastrada no sistema.</p>
          </div>
        )}
      </div>
    </div>
  );
}
