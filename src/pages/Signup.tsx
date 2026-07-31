import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, UserPlus } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function Signup() {
  const navigate = useNavigate();
  const { user, profile, login } = useStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (user) {
      if (profile) navigate('/dashboard');
      else navigate('/onboarding');
    }
  }, [user, profile, navigate]);

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      alert("Masukkan username dan password.");
      return;
    }
    // Simple mock signup handling (same as login since it's local):
    login(username.trim().toLowerCase());
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 font-sans text-slate-800" style={{ background: 'radial-gradient(at top left, #e2e8f0, #f8fafc)' }}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white/60 backdrop-blur-xl border border-white p-2 rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden"
      >
        <div className="p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6">
            <BookOpen size={32} />
          </div>
          <h1 className="text-2xl font-bold text-emerald-800 mb-2 uppercase tracking-wider">Daftar Akun</h1>
          <p className="text-slate-500 mb-8 font-medium">Buat akun lokal baru untuk menyimpan perangkat pembelajaran</p>
          
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-white/80 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-left"
                required
              />
            </div>
            <div>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white/80 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-left"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-3 bg-emerald-600 text-white rounded-xl py-3 px-4 font-bold hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <UserPlus className="w-5 h-5" />
              Daftar
            </button>
          </form>
          
          <div className="mt-6 text-sm text-slate-600 font-medium">
            Sudah punya akun? <Link to="/" className="text-emerald-600 hover:text-emerald-700 font-bold">Masuk di sini</Link>
          </div>
        </div>
        <div className="bg-emerald-50/50 p-6 text-center text-[10px] text-emerald-700 border-t border-emerald-100/50 font-medium">
          Data riwayat Anda disimpan secara offline di perangkat ini.
        </div>
      </motion.div>
    </div>
  );
}
