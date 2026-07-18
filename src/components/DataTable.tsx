import React from 'react';
import { Loader2, Edit2, Trash2, Search, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export type Column<T> = {
  key: keyof T | 'actions';
  header: string;
  render?: (row: T) => React.ReactNode;
};

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  isLoading: boolean;
  emptyMessage?: string;
  title: string;
  onAdd?: () => void;
  addActionLabel?: string;
  onSearch?: (term: string) => void;
}

export function DataTable<T extends { id: string }>({
  data,
  columns,
  isLoading,
  emptyMessage = 'Nenhum registro encontrado.',
  title,
  onAdd,
  addActionLabel = 'Novo',
  onSearch
}: DataTableProps<T>) {
  return (
    <div className="bg-[#0f0f11] border border-white/5 rounded-2xl overflow-hidden shadow-2xl shadow-black/50">
      <div className="px-6 py-5 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h3 className="text-lg font-medium text-white">{title}</h3>
        
        <div className="flex items-center gap-4">
          {onSearch && (
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Buscar..." 
                onChange={(e) => onSearch(e.target.value)}
                className="bg-[#050505] border border-white/10 rounded-xl py-2 pl-9 pr-4 text-xs focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all text-white placeholder-slate-600 w-full sm:w-64"
              />
            </div>
          )}
          {onAdd && (
            <button 
              onClick={onAdd}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-amber-600 to-amber-500 text-black hover:from-amber-500 hover:to-amber-400 px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-[0_0_15px_rgba(245,158,11,0.2)] hover:shadow-[0_0_20px_rgba(245,158,11,0.4)] whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              {addActionLabel}
            </button>
          )}
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white/[0.02] border-b border-white/5 text-[10px] font-mono text-slate-500 uppercase tracking-wider">
              {columns.map((col, idx) => (
                <th key={idx} className="px-6 py-4 font-medium">{col.header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center text-slate-500">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 opacity-50" />
                  <span className="text-xs">Carregando dados...</span>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center text-slate-500 text-sm">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              <AnimatePresence>
                {data.map((row) => (
                  <motion.tr 
                    key={row.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="hover:bg-white/[0.02] transition-colors group"
                  >
                    {columns.map((col, idx) => (
                      <td key={idx} className="px-6 py-4">
                        {col.render ? col.render(row) : (row[col.key as keyof T] as React.ReactNode)}
                      </td>
                    ))}
                  </motion.tr>
                ))}
              </AnimatePresence>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
