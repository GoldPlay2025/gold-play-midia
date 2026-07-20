import React from 'react';
import { 
  LayoutDashboard,
  Users, 
  Monitor, 
  LogOut,
  Settings,
  Film,
  X,
  MessageSquare,
  Cloud
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
    <aside 
      className={`flex-col h-full bg-[#111111] border-r border-white/10 transition-all duration-300 ${isOpen ? 'fixed inset-0 z-50 w-full flex' : 'hidden lg:flex lg:w-64'}`}
    >
      <div className="py-6 flex flex-col items-center px-4 border-b border-white/10 text-center relative shrink-0">
        <button className="lg:hidden absolute top-4 right-4" onClick={() => setIsOpen(false)}>
            <X className="w-6 h-6 text-white"/>
        </button>
        <div className="w-28 h-28 flex items-center justify-center overflow-hidden mb-2 shrink-0">
          <img src={iconUrl || "/gpm.png"} alt="Logo" className="w-full h-auto object-contain" />
        </div>
        <div>
          <h1 className="text-xs font-bold text-white tracking-widest uppercase">{systemName}</h1>
          <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mt-0.5">Workspace</p>
        </div>
      </div>

      <div className="flex-1 py-6 px-3 flex flex-col gap-2 overflow-y-auto">
        <MenuButton icon={LayoutDashboard} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => { setActiveTab('dashboard'); setIsOpen(false); }} />
        <MenuButton icon={Users} label="Clientes" active={activeTab === 'clientes'} onClick={() => { setActiveTab('clientes'); setIsOpen(false); }} />
        <MenuButton icon={Monitor} label="Telas" active={activeTab === 'telas'} onClick={() => { setActiveTab('telas'); setIsOpen(false); }} />
        <MenuButton icon={Cloud} label="Cloud Manager" active={activeTab === 'cloud'} onClick={() => { setActiveTab('cloud'); setIsOpen(false); }} />
        <MenuButton icon={Film} label="Gerenciar Mídias" active={activeTab === 'nova-midia'} onClick={() => { setActiveTab('nova-midia'); setIsOpen(false); }} />
        <MenuButton icon={Settings} label="Perfil" active={activeTab === 'perfil'} onClick={() => { setActiveTab('perfil'); setIsOpen(false); }} />
        <MenuButton icon={MessageSquare} label="WhatsApp" active={activeTab === 'whatsapp'} onClick={() => { setActiveTab('whatsapp'); setIsOpen(false); }} />
      </div>

      <div className="p-4 border-t border-white/10">
        <button 
          onClick={onLogout}
          className="flex items-center gap-3 text-sm font-medium text-slate-600 hover:text-red-400 transition-colors w-full justify-start px-3 py-3 rounded-xl"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
}

function MenuButton({ icon: Icon, label, active, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-3 py-3 px-3 rounded-xl text-sm font-medium transition-all duration-300 w-full text-left ${
        active 
          ? 'bg-amber-500/10 text-amber-500' 
          : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
      }`}
    >
      <Icon className="w-5 h-5 shrink-0" />
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}

