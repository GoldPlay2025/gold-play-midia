import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DataTable, Column } from './DataTable';
import { Modal } from './Modal';
import { Loader2, Edit2, Trash2, Monitor, X, Calendar, Film, Play, Tv, Check, Eye, ChevronRight, ExternalLink, MapPin, DollarSign, AlertTriangle, CheckCircle2, Copy, Image as ImageIcon, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PillProgressButton } from './PillProgressButton';

export type Cliente = {
  id: string;
  nome_empresa: string;
  whatsapp: string;
  email?: string;
  telefone?: string;
  contato?: string;
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

const getDaysToVencimento = (vencimento?: string) => {
  if (!vencimento) return 999;
  
  const today = new Date();
  const utcToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  
  const vDate = new Date(vencimento);
  const utcVDate = Date.UTC(vDate.getUTCFullYear(), vDate.getUTCMonth(), vDate.getUTCDate());
  
  const diffTime = utcVDate - utcToday;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const getVencimentoStatus = (vencimento?: string) => {
  if (!vencimento) return 'ok';
  const diffDays = getDaysToVencimento(vencimento);
  
  if (diffDays < 0) return 'vencido';
  if (diffDays <= 3) return 'vencendo';
  return 'ok';
};

const getCobrancaText = (cliente: Cliente, sysSettings: any) => {
  const vencStr = cliente.vencimento ? new Date(cliente.vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-';
  const valorStr = cliente.valor != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cliente.valor) : '-';
  const pixKeyStr = sysSettings?.pixKey || 'Não configurada';

  return `Olá *${cliente.nome_empresa}!*

• 𝑷𝒂𝒔𝒔𝒂𝒏𝒅𝒐 𝒑𝒂𝒓𝒂 𝒍𝒆𝒎𝒃𝒓𝒂𝒓 𝒒𝒖𝒆 𝒔𝒖𝒂 𝒎𝒆𝒏𝒔𝒂𝒍𝒊𝒅𝒂𝒅𝒆:

*GOLD MÍDIAS*
---------------------
• Vence: ${vencStr}
• Valor: ${valorStr}

╰⊱❖ Gold Play ❖⊱╯

Pagamento:
Pix:
${pixKeyStr}

• Estamos à disposição.`;
};

const getSmsCobrancaText = (cliente: Cliente, sysSettings: any) => {
  const vencStr = cliente.vencimento ? new Date(cliente.vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-';
  const valorStr = cliente.valor != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cliente.valor) : '-';
  const pixKeyStr = sysSettings?.pixKey || 'N/A';
  return `Gold Midias: Mensalidade de ${valorStr} vence dia ${vencStr}. Pix para pgto: ${pixKeyStr}. Ignore se ja pago.`;
};

const getEmailCobrancaHtml = (cliente: Cliente, sysSettings: any) => {
  const vencStr = cliente.vencimento ? new Date(cliente.vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-';
  const valorStr = cliente.valor != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cliente.valor) : '-';
  const pixKeyStr = sysSettings?.pixKey || 'Não configurada';

  return `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0f0f11; color: #f8fafc; border-radius: 16px; overflow: hidden; border: 1px solid #1e293b;">
    <div style="background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%); padding: 28px 20px; text-align: center; border-bottom: 2px solid #f59e0b;">
      <h1 style="color: #f59e0b; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 1px;">GOLD PLAY DIGITAL SIGNAGE</h1>
      <p style="color: #94a3b8; font-size: 13px; margin-top: 6px;">Aviso de Cobrança de Mensalidade</p>
    </div>
    <div style="padding: 24px 20px;">
      <p style="font-size: 15px; color: #e2e8f0; margin-bottom: 16px;">Olá, <strong style="color: #ffffff;">${cliente.nome_empresa}</strong>!</p>
      <p style="font-size: 13px; color: #94a3b8; line-height: 1.6; margin-bottom: 20px;">Lembrando sobre o vencimento da mensalidade referente ao serviço de mídia digital em suas telas.</p>
      
      <div style="background-color: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 18px; margin-bottom: 20px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr>
            <td style="color: #a1a1aa; padding-bottom: 8px;">Empresa:</td>
            <td style="color: #ffffff; font-weight: 600; text-align: right; padding-bottom: 8px;">${cliente.nome_empresa}</td>
          </tr>
          <tr>
            <td style="color: #a1a1aa; padding-bottom: 8px;">Data de Vencimento:</td>
            <td style="color: #f87171; font-weight: 700; text-align: right; padding-bottom: 8px;">${vencStr}</td>
          </tr>
          <tr>
            <td style="color: #a1a1aa;">Valor Mensal:</td>
            <td style="color: #34d399; font-weight: 800; font-size: 16px; text-align: right;">${valorStr}</td>
          </tr>
        </table>
      </div>

      <div style="background-color: #1e1b18; border: 1px solid #78350f; border-radius: 12px; padding: 16px; text-align: center; margin-bottom: 20px;">
        <p style="color: #fbbf24; font-size: 11px; font-weight: 700; text-transform: uppercase; margin: 0 0 6px 0;">Chave PIX para Pagamento</p>
        <p style="color: #ffffff; font-family: monospace; font-size: 14px; font-weight: 700; background: #000; padding: 8px 12px; border-radius: 8px; margin: 0; word-break: break-all;">${pixKeyStr}</p>
      </div>

      <p style="font-size: 12px; color: #64748b; text-align: center;">Após o pagamento, envie o comprovante para nosso atendimento. Agradecemos!</p>
    </div>
    <div style="background-color: #09090b; padding: 14px; text-align: center; border-top: 1px solid #18181b; font-size: 11px; color: #475569;">
      © ${new Date().getFullYear()} GOLD PLAY • Sistema de Mídia Indoor
    </div>
  </div>`;
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
  const [renewingId, setRenewingId] = useState<string | null>(null);
  const [renewSuccessId, setRenewSuccessId] = useState<string | null>(null);
  const [cobrancaModalOpen, setCobrancaModalOpen] = useState(false);
  const [cobrancaCliente, setCobrancaCliente] = useState<Cliente | null>(null);
  const [smsModalOpen, setSmsModalOpen] = useState(false);
  const [smsCliente, setSmsCliente] = useState<Cliente | null>(null);
  const [smsText, setSmsText] = useState("");
  const [isSendingSms, setIsSendingSms] = useState(false);

  // Email Modal State
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailCliente, setEmailCliente] = useState<Cliente | null>(null);
  const [emailDestination, setEmailDestination] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const [settings, setSettings] = useState<any>(null);

  const fetchSettings = async () => {
    try {
      let localObj: any = {};
      const local = typeof window !== 'undefined' ? localStorage.getItem('gpm_system_settings') : null;
      if (local) {
        try { localObj = JSON.parse(local); } catch(e){}
      }
      const { data } = await supabase.from('configuracoes').select('*').eq('id', 'sistema').maybeSingle();
      const merged = {
        pixKey: data?.pix_key || localObj?.pixKey || '',
        pixReceiver: data?.pix_receiver || localObj?.pixReceiver || '',
        systemName: data?.system_name || localObj?.systemName || 'GOLD PLAY',
        smtpEmail: data?.smtp_email || localObj?.smtpEmail || '',
        smtpPassword: data?.smtp_password || localObj?.smtpPassword || '',
        smtpPort: data?.smtp_port || localObj?.smtpPort || '587',
        smtpHost: data?.smtp_host || localObj?.smtpHost || 'smtp.gmail.com',
      };
      setSettings(merged);
    } catch(e) {}
  };

  const handleSendEmail = async () => {
    if (!emailDestination) {
      showToast('error', 'Informe o e-mail de destino.');
      return;
    }
    setIsSendingEmail(true);
    try {
      const htmlBody = getEmailCobrancaHtml(emailCliente!, settings);
      const resp = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: emailDestination,
          subject: emailSubject || `Cobrança de Mensalidade - ${emailCliente?.nome_empresa}`,
          html: htmlBody,
          smtpEmail: settings?.smtpEmail,
          smtpPassword: settings?.smtpPassword,
          smtpPort: settings?.smtpPort,
          smtpHost: settings?.smtpHost,
        })
      });
      const data = await resp.json().catch(() => ({ error: `Resposta inválida HTTP ${resp.status}` }));
      if (resp.ok && data.success) {
        showToast('success', `E-mail de cobrança enviado com sucesso para ${emailDestination}!`);
        setEmailModalOpen(false);
        setEmailCliente(null);
      } else {
        showToast('error', data.error || data.message || 'Falha ao enviar e-mail.');
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Erro ao conectar ao serviço de e-mail.');
    } finally {
      setIsSendingEmail(false);
    }
  };

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
    fetchSettings();
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
        const toUnlink = currentlyLinkedDbIds.filter(id => !linkedTelaIds.includes(id));

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
            } else {
              const { error: unlinkErr } = await supabase
                .from('telas')
                .update({ 
                  cliente_id: null, 
                  endereco: cleanAddr 
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

  const handleRenewPayment = async (cliente: Cliente) => {
    setRenewingId(cliente.id);
    setRenewSuccessId(null);
    try {
      const currentVencimento = cliente.vencimento ? new Date(cliente.vencimento) : new Date();
      currentVencimento.setUTCMonth(currentVencimento.getUTCMonth() + 1);
      const newVencimento = currentVencimento.toISOString().split('T')[0];

      const { error } = await supabase
        .from('clientes')
        .update({ vencimento: newVencimento })
        .eq('id', cliente.id);

      if (error) throw error;
      
      setRenewingId(null);
      setRenewSuccessId(cliente.id);
      setTimeout(() => {
        setRenewSuccessId(null);
      }, 3000);
      
      fetchClientes();
    } catch (error: any) {
      console.error('Error renewing:', error);
      setRenewingId(null);
      showToast('error', 'Erro ao confirmar pagamento: ' + error.message);
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
      render: (row) => {
        const status = getVencimentoStatus(row.vencimento);
        return (
          <div className="flex items-center w-[240px]">
            <span className="text-xs font-semibold text-slate-200 truncate flex-1 pr-4">{row.nome_empresa}</span>
            <div className="w-[80px] flex items-center justify-center">
              {status === 'vencido' && (
                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-gradient-to-r from-rose-600 to-rose-500 text-white shadow-lg shadow-rose-500/20 border border-rose-400/20">Vencido</span>
              )}
              {status === 'vencendo' && (
                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-gradient-to-r from-orange-600 to-orange-500 text-white shadow-lg shadow-orange-500/20 border border-orange-400/20">Vencendo</span>
              )}
            </div>
          </div>
        );
      }
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
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <span className="text-slate-500 text-[10px] font-mono uppercase tracking-wider flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-amber-500/70" /> Vencimento
                  </span>
                  <span className={`font-medium ${
                    getVencimentoStatus(row.vencimento) === 'vencido' ? 'text-rose-400' :
                    getVencimentoStatus(row.vencimento) === 'vencendo' ? 'text-orange-400' :
                    'text-slate-200'
                  }`}>
                    {row.vencimento ? new Date(row.vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-'}
                  </span>
                </div>
                
                {renewSuccessId === row.id ? (
                  <div className="h-8 px-3 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center gap-1.5 text-emerald-400 text-[11px] font-bold w-fit shadow-inner whitespace-nowrap">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Renovado!
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    <PillProgressButton
                      label="Enviar Cobrança"
                      onClick={() => {
                        setCobrancaCliente(row);
                        setCobrancaModalOpen(true);
                      }}
                      variant="blue"
                      className="h-7 px-2.5 text-[10px] font-bold tracking-tight whitespace-nowrap"
                    />
                    <PillProgressButton
                      label="SMS"
                      onClick={() => {
                        setSmsCliente(row);
                        setSmsText(getSmsCobrancaText(row, settings));
                        setSmsModalOpen(true);
                      }}
                      variant="slate"
                      className="h-7 px-2.5 text-[10px] font-bold tracking-tight whitespace-nowrap"
                    />
                    <PillProgressButton
                      label="E-mail"
                      onClick={() => {
                        setEmailCliente(row);
                        setEmailDestination(row.email || settings?.smtpEmail || '');
                        setEmailSubject(`Cobrança de Mensalidade - ${row.nome_empresa}`);
                        setEmailModalOpen(true);
                      }}
                      variant="amber"
                      className="h-7 px-2.5 text-[10px] font-bold tracking-tight whitespace-nowrap"
                    />
                    <PillProgressButton
                      label="Confirmar Pagamento"
                      loadingLabel="Renovando..."
                      isLoading={renewingId === row.id}
                      onClick={() => handleRenewPayment(row)}
                      variant="emerald"
                      className="h-7 px-2.5 text-[10px] font-bold tracking-tight whitespace-nowrap"
                      disabled={getDaysToVencimento(row.vencimento) > 5}
                    />
                  </div>
                )}
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

      {/* Modal de Enviar Cobrança */}
      <Modal
        isOpen={cobrancaModalOpen}
        onClose={() => {
          setCobrancaModalOpen(false);
          setCobrancaCliente(null);
        }}
        title="Enviar Cobrança"
      >
        {cobrancaCliente && (
          <div className="space-y-6">
            {/* iPhone Mockup Preview */}
            <div className="mx-auto w-[320px] max-w-full bg-[#1c1c1e] rounded-[40px] border-[8px] border-[#0a0a0c] overflow-hidden shadow-xl shadow-black relative pb-6">
              {/* Notch */}
              <div className="absolute top-0 inset-x-0 h-6 bg-[#0a0a0c] rounded-b-3xl w-40 mx-auto z-10" />
              
              {/* Screen Content */}
              <div className="bg-[#1c1c1e] h-full pt-10 px-4 flex flex-col gap-3">
                <div className="flex items-center gap-3 pb-3 border-b border-white/10">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <img src="https://goldplaysky.com.br/whats.png" className="w-6 h-6 object-contain" alt="WA" />
                  </div>
                  <div>
                    <div className="text-white text-sm font-semibold">{cobrancaCliente.nome_empresa}</div>
                    <div className="text-emerald-500 text-[10px] font-medium">Online</div>
                  </div>
                </div>

                {/* Message Bubble */}
                <div className="bg-[#26252a] rounded-2xl rounded-tl-sm p-3 w-full shadow-md">
                  <div className="text-white text-[12px] leading-relaxed whitespace-pre-wrap font-sans">
                    {getCobrancaText(cobrancaCliente, settings)}
                  </div>
                  <div className="text-[10px] text-white/50 text-right mt-2">Agora</div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
              <button
                onClick={() => {
                  setCobrancaModalOpen(false);
                  setCobrancaCliente(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <PillProgressButton
                onClick={() => {
                  if (!cobrancaCliente.whatsapp) {
                    showToast('error', 'Cliente sem WhatsApp cadastrado.');
                    return;
                  }
                  
                  const msg = getCobrancaText(cobrancaCliente, settings);
                  const rawNumbers = cobrancaCliente.whatsapp.replace(/\D/g, '');
                  const waLink = `https://wa.me/${rawNumbers.startsWith('55') ? rawNumbers : '55' + rawNumbers}?text=${encodeURIComponent(msg)}`;
                  window.open(waLink, '_blank');
                  setCobrancaModalOpen(false);
                }}
                label="Enviar WhatsApp"
                icon={<CheckCircle2 className="w-4 h-4" />}
                variant="emerald"
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Modal de Enviar SMS */}
      <Modal
        isOpen={smsModalOpen}
        onClose={() => {
          setSmsModalOpen(false);
          setSmsCliente(null);
        }}
        title="Enviar SMS de Cobrança"
      >
        {smsCliente && (
          <div className="space-y-6">
            <div className="mx-auto w-[320px] max-w-full bg-[#1c1c1e] rounded-[40px] border-[8px] border-[#0a0a0c] overflow-hidden shadow-xl shadow-black relative pb-6">
              <div className="absolute top-0 inset-x-0 h-6 bg-[#0a0a0c] rounded-b-3xl w-40 mx-auto z-10" />
              
              <div className="bg-[#1c1c1e] h-full pt-10 px-4 flex flex-col gap-3">
                <div className="flex items-center gap-3 pb-3 border-b border-white/10">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <span className="text-blue-400 text-xs font-bold">SMS</span>
                  </div>
                  <div>
                    <div className="text-white text-sm font-semibold">{smsCliente.nome_empresa}</div>
                    <div className="text-blue-500 text-[10px] font-medium">Mensagem</div>
                  </div>
                </div>

                <div className="bg-[#26252a] rounded-2xl rounded-tl-sm p-3 w-full shadow-md relative group">
                  <textarea 
                    value={smsText}
                    onChange={(e) => setSmsText(e.target.value)}
                    className="w-full bg-transparent text-white text-[12px] leading-relaxed font-sans resize-none focus:outline-none focus:ring-1 focus:ring-blue-500/50 rounded p-1 min-h-[120px]"
                  />
                  <div className="flex justify-between items-center mt-2">
                    <div className={`text-[10px] ${smsText.length > 160 ? 'text-red-400 font-bold' : 'text-slate-400'}`}>
                      {smsText.length} / 160
                    </div>
                    <div className="text-[10px] text-white/50">Agora</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
              <button
                onClick={() => {
                  setSmsModalOpen(false);
                  setSmsCliente(null);
                }}
                disabled={isSendingSms}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <PillProgressButton
                onClick={async () => {
                  if (smsText.length > 160) {
                    showToast('error', 'A mensagem deve ter no máximo 160 caracteres.');
                    return;
                  }
                  if (!smsCliente.whatsapp && !smsCliente.telefone && !smsCliente.contato) {
                    showToast('error', 'Cliente sem telefone cadastrado.');
                    return;
                  }
                  
                  setIsSendingSms(true);
                  try {
                    const phone = smsCliente.whatsapp || smsCliente.telefone || smsCliente.contato || '';
                    
                    const response = await fetch('/api/sms/send', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({
                        numero: phone,
                        mensagem: smsText
                      })
                    });
                    
                    const data = await response.json().catch(() => ({ error: `Resposta inválida do servidor (HTTP ${response.status})` }));
                    
                    if (response.ok && data.success) {
                      showToast('success', 'SMS enviado com sucesso!');
                      setSmsModalOpen(false);
                    } else {
                      showToast('error', data.error || data.message || 'Falha ao enviar SMS.');
                    }
                  } catch (err: any) {
                    showToast('error', err?.message || 'Erro de conexão ao enviar SMS.');
                  } finally {
                    setIsSendingSms(false);
                  }
                }}
                label="Enviar SMS"
                loadingLabel="Enviando..."
                isLoading={isSendingSms}
                icon={<CheckCircle2 className="w-4 h-4" />}
                variant="slate"
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Modal de Enviar E-mail de Cobrança */}
      <Modal
        isOpen={emailModalOpen}
        onClose={() => {
          setEmailModalOpen(false);
          setEmailCliente(null);
        }}
        title="Enviar E-mail de Cobrança"
      >
        {emailCliente && (
          <div className="space-y-4 text-left">
            <div className="bg-[#111115] border border-white/10 rounded-2xl p-4 space-y-3">
              <div>
                <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                  E-mail do Destinatário *
                </label>
                <input
                  type="email"
                  value={emailDestination}
                  onChange={e => setEmailDestination(e.target.value)}
                  placeholder="exemplo@empresa.com"
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                  Assunto do E-mail
                </label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={e => setEmailSubject(e.target.value)}
                  placeholder={`Cobrança de Mensalidade - ${emailCliente.nome_empresa}`}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Pré-visualização do Conteúdo do E-mail */}
              <div>
                <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                  Pré-visualização do Conteúdo
                </label>
                <div className="p-3 bg-black/80 rounded-xl border border-white/5 text-xs text-slate-300 space-y-1.5 max-h-48 overflow-y-auto font-sans">
                  <p><strong className="text-white">Empresa:</strong> {emailCliente.nome_empresa}</p>
                  <p><strong className="text-white">Vencimento:</strong> {emailCliente.vencimento ? new Date(emailCliente.vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-'}</p>
                  <p><strong className="text-white">Valor:</strong> {emailCliente.valor != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(emailCliente.valor) : '-'}</p>
                  <p><strong className="text-white">Chave PIX:</strong> {settings?.pixKey || 'Não configurada'}</p>
                  <p className="text-[11px] text-slate-500 pt-2 border-t border-white/5">
                    O e-mail será enviado em layout HTML responsivo usando as credenciais do Gmail/SMTP configuradas em Perfil ({settings?.smtpEmail || 'Administrador'}).
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/5">
              <button
                onClick={() => {
                  setEmailModalOpen(false);
                  setEmailCliente(null);
                }}
                disabled={isSendingEmail}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <PillProgressButton
                onClick={handleSendEmail}
                label="Enviar E-mail"
                loadingLabel="Enviando..."
                isLoading={isSendingEmail}
                icon={<CheckCircle2 className="w-4 h-4" />}
                variant="amber"
              />
            </div>
          </div>
        )}
      </Modal>

      <AnimatePresence>
        {slideCliente && (
          <div className="fixed inset-0 z-[100] overflow-hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSlideCliente(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity"
            />

            <div className="fixed inset-y-0 right-0 max-w-full flex pl-6">
              <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 26, stiffness: 220 }}
                className="w-screen max-w-md bg-[#0c0c0e] border-l border-white/10 shadow-2xl flex flex-col justify-between overflow-y-auto"
              >
                {/* Header do Drawer */}
                <div className="pt-8 pb-6 px-6 border-b border-white/10 bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-transparent relative">
                  <div className="flex items-center justify-between mb-4">
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

                  <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight break-words pr-2">{slideCliente.nome_empresa}</h3>
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
                        <span className={`text-xs font-semibold ${
                          getVencimentoStatus(slideCliente.vencimento) === 'vencido' ? 'text-rose-400' :
                          getVencimentoStatus(slideCliente.vencimento) === 'vencendo' ? 'text-orange-400' :
                          'text-slate-200'
                        }`}>
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
                            {(() => {
                              const isOnline = t.status_online || (t.last_ping && (Date.now() - new Date(t.last_ping.includes('T') ? t.last_ping : t.last_ping.replace(' ', 'T') + 'Z').getTime() < 3 * 60 * 1000));
                              return (
                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold border shrink-0 ${
                                  isOnline 
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                                }`}>
                                  {isOnline ? 'Online' : 'Offline'}
                                </span>
                              );
                            })()}
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
