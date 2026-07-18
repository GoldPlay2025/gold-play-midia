import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DataTable, Column } from './DataTable';
import { Modal } from './Modal';
import { Loader2, Edit2, Trash2, Monitor } from 'lucide-react';
import { motion } from 'motion/react';
import { Cliente } from './ClientesList';

export type Tela = {
  id: string;
  nome_local: string;
  identificador_unico: string;
  status_online: boolean;
  cliente_id: string;
  endereco?: string;
  whatsapp?: string;
  clientes?: { nome_empresa: string };
};

const formatWhatsApp = (value: string) => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 6) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  if (numbers.length <= 10) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
};

export function TelasList({ showToast }: { showToast: (type: 'success' | 'error', msg: string) => void }) {
  const [telas, setTelas] = useState<Tela[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ nome_local: '', cliente_id: '', identificador_unico: '', endereco: '', whatsapp: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

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

    const channel = supabase
      .channel('public:telas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'telas' }, () => {
        fetchTelas();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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
      setForm({
        nome_local: tela.nome_local || '',
        cliente_id: tela.cliente_id || '',
        identificador_unico: tela.identificador_unico || '',
        endereco: tela.endereco || '',
        whatsapp: tela.whatsapp || ''
      });
    } else {
      setEditingId(null);
      setForm({ nome_local: '', cliente_id: '', identificador_unico: generateId(), endereco: '', whatsapp: '' });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome_local || !form.cliente_id) {
      showToast('error', 'Nome do local e cliente são obrigatórios.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from('telas')
          .update(form)
          .eq('id', editingId);
        if (error) throw error;
        showToast('success', 'Tela atualizada com sucesso.');
      } else {
        const { error } = await supabase
          .from('telas')
          .insert([{ ...form, status_online: false }]);
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

  const filteredTelas = telas.filter(t => 
    t.nome_local?.toLowerCase().includes(search.toLowerCase()) ||
    t.identificador_unico?.toLowerCase().includes(search.toLowerCase()) ||
    t.clientes?.nome_empresa?.toLowerCase().includes(search.toLowerCase())
  );

  const columns: Column<Tela>[] = [
    { key: 'nome_local', header: 'Nome do Local' },
    { key: 'endereco', header: 'Endereço', render: (row) => row.endereco || '-' },
    { key: 'whatsapp', header: 'WhatsApp', render: (row) => row.whatsapp || '-' },
    { 
      key: 'identificador_unico', 
      header: 'ID do Dispositivo',
      render: (row) => <span className="font-mono text-amber-500 bg-amber-500/10 px-2 py-1 rounded">{row.identificador_unico}</span>
    },
    { 
      key: 'cliente_id', 
      header: 'Cliente Vinculado',
      render: (row) => row.clientes?.nome_empresa || '-'
    },
    { 
      key: 'status_online', 
      header: 'Status Online',
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${row.status_online ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'}`} />
          <span className="text-xs text-slate-300">{row.status_online ? 'Online' : 'Offline'}</span>
        </div>
      )
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
            <label className="block text-xs font-mono text-slate-500 uppercase tracking-widest mb-2">Cliente Vinculado</label>
            <select 
              value={form.cliente_id}
              onChange={e => setForm({...form, cliente_id: e.target.value})}
              className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all appearance-none cursor-pointer"
              required
            >
              <option value="" disabled className="text-slate-500">Selecione o cliente...</option>
              {clientes.map(c => (
                <option key={c.id} value={c.id}>{c.nome_empresa}</option>
              ))}
            </select>
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
              {editingId ? 'Salvar Alterações' : 'Cadastrar Tela'}
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
            Tem certeza que deseja excluir esta tela? Esta ação não poderá ser desfeita e mídias vinculadas podem ser afetadas.
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
              Excluir Tela
            </button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}
