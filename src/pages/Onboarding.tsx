import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useStore } from '../store/useStore';
import { motion } from 'framer-motion';

export default function Onboarding() {
  const { user, setProfile } = useStore();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    namaGuru: '',
    namaSekolah: '',
    npsn: '',
    tahunPelajaran: '2026-2027',
    nip: '',
    namaKepalaSekolah: '',
    nipKepalaSekolah: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const profileData = { ...formData, uid: user.uid, createdAt: new Date() };
      await setDoc(doc(db, 'user_profiles', user.uid), profileData);
      setProfile(profileData);
      navigate('/schedule');
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center font-sans text-slate-800" style={{ background: 'radial-gradient(at top left, #e2e8f0, #f8fafc)' }}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-2xl w-full bg-white/60 backdrop-blur-xl border border-white rounded-3xl shadow-xl shadow-slate-200/50 p-8"
      >
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-slate-900">Identitas Guru</h2>
          <p className="mt-2 text-slate-500">Silakan lengkapi data wawancara awal berikut ini untuk memulai.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Nama Guru Lengkap</label>
              <input required type="text" name="namaGuru" value={formData.namaGuru} onChange={handleChange} className="block w-full rounded-xl border-white bg-white/80 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 border p-3 font-medium" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">NIP Guru (Opsional)</label>
              <input type="text" name="nip" value={formData.nip} onChange={handleChange} className="block w-full rounded-xl border-white bg-white/80 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 border p-3 font-medium" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Nama Sekolah Dasar</label>
              <input required type="text" name="namaSekolah" value={formData.namaSekolah} onChange={handleChange} className="block w-full rounded-xl border-white bg-white/80 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 border p-3 font-medium" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Nomor NPSN</label>
              <input required type="text" name="npsn" value={formData.npsn} onChange={handleChange} className="block w-full rounded-xl border-white bg-white/80 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 border p-3 font-medium" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Nama Kepala Sekolah</label>
              <input required type="text" name="namaKepalaSekolah" value={formData.namaKepalaSekolah} onChange={handleChange} className="block w-full rounded-xl border-white bg-white/80 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 border p-3 font-medium" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">NIP Kepala Sekolah</label>
              <input type="text" name="nipKepalaSekolah" value={formData.nipKepalaSekolah} onChange={handleChange} className="block w-full rounded-xl border-white bg-white/80 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 border p-3 font-medium" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-bold text-slate-700 mb-1">Tahun Pembelajaran</label>
              <input required type="text" name="tahunPelajaran" value={formData.tahunPelajaran} onChange={handleChange} className="block w-full rounded-xl border-white bg-slate-100 shadow-sm border p-3 font-medium text-slate-500" readOnly />
            </div>
          </div>
          <div className="pt-4">
            <button type="submit" className="w-full flex justify-center py-3 px-4 rounded-2xl shadow-lg shadow-emerald-200 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors">
              Simpan & Lanjutkan
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
