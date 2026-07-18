import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DataTable, Column } from './DataTable';
import { Modal } from './Modal';
import { Loader2, Edit2, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';

export type Cliente = {
  id: string;
  nome_empresa: string;
  whatsapp: string;
  endereco_fisico: string;
  criado_em: string;
};

const formatWhatsApp = (value: string) => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 6) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  if (numbers.length <= 10) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
};

export function ClientesList({ showToast }: { showToast: (type: 'success' | 'error', msg: string) => void }) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ nome_empresa: '', whatsapp: '', endereco_fisico: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
      showToast('error', 'Erro ao carregar clientes.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClientes();

    const channel = supabase
      .channel('public:clientes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, () => {
        fetchClientes();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleOpenModal = (cliente?: Cliente) => {
    if (cliente) {
      setEditingId(cliente.id);
      setForm({
        nome_empresa: cliente.nome_empresa || '',
        whatsapp: cliente.whatsapp || '',
        endereco_fisico: cliente.endereco_fisico || ''
      });
    } else {
      setEditingId(null);
      setForm({ nome_empresa: '', whatsapp: '', endereco_fisico: '' });
    }
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
      if (editingId) {
        const { error } = await supabase
          .from('clientes')
          .update(form)
          .eq('id', editingId);
        if (error) throw error;
        showToast('success', 'Cliente atualizado com sucesso.');
      } else {
        const { error } = await supabase
          .from('clientes')
          .insert([form]);
        if (error) throw error;
        showToast('success', 'Cliente cadastrado com sucesso.');
      }
      setIsModalOpen(false);
      fetchClientes();
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
    c.nome_empresa?.toLowerCase().includes(search.toLowerCase()) ||
    c.whatsapp?.includes(search)
  );

  const columns: Column<Cliente>[] = [
    { key: 'nome_empresa', header: 'Nome da Empresa' },
    { key: 'whatsapp', header: 'WhatsApp' },
    { key: 'endereco_fisico', header: 'Endereço Físico' },
    { 
      key: 'criado_em', 
      header: 'Data de Criação', 
      render: (row) => row.criado_em ? new Date(row.criado_em).toLocaleDateString('pt-BR') : '-'
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
