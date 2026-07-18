import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ClientesList } from '../components/ClientesList';
import { TelasList } from "../components/TelasList";
import { PerfilSettings, SystemSettings, defaultSettings } from "../components/PerfilSettings";
import { 
  LayoutDashboard,
  Users, 
  Monitor, 
  Plus, 
  Search, 
  Bell, 
  LogOut,
  ChevronRight,
  Activity,
  CheckCircle2,
  XCircle,
  Loader2,
  Lock,
  ArrowRight,
  Film,
  UploadCloud,
  FileVideo,
  Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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
  clientes?: { nome_empresa: string };
};

type Toast = {
  id: string;
  type: 'success' | 'error';
  message: string;
};

export default function AdminPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState(false);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'clientes' | 'telas' | 'nova-midia' | 'perfil'>('dashboard');
  const [telas, setTelas] = useState<Tela[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(() => {
    const saved = localStorage.getItem("gpm_system_settings");
    return saved ? JSON.parse(saved) : defaultSettings;
  });
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Form States
  const [clienteForm, setClienteForm] = useState({ nome: '', whatsapp: '', email: '' });
  const [telaForm, setTelaForm] = useState({ nome_local: '', identificador_unico: '', cliente_id: '' });
  const [midiaForm, setMidiaForm] = useState({ titulo_video: '', tela_id: '' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'maestro5') {
      setIsAuthenticated(true);
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
      showToast('error', 'Falha ao carregar dados. Verifique a conexão com o banco.');
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

  useEffect(() => {
    if (isAuthenticated) {
      if (activeTab === 'dashboard') {
        fetchDashboardData();
      } else if (activeTab === 'nova-tela') {
        fetchClientes();
      } else if (activeTab === 'nova-midia') {
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
        fetchDashboardData(); // Fetches both telas and clientes, which is needed for nova-midia dropdown
      }
    }
  }, [activeTab, isAuthenticated]);

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
              className="w-[300px] h-[300px] mx-auto rounded-2xl flex items-center justify-center mb-6 overflow-hidden shadow-[0_0_40px_rgba(245,158,11,0.2)]"
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

  return (
    <div className="min-h-screen bg-[#050505] text-slate-300 font-sans flex overflow-hidden selection:bg-amber-500/30 selection:text-amber-200">
      
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/5 bg-[#0a0a0a] flex flex-col relative z-20">
        <div className="py-8 flex flex-col items-center px-4 border-b border-white/5 text-center">
          <div className="w-[150px] flex items-center justify-center overflow-hidden mb-4">
            <img src={systemSettings.iconUrl || "/gpm.png"} alt={`${systemSettings.systemName} Icon`} className="w-full h-auto object-contain" />
          </div>
          <div>
            <h1 className="text-sm font-display font-bold text-white tracking-widest uppercase">{systemSettings.systemName}</h1>
            <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mt-0.5">Mídia Workspace</p>
          </div>
        </div>

        <div className="flex-1 py-8 px-4 flex flex-col gap-2">
          <p className="text-[10px] font-mono font-medium text-slate-600 uppercase tracking-widest px-4 mb-2">Operações</p>
          
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-300 ${
              activeTab === 'dashboard' 
                ? 'bg-white/10 text-white shadow-[inset_1px_0_0_rgba(245,158,11,1)]' 
                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </button>

          <button 
            onClick={() => setActiveTab('clientes')}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-300 ${
              activeTab === 'clientes' 
                ? 'bg-white/10 text-white shadow-[inset_1px_0_0_rgba(245,158,11,1)]' 
                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
            }`}
          >
            <Users className="w-4 h-4" />
            Clientes
          </button>

          <button 
            onClick={() => setActiveTab('telas')}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-300 ${
              activeTab === 'telas' 
                ? 'bg-white/10 text-white shadow-[inset_1px_0_0_rgba(245,158,11,1)]' 
                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
            }`}
          >
            <Monitor className="w-4 h-4" />
            Telas
          </button>

          <button 
            onClick={() => setActiveTab('nova-midia')}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-300 ${
              activeTab === 'nova-midia' 
                ? 'bg-white/10 text-white shadow-[inset_1px_0_0_rgba(245,158,11,1)]' 
                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
            }`}
          >
            <Film className="w-4 h-4" />
            Gerenciar Mídias
          </button>

          <button 
            onClick={() => setActiveTab('perfil')}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-300 ${
              activeTab === 'perfil' 
                ? 'bg-white/10 text-white shadow-[inset_1px_0_0_rgba(245,158,11,1)]' 
                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
            }`}
          >
            <Settings className="w-4 h-4" />
            Perfil
          </button>
        </div>

        <div className="p-6 border-t border-white/5">
          <button 
            onClick={() => {
              setIsAuthenticated(false);
              setPassword('');
            }}
            className="flex items-center gap-3 text-sm font-medium text-slate-600 hover:text-slate-300 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sair da Sessão
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-gradient-to-br from-[#050505] via-[#0a0a0c] to-[#050505]">
        
        {/* Top Header */}
        <header className="h-20 flex items-center justify-between px-10 border-b border-white/5 bg-[#0a0a0a]/50 backdrop-blur-md z-10">
          <div className="flex items-center gap-4">
            <div className="text-xs font-mono text-slate-500 flex items-center gap-2">
              <span>ADMIN</span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-slate-300 capitalize">
                {activeTab.replace('-', ' ')}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Buscar..." 
                className="bg-white/5 border border-white/10 rounded-full py-1.5 pl-9 pr-4 text-xs focus:outline-none focus:border-amber-500/50 focus:bg-white/10 transition-all w-64 text-white placeholder-slate-600"
              />
            </div>
            <button className="relative text-slate-500 hover:text-white transition-colors">
              <Bell className="w-4 h-4" />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500"></span>
            </button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-800 to-slate-700 border border-white/10"></div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-10 relative z-0">
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
                <div className="flex items-end justify-between mb-8">
                  <div>
                    <h2 className="text-3xl font-display font-light text-white mb-2 tracking-tight">Visão Geral</h2>
                    <p className="text-sm text-slate-500 font-light">Monitoramento da malha de telas em tempo real.</p>
                  </div>
                  <button 
                    onClick={() => setActiveTab('nova-tela')}
                    className="flex items-center gap-2 bg-white/10 hover:bg-white/15 border border-white/10 text-white px-5 py-2.5 rounded-lg text-sm transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar Tela
                  </button>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                  <div className="bg-[#0f0f11] border border-white/5 p-6 rounded-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                      <Monitor className="w-16 h-16 text-amber-500" />
                    </div>
                    <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-1">Total de Telas</p>
                    <p className="text-4xl font-display font-light text-white">{telas.length}</p>
                  </div>
                  <div className="bg-[#0f0f11] border border-white/5 p-6 rounded-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                      <Activity className="w-16 h-16 text-emerald-500" />
                    </div>
                    <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-1">Telas Online</p>
                    <p className="text-4xl font-display font-light text-white">
                      {telas.filter(t => t.status_online).length}
                    </p>
                  </div>
                  <div className="bg-[#0f0f11] border border-white/5 p-6 rounded-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                      <Users className="w-16 h-16 text-blue-500" />
                    </div>
                    <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-1">Clientes Ativos</p>
                    <p className="text-4xl font-display font-light text-white">{clientes.length}</p>
                  </div>
                </div>

                {/* Data Table */}
                <div className="bg-[#0f0f11] border border-white/5 rounded-2xl overflow-hidden shadow-2xl shadow-black/50">
                  <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
                    <h3 className="text-sm font-medium text-white">Telas Registradas</h3>
                    <button 
                      onClick={fetchDashboardData}
                      className="text-xs text-slate-500 hover:text-white transition-colors flex items-center gap-2"
                    >
                      {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Atualizar'}
                    </button>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-white/[0.02] border-b border-white/5 text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                          <th className="px-6 py-4 font-medium">Status</th>
                          <th className="px-6 py-4 font-medium">Local / Identificador</th>
                          <th className="px-6 py-4 font-medium">Cliente Vinculado</th>
                          <th className="px-6 py-4 font-medium text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {isLoading ? (
                          <tr>
                            <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 opacity-50" />
                              <span className="text-xs">Carregando dados estruturais...</span>
                            </td>
                          </tr>
                        ) : telas.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-6 py-12 text-center text-slate-500 text-sm">
                              Nenhuma tela cadastrada no sistema.
                            </td>
                          </tr>
                        ) : (
                          telas.map((tela) => (
                            <tr key={tela.id} className="hover:bg-white/[0.02] transition-colors group">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  <span className={`relative flex h-2.5 w-2.5`}>
                                    {tela.status_online && (
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    )}
                                    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${tela.status_online ? 'bg-emerald-500' : 'bg-slate-700'}`}></span>
                                  </span>
                                  <span className="text-xs font-medium text-slate-400">
                                    {tela.status_online ? 'Online' : 'Offline'}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium text-white">{tela.nome_local}</span>
                                  <span className="text-xs font-mono text-slate-500 mt-0.5">{tela.identificador_unico}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded bg-white/5 border border-white/10 flex items-center justify-center">
                                    <span className="text-[10px] font-bold text-slate-400">
                                      {tela.clientes?.nome_empresa?.charAt(0).toUpperCase() || '?'}
                                    </span>
                                  </div>
                                  <span className="text-sm text-slate-300">{tela.clientes?.nome_empresa || 'Desconhecido'}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button className="text-xs text-amber-500/70 hover:text-amber-400 opacity-0 group-hover:opacity-100 transition-all">
                                  Configurar
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
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
            {/* Nova Mídia Tab */}
            {activeTab === 'nova-midia' && (
              <motion.div 
                key="nova-midia"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="max-w-2xl mx-auto pt-10"
              >
                <div className="mb-10 text-center">
                  <div className="w-16 h-16 mx-auto bg-[#0f0f11] border border-white/10 rounded-2xl flex items-center justify-center mb-6 shadow-2xl">
                    <UploadCloud className="w-6 h-6 text-amber-500" />
                  </div>
                  <h2 className="text-3xl font-display font-light text-white mb-2">Gerenciar Mídias</h2>
                  <p className="text-sm text-slate-500 font-light">Faça upload de vídeos e vincule às telas de exibição.</p>
                </div>

                <form onSubmit={handleMidiaSubmit} className="bg-[#0f0f11] border border-white/5 p-8 rounded-3xl shadow-2xl shadow-black/50">
                  <div className="space-y-6">
                    <div>
                      <label className="block text-xs font-mono text-slate-500 uppercase tracking-widest mb-2">Título do Vídeo</label>
                      <input 
                        type="text" 
                        value={midiaForm.titulo_video}
                        onChange={e => setMidiaForm({...midiaForm, titulo_video: e.target.value})}
                        className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all placeholder-slate-700"
                        placeholder="Ex: Campanha Dia das Mães"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-mono text-slate-500 uppercase tracking-widest mb-2">Tela de Destino</label>
                      <select 
                        value={midiaForm.tela_id}
                        onChange={e => setMidiaForm({...midiaForm, tela_id: e.target.value})}
                        className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all appearance-none cursor-pointer"
                        required
                      >
                        <option value="" disabled className="text-slate-500">Selecione a tela alvo...</option>
                        {telas.map(t => (
                          <option key={t.id} value={t.id}>{t.nome_local} ({t.identificador_unico})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-mono text-slate-500 uppercase tracking-widest mb-2">Arquivo de Vídeo</label>
                      <div className="relative border-2 border-dashed border-white/10 rounded-2xl p-8 hover:border-amber-500/50 transition-colors bg-[#050505] group">
                        <input 
                          type="file" 
                          accept="video/*"
                          onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          required
                        />
                        <div className="flex flex-col items-center justify-center text-center">
                          <FileVideo className={`w-10 h-10 mb-4 transition-colors ${selectedFile ? 'text-amber-500' : 'text-slate-600 group-hover:text-amber-500/50'}`} />
                          {selectedFile ? (
                            <>
                              <p className="text-sm font-medium text-white mb-1">{selectedFile.name}</p>
                              <p className="text-xs text-amber-500/70 font-mono">
                                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="text-sm font-medium text-white mb-1">Arraste e solte o vídeo aqui</p>
                              <p className="text-xs text-slate-500">ou clique para procurar no computador</p>
                              <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest mt-4">MP4, WEBM (Max. 500MB)</p>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-10 pt-6 border-t border-white/5 flex justify-end">
                    <button 
                      type="submit"
                      disabled={isSubmitting} 
                      className="bg-gradient-to-r from-amber-600 to-amber-500 text-black hover:from-amber-500 hover:to-amber-400 px-8 py-3 rounded-xl text-sm font-medium transition-all shadow-[0_0_20px_rgba(245,158,11,0.2)] hover:shadow-[0_0_25px_rgba(245,158,11,0.4)] flex items-center gap-2"
                    >
                      {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                      Processar e Enviar
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </main>

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
  );
}
