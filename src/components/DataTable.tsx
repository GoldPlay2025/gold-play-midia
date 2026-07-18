import React, { useState, useEffect } from 'react';
import { Loader2, Edit2, Trash2, Search, Plus, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
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
  renderExpandedRow?: (row: T) => React.ReactNode;
}

const ITEMS_PER_PAGE = 20;

export function DataTable<T extends { id: string }>({
  data,
  columns,
  isLoading,
  emptyMessage = 'Nenhum registro encontrado.',
  title,
  onAdd,
  addActionLabel = 'Novo',
  onSearch,
  renderExpandedRow
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Reset page when search term or total data changes
  useEffect(() => {
    setCurrentPage(1);
  }, [data.length]);

  const totalItems = data.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalItems);
  const paginatedData = data.slice(startIndex, endIndex);

  // Generate page numbers to show (e.g., [1, 2, 3])
  const getPageNumbers = () => {
    const pages: number[] = [];
    const maxVisiblePages = 5;
    
    let start = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let end = Math.min(totalPages, start + maxVisiblePages - 1);
    
    if (end - start + 1 < maxVisiblePages) {
      start = Math.max(1, end - maxVisiblePages + 1);
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

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
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center text-slate-500 text-sm">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              <>
                {paginatedData.map((row) => (
                  <React.Fragment key={row.id}>
                    <motion.tr 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className={`transition-colors group ${renderExpandedRow ? 'cursor-pointer hover:bg-white/[0.04]' : 'hover:bg-white/[0.02]'} ${expandedRows.has(row.id) ? 'bg-white/[0.02]' : ''}`}
                      onClick={() => {
                        if (renderExpandedRow) {
                          const newSet = new Set(expandedRows);
                          if (newSet.has(row.id)) {
                            newSet.delete(row.id);
                          } else {
                            newSet.add(row.id);
                          }
                          setExpandedRows(newSet);
                        }
                      }}
                    >
                      {columns.map((col, idx) => (
                        <td key={idx} className="px-6 py-4">
                          {col.render ? col.render(row) : (row[col.key as keyof T] as React.ReactNode)}
                        </td>
                      ))}
                    </motion.tr>
                    <AnimatePresence>
                      {renderExpandedRow && expandedRows.has(row.id) && (
                        <motion.tr
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="bg-black/20"
                        >
                          <td colSpan={columns.length} className="px-6 py-4">
                            {renderExpandedRow(row)}
                          </td>
                        </motion.tr>
                      )}
                    </AnimatePresence>
                  </React.Fragment>
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      {!isLoading && totalItems > 0 && (
        <div className="px-6 py-4 border-t border-white/5 bg-white/[0.01] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs font-mono text-slate-500 uppercase tracking-wider">
            Mostrando <span className="text-slate-300 font-medium">{startIndex + 1}</span> a <span className="text-slate-300 font-medium">{endIndex}</span> de <span className="text-amber-500 font-medium">{totalItems}</span> registros
          </div>
          
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              {/* First page */}
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-white/5 bg-white/5 text-slate-400 hover:text-white hover:border-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Primeira página"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              
              {/* Previous page */}
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-white/5 bg-white/5 text-slate-400 hover:text-white hover:border-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Página anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Page numbers */}
              <div className="hidden sm:flex items-center gap-1">
                {getPageNumbers().map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 rounded-lg border text-xs font-medium font-mono transition-all ${
                      currentPage === page
                        ? 'bg-amber-500 text-black border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.2)] font-semibold'
                        : 'border-white/5 bg-white/5 text-slate-400 hover:text-white hover:border-white/10'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>

              {/* Mobile page indicator */}
              <div className="sm:hidden text-xs font-mono text-slate-400 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                {currentPage} / {totalPages}
              </div>

              {/* Next page */}
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-white/5 bg-white/5 text-slate-400 hover:text-white hover:border-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Próxima página"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              {/* Last page */}
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-white/5 bg-white/5 text-slate-400 hover:text-white hover:border-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Última página"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
