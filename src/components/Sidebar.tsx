import React from 'react';
import { 
  LayoutDashboard,
  Users, 
  Monitor, 
  LogOut,
  Settings,
  Film,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  onLogout: () => void;
  systemName: string;
  iconUrl: string;
}

export function Sidebar({ isOpen, setIsOpen, activeTab, setActiveTab, onLogout, systemName, iconUrl }: SidebarProps) {
  return (
    <motion.aside 
      initial={false}
      animate={{ width: isOpen ? 256 : 80 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className={`flex-col h-full bg-[#111111] border-r border-white/10 overflow-hidden ${isOpen ? 'fixed inset-0 z-50 w-full lg:static lg:w-64 backdrop-blur-md bg-[#111111]/80' : 'hidden lg:flex lg:w-20'}`}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <div className="py-6 flex flex-col items-center px-4 border-b border-white/10 text-center relative">
        <button className="lg:hidden absolute top-4 right-4" onClick={() => setIsOpen(false)}>
            <X className="w-6 h-6 text-white"/>
        </button>
        <div className="w-28 h-28 flex items-center justify-center overflow-hidden mb-2 shrink-0">
          <img src={iconUrl || "/gpm.png"} alt="Logo" className="w-full h-auto object-contain" />
        </div>
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <h1 className="text-xs font-bold text-white tracking-widest uppercase">{systemName}</h1>
              <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mt-0.5">Workspace</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex-1 py-6 px-3 flex flex-col gap-2 overflow-y-auto overflow-x-hidden">
        <MenuButton icon={LayoutDashboard} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => { setActiveTab('dashboard'); setIsOpen(false); }} isOpen={isOpen} />
        <MenuButton icon={Users} label="Clientes" active={activeTab === 'clientes'} onClick={() => { setActiveTab('clientes'); setIsOpen(false); }} isOpen={isOpen} />
        <MenuButton icon={Monitor} label="Telas" active={activeTab === 'telas'} onClick={() => { setActiveTab('telas'); setIsOpen(false); }} isOpen={isOpen} />
        <MenuButton icon={Film} label="Gerenciar Mídias" active={activeTab === 'nova-midia'} onClick={() => { setActiveTab('nova-midia'); setIsOpen(false); }} isOpen={isOpen} />
        <MenuButton icon={Settings} label="Perfil" active={activeTab === 'perfil'} onClick={() => { setActiveTab('perfil'); setIsOpen(false); }} isOpen={isOpen} />
      </div>

      <div className="p-4 border-t border-white/10">
        <button 
          onClick={onLogout}
          className={`flex items-center gap-3 text-sm font-medium text-slate-600 hover:text-red-400 transition-colors w-full ${isOpen ? 'justify-start px-3' : 'justify-center lg:justify-start lg:px-3'}`}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          <AnimatePresence>
            {isOpen && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="whitespace-nowrap overflow-hidden text-left"
              >
                Sair
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.aside>
  );
}

function MenuButton({ icon: Icon, label, active, onClick, isOpen }: any) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-3 py-3 rounded-xl text-sm font-medium transition-all duration-300 w-full overflow-hidden ${
        active 
          ? 'bg-amber-500/10 text-amber-500' 
          : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
      } ${!isOpen ? 'justify-center lg:justify-start px-0 lg:px-3' : 'justify-start px-3'}`}
    >
      <Icon className="w-5 h-5 shrink-0" />
      <AnimatePresence>
        {isOpen && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.2 }}
            className="whitespace-nowrap overflow-hidden text-left"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

