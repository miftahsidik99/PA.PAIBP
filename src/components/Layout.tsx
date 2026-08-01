import React from 'react';
import { ReactNode, useRef } from 'react';
import { useStore } from '../store/useStore';
import { LogOut, BookOpen, Calendar, BookText, Home, FileText, Download, Upload, Users, ChevronLeft, Menu, ClipboardList } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import ApiKeyModal from './ApiKeyModal';
import { Key } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Daftar Siswa', href: '/daftar-siswa', icon: Users },
  { name: 'Kalender Akademik', href: '/academic-calendar', icon: Calendar },
  { name: 'Jadwal Mengajar', href: '/schedule', icon: Calendar },
  { name: 'Hari Efektif', href: '/effective-days', icon: BookOpen },
  { name: 'Presensi', href: '/presensi', icon: FileText },
  { name: 'Program Tahunan', href: '/prota', icon: BookText },
  { name: 'Modul Ajar', href: '/modul-ajar', icon: FileText },
  { name: 'KKTP', href: '/kktp', icon: ClipboardList },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { profile, logout, importData } = useStore();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const handleLogout = () => {
    logout();
  };

  const handleExport = () => {
    const data = localStorage.getItem('paibp-smart-storage');
    if (data) {
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_paibp_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          importData(event.target.result as string);
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="min-h-screen flex font-sans text-slate-800" style={{ background: 'radial-gradient(at top left, #e2e8f0, #f8fafc)' }}>
      {/* Sidebar */}
      <motion.div 
        animate={{ width: isCollapsed ? 80 : 256 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="h-full bg-white/40 backdrop-blur-md border-r border-white/20 p-4 flex flex-col relative"
      >
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-12 bg-white border border-slate-200 rounded-full p-1 shadow-sm text-slate-500 hover:text-emerald-600 transition-colors z-50"
        >
          {isCollapsed ? <Menu size={16} /> : <ChevronLeft size={16} />}
        </button>

        <div className={`mb-8 flex items-center ${isCollapsed ? 'justify-center' : ''}`}>
          <div className="flex items-center">
            <BookOpen className="text-emerald-600 mr-2 flex-shrink-0" size={24} />
            {!isCollapsed && (
              <motion.h1 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xl font-bold text-emerald-800 leading-tight uppercase tracking-wider"
              >
                PAIBP<br/><span className="text-xs font-medium text-slate-500 tracking-normal">SD Assistant</span>
              </motion.h1>
            )}
          </div>
        </div>
        
        <div className="flex-1 overflow-x-hidden">
          <div className={`mb-6 ${isCollapsed ? 'text-center' : ''}`}>
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1 truncate">
              {isCollapsed ? 'USR' : 'Pengguna'}
            </p>
            <p className="text-sm font-bold text-slate-700 truncate">
              {isCollapsed ? profile?.namaGuru?.charAt(0) : profile?.namaGuru}
            </p>
          </div>
          
          <nav className="space-y-2">
            {!isCollapsed && <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-2 font-bold">Menu Utama</div>}
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  title={isCollapsed ? item.name : ''}
                  className={`flex items-center px-4 py-3 rounded-xl text-sm transition-colors relative group ${isActive ? 'bg-white/60 shadow-sm border border-white/40 font-semibold text-emerald-700' : 'hover:bg-white/40 font-medium text-slate-600'}`}
                >
                  <item.icon className={`flex-shrink-0 h-5 w-5 ${isActive ? 'text-emerald-600' : 'text-slate-400'} ${isCollapsed ? 'mx-auto' : 'mr-3'}`} />
                  {!isCollapsed && <span>{item.name}</span>}
                  {isCollapsed && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                      {item.name}
                    </div>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="mt-auto space-y-2 border-t border-slate-200/50 pt-4 overflow-x-hidden">
          {!isCollapsed && <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-2 font-bold">Data & Pencadangan</div>}
          <button
            onClick={handleExport}
            title={isCollapsed ? "Backup Data" : ""}
            className="flex items-center w-full px-4 py-2 text-sm font-medium text-slate-600 rounded-xl hover:bg-white/40 transition-colors group relative"
          >
            <Download className={`flex-shrink-0 h-4 w-4 text-slate-400 ${isCollapsed ? 'mx-auto' : 'mr-3'}`} />
            {!isCollapsed && <span>Backup Data</span>}
            {isCollapsed && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                Backup Data
              </div>
            )}
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            title={isCollapsed ? "Restore Data" : ""}
            className="flex items-center w-full px-4 py-2 text-sm font-medium text-slate-600 rounded-xl hover:bg-white/40 transition-colors group relative"
          >
            <Upload className={`flex-shrink-0 h-4 w-4 text-slate-400 ${isCollapsed ? 'mx-auto' : 'mr-3'}`} />
            {!isCollapsed && <span>Restore Data</span>}
            {isCollapsed && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                Restore Data
              </div>
            )}
          </button>
          <button
            onClick={() => setIsApiModalOpen(true)}
            title={isCollapsed ? "Pengaturan API" : ""}
            className="flex items-center w-full px-4 py-2 text-sm font-medium text-slate-600 rounded-xl hover:bg-white/40 transition-colors group relative"
          >
            <Key className={`flex-shrink-0 h-4 w-4 text-slate-400 ${isCollapsed ? 'mx-auto' : 'mr-3'}`} />
            {!isCollapsed && <span>Pengaturan API</span>}
            {isCollapsed && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                Pengaturan API
              </div>
            )}
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImport} 
            className="hidden" 
            accept=".json" 
          />
          <button
            onClick={handleLogout}
            title={isCollapsed ? "Keluar" : ""}
            className="flex items-center w-full px-4 py-2 mt-4 text-sm font-medium text-red-600 rounded-xl hover:bg-red-50 transition-colors group relative"
          >
            <LogOut className={`flex-shrink-0 h-4 w-4 text-red-500 ${isCollapsed ? 'mx-auto' : 'mr-3'}`} />
            {!isCollapsed && <span>Keluar</span>}
            {isCollapsed && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-red-600 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                Keluar
              </div>
            )}
          </button>
        </div>
      </motion.div>
      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
      <ApiKeyModal isOpen={isApiModalOpen} onClose={() => setIsApiModalOpen(false)} />
    </div>
  );
}
