import React, { useState, useEffect } from 'react';
import { Settings, Upload, Save, Loader2, Image as ImageIcon, Database, Link, AlertCircle, CheckCircle, FileCode, Copy, Check, Lock, Unlock, Mail, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { PillProgressButton } from './PillProgressButton';

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
  weatherCity?: string;
  pixKey?: string;
  pixReceiver?: string;
  cobrancaImageUrl?: string;
  adminPhone?: string;
  alertsEnabled?: boolean;
  smtpEmail?: string;
  smtpPassword?: string;
  smtpPort?: string;
  smtpHost?: string;
};

export const defaultSettings: SystemSettings = {
  systemName: 'GOLD PLAY',
  logoUrl: '/gpm.png',
  iconUrl: '/gpm.png',
  backendUrl: '',
  weatherCity: 'Paranavaí, Paraná',
  pixKey: '',
  pixReceiver: '',
  cobrancaImageUrl: '',
  adminPhone: '',
  alertsEnabled: false,
  smtpEmail: '',
  smtpPassword: '',
  smtpPort: '587',
  smtpHost: 'smtp.gmail.com',
};

interface PerfilSettingsProps {
  showToast: (type: 'success' | 'error', msg: string) => void;
  settings: SystemSettings;
  onSettingsChange: (newSettings: SystemSettings) => void;
}

export function PerfilSettings({ showToast, settings, onSettingsChange }: PerfilSettingsProps) {
  const [form, setForm] = useState<SystemSettings>(settings);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dbStatus, setDbStatus] = useState<'synced' | 'local' | 'error' | 'loading'>('local');
  const [showSqlInstruction, setShowSqlInstruction] = useState(false);
  const [canDisconnect, setCanDisconnect] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const fetchDbSettings = async () => {
    if (!isSupabaseConfigured) {
      setDbStatus('local');
      return;
    }
    setDbStatus('loading');
    try {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('*')
        .eq('id', 'sistema')
        .maybeSingle();

      if (error) {
        console.warn('configuracoes table fetch error:', error);
        if (error.code === 'PGRST116' || error.code === '42P01') {
          // Table doesn't exist
          setShowSqlInstruction(true);
        }
        setDbStatus('local');
        return;
      }

      if (data) {
        const localSaved = localStorage.getItem('gpm_system_settings');
        let localObj: any = {};
        if (localSaved) {
          try { localObj = JSON.parse(localSaved); } catch(e){}
        }
        const loadedSettings: SystemSettings = {
          systemName: data.system_name || localObj.systemName || 'GOLD PLAY',
          logoUrl: data.logo_url || localObj.logoUrl || '/gpm.png',
          iconUrl: data.icon_url || localObj.iconUrl || '/gpm.png',
          backendUrl: data.backend_url || localObj.backendUrl || '',
          weatherCity: data.weather_city || localObj.weatherCity || 'Paranavaí, Paraná',
          pixKey: data.pix_key !== undefined && data.pix_key !== null ? data.pix_key : (localObj.pixKey || ''),
          pixReceiver: data.pix_receiver !== undefined && data.pix_receiver !== null ? data.pix_receiver : (localObj.pixReceiver || ''),
          cobrancaImageUrl: data.cobranca_image_url || localObj.cobrancaImageUrl || '',
          adminPhone: data.admin_phone !== undefined && data.admin_phone !== null ? data.admin_phone : (localObj.adminPhone || ''),
          alertsEnabled: data.alerts_enabled !== undefined && data.alerts_enabled !== null ? data.alerts_enabled : (localObj.alertsEnabled || false),
          smtpEmail: data.smtp_email !== undefined && data.smtp_email !== null ? data.smtp_email : (localObj.smtpEmail || ''),
          smtpPassword: data.smtp_password !== undefined && data.smtp_password !== null ? data.smtp_password : (localObj.smtpPassword || ''),
          smtpPort: data.smtp_port || localObj.smtpPort || '587',
          smtpHost: data.smtp_host || localObj.smtpHost || 'smtp.gmail.com',
        };
        setForm(loadedSettings);
        onSettingsChange(loadedSettings);
        localStorage.setItem('gpm_system_settings', JSON.stringify(loadedSettings));
        setDbStatus('synced');
        setShowSqlInstruction(false);
      } else {
        setDbStatus('local');
      }
    } catch (err) {
      console.error('Error fetching settings from db:', err);
      setDbStatus('error');
    }
  };

  const [isTestingEmail, setIsTestingEmail] = useState(false);

  const handleTestEmail = async () => {
    if (!form.smtpEmail) {
      showToast('error', 'Por favor, informe o e-mail do remetente.');
      return;
    }
    if (!form.smtpPassword) {
      showToast('error', 'Por favor, informe a Senha de Aplicativo Google.');
      return;
    }

    setIsTestingEmail(true);
    try {
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: form.smtpEmail,
          subject: 'Teste de E-mail - GOLD PLAY Digital Signage',
          html: `<div style="font-family: Arial, sans-serif; padding: 20px; background: #0f0f11; color: #fff; borderRadius: 12px;">
            <h2 style="color: #f59e0b; margin-bottom: 10px;">GOLD PLAY - Teste de Envio SMTP</h2>
            <p style="color: #cbd5e1; font-size: 14px;">Parabéns! Sua integração com a API do Gmail/SMTP via Nodemailer foi configurada com sucesso.</p>
            <hr style="border-color: #334155; margin: 15px 0;" />
            <p style="font-size: 12px; color: #64748b;">E-mail remetente: <strong>${form.smtpEmail}</strong><br/>Data/Hora: ${new Date().toLocaleString('pt-BR')}</p>
          </div>`,
          smtpEmail: form.smtpEmail,
          smtpPassword: form.smtpPassword,
          smtpPort: form.smtpPort || '587',
          smtpHost: form.smtpHost || 'smtp.gmail.com'
        })
      });

      const responseText = await response.text();
      let resData: any = {};
      try {
        resData = JSON.parse(responseText);
      } catch {
        resData = { error: `Servidor indisponível ou erro (${response.status}): ${responseText.slice(0, 120)}` };
      }

      if (response.ok && resData.success) {
        showToast('success', `E-mail de teste enviado com sucesso para ${form.smtpEmail}! Verifique sua caixa de entrada.`);
      } else {
        showToast('error', resData.error || resData.message || 'Falha ao enviar e-mail de teste.');
      }
    } catch (err: any) {
      console.error('Erro ao testar envio de email:', err);
      showToast('error', 'Erro ao conectar ao servidor de e-mail: ' + (err?.message || String(err)));
    } finally {
      setIsTestingEmail(false);
    }
  };

  useEffect(() => {
    fetchDbSettings();
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'logoUrl' | 'iconUrl' | 'cobrancaImageUrl') => {
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // Save local backup first
      localStorage.setItem('gpm_system_settings', JSON.stringify(form));
      
      if (isSupabaseConfigured) {
        // Upsert to configuracoes table including pix_key and pix_receiver
        const { error } = await supabase
          .from('configuracoes')
          .upsert({
            id: 'sistema',
            system_name: form.systemName,
            logo_url: form.logoUrl,
            icon_url: form.iconUrl,
            backend_url: form.backendUrl || '',
            weather_city: form.weatherCity || 'Paranavaí, Paraná',
            pix_key: form.pixKey || '',
            pix_receiver: form.pixReceiver || '',
            cobranca_image_url: form.cobrancaImageUrl || '',
            admin_phone: form.adminPhone || '',
            alerts_enabled: form.alertsEnabled || false,
            smtp_email: form.smtpEmail || '',
            smtp_password: form.smtpPassword || '',
            smtp_port: form.smtpPort || '587',
            smtp_host: form.smtpHost || 'smtp.gmail.com',
          });

        if (error) {
          console.error('Error saving configuracoes to Supabase:', error);
          if (error.code === '42P01') {
            setShowSqlInstruction(true);
            throw new Error("A tabela 'configuracoes' não existe no Supabase. Execute o script SQL exibido no aviso acima.");
          }
          if (error.code === '42703' || error.message?.includes('pix_key') || error.message?.includes('admin_phone') || error.message?.includes('column')) {
            setShowSqlInstruction(true);
            throw new Error("Alguma coluna nova não existe na tabela 'configuracoes'. Execute o comando SQL no topo para atualizar a tabela no Supabase.");
          }
          throw error;
        }
        
        setDbStatus('synced');
        setShowSqlInstruction(false);
        showToast('success', 'Configurações e chave Pix salvas com sucesso no Supabase!');
      } else {
        showToast('success', 'Configurações e chave Pix salvas localmente.');
      }
      
      onSettingsChange(form);
    } catch (err: any) {
      console.error(err);
      showToast('error', err.message || 'Erro ao sincronizar configurações com o banco de dados.');
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Settings className="w-5 h-5 text-amber-500" />
            </div>
            <h2 className="text-3xl font-display font-light text-white tracking-tight">Perfil & Sistema</h2>
          </div>
          <p className="text-sm text-slate-500 font-light ml-0 sm:ml-13">Configure a identidade visual e as opções do workspace.</p>
        </div>

        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2 text-xs font-mono shrink-0 self-start sm:self-center">
          <Database className="w-4 h-4 text-amber-500" />
          <span className="text-slate-400">Banco:</span>
          {dbStatus === 'loading' && (
            <span className="text-amber-400 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Carregando...
            </span>
          )}
          {dbStatus === 'synced' && (
            <span className="text-emerald-400 flex items-center gap-1 font-semibold">
              <CheckCircle className="w-3.5 h-3.5" /> Sincronizado
            </span>
          )}
          {dbStatus === 'local' && (
            <span className="text-amber-500/80 flex items-center gap-1 font-semibold">
              <AlertCircle className="w-3.5 h-3.5" /> Apenas Local (Backup)
            </span>
          )}
          {dbStatus === 'error' && (
            <span className="text-red-400 flex items-center gap-1 font-semibold">
              <AlertCircle className="w-3.5 h-3.5" /> Erro de Conexão
            </span>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showSqlInstruction && isSupabaseConfigured && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-8 bg-amber-500/10 border border-amber-500/20 rounded-3xl p-6 space-y-4 overflow-hidden"
          >
            <div className="flex gap-3">
              <AlertCircle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-amber-200">Tabela de Configurações Pendente no Supabase</h4>
                <p className="text-xs text-amber-400/80 leading-relaxed">
                  Para que a Logo e o Ícone do sistema sejam carregados diretamente do banco de dados, você precisa criar a tabela <code className="font-mono bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-500/10 text-white">configuracoes</code> no seu Supabase.
                </p>
              </div>
            </div>
            <div className="bg-black/40 rounded-xl p-4 border border-white/5 space-y-3">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block">Código SQL para Executar</span>
              <pre className="text-[10px] font-mono text-slate-300 overflow-x-auto leading-relaxed select-all max-h-36 p-1">
{`CREATE TABLE IF NOT EXISTS configuracoes (
  id TEXT PRIMARY KEY DEFAULT 'sistema',
  system_name TEXT NOT NULL DEFAULT 'GOLD PLAY',
  logo_url TEXT,
  icon_url TEXT,
  backend_url TEXT,
  weather_city TEXT,
  pix_key TEXT,
  pix_receiver TEXT,
  cobranca_image_url TEXT,
  admin_phone TEXT,
  alerts_enabled BOOLEAN DEFAULT false,
  smtp_email TEXT,
  smtp_password TEXT,
  smtp_port TEXT DEFAULT '587',
  smtp_host TEXT DEFAULT 'smtp.gmail.com',
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, now()) NOT NULL
);

ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS pix_key TEXT;
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS pix_receiver TEXT;
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS cobranca_image_url TEXT;
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS admin_phone TEXT;
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS alerts_enabled BOOLEAN DEFAULT false;
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS smtp_email TEXT;
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS smtp_password TEXT;
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS smtp_port TEXT DEFAULT '587';
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS smtp_host TEXT DEFAULT 'smtp.gmail.com';

ALTER TABLE configuracoes DISABLE ROW LEVEL SECURITY;

INSERT INTO configuracoes (id, system_name, logo_url, icon_url, backend_url, weather_city)
VALUES ('sistema', 'GOLD PLAY', '/gpm.png', '/gpm.png', '', 'Paranavaí, Paraná')
ON CONFLICT (id) DO NOTHING;`}
              </pre>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(`CREATE TABLE IF NOT EXISTS configuracoes (
  id TEXT PRIMARY KEY DEFAULT 'sistema',
  system_name TEXT NOT NULL DEFAULT 'GOLD PLAY',
  logo_url TEXT,
  icon_url TEXT,
  backend_url TEXT,
  weather_city TEXT,
  pix_key TEXT,
  pix_receiver TEXT,
  cobranca_image_url TEXT,
  admin_phone TEXT,
  alerts_enabled BOOLEAN DEFAULT false,
  smtp_email TEXT,
  smtp_password TEXT,
  smtp_port TEXT DEFAULT '587',
  smtp_host TEXT DEFAULT 'smtp.gmail.com',
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, now()) NOT NULL
);

ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS pix_key TEXT;
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS pix_receiver TEXT;
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS cobranca_image_url TEXT;
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS admin_phone TEXT;
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS alerts_enabled BOOLEAN DEFAULT false;
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS smtp_email TEXT;
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS smtp_password TEXT;
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS smtp_port TEXT DEFAULT '587';
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS smtp_host TEXT DEFAULT 'smtp.gmail.com';

ALTER TABLE configuracoes DISABLE ROW LEVEL SECURITY;

INSERT INTO configuracoes (id, system_name, logo_url, icon_url, backend_url, weather_city)
VALUES ('sistema', 'GOLD PLAY', '/gpm.png', '/gpm.png', '', 'Paranavaí, Paraná')
ON CONFLICT (id) DO NOTHING;`);
                  showToast('success', 'Script de configurações copiado para a área de transferência!');
                }}
                className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <FileCode className="w-3.5 h-3.5" />
                Copiar Script SQL de Configurações
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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

        <div>
          <label className="block text-xs font-mono text-slate-500 uppercase tracking-widest mb-2">Cidade (Previsão do Tempo)</label>
          <input 
            type="text" 
            value={form.weatherCity}
            onChange={e => setForm({...form, weatherCity: e.target.value})}
            className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder-slate-700"
            placeholder="Ex: São Paulo"
          />
          <p className="text-[10px] text-slate-500 mt-2">Esta cidade será usada para exibir a previsão do tempo no painel.</p>
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

        <div className="pt-6 border-t border-white/5 space-y-8">
          <h3 className="text-lg font-bold text-white mb-4">Configurações de Pagamento / Cobrança</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <label className="block text-xs font-mono text-slate-500 uppercase tracking-widest mb-2">Chave Pix</label>
              <input 
                type="text" 
                value={form.pixKey || ''}
                onChange={e => setForm({...form, pixKey: e.target.value})}
                className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder-slate-700"
                placeholder="Ex: 12.345.678/0001-90"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-500 uppercase tracking-widest mb-2">Nome do Recebedor (Gestor)</label>
              <input 
                type="text" 
                value={form.pixReceiver || ''}
                onChange={e => setForm({...form, pixReceiver: e.target.value})}
                className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder-slate-700"
                placeholder="Ex: João da Silva"
              />
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-white/5 space-y-8">
          <h3 className="text-lg font-bold text-white mb-4">Notificações e Alertas (WhatsApp/SMS)</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <label className="block text-xs font-mono text-slate-500 uppercase tracking-widest mb-2">Celular do Administrador</label>
              <input 
                type="text" 
                value={form.adminPhone || ''}
                onChange={e => setForm({...form, adminPhone: e.target.value})}
                className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all placeholder-slate-700"
                placeholder="Ex: 5511999999999"
              />
              <p className="text-[10px] text-slate-500 mt-2">DDI + DDD + Número (ex: 55 para Brasil). Receberá alertas de telas offline.</p>
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-500 uppercase tracking-widest mb-2">Status de Alertas</label>
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className={`w-12 h-6 rounded-full transition-colors relative ${form.alertsEnabled ? 'bg-purple-500' : 'bg-[#26252a]'}`}>
                  <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${form.alertsEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                </div>
                <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
                  {form.alertsEnabled ? 'Alertas Ativados' : 'Alertas Desativados'}
                </span>
                <input 
                  type="checkbox" 
                  className="hidden"
                  checked={form.alertsEnabled || false}
                  onChange={e => setForm({...form, alertsEnabled: e.target.checked})}
                />
              </label>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-white/5 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Mail className="w-5 h-5 text-amber-500" />
                Configurações de E-mail (Gmail / SMTP)
              </h3>
              <p className="text-xs text-slate-500 mt-1">Configure o serviço de disparo de e-mails usando a Senha de Aplicativo do Google.</p>
            </div>
            <button
              type="button"
              onClick={handleTestEmail}
              disabled={isTestingEmail}
              className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer self-start sm:self-auto disabled:opacity-50"
            >
              {isTestingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {isTestingEmail ? 'Enviando...' : 'Testar Envio de E-mail'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-mono text-slate-500 uppercase tracking-widest mb-2">E-mail Remetente</label>
              <input 
                type="email" 
                value={form.smtpEmail || ''}
                onChange={e => setForm({...form, smtpEmail: e.target.value})}
                className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all placeholder-slate-700"
                placeholder="Ex: seu-email@gmail.com"
              />
              <p className="text-[10px] text-slate-500 mt-2">Endereço de e-mail do Gmail cadastrado para envio de relatórios e faturas.</p>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-500 uppercase tracking-widest mb-2">Senha de APP Google</label>
              <input 
                type="password" 
                value={form.smtpPassword || ''}
                onChange={e => setForm({...form, smtpPassword: e.target.value})}
                className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all placeholder-slate-700 font-mono"
                placeholder="Ex: djzu xbpk whit uzck"
              />
              <p className="text-[10px] text-slate-500 mt-2">Senha de Aplicativo gerada na sua Conta Google (16 caracteres).</p>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-500 uppercase tracking-widest mb-2">Porta SMTP</label>
              <input 
                type="text" 
                value={form.smtpPort || '587'}
                onChange={e => setForm({...form, smtpPort: e.target.value})}
                className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all placeholder-slate-700 font-mono"
                placeholder="587"
              />
              <p className="text-[10px] text-slate-500 mt-2">Porta padrão do Gmail: 587 (TLS/STARTTLS).</p>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-500 uppercase tracking-widest mb-2">URL / Host SMTP (Fixo)</label>
              <input 
                type="text" 
                value={form.smtpHost || 'smtp.gmail.com'}
                onChange={e => setForm({...form, smtpHost: e.target.value})}
                className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3.5 text-sm text-slate-300 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all font-mono"
                placeholder="smtp.gmail.com"
              />
              <p className="text-[10px] text-slate-500 mt-2">Servidor SMTP padrão do Google (smtp.gmail.com).</p>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-white/5 flex justify-end">
          <PillProgressButton
            type="submit"
            label="Salvar Configurações"
            loadingLabel="Salvando..."
            icon={<Save className="w-4 h-4" />}
            variant="amber"
            isLoading={isSubmitting}
            disabled={isSubmitting}
          />
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
              URL do Projeto (Protegida)
            </span>
            <div className="flex items-center gap-2 bg-[#050505] p-2.5 px-3 rounded-xl border border-white/5">
              <span className="font-mono text-xs text-slate-300 break-all select-all flex-1 font-semibold">
                {isSupabaseConfigured ? supabaseUrl : 'Nenhuma conexão ativa configurada'}
              </span>
              {isSupabaseConfigured && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(supabaseUrl);
                    setCopiedUrl(true);
                    showToast('success', 'URL do Projeto copiada com sucesso!');
                    setTimeout(() => setCopiedUrl(false), 2000);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-mono font-semibold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                  title="Copiar URL do Projeto"
                >
                  {copiedUrl ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-amber-500" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              )}
            </div>
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
          <div className="pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400 hover:text-slate-200 transition-colors select-none">
              <input
                type="checkbox"
                checked={canDisconnect}
                onChange={(e) => setCanDisconnect(e.target.checked)}
                className="w-4 h-4 rounded border-white/10 bg-[#050505] text-amber-500 focus:ring-amber-500/20 focus:ring-offset-0 cursor-pointer"
              />
              <span className="flex items-center gap-1.5 font-mono text-[11px]">
                {canDisconnect ? <Unlock className="w-3.5 h-3.5 text-amber-400" /> : <Lock className="w-3.5 h-3.5 text-slate-500" />}
                Desbloquear para desconectar
              </span>
            </label>

            <button
              type="button"
              disabled={!canDisconnect}
              onClick={() => {
                if (!canDisconnect) return;
                if (confirm('Deseja realmente desconectar este banco de dados? Você precisará configurar novamente para acessar os dados.')) {
                  clearSupabaseConfig();
                }
              }}
              className={`px-6 py-2.5 border rounded-xl text-xs font-medium transition-all flex items-center gap-2 ${
                canDisconnect
                  ? 'border-red-500/40 bg-red-950/40 hover:bg-red-900/60 text-red-200 shadow-lg shadow-red-950/30 cursor-pointer'
                  : 'border-white/5 bg-white/[0.02] text-slate-600 opacity-40 cursor-not-allowed select-none'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              Desconectar Banco de Dados
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
