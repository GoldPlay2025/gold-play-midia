import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DataTable, Column } from './DataTable';
import { Modal } from './Modal';
import { Loader2, Edit2, Trash2, Monitor, Copy, Check, Search, X, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { Cliente } from './ClientesList';
import { PillProgressButton } from './PillProgressButton';

export type Tela = {
  id: string;
  nome_local: string;
  identificador_unico: string;
  status_online: boolean;
  cliente_id: string;
  endereco?: string;
  whatsapp?: string;
  fully_device_id?: string;
  clientes?: { nome_empresa: string };
  playlists?: {
    id: string;
    ordem_exibicao: number;
    midias?: {
      id: string;
      titulo_video: string;
      url_storage: string;
    };
  }[];
};

const formatWhatsApp = (value: string) => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 6) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  if (numbers.length <= 10) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
};

export const getClientIdsForTela = (tela: any): string[] => {
  if (!tela) return [];
  const enderecoStr = typeof tela.endereco === 'string' ? tela.endereco : '';
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

export const getCleanEndereco = (endereco?: string): string => {
  if (!endereco || typeof endereco !== 'string') return '';
  if (endereco.includes('|||')) {
    return endereco.split('|||')[0];
  }
  return endereco;
};

export const getResponsavel = (endereco?: string): string => {
  if (!endereco || typeof endereco !== 'string') return '';
  if (endereco.includes('|||')) {
    const parts = endereco.split('|||');
    return parts[2] || '';
  }
  return '';
};

export function TelasList({ showToast }: { showToast: (type: 'success' | 'error', msg: string) => void }) {
  const [telas, setTelas] = useState<Tela[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [onlineScreenIds, setOnlineScreenIds] = useState<string[]>([]);
  const [showCopyModal, setShowCopyModal] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ nome_local: '', cliente_id: '', identificador_unico: '', endereco: '', whatsapp: '', responsavel: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchClientQuery, setSearchClientQuery] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [linkedClientIds, setLinkedClientIds] = useState<string[]>([]);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchTelas = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('telas')
        .select(`
          *,
          clientes (
            nome_empresa
          ),
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
      setTelas(data as Tela[] || []);
    } catch (error: any) {
      console.error(error);
      const errorMsg = error.message || error.details || JSON.stringify(error);
      showToast('error', `Erro ao carregar telas: ${errorMsg}. Verifique as tabelas do Supabase.`);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchClientes = async () => {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('nome_empresa', { ascending: true });
      
      if (error) throw error;
      setClientes(data || []);
    } catch (error: any) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchTelas();
    fetchClientes();

    let channel: any;
    let presenceChannel: any;

    try {
      channel = supabase
        .channel('public:telas')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'telas' }, () => {
          fetchTelas();
        })
        .subscribe();
    } catch (err) {
      console.error('Error establishing public:telas channel:', err);
    }

    try {
      presenceChannel = supabase.channel('telas-presence');
      presenceChannel
        .on('presence', { event: 'sync' }, () => {
          try {
            const state = (presenceChannel && typeof presenceChannel.presenceState === 'function') 
              ? presenceChannel.presenceState() 
              : {};
            const onlineIds = Object.keys(state || {});
            setOnlineScreenIds(onlineIds);
            console.log('Realtime screen presence update:', onlineIds);
          } catch (syncErr) {
            console.error('Error parsing presence state:', syncErr);
          }
        })
        .subscribe();
    } catch (err) {
      console.error('Error establishing presence channel:', err);
    }

    return () => {
      try {
        if (channel) supabase.removeChannel(channel);
        if (presenceChannel) supabase.removeChannel(presenceChannel);
      } catch (err) {
        console.error('Error removing channels:', err);
      }
    };
  }, []);

  const generateId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleOpenModal = (tela?: Tela) => {
    if (tela) {
      setEditingId(tela.id);
      const cleanAddr = getCleanEndereco(tela.endereco);
      const ids = getClientIdsForTela(tela);
      const resp = getResponsavel(tela.endereco);
      setForm({
        nome_local: tela.nome_local || '',
        cliente_id: tela.cliente_id || '',
        identificador_unico: tela.identificador_unico || '',
        endereco: cleanAddr,
        whatsapp: tela.whatsapp || '',
        responsavel: resp
      });
      setLinkedClientIds(ids);
    } else {
      setEditingId(null);
      setForm({ nome_local: '', cliente_id: '', identificador_unico: generateId(), endereco: '', whatsapp: '', responsavel: '' });
      setLinkedClientIds([]);
    }
    setSearchClientQuery('');
    setShowClientDropdown(false);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome_local) {
      showToast('error', 'Nome do local é obrigatório.');
      return;
    }
    if (linkedClientIds.length === 0) {
      showToast('error', 'Vincule pelo menos um cliente à tela.');
      return;
    }

    setIsSubmitting(true);
    try {
      const finalEndereco = form.endereco + "|||" + JSON.stringify(linkedClientIds) + "|||" + form.responsavel;
      const payload = {
        nome_local: form.nome_local,
        cliente_id: linkedClientIds[0], // Set first client as the primary one for foreign key constraints
        identificador_unico: form.identificador_unico,
        endereco: finalEndereco,
        whatsapp: form.whatsapp
      };

      if (editingId) {
        const { error } = await supabase
          .from('telas')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
        showToast('success', 'Tela atualizada com sucesso.');
      } else {
        const { error } = await supabase
          .from('telas')
          .insert([{ ...payload, status_online: false }]);
        if (error) throw error;
        showToast('success', 'Tela cadastrada com sucesso.');
      }
      setIsModalOpen(false);
      fetchTelas();
    } catch (error: any) {
      console.error(error);
      showToast('error', 'Erro ao salvar tela: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('telas')
        .delete()
        .eq('id', deleteConfirmId);
      if (error) throw error;
      showToast('success', 'Tela excluída com sucesso.');
      setDeleteConfirmId(null);
      fetchTelas();
    } catch (error: any) {
      console.error(error);
      showToast('error', 'Erro ao excluir tela: ' + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredTelas = (telas || []).filter(t => {
    if (!t) return false;
    const cleanAddr = getCleanEndereco(t.endereco);
    const clientNames = getClientIdsForTela(t)
      .map(id => (clientes || []).find(c => c && c.id === id)?.nome_empresa)
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const nomeLocal = (t.nome_local || '').toLowerCase();
    const identUnico = (t.identificador_unico || '').toLowerCase();
    const searchLower = (search || '').toLowerCase();

    return nomeLocal.includes(searchLower) ||
      cleanAddr.toLowerCase().includes(searchLower) ||
      identUnico.includes(searchLower) ||
      clientNames.includes(searchLower);
  });

  const columns: Column<Tela>[] = [
    { 
      key: 'nome_local', 
      header: 'Nome do Local',
      render: (row) => <span className="text-xs font-semibold text-slate-200">{row.nome_local || ''}</span>
    },
    { 
      key: 'identificador_unico', 
      header: 'ID do Dispositivo',
      render: (row) => {
        const handleCopy = () => {
          const url = `${window.location.origin}/player/${row.id}`;
          if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            navigator.clipboard.writeText(url)
              .then(() => {
                setCopiedId(row.id);
                setShowCopyModal(true);
                setTimeout(() => {
                  setShowCopyModal(false);
                }, 3000);
                setTimeout(() => setCopiedId(null), 2000);
              })
              .catch((err) => {
                console.error('Failed to copy text using navigator.clipboard:', err);
                fallbackCopy(url);
              });
          } else {
            fallbackCopy(url);
          }
        };

        const fallbackCopy = (textToCopy: string) => {
          try {
            const textarea = document.createElement('textarea');
            textarea.value = textToCopy;
            textarea.style.position = 'fixed'; // Avoid scrolling to bottom
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            setCopiedId(row.id);
            setShowCopyModal(true);
            setTimeout(() => {
              setShowCopyModal(false);
            }, 3000);
            setTimeout(() => setCopiedId(null), 2000);
          } catch (err) {
            console.error('Fallback copy failed:', err);
            showToast('error', `Não foi possível copiar automaticamente.`);
          }
        };

        return (
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">
              {row.identificador_unico || ''}
            </span>
            <button
              onClick={handleCopy}
              className={`p-1 rounded-md border transition-all shrink-0 ${
                copiedId === row.id
                  ? 'bg-green-500/10 border-green-500/30 text-green-400'
                  : 'bg-white/5 border-white/5 text-slate-400 hover:text-amber-500 hover:border-amber-500/30'
              }`}
              title="Copiar para ID do Dispositivo"
            >
              {copiedId === row.id ? (
                <Check className="w-3 h-3 animate-pulse" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
          </div>
        );
      }
    },
    { 
      key: 'cliente_id', 
      header: 'Clientes Vinculados',
      render: (row) => {
        const ids = getClientIdsForTela(row);
        const count = ids.length;
        if (count === 0) return '-';
        return (
          <div 
            className="flex items-center gap-1 font-semibold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-full w-fit text-xs font-mono" 
            title={`${count} cliente(s) vinculado(s)`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>{count}</span>
          </div>
        );
      }
    },
    {
      key: 'playlists',
      header: 'Mídia Veiculada',
      render: (row) => {
        const playlists = row.playlists || [];
        if (playlists.length === 0) {
          return <span className="text-xs text-slate-500 italic">Sem mídia</span>;
        }
        const activePlaylist = playlists[0];
        if (!activePlaylist) {
          return <span className="text-xs text-slate-500 italic">Sem mídia</span>;
        }
        const midia = activePlaylist.midias;
        if (!midia) {
          return <span className="text-xs text-slate-500 italic">Sem mídia</span>;
        }

        let tituloVideo = '';
        if (Array.isArray(midia)) {
          tituloVideo = midia[0]?.titulo_video || '';
        } else {
          tituloVideo = (midia as any).titulo_video || '';
        }

        if (!tituloVideo) {
          return <span className="text-xs text-slate-500 italic">Sem mídia</span>;
        }

        return (
          <div className="flex items-center gap-1.5 max-w-[150px]">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
            <span className="text-xs text-slate-200 truncate font-medium" title={tituloVideo}>
              {tituloVideo}
            </span>
          </div>
        );
      }
    },
    { 
      key: 'status_online', 
      header: 'STATUS',
      render: (row) => {
        const isOnline = (onlineScreenIds || []).includes(row.id) || row.status_online;
        return (
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]'}`} />
            <span className="text-xs text-slate-300">{isOnline ? 'Online' : 'PUBLICADO'}</span>
          </div>
        );
      }
    },
    {
      key: 'actions',
      header: 'Ações',
      render: (row) => (
        <div className="flex items-center gap-2">
          <button 
            onClick={() => handleOpenModal(row)}
            className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-500/10 rounded-lg transition-colors"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setDeleteConfirmId(row.id)}
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  const filteredSearchClientes = clientes.filter(c => 
    !linkedClientIds.includes(c.id) &&
    (c.nome_empresa || '').toLowerCase().includes((searchClientQuery || '').toLowerCase())
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
        <h2 className="text-3xl font-display font-light text-white mb-2 tracking-tight">Telas</h2>
        <p className="text-sm text-slate-500 font-light">Gerencie os players e pontos de exibição físicos.</p>
      </div>

      <DataTable
        title="Base de Telas"
        data={filteredTelas}
        columns={columns}
        isLoading={isLoading}
        onAdd={() => handleOpenModal()}
        addActionLabel="Nova Tela"
        onSearch={setSearch}
        renderMobileCard={(row) => {
          const isOnline = (onlineScreenIds || []).includes(row.id) || row.status_online;
          return (
            <div className="bg-[#0a0a0c] border border-white/5 p-4 rounded-xl space-y-3">
              <div className="flex justify-between items-start">
                <h3 className="font-semibold text-white">{row.nome_local}</h3>
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]'}`} />
                  <span className="text-[10px] text-slate-400 uppercase font-mono">{isOnline ? 'Online' : 'PUBLICADO'}</span>
                </div>
              </div>
              <div className="text-xs text-slate-500 font-mono">ID: {row.identificador_unico}</div>
              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <div className="text-xs text-slate-400">
                  {getClientIdsForTela(row).length} Clientes | {row.playlists?.length || 0} Mídias
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleOpenModal(row)}
                    className="p-2 text-slate-400 hover:text-amber-500 rounded-lg"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setDeleteConfirmId(row.id)}
                    className="p-2 text-slate-400 hover:text-red-500 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        }}
        renderExpandedRow={(row) => {
          const playlists = row.playlists || [];
          const activePlaylist = playlists[0];
          const midia = activePlaylist?.midias;
          
          let tituloVideo = '';
          let urlStorage = '';
          if (midia) {
            if (Array.isArray(midia)) {
              tituloVideo = midia[0]?.titulo_video || '';
              urlStorage = midia[0]?.url_storage || '';
            } else {
              tituloVideo = (midia as any).titulo_video || '';
              urlStorage = (midia as any).url_storage || '';
            }
          }

          return (
            <div className="px-6 py-6 bg-[#0a0a0c]/80 rounded-xl border border-white/5 flex flex-col sm:flex-row gap-8 sm:gap-16 text-sm mx-4 mb-4 mt-2">
              <div className="flex flex-col gap-2">
                <span className="text-slate-500 text-[10px] font-mono uppercase tracking-wider">Endereço</span>
                <span className="text-slate-300 font-medium">{getCleanEndereco(row.endereco) || '-'}</span>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-slate-500 text-[10px] font-mono uppercase tracking-wider">WhatsApp</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-300 font-medium">{row.whatsapp || '-'}</span>
                  {row.whatsapp && (
                    <a 
                      href={`https://wa.me/${row.whatsapp.replace(/\D/g, '').startsWith('55') ? row.whatsapp.replace(/\D/g, '') : '55' + row.whatsapp.replace(/\D/g, '')}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-1 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded transition-all inline-flex items-center justify-center shrink-0"
                      title="Iniciar conversa no WhatsApp"
                      onClick={(e) => e.stopPropagation()}
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
              <div className="flex flex-col gap-2">
                <span className="text-slate-500 text-[10px] font-mono uppercase tracking-wider">Responsável / Proprietário</span>
                <span className="text-slate-300 font-medium">{getResponsavel(row.endereco) || '-'}</span>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-slate-500 text-[10px] font-mono uppercase tracking-wider">Mídia Vinculada</span>
                {tituloVideo ? (
                  <div className="relative group w-32 h-20 rounded-lg overflow-hidden border border-white/10 shadow-lg cursor-pointer transition-all hover:scale-[1.02] hover:border-amber-500/30"
                    onClick={(e) => { e.stopPropagation(); window.open(urlStorage, '_blank'); }}
                  >
                    <video 
                      src={urlStorage}
                      className="w-full h-full object-cover"
                      muted
                      playsInline
                      preload="metadata"
                      onLoadedMetadata={(e) => {
                        (e.target as HTMLVideoElement).currentTime = 1;
                      }}
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-white text-xs font-medium px-2 py-1 bg-black/50 rounded">Visualizar</span>
                    </div>
                  </div>
                ) : (
                  <div className="w-32 h-20 rounded-lg border border-dashed border-white/10 bg-white/5 flex flex-col items-center justify-center gap-1">
                    <span className="text-slate-600 text-[10px]">Nenhuma</span>
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
        title={editingId ? 'Editar Tela' : 'Nova Tela'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-slate-500 uppercase tracking-widest mb-2">Nome do Local</label>
            <input 
              type="text" 
              value={form.nome_local}
              onChange={e => setForm({...form, nome_local: e.target.value})}
              className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all placeholder-slate-700"
              placeholder="Ex: Recepção Matriz"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-slate-500 uppercase tracking-widest mb-2">Clientes Vinculados</label>
            
            <div className="relative mb-3">
              <input 
                type="text"
                value={searchClientQuery}
                onChange={e => {
                  setSearchClientQuery(e.target.value);
                  setShowClientDropdown(true);
                }}
                onFocus={() => setShowClientDropdown(true)}
                className="w-full bg-[#050505] border border-white/10 rounded-xl pl-10 pr-4 py-3.5 text-sm text-white focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all placeholder-slate-600"
                placeholder="Pesquisa inteligente por nome do cliente..."
              />
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              
              {showClientDropdown && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowClientDropdown(false)}
                  />
                  <div className="absolute left-0 right-0 mt-1.5 max-h-52 overflow-y-auto bg-[#0a0a0c] border border-white/10 rounded-xl shadow-2xl z-50 divide-y divide-white/5 scrollbar-thin scrollbar-thumb-white/10">
                    {filteredSearchClientes.length === 0 ? (
                      <div className="p-4 text-xs text-slate-500 text-center">Nenhum cliente disponível encontrado</div>
                    ) : (
                      filteredSearchClientes.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setLinkedClientIds(prev => [...prev, c.id]);
                            setSearchClientQuery('');
                            setShowClientDropdown(false);
                          }}
                          className="w-full px-4 py-3 text-left text-sm text-slate-300 hover:bg-amber-500 hover:text-black transition-all flex items-center gap-3 font-medium"
                        >
                          <div className="w-5 h-5 rounded bg-white/5 text-slate-400 flex items-center justify-center text-[10px] font-bold font-mono">
                            {c.nome_empresa?.charAt(0).toUpperCase()}
                          </div>
                          <span>{c.nome_empresa}</span>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Badges list */}
            {linkedClientIds.length > 0 ? (
              <div className="flex flex-wrap gap-2 p-2 bg-[#050505] border border-white/10 rounded-xl max-h-36 overflow-y-auto">
                {linkedClientIds.map(id => {
                  const client = clientes.find(c => c.id === id);
                  if (!client) return null;
                  return (
                    <div 
                      key={id} 
                      className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 px-3 py-1.5 rounded-lg text-xs font-medium"
                    >
                      <div className="w-4 h-4 rounded bg-amber-500/20 text-amber-500 flex items-center justify-center text-[9px] font-bold font-mono">
                        {client.nome_empresa?.charAt(0).toUpperCase()}
                      </div>
                      <span>{client.nome_empresa}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setLinkedClientIds(prev => prev.filter(item => item !== id));
                        }}
                        className="text-amber-500/50 hover:text-amber-500 hover:bg-amber-500/20 p-0.5 rounded transition-colors"
                        title="Desvincular cliente"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-slate-500 italic p-3 bg-[#050505] border border-white/5 rounded-xl text-center">
                Nenhum cliente vinculado ainda. Use a barra de pesquisa acima para adicionar.
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-mono text-slate-500 uppercase tracking-widest mb-2">WhatsApp do Local</label>
            <input 
              type="text" 
              value={form.whatsapp}
              onChange={e => setForm({...form, whatsapp: formatWhatsApp(e.target.value)})}
              className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all placeholder-slate-700"
              placeholder="(00) 00000-0000"
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-slate-500 uppercase tracking-widest mb-2">Nome do Responsável / Proprietário</label>
            <input 
              type="text" 
              value={form.responsavel}
              onChange={e => setForm({...form, responsavel: e.target.value})}
              className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all placeholder-slate-700"
              placeholder="Nome do responsável"
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-slate-500 uppercase tracking-widest mb-2">Endereço do Local</label>
            <input 
              type="text" 
              value={form.endereco}
              onChange={e => setForm({...form, endereco: e.target.value})}
              className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all placeholder-slate-700"
              placeholder="Rua, Número, Bairro, Cidade"
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-slate-500 uppercase tracking-widest mb-2">ID do Dispositivo</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={form.identificador_unico}
                readOnly
                className="w-full bg-[#0a0a0a] border border-white/5 rounded-xl px-4 py-3.5 text-sm text-slate-400 focus:outline-none cursor-not-allowed font-mono"
              />
              {!editingId && (
                <button
                  type="button"
                  onClick={() => setForm({...form, identificador_unico: generateId()})}
                  className="px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-300 transition-colors"
                  title="Gerar novo ID"
                >
                  Gerar
                </button>
              )}
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              {!editingId ? "Código alfanumérico gerado automaticamente." : "O ID do dispositivo não pode ser alterado após o cadastro."}
            </p>
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
              label={editingId ? 'Salvar Alterações' : 'Cadastrar Tela'}
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
            Tem certeza que deseja excluir esta tela? Esta ação não poderá ser desfeita e mídias vinculadas podem ser afetadas.
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
              label="Excluir Tela"
              loadingLabel="Excluindo..."
              icon={<Trash2 className="w-4 h-4" />}
              variant="rose"
              isLoading={isDeleting}
              disabled={isDeleting}
            />
          </div>
        </div>
      </Modal>

      <Modal 
        isOpen={showCopyModal} 
        onClose={() => setShowCopyModal(false)} 
        title="Link Copiado!"
      >
        <div className="flex flex-col items-center justify-center text-center py-6 space-y-4">
          <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.1)]">
            <Check className="w-8 h-8" />
          </div>
          <h4 className="text-xl font-display font-light text-white">Pronto! Cole o link no App de Mídia!</h4>
          <p className="text-sm text-slate-400 font-light max-w-sm">
            O link de reprodução para esta tela foi copiado para sua área de transferência. Agora você pode colá-lo no seu player.
          </p>
        </div>
      </Modal>
    </motion.div>
  );
}
