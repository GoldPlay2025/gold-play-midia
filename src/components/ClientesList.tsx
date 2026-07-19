import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DataTable, Column } from './DataTable';
import { Modal } from './Modal';
import { Loader2, Edit2, Trash2, Monitor, X, Calendar } from 'lucide-react';
import { motion } from 'motion/react';

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
  const [linkedTelaIds, setLinkedTelaIds] = useState<string[]>([]);
  const [searchTelaQuery, setSearchTelaQuery] = useState('');
  const [showTelaDropdown, setShowTelaDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  
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
        .select('*')
        .order('nome_local', { ascending: true });
      if (error) throw error;
      setTelas(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar telas:', error);
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

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(screensChannel);
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
        renderExpandedRow={(row) => (
          <div className="px-6 py-6 bg-[#0a0a0c]/80 rounded-xl border border-white/5 flex flex-col sm:flex-row gap-8 sm:gap-16 text-sm mx-4 mb-4 mt-2">
            <div className="flex flex-col gap-2">
              <span className="text-slate-500 text-[10px] font-mono uppercase tracking-wider">Vencimento</span>
              <span className="text-slate-300 font-medium">
                {row.vencimento ? new Date(row.vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-'}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-slate-500 text-[10px] font-mono uppercase tracking-wider">Valor</span>
              <span className="text-emerald-400 font-medium font-mono">
                {row.valor != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.valor) : '-'}
              </span>
            </div>
          </div>
        )}
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
          
          <div className="pt-4 border-t border-white/5 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="bg-gradient-to-r from-amber-600 to-amber-500 text-black hover:from-amber-500 hover:to-amber-400 px-6 py-2 rounded-xl text-sm font-medium transition-all shadow-[0_0_15px_rgba(245,158,11,0.2)] hover:shadow-[0_0_20px_rgba(245,158,11,0.4)] flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingId ? 'Salvar Alterações' : 'Cadastrar Cliente'}
            </button>
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
          <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
            <button
              onClick={() => setDeleteConfirmId(null)}
              className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button 
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-xl text-sm font-medium transition-all shadow-[0_0_15px_rgba(239,68,68,0.2)] flex items-center gap-2"
            >
              {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
              Excluir Cliente
            </button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}
