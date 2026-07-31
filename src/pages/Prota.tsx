import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { GoogleGenAI } from '@google/genai';
import { motion } from 'framer-motion';
import { useStore } from '../store/useStore';
import { Download, Save, BrainCircuit } from 'lucide-react';
import { cpData } from '../data/cp';
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, AlignmentType, PageOrientation } from 'docx';
import { saveAs } from 'file-saver';
import { eachDayOfInterval, format, getDay, isSameMonth } from 'date-fns';
import { id } from 'date-fns/locale';

export default function Prota() {
  const { user, calendarData, geminiApiKey, schedules: storeSchedules, savedProtas: storeProtas, setSavedProtas: setStoreProtas } = useStore();
  const [schedules, setSchedules] = useState<Record<number, any>>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState<number>(1);
  const [protaData, setProtaData] = useState<any[]>([]);
  const [savedProtas, setSavedProtas] = useState<Record<number, any[]>>({});

  useEffect(() => {
    const fetchSchedulesAndProta = async () => {
      if (!user) return;
      
      if (Object.keys(storeSchedules).length > 0) {
        setSchedules(storeSchedules);
      }
      
      if (Object.keys(storeProtas).length > 0) {
        setSavedProtas(storeProtas);
        if (storeProtas[1]) {
          setProtaData(storeProtas[1]);
        }
      }
      
      setLoading(false);
    };
    fetchSchedulesAndProta();
  }, [user]);

  const handleGradeChange = (grade: number) => {
    setSelectedGrade(grade);
    setProtaData(savedProtas[grade] || []);
  };

  const handleGenerate = async () => {
    const gradeCp = cpData[selectedGrade as keyof typeof cpData];
    if (!gradeCp) return;
    
    if (!schedules[selectedGrade] || !schedules[selectedGrade].day) {
      alert("Silakan atur Jadwal Hari Mengajar terlebih dahulu di menu Jadwal untuk mendapatkan rentang tanggal yang akurat selama setahun.");
      return;
    }

    if (!geminiApiKey) {
      alert("API Key Gemini belum diatur. Silakan atur di menu 'Pengaturan API' di sidebar kiri.");
      return;
    }

    setGenerating(true);
    try {
      const jpPerWeek = schedules[selectedGrade]?.jp || 4;
      const totalMeetings = getEffectiveDates().length;
      
      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      const prompt = `Anda adalah seorang ahli pendidikan yang bertugas menyusun Program Tahunan (Prota) PAI dan Budi Pekerti Kelas ${selectedGrade} SD berdasarkan Permendikdasmen No. 13 Tahun 2025 (Pengganti Kurikulum Merdeka).
Capaian Pembelajaran dan Tujuan Pembelajaran Kelas ${selectedGrade}:
${gradeCp.map(item => `
Elemen: ${item.elemen}
CP: ${item.cp}
TP:
${item.tp.map((t: string, i: number) => `  ${i + 1}. ${t}`).join('\n')}`).join('\n')}

Tugas:
Pecah setiap Tujuan Pembelajaran di atas menjadi Alur Tujuan Pembelajaran (ATP) yang lebih rinci untuk alokasi waktu satu tahun ajaran penuh (Semester 1 dan Semester 2).
Setiap ATP akan dipelajari dalam 1 pertemuan (${jpPerWeek} JP).

ATURAN SANGAT PENTING (WAJIB DIIKUTI):
1. TOTAL SELURUH ATP DARI SEMUA ELEMEN JIKA DIJUMLAHKAN HARUS SAMA PERSIS DENGAN ${totalMeetings} ATP!
2. Anda memiliki ${gradeCp.length} elemen. Jika total target adalah ${totalMeetings}, maka rata-rata setiap elemen harus memiliki sekitar ${Math.round(totalMeetings / gradeCp.length)} ATP di dalam array "atp"-nya.
3. Distribusikan materi dari Semester 1 hingga Semester 2 secara logis dan berurutan.
4. JANGAN menghasilkan lebih sedikit atau lebih banyak dari ${totalMeetings} ATP secara keseluruhan. Hitung dengan teliti!

Berikan output HANYA berupa array JSON yang persis dengan input, tetapi dengan properti tambahan "atp" (array of strings) di setiap itemnya.
Contoh Format:
[
  {
    "elemen": "...",
    "cp": "...",
    "tp": ["..."],
    "atp": ["ATP 1...", "ATP 2..."]
  }
]
Jangan ada teks apa pun selain JSON yang valid. Jangan gunakan tag markdown \`\`\`json.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
      });
      
      let text = response.text || "[]";
      if (text.startsWith('```json')) {
        text = text.replace(/```json/g, '').replace(/```/g, '');
      }
      text = text.trim();
      if (text.endsWith('```')) {
        text = text.slice(0, -3).trim();
      }
      
      const protaArray = JSON.parse(text);
      
      // Post-processing to ENSURE exact total meetings
      let currentTotal = 0;
      protaArray.forEach((item: any) => {
        if (!Array.isArray(item.atp)) item.atp = ["Materi " + item.elemen];
        if (!Array.isArray(item.tp)) item.tp = [item.tp || ""];
        currentTotal += item.atp.length;
      });
      const targetTotal = totalMeetings || 36;
      
      if (protaArray.length > 0 && currentTotal < targetTotal) {
        let diff = targetTotal - currentTotal;
        let idx = 0;
        while (diff > 0) {
          protaArray[idx % protaArray.length].atp.push("Pendalaman Materi & Evaluasi");
          diff--;
          idx++;
        }
      } else if (protaArray.length > 0 && currentTotal > targetTotal) {
        let diff = currentTotal - targetTotal;
        let idx = protaArray.length - 1;
        while (diff > 0) {
          if (protaArray[idx].atp.length > 1) {
            protaArray[idx].atp.pop();
            diff--;
          }
          idx--;
          if (idx < 0) idx = protaArray.length - 1;
        }
      }

      setProtaData(protaArray);
      
    } catch (error) {
      console.error(error);
      alert('Terjadi kesalahan saat menghasilkan Prota dengan AI: ' + (error as any).message);
    }
    setGenerating(false);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const newData = { ...savedProtas, [selectedGrade]: protaData };
      setStoreProtas(newData);
      setSavedProtas(newData);
      alert('Program Tahunan berhasil disimpan!');
    } catch (error) {
      console.error(error);
      alert('Gagal menyimpan Program Tahunan.');
    }
    setSaving(false);
  };

  const getEffectiveDates = () => {
    if (!schedules[selectedGrade] || !schedules[selectedGrade].day) return [];
    
    const dayMap: Record<string, number> = {
      'Minggu': 0, 'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6
    };
    
    const dayIndex = dayMap[schedules[selectedGrade].day];
    
    // Default fallback dates if no calendar
    let startDate = new Date('2026-07-13');
    let endDate = new Date('2027-06-25');
    let events: Record<string, {isEffective: boolean}> = {};
    let weeklyDays = 5;

    if (calendarData) {
      const startYear = parseInt(calendarData.academicYear.split('/')[0] || '2026');
      startDate = new Date(startYear, 6, 1);
      endDate = new Date(startYear + 1, 5, 30);
      events = selectedGrade === 6 ? (calendarData.events6 || {}) : (calendarData.events1to5 || {});
      weeklyDays = calendarData.weeklyDays;
    }

    const allDays = eachDayOfInterval({ start: startDate, end: endDate });
    const matchDays = allDays.filter(d => getDay(d) === dayIndex);

    const effective = matchDays.filter(d => {
      const dateStr = format(d, 'yyyy-MM-dd');
      const dIndex = getDay(d);
      
      // Basic weekly off checks
      if (dIndex === 0) return false;
      if (dIndex === 6 && weeklyDays === 5) return false;
      
      // Custom events check
      const ev = events[dateStr];
      if (ev && !ev.isEffective) {
        return false;
      }
      
      return true;
    });

    return effective;
  };

  const generateDoc = async () => {
    const tableRows = [
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "No", bold: true })], alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Elemen", bold: true })], alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Capaian Pembelajaran (CP)", bold: true })], alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Tujuan Pembelajaran (TP)", bold: true })], alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Alur Tujuan Pembelajaran (ATP)", bold: true })], alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Alokasi JP", bold: true })], alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Rencana Tanggal", bold: true })], alignment: AlignmentType.CENTER })] }),
        ]
      })
    ];

    const effectiveDates = getEffectiveDates();
    let dateIndex = 0;
    const jpPerWeek = schedules[selectedGrade]?.jp || 4;

    protaData.forEach((item, idx) => {
      const atpCount = Math.max(1, item.atp?.length || 1);
      
      for (let atpIdx = 0; atpIdx < atpCount; atpIdx++) {
        const atpText = item.atp?.[atpIdx] || '-';
        let dateString = 'Belum diatur';
        if (atpText !== '-' && effectiveDates[dateIndex]) {
          const d = effectiveDates[dateIndex];
          const month = d.getMonth(); // 0-11
          const semesterLabel = (month >= 6) ? 'Semester 1 (Ganjil)' : 'Semester 2 (Genap)';
          dateString = format(d, "EEEE, d MMMM yyyy", { locale: id }) + `\n${semesterLabel}`;
          dateIndex++;
        }

        const cells = [];
        
        if (atpIdx === 0) {
          cells.push(new TableCell({ children: [new Paragraph({ text: (idx + 1).toString(), alignment: AlignmentType.CENTER })], rowSpan: atpCount }));
          cells.push(new TableCell({ children: [new Paragraph({ text: item.elemen })], rowSpan: atpCount }));
          cells.push(new TableCell({ children: [new Paragraph({ text: item.cp })], rowSpan: atpCount }));
          cells.push(new TableCell({ children: Array.isArray(item.tp) ? item.tp.map((t: string) => new Paragraph({ text: "- " + t })) : [new Paragraph({ text: "- " + (item.tp || "") })], rowSpan: atpCount }));
        }
        
        cells.push(new TableCell({ children: [new Paragraph({ text: atpText })] }));
        cells.push(new TableCell({ children: [new Paragraph({ text: `${jpPerWeek} JP`, alignment: AlignmentType.CENTER })] }));
        cells.push(new TableCell({ children: [new Paragraph({ text: dateString })] }));

        tableRows.push(new TableRow({ children: cells }));
      }
    });

    const doc = new Document({
      sections: [{
        properties: {
          page: { size: { orientation: PageOrientation.LANDSCAPE } }
        },
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: `Program Tahunan - Kelas ${selectedGrade}`, bold: true, size: 28 }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 }
          }),
          new Table({
            rows: tableRows,
            width: { size: 100, type: WidthType.PERCENTAGE }
          })
        ],
      }]
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `Prota_Kelas_${selectedGrade}.docx`);
  };

  if (loading) return <Layout><div className="p-8">Memuat data...</div></Layout>;

  return (
    <Layout>
      <div className="p-8">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Program Tahunan (Prota)</h1>
            <p className="text-slate-500 text-sm">Buat Prota otomatis dengan AI berdasarkan referensi CP dan TP.</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-2xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-colors disabled:opacity-50 text-sm"
            >
              <BrainCircuit size={18} />
              {generating ? 'Memproses AI...' : 'Hasilkan Prota'}
            </button>
            <button 
              onClick={handleSave}
              disabled={saving || protaData.length === 0}
              className="flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-2xl font-bold border border-emerald-200 hover:bg-emerald-200 transition-colors disabled:opacity-50 text-sm"
            >
              <Save size={18} />
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
            <button 
              onClick={generateDoc}
              disabled={protaData.length === 0}
              className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-2xl font-bold shadow-lg shadow-slate-200 hover:bg-slate-900 transition-colors disabled:opacity-50 text-sm"
            >
              <Download size={18} />
              Unduh Word (A4)
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
          {protaData.length > 0 ? (
            <div className="overflow-x-auto max-h-[700px] overflow-y-auto rounded-2xl border border-white/40 bg-white/30">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="sticky top-0 bg-white border-b-2 border-slate-200 z-10 shadow-sm">
                  <tr>
                    <th className="p-4 font-bold text-slate-700 text-center border-r border-slate-200 w-12">No</th>
                    <th className="p-4 font-bold text-slate-700 text-center border-r border-slate-200 w-32">Elemen</th>
                    <th className="p-4 font-bold text-slate-700 text-center border-r border-slate-200 w-64">Capaian Pembelajaran (CP)</th>
                    <th className="p-4 font-bold text-slate-700 text-center border-r border-slate-200 w-64">Tujuan Pembelajaran (TP)</th>
                    <th className="p-4 font-bold text-slate-700 text-center border-r border-slate-200">Alur Tujuan Pembelajaran (ATP)</th>
                    <th className="p-4 font-bold text-slate-700 text-center border-r border-slate-200 w-24">Alokasi JP</th>
                    <th className="p-4 font-bold text-slate-700 text-center w-40">Rencana Tanggal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm bg-white/40">
                  {(() => {
                    const effectiveDates = getEffectiveDates();
                    let dateIndex = 0;
                    const jpPerWeek = schedules[selectedGrade]?.jp || 4;

                    return protaData.map((item, idx) => {
                      const atpCount = Math.max(1, item.atp?.length || 1);
                      return (
                        <React.Fragment key={idx}>
                          {Array.from({ length: atpCount }).map((_, atpIdx) => {
                              const atpText = item.atp?.[atpIdx] || '-';
                            let dateString = 'Belum diatur';
                            let semesterLabel = '';
                            if (atpText !== '-' && effectiveDates[dateIndex]) {
                              const d = effectiveDates[dateIndex];
                              const month = d.getMonth(); // 0-11
                              semesterLabel = (month >= 6) ? 'Smt 1 (Ganjil)' : 'Smt 2 (Genap)';
                              dateString = format(d, "EEEE, d MMM yyyy", { locale: id });
                              dateIndex++;
                            }

                            return (
                              <tr key={`${idx}-${atpIdx}`} className="hover:bg-white/60 transition-colors align-top">
                                {atpIdx === 0 && (
                                  <>
                                    <td className="p-4 font-bold text-slate-500 text-center border-r border-slate-200" rowSpan={atpCount}>{idx + 1}</td>
                                    <td className="p-4 font-bold text-slate-800 border-r border-slate-200" rowSpan={atpCount}>{item.elemen}</td>
                                    <td className="p-4 text-slate-600 font-medium leading-relaxed border-r border-slate-200" rowSpan={atpCount}>{item.cp}</td>
                                    <td className="p-4 text-slate-600 font-medium border-r border-slate-200" rowSpan={atpCount}>
                                      <ul className="list-disc pl-4 space-y-2 marker:text-emerald-500">
                                        {Array.isArray(item.tp) ? item.tp.map((t: string, i: number) => <li key={i}>{t}</li>) : <li>{item.tp || "-"}</li>}
                                      </ul>
                                    </td>
                                  </>
                                )}
                                <td className="p-4 text-slate-700 font-medium border-r border-slate-200">{atpText}</td>
                                <td className="p-4 text-center font-bold text-emerald-700 border-r border-slate-200 whitespace-nowrap">{jpPerWeek} JP</td>
                                <td className="p-4 text-slate-600 font-medium whitespace-nowrap">
                                  <div className="font-semibold text-slate-800">{dateString}</div>
                                  {semesterLabel && <div className="text-xs text-emerald-600 font-bold mt-1">{semesterLabel}</div>}
                                </td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center flex flex-col items-center">
              <BrainCircuit className="w-12 h-12 mb-4 text-emerald-200" />
              <p className="font-bold text-slate-700">Belum ada Prota untuk Kelas {selectedGrade}.</p>
              <p className="text-sm mt-1 text-slate-500">Klik tombol 'Hasilkan Prota' untuk membuat ATP dengan AI.</p>
            </div>
          )}
        </motion.div>
      </div>
    </Layout>
  );
}
