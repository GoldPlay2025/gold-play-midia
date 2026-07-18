import React, { useState, useEffect } from 'react';
import { Settings, Upload, Save, Loader2, Image as ImageIcon } from 'lucide-react';
import { motion } from 'motion/react';

export type SystemSettings = {
  systemName: string;
  logoUrl: string;
  iconUrl: string;
};

export const defaultSettings: SystemSettings = {
  systemName: 'GOLD PLAY',
  logoUrl: '/gpm.png',
  iconUrl: '/gpm.png',
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
    </motion.div>
  );
}
