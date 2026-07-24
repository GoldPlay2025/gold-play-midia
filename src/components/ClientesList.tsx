import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DataTable, Column } from './DataTable';
import { Modal } from './Modal';
import { Loader2, Edit2, Trash2, Monitor, X, Calendar, Film, Play, Tv, Check, Eye, ChevronRight, ExternalLink, MapPin, DollarSign, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PillProgressButton } from './PillProgressButton';

export type Cliente = {
  id: string;
  nome_empresa: string;
  whatsapp: string;
  endereco_fisico: string;
  criado_em: string;
  vencimento?: string;
  valor?: number;
};

const formatWhatsApp = (value: string) => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 6) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  if (numbers.length <= 10) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
};

const getClientIdsForTela = (tela: any): string[] => {
  if (!tela) return [];
  const enderecoStr = tela.endereco || '';
  if (enderecoStr.includes('|||')) {
    const parts = enderecoStr.split('|||');
    try {
      const ids = JSON.parse(parts[1]);
      if (Array.isArray(ids)) {
        return ids;
      }
    } catch (e) {
      console.error('Failed to parse client IDs from endereco:', e);
    }
  }
  return tela.cliente_id ? [tela.cliente_id] : [];
};

const getCleanEndereco = (endereco?: string): string => {
  if (!endereco) return '';
  if (endereco.includes('|||')) {
    return endereco.split('|||')[0];
  }
  return endereco;
};

export function ClientesList({ showToast }: { showToast: (type: 'success' | 'error', msg: string) => void }) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [telas, setTelas] = useState<any[]>([]);
  const [midias, setMidias] = useState<any[]>([]);
  const [linkedTelaIds, setLinkedTelaIds] = useState<string[]>([]);
  const [searchTelaQuery, setSearchTelaQuery] = useState('');
  const [showTelaDropdown, setShowTelaDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Slide Over Drawer State para Visão Detalhada Responsiva
  const [slideCliente, setSlideCliente] = useState<Cliente | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ nome_empresa: '', whatsapp: '', endereco_fisico: '', vencimento: '', valor: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchTelas = async () => {
    try {
      const { data, error } = await supabase
        .from('telas')
        .select(`
          *,
          playlists (
            id,
            ordem_exibicao,
            midias (
              id,
              titulo_video,
              url_storage
            )
          )
        `)
        .order('nome_local', { ascending: true });
      if (error) throw error;
      setTelas(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar telas:', error);
    }
  };

  const fetchMidias = async () => {
    try {
      const { data, error } = await supabase
        .from('midias')
        .select('*')
        .order('criado_em', { ascending: false });
      if (error) throw error;
      setMidias(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar mídias:', error);
    }
  };

  const fetchClientes = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('criado_em', { ascending: false });
      
      if (error) throw error;
      setClientes(data || []);
    } catch (error: any) {
      console.error(error);
      const errorMsg = error.message || error.details || JSON.stringify(error);
      showToast('error', `Erro ao carregar clientes: ${errorMsg}. Verifique as tabelas do Supabase.`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClientes();
    fetchTelas();
    fetchMidias();

    const channel = supabase
      .channel('public:clientes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, () => {
        fetchClientes();
      })
      .subscribe();

    const screensChannel = supabase
      .channel('public:telas_clientes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'telas' }, () => {
        fetchTelas();
      })
      .subscribe();

    const midiasChannel = supabase
      .channel('public:midias_clientes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'midias' }, () => {
        fetchMidias();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(screensChannel);
      supabase.removeChannel(midiasChannel);
    };
  }, []);

  const handleOpenModal = (cliente?: Cliente) => {
    if (cliente) {
      setEditingId(cliente.id);
      setForm({
        nome_empresa: cliente.nome_empresa || '',
        whatsapp: cliente.whatsapp || '',
        endereco_fisico: cliente.endereco_fisico || '',
        vencimento: cliente.vencimento || '',
        valor: cliente.valor ? cliente.valor.toString() : ''
      });
      const clientTelas = telas.filter(t => getClientIdsForTela(t).includes(cliente.id));
      setLinkedTelaIds(clientTelas.map(t => t.id));
    } else {
      setEditingId(null);
      setForm({ nome_empresa: '', whatsapp: '', endereco_fisico: '', vencimento: '', valor: '' });
      setLinkedTelaIds([]);
    }
    setSearchTelaQuery('');
    setShowTelaDropdown(false);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome_empresa || !form.whatsapp) {
      showToast('error', 'Nome e WhatsApp são obrigatórios.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...form,
        valor: form.valor ? parseFloat(form.valor.replace(',', '.')) : null,
        vencimento: form.vencimento || null
      };

      let clientId = editingId;
      if (editingId) {
        const { error } = await supabase
          .from('clientes')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
        showToast('success', 'Cliente atualizado com sucesso.');
      } else {
        const { data, error } = await supabase
          .from('clientes')
          .insert([payload])
          .select();
        if (error) throw error;
        clientId = data?.[0]?.id || null;
        showToast('success', 'Cliente cadastrado com sucesso.');
      }

      if (clientId) {
        const currentlyLinkedDb = telas.filter(t => getClientIdsForTela(t).includes(clientId));
        const currentlyLinkedDbIds = currentlyLinkedDb.map(t => t.id);

        const toLink = linkedTelaIds.filter(id => !currentlyLinkedDbIds.includes(id));
        const toUnlink = currentlyLinkedDbIds.filter(id => !currentlyLinkedDbIds.includes(id));

        // Link new screens to this client
        for (const screenId of toLink) {
          const screen = telas.find(t => t.id === screenId);
          if (screen) {
            const currentIds = getClientIdsForTela(screen);
            const newClientIds = Array.from(new Set([...currentIds, clientId]));
            const cleanAddr = getCleanEndereco(screen.endereco);
            const { error: linkErr } = await supabase
              .from('telas')
              .update({ 
                cliente_id: newClientIds[0], 
                endereco: cleanAddr + "|||" + JSON.stringify(newClientIds) 
              })
              .eq('id', screenId);
            if (linkErr) throw linkErr;
          }
        }

        // Unlink screens from this client
        for (const screenId of toUnlink) {
          const screen = telas.find(t => t.id === screenId);
          if (screen) {
            const currentIds = getClientIdsForTela(screen);
            const newClientIds = currentIds.filter(id => id !== clientId);
            const cleanAddr = getCleanEndereco(screen.endereco);
            if (newClientIds.length > 0) {
              const { error: unlinkErr } = await supabase
                .from('telas')
                .update({ 
                  cliente_id: newClientIds[0], 
                  endereco: cleanAddr + "|||" + JSON.stringify(newClientIds) 
                })
                .eq('id', screenId);
              if (unlinkErr) throw unlinkErr;
            }
          }
        }
      }

      setIsModalOpen(false);
      fetchClientes();
      fetchTelas();
    } catch (error: any) {
      console.error(error);
      showToast('error', 'Erro ao salvar cliente: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('clientes')
        .delete()
        .eq('id', deleteConfirmId);
      if (error) throw error;
      showToast('success', 'Cliente excluído com sucesso.');
      setDeleteConfirmId(null);
      fetchClientes();
    } catch (error: any) {
      console.error(error);
      showToast('error', 'Erro ao excluir cliente: ' + error.message);
    } finally {
      setIsDeleting(false);
    }
  };


  const filteredClientes = clientes.filter(c => 
    (c.nome_empresa || '').toLowerCase().includes((search || '').toLowerCase()) ||
    (c.whatsapp || '').includes(search || '')
  );

  const columns: Column<Cliente>[] = [
    { 
      key: 'nome_empresa', 
      header: 'Nome da Empresa',
      render: (row) => <span className="text-xs font-semibold text-slate-200">{row.nome_empresa}</span>
    },
    { 
      key: 'whatsapp', 
      header: 'WhatsApp / SMS',
      render: (row) => {
        if (!row.whatsapp) return '-';
        const rawNumbers = row.whatsapp.replace(/\D/g, '');
        const waLink = `https://wa.me/${rawNumbers.startsWith('55') ? rawNumbers : '55' + rawNumbers}`;
        return (
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span>{row.whatsapp}</span>
            <div className="flex items-center gap-1.5 shrink-0">
              <a 
                href={waLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-1 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded transition-all inline-flex items-center justify-center"
                title="Iniciar conversa no WhatsApp"
              >
                <img 
                  src="https://goldplaysky.com.br/whats.png" 
                  alt="WhatsApp" 
                  className="w-3.5 h-3.5 object-contain" 
                  referrerPolicy="no-referrer" 
                />
              </a>
            </div>
          </div>
        );
      }
    },
    { 
      key: 'endereco_fisico', 
      header: 'Endereço Físico',
      render: (row) => <span className="text-xs text-slate-400">{row.endereco_fisico || '-'}</span>
    },
    { 
      key: 'criado_em', 
      header: 'Data de Criação', 
      render: (row) => <span className="text-xs text-slate-500 font-mono">{row.criado_em ? new Date(row.criado_em).toLocaleDateString('pt-BR') : '-'}</span>
    },
    {
      key: 'actions',
      header: 'Ações',
      render: (row) => (
        <div className="flex items-center gap-2">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setSlideCliente(row);
            }}
            className="p-2 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
            title="Ver Detalhes em Slide"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              handleOpenModal(row);
            }}
            className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-500/10 rounded-lg transition-colors"
            title="Editar"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setDeleteConfirmId(row.id);
            }}
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
            title="Excluir"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  const availableTelas = telas.filter(t => 
    !linkedTelaIds.includes(t.id) &&
    ((t.nome_local || '').toLowerCase().includes((searchTelaQuery || '').toLowerCase()) ||
     (t.identificador_unico || '').toLowerCase().includes((searchTelaQuery || '').toLowerCase()))
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="max-w-6xl mx-auto"
    >
      <div className="mb-8">
        <h2 className="text-3xl font-display font-light text-white mb-2 tracking-tight">Clientes</h2>
        <p className="text-sm text-slate-500 font-light">Gerencie o cadastro de empresas no ecossistema.</p>
      </div>

      <DataTable
        title="Base de Clientes"
        data={filteredClientes}
        columns={columns}
        isLoading={isLoading}
        onAdd={() => handleOpenModal()}
        addActionLabel="Novo Cliente"
        onSearch={setSearch}
        renderMobileCard={(row) => (
          <div 
            onClick={() => setSlideCliente(row)}
            className="bg-[#0a0a0c] border border-white/10 p-4 rounded-xl space-y-3 cursor-pointer hover:border-amber-500/40 transition-all active:scale-[0.99] group shadow-lg"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-white text-base group-hover:text-amber-400 transition-colors flex items-center gap-2">
                  <span>{row.nome_empresa}</span>
                  <ChevronRight className="w-4 h-4 text-amber-400 opacity-80" />
                </h3>
                {row.endereco_fisico && (
                  <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{row.endereco_fisico}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {row.whatsapp && (
                  <a 
                    href={`https://wa.me/${row.whatsapp.replace(/\D/g, '').startsWith('55') ? row.whatsapp.replace(/\D/g, '') : '55' + row.whatsapp.replace(/\D/g, '')}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 text-emerald-500 hover:bg-emerald-500/10 rounded-lg"
                    title="WhatsApp"
                  >
                    <img 
                      src="https://goldplaysky.com.br/whats.png" 
                      alt="WhatsApp" 
                      className="w-4 h-4 object-contain" 
                      referrerPolicy="no-referrer" 
                    />
                  </a>
                )}
              </div>
            </div>
            
            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  Toque para Detalhes
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {telas.filter(t => getClientIdsForTela(t).includes(row.id)).length} Telas
                </span>
              </div>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <button 
                  onClick={() => handleOpenModal(row)}
                  className="p-2 text-slate-400 hover:text-amber-500 rounded-lg"
                  title="Editar"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setDeleteConfirmId(row.id)}
                  className="p-2 text-slate-400 hover:text-red-500 rounded-lg"
                  title="Excluir"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
        renderExpandedRow={(row) => {
          const clientTelas = telas.filter(t => getClientIdsForTela(t).includes(row.id));
          const clientMidias = midias.filter(m => m.cliente_id === row.id);
          const hasMidias = clientMidias.length > 0;
          const gridCols = hasMidias ? 'md:grid-cols-4' : 'md:grid-cols-3';

          return (
            <div className={`px-6 py-6 bg-[#0a0a0c]/80 rounded-2xl border border-white/5 mx-4 mb-4 mt-2 grid grid-cols-1 ${gridCols} gap-6 text-sm`}>
              {/* Vencimento */}
              <div className="flex flex-col gap-1.5">
                <span className="text-slate-500 text-[10px] font-mono uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-amber-500/70" /> Vencimento
                </span>
                <span className="text-slate-200 font-medium">
                  {row.vencimento ? new Date(row.vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-'}
                </span>
              </div>

              {/* Valor */}
              <div className="flex flex-col gap-1.5">
                <span className="text-slate-500 text-[10px] font-mono uppercase tracking-wider flex items-center gap-1">
                  <span className="text-emerald-500 font-bold">$</span> Valor / Mensalidade
                </span>
                <span className="text-emerald-400 font-medium font-mono text-base">
                  {row.valor != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.valor) : '-'}
                </span>
              </div>

              {/* Mídia Vinculada */}
              {hasMidias && (
                <div className="flex flex-col gap-2">
                  <span className="text-slate-500 text-[10px] font-mono uppercase tracking-wider flex items-center gap-1">
                    <Film className="w-3 h-3 text-amber-500/70" /> Mídia Vinculada
                  </span>
                  <div className="flex flex-col gap-2">
                    {clientMidias.map(m => (
                      <div key={m.id} className="flex items-center gap-3.5 bg-amber-500/[0.01] border border-amber-500/10 rounded-2xl p-2.5 hover:border-amber-500/30 transition-all group">
                        {/* Compact Video Thumbnail */}
                        <div className="w-14 h-14 rounded-xl bg-black overflow-hidden border border-white/10 shrink-0 flex items-center justify-center relative group/thumb">
                          {m.url_storage ? (
                            <video 
                              src={m.url_storage} 
                              className="w-full h-full object-cover"
                              muted
                              loop
                              playsInline
                              onMouseEnter={e => e.currentTarget.play()}
                              onMouseLeave={e => {
                                e.currentTarget.pause();
                                e.currentTarget.currentTime = 0;
                              }}
                            />
                          ) : (
                            <Film className="w-5 h-5 text-slate-700" />
                          )}
                          <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
                            <Play className="w-4 h-4 fill-amber-500 text-amber-500 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] transition-transform group-hover/thumb:scale-115" />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-slate-200 font-semibold truncate" title={m.titulo_video}>
                            {m.titulo_video}
                          </p>
                          <p className="text-[10px] font-mono text-slate-500 mt-1">
                            {m.tamanho_mb ? `${m.tamanho_mb} MB` : 'Vídeo'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Telas Associadas */}
              <div className="flex flex-col gap-2">
                <span className="text-slate-500 text-[10px] font-mono uppercase tracking-wider flex items-center gap-1">
                  <Monitor className="w-3 h-3 text-amber-500/70" /> Telas do Cliente ({clientTelas.length})
                </span>
                {clientTelas.length === 0 ? (
                  <span className="text-slate-600 text-xs italic font-light">Nenhuma tela vinculada</span>
                ) : (
                  <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/5">
                    {clientTelas.map(t => (
                      <div key={t.id} className="flex items-center justify-between gap-2 bg-white/[0.02] border border-white/5 rounded-xl px-3 py-2 text-xs hover:border-amber-500/30 transition-all">
                        <div className="flex items-center gap-2 min-w-0">
                          {/* Miniatura da mídia vinculada à tela */}
                          {t.playlists && t.playlists[0]?.midias && (
                             <div className="w-8 h-8 rounded-md bg-black overflow-hidden border border-white/10 shrink-0">
                                <video 
                                  src={t.playlists[0].midias.url_storage} 
                                  className="w-full h-full object-cover"
                                  muted
                                />
                             </div>
                          )}
                          <Tv className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="text-slate-300 font-medium truncate" title={t.nome_local}>
                            {t.nome_local}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 shrink-0 uppercase">
                          {t.identificador_unico}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        }}
      />

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingId ? 'Editar Cliente' : 'Novo Cliente'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-slate-500 uppercase tracking-widest mb-2">Nome da Empresa</label>
            <input 
              type="text" 
              value={form.nome_empresa}
              onChange={e => setForm({...form, nome_empresa: e.target.value})}
              className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all placeholder-slate-700"
              placeholder="Ex: Rede Alpha"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-slate-500 uppercase tracking-widest mb-2">WhatsApp</label>
            <input 
              type="text" 
              value={form.whatsapp}
              onChange={e => setForm({...form, whatsapp: formatWhatsApp(e.target.value)})}
              className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all placeholder-slate-700"
              placeholder="(00) 00000-0000"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-slate-500 uppercase tracking-widest mb-2">Endereço Físico</label>
            <input 
              type="text" 
              value={form.endereco_fisico}
              onChange={e => setForm({...form, endereco_fisico: e.target.value})}
              className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all placeholder-slate-700"
              placeholder="Rua, Número, Bairro, Cidade"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-slate-500 uppercase tracking-widest mb-2">Valor (R$)</label>
              <input 
                type="text"
                value={form.valor}
                onChange={e => setForm({...form, valor: e.target.value})}
                className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all placeholder-slate-700"
                placeholder="0,00"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-500 uppercase tracking-widest mb-2">Vencimento</label>
              <div className="relative">
                <input 
                  type="date"
                  value={form.vencimento}
                  onChange={e => setForm({...form, vencimento: e.target.value})}
                  className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                  <Calendar className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-500 uppercase tracking-widest mb-2">Vincular Telas</label>
            <div className="relative">
              <input 
                type="text"
                value={searchTelaQuery}
                onChange={e => {
                  setSearchTelaQuery(e.target.value);
                  setShowTelaDropdown(true);
                }}
                onFocus={() => setShowTelaDropdown(true)}
                className="w-full bg-[#050505] border border-white/10 rounded-xl pl-10 pr-4 py-3.5 text-sm text-white focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all placeholder-slate-600"
                placeholder="Pesquisa inteligente de telas por nome ou id..."
              />
              <Monitor className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              
              {showTelaDropdown && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowTelaDropdown(false)}
                  />
                  <div className="absolute left-0 right-0 mt-1.5 max-h-52 overflow-y-auto bg-[#0a0a0c] border border-white/10 rounded-xl shadow-2xl z-50 divide-y divide-white/5 scrollbar-thin scrollbar-thumb-white/10">
                    {availableTelas.length === 0 ? (
                      <div className="p-4 text-xs text-slate-500 text-center">Nenhuma tela disponível encontrada</div>
                    ) : (
                      availableTelas.map(t => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setLinkedTelaIds(prev => [...prev, t.id]);
                            setSearchTelaQuery('');
                            setShowTelaDropdown(false);
                          }}
                          className="w-full px-4 py-3 text-left text-sm text-slate-300 hover:bg-amber-500 hover:text-black transition-all flex items-center justify-between font-medium group"
                        >
                          <div className="flex items-center gap-3">
                            <Monitor className="w-4 h-4 text-slate-500 group-hover:text-black" />
                            <span>{t.nome_local}</span>
                          </div>
                          <span className="text-xs font-mono text-slate-500 group-hover:text-black/70">{t.identificador_unico}</span>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Linked Screens Badges */}
            {linkedTelaIds.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-2">Telas Vinculadas ({linkedTelaIds.length})</p>
                <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1 bg-white/[0.02] border border-white/5 rounded-xl">
                  {linkedTelaIds.map(id => {
                    const t = telas.find(screen => screen.id === id);
                    if (!t) return null;
                    return (
                      <div 
                        key={id} 
                        className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 px-3 py-1.5 rounded-lg text-xs font-medium"
                      >
                        <span>{t.nome_local} ({t.identificador_unico})</span>
                        <button
                          type="button"
                          onClick={() => setLinkedTelaIds(prev => prev.filter(item => item !== id))}
                          className="text-amber-500/50 hover:text-amber-500 hover:bg-amber-500/20 p-0.5 rounded-full transition-colors"
                          title="Desvincular tela"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          
          <div className="pt-4 border-t border-white/5 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <PillProgressButton
              type="submit"
              label={editingId ? 'Salvar Alterações' : 'Cadastrar Cliente'}
              loadingLabel={editingId ? 'Salvando...' : 'Cadastrando...'}
              icon={<Check className="w-4 h-4" />}
              variant="amber"
              isLoading={isSubmitting}
              disabled={isSubmitting}
            />
          </div>
        </form>
      </Modal>

      <Modal 
        isOpen={!!deleteConfirmId} 
        onClose={() => setDeleteConfirmId(null)} 
        title="Confirmar Exclusão"
      >
        <div className="space-y-6">
          <p className="text-slate-300 text-sm">
            Tem certeza que deseja excluir este cliente? Esta ação não poderá ser desfeita e pode afetar telas vinculadas.
          </p>
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
            <button
              onClick={() => setDeleteConfirmId(null)}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <PillProgressButton
              onClick={handleDelete}
              label="Excluir Cliente"
              loadingLabel="Excluindo..."
              icon={<Trash2 className="w-4 h-4" />}
              variant="rose"
              isLoading={isDeleting}
              disabled={isDeleting}
            />
          </div>
        </div>
      </Modal>

      {/* Slide-Over Drawer de Detalhes do Cliente (Modo Responsivo / Touch) */}
      <AnimatePresence>
        {slideCliente && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSlideCliente(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity"
            />

            <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
              <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 26, stiffness: 220 }}
                className="w-screen max-w-md bg-[#0c0c0e] border-l border-white/10 shadow-2xl flex flex-col justify-between overflow-y-auto"
              >
                {/* Header do Drawer */}
                <div className="p-6 border-b border-white/10 bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-transparent relative">
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 shadow-[0_0_12px_rgba(245,158,11,0.2)]">
                      <Tv className="w-3.5 h-3.5" />
                      Visão Detalhada em Slide
                    </span>
                    <button
                      onClick={() => setSlideCliente(null)}
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer active:scale-95"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <h3 className="text-2xl font-black text-white tracking-tight">{slideCliente.nome_empresa}</h3>
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                    <span>Cadastrado em {slideCliente.criado_em ? new Date(slideCliente.criado_em).toLocaleDateString('pt-BR') : '-'}</span>
                  </p>
                </div>

                {/* Conteúdo do Drawer */}
                <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                  {/* Card Financeiro & Contrato */}
                  <div className="bg-[#121216] border border-white/10 rounded-2xl p-4 space-y-3 shadow-lg">
                    <div className="flex justify-between items-center border-b border-white/5 pb-3">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-mono tracking-wider block">Mensalidade</span>
                        <span className="text-xl font-bold text-emerald-400 font-mono">
                          {slideCliente.valor != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(slideCliente.valor) : 'R$ 0,00'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 uppercase font-mono tracking-wider block">Vencimento</span>
                        <span className="text-xs font-semibold text-slate-200">
                          {slideCliente.vencimento ? new Date(slideCliente.vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'A combinar'}
                        </span>
                      </div>
                    </div>

                    {/* WhatsApp */}
                    {slideCliente.whatsapp && (
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-2 text-xs text-slate-300">
                          <img src="https://goldplaysky.com.br/whats.png" alt="WA" className="w-4 h-4 object-contain" referrerPolicy="no-referrer" />
                          <span className="font-mono">{slideCliente.whatsapp}</span>
                        </div>
                        <a
                          href={`https://wa.me/${slideCliente.whatsapp.replace(/\D/g, '').startsWith('55') ? slideCliente.whatsapp.replace(/\D/g, '') : '55' + slideCliente.whatsapp.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>Abrir WhatsApp</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}

                    {/* Endereço */}
                    {slideCliente.endereco_fisico && (
                      <div className="pt-2 border-t border-white/5 flex items-start gap-2 text-xs text-slate-400">
                        <MapPin className="w-4 h-4 text-amber-500/70 shrink-0 mt-0.5" />
                        <span>{slideCliente.endereco_fisico}</span>
                      </div>
                    )}
                  </div>

                  {/* Telas Vinculadas */}
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 font-mono">
                        <Monitor className="w-4 h-4 text-amber-400" />
                        Telas do Cliente ({telas.filter(t => getClientIdsForTela(t).includes(slideCliente.id)).length})
                      </h4>
                    </div>

                    {telas.filter(t => getClientIdsForTela(t).includes(slideCliente.id)).length === 0 ? (
                      <div className="p-4 rounded-xl border border-dashed border-white/10 text-center text-xs text-slate-500">
                        Nenhuma tela associada a este cliente.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {telas.filter(t => getClientIdsForTela(t).includes(slideCliente.id)).map(t => (
                          <div key={t.id} className="p-3 rounded-xl bg-white/[0.02] border border-white/10 flex items-center justify-between hover:border-amber-500/30 transition-all">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs shrink-0">
                                <Tv className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <h5 className="text-xs font-bold text-white truncate">{t.nome_local}</h5>
                                <span className="text-[10px] font-mono text-slate-500 uppercase">{t.identificador_unico}</span>
                              </div>
                            </div>
                            <span className="px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold shrink-0">
                              PUBLICADO
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Mídias do Cliente */}
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 font-mono">
                        <Film className="w-4 h-4 text-amber-400" />
                        Mídias & Vídeos ({midias.filter(m => m.cliente_id === slideCliente.id).length})
                      </h4>
                    </div>

                    {midias.filter(m => m.cliente_id === slideCliente.id).length === 0 ? (
                      <div className="p-4 rounded-xl border border-dashed border-white/10 text-center text-xs text-slate-500">
                        Nenhuma mídia enviada para este cliente.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {midias.filter(m => m.cliente_id === slideCliente.id).map(m => (
                          <div key={m.id} className="p-3 rounded-xl bg-white/[0.02] border border-white/10 flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg bg-black overflow-hidden border border-white/10 shrink-0 relative flex items-center justify-center">
                              {m.url_storage ? (
                                <video src={m.url_storage} className="w-full h-full object-cover" muted />
                              ) : (
                                <Film className="w-4 h-4 text-slate-600" />
                              )}
                              <Play className="w-3.5 h-3.5 text-amber-400 fill-amber-400 absolute" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h5 className="text-xs font-semibold text-white truncate">{m.titulo_video}</h5>
                              <span className="text-[10px] text-slate-500 font-mono">{m.tamanho_mb ? `${m.tamanho_mb} MB` : 'Vídeo'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer de Ações Rápidas */}
                <div className="p-4 border-t border-white/10 bg-[#070709] flex items-center justify-between gap-3">
                  <button
                    onClick={() => {
                      const clientToEdit = slideCliente;
                      setSlideCliente(null);
                      handleOpenModal(clientToEdit);
                    }}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
                  >
                    <Edit2 className="w-4 h-4" />
                    <span>Editar Cliente</span>
                  </button>

                  <button
                    onClick={() => {
                      const idToDelete = slideCliente.id;
                      setSlideCliente(null);
                      setDeleteConfirmId(idToDelete);
                    }}
                    className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-all cursor-pointer"
                    title="Excluir Cliente"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
