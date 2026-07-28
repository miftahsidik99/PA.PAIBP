import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { motion } from 'framer-motion';
import { useStore } from '../store/useStore';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Download, CheckSquare, RefreshCw } from 'lucide-react';
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, AlignmentType, BorderStyle, ShadingType } from 'docx';
import { saveAs } from 'file-saver';

export default function ModulAjar() {
  const { user, profile } = useStore();
  const [schedules, setSchedules] = useState<Record<number, any>>({});
  const [savedProtas, setSavedProtas] = useState<Record<number, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedGrade, setSelectedGrade] = useState<number>(1);
  const [selectedAtp, setSelectedAtp] = useState<string[]>([]);

  useEffect(() => {
    const fetchSchedulesAndProta = async () => {
      if (!user) return;
      
      const schedRef = doc(db, 'teaching_schedules', user.uid);
      const schedSnap = await getDoc(schedRef);
      if (schedSnap.exists()) {
        setSchedules(schedSnap.data().schedules);
      }

      const protaRef = doc(db, 'protas', user.uid);
      const protaSnap = await getDoc(protaRef);
      if (protaSnap.exists()) {
        setSavedProtas(protaSnap.data().data || {});
      }

      setLoading(false);
    };
    fetchSchedulesAndProta();
  }, [user]);

  const handleGradeChange = (grade: number) => {
    setSelectedGrade(grade);
    setSelectedAtp([]);
  };

  const toggleAtp = (atp: string) => {
    setSelectedAtp(prev => 
      prev.includes(atp) ? prev.filter(a => a !== atp) : [...prev, atp]
    );
  };

  const syncATP = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const protaRef = doc(db, 'protas', user.uid);
      const protaSnap = await getDoc(protaRef);
      if (protaSnap.exists()) {
        setSavedProtas(protaSnap.data().data || {});
      }
      setSelectedAtp([]);
    } catch (err) {
      console.error(err);
      alert('Gagal menyinkronkan data ATP');
    } finally {
      setLoading(false);
    }
  };

  const [isGeneratingModul, setIsGeneratingModul] = useState(false);

  const generateModulAjar = async () => {
    if (selectedAtp.length === 0) return;
    
    const jpPerWeek = schedules[selectedGrade]?.jp || 4;
    const totalJp = selectedAtp.length * jpPerWeek;
    const pertemuan = selectedAtp.length;


    setIsGeneratingModul(true);
    
    try {
      const response = await fetch('/api/generate-modul-ajar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          atps: selectedAtp,
          grade: selectedGrade
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || 'Gagal menghasilkan Modul Ajar dari server');
      }

      const data = await response.json();

      const headerShading = {
        fill: "F3F4F6",
        type: ShadingType.CLEAR,
        color: "auto"
      };
      
      const cellBorders = {
        top: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
        left: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
        right: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
      };

      const createTableRow = (label: string, content: any, isHeader = false) => {
        return new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, color: isHeader ? "000000" : "374151" })] })],
              width: { size: 30, type: WidthType.PERCENTAGE },
              shading: headerShading,
              borders: cellBorders,
              margins: { top: 100, bottom: 100, left: 100, right: 100 }
            }),
            new TableCell({
              children: Array.isArray(content) 
                ? content.map(c => new Paragraph({ text: c, spacing: { after: 100 } }))
                : [new Paragraph({ text: content })],
              width: { size: 70, type: WidthType.PERCENTAGE },
              borders: cellBorders,
              margins: { top: 100, bottom: 100, left: 100, right: 100 }
            })
          ]
        });
      };

      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              children: [new TextRun({ text: "MODUL AJAR PAI DAN BUDI PEKERTI", bold: true, size: 28 })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 }
            }),
            new Paragraph({
              children: [new TextRun({ text: "Implementasi Permendikdasmen No. 13 Tahun 2025 (8,3,3,4)", italics: true, size: 24 })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 }
            }),
            
            new Table({
              rows: [
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "INFORMASI UMUM", bold: true })] })], columnSpan: 2, shading: headerShading, borders: cellBorders, margins: { top: 100, bottom: 100, left: 100, right: 100 } })
                  ]
                }),
                createTableRow("Nama Guru", profile?.namaGuru || '-'),
                createTableRow("Sekolah", profile?.namaSekolah || '-'),
                createTableRow("Kelas", selectedGrade.toString()),
                createTableRow("Alokasi Waktu", `${totalJp} JP (${pertemuan} Pertemuan)`),
                
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "KOMPONEN INTI", bold: true })] })], columnSpan: 2, shading: headerShading, borders: cellBorders, margins: { top: 100, bottom: 100, left: 100, right: 100 } })
                  ]
                }),
                createTableRow("Tujuan Pembelajaran", data.tujuanPembelajaran),
                createTableRow("Alur Tujuan Pembelajaran", selectedAtp.map((a: string, i: number) => `${i+1}. ${a}`)),
                
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "PENERAPAN KONSEP 8, 3, 3, 4", bold: true })] })], columnSpan: 2, shading: headerShading, borders: cellBorders, margins: { top: 100, bottom: 100, left: 100, right: 100 } })
                  ]
                }),
                createTableRow("8 Profil Lulusan", data.profilLulusan.map((p: string) => `- ${p}`)),
                createTableRow("3 Prinsip Pembelajaran", [
                  `Mindfull Learning: ${data.prinsipPembelajaran.mindfullLearning}`,
                  `Joy Full Learning: ${data.prinsipPembelajaran.joyfullLearning}`,
                  `Meaning Full Learning: ${data.prinsipPembelajaran.meaningfullLearning}`
                ]),
                createTableRow("3 Pengalaman Belajar", [
                  `Memahami: ${data.pengalamanBelajar.memahami}`,
                  `Mengaplikasi: ${data.pengalamanBelajar.mengaplikasi}`,
                  `Merefleksi: ${data.pengalamanBelajar.merefleksi}`
                ]),
                createTableRow("4 Kerangka Pembelajaran", [
                  `Praktik Pedagogis: ${data.kerangkaPembelajaran.praktikPedagogis}`,
                  `Kemitraan Pembelajaran: ${data.kerangkaPembelajaran.kemitraanPembelajaran || data.kerangkaPembelajaran.kerangkaPembelajaran || '-'}`,
                  `Lingkungan Pembelajaran: ${data.kerangkaPembelajaran.lingkunganPembelajaran}`,
                  `Pemanfaatan Teknologi Digital: ${data.kerangkaPembelajaran.pemanfaatanTeknologiDigital}`
                ]),
                
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "LEMBAR KERJA PESERTA DIDIK (LKPD)", bold: true })] })], columnSpan: 2, shading: headerShading, borders: cellBorders, margins: { top: 100, bottom: 100, left: 100, right: 100 } })
                  ]
                }),
                createTableRow("Judul LKPD", data.lkpd.judul),
                createTableRow("Tujuan", data.lkpd.tujuan),
                createTableRow("Alat & Bahan", data.lkpd.alatBahan),
                createTableRow("Langkah Kerja", data.lkpd.langkahKerja.map((l: string, i: number) => `${i+1}. ${l}`)),
                createTableRow("Soal / Tugas", data.lkpd.soalTugas.map((s: string, i: number) => `${i+1}. ${s}`)),
              ],
              width: { size: 100, type: WidthType.PERCENTAGE }
            }),
          ],
        }]
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `Modul_Ajar_Kelas_${selectedGrade}.docx`);
    } catch (error: any) {
      console.error(error);
      alert(`Terjadi kesalahan: ${error.message}`);
    } finally {
      setIsGeneratingModul(false);
    }
  };

  const protaList = savedProtas[selectedGrade] || [];
  
  // Flatten ATPs
  const allAtps: { elemen: string, atp: string }[] = [];
  protaList.forEach(item => {
    item.atp.forEach((a: string) => {
      allAtps.push({ elemen: item.elemen, atp: a });
    });
  });

  if (loading) return <Layout><div className="p-8">Memuat data...</div></Layout>;

  return (
    <Layout>
      <div className="p-8">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Modul Ajar</h1>
            <p className="text-slate-500 text-sm">Pilih ATP untuk digabungkan menjadi satu Modul Ajar (Prinsip 8334).</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={syncATP}
              disabled={loading}
              className="flex items-center gap-2 bg-white/60 text-emerald-700 border border-emerald-200 px-4 py-2 rounded-2xl font-bold hover:bg-emerald-50 transition-colors disabled:opacity-50 text-sm"
            >
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
              Sinkron ATP
            </button>
            <button 
              onClick={generateModulAjar}
              disabled={selectedAtp.length === 0 || isGeneratingModul}
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-2xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-colors disabled:opacity-50 text-sm"
            >
              <Download size={18} />
              {isGeneratingModul ? 'Memproses...' : `Buat Modul Ajar (${selectedAtp.length} ATP)`}
            </button>
          </div>
        </div>

        <div className="mb-6 flex gap-2">
          {[1,2,3,4,5,6].map(grade => (
            <button
              key={grade}
              onClick={() => handleGradeChange(grade)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${selectedGrade === grade ? 'bg-white/60 shadow-sm border border-white/40 text-emerald-700' : 'bg-white/30 text-slate-600 border border-white/40 hover:bg-white/50'}`}
            >
              Kelas {grade}
            </button>
          ))}
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          key={selectedGrade}
          className="bg-white/40 border border-white/60 backdrop-blur-md rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden p-2"
        >
          {allAtps.length > 0 ? (
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto rounded-2xl border border-white/40 bg-white/30">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="sticky top-0 bg-white/90 border-b border-slate-100 z-10">
                  <tr>
                    <th className="p-4 font-bold text-slate-400 uppercase tracking-widest w-16 text-center">Pilih</th>
                    <th className="p-4 font-bold text-slate-400 uppercase tracking-widest w-48">Elemen</th>
                    <th className="p-4 font-bold text-slate-400 uppercase tracking-widest">Alur Tujuan Pembelajaran</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/20 text-sm">
                  {allAtps.map((item, idx) => {
                    const isSelected = selectedAtp.includes(item.atp);
                    return (
                      <tr 
                        key={idx} 
                        onClick={() => toggleAtp(item.atp)}
                        className={`cursor-pointer transition-colors ${isSelected ? 'bg-emerald-50/50' : 'hover:bg-white/40'}`}
                      >
                        <td className="p-4 text-center">
                          <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center mx-auto transition-colors ${isSelected ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm' : 'border-slate-300 bg-white/50'}`}>
                            {isSelected && <CheckSquare size={16} />}
                          </div>
                        </td>
                        <td className="p-4 font-bold text-slate-800">{item.elemen}</td>
                        <td className="p-4 text-slate-600 font-medium">{item.atp}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center flex flex-col items-center">
              <CheckSquare className="w-12 h-12 mb-4 text-emerald-200" />
              <p className="font-bold text-slate-700">Belum ada Prota untuk Kelas {selectedGrade}.</p>
              <p className="text-sm mt-1 text-slate-500">Silakan buat Program Tahunan terlebih dahulu.</p>
            </div>
          )}
        </motion.div>
      </div>
    </Layout>
  );
}
