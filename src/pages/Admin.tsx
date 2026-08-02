import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, UserData, UpgradeRequest } from '../store/useStore';
import { motion } from 'motion/react';
import { 
  Users, 
  Key, 
  ShieldAlert, 
  CheckCircle, 
  Clock, 
  ArrowLeft, 
  RotateCcw, 
  UserCheck, 
  Award,
  RefreshCw,
  Search,
  Check,
  Phone
} from 'lucide-react';

export default function Admin() {
  const navigate = useNavigate();
  const { 
    usersData, 
    upgradeRequests, 
    adminResetPassword, 
    adminSetLabel, 
    adminApproveUpgrade 
  } = useStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [resettingUser, setResettingUser] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleResetPassword = (username: string) => {
    if (!newPassword.trim()) {
      alert("Sandi baru tidak boleh kosong!");
      return;
    }
    adminResetPassword(username, newPassword.trim());
    setResettingUser(null);
    setNewPassword('');
    showToast(`Sandi untuk ${username} berhasil disetel ulang!`);
  };

  const handleToggleLabel = (username: string, currentLabel?: 'Full Time' | 'Demo') => {
    const nextLabel = currentLabel === 'Full Time' ? 'Demo' : 'Full Time';
    adminSetLabel(username, nextLabel);
    showToast(`Label ${username} diubah menjadi ${nextLabel}!`);
  };

  const handleApprove = (req: UpgradeRequest) => {
    adminApproveUpgrade(req.id);
    showToast(`Permintaan ${req.namaLengkap} disetujui. Akses diubah ke Full Time!`);
  };

  // Convert usersData object to array
  const usersList = Object.keys(usersData).map(username => ({
    username,
    ...usersData[username]
  }));

  const filteredUsers = usersList.filter(u => 
    u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.profile?.namaGuru?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.profile?.namaSekolah?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 p-6 md:p-12">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-2xl transition-all shadow-sm text-slate-600"
              title="Kembali ke Aplikasi"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <ShieldAlert className="text-rose-600" size={24} />
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Panel Admin PAIBP Smart</h1>
              </div>
              <p className="text-slate-500 text-sm mt-0.5">Kelola pengguna, sandi, dan status akses lisensi aplikasi.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 px-4 py-2 rounded-2xl border border-emerald-100 text-sm font-semibold">
            <Award size={18} />
            Bypass Mode Aktif (CTRL+ALT+I+P)
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Total Pengguna</span>
              <div className="p-2.5 bg-slate-50 rounded-2xl text-slate-600">
                <Users size={20} />
              </div>
            </div>
            <h2 className="text-3xl font-black text-slate-900">{usersList.length}</h2>
            <p className="text-xs text-slate-500 mt-2">Akun terdaftar di penyimpanan lokal.</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Akun Demo Aktif</span>
              <div className="p-2.5 bg-amber-50 rounded-2xl text-amber-600">
                <Clock size={20} />
              </div>
            </div>
            <h2 className="text-3xl font-black text-slate-900">
              {usersList.filter(u => u.label !== 'Full Time').length}
            </h2>
            <p className="text-xs text-slate-500 mt-2">Akun dengan akses demo terbatas 24 jam.</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Pengajuan Upgrade</span>
              <div className="p-2.5 bg-rose-50 rounded-2xl text-rose-600">
                <UserCheck size={20} />
              </div>
            </div>
            <h2 className="text-3xl font-black text-slate-900">
              {(upgradeRequests || []).filter(r => r.status === 'pending').length}
            </h2>
            <p className="text-xs text-slate-500 mt-2">Menunggu persetujuan upgrade ke Full Time.</p>
          </div>
        </div>

        {/* Upgrade Requests Section */}
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden mb-10">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Histori Pengajuan Upgrade & Donasi</h2>
              <p className="text-xs text-slate-500 mt-0.5">Daftar pengguna demo yang telah mengirim pengajuan donasi kopi & rokok Rp 50.000.</p>
            </div>
            <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold">
              {(upgradeRequests || []).length} Pengajuan
            </span>
          </div>
          
          <div className="overflow-x-auto">
            {(!upgradeRequests || upgradeRequests.length === 0) ? (
              <div className="p-12 text-center text-slate-400">
                <UserCheck size={48} className="mx-auto text-slate-300 mb-3" />
                <p className="font-medium text-sm">Belum ada riwayat pengajuan upgrade lisensi.</p>
              </div>
            ) : (
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase tracking-widest font-bold text-slate-400">
                    <th className="p-4 pl-6">Tanggal</th>
                    <th className="p-4">Nama Lengkap</th>
                    <th className="p-4">No. WhatsApp</th>
                    <th className="p-4">Akun Terdaftar (Username)</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 pr-6 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {upgradeRequests.slice().reverse().map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 pl-6 text-slate-500">
                        {new Date(req.timestamp).toLocaleString('id-ID')}
                      </td>
                      <td className="p-4 font-bold text-slate-800">{req.namaLengkap}</td>
                      <td className="p-4 text-slate-600 font-mono">
                        <a 
                          href={`https://wa.me/${req.noWhatsapp.replace(/[^0-9]/g, '')}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="flex items-center gap-1.5 text-emerald-600 hover:underline font-semibold"
                        >
                          <Phone size={14} />
                          {req.noWhatsapp}
                        </a>
                      </td>
                      <td className="p-4 font-mono font-semibold text-indigo-600">{req.username}</td>
                      <td className="p-4 text-center">
                        {req.status === 'approved' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-xs font-bold">
                            <CheckCircle size={12} />
                            Full Time
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded-full text-xs font-bold">
                            <Clock size={12} />
                            Tertunda
                          </span>
                        )}
                      </td>
                      <td className="p-4 pr-6 text-center">
                        {req.status === 'pending' ? (
                          <button
                            onClick={() => handleApprove(req)}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/10 flex items-center gap-1 mx-auto"
                          >
                            <Check size={14} /> Setujui & Jadikan Full Time
                          </button>
                        ) : (
                          <span className="text-slate-400 text-xs font-medium">Selesai disetujui</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* User Management Section */}
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Kelola Pengguna Aplikasi</h2>
              <p className="text-xs text-slate-500 mt-0.5">Ubah lisensi atau setel ulang sandi pengguna terdaftar secara langsung.</p>
            </div>
            
            {/* Search Bar */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Cari Guru, sekolah, username..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            {filteredUsers.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Users className="mx-auto text-slate-300 mb-3" size={48} />
                <p className="font-medium text-sm">Tidak menemukan pengguna yang cocok.</p>
              </div>
            ) : (
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase tracking-widest font-bold text-slate-400">
                    <th className="p-4 pl-6">Username / Akun</th>
                    <th className="p-4">Nama Lengkap (Guru)</th>
                    <th className="p-4">Sekolah</th>
                    <th className="p-4">Kata Sandi</th>
                    <th className="p-4 text-center">Status Label</th>
                    <th className="p-4 pr-6 text-center">Aksi Manajemen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredUsers.map((u) => {
                    const isFullTime = u.label === 'Full Time';
                    const sTime = u.signupTime || Date.now();
                    const eTime = sTime + 24 * 60 * 60 * 1000;
                    const isExpired = !isFullTime && Date.now() >= eTime;
                    const timeLeft = Math.max(0, eTime - Date.now());
                    const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
                    const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

                    return (
                      <tr key={u.username} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 pl-6 font-mono font-bold text-indigo-700">
                          {u.username}
                        </td>
                        <td className="p-4 font-semibold text-slate-700">
                          {u.profile?.namaGuru || <span className="text-slate-400 italic text-xs">Belum diisi</span>}
                        </td>
                        <td className="p-4 text-slate-500">
                          {u.profile?.namaSekolah || <span className="text-slate-400 italic text-xs">Belum diisi</span>}
                        </td>
                        <td className="p-4">
                          {resettingUser === u.username ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                placeholder="Sandi baru..."
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs w-28 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 font-mono"
                              />
                              <button
                                onClick={() => handleResetPassword(u.username)}
                                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors"
                              >
                                Simpan
                              </button>
                              <button
                                onClick={() => {
                                  setResettingUser(null);
                                  setNewPassword('');
                                }}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg text-xs font-bold transition-colors"
                              >
                                Batal
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="font-mono bg-slate-100 px-2 py-1 rounded-md text-xs font-semibold text-slate-600">
                                {u.password || "paibpsmart"}
                              </span>
                              <button
                                onClick={() => {
                                  setResettingUser(u.username);
                                  setNewPassword(u.password || '');
                                }}
                                className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                                title="Reset Kata Sandi"
                              >
                                <RotateCcw size={14} />
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => handleToggleLabel(u.username, u.label)}
                            className={`inline-flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-sm ${
                              isFullTime 
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-100 hover:bg-emerald-100' 
                                : isExpired
                                ? 'bg-rose-50 text-rose-800 border-rose-100 hover:bg-rose-100'
                                : 'bg-amber-50 text-amber-800 border-amber-100 hover:bg-amber-100'
                            }`}
                            title="Klik untuk mengubah label"
                          >
                            <span className="flex items-center gap-1">
                              {isFullTime ? '🚀 Full Time' : isExpired ? '🔒 Demo (Expired)' : '⏳ Demo'}
                            </span>
                            {!isFullTime && !isExpired && (
                              <span className="text-[9px] font-normal opacity-75">
                                {hoursLeft}j {minutesLeft}m tersisa
                              </span>
                            )}
                          </button>
                        </td>
                        <td className="p-4 pr-6 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleToggleLabel(u.username, u.label)}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors flex items-center gap-1"
                            >
                              <RefreshCw size={12} />
                              Ubah Label ke {isFullTime ? "Demo" : "Full Time"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-sm font-semibold border border-slate-800">
          <Check className="text-emerald-400" size={18} />
          {toastMessage}
        </div>
      )}
    </div>
  );
}
