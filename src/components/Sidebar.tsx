import React from 'react';
import { 
  LayoutDashboard,
  Users, 
  Monitor, 
  LogOut,
  Settings,
  Film,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';
import { motion } from 'motion/react';

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
      className="hidden lg:flex fixed left-4 top-4 bottom-4 z-50 flex-col bg-[#111111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <div className="py-6 flex flex-col items-center px-4 border-b border-white/10 text-center relative">
        <div className="w-12 h-12 flex items-center justify-center overflow-hidden mb-2">
          <img src={iconUrl || "/gpm.png"} alt="Logo" className="w-full h-auto object-contain" />
        </div>
        {isOpen && (
          <div>
            <h1 className="text-xs font-bold text-white tracking-widest uppercase">{systemName}</h1>
            <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mt-0.5">Workspace</p>
          </div>
        )}
      </div>

      <div className="flex-1 py-6 px-3 flex flex-col gap-2 overflow-y-auto">
        <MenuButton icon={LayoutDashboard} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} isOpen={isOpen} />
        <MenuButton icon={Users} label="Clientes" active={activeTab === 'clientes'} onClick={() => setActiveTab('clientes')} isOpen={isOpen} />
        <MenuButton icon={Monitor} label="Telas" active={activeTab === 'telas'} onClick={() => setActiveTab('telas')} isOpen={isOpen} />
        <MenuButton icon={Film} label="Gerenciar Mídias" active={activeTab === 'nova-midia'} onClick={() => setActiveTab('nova-midia')} isOpen={isOpen} />
        <MenuButton icon={Settings} label="Perfil" active={activeTab === 'perfil'} onClick={() => setActiveTab('perfil')} isOpen={isOpen} />
      </div>

      <div className="p-4 border-t border-white/10">
        <button 
          onClick={onLogout}
          className="flex items-center gap-3 text-sm font-medium text-slate-600 hover:text-red-400 transition-colors w-full justify-center lg:justify-start"
        >
          <LogOut className="w-5 h-5" />
          {isOpen && <span>Sair</span>}
        </button>
      </div>
    </motion.aside>
  );
}

function MenuButton({ icon: Icon, label, active, onClick, isOpen }: any) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-300 w-full ${
        active 
          ? 'bg-amber-500/10 text-amber-500' 
          : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
      }`}
    >
      <Icon className="w-5 h-5 shrink-0" />
      {isOpen && <span className="whitespace-nowrap">{label}</span>}
    </button>
  );
}
