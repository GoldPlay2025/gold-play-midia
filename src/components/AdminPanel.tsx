import React, { useState, useEffect, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ClientesList } from '../components/ClientesList';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TelasList } from "../components/TelasList";
import { PerfilSettings, SystemSettings, defaultSettings } from "../components/PerfilSettings";
import { Sidebar } from "../components/Sidebar";
import { CloudPanel } from "../components/CloudPanel";
import { WhatsappPanel } from "../components/WhatsappPanel";
import { fetchApi } from '../lib/api';
import { 
  LayoutDashboard,
  Users, 
  Monitor, 
  Plus, 
  Search, 
  Bell, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Activity,
  CheckCircle2,
  XCircle,
  Loader2,
  Lock,
  ArrowRight,
  Film,
  UploadCloud,
  FileVideo,
  Settings,
  Database,
  AlertTriangle,
  Key,
  Globe,
  Copy,
  Check,
  Trash2,
  Edit,
  Play,
  X,
  Tv,
  Eye,
  Video,
  ExternalLink,
  Menu,
  MessageSquare,
  Smartphone,
  Link2,
  Cloud
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';



const envUrl = import.meta.env.VITE_SUPABASE_URL;
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const localUrl = typeof window !== 'undefined' ? localStorage.getItem('gpm_supabase_url') : null;
const localKey = typeof window !== 'undefined' ? localStorage.getItem('gpm_supabase_anon_key') : null;
const supabaseUrl = envUrl && envUrl !== 'YOUR_SUPABASE_URL' ? envUrl : (localUrl || '');
const supabaseAnonKey = envKey && envKey !== 'YOUR_SUPABASE_ANON_KEY' ? envKey : (localKey || '');

function saveSupabaseConfig(url: string, key: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('gpm_supabase_url', url.trim());
    localStorage.setItem('gpm_supabase_anon_key', key.trim());
    window.location.reload();
  }
}

// Types
type Cliente = {
  id: string;
  nome_empresa: string;
  contato: string;
  criado_em: string;
};

type Tela = {
  id: string;
  nome_local: string;
  identificador_unico: string;
  status_online: boolean;
  cliente_id: string;
  fully_device_id?: string;
  clientes?: { nome_empresa: string };
};

type Toast = {
  id: string;
  type: 'success' | 'error';
  message: string;
};

export default function AdminPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('gpm_authenticated') === 'true';
    }
    return false;
  });
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState(false);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'clientes' | 'telas' | 'nova-midia' | 'perfil' | 'cloud' | 'whatsapp'>('dashboard');
  const [telas, setTelas] = useState<Tela[]>([]);
  const [onlineScreenIds, setOnlineScreenIds] = useState<string[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(() => {
    const saved = localStorage.getItem("gpm_system_settings");
    return saved ? JSON.parse(saved) : defaultSettings;
  });
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const { crescimentoTelasData, crescimentoClientesData } = useMemo(() => {
    const months: string[] = [];
    const now = new Date();
    
    // Get last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    const formatMonth = (dateStr: string) => {
      const d = new Date(dateStr);
      return d.toLocaleString('pt-BR', { month: 'short' });
    };

    let cumulativeTelas = telas.filter(t => t.criado_em < `${months[0]}-01`).length;
    let cumulativeClientes = clientes.filter(c => c.criado_em < `${months[0]}-01`).length;

    const telasData = months.map(m => {
      const monthTelas = telas.filter(t => t.criado_em.startsWith(m)).length;
      cumulativeTelas += monthTelas;
      return {
        name: formatMonth(`${m}-01T00:00:00`),
        atual: cumulativeTelas,
        anterior: 0 // Optional logic for previous year
      };
    });

    const clientesData = months.map(m => {
      const monthClientes = clientes.filter(c => c.criado_em.startsWith(m)).length;
      cumulativeClientes += monthClientes;
      return {
        name: formatMonth(`${m}-01T00:00:00`),
        ativos: cumulativeClientes
      };
    });

    return { crescimentoTelasData: telasData, crescimentoClientesData: clientesData };
  }, [telas, clientes]);

  // Setup States
  const [setupUrl, setSetupUrl] = useState(supabaseUrl || '');
  const [setupKey, setSetupKey] = useState(supabaseAnonKey || '');
  const [copiedSql, setCopiedSql] = useState(false);

  // Form States
  const [clienteForm, setClienteForm] = useState({ nome: '', whatsapp: '', email: '' });
  const [telaForm, setTelaForm] = useState({ nome_local: '', identificador_unico: '', cliente_id: '' });
  const [midiaForm, setMidiaForm] = useState({ titulo_video: '', tela_id: '' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Biblioteca de Mídias States
  const [midias, setMidias] = useState<any[]>([]);
  const [editingMidia, setEditingMidia] = useState<any | null>(null);
  const [previewMidia, setPreviewMidia] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ titulo_video: '', tela_id: '' });
  const [editFile, setEditFile] = useState<File | null>(null);
  const [isUpdatingMidia, setIsUpdatingMidia] = useState(false);
  const [currentMidiaPage, setCurrentMidiaPage] = useState(1);

  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  useEffect(() => {
    setCurrentMidiaPage(1);
  }, [midias.length]);

  // Handle window resize for sidebar
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        // setIsSidebarOpen(false); // Removed as we use the new Sidebar
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchSystemSettings = async () => {
    if (!isSupabaseConfigured) return;
    try {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('*')
        .eq('id', 'sistema')
        .maybeSingle();

      if (error) {
        console.warn('configuracoes table fetch error:', error);
        return;
      }

      if (data) {
        const loadedSettings: SystemSettings = {
          systemName: data.system_name || 'GOLD PLAY',
          logoUrl: data.logo_url || '/gpm.png',
          iconUrl: data.icon_url || '/gpm.png',
          backendUrl: data.backend_url || '',
        };
        setSystemSettings(loadedSettings);
        localStorage.setItem('gpm_system_settings', JSON.stringify(loadedSettings));
      }
    } catch (err) {
      console.error('Error loading configuration from DB:', err);
    }
  };

  useEffect(() => {
    fetchSystemSettings();
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'maestro5') {
      setIsAuthenticated(true);
      localStorage.setItem('gpm_authenticated', 'true');
      setLoginError(false);
    } else {
      setLoginError(true);
      setTimeout(() => setLoginError(false), 2000);
    }
  };

  // Fetch Data
  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const { data: telasData, error: telasError } = await supabase
        .from('telas')
        .select(`*, clientes (nome_empresa)`)
        .order('criado_em', { ascending: false });

      if (telasError) throw telasError;
      setTelas(telasData || []);

      const { data: clientesData, error: clientesError } = await supabase
        .from('clientes')
        .select('*')
        .order('nome_empresa');

      if (clientesError) throw clientesError;
      setClientes(clientesData || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      const errorMsg = error.message || error.details || JSON.stringify(error);
      showToast('error', `Falha ao carregar dados: ${errorMsg}. Verifique a conexão do banco.`);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchClientes = async () => {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('nome_empresa');
      if (error) throw error;
      setClientes(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const fetchMidias = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('midias')
        .select(`
          *,
          clientes (
            nome_empresa
          ),
          playlists (
            id,
            tela_id,
            telas (
              id,
              nome_local,
              identificador_unico
            )
          )
        `)
        .order('criado_em', { ascending: false });

      if (error) throw error;
      setMidias(data || []);
    } catch (error: any) {
      console.error('Error fetching midias:', error);
      const errorMsg = error.message || error.details || JSON.stringify(error);
      showToast('error', `Falha ao carregar mídias: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletarMidia = async (midiaId: string, urlStorage: string) => {
    if (!confirm('Deseja realmente excluir esta mídia? Ela será removida de todas as telas vinculadas.')) {
      return;
    }

    setIsLoading(true);
    try {
      // 1. Deleta do banco
      const { error: deleteDbError } = await supabase
        .from('midias')
        .delete()
        .eq('id', midiaId);

      if (deleteDbError) throw deleteDbError;

      // 2. Deleta do storage se aplicável
      if (urlStorage) {
        const parts = urlStorage.split('/videos/');
        if (parts.length > 1) {
          const fileName = parts[1];
          const filePath = `videos/${fileName}`;
          
          await supabase.storage
            .from('midias')
            .remove([filePath]);
        }
      }

      showToast('success', 'Mídia excluída com sucesso.');
      fetchMidias();
      fetchDashboardData();
    } catch (error: any) {
      console.error('Error deleting midia:', error);
      showToast('error', 'Erro ao excluir mídia: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenEditMidiaModal = (midia: any) => {
    setEditingMidia(midia);
    setEditForm({
      titulo_video: midia.titulo_video || '',
      tela_id: midia.playlists?.[0]?.tela_id || ''
    });
    setEditFile(null);
  };

  const handleUpdateMidiaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMidia) return;
    if (!editForm.titulo_video || !editForm.tela_id) {
      showToast('error', 'Preencha todos os campos obrigatórios.');
      return;
    }

    setIsUpdatingMidia(true);
    try {
      let finalUrl = editingMidia.url_storage;
      let finalSize = editingMidia.tamanho_mb;

      if (editFile) {
        // Upload do novo vídeo
        const fileExt = editFile.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
        const filePath = `videos/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('midias')
          .upload(filePath, editFile, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('midias')
          .getPublicUrl(filePath);

        finalUrl = publicUrlData.publicUrl;
        finalSize = parseFloat((editFile.size / (1024 * 1024)).toFixed(2));

        // Deleta arquivo antigo do storage
        if (editingMidia.url_storage) {
          const parts = editingMidia.url_storage.split('/videos/');
          if (parts.length > 1) {
            const oldFileName = parts[1];
            const oldFilePath = `videos/${oldFileName}`;
            await supabase.storage
              .from('midias')
              .remove([oldFilePath]);
          }
        }
      }

      const targetTela = telas.find(t => t.id === editForm.tela_id);
      if (!targetTela) throw new Error("Tela de destino inválida.");

      // Atualiza a tabela 'midias'
      const { error: dbError } = await supabase
        .from('midias')
        .update({
          titulo_video: editForm.titulo_video,
          url_storage: finalUrl,
          tamanho_mb: finalSize,
          cliente_id: targetTela.cliente_id
        })
        .eq('id', editingMidia.id);

      if (dbError) throw dbError;

      // Atualiza ou insere o vínculo de playlist
      const playlistId = editingMidia.playlists?.[0]?.id;
      if (playlistId) {
        const { error: playlistError } = await supabase
          .from('playlists')
          .update({
            tela_id: editForm.tela_id
          })
          .eq('id', playlistId);

        if (playlistError) throw playlistError;
      } else {
        const { error: playlistError } = await supabase
          .from('playlists')
          .insert([{
            tela_id: editForm.tela_id,
            midia_id: editingMidia.id,
            ordem_exibicao: 0
          }]);

        if (playlistError) throw playlistError;
      }

      showToast('success', 'Mídia atualizada com sucesso.');
      setEditingMidia(null);
      setEditFile(null);
      fetchMidias();
      fetchDashboardData();
    } catch (error: any) {
      console.error('Error updating midia:', error);
      showToast('error', 'Erro ao atualizar mídia: ' + error.message);
    } finally {
      setIsUpdatingMidia(false);
    }
  };

  useEffect(() => {
    document.title = `${systemSettings.systemName} | Workspace`;
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.getElementsByTagName("head")[0].appendChild(link);
    }
    link.href = systemSettings.iconUrl || "/gpm.png";
  }, [systemSettings.systemName, systemSettings.iconUrl]);

  useEffect(() => {
    if (isAuthenticated) {
      if (activeTab === 'dashboard') {
        fetchDashboardData();
        fetchMidias();
      } else if (activeTab === 'nova-tela') {
        fetchClientes();
      } else if (activeTab === 'nova-midia') {
        fetchDashboardData(); // Fetches both telas and clientes, which is needed for nova-midia dropdown
        fetchMidias(); // Carrega biblioteca de mídias
      }
    }
  }, [activeTab, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Presence Channel subscription for real-time online/offline status
    const presenceChannel = supabase.channel('telas-presence');
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState() || {};
        const onlineIds = Object.keys(state);
        setOnlineScreenIds(onlineIds);
        console.log('Realtime screen presence update (AdminPanel):', onlineIds);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, [isAuthenticated]);

  // Toast System
  const showToast = (type: 'success' | 'error', message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Submissions
  const handleClienteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteForm.nome) {
      showToast('error', 'Nome é obrigatório.');
      return;
    }
    
    setIsSubmitting(true);
    
    const dbPayload = {
      nome_empresa: clienteForm.nome,
      contato: `WhatsApp: ${clienteForm.whatsapp} | E-mail: ${clienteForm.email}`
    };

    try {
      const { data, error } = await supabase
        .from('clientes')
        .insert([dbPayload])
        .select();
        
      if (error) {
        throw error;
      }
      
      if (data && data.length > 0) {
        setClientes(prev => [...prev, data[0] as Cliente]);
      }
      showToast('success', 'Cliente salvo com sucesso no banco de dados.');
      
      setClienteForm({ nome: '', whatsapp: '', email: '' });
      setActiveTab('dashboard');
    } catch (error: any) {
      console.error(error);
      if (error.code === '42501') {
         showToast('error', 'Acesso negado (RLS). Execute o SQL para liberar permissões anônimas no Supabase.');
      } else {
         showToast('error', 'Erro ao salvar cliente: ' + error.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTelaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!telaForm.nome_local || !telaForm.identificador_unico || !telaForm.cliente_id) {
      showToast('error', 'Preencha todos os campos obrigatórios.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('telas')
        .insert([{
          ...telaForm,
          status_online: false
        }])
        .select(`*, clientes (nome_empresa)`);
        
      if (error) {
        throw error;
      }
      
      if (data && data.length > 0) {
        setTelas(prev => [data[0] as Tela, ...prev]);
      }
      showToast('success', 'Tela salva com sucesso no banco de dados.');
      
      setTelaForm({ nome_local: '', identificador_unico: '', cliente_id: '' });
      setActiveTab('dashboard');
    } catch (error: any) {
      console.error(error);
      if (error.code === '42501') {
         showToast('error', 'Acesso negado (RLS). Execute o SQL para liberar permissões anônimas no Supabase.');
      } else {
         showToast('error', 'Erro ao salvar tela: ' + error.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMidiaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!midiaForm.titulo_video || !midiaForm.tela_id || !selectedFile) {
      showToast('error', 'Preencha todos os campos e selecione um arquivo.');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const selectedTela = telas.find(t => t.id === midiaForm.tela_id);
      if (!selectedTela) throw new Error("Tela não encontrada.");

      // Upload file
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath = `videos/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('midias')
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: false
        });
        
      if (uploadError) {
        throw uploadError;
      }
      
      const { data: publicUrlData } = supabase.storage
        .from('midias')
        .getPublicUrl(filePath);
        
      const publicUrl = publicUrlData.publicUrl;
      const sizeMb = parseFloat((selectedFile.size / (1024 * 1024)).toFixed(2));
      
      // Save to midias table
      const { data: midiaData, error: midiaError } = await supabase
        .from('midias')
        .insert([{
          titulo_video: midiaForm.titulo_video,
          url_storage: publicUrl,
          tamanho_mb: sizeMb,
          cliente_id: selectedTela.cliente_id
        }])
        .select();
        
      if (midiaError) throw midiaError;
      
      if (midiaData && midiaData.length > 0) {
        const novaMidia = midiaData[0];
        // Save to playlists table
        const { error: playlistError } = await supabase
          .from('playlists')
          .insert([{
            tela_id: midiaForm.tela_id,
            midia_id: novaMidia.id,
            ordem_exibicao: 0
          }]);
          
        if (playlistError) throw playlistError;
      }

      showToast('success', 'Mídia enviada e vinculada com sucesso.');
      setMidiaForm({ titulo_video: '', tela_id: '' });
      setSelectedFile(null);
      setActiveTab('dashboard');
    } catch (error: any) {
      console.error(error);
      if (error.code === '42501') {
         showToast('error', 'Acesso negado (RLS). Verifique as políticas do bucket e das tabelas.');
      } else {
         showToast('error', 'Erro ao processar mídia: ' + error.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#050505] text-slate-300 font-sans flex items-center justify-center overflow-hidden selection:bg-amber-500/30 selection:text-amber-200 relative">
        {/* Background glow effects */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-600/5 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-900/10 via-transparent to-transparent pointer-events-none"></div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md p-8 relative z-10"
        >
          <div className="text-center mb-10">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="w-48 h-48 sm:w-[300px] sm:h-[300px] mx-auto rounded-2xl flex items-center justify-center mb-6 overflow-hidden shadow-[0_0_40px_rgba(245,158,11,0.2)]"
            >
              <img src={systemSettings.logoUrl || "/gpm.png"} alt={`${systemSettings.systemName} Logo`} className="w-full h-full object-contain" />
            </motion.div>
            <h1 className="text-3xl font-display font-bold text-white tracking-widest mb-2 uppercase">{systemSettings.systemName}</h1>
            <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Acesso Restrito • Master</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className={`w-5 h-5 transition-colors ${loginError ? 'text-red-500' : 'text-slate-600 group-focus-within:text-amber-500'}`} />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Insira a chave mestre"
                className={`w-full bg-[#0a0a0c] border ${loginError ? 'border-red-500/50 focus:border-red-500/80 text-red-100' : 'border-white/10 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 text-white'} rounded-xl py-4 pl-12 pr-4 text-sm focus:outline-none transition-all placeholder-slate-700 shadow-inner`}
                autoFocus
              />
              <AnimatePresence>
                {loginError && (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="absolute -bottom-6 left-0 text-[10px] text-red-400 font-mono"
                  >
                    Chave mestre incorreta. Acesso negado.
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              type="submit"
              className="w-full bg-white text-black hover:bg-slate-200 py-4 rounded-xl text-sm font-bold transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] flex items-center justify-center gap-2 group"
            >
              <span>Autenticar</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </form>

          <div className="mt-12 text-center">
            <p className="text-[9px] font-mono text-slate-600 uppercase tracking-widest">
              Infraestrutura de Gerenciamento Digital Signage<br/>
              © {new Date().getFullYear()} Gold Play Mídia
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  const sqlSetupCode = `-- =========================================================================
-- SCRIPT DE CONFIGURAÇÃO COMPLETA DO BANCO DE DADOS SUPABASE
-- Gold Play Mídia - Digital Signage Workspace
-- =========================================================================

drop table if exists configuracoes cascade;
drop table if exists playlists cascade;
drop table if exists midias cascade;
drop table if exists telas cascade;
drop table if exists clientes cascade;

create table configuracoes (
  id text primary key default 'sistema',
  system_name text not null default 'GOLD PLAY',
  logo_url text,
  icon_url text,
  backend_url text,
  criado_em timestamp with time zone default timezone('utc'::text, now()) not null
);

create table clientes (
  id uuid default gen_random_uuid() primary key,
  nome_empresa text not null,
  whatsapp text,
  endereco_fisico text,
  valor numeric,
  vencimento date,
  criado_em timestamp with time zone default timezone('utc'::text, now()) not null
);

create table telas (
  id uuid default gen_random_uuid() primary key,
  nome_local text not null,
  identificador_unico text not null unique,
  status_online boolean default false,
  cliente_id uuid references clientes(id) on delete cascade not null,
  endereco text,
  whatsapp text,
  criado_em timestamp with time zone default timezone('utc'::text, now()) not null
);

create table midias (
  id uuid default gen_random_uuid() primary key,
  titulo_video text not null,
  url_storage text not null,
  tamanho_mb numeric,
  cliente_id uuid references clientes(id) on delete cascade not null,
  criado_em timestamp with time zone default timezone('utc'::text, now()) not null
);

create table playlists (
  id uuid default gen_random_uuid() primary key,
  tela_id uuid references telas(id) on delete cascade not null,
  midia_id uuid references midias(id) on delete cascade not null,
  ordem_exibicao integer default 0 not null,
  criado_em timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table configuracoes disable row level security;
alter table clientes disable row level security;
alter table telas disable row level security;
alter table midias disable row level security;
alter table playlists disable row level security;

-- Caso o RLS seja reativado ou mantido ativo pelo Supabase, criamos políticas públicas irrestritas (CRUD completo)
-- para permitir que as requisições anônimas funcionem normalmente.

-- Políticas para Configurações
drop policy if exists "Acesso público total configuracoes" on configuracoes;
create policy "Acesso público total configuracoes" on configuracoes for all using (true) with check (true);

-- Políticas para Clientes
drop policy if exists "Acesso público total clientes" on clientes;
create policy "Acesso público total clientes" on clientes for all using (true) with check (true);

-- Políticas para Telas
drop policy if exists "Acesso público total telas" on telas;
create policy "Acesso público total telas" on telas for all using (true) with check (true);

-- Políticas para Mídias
drop policy if exists "Acesso público total midias" on midias;
create policy "Acesso público total midias" on midias for all using (true) with check (true);

-- Políticas para Playlists
drop policy if exists "Acesso público total playlists" on playlists;
create policy "Acesso público total playlists" on playlists for all using (true) with check (true);

insert into configuracoes (id, system_name, logo_url, icon_url, backend_url)
values ('sistema', 'GOLD PLAY', '/gpm.png', '/gpm.png', '')
on conflict (id) do nothing;

insert into storage.buckets (id, name, public) 
values ('midias', 'midias', true)
on conflict (id) do nothing;

drop policy if exists "Permitir uploads publicos de midias" on storage.objects;
drop policy if exists "Permitir leitura publica de midias" on storage.objects;
drop policy if exists "Permitir deletar midias" on storage.objects;

create policy "Permitir uploads publicos de midias" on storage.objects
  for insert with check (bucket_id = 'midias');

create policy "Permitir leitura publica de midias" on storage.objects
  for select using (bucket_id = 'midias');

create policy "Permitir deletar midias" on storage.objects
  for delete using (bucket_id = 'midias');`;

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(sqlSetupCode);
    setCopiedSql(true);
    showToast('success', 'Código SQL copiado para a área de transferência!');
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const handleSetupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupUrl || !setupKey) {
      showToast('error', 'Por favor, preencha todos os campos.');
      return;
    }
    saveSupabaseConfig(setupUrl, setupKey);
  };

  if (isAuthenticated && !isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-[#050505] text-slate-300 font-sans flex items-center justify-center overflow-y-auto selection:bg-amber-500/30 selection:text-amber-200 relative p-6">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-amber-600/5 rounded-full blur-[140px] pointer-events-none"></div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-2xl bg-[#0a0a0c] border border-white/5 rounded-3xl p-8 relative z-10 shadow-2xl my-8"
        >
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-display font-semibold text-white">Configuração do Supabase</h1>
              <p className="text-xs text-slate-500 font-mono mt-0.5">ESTADO: CONEXÃO PENDENTE</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-amber-950/20 border border-amber-500/10 rounded-2xl p-4 flex gap-3 text-amber-300 text-xs leading-relaxed animate-pulse">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-500" />
              <div>
                <span className="font-bold">Atenção administrador:</span> Para usar as funções do painel, você deve configurar seu banco de dados Supabase abaixo. As credenciais serão salvas de forma segura no seu navegador.
              </div>
            </div>

            <div className="bg-[#0f0f11] border border-white/5 rounded-2xl p-6">
              <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center text-xs text-slate-400 font-mono">1</span>
                Executar Script SQL no Supabase
              </h2>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                Antes de salvar as credenciais abaixo, certifique-se de executar o script de criação de tabelas. No painel do seu Supabase, acesse <span className="text-white font-medium">SQL Editor</span>, clique em <span className="text-white font-medium">New Query</span>, cole o código abaixo e clique em <span className="text-white font-medium">Run</span>:
              </p>
              <button 
                type="button"
                onClick={copySqlToClipboard}
                className="w-full py-3 px-4 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-mono transition-all flex items-center justify-center gap-2 border border-white/10 shadow-inner group"
              >
                {copiedSql ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400 font-bold">Copiado com Sucesso!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-slate-400 group-hover:text-white" />
                    <span>Copiar Script SQL de Tabelas</span>
                  </>
                )}
              </button>
            </div>

            <form onSubmit={handleSetupSubmit} className="space-y-4">
              <h2 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center text-xs text-slate-400 font-mono">2</span>
                Informar Credenciais de Acesso
              </h2>

              <div className="space-y-4 bg-[#0f0f11] border border-white/5 p-6 rounded-2xl">
                <div>
                  <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-slate-400" />
                    Supabase URL do Projeto (API URL)
                  </label>
                  <input 
                    type="url"
                    required
                    placeholder="https://exemplo.supabase.co"
                    value={setupUrl}
                    onChange={e => setSetupUrl(e.target.value)}
                    className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3.5 text-xs text-white focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all font-mono placeholder-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-slate-400" />
                    Supabase Anon (Public) Key
                  </label>
                  <input 
                    type="password"
                    required
                    placeholder="Cole a chave pública anônima aqui"
                    value={setupKey}
                    onChange={e => setSetupKey(e.target.value)}
                    className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3.5 text-xs text-white focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all font-mono placeholder-slate-700"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-4">
                <button
                  type="submit"
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-black py-4 rounded-xl text-sm font-bold transition-all shadow-[0_0_20px_rgba(245,158,11,0.2)] hover:shadow-[0_0_30px_rgba(245,158,11,0.4)] flex items-center justify-center gap-2 group"
                >
                  <span>Salvar e Iniciar Painel</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020202] text-slate-300 font-sans flex items-center justify-center p-6 selection:bg-amber-500/30 selection:text-amber-200">
      
      {/* Mobile Top Header Menu */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 px-4 py-3">
        <div className="bg-[#111111]/90 backdrop-blur-md rounded-xl border border-orange-200/30 shadow-lg p-3 flex justify-between items-center">
            <div className="flex items-center gap-2">
                <img src={systemSettings.iconUrl || "/gpm.png"} alt="Logo" className="w-8 h-8 object-contain" />
                <span className="text-sm font-semibold text-white tracking-widest">{systemSettings.systemName}</span>
            </div>
            <button onClick={() => setIsSidebarExpanded(!isSidebarExpanded)} className="text-white p-2">
                <Menu className="w-6 h-6" />
            </button>
        </div>
      </div>

      <div className="w-full max-w-[1400px] h-[90vh] bg-[#050505] rounded-3xl border border-white/10 flex overflow-hidden shadow-2xl mt-16 lg:mt-0">
        
        <Sidebar 
          isOpen={isSidebarExpanded} 
          setIsOpen={setIsSidebarExpanded}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onLogout={() => {
            setIsAuthenticated(false);
            localStorage.removeItem('gpm_authenticated');
            setPassword('');
          }}
          systemName={systemSettings.systemName}
          iconUrl={systemSettings.iconUrl}
        />

        {/* Main Content */}
        <main className="flex-1 flex flex-col relative overflow-hidden bg-gradient-to-br from-[#050505] via-[#0a0a0c] to-[#050505] w-full">
        
        {/* Top Header */}
        <header className="h-20 flex flex-shrink-0 items-center justify-between px-6 lg:px-10 border-b border-white/5 bg-[#0a0a0a]/50 backdrop-blur-md z-10">
          <div className="flex items-center gap-4">
            <div className="text-xs font-mono text-slate-500 flex items-center gap-2">
              <span className="hidden sm:inline">ADMIN</span>
              <ChevronRight className="w-3 h-3 hidden sm:block" />
              <span className="text-slate-300 capitalize font-semibold">
                {activeTab.replace('-', ' ')}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="relative hidden md:block">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Buscar..." 
                className="bg-white/5 border border-white/10 rounded-full py-1.5 pl-9 pr-4 text-xs focus:outline-none focus:border-amber-500/50 focus:bg-white/10 transition-all w-48 lg:w-64 text-white placeholder-slate-600"
              />
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-10 relative z-0">
          <AnimatePresence mode="wait">
            
            {/* Dashboard Tab */}
            {activeTab === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="max-w-6xl mx-auto"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-8">
                  <div>
                    <h2 className="text-3xl font-display font-light text-white mb-2 tracking-tight">Visão Geral</h2>
                    <p className="text-sm text-slate-500 font-light">Monitoramento da malha de telas em tempo real.</p>
                  </div>
                  <button 
                    onClick={() => setActiveTab('telas')}
                    className="flex items-center gap-2 bg-white/10 hover:bg-white/15 border border-white/10 text-white px-5 py-2.5 rounded-lg text-sm transition-all whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar Tela
                  </button>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                  <div className="bg-[#0f0f11] border border-white/5 p-6 rounded-2xl relative overflow-hidden group flex flex-col justify-center min-h-[200px]">
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                      <Monitor className="w-12 h-12 text-amber-500" />
                    </div>
                    <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-1">Total de Telas</p>
                    <p className="text-4xl font-display font-light text-white">{telas.length}</p>
                  </div>
                  <div className="bg-[#0f0f11] border border-white/5 p-6 rounded-2xl relative overflow-hidden group flex flex-col justify-start min-h-[200px]">
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                      <Link2 className="w-16 h-16 text-emerald-500" />
                    </div>
                    <div className="mb-4 relative z-10">
                      <p className="text-xs font-mono text-emerald-500 uppercase tracking-widest font-bold mb-4">Link de Transmissão</p>
                      <div className="space-y-3 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                        {midias.length === 0 ? (
                          <p className="text-xs text-slate-500 italic">Nenhuma mídia ativa</p>
                        ) : (
                          midias.map(midia => (
                            <div key={midia.id} className="flex items-center gap-3 bg-black/40 border border-white/5 p-2 rounded-xl">
                              <div className="w-16 h-12 rounded overflow-hidden bg-white/5 shrink-0 flex items-center justify-center relative group/vid">
                                {midia.url_storage ? (
                                  <video src={midia.url_storage} className="w-full h-full object-cover opacity-70 group-hover/vid:opacity-100 transition-opacity" />
                                ) : (
                                  <Video className="w-4 h-4 text-slate-600" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-mono text-slate-300 truncate font-semibold uppercase">{midia.titulo_video || 'Campanha'}</p>
                              </div>
                              <button 
                                onClick={() => {
                                  navigator.clipboard.writeText(`${window.location.origin}/campanha/${midia.id}`);
                                  showToast('success', 'Link copiado!');
                                }}
                                className="shrink-0 flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 px-2.5 py-1.5 rounded-lg transition-colors text-[9px] font-mono relative z-10"
                                title="Copiar ID"
                              >
                                <Copy className="w-3 h-3" />
                                COPIAR ID
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-4 min-h-[200px]">
                    <div className="bg-[#0f0f11] border border-white/5 p-4 rounded-2xl relative overflow-hidden group flex-1 flex flex-col justify-center">
                      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Users className="w-12 h-12 text-blue-500" />
                      </div>
                      <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Clientes Ativos</p>
                      <p className="text-3xl font-display font-light text-white">{clientes.length}</p>
                    </div>

                    <div className="bg-[#0f0f11] border border-white/5 p-4 rounded-2xl relative overflow-hidden group flex-1 flex flex-col justify-center">
                      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Cloud className="w-12 h-12 text-sky-500" />
                      </div>
                      <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Fully Status</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sky-500"></span>
                        </div>
                        <p className="text-base font-display font-medium tracking-wide text-sky-500">
                          ON-LINE
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Growth Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Chart 1: Crescimento de Telas */}
                  <div className="bg-[#0f0f11] border border-white/5 rounded-2xl p-6 shadow-2xl shadow-black/50">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-sm font-medium text-white mb-1">Crescimento de Telas</h3>
                        <p className="text-xs text-slate-500">Telas instaladas (Ano Atual vs Anterior)</p>
                      </div>
                      <Monitor className="w-5 h-5 text-amber-500 opacity-50" />
                    </div>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={crescimentoTelasData} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                          <XAxis 
                            dataKey="name" 
                            stroke="rgba(255,255,255,0.2)" 
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis 
                            stroke="rgba(255,255,255,0.2)" 
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                          />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0a0a0c', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                            itemStyle={{ fontSize: '12px' }}
                            labelStyle={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}
                          />
                          <Line 
                            type="monotone" 
                            name="Ano Atual"
                            dataKey="atual" 
                            stroke="#f59e0b" 
                            strokeWidth={3}
                            dot={{ r: 4, fill: '#f59e0b', strokeWidth: 2 }}
                            activeDot={{ r: 6 }}
                          />
                          <Line 
                            type="monotone" 
                            name="Ano Anterior"
                            dataKey="anterior" 
                            stroke="#f59e0b" 
                            strokeOpacity={0.3}
                            strokeWidth={2}
                            strokeDasharray="4 4"
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Chart 2: Crescimento de Clientes */}
                  <div className="bg-[#0f0f11] border border-white/5 rounded-2xl p-6 shadow-2xl shadow-black/50">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-sm font-medium text-white mb-1">Crescimento de Clientes</h3>
                        <p className="text-xs text-slate-500">Demanda de novos clientes</p>
                      </div>
                      <Users className="w-5 h-5 text-emerald-500 opacity-50" />
                    </div>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={crescimentoClientesData} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
                          <defs>
                            <linearGradient id="colorAtivos" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                          <XAxis 
                            dataKey="name" 
                            stroke="rgba(255,255,255,0.2)" 
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis 
                            stroke="rgba(255,255,255,0.2)" 
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                          />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0a0a0c', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                            itemStyle={{ fontSize: '12px' }}
                            labelStyle={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}
                          />
                          <Area 
                            type="monotone" 
                            name="Novos Clientes"
                            dataKey="ativos" 
                            stroke="#10b981" 
                            strokeWidth={3}
                            fillOpacity={1} 
                            fill="url(#colorAtivos)" 
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Clientes Tab */}
            {activeTab === 'clientes' && (
              <motion.div key="clientes" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
                <ClientesList showToast={showToast} />
              </motion.div>
            )}


            {/* Telas Tab */}
            {activeTab === 'telas' && (
              <motion.div key="telas" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
                <TelasList showToast={showToast} />
              </motion.div>
            )}

            {/* Perfil Tab */}
            {activeTab === 'perfil' && (
              <motion.div key="perfil" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
                <PerfilSettings showToast={showToast} settings={systemSettings} onSettingsChange={setSystemSettings} />
              </motion.div>
            )}

            {/* Cloud Manager Tab */}
            {activeTab === 'cloud' && (
              <motion.div key="cloud" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
                <CloudPanel telas={telas} showToast={showToast} fetchDashboardData={fetchDashboardData} />
              </motion.div>
            )}

            {/* WhatsApp Tab */}
            {activeTab === 'whatsapp' && (
              <motion.div key="whatsapp" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
                <WhatsappPanel showToast={showToast} />
              </motion.div>
            )}

            {/* Nova Mídia Tab */}
            {activeTab === 'nova-midia' && (
              <motion.div 
                key="nova-midia"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="max-w-6xl mx-auto pt-6 animate-fade-in"
              >
                <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-3xl font-display font-light text-white mb-2 tracking-tight">Gerenciar Mídias</h2>
                    <p className="text-sm text-slate-500 font-light">Envie, edite, exclua e mude o destino das mídias em sua rede.</p>
                  </div>
                  <button 
                    onClick={() => { fetchMidias(); fetchDashboardData(); }}
                    className="text-xs text-amber-500 hover:text-amber-400 font-mono transition-colors border border-amber-500/20 hover:border-amber-500/50 px-3 py-1.5 rounded-lg bg-amber-500/5 whitespace-nowrap"
                  >
                    {isLoading ? 'Sincronizando...' : 'Sincronizar Biblioteca'}
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* Coluna do Formulário de Upload */}
                  <div className="lg:col-span-5 space-y-6">
                    <div className="bg-[#0f0f11] border border-white/5 p-6 rounded-3xl shadow-xl">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
                          <UploadCloud className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                          <h3 className="text-base font-medium text-white">Novo Upload</h3>
                          <p className="text-xs text-slate-500">Adicione um novo arquivo de vídeo às telas.</p>
                        </div>
                      </div>

                      <form onSubmit={handleMidiaSubmit} className="space-y-5">
                        <div>
                          <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1.5">Título do Vídeo</label>
                          <input 
                            type="text" 
                            value={midiaForm.titulo_video}
                            onChange={e => setMidiaForm({...midiaForm, titulo_video: e.target.value})}
                            className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all placeholder-slate-700"
                            placeholder="Ex: Propaganda Promocional"
                            required
                          />
                        </div>
                        
                        <div>
                          <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1.5">Tela de Destino</label>
                          <div className="relative">
                            <select 
                              value={midiaForm.tela_id}
                              onChange={e => setMidiaForm({...midiaForm, tela_id: e.target.value})}
                              className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all appearance-none cursor-pointer"
                              required
                            >
                              <option value="" disabled className="text-slate-500">Selecione a tela alvo...</option>
                              {telas.map(t => (
                                <option key={t.id} value={t.id}>{t.nome_local} ({t.identificador_unico})</option>
                              ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                              <ChevronRight className="w-4 h-4 rotate-90" />
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1.5">Arquivo de Vídeo</label>
                          <div className="relative border-2 border-dashed border-white/10 rounded-xl p-6 hover:border-amber-500/50 transition-colors bg-[#050505] group">
                            <input 
                              type="file" 
                              accept="video/*"
                              onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                              required
                            />
                            <div className="flex flex-col items-center justify-center text-center">
                              <FileVideo className={`w-8 h-8 mb-3 transition-colors ${selectedFile ? 'text-amber-500' : 'text-slate-600 group-hover:text-amber-500/50'}`} />
                              {selectedFile ? (
                                <>
                                  <p className="text-xs font-medium text-white mb-0.5 truncate max-w-[200px]">{selectedFile.name}</p>
                                  <p className="text-[10px] text-amber-500/70 font-mono">
                                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                                  </p>
                                </>
                              ) : (
                                <>
                                  <p className="text-xs font-medium text-white mb-0.5">Arraste ou clique para enviar</p>
                                  <p className="text-[10px] text-slate-500">MP4, WEBM (Max. 500MB)</p>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="pt-2">
                          <button 
                            type="submit"
                            disabled={isSubmitting} 
                            className="w-full bg-gradient-to-r from-amber-600 to-amber-500 text-black hover:from-amber-500 hover:to-amber-400 py-3 rounded-xl text-sm font-medium transition-all shadow-[0_0_15px_rgba(245,158,11,0.15)] hover:shadow-[0_0_20px_rgba(245,158,11,0.3)] flex items-center justify-center gap-2"
                          >
                            {isSubmitting ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Enviando para Nuvem...
                              </>
                            ) : (
                              <>
                                <UploadCloud className="w-4 h-4" />
                                Enviar e Vincular Mídia
                              </>
                            )}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>

                  {/* Coluna da Biblioteca de Mídias */}
                  <div className="lg:col-span-7 space-y-6">
                    <div className="bg-[#0f0f11] border border-white/5 p-6 rounded-3xl shadow-xl min-h-[450px]">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
                            <Film className="w-5 h-5 text-amber-500" />
                          </div>
                          <div>
                            <h3 className="text-base font-medium text-white">Mídias Ativas</h3>
                            <p className="text-xs text-slate-500">Clique para reproduzir ou use os botões para editar/deletar.</p>
                          </div>
                        </div>
                        <span className="text-xs font-mono text-slate-400 bg-white/5 px-2.5 py-1 rounded-full border border-white/5">
                          {midias.length} {midias.length === 1 ? 'mídia' : 'mídias'}
                        </span>
                      </div>

                      {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
                          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                          <p className="text-xs font-mono uppercase tracking-widest">Buscando biblioteca...</p>
                        </div>
                      ) : midias.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 border border-dashed border-white/5 rounded-2xl text-center p-6">
                          <FileVideo className="w-12 h-12 text-slate-700 mb-4 animate-pulse" />
                          <p className="text-sm font-medium text-slate-400 mb-1">Nenhuma mídia registrada</p>
                          <p className="text-xs text-slate-600 max-w-sm">Os vídeos cadastrados e os vínculos das telas de exibição serão exibidos aqui.</p>
                        </div>
                      ) : (() => {
                        const MIDIAS_PER_PAGE = 20;
                        const totalMidias = midias.length;
                        const totalMidiasPages = Math.ceil(totalMidias / MIDIAS_PER_PAGE) || 1;
                        const startIndex = (currentMidiaPage - 1) * MIDIAS_PER_PAGE;
                        const endIndex = Math.min(startIndex + MIDIAS_PER_PAGE, totalMidias);
                        const paginatedMidias = midias.slice(startIndex, endIndex);

                        const getMidiasPageNumbers = () => {
                          const pages: number[] = [];
                          const maxVisiblePages = 5;
                          let start = Math.max(1, currentMidiaPage - Math.floor(maxVisiblePages / 2));
                          let end = Math.min(totalMidiasPages, start + maxVisiblePages - 1);
                          if (end - start + 1 < maxVisiblePages) {
                            start = Math.max(1, end - maxVisiblePages + 1);
                          }
                          for (let i = start; i <= end; i++) {
                            pages.push(i);
                          }
                          return pages;
                        };

                        return (
                          <div className="space-y-6">
                            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                              {paginatedMidias.map((m: any) => {
                                const playlistTela = m.playlists?.[0]?.telas;
                                return (
                                  <div key={m.id} className="bg-[#050505] border border-white/5 p-4 rounded-2xl flex flex-col md:flex-row gap-4 hover:border-white/10 transition-colors group relative">
                                    {/* Prévia do vídeo (reproduz com som desativado em hover) */}
                                    <div 
                                      onClick={() => setPreviewMidia(m)}
                                      className="w-24 h-24 rounded-xl bg-[#0a0a0c] overflow-hidden flex-shrink-0 relative border border-white/5 flex items-center justify-center group/preview cursor-pointer group-hover:border-amber-500/50 transition-colors"
                                      title="Clique para conferir com som e controles"
                                    >
                                      {m.url_storage ? (
                                        <>
                                          <video 
                                            src={m.url_storage} 
                                            className="w-full h-full object-cover group-hover/preview:scale-105 transition-transform duration-300" 
                                            muted 
                                            loop 
                                            playsInline 
                                            onMouseEnter={e => e.currentTarget.play()} 
                                            onMouseLeave={e => {
                                              e.currentTarget.pause();
                                              e.currentTarget.currentTime = 0;
                                            }}
                                          />
                                          <div className="absolute inset-0 bg-black/45 flex items-center justify-center opacity-0 group-hover/preview:opacity-100 transition-opacity">
                                            <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-black shadow-lg shadow-amber-500/20 transform scale-90 group-hover/preview:scale-100 transition-transform">
                                              <Play className="w-4 h-4 fill-black text-black ml-0.5" />
                                            </div>
                                          </div>
                                        </>
                                      ) : (
                                        <FileVideo className="w-8 h-8 text-slate-600" />
                                      )}
                                      <div className="absolute top-1 right-1 bg-black/60 px-1.5 py-0.5 rounded text-[8px] font-mono text-slate-400">
                                        {m.tamanho_mb ? `${m.tamanho_mb} MB` : '-'}
                                      </div>
                                    </div>

                                    {/* Detalhes */}
                                    <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                                      <div className="cursor-pointer" onClick={() => setPreviewMidia(m)}>
                                        <h4 className="text-sm font-medium text-white hover:text-amber-500 transition-colors truncate" title={m.titulo_video}>
                                          {m.titulo_video}
                                        </h4>
                                        <p className="text-[10px] font-mono text-slate-500 mt-1 uppercase tracking-wider">
                                          Cliente: <span className="text-slate-300">{m.clientes?.nome_empresa || 'Sem Cliente'}</span>
                                        </p>
                                      </div>

                                      <div className="hidden lg:flex mt-2 bg-[#0c0c0e] border border-white/5 rounded-xl p-2.5 items-center gap-2">
                                        <Tv className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                        <div className="min-w-0 flex-1">
                                          <p className="text-[9px] text-slate-500 font-mono uppercase tracking-wider mb-0.5">Veiculação Ativa</p>
                                          <p className="text-xs text-slate-300 font-medium truncate">
                                            {playlistTela ? `${playlistTela.nome_local} (${playlistTela.identificador_unico})` : 'Sem tela associada'}
                                          </p>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Ações */}
                                    <div className="flex items-center gap-1 self-start">
                                      <button 
                                        onClick={() => setPreviewMidia(m)}
                                        className="p-2 text-slate-500 hover:text-amber-500 hover:bg-amber-500/10 rounded-lg transition-colors"
                                        title="Conferir Player (Play/Pause/Progresso)"
                                      >
                                        <Eye className="w-4 h-4" />
                                      </button>
                                      <button 
                                        onClick={() => handleOpenEditMidiaModal(m)}
                                        className="p-2 text-slate-500 hover:text-amber-500 hover:bg-amber-500/10 rounded-lg transition-colors"
                                        title="Editar Mídia"
                                      >
                                        <Edit className="w-4 h-4" />
                                      </button>
                                      <button 
                                        onClick={() => handleDeletarMidia(m.id, m.url_storage)}
                                        className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                        title="Excluir Mídia"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Pagination controls */}
                            <div className="pt-4 border-t border-white/5 bg-white/[0.01] flex flex-col sm:flex-row items-center justify-between gap-4">
                              <div className="text-xs font-mono text-slate-500 uppercase tracking-wider">
                                Mostrando <span className="text-slate-300 font-medium">{startIndex + 1}</span> a <span className="text-slate-300 font-medium">{endIndex}</span> de <span className="text-amber-500 font-medium">{totalMidias}</span> mídias
                              </div>
                              
                              {totalMidiasPages > 1 && (
                                <div className="flex items-center gap-1.5">
                                  {/* First page */}
                                  <button
                                    onClick={() => setCurrentMidiaPage(1)}
                                    disabled={currentMidiaPage === 1}
                                    className="p-1.5 rounded-lg border border-white/5 bg-white/5 text-slate-400 hover:text-white hover:border-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                    title="Primeira página"
                                  >
                                    <ChevronsLeft className="w-4 h-4" />
                                  </button>
                                  
                                  {/* Previous page */}
                                  <button
                                    onClick={() => setCurrentMidiaPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentMidiaPage === 1}
                                    className="p-1.5 rounded-lg border border-white/5 bg-white/5 text-slate-400 hover:text-white hover:border-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                    title="Página anterior"
                                  >
                                    <ChevronLeft className="w-4 h-4" />
                                  </button>

                                  {/* Page numbers */}
                                  <div className="hidden sm:flex items-center gap-1">
                                    {getMidiasPageNumbers().map(page => (
                                      <button
                                        key={page}
                                        onClick={() => setCurrentMidiaPage(page)}
                                        className={`w-8 h-8 rounded-lg border text-xs font-medium font-mono transition-all ${
                                          currentMidiaPage === page
                                            ? 'bg-amber-500 text-black border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.2)] font-semibold'
                                            : 'border-white/5 bg-white/5 text-slate-400 hover:text-white hover:border-white/10'
                                        }`}
                                      >
                                        {page}
                                      </button>
                                    ))}
                                  </div>

                                  {/* Mobile page indicator */}
                                  <div className="sm:hidden text-xs font-mono text-slate-400 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                                    {currentMidiaPage} / {totalMidiasPages}
                                  </div>

                                  {/* Next page */}
                                  <button
                                    onClick={() => setCurrentMidiaPage(prev => Math.min(totalMidiasPages, prev + 1))}
                                    disabled={currentMidiaPage === totalMidiasPages}
                                    className="p-1.5 rounded-lg border border-white/5 bg-white/5 text-slate-400 hover:text-white hover:border-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                    title="Próxima página"
                                  >
                                    <ChevronRight className="w-4 h-4" />
                                  </button>

                                  {/* Last page */}
                                  <button
                                    onClick={() => setCurrentMidiaPage(totalMidiasPages)}
                                    disabled={currentMidiaPage === totalMidiasPages}
                                    className="p-1.5 rounded-lg border border-white/5 bg-white/5 text-slate-400 hover:text-white hover:border-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                    title="Última página"
                                  >
                                    <ChevronsRight className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </main>

      {/* Modal de Edição de Mídia */}
      <AnimatePresence>
        {editingMidia && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#0f0f11] border border-white/10 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative"
            >
              <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Film className="w-5 h-5 text-amber-500" />
                  <h3 className="text-lg font-medium text-white">Editar Mídia</h3>
                </div>
                <button 
                  onClick={() => setEditingMidia(null)}
                  className="p-1.5 text-slate-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateMidiaSubmit} className="p-6 space-y-5">
                <div>
                  <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1.5">Título do Vídeo</label>
                  <input 
                    type="text" 
                    value={editForm.titulo_video}
                    onChange={e => setEditForm({...editForm, titulo_video: e.target.value})}
                    className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1.5">Tela de Destino</label>
                  <div className="relative">
                    <select 
                      value={editForm.tela_id}
                      onChange={e => setEditForm({...editForm, tela_id: e.target.value})}
                      className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all appearance-none cursor-pointer"
                      required
                    >
                      <option value="" disabled className="text-slate-500">Selecione a tela alvo...</option>
                      {telas.map(t => (
                        <option key={t.id} value={t.id}>{t.nome_local} ({t.identificador_unico})</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                      <ChevronRight className="w-4 h-4 rotate-90" />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest">Substituir Vídeo (Opcional)</label>
                    <span className="text-[9px] text-slate-600 uppercase font-mono">Manter atual se vazio</span>
                  </div>
                  <div className="relative border border-white/10 rounded-xl p-4 hover:border-amber-500/30 transition-colors bg-[#050505] group">
                    <input 
                      type="file" 
                      accept="video/*"
                      onChange={e => setEditFile(e.target.files?.[0] || null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="flex items-center gap-3">
                      <FileVideo className={`w-6 h-6 shrink-0 transition-colors ${editFile ? 'text-amber-500' : 'text-slate-600'}`} />
                      <div className="min-w-0 flex-1">
                        {editFile ? (
                          <>
                            <p className="text-xs font-medium text-white truncate">{editFile.name}</p>
                            <p className="text-[10px] text-amber-500/70 font-mono">
                              {(editFile.size / (1024 * 1024)).toFixed(2)} MB
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-xs font-medium text-slate-400">Clique para escolher outro vídeo</p>
                            <p className="text-[9px] text-slate-600 font-mono">MP4, WEBM (Max. 500MB)</p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-5 border-t border-white/5 flex items-center justify-end gap-3">
                  <button 
                    type="button"
                    onClick={() => setEditingMidia(null)}
                    className="px-5 py-2.5 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-white/5 font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={isUpdatingMidia}
                    className="bg-gradient-to-r from-amber-600 to-amber-500 text-black hover:from-amber-500 hover:to-amber-400 px-6 py-2.5 rounded-xl text-xs font-medium transition-all shadow-[0_0_15px_rgba(245,158,11,0.15)] flex items-center gap-1.5"
                  >
                    {isUpdatingMidia && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Salvar Alterações
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Conferência / Visualização de Mídia */}
      <AnimatePresence>
        {previewMidia && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#0f0f11] border border-white/10 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl relative"
            >
              <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between bg-[#131317]">
                <div className="flex items-center gap-2.5">
                  <Play className="w-5 h-5 text-amber-500 fill-amber-500/20" />
                  <div>
                    <h3 className="text-base font-medium text-white truncate max-w-[400px]" title={previewMidia.titulo_video}>
                      Conferência: {previewMidia.titulo_video}
                    </h3>
                    <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                      Cliente: {previewMidia.clientes?.nome_empresa || 'Sem Cliente'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setPreviewMidia(null)}
                  className="p-1.5 text-slate-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Player de Vídeo com controles completos habilitados */}
              <div className="bg-black aspect-video flex items-center justify-center relative group">
                {previewMidia.url_storage ? (
                  <video 
                    src={previewMidia.url_storage} 
                    className="w-full h-full object-contain" 
                    controls
                    autoPlay
                    playsInline
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-600 gap-3">
                    <FileVideo className="w-12 h-12 text-slate-700 animate-pulse" />
                    <p className="text-xs font-mono uppercase tracking-widest">URL de vídeo inválida</p>
                  </div>
                )}
              </div>

              {/* Footer Informativo */}
              <div className="px-6 py-4 border-t border-white/5 bg-[#131317] flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <Tv className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>
                    Destino: <span className="text-white font-medium">{previewMidia.playlists?.[0]?.telas ? `${previewMidia.playlists[0].telas.nome_local} (${previewMidia.playlists[0].telas.identificador_unico})` : 'Sem tela vinculada'}</span>
                  </span>
                </div>
                {previewMidia.tamanho_mb && (
                  <div className="font-mono text-[10px] text-slate-500 uppercase">
                    Tamanho: {previewMidia.tamanho_mb} MB
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notifications Container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
              className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-md max-w-sm ${
                toast.type === 'success' 
                  ? 'bg-emerald-950/80 border-emerald-500/30 text-emerald-200' 
                  : 'bg-red-950/80 border-red-500/30 text-red-200'
              }`}
            >
              {toast.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              )}
              <p className="text-sm leading-relaxed">{toast.message}</p>
            </motion.div>
          ))}
        </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
