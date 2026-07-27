import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { motion } from 'framer-motion';
import { useStore } from '../store/useStore';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Save } from 'lucide-react';

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const GRADES = [1, 2, 3, 4, 5, 6];

interface ScheduleItem {
  day: string;
  jp: number;
}

export default function Schedule() {
  const { user } = useStore();
  const [schedules, setSchedules] = useState<Record<number, ScheduleItem>>({
    1: { day: '', jp: 0 },
    2: { day: '', jp: 0 },
    3: { day: '', jp: 0 },
    4: { day: '', jp: 0 },
    5: { day: '', jp: 0 },
    6: { day: '', jp: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchSchedules = async () => {
      if (!user) return;
      const docRef = doc(db, 'teaching_schedules', user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setSchedules(docSnap.data().schedules);
      }
      setLoading(false);
    };
    fetchSchedules();
  }, [user]);

  const handleChange = (grade: number, field: keyof ScheduleItem, value: string | number) => {
    setSchedules(prev => ({
      ...prev,
      [grade]: {
        ...prev[grade],
        [field]: value
      }
    }));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'teaching_schedules', user.uid), {
        uid: user.uid,
        schedules,
        updatedAt: new Date()
      });
      alert('Jadwal berhasil disimpan!');
    } catch (error) {
      console.error(error);
      alert('Gagal menyimpan jadwal.');
    }
    setSaving(false);
  };

  if (loading) return <Layout><div className="p-8">Memuat data...</div></Layout>;

  return (
    <Layout>
      <div className="p-8">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Jadwal & Beban JP</h1>
            <p className="text-slate-500 text-sm">Tentukan hari dan jumlah Jam Pelajaran (JP) untuk setiap kelas.</p>
          </div>
          <button 
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            <Save size={18} />
            {saving ? 'Menyimpan...' : 'Simpan Jadwal'}
          </button>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/40 border border-white/60 backdrop-blur-md rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden p-2"
        >
          <div className="overflow-x-auto rounded-2xl border border-white/40 bg-white/30">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-white/80 sticky top-0">
                <tr>
                  <th className="p-4 font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Kelas</th>
                  <th className="p-4 font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Hari Mengajar</th>
                  <th className="p-4 font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Beban JP / Minggu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/20">
                {GRADES.map(grade => (
                  <tr key={grade} className="hover:bg-white/40 transition-colors">
                    <td className="p-4 font-bold text-slate-700">Kelas {grade}</td>
                    <td className="p-4">
                      <select 
                        value={schedules[grade].day} 
                        onChange={(e) => handleChange(grade, 'day', e.target.value)}
                        className="w-full max-w-xs rounded-xl border-white bg-white/60 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 border p-2 font-medium"
                      >
                        <option value="">-- Pilih Hari --</option>
                        {DAYS.map(day => <option key={day} value={day}>{day}</option>)}
                      </select>
                    </td>
                    <td className="p-4">
                      <select 
                        value={schedules[grade].jp} 
                        onChange={(e) => handleChange(grade, 'jp', Number(e.target.value))}
                        className="w-full max-w-xs rounded-xl border-white bg-white/60 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 border p-2 font-medium"
                      >
                        <option value={0}>-- Pilih JP --</option>
                        <option value={2}>2 JP</option>
                        <option value={3}>3 JP</option>
                        <option value={4}>4 JP</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}
