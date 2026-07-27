import { useEffect } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen } from 'lucide-react';
import { useStore } from '../store/useStore';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function Login() {
  const navigate = useNavigate();
  const { user, profile } = useStore();

  useEffect(() => {
    if (user) {
      if (profile) navigate('/dashboard');
      else navigate('/onboarding');
    }
  }, [user, profile, navigate]);

  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const docRef = doc(db, 'user_profiles', user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        navigate('/dashboard');
      } else {
        navigate('/onboarding');
      }
    } catch (error) {
      console.error(error);
    }
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
          <h1 className="text-2xl font-bold text-emerald-800 mb-2 uppercase tracking-wider">PAIBP Smart</h1>
          <p className="text-slate-500 mb-8 font-medium">Aplikasi Perangkat Pembelajaran Pendidikan Agama Islam dan Budi Pekerti (Fase A, B, C)</p>
          
          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 rounded-2xl py-3 px-4 text-slate-700 font-bold hover:bg-slate-50 transition-colors shadow-sm"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
            Lanjutkan dengan Google
          </button>
        </div>
        <div className="bg-emerald-50/50 p-6 text-center text-[10px] text-emerald-700 border-t border-emerald-100/50 font-medium">
          Menggunakan database referensi Capaian Pembelajaran BSKAP Kemendikbudristek No. 032/H/KR/2024 (Relevan dgn SK No. 20 Tahun 2026).
        </div>
      </motion.div>
    </div>
  );
}
