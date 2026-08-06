import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { BookOpen, LogIn, Youtube, Play, ExternalLink, Tv, Video } from 'lucide-react';
import { useStore } from '../store/useStore';
import { getYouTubeThumbnailUrl } from '../lib/youtube';

export default function Login() {
  const navigate = useNavigate();
  const { user, profile, verifyAndLogin, flashcards, setFlashcards } = useStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (user) {
      if (profile) navigate('/dashboard');
      else navigate('/onboarding');
    }
  }, [user, profile, navigate]);

  // Sync flashcards real-time from Firestore if available
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    import('../lib/firebase').then(({ db, doc, onSnapshot }) => {
      unsubscribe = onSnapshot(doc(db, 'app_config', 'flashcards'), (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data && Array.isArray(data.items)) {
            setFlashcards(data.items);
          }
        }
      }, (error) => {
        console.warn("Firestore flashcards listener warning:", error);
      });
    }).catch(err => console.error(err));

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [setFlashcards]);

  // Admin secret shortcut: 7 consecutive taps anywhere
  useEffect(() => {
    let tapCount = 0;
    let lastTap = 0;

    const handleTap = () => {
      const now = Date.now();
      if (now - lastTap < 1500) {
        tapCount += 1;
      } else {
        tapCount = 1;
      }
      lastTap = now;

      if (tapCount >= 7) {
        navigate('/admin');
      }
    };

    window.addEventListener('click', handleTap);
    return () => window.removeEventListener('click', handleTap);
  }, [navigate]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      alert("Masukkan username dan password.");
      return;
    }
    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();

    const result = verifyAndLogin(cleanUsername, cleanPassword);
    if (result === 'not_found') {
      alert("Akun tidak ditemukan. Silakan Daftar Akun baru.");
    } else if (result === 'invalid_password') {
      alert("Kata sandi salah. Silakan coba lagi atau hubungi Admin.");
    } else if (result === 'already_active') {
      alert("Tidak Bisa login Karena Akun ini aktif dan sedang berjalan di perangkat lain");
    }
  };

  const handleOpenFlashcard = (url: string) => {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen py-10 px-4 sm:px-6 font-sans text-slate-800 flex flex-col justify-between items-center" style={{ background: 'radial-gradient(at top center, #f1f5f9, #e2e8f0, #cbd5e1)' }}>
      
      {/* Top Banner & Login Card Area */}
      <div className="w-full max-w-5xl mx-auto flex flex-col items-center">
        
        {/* Main Login Form Card */}
        <motion.div 
          initial={{ opacity: 0, y: 25, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md bg-white/75 backdrop-blur-2xl border border-white/80 p-3 rounded-3xl shadow-2xl shadow-slate-300/60 overflow-hidden mb-12"
        >
          <div className="p-7 text-center">
            <div className="mx-auto w-16 h-16 bg-gradient-to-tr from-emerald-500 to-teal-600 text-white rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-emerald-500/20">
              <BookOpen size={32} />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-1 uppercase">PAIBP Smart</h1>
            <p className="text-xs text-slate-500 mb-6 font-medium leading-relaxed">
              Aplikasi Perangkat Pembelajaran Pendidikan Agama Islam & Budi Pekerti SD Berbasis Permendikdasmen 13/2025 & Kurikulum Berbasis Cinta
            </p>
            
            <form onSubmit={handleLogin} className="space-y-3.5">
              <div>
                <input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 bg-white/90 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-medium text-slate-800 placeholder:text-slate-400 transition-all shadow-sm"
                  required
                />
              </div>
              <div>
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white/90 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-medium text-slate-800 placeholder:text-slate-400 transition-all shadow-sm"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl py-3 px-4 font-bold text-sm transition-all shadow-md shadow-emerald-600/20 hover:shadow-lg"
              >
                <LogIn className="w-4 h-4" />
                Masuk ke Aplikasi
              </button>
            </form>
            
            <div className="mt-5 text-xs text-slate-600 font-medium">
              Belum punya akun? <Link to="/signup" className="text-emerald-700 hover:text-emerald-800 font-bold underline decoration-emerald-300 underline-offset-2">Daftar di sini</Link>
            </div>
          </div>
          <div className="bg-emerald-50/60 p-4 text-center text-[11px] text-emerald-800 border-t border-emerald-100/60 font-medium">
            🔒 Data riwayat dan jurnal tersimpan aman & dapat diakses multi-perangkat.
          </div>
        </motion.div>

        {/* Flashcards Section - Only render when admin has added flashcards */}
        {flashcards && flashcards.length > 0 && (
          <div className="w-full">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {flashcards.map((item, index) => {
                const thumbUrl = getYouTubeThumbnailUrl(item.url);

                return (
                  <motion.div
                    key={item.id || index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * index + 0.3 }}
                    whileHover={{ y: -6, scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleOpenFlashcard(item.url)}
                    className="group cursor-pointer bg-white/80 backdrop-blur-xl border border-white/90 rounded-2xl p-3 shadow-lg hover:shadow-xl shadow-slate-200/50 hover:shadow-rose-500/10 transition-all duration-300 flex flex-col justify-between overflow-hidden relative"
                  >
                    {/* Top Thumbnail Image Container */}
                    <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-slate-900 border border-slate-100 mb-3 shadow-sm">
                      {thumbUrl ? (
                        <img 
                          src={thumbUrl} 
                          alt={item.title} 
                          className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500" 
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 text-white p-4">
                          <Video size={32} className="text-rose-500 mb-1" />
                          <span className="text-[10px] text-slate-300">Video Edukasi</span>
                        </div>
                      )}

                      {/* YouTube Play Icon Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex items-center justify-center opacity-90 group-hover:opacity-100 transition-opacity">
                        <div className="w-12 h-12 bg-rose-600 text-white rounded-2xl flex items-center justify-center shadow-xl shadow-rose-600/40 group-hover:scale-110 transition-transform duration-300 border border-rose-400/30">
                          <Play size={20} className="fill-white ml-0.5" />
                        </div>
                      </div>

                      {/* Top Right Tag */}
                      <div className="absolute top-2 right-2 px-2.5 py-1 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold rounded-lg flex items-center gap-1 border border-white/20">
                        <Youtube size={12} className="text-rose-500" />
                        YouTube
                      </div>
                    </div>

                    {/* Content Info */}
                    <div className="px-1 pb-1 space-y-2 flex-1 flex flex-col justify-between">
                      <h3 className="font-bold text-slate-900 text-sm group-hover:text-rose-600 transition-colors line-clamp-2 leading-snug">
                        {item.title}
                      </h3>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-rose-600 font-bold">
                        <span className="inline-flex items-center gap-1 group-hover:underline">
                          Tonton Video
                        </span>
                        <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg group-hover:bg-rose-600 group-hover:text-white transition-colors">
                          <ExternalLink size={14} />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* Footer info */}
      <div className="mt-12 text-center text-xs text-slate-400 font-medium">
        © 2026 PAIBP Smart App. Sistem Informasi & Perangkat Pembelajaran PAI SD.
      </div>
    </div>
  );
}
