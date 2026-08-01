import React from 'react';
import { useState } from 'react';
import Layout from '../components/Layout';
import { useStore } from '../store/useStore';
import { motion } from 'motion/react';
import { Pencil, Check, X, Loader2 } from 'lucide-react';

export default function Dashboard() {
  const { profile, setProfile, user } = useStore();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Re-initialize state when editing starts to grab the latest profile
  const [formData, setFormData] = useState({
    namaGuru: profile?.namaGuru || '',
    nip: profile?.nip || '',
    namaSekolah: profile?.namaSekolah || '',
    npsn: profile?.npsn || '',
    namaKepalaSekolah: profile?.namaKepalaSekolah || '',
    nipKepalaSekolah: profile?.nipKepalaSekolah || '',
    tahunPelajaran: profile?.tahunPelajaran || '2026/2027',
  });
  

  const handleEditToggle = () => {
    if (!isEditing) {
      setFormData({
        namaGuru: profile?.namaGuru || '',
        nip: profile?.nip || '',
        namaSekolah: profile?.namaSekolah || '',
        npsn: profile?.npsn || '',
        namaKepalaSekolah: profile?.namaKepalaSekolah || '',
        nipKepalaSekolah: profile?.nipKepalaSekolah || '',
        tahunPelajaran: profile?.tahunPelajaran || '2026/2027',
      });
    }
    setIsEditing(!isEditing);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      if (profile) {
        setProfile({ ...profile, ...formData });
      }
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update profile", error);
      alert("Gagal memperbarui profil.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Layout>
      <div className="p-8">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/60 backdrop-blur-xl border border-white rounded-3xl shadow-xl shadow-slate-200/50 p-8"
        >
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 mb-1">Ikhtisar Profil</h1>
              <p className="text-slate-500">Informasi data diri dan sekolah Anda.</p>
            </div>
            {isEditing ? (
              <div className="flex items-center gap-2 mt-4 sm:mt-0">
                <button
                  onClick={handleEditToggle}
                  disabled={isSaving}
                  className="flex items-center gap-1 px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  <X className="w-4 h-4" /> Batal
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-1 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Simpan
                </button>
              </div>
            ) : (
              <button
                onClick={handleEditToggle}
                className="mt-4 sm:mt-0 flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
              >
                <Pencil className="w-4 h-4" />
                Perbarui Profil
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
            <div className="p-4 bg-white/40 rounded-2xl border border-white/60 shadow-sm">
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">Nama Guru</p>
              {isEditing ? (
                <input
                  type="text"
                  name="namaGuru"
                  value={formData.namaGuru}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm font-bold text-slate-800 bg-white/80 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              ) : (
                <p className="font-bold text-slate-800">{profile?.namaGuru}</p>
              )}
            </div>
            <div className="p-4 bg-white/40 rounded-2xl border border-white/60 shadow-sm">
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">NIP Guru</p>
              {isEditing ? (
                <input
                  type="text"
                  name="nip"
                  value={formData.nip}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm font-bold text-slate-800 bg-white/80 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              ) : (
                <p className="font-bold text-slate-800">{profile?.nip || '-'}</p>
              )}
            </div>
            <div className="p-4 bg-white/40 rounded-2xl border border-white/60 shadow-sm">
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">Sekolah</p>
              {isEditing ? (
                <input
                  type="text"
                  name="namaSekolah"
                  value={formData.namaSekolah}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm font-bold text-slate-800 bg-white/80 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              ) : (
                <p className="font-bold text-slate-800">{profile?.namaSekolah}</p>
              )}
            </div>
            <div className="p-4 bg-white/40 rounded-2xl border border-white/60 shadow-sm">
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">NPSN</p>
              {isEditing ? (
                <input
                  type="text"
                  name="npsn"
                  value={formData.npsn}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm font-bold text-slate-800 bg-white/80 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              ) : (
                <p className="font-bold text-slate-800">{profile?.npsn}</p>
              )}
            </div>
            <div className="p-4 bg-white/40 rounded-2xl border border-white/60 shadow-sm">
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">Kepala Sekolah</p>
              {isEditing ? (
                <input
                  type="text"
                  name="namaKepalaSekolah"
                  value={formData.namaKepalaSekolah}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm font-bold text-slate-800 bg-white/80 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              ) : (
                <p className="font-bold text-slate-800">{profile?.namaKepalaSekolah}</p>
              )}
            </div>
            <div className="p-4 bg-white/40 rounded-2xl border border-white/60 shadow-sm">
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">NIP Kepala Sekolah</p>
              {isEditing ? (
                <input
                  type="text"
                  name="nipKepalaSekolah"
                  value={formData.nipKepalaSekolah}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm font-bold text-slate-800 bg-white/80 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              ) : (
                <p className="font-bold text-slate-800">{profile?.nipKepalaSekolah || '-'}</p>
              )}
            </div>
            <div className="p-4 bg-white/40 rounded-2xl border border-white/60 shadow-sm">
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">Tahun Pelajaran</p>
              {isEditing ? (
                <input
                  type="text"
                  name="tahunPelajaran"
                  value={formData.tahunPelajaran}
                  onChange={handleChange}
                  placeholder="Contoh: 2026/2027"
                  className="w-full px-3 py-2 text-sm font-bold text-slate-800 bg-white/80 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              ) : (
                <p className="font-bold text-slate-800">{profile?.tahunPelajaran || '-'}</p>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}
