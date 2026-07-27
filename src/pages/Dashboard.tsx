import Layout from '../components/Layout';
import { useStore } from '../store/useStore';
import { motion } from 'framer-motion';

export default function Dashboard() {
  const { profile } = useStore();

  return (
    <Layout>
      <div className="p-8">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/60 backdrop-blur-xl border border-white rounded-3xl shadow-xl shadow-slate-200/50 p-8"
        >
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Ikhtisar Profil</h1>
          <p className="text-slate-500 mb-6">Informasi data diri dan sekolah Anda.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
            <div className="p-4 bg-white/40 rounded-2xl border border-white/60 shadow-sm">
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Nama Guru</p>
              <p className="font-bold text-slate-800">{profile?.namaGuru}</p>
            </div>
            <div className="p-4 bg-white/40 rounded-2xl border border-white/60 shadow-sm">
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">NIP Guru</p>
              <p className="font-bold text-slate-800">{profile?.nip || '-'}</p>
            </div>
            <div className="p-4 bg-white/40 rounded-2xl border border-white/60 shadow-sm">
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Sekolah</p>
              <p className="font-bold text-slate-800">{profile?.namaSekolah}</p>
            </div>
            <div className="p-4 bg-white/40 rounded-2xl border border-white/60 shadow-sm">
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">NPSN</p>
              <p className="font-bold text-slate-800">{profile?.npsn}</p>
            </div>
            <div className="p-4 bg-white/40 rounded-2xl border border-white/60 shadow-sm">
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Kepala Sekolah</p>
              <p className="font-bold text-slate-800">{profile?.namaKepalaSekolah}</p>
            </div>
            <div className="p-4 bg-white/40 rounded-2xl border border-white/60 shadow-sm">
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">NIP Kepala Sekolah</p>
              <p className="font-bold text-slate-800">{profile?.nipKepalaSekolah || '-'}</p>
            </div>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}
