import React from 'react';
import { ReactNode, useRef } from 'react';
import { useStore } from '../store/useStore';
import { LogOut, BookOpen, Calendar, BookText, Home, FileText, Download, Upload, Users, ChevronLeft, Menu, ClipboardList, ShieldAlert, CheckCircle } from 'lucide-react';
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
  { name: 'Jurnal', href: '/jurnal', icon: BookOpen },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { profile, logout, importData, currentUser, usersData, submitUpgradeRequest } = useStore();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  // Expiry states
  const activeUser = currentUser ? usersData[currentUser] : null;
  const isDemo = activeUser?.label === 'Demo';
  const signupTime = activeUser?.signupTime || Date.now();
  const expiryTime = signupTime + 24 * 60 * 60 * 1000;
  
  const [now, setNow] = useState(Date.now());
  React.useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const isExpired = isDemo && now >= expiryTime;

  // Form states for activation
  const [namaLengkap, setNamaLengkap] = useState('');
  const [noWhatsapp, setNoWhatsapp] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

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

  if (isExpired) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center p-4 font-sans text-slate-800" style={{ background: 'radial-gradient(at top left, #e2e8f0, #f8fafc)' }}>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-xl w-full bg-white/70 backdrop-blur-xl border border-white p-8 rounded-3xl shadow-2xl shadow-slate-200/50 relative overflow-hidden"
        >
          {/* Decorative warning banner */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-rose-500 to-amber-500" />
          
          <div className="text-center mb-6">
            <div className="mx-auto w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-rose-200/50">
              <ShieldAlert size={32} />
            </div>
            <span className="px-3 py-1 bg-rose-50 text-rose-700 border border-rose-100 rounded-full text-[10px] font-bold uppercase tracking-wider">
              Akses Demo Berakhir
            </span>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 mt-3 leading-tight">
              Lanjut Aplikasi dengan Memberikan donasi 50.000 untuk mengganti kopi dan rokok kepada pihak pengembang
            </h1>
            <p className="text-slate-500 text-xs mt-2 font-medium">
              Masa uji coba gratis 1x24 jam akun Anda telah habis. Selesaikan donasi untuk mengaktifkan akses penuh tanpa batas.
            </p>
          </div>

          {/* Payment Instructions */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 mb-6 space-y-3.5 text-xs text-slate-700 font-medium">
            <div className="flex justify-between items-center bg-white border border-slate-200 p-2.5 rounded-xl">
              <span className="text-slate-400 font-bold uppercase text-[9px]">Bank Tujuan</span>
              <span className="font-extrabold text-slate-900">BANK BJB</span>
            </div>
            <div className="flex justify-between items-center bg-white border border-slate-200 p-2.5 rounded-xl">
              <span className="text-slate-400 font-bold uppercase text-[9px]">Nomor Rekening</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-black text-indigo-700 text-sm">0121478501100</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText('0121478501100');
                    alert('Nomor rekening berhasil disalin!');
                  }}
                  className="bg-slate-100 hover:bg-slate-200 font-bold px-2 py-1 rounded text-[10px] transition-colors"
                >
                  Salin
                </button>
              </div>
            </div>
            <div className="bg-emerald-50 text-emerald-800 p-4 rounded-xl border border-emerald-100/50 leading-relaxed space-y-1">
              <p className="font-bold text-[11px] text-emerald-900">TRF Ke BANK BJB: 0121478501100</p>
              <p>Kirim screenshoot Bukti Berhasil Melakukan Pembayaran Pada Nomor WA: <strong>+6282312194682</strong></p>
              <p className="text-[11px] font-bold text-emerald-900">Lengkapi bukti bayar dengan mengirim screenshoot pembayaran berhasil dilakukan</p>
            </div>
          </div>

          {/* Submission Form */}
          {isSubmitted ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-emerald-50/75 border border-emerald-100 p-5 rounded-2xl text-center text-xs"
            >
              <CheckCircle className="text-emerald-600 mx-auto mb-2" size={32} />
              <h3 className="font-bold text-slate-900 text-sm">Formulir Pengajuan Berhasil Terkirim!</h3>
              <p className="text-slate-600 mt-1 leading-relaxed">
                Silakan lakukan konfirmasi dengan mengirimkan bukti transfer via WhatsApp agar Admin dapat langsung memperbarui lisensi Anda menjadi <strong>Full Time</strong>.
              </p>
              <div className="mt-4 flex gap-2">
                <a 
                  href={`https://wa.me/6282312194682?text=Halo%20Pengembang,%20saya%20sudah%20melakukan%20donasi%20Rp%2050.000%20untuk%20PAIBP%20Smart.%20Nama:%20${encodeURIComponent(namaLengkap)},%20Username:%20${encodeURIComponent(currentUser || '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-center rounded-xl font-bold transition-all shadow-md shadow-emerald-600/10 flex items-center justify-center gap-1.5"
                >
                  Hubungi WA (+6282312194682)
                </a>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors"
                >
                  Keluar
                </button>
              </div>
            </motion.div>
          ) : (
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!namaLengkap.trim() || !noWhatsapp.trim()) {
                alert("Harap lengkapi semua isian formulir!");
                return;
              }
              submitUpgradeRequest(namaLengkap.trim(), noWhatsapp.trim(), currentUser || '');
              setIsSubmitted(true);
            }} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nama Lengkap Guru</label>
                <input
                  type="text"
                  placeholder="Masukkan Nama Lengkap Anda"
                  value={namaLengkap}
                  onChange={(e) => setNamaLengkap(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nomor WhatsApp Aktif</label>
                <input
                  type="tel"
                  placeholder="Contoh: 082312345678"
                  value={noWhatsapp}
                  onChange={(e) => setNoWhatsapp(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Akun yang Terdaftar (Username)</label>
                <input
                  type="text"
                  value={currentUser || ''}
                  readOnly
                  className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono font-bold text-indigo-700"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs transition-colors"
                >
                  Keluar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm"
                >
                  Kirim Data Donasi
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    );
  }

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
            {!isCollapsed && (
              <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold mt-1 ${isDemo ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                {isDemo ? '⏳ Akun Demo' : '🚀 Full Time'}
              </span>
            )}
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
