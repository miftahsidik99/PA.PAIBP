import React from 'react';
import { ReactNode, useRef } from 'react';
import { useStore } from '../store/useStore';
import { LogOut, BookOpen, Calendar, BookText, Home, FileText, Download, Upload } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Kalender Akademik', href: '/academic-calendar', icon: Calendar },
  { name: 'Jadwal Mengajar', href: '/schedule', icon: Calendar },
  { name: 'Hari Efektif', href: '/effective-days', icon: BookOpen },
  { name: 'Program Tahunan', href: '/prota', icon: BookText },
  { name: 'Modul Ajar', href: '/modul-ajar', icon: FileText },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { profile, logout, importData } = useStore();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      <div className="w-64 h-full bg-white/40 backdrop-blur-md border-r border-white/20 p-6 flex flex-col">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-emerald-800 leading-tight uppercase tracking-wider flex items-center">
            <BookOpen className="text-emerald-600 mr-2" size={24} />
            <div>PAIBP<br/><span className="text-xs font-medium text-slate-500 tracking-normal">SD Assistant</span></div>
          </h1>
        </div>
        
        <div className="flex-1">
          <div className="mb-6">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Pengguna</p>
            <p className="text-sm font-bold text-slate-700 truncate">{profile?.namaGuru}</p>
          </div>
          
          <nav className="space-y-2">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-2 font-bold">Menu Utama</div>
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center px-4 py-3 rounded-xl text-sm transition-colors ${isActive ? 'bg-white/60 shadow-sm border border-white/40 font-semibold text-emerald-700' : 'hover:bg-white/40 font-medium text-slate-600'}`}
                >
                  <item.icon className={`mr-3 flex-shrink-0 h-5 w-5 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="mt-auto space-y-2 border-t border-slate-200/50 pt-4">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-2 font-bold">Data & Pencadangan</div>
          <button
            onClick={handleExport}
            className="flex items-center w-full px-4 py-2 text-sm font-medium text-slate-600 rounded-xl hover:bg-white/40 transition-colors"
          >
            <Download className="mr-3 h-4 w-4 text-slate-400" />
            Backup Data
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center w-full px-4 py-2 text-sm font-medium text-slate-600 rounded-xl hover:bg-white/40 transition-colors"
          >
            <Upload className="mr-3 h-4 w-4 text-slate-400" />
            Restore Data
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
            className="flex items-center w-full px-4 py-2 mt-4 text-sm font-medium text-red-600 rounded-xl hover:bg-red-50 transition-colors"
          >
            <LogOut className="mr-3 h-4 w-4 text-red-500" />
            Keluar
          </button>
        </div>
      </div>
      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
