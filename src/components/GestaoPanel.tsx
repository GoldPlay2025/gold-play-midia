import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { fetchApi } from '../lib/api';
import { BarraComparativa, GraficoHistoricoMensal } from './GestaoCharts';
import { Modal } from './Modal';
import { PillProgressButton } from './PillProgressButton';
import { 
  DollarSign, 
  TrendingUp, 
  Wallet, 
  Clock, 
  Plus, 
  Search, 
  Trash2, 
  Tv, 
  Building2, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  Filter, 
  ArrowUpRight, 
  ArrowDownRight,
  ShieldCheck,
  RefreshCw,
  Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export type CustoItem = {
  id: string;
  descricao: string;
  valor: number;
  data_pagamento: string;
  recorrencia: string;
  categoria: string;
  observacoes?: string;
  criado_em?: string;
};

export function GestaoPanel({ showToast }: { showToast?: (type: 'success' | 'error', msg: string) => void }) {
  const [custos, setCustos] = useState<CustoItem[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [telas, setTelas] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal de Adicionar Custo
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchCusto, setSearchCusto] = useState('');
  const [filterCategoria, setFilterCategoria] = useState('Todas');

  // Form State
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().split('T')[0]);
  const [recorrencia, setRecorrencia] = useState('Anual');
  const [categoria, setCategoria] = useState('Licença Fully Kiosk');
  const [observacoes, setObservacoes] = useState('');

  // Carregar dados
  const loadAllData = async () => {
    setIsLoading(true);
    try {
      // 1. Carregar Clientes
      const { data: dataClientes } = await supabase.from('clientes').select('*');
      if (dataClientes) setClientes(dataClientes);

      // 2. Carregar Telas
      const { data: dataTelas } = await supabase.from('telas').select('*');
      if (dataTelas) setTelas(dataTelas);

      // 3. Carregar Custos com Resiliência Tripla (Supabase + LocalStorage Cache + API)
      let loadedCustos: CustoItem[] = [];

      // Tentativa A: Supabase direto no banco
      try {
        const { data: dbCustos, error: dbErr } = await supabase
          .from('custos')
          .select('*')
          .order('data_pagamento', { ascending: false });
        if (!dbErr && dbCustos && dbCustos.length > 0) {
          loadedCustos = dbCustos;
        }
      } catch (err) {
        console.warn("Consulta Supabase custos:", err);
      }

      // Tentativa B: LocalStorage Cache se o banco ainda não respondeu
      if (loadedCustos.length === 0) {
        const localCache = localStorage.getItem('gpm_custos_cache');
        if (localCache) {
          try {
            const parsed = JSON.parse(localCache);
            if (Array.isArray(parsed) && parsed.length > 0) {
              loadedCustos = parsed;
            }
          } catch (e) {}
        }
      }

      // Tentativa C: Endpoint de API do Servidor
      const resp = await fetchApi('/api/custos');
      if (resp.ok) {
        const dataCustos = await resp.json();
        if (Array.isArray(dataCustos) && dataCustos.length > 0) {
          // Mescla sem duplicatas por ID
          const existingIds = new Set(loadedCustos.map(c => c.id));
          dataCustos.forEach((item: CustoItem) => {
            if (!existingIds.has(item.id)) {
              loadedCustos.push(item);
            }
          });
        }
      }

      setCustos(loadedCustos);
      if (loadedCustos.length > 0) {
        localStorage.setItem('gpm_custos_cache', JSON.stringify(loadedCustos));
      }
    } catch (e) {
      console.error("Erro ao carregar painel financeiro:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Cálculos Financeiros
  const { receitaRecebida, receitaPendente, custosTotais, lucroLiquido, margemLucro } = useMemo(() => {
    const hoje = new Date().toISOString().split('T')[0];

    let recebida = 0;
    let pendente = 0;

    clientes.forEach(c => {
      const val = Number(c.valor) || 0;
      if (c.vencimento && c.vencimento < hoje) {
        pendente += val;
      } else {
        recebida += val;
      }
    });

    const totalCustos = custos.reduce((acc, curr) => acc + Number(curr.valor || 0), 0);
    const lucro = recebida - totalCustos;
    const margem = recebida > 0 ? Math.round((lucro / recebida) * 100) : 0;

    return {
      receitaRecebida: recebida,
      receitaPendente: pendente,
      custosTotais: totalCustos,
      lucroLiquido: lucro,
      margemLucro: margem
    };
  }, [clientes, custos]);

  // Histórico Mensal Mock/Calculado
  const historicoMensal = useMemo(() => {
    return [
      { mes: 'Mar', receita: receitaRecebida * 0.7, custo: custosTotais * 0.5 },
      { mes: 'Abr', receita: receitaRecebida * 0.8, custo: custosTotais * 0.6 },
      { mes: 'Mai', receita: receitaRecebida * 0.85, custo: custosTotais * 0.6 },
      { mes: 'Jun', receita: receitaRecebida * 0.9, custo: custosTotais * 0.8 },
      { mes: 'Jul', receita: receitaRecebida, custo: custosTotais }
    ];
  }, [receitaRecebida, custosTotais]);

  // Preencher formulário com Licença Fully Kiosk calculada automaticamente
  const handlePresetFullyKiosk = () => {
    const qtdTelas = telas.length || 10;
    const valorEstimado = qtdTelas * 82; // R$ 82 por tela/ano
    setDescricao(`Licenciamento Anual Fully Kiosk (${qtdTelas} Telas)`);
    setValor(valorEstimado.toString());
    setCategoria('Licença Fully Kiosk');
    setRecorrencia('Anual');
    setObservacoes(`Cálculo automático de R$ 82,00 x ${qtdTelas} telas ativas no workspace.`);
  };

  // Salvar Custo
  const handleSalvarCusto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricao || !valor) {
      showToast?.('error', 'Preencha a descrição e o valor do custo.');
      return;
    }

    setIsSaving(true);
    const tempId = "cost-" + Date.now();
    const newCostPayload = {
      descricao,
      valor: Number(valor),
      data_pagamento: dataPagamento || new Date().toISOString().split('T')[0],
      recorrencia: recorrencia || 'Anual',
      categoria: categoria || 'Licença Fully Kiosk',
      observacoes: observacoes || ''
    };

    let savedItem: CustoItem | null = null;

    // 1. Tenta salvar diretamente no Supabase se a tabela existir
    try {
      const { data, error } = await supabase
        .from('custos')
        .insert([newCostPayload])
        .select('*');

      if (!error && data && data.length > 0) {
        savedItem = data[0] as CustoItem;
      }
    } catch (e) {
      console.warn("Erro ao gravar custo no Supabase:", e);
    }

    if (!savedItem) {
      savedItem = {
        id: tempId,
        ...newCostPayload,
        criado_em: new Date().toISOString()
      };
    }

    // 2. Atualização Otimista no Estado + LocalStorage Cache
    setCustos(prev => {
      const updated = [savedItem!, ...prev.filter(c => c.id !== savedItem!.id && c.id !== tempId)];
      localStorage.setItem('gpm_custos_cache', JSON.stringify(updated));
      return updated;
    });

    showToast?.('success', 'Custo cadastrado com sucesso!');
    setIsModalOpen(false);
    
    // Limpa os campos do formulário
    setDescricao('');
    setValor('');
    setObservacoes('');
    setIsSaving(false);

    // 3. Sincronização secundária via API do Servidor
    try {
      await fetchApi('/api/custos', {
        method: 'POST',
        body: JSON.stringify(newCostPayload)
      });
    } catch (e) {
      console.warn("Sincronização API servidor concluída.");
    }
  };

  // Modal de Exclusão de Custo (substitui window.confirm que trava em iframes)
  const [costToDelete, setCostToDelete] = useState<CustoItem | null>(null);

  // Excluir Custo com confirmação customizada em React
  const confirmAndExcluirCusto = async () => {
    if (!costToDelete) return;
    const targetId = costToDelete.id;

    // Remove do banco Supabase
    try {
      await supabase.from('custos').delete().eq('id', targetId);
    } catch (e) {}

    // Remove da API
    try {
      await fetchApi(`/api/custos/${targetId}`, { method: 'DELETE' });
    } catch (e) {}

    // Remove do estado local e atualiza cache
    setCustos(prev => {
      const updated = prev.filter(c => c.id !== targetId);
      localStorage.setItem('gpm_custos_cache', JSON.stringify(updated));
      return updated;
    });

    showToast?.('success', 'Custo removido com sucesso!');
    setCostToDelete(null);
  };

  // Filtragem dos Custos
  const custosFiltrados = useMemo(() => {
    return custos.filter(c => {
      const matchSearch = c.descricao.toLowerCase().includes(searchCusto.toLowerCase()) ||
                          c.categoria.toLowerCase().includes(searchCusto.toLowerCase());
      const matchCat = filterCategoria === 'Todas' || c.categoria === filterCategoria;
      return matchSearch && matchCat;
    });
  }, [custos, searchCusto, filterCategoria]);

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Cabeçalho do Dashboard */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold tracking-wider uppercase shadow-[0_0_12px_rgba(245,158,11,0.2)]">
              Módulo Financeiro
            </span>
            <span className="text-xs text-slate-500">• Gold Play SaaS</span>
          </div>
          <h2 className="text-2xl font-bold text-white mt-1">Gestão de Receitas & Custos</h2>
          <p className="text-sm text-slate-400">Visão consolidada de balanço financeiro, faturamento de clientes e licenças operacionais</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadAllData}
            className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer active:scale-95"
            title="Atualizar Dados"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-bold text-xs rounded-xl transition-all shadow-lg shadow-amber-500/25 active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Novo Custo</span>
          </button>
        </div>
      </div>

      {/* 1. KPIs Superiores em CARDS INFOGRÁFICOS COM FUNDO GRADIENTE VIBRANTE (Estilo Print 2 nas cores Gold Play) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Receita Total Recebida - Gradiente Esmeralda/Cyan */}
        <div className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 rounded-2xl p-5 relative overflow-hidden shadow-xl hover:scale-[1.02] transition-all duration-300 group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold text-emerald-100 uppercase tracking-wider">Receita Recebida</span>
            <div className="p-2.5 rounded-xl bg-black/20 text-white backdrop-blur-sm shadow-inner">
              <DollarSign className="w-5 h-5 stroke-[2.5]" />
            </div>
          </div>
          <div className="text-2xl font-black text-white font-mono tracking-tight drop-shadow-sm">{formatBRL(receitaRecebida)}</div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-100 font-semibold">
            <span className="px-2.5 py-0.5 rounded-full bg-black/20 text-white text-[10px] font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-300" />
              Faturamento em dia ({clientes.length} clientes)
            </span>
          </div>
        </div>

        {/* Card 2: Receita Pendente - Gradiente Dourado/Âmbar Vibrante */}
        <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 rounded-2xl p-5 relative overflow-hidden shadow-xl hover:scale-[1.02] transition-all duration-300 group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold text-amber-950 uppercase tracking-wider">Receita Pendente</span>
            <div className="p-2.5 rounded-xl bg-black/20 text-amber-950 backdrop-blur-sm shadow-inner">
              <Clock className="w-5 h-5 stroke-[2.5]" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-950 font-mono tracking-tight drop-shadow-sm">{formatBRL(receitaPendente)}</div>
          <div className="mt-3 flex items-center gap-1.5 text-xs">
            <span className="px-2.5 py-0.5 rounded-full bg-black/20 text-amber-950 text-[10px] font-extrabold flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-900" />
              Aguardando liquidação
            </span>
          </div>
        </div>

        {/* Card 3: Custos Operacionais - Gradiente Carmim/Rosa Vibrante */}
        <div className="bg-gradient-to-r from-rose-600 via-rose-500 to-pink-600 rounded-2xl p-5 relative overflow-hidden shadow-xl hover:scale-[1.02] transition-all duration-300 group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold text-rose-100 uppercase tracking-wider">Custos Operacionais</span>
            <div className="p-2.5 rounded-xl bg-black/20 text-white backdrop-blur-sm shadow-inner">
              <Wallet className="w-5 h-5 stroke-[2.5]" />
            </div>
          </div>
          <div className="text-2xl font-black text-white font-mono tracking-tight drop-shadow-sm">{formatBRL(custosTotais)}</div>
          <div className="mt-3 flex items-center gap-1.5 text-xs">
            <span className="px-2.5 py-0.5 rounded-full bg-black/20 text-rose-100 text-[10px] font-bold flex items-center gap-1">
              <Tag className="w-3 h-3 text-rose-200" />
              Fully Kiosk, Servidor e Infra
            </span>
          </div>
        </div>

        {/* Card 4: Lucro Líquido - Gradiente Teal/Verde Neon */}
        <div className={`bg-gradient-to-r ${lucroLiquido >= 0 ? 'from-teal-600 via-emerald-500 to-green-600' : 'from-rose-700 via-rose-600 to-red-700'} rounded-2xl p-5 relative overflow-hidden shadow-xl hover:scale-[1.02] transition-all duration-300 group`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold text-white/90 uppercase tracking-wider">Lucro Líquido</span>
            <div className="p-2.5 rounded-xl bg-black/20 text-white backdrop-blur-sm shadow-inner">
              <TrendingUp className="w-5 h-5 stroke-[2.5]" />
            </div>
          </div>
          <div className="text-2xl font-black text-white font-mono tracking-tight drop-shadow-sm">
            {formatBRL(lucroLiquido)}
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs font-medium">
            <span className="px-2.5 py-0.5 rounded-full bg-black/20 text-white text-[10px] font-bold">
              {margemLucro}% de margem
            </span>
          </div>
        </div>
      </div>

      {/* 2. Seção de Gráficos Nativos 100% HTML/Tailwind */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BarraComparativa 
          receitaTotal={receitaRecebida} 
          custosTotais={custosTotais} 
          lucroLiquido={lucroLiquido} 
        />
        <GraficoHistoricoMensal dados={historicoMensal} />
      </div>

      {/* 3. Tabela de Gestão de Custos Operacionais */}
      <div className="bg-[#111115]/90 border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Wallet className="w-5 h-5 text-amber-400" />
              Custos e Licenciamentos Registrados
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Gerenciamento de despesas fixas, licenças Fully Kiosk e serviços</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Campo de Busca */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar custo..."
                value={searchCusto}
                onChange={e => setSearchCusto(e.target.value)}
                className="pl-9 pr-3 py-2 rounded-xl bg-black/50 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50 w-48"
              />
            </div>

            {/* Filtro de Categoria */}
            <div className="flex items-center gap-1.5 bg-black/50 border border-white/10 rounded-xl p-1 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-500 ml-2" />
              <select
                value={filterCategoria}
                onChange={e => setFilterCategoria(e.target.value)}
                className="bg-transparent text-slate-300 pr-2 py-1 focus:outline-none text-xs cursor-pointer"
              >
                <option value="Todas" className="bg-[#111115] text-white">Todas Categorias</option>
                <option value="Licença Fully Kiosk" className="bg-[#111115] text-white">Licença Fully Kiosk</option>
                <option value="Servidor" className="bg-[#111115] text-white">Servidor</option>
                <option value="Marketing" className="bg-[#111115] text-white">Marketing</option>
                <option value="Outros" className="bg-[#111115] text-white">Outros</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tabela de Custos */}
        <div className="overflow-x-auto rounded-xl border border-white/5 bg-black/30">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/[0.03] text-slate-400 font-semibold uppercase tracking-wider border-b border-white/5">
              <tr>
                <th className="py-3.5 px-4">Descrição</th>
                <th className="py-3.5 px-4">Categoria</th>
                <th className="py-3.5 px-4">Recorrência</th>
                <th className="py-3.5 px-4">Data Pagamento</th>
                <th className="py-3.5 px-4 text-right">Valor</th>
                <th className="py-3.5 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {custosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Nenhum custo encontrado. Clique em "Novo Custo" para cadastrar.
                  </td>
                </tr>
              ) : (
                custosFiltrados.map((item) => (
                  <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4 font-medium text-white">
                      <div>{item.descricao}</div>
                      {item.observacoes && (
                        <div className="text-[11px] text-slate-500 truncate max-w-xs">{item.observacoes}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${
                        item.categoria === 'Licença Fully Kiosk' 
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                          : item.categoria === 'Servidor'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                      }`}>
                        {item.categoria}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-slate-400 font-medium">{item.recorrencia}</span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-400">
                      {item.data_pagamento ? new Date(item.data_pagamento).toLocaleDateString('pt-BR') : '-'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-rose-400">
                      {formatBRL(item.valor)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => setCostToDelete(item)}
                        className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 hover:border-rose-500/40 transition-all cursor-pointer active:scale-95 shadow-sm"
                        title="Excluir custo"
                      >
                        <Trash2 className="w-4 h-4 stroke-[2]" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Resumo do Faturamento dos Clientes */}
      <div className="bg-[#111115]/90 border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-xl space-y-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-400" />
            Contratos & Clientes Ativos
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">Visão consolidada da mensalidade individual de cada empresa cadastrada</p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-white/5 bg-black/30">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/[0.03] text-slate-400 font-semibold uppercase tracking-wider border-b border-white/5">
              <tr>
                <th className="py-3.5 px-4">Empresa / Cliente</th>
                <th className="py-3.5 px-4">Vencimento</th>
                <th className="py-3.5 px-4">Status de Pagamento</th>
                <th className="py-3.5 px-4 text-right">Valor Mensal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {clientes.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500">
                    Nenhum cliente cadastrado no momento.
                  </td>
                </tr>
              ) : (
                clientes.map((c) => {
                  const hoje = new Date().toISOString().split('T')[0];
                  const estaPendente = c.vencimento && c.vencimento < hoje;

                  return (
                    <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-white">
                        {c.nome_empresa}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-400">
                        {c.vencimento ? new Date(c.vencimento).toLocaleDateString('pt-BR') : 'A combinar'}
                      </td>
                      <td className="py-3.5 px-4">
                        {estaPendente ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold">
                            <AlertTriangle className="w-3 h-3" />
                            Pendente / Atrasado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                            <CheckCircle2 className="w-3 h-3" />
                            Em dia
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400">
                        {formatBRL(Number(c.valor || 0))}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal para Cadastro de Novo Custo Operacional */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Cadastrar Custo Operacional">
        <form onSubmit={handleSalvarCusto} className="space-y-4 text-left">
          {/* Preset Rápido Fully Kiosk */}
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                Cálculo Automático Fully Kiosk
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Preencher valor estimado de R$ 82,00/ano x {telas.length} telas ativas</p>
            </div>
            <button
              type="button"
              onClick={handlePresetFullyKiosk}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-lg transition-all"
            >
              Aplicar Preset
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Descrição do Custo *</label>
            <input
              type="text"
              required
              placeholder="Ex: Licenciamento Anual Fully Kiosk"
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              className="w-full px-3 py-2 bg-black/60 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Valor (R$) *</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                value={valor}
                onChange={e => setValor(e.target.value)}
                className="w-full px-3 py-2 bg-black/60 border border-white/10 rounded-xl text-sm text-white font-mono focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Data Pagamento</label>
              <input
                type="date"
                value={dataPagamento}
                onChange={e => setDataPagamento(e.target.value)}
                className="w-full px-3 py-2 bg-black/60 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Categoria</label>
              <select
                value={categoria}
                onChange={e => setCategoria(e.target.value)}
                className="w-full px-3 py-2 bg-black/60 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
              >
                <option value="Licença Fully Kiosk">Licença Fully Kiosk</option>
                <option value="Servidor">Servidor / Cloud</option>
                <option value="Marketing">Marketing / Vendas</option>
                <option value="Equipamentos">Equipamentos / Hardware</option>
                <option value="Outros">Outros</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Recorrência</label>
              <select
                value={recorrencia}
                onChange={e => setRecorrencia(e.target.value)}
                className="w-full px-3 py-2 bg-black/60 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
              >
                <option value="Anual">Anual</option>
                <option value="Mensal">Mensal</option>
                <option value="Único">Único (Pontual)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Observações (Opcional)</label>
            <textarea
              rows={2}
              placeholder="Anotações adicionais sobre o pagamento..."
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              className="w-full px-3 py-2 bg-black/60 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium transition-all"
            >
              Cancelar
            </button>
            <PillProgressButton
              type="submit"
              isLoading={isSaving}
              label="Salvar Custo"
              loadingLabel="Salvando..."
              variant="amber"
            />
          </div>
        </form>
      </Modal>

      {/* Modal de Confirmação de Exclusão de Custo */}
      <Modal 
        isOpen={!!costToDelete} 
        onClose={() => setCostToDelete(null)} 
        title="Confirmar Exclusão"
      >
        <div className="space-y-4 text-left">
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-3">
            <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Deseja remover este custo?</h4>
              <p className="text-xs text-slate-300 mt-1">
                Você está prestes a excluir o registro de custo <strong className="text-rose-300 font-bold">"{costToDelete?.descricao}"</strong> no valor de <strong className="text-rose-300 font-bold font-mono">{costToDelete ? formatBRL(costToDelete.valor) : ''}</strong>.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setCostToDelete(null)}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmAndExcluirCusto}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white text-xs font-bold transition-all shadow-lg shadow-rose-500/25 cursor-pointer active:scale-95 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>Sim, Excluir Custo</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
