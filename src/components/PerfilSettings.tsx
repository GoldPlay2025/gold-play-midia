import React, { useState, useEffect } from 'react';
import { Settings, Upload, Save, Loader2, Image as ImageIcon, Database, Link, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { isSupabaseConfigured } from '../lib/supabase';

const envUrl = import.meta.env.VITE_SUPABASE_URL;
const localUrl = typeof window !== 'undefined' ? localStorage.getItem('gpm_supabase_url') : null;
const supabaseUrl = envUrl && envUrl !== 'YOUR_SUPABASE_URL' ? envUrl : (localUrl || '');

function clearSupabaseConfig() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('gpm_supabase_url');
    localStorage.removeItem('gpm_supabase_anon_key');
    window.location.reload();
  }
}

export type SystemSettings = {
  systemName: string;
  logoUrl: string;
  iconUrl: string;
  backendUrl?: string;
};

export const defaultSettings: SystemSettings = {
  systemName: 'GOLD PLAY',
  logoUrl: '/gpm.png',
  iconUrl: '/gpm.png',
  backendUrl: '',
};

interface PerfilSettingsProps {
  showToast: (type: 'success' | 'error', msg: string) => void;
  settings: SystemSettings;
  onSettingsChange: (newSettings: SystemSettings) => void;
}

export function PerfilSettings({ showToast, settings, onSettingsChange }: PerfilSettingsProps) {
  const [form, setForm] = useState<SystemSettings>(settings);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'logoUrl' | 'iconUrl') => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 2 * 1024 * 1024) { // 2MB limit
      showToast('error', 'A imagem deve ter no máximo 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64String = event.target?.result as string;
      setForm(prev => ({ ...prev, [field]: base64String }));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      localStorage.setItem('gpm_system_settings', JSON.stringify(form));
      onSettingsChange(form);
      showToast('success', 'Configurações de perfil atualizadas com sucesso.');
    } catch (err) {
      console.error(err);
      showToast('error', 'Erro ao salvar as configurações.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="max-w-2xl mx-auto"
    >
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Settings className="w-5 h-5 text-amber-500" />
          </div>
          <h2 className="text-3xl font-display font-light text-white tracking-tight">Perfil & Sistema</h2>
        </div>
        <p className="text-sm text-slate-500 font-light ml-13">Configure a identidade visual e as opções do workspace.</p>
      </div>

      <form onSubmit={handleSave} className="bg-[#0f0f11] border border-white/5 p-8 rounded-3xl shadow-2xl shadow-black/50 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-mono text-slate-500 uppercase tracking-widest mb-2">Nome do Sistema</label>
            <input 
              type="text" 
              value={form.systemName}
              onChange={e => setForm({...form, systemName: e.target.value})}
              className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all placeholder-slate-700"
              placeholder="Ex: GOLD PLAY"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Link className="w-3.5 h-3.5 text-amber-500" />
              URL do Servidor Backend (WhatsApp / APIs)
            </label>
            <input 
              type="url" 
              value={form.backendUrl || ''}
              onChange={e => setForm({...form, backendUrl: e.target.value})}
              className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all font-mono placeholder-slate-700"
              placeholder="Ex: https://meu-app-no-cloud-run.run.app"
            />
          </div>
        </div>

        {/* Informative Help Text for Backend URL */}
        <div className="bg-[#050505] border border-white/5 rounded-2xl p-4 text-xs text-slate-400 space-y-1">
          <p className="font-semibold text-white flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            Por que configurar o Servidor Backend?
          </p>
          <p className="leading-relaxed">
            Se você hospedar o painel na <span className="text-white font-medium">Vercel</span>, as conexões do WhatsApp e os comandos de tela não funcionarão diretamente devido às limitações serverless da Vercel. 
            Colando aqui a <span className="text-white font-medium">Shared App URL</span> do seu container persistente no AI Studio (ou de outra hospedagem Node.js), a Vercel enviará todas as requisições do WhatsApp e comandos para lá automaticamente, mantendo o sistema 100% ativo!
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <label className="block text-xs font-mono text-slate-500 uppercase tracking-widest mb-4">Logo Principal (Login)</label>
            <div className="flex flex-col items-center gap-4">
              <div className="w-48 h-48 bg-[#050505] border border-white/10 rounded-2xl flex items-center justify-center overflow-hidden relative group">
                {form.logoUrl ? (
                  <img src={form.logoUrl} alt="Logo Preview" className="w-full h-full object-contain p-4" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-white/20" />
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                  <label className="cursor-pointer flex flex-col items-center gap-2 text-white hover:text-amber-500 transition-colors">
                    <Upload className="w-6 h-6" />
                    <span className="text-xs font-medium">Trocar Logo</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => handleImageUpload(e, 'logoUrl')}
                    />
                  </label>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 text-center">Tamanho recomendado: 300x300px.<br/>PNG com fundo transparente.</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-500 uppercase tracking-widest mb-4">Ícone (Sidebar / Favicon)</label>
            <div className="flex flex-col items-center gap-4">
              <div className="w-24 h-24 bg-[#050505] border border-white/10 rounded-2xl flex items-center justify-center overflow-hidden relative group">
                {form.iconUrl ? (
                  <img src={form.iconUrl} alt="Icon Preview" className="w-full h-full object-contain p-2" />
                ) : (
                  <ImageIcon className="w-6 h-6 text-white/20" />
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                  <label className="cursor-pointer flex flex-col items-center gap-1 text-white hover:text-amber-500 transition-colors">
                    <Upload className="w-4 h-4" />
                    <span className="text-[10px] font-medium">Trocar</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => handleImageUpload(e, 'iconUrl')}
                    />
                  </label>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 text-center">Tamanho recomendado: 150x150px.<br/>Formato quadrado (1:1).</p>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-white/5 flex justify-end">
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="bg-gradient-to-r from-amber-600 to-amber-500 text-black hover:from-amber-500 hover:to-amber-400 px-8 py-3 rounded-xl text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.2)] hover:shadow-[0_0_30px_rgba(245,158,11,0.4)]"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar Configurações
          </button>
        </div>
      </form>

      {/* Supabase Connection Details */}
      <div className="mt-8 bg-[#0f0f11] border border-white/5 p-8 rounded-3xl shadow-2xl shadow-black/50">
        <div className="flex items-start justify-between pb-6 border-b border-white/5">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Banco de Dados Supabase</h3>
              <p className="text-xs text-slate-500 mt-1">Status e detalhes da conexão ativa do Digital Signage.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`relative flex h-2.5 w-2.5`}>
              {isSupabaseConfigured && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isSupabaseConfigured ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
            </span>
            <span className="text-xs font-mono text-slate-400 uppercase">
              {isSupabaseConfigured ? 'Conectado' : 'Desconectado'}
            </span>
          </div>
        </div>

        <div className="py-6 space-y-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <Link className="w-3.5 h-3.5 text-slate-400" />
              URL do Projeto
            </span>
            <span className="font-mono text-xs text-slate-300 bg-[#050505] p-3 rounded-xl border border-white/5 break-all select-all">
              {isSupabaseConfigured ? supabaseUrl : 'Nenhuma conexão ativa configurada'}
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <Settings className="w-3.5 h-3.5 text-slate-400" />
              Origem da Configuração
            </span>
            <p className="text-xs text-slate-400 leading-relaxed">
              {import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_URL !== 'YOUR_SUPABASE_URL' ? (
                <span>Configurado através de <span className="text-white font-medium">Variáveis de Ambiente (.env / Vercel)</span>.</span>
              ) : isSupabaseConfigured ? (
                <span>Configurado localmente no navegador através do <span className="text-amber-500 font-medium">Assistente de Conexão</span>.</span>
              ) : (
                <span>Nenhum provedor de dados configurado no sistema.</span>
              )}
            </p>
          </div>
        </div>

        {isSupabaseConfigured && (
          <div className="pt-6 border-t border-white/5 flex justify-end">
            <button
              type="button"
              onClick={() => {
                if (confirm('Deseja realmente desconectar este banco de dados? Você precisará configurar novamente para acessar os dados.')) {
                  clearSupabaseConfig();
                }
              }}
              className="px-6 py-2.5 border border-red-500/20 bg-red-950/20 hover:bg-red-950/40 text-red-200 hover:border-red-500/40 rounded-xl text-xs font-medium transition-all flex items-center gap-2"
            >
              Desconectar Banco de Dados
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
