import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { motion } from 'framer-motion';
import { useStore } from '../store/useStore';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Download, FileText } from 'lucide-react';
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { eachDayOfInterval, format, getDay, isSameMonth } from 'date-fns';
import { id } from 'date-fns/locale';

// Map day string to date-fns day index (0 = Sunday, 1 = Monday)
const dayMap: Record<string, number> = {
  'Minggu': 0, 'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6
};

// Simplified holidays 2026-2027 for demo purposes
const holidays = [
  '2026-08-17', // Hari Kemerdekaan
  '2026-12-25', // Natal
  '2027-01-01', // Tahun Baru
];

export default function EffectiveDays() {
  const { user, calendarData } = useStore();
  const [schedules, setSchedules] = useState<Record<number, any>>({});
  const [loading, setLoading] = useState(true);
  const [selectedGrade, setSelectedGrade] = useState<number>(1);
  const [effectiveDates, setEffectiveDates] = useState<{date: string, type: string, semester: number}[]>([]);
  const [semester1Count, setSemester1Count] = useState(0);
  const [semester2Count, setSemester2Count] = useState(0);

  useEffect(() => {
    const fetchSchedules = async () => {
      if (!user) return;
      const docRef = doc(db, 'teaching_schedules', user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setSchedules(docSnap.data().schedules);
      }
      
      // Also fetch calendar if not in store
      if (!calendarData) {
        const calRef = doc(db, 'academic_calendar', user.uid);
        const calSnap = await getDoc(calRef);
        if (calSnap.exists()) {
          useStore.getState().setCalendarData(calSnap.data() as any);
        }
      }
      
      setLoading(false);
    };
    fetchSchedules();
  }, [user]);

  useEffect(() => {
    if (!schedules[selectedGrade] || !schedules[selectedGrade].day) {
      setEffectiveDates([]);
      setSemester1Count(0);
      setSemester2Count(0);
      return;
    }

    const dayIndex = dayMap[schedules[selectedGrade].day];
    
    // Determine start/end based on calendarData academicYear or default 2026/2027
    const yearStr = calendarData?.academicYear?.split('/')[0] || '2026';
    const startYear = parseInt(yearStr);
    
    const startDate = new Date(startYear, 6, 1); // July 1st
    const endDate = new Date(startYear + 1, 5, 30); // June 30th

    const allDays = eachDayOfInterval({ start: startDate, end: endDate });
    const matchDays = allDays.filter(d => getDay(d) === dayIndex);

    // Get events for the selected grade
    const events = selectedGrade === 6 
      ? (calendarData?.events6 || {}) 
      : (calendarData?.events1to5 || {});

    let sem1 = 0;
    let sem2 = 0;

    const processed = matchDays.map(d => {
      const dateStr = format(d, 'yyyy-MM-dd');
      let type = 'Efektif';
      let isEfektif = true;

      // Semester 1 is July (6) to December (11)
      // Semester 2 is January (0) to June (5)
      const semester = d.getMonth() >= 6 ? 1 : 2;

      if (events[dateStr]) {
        type = events[dateStr].label;
        isEfektif = events[dateStr].isEffective;
      }

      if (isEfektif) {
        if (semester === 1) sem1++;
        else sem2++;
      }

      return { date: dateStr, type, semester };
    });

    setEffectiveDates(processed);
    setSemester1Count(sem1);
    setSemester2Count(sem2);
  }, [selectedGrade, schedules, calendarData]);

  const generateDoc = async () => {
    const tableRows = [
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: "No", alignment: AlignmentType.CENTER })], width: { size: 10, type: WidthType.PERCENTAGE } }),
          new TableCell({ children: [new Paragraph({ text: "Tanggal", alignment: AlignmentType.CENTER })], width: { size: 45, type: WidthType.PERCENTAGE } }),
          new TableCell({ children: [new Paragraph({ text: "Keterangan", alignment: AlignmentType.CENTER })], width: { size: 45, type: WidthType.PERCENTAGE } }),
        ]
      }),
      ...effectiveDates.map((item, index) => (
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ text: (index + 1).toString(), alignment: AlignmentType.CENTER })] }),
            new TableCell({ children: [new Paragraph({ text: format(new Date(item.date), 'dd MMMM yyyy', { locale: id }) })] }),
            new TableCell({ children: [new Paragraph({ text: item.type })] }),
          ]
        })
      ))
    ];

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: `Hari Efektif Belajar - Kelas ${selectedGrade}`, bold: true, size: 28 }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 }
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Semester 1: ${semester1Count} Hari`, size: 24 }),
            ],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Semester 2: ${semester2Count} Hari`, size: 24 }),
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
    saveAs(blob, `Hari_Efektif_Kelas_${selectedGrade}.docx`);
  };

  if (loading) return <Layout><div className="p-8">Memuat data...</div></Layout>;

  return (
    <Layout>
      <div className="p-8">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Hari Efektif Belajar</h1>
            <p className="text-slate-500 text-sm">Tabel perhitungan hari efektif per kelas pada tahun pelajaran 2026-2027.</p>
          </div>
          <button 
            onClick={generateDoc}
            disabled={effectiveDates.length === 0}
            className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-4 py-2 rounded-2xl font-bold border border-emerald-100 hover:bg-emerald-100 transition-colors disabled:opacity-50 text-sm"
          >
            <Download size={18} />
            Unduh Word (A4)
          </button>
        </div>

        <div className="mb-6 flex gap-2">
          {[1,2,3,4,5,6].map(grade => (
            <button
              key={grade}
              onClick={() => setSelectedGrade(grade)}
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
          className="bg-white/40 border border-white/60 backdrop-blur-md rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden p-6"
        >
          {schedules[selectedGrade]?.day ? (
            <>
              <div className="flex gap-4 mb-6">
                <div className="flex-1 bg-white/70 p-4 rounded-2xl border border-white/80 shadow-sm">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Semester 1 ({calendarData?.academicYear?.split('/')[0] || '2026'})</p>
                  <p className="text-3xl font-black text-emerald-600">{semester1Count} <span className="text-sm font-medium text-slate-400">Hari Efektif</span></p>
                </div>
                <div className="flex-1 bg-white/70 p-4 rounded-2xl border border-white/80 shadow-sm">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Semester 2 ({parseInt(calendarData?.academicYear?.split('/')[0] || '2026') + 1})</p>
                  <p className="text-3xl font-black text-emerald-600">{semester2Count} <span className="text-sm font-medium text-slate-400">Hari Efektif</span></p>
                </div>
                <div className="flex-1 bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100/50 shadow-sm">
                  <p className="text-xs font-bold text-emerald-600/70 uppercase tracking-widest mb-1">Total Setahun</p>
                  <p className="text-3xl font-black text-emerald-700">{semester1Count + semester2Count} <span className="text-sm font-medium text-emerald-600/70">Hari Efektif</span></p>
                </div>
              </div>

              <div className="overflow-x-auto max-h-[600px] overflow-y-auto rounded-2xl border border-white/40 bg-white/30">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="sticky top-0 bg-white/90 border-b border-slate-100 z-10">
                    <tr>
                      <th className="p-4 font-bold text-slate-400 uppercase tracking-widest w-16 text-center">No</th>
                    <th className="p-4 font-bold text-slate-400 uppercase tracking-widest">Tanggal ({schedules[selectedGrade].day})</th>
                    <th className="p-4 font-bold text-slate-400 uppercase tracking-widest text-right">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/20">
                  {effectiveDates.map((item, idx) => (
                    <tr key={idx} className={`hover:bg-white/40 transition-colors ${item.type !== 'Efektif' ? 'bg-rose-50/20' : ''}`}>
                      <td className="p-4 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="p-4 font-bold text-slate-700">{format(new Date(item.date), 'dd MMMM yyyy', { locale: id })}</td>
                      <td className="p-4 text-right">
                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest ${item.type !== 'Efektif' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {item.type}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          ) : (
            <div className="p-12 text-center flex flex-col items-center">
              <FileText className="w-12 h-12 mb-4 text-emerald-200" />
              <p className="font-bold text-slate-700">Jadwal hari untuk Kelas {selectedGrade} belum diatur.</p>
              <p className="text-sm mt-1 text-slate-500">Silakan atur pada menu Jadwal Mengajar terlebih dahulu.</p>
            </div>
          )}
        </motion.div>
      </div>
    </Layout>
  );
}
