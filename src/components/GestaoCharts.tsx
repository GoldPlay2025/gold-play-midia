import React from 'react';
import { ArrowUpRight, ArrowDownRight, TrendingUp, DollarSign, Wallet, ShieldAlert } from 'lucide-react';

interface BarraComparativaProps {
  receitaTotal: number;
  custosTotais: number;
  lucroLiquido: number;
}

export function BarraComparativa({ receitaTotal, custosTotais, lucroLiquido }: BarraComparativaProps) {
  const montanteTotal = (receitaTotal > 0 ? receitaTotal : 0) + (custosTotais > 0 ? custosTotais : 0);
  
  const percReceita = montanteTotal > 0 ? Math.min(100, Math.round((receitaTotal / montanteTotal) * 100)) : 50;
  const percCusto = montanteTotal > 0 ? Math.min(100, Math.round((custosTotais / montanteTotal) * 100)) : 50;
  const margemLucro = receitaTotal > 0 ? Math.round((lucroLiquido / receitaTotal) * 100) : 0;

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="bg-[#111115]/90 border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-xl flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              Proporção Receita vs Custos
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Distribuição financeira operacional da plataforma</p>
          </div>
          <div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" />
            {margemLucro}% Margem de Lucro
          </div>
        </div>

        {/* Barra de Progresso Comparativa Nativa HTML/Tailwind */}
        <div className="space-y-2 mt-4">
          <div className="flex justify-between text-xs font-mono font-medium">
            <span className="text-emerald-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
              Receita ({percReceita}%)
            </span>
            <span className="text-rose-400 flex items-center gap-1">
              Custos ({percCusto}%)
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
            </span>
          </div>

          <div className="h-4 w-full bg-black/60 rounded-full p-0.5 border border-white/10 overflow-hidden flex gap-1">
            {/* Fatia da Receita */}
            <div 
              style={{ width: `${percReceita}%` }}
              className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-l-full transition-all duration-700 relative group cursor-pointer shadow-[0_0_12px_rgba(16,185,129,0.3)]"
            >
              <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-black border border-emerald-500/30 text-emerald-300 text-[10px] py-1 px-2 rounded whitespace-nowrap z-20 pointer-events-none transition-opacity">
                Receita: {formatBRL(receitaTotal)}
              </div>
            </div>

            {/* Fatia do Custo */}
            <div 
              style={{ width: `${percCusto}%` }}
              className="h-full bg-gradient-to-r from-rose-500 to-amber-500 rounded-r-full transition-all duration-700 relative group cursor-pointer shadow-[0_0_12px_rgba(244,63,94,0.3)]"
            >
              <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-black border border-rose-500/30 text-rose-300 text-[10px] py-1 px-2 rounded whitespace-nowrap z-20 pointer-events-none transition-opacity">
                Custos: {formatBRL(custosTotais)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detalhamento de Métricas */}
      <div className="grid grid-cols-2 gap-3 mt-6 pt-4 border-t border-white/5 text-xs">
        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
          <div>
            <span className="text-slate-400 block text-[11px]">Receita Bruta</span>
            <span className="text-white font-bold text-sm font-mono">{formatBRL(receitaTotal)}</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
          <div>
            <span className="text-slate-400 block text-[11px]">Custos Operacionais</span>
            <span className="text-rose-400 font-bold text-sm font-mono">{formatBRL(custosTotais)}</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
            <Wallet className="w-4 h-4" />
          </div>
        </div>
      </div>
    </div>
  );
}

interface ItemHistorico {
  mes: string;
  receita: number;
  custo: number;
}

interface GraficoHistoricoMensalProps {
  dados: ItemHistorico[];
}

export function GraficoHistoricoMensal({ dados }: GraficoHistoricoMensalProps) {
  const maxValor = Math.max(
    ...dados.flatMap(d => [d.receita, d.custo]),
    1000
  );

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="bg-[#111115]/90 border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-xl flex flex-col justify-between">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
            Histórico de Performance Mensal
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">Comparativo de faturamento x despesas dos últimos meses</p>
        </div>

        {/* Legenda das barras */}
        <div className="flex items-center gap-4 text-xs font-medium">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
            <span className="text-slate-400">Receita</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]"></span>
            <span className="text-slate-400">Custos</span>
          </div>
        </div>
      </div>

      {/* Mini-Gráfico de Barras Verticais 100% NATIVO HTML/Tailwind */}
      <div className="h-48 w-full flex items-end justify-between gap-2 pt-6 px-2 border-b border-white/10 relative">
        {/* Linhas guia de fundo */}
        <div className="absolute inset-x-0 top-0 border-t border-dashed border-white/5 pointer-events-none"></div>
        <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-white/5 pointer-events-none"></div>

        {dados.map((item, idx) => {
          const altReceita = Math.round((item.receita / maxValor) * 100);
          const altCusto = Math.round((item.custo / maxValor) * 100);

          return (
            <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group relative">
              {/* Tooltip ao passar o mouse */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 absolute -top-12 left-1/2 -translate-x-1/2 bg-[#09090b] border border-amber-500/30 p-2 rounded-xl text-[10px] font-mono shadow-2xl z-30 pointer-events-none flex flex-col gap-0.5 whitespace-nowrap">
                <span className="text-amber-400 font-bold">{item.mes}</span>
                <span className="text-emerald-400">Rec: {formatBRL(item.receita)}</span>
                <span className="text-rose-400">Cust: {formatBRL(item.custo)}</span>
              </div>

              {/* Colunas verticais agrupadas */}
              <div className="w-full flex items-end justify-center gap-1 h-full pb-1">
                {/* Barra de Receita */}
                <div
                  style={{ height: `${Math.max(altReceita, 4)}%` }}
                  className="w-1/2 max-w-[16px] bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-sm transition-all duration-500 group-hover:brightness-125 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                />

                {/* Barra de Custo */}
                <div
                  style={{ height: `${Math.max(altCusto, 4)}%` }}
                  className="w-1/2 max-w-[16px] bg-gradient-to-t from-rose-600 to-rose-400 rounded-t-sm transition-all duration-500 group-hover:brightness-125 shadow-[0_0_10px_rgba(244,63,94,0.2)]"
                />
              </div>

              {/* Rótulo do Mês */}
              <span className="text-[11px] font-medium text-slate-500 group-hover:text-amber-400 transition-colors mt-2">
                {item.mes}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
