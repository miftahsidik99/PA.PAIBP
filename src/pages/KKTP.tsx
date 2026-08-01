import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { motion, AnimatePresence } from 'motion/react';
import { useStore, KKTPRecord, Student, KKTPRubric } from '../store/useStore';
import { CheckSquare, RefreshCw, ClipboardList, Save, X, Trash2, Download, FileText, ChevronDown, ChevronUp, Table as TableIcon } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, AlignmentType, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';

const getRandomColor = () => {
  const h = Math.floor(Math.random() * 360);
  return `hsla(${h}, 70%, 85%, 0.8)`;
};

const generateRubrics = (atps: string[]): KKTPRubric[] => {
  return atps.map(atp => {
    // Extract KKO (Simplified SOLO Taxonomy mapping)
    const kko = atp.split(' ')[0] || 'Memahami';
    
    return {
      atp,
      levels: {
        perluBimbingan: `Belum mampu ${atp.toLowerCase()}.`,
        cukup: `Mampu ${atp.toLowerCase()} namun masih terbatas pada aspek dasar (Unistructural).`,
        baik: `Mampu ${atp.toLowerCase()} dengan mengaitkan beberapa aspek relevan (Multistructural/Relational).`,
        sangatBaik: `Sangat mahir ${atp.toLowerCase()} dan mampu mengaplikasikannya dalam konteks yang lebih luas (Extended Abstract).`
      }
    };
  });
};

export default function KKTP() {
  const { 
    user, profile, calendarData, schedules: storeSchedules, 
    savedProtas: storeProtas, students: storeStudents,
    atpBatches, addAtpBatch, setAtpBatches, savedKktps = [], addKktp, setSavedKktps
  } = useStore();

  const [loading, setLoading] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState<number>(1);
  const [selectedAtpIndices, setSelectedAtpIndices] = useState<number[]>([]);
  const [view, setView] = useState<'table' | 'form' | 'history'>('table');
  const [expandedKktp, setExpandedKktp] = useState<string | null>(null);
  
  // Form state
  const [currentKktpData, setCurrentKktpData] = useState<{
    date: string;
    studentData: { studentId: string, predicate: string, description: string }[];
    rubrics: KKTPRubric[];
  }>({
    date: format(new Date(), 'yyyy-MM-dd'),
    studentData: [],
    rubrics: []
  });

  const handleGradeChange = (grade: number) => {
    setSelectedGrade(grade);
    setSelectedAtpIndices([]);
  };

  const toggleAtp = (idx: number) => {
    setSelectedAtpIndices(prev => 
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx].sort((a, b) => a - b)
    );
  };

  const generateDoc = async (kktp: KKTPRecord) => {
    const students = storeStudents[kktp.grade] || [];
    
    const tableHeader = new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "No", bold: true, size: 20 })], alignment: AlignmentType.CENTER })], width: { size: 5, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Nama Siswa", bold: true, size: 20 })], alignment: AlignmentType.CENTER })], width: { size: 25, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "JK", bold: true, size: 20 })], alignment: AlignmentType.CENTER })], width: { size: 5, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Kriteria Penilaian", bold: true, size: 20 })], alignment: AlignmentType.CENTER })], width: { size: 20, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Deskripsi Ketercapaian", bold: true, size: 20 })], alignment: AlignmentType.CENTER })], width: { size: 45, type: WidthType.PERCENTAGE } }),
      ],
    });

    const studentRows = kktp.studentData.map((sd, idx) => {
      const student = students.find(s => s.id === sd.studentId);
      return new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: (idx + 1).toString(), size: 20 })], alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: student?.nama || '-', size: 20 })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: student?.jenisKelamin?.charAt(0) || '-', size: 20 })], alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: sd.predicate, size: 20 })], alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: sd.description, size: 20 })] })] }),
        ],
      });
    });

    const rubricRows = (kktp.rubrics || []).flatMap((rubric, rIdx) => [
      new TableRow({
        children: [
          new TableCell({ 
            children: [new Paragraph({ children: [new TextRun({ text: rubric.atp, bold: true, size: 18 })] })], 
            columnSpan: 5,
            shading: { fill: "F1F5F9" }
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Kriteria", bold: true, size: 16 })], alignment: AlignmentType.CENTER })], width: { size: 20, type: WidthType.PERCENTAGE } }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Perlu Bimbingan", bold: true, size: 16 })], alignment: AlignmentType.CENTER })], width: { size: 20, type: WidthType.PERCENTAGE } }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Cukup", bold: true, size: 16 })], alignment: AlignmentType.CENTER })], width: { size: 20, type: WidthType.PERCENTAGE } }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Baik", bold: true, size: 16 })], alignment: AlignmentType.CENTER })], width: { size: 20, type: WidthType.PERCENTAGE } }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Sangat Baik", bold: true, size: 16 })], alignment: AlignmentType.CENTER })], width: { size: 20, type: WidthType.PERCENTAGE } }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Deskripsi", size: 16 })], alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: rubric.levels.perluBimbingan, size: 16 })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: rubric.levels.cukup, size: 16 })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: rubric.levels.baik, size: 16 })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: rubric.levels.sangatBaik, size: 16 })] })] }),
        ],
      }),
    ]);

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "KRITERIA KETUNTASAN TUJUAN PEMBELAJARAN (KKTP)", bold: true, size: 28 }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
            children: [
              new TextRun({ text: `TAHUN PELAJARAN ${profile?.tahunPelajaran || '2026/2027'}`, bold: true, size: 24 }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Satuan Pendidikan : ${profile?.namaSekolah || '-'}`, size: 20 }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Mata Pelajaran    : PAI dan Budi Pekerti`, size: 20 }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Kelas / Semester  : ${kktp.grade} / -`, size: 20 }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Hari / Tanggal    : ${format(new Date(kktp.date), "EEEE, d MMMM yyyy", { locale: localeId })}`, size: 20 }),
            ],
          }),
          new Paragraph({
            spacing: { before: 200, after: 100 },
            children: [
              new TextRun({ text: `Rubrik Penilaian:`, bold: true, size: 20 }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: rubricRows,
          }),
          new Paragraph({
            spacing: { before: 300, after: 100 },
            children: [
              new TextRun({ text: `Hasil Penilaian Siswa:`, bold: true, size: 20 }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [tableHeader, ...studentRows],
          }),
          new Paragraph({ spacing: { before: 400 } }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
              insideHorizontal: { style: BorderStyle.NONE },
              insideVertical: { style: BorderStyle.NONE },
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Mengetahui,", size: 20 })] }),
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Kepala Sekolah", size: 20 })] }),
                      new Paragraph({ spacing: { before: 800 } }),
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: profile?.namaKepalaSekolah || "................................", bold: true, underline: {}, size: 20 })] }),
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `NIP. ${profile?.nipKepalaSekolah || "................................"}`, size: 20 })] }),
                    ],
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${profile?.namaSekolah?.split(' ')[1] || '..........'}, ${format(new Date(), "d MMMM yyyy", { locale: localeId })}`, size: 20 })] }),
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Guru PAI & BP", size: 20 })] }),
                      new Paragraph({ spacing: { before: 800 } }),
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: profile?.namaGuru || "................................", bold: true, underline: {}, size: 20 })] }),
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `NIP. ${profile?.nip || "................................"}`, size: 20 })] }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `KKTP_Kelas_${kktp.grade}_${format(new Date(kktp.date), 'ddMMyy')}.docx`);
  };

  const getEffectiveDates = () => {
    if (!storeSchedules[selectedGrade] || !storeSchedules[selectedGrade].day) return [];
    
    const dayMap: Record<string, number> = {
      'Minggu': 0, 'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6
    };
    
    const dayIndex = dayMap[storeSchedules[selectedGrade].day];
    
    // Default fallback dates
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

    const dayInMs = 24 * 60 * 60 * 1000;
    const allDates: Date[] = [];
    let curr = new Date(startDate);
    while (curr <= endDate) {
      if (curr.getDay() === dayIndex) {
        const dateStr = format(curr, 'yyyy-MM-dd');
        let isEffective = true;
        
        if (curr.getDay() === 0) isEffective = false;
        if (curr.getDay() === 6 && weeklyDays === 5) isEffective = false;
        if (events[dateStr] && !events[dateStr].isEffective) isEffective = false;
        
        if (isEffective) {
          allDates.push(new Date(curr));
        }
      }
      curr = new Date(curr.getTime() + dayInMs);
    }

    return allDates;
  };

  const protaList = storeProtas[selectedGrade] || [];
  const effectiveDates = getEffectiveDates();
  
  const allAtps: { elemen: string, atp: string, date: Date | null, id: number }[] = [];
  let dateIdx = 0;
  protaList.forEach(item => {
    item.atp.forEach((a: string) => {
      allAtps.push({ 
        elemen: item.elemen, 
        atp: a, 
        date: effectiveDates[dateIdx] || null,
        id: allAtps.length
      });
      dateIdx++;
    });
  });

  const gradeStudents = storeStudents[selectedGrade] || [];

  const handleBuatKktp = () => {
    if (selectedAtpIndices.length === 0) return;
    
    const selectedAtpData = selectedAtpIndices.map(idx => allAtps[idx]);
    const firstAtpDate = selectedAtpData[0].date;
    const atpStrings = selectedAtpData.map(a => a.atp);
    
    setCurrentKktpData({
      date: firstAtpDate ? format(firstAtpDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
      studentData: gradeStudents.map(s => ({
        studentId: s.id,
        predicate: 'Baik',
        description: `Mampu memahami ${atpStrings.join(', ')} dengan baik.`
      })),
      rubrics: generateRubrics(atpStrings)
    });
    
    setView('form');
  };

  const saveKktp = () => {
    const selectedAtpData = selectedAtpIndices.map(idx => allAtps[idx]);
    const color = getRandomColor();
    
    const newKktp: KKTPRecord = {
      id: crypto.randomUUID(),
      grade: selectedGrade,
      atps: selectedAtpData.map(a => a.atp),
      date: currentKktpData.date,
      studentData: currentKktpData.studentData,
      rubrics: currentKktpData.rubrics,
      color: color
    };

    addKktp(newKktp);
    addAtpBatch(selectedGrade, {
      atps: selectedAtpData.map(a => a.atp),
      color: color,
      type: 'kktp',
      timestamp: Date.now()
    });

    setView('table');
    setSelectedAtpIndices([]);
    alert('Data KKTP berhasil disimpan!');
  };

  const clearData = () => {
    setCurrentKktpData({
      date: format(new Date(), 'yyyy-MM-dd'),
      studentData: gradeStudents.map(s => ({
        studentId: s.id,
        predicate: 'Baik',
        description: ''
      })),
      rubrics: generateRubrics(selectedAtpIndices.map(idx => allAtps[idx].atp))
    });
  };

  const getAtpColor = (atp: string) => {
    const batches = atpBatches[selectedGrade] || [];
    const batch = batches.find(b => b.atps.includes(atp));
    return batch ? batch.color : null;
  };

  if (view === 'form') {
    const selectedAtpData = selectedAtpIndices.map(idx => allAtps[idx]);
    return (
      <Layout>
        <div className="p-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Penilaian KKTP</h1>
              <p className="text-slate-500 text-sm">
                Kelas {selectedGrade} • {selectedAtpData.length} ATP terpilih
              </p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={clearData}
                className="px-4 py-2 rounded-2xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors flex items-center gap-2"
              >
                <Trash2 size={18} />
                Clear Data
              </button>
              <button 
                onClick={() => setView('table')}
                className="px-4 py-2 rounded-2xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors flex items-center gap-2"
              >
                <X size={18} />
                Batal
              </button>
              <button 
                onClick={saveKktp}
                className="px-6 py-2 rounded-2xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200 flex items-center gap-2"
              >
                <Save size={18} />
                Simpan
              </button>
            </div>
          </div>

          <div className="bg-white/40 border border-white/60 backdrop-blur-md rounded-3xl p-6 mb-8">
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <TableIcon className="text-emerald-600" size={20} />
                <h3 className="font-bold text-slate-800">Rubrik Penilaian (SOLO Taxonomy)</h3>
              </div>
              <div className="space-y-4">
                {currentKktpData.rubrics.map((rubric, rIdx) => (
                  <div key={rIdx} className="overflow-hidden rounded-2xl border border-white/40 bg-white/30">
                    <div className="bg-white/60 p-3 border-b border-white/40">
                      <p className="text-sm font-bold text-slate-800">{rubric.atp}</p>
                    </div>
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="bg-slate-50/50">
                        <tr>
                          <th className="p-3 font-bold text-slate-400 uppercase tracking-widest border-r border-white/20">Kriteria</th>
                          <th className="p-3 font-bold text-slate-400 uppercase tracking-widest border-r border-white/20">Perlu Bimbingan</th>
                          <th className="p-3 font-bold text-slate-400 uppercase tracking-widest border-r border-white/20">Cukup</th>
                          <th className="p-3 font-bold text-slate-400 uppercase tracking-widest border-r border-white/20">Baik</th>
                          <th className="p-3 font-bold text-slate-400 uppercase tracking-widest">Sangat Baik</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="bg-white/20">
                          <td className="p-3 font-bold text-slate-500 border-r border-white/20">Deskripsi</td>
                          <td className="p-3 text-slate-600 border-r border-white/20 leading-relaxed">{rubric.levels.perluBimbingan}</td>
                          <td className="p-3 text-slate-600 border-r border-white/20 leading-relaxed">{rubric.levels.cukup}</td>
                          <td className="p-3 text-slate-600 border-r border-white/20 leading-relaxed">{rubric.levels.baik}</td>
                          <td className="p-3 text-slate-600 leading-relaxed">{rubric.levels.sangatBaik}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">Hari / Tanggal</label>
                <input 
                  type="date" 
                  value={currentKktpData.date}
                  onChange={(e) => setCurrentKktpData({...currentKktpData, date: e.target.value})}
                  className="w-full bg-white/60 border border-white/40 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">ATP Terpilih</label>
                <div className="space-y-1">
                  {selectedAtpData.map((a, i) => (
                    <div key={i} className="text-sm font-bold text-slate-700 bg-emerald-100/50 px-3 py-1 rounded-lg border border-emerald-200/50">
                      {a.atp}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-white/40 bg-white/30">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-white/90 border-b border-slate-100">
                  <tr>
                    <th className="p-4 font-bold text-slate-400 uppercase tracking-widest w-12 text-center">No</th>
                    <th className="p-4 font-bold text-slate-400 uppercase tracking-widest">Nama Siswa</th>
                    <th className="p-4 font-bold text-slate-400 uppercase tracking-widest w-16 text-center">JK</th>
                    <th className="p-4 font-bold text-slate-400 uppercase tracking-widest w-48">Kriteria Penilaian</th>
                    <th className="p-4 font-bold text-slate-400 uppercase tracking-widest">Deskripsi Ketercapaian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/20">
                  {gradeStudents.length > 0 ? gradeStudents.map((student, idx) => {
                    const sData = currentKktpData.studentData.find(sd => sd.studentId === student.id);
                    return (
                      <tr key={student.id} className="hover:bg-white/40 transition-colors">
                        <td className="p-4 text-center text-slate-500 font-bold">{idx + 1}</td>
                        <td className="p-4 font-bold text-slate-800">{student.nama}</td>
                        <td className="p-4 text-center text-slate-600">{student.jenisKelamin?.charAt(0) || '-'}</td>
                        <td className="p-4">
                          <select 
                            value={sData?.predicate}
                            onChange={(e) => {
                              const newPredicate = e.target.value;
                              const descriptions: Record<string, string> = {
                                'Sangat Baik': `Menunjukkan penguasaan yang sangat baik dalam ${selectedAtpData.map(a => a.atp).join(', ')}.`,
                                'Baik': `Menunjukkan penguasaan yang baik dalam ${selectedAtpData.map(a => a.atp).join(', ')}.`,
                                'Cukup': `Menunjukkan penguasaan yang cukup dalam ${selectedAtpData.map(a => a.atp).join(', ')}.`,
                                'Perlu Bimbingan': `Memerlukan bimbingan lebih lanjut dalam ${selectedAtpData.map(a => a.atp).join(', ')}.`
                              };
                              const newData = currentKktpData.studentData.map(sd => 
                                sd.studentId === student.id ? { ...sd, predicate: newPredicate, description: descriptions[newPredicate] } : sd
                              );
                              setCurrentKktpData({ ...currentKktpData, studentData: newData });
                            }}
                            className="w-full bg-white/60 border border-white/40 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                          >
                            <option value="Sangat Baik">Sangat Baik</option>
                            <option value="Baik">Baik</option>
                            <option value="Cukup">Cukup</option>
                            <option value="Perlu Bimbingan">Perlu Bimbingan</option>
                          </select>
                        </td>
                        <td className="p-4">
                          <textarea 
                            value={sData?.description}
                            onChange={(e) => {
                              const newData = currentKktpData.studentData.map(sd => 
                                sd.studentId === student.id ? { ...sd, description: e.target.value } : sd
                              );
                              setCurrentKktpData({ ...currentKktpData, studentData: newData });
                            }}
                            rows={2}
                            className="w-full bg-white/60 border border-white/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
                          />
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500 font-medium">
                        Belum ada data siswa untuk Kelas {selectedGrade}. Silakan isi di menu Daftar Siswa.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-8">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">KKTP</h1>
            <p className="text-slate-500 text-sm">Pilih ATP untuk menentukan Kriteria Ketuntasan Tujuan Pembelajaran.</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setView(view === 'history' ? 'table' : 'history')}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl font-bold transition-colors text-sm ${view === 'history' ? 'bg-slate-800 text-white' : 'bg-white/60 text-slate-700 border border-slate-200 hover:bg-slate-50'}`}
            >
              <FileText size={18} />
              {view === 'history' ? 'Kembali ke ATP' : 'Riwayat KKTP'}
            </button>
            {view === 'table' && (
              <>
                <button 
                  onClick={() => {
                    setLoading(true);
                    setTimeout(() => setLoading(false), 500);
                  }}
                  className="flex items-center gap-2 bg-white/60 text-emerald-700 border border-emerald-200 px-4 py-2 rounded-2xl font-bold hover:bg-emerald-50 transition-colors disabled:opacity-50 text-sm"
                >
                  <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                  Sinkron ATP
                </button>
                <button 
                  onClick={handleBuatKktp}
                  disabled={selectedAtpIndices.length === 0}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-2xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-colors disabled:opacity-50 text-sm"
                >
                  <ClipboardList size={18} />
                  Buat KKTP ({selectedAtpIndices.length} ATP)
                </button>
              </>
            )}
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

        {view === 'history' ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-700">Riwayat KKTP Kelas {selectedGrade}</h3>
              {savedKktps.filter(k => k.grade === selectedGrade).length > 0 && (
                <button 
                  type="button"
                  onClick={() => {
                    const otherGradesKktps = savedKktps.filter(k => k.grade !== selectedGrade);
                    setSavedKktps(otherGradesKktps);
                    
                    const updatedGradeBatches = (atpBatches[selectedGrade] || []).filter(b => b.type !== 'kktp');
                    setAtpBatches({
                      ...atpBatches,
                      [selectedGrade]: updatedGradeBatches
                    });
                  }}
                  className="flex items-center gap-2 text-rose-600 hover:text-rose-700 font-bold text-xs bg-white border border-rose-200 px-4 py-2 rounded-2xl shadow-sm hover:shadow-md transition-all active:scale-95"
                >
                  <Trash2 size={14} />
                  Hapus Semua Riwayat
                </button>
              )}
            </div>
            <div className="space-y-4">
              {savedKktps.filter(k => k.grade === selectedGrade).length > 0 ? (
                savedKktps.filter(k => k.grade === selectedGrade).map((kktp) => (
                  <div key={kktp.id} className="bg-white/40 border border-white/60 backdrop-blur-md rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                    <div className="p-4 flex items-center justify-between">
                      <div 
                        className="flex items-center gap-4 cursor-pointer flex-1"
                        onClick={() => setExpandedKktp(expandedKktp === kktp.id ? null : kktp.id)}
                      >
                        <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold text-xs shadow-sm" style={{ backgroundColor: kktp.color }}>
                          {format(new Date(kktp.date), 'dd')}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{format(new Date(kktp.date), "EEEE, d MMMM yyyy", { locale: localeId })}</p>
                          <p className="text-xs text-slate-500 line-clamp-1">{kktp.atps.join(', ')}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          type="button"
                          onClick={() => generateDoc(kktp)}
                          className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-all active:scale-90"
                          title="Unduh Word"
                        >
                          <Download size={18} />
                        </button>
                        <button 
                          type="button"
                          onClick={() => {
                            const currentBatches = atpBatches[selectedGrade] || [];
                            const updatedGradeBatches = currentBatches.filter(b => 
                              !(b.type === 'kktp' && b.atps.every(atp => kktp.atps.includes(atp)))
                            );
                            
                            setAtpBatches({
                              ...atpBatches,
                              [selectedGrade]: updatedGradeBatches
                            });
                            
                            setSavedKktps(savedKktps.filter(item => item.id !== kktp.id));
                          }}
                          className="p-2.5 rounded-xl bg-rose-100 text-rose-600 hover:bg-rose-200 transition-all active:scale-90"
                          title="Hapus Riwayat"
                        >
                          <Trash2 size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setExpandedKktp(expandedKktp === kktp.id ? null : kktp.id)}
                          className="p-2.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
                        >
                          {expandedKktp === kktp.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </button>
                      </div>
                    </div>
                    <AnimatePresence>
                      {expandedKktp === kktp.id && (
                        <motion.div 
                          initial={{ height: 0 }}
                          animate={{ height: 'auto' }}
                          exit={{ height: 0 }}
                          className="overflow-hidden border-t border-white/20"
                        >
                          <div className="p-4 bg-white/20">
                            <table className="w-full text-xs text-left">
                              <thead className="text-slate-400 font-bold uppercase tracking-widest border-b border-white/20">
                                <tr>
                                  <th className="pb-2">Nama</th>
                                  <th className="pb-2">Predikat</th>
                                  <th className="pb-2">Deskripsi</th>
                                </tr>
                              </thead>
                              <tbody>
                                {kktp.studentData.map((sd, i) => {
                                  const student = storeStudents[selectedGrade]?.find(s => s.id === sd.studentId);
                                  return (
                                    <tr key={i} className="border-b border-white/10 last:border-0">
                                      <td className="py-2 font-bold text-slate-700">{student?.nama || '-'}</td>
                                      <td className="py-2">
                                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                          sd.predicate === 'Sangat Baik' ? 'bg-emerald-100 text-emerald-700' :
                                          sd.predicate === 'Baik' ? 'bg-blue-100 text-blue-700' :
                                          sd.predicate === 'Cukup' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                                        }`}>
                                          {sd.predicate}
                                        </span>
                                      </td>
                                      <td className="py-2 text-slate-600 italic">{sd.description}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                            {kktp.rubrics && kktp.rubrics.length > 0 && (
                              <div className="mt-6 pt-6 border-t border-white/20">
                                <div className="flex items-center gap-2 mb-4">
                                  <TableIcon className="text-emerald-600" size={16} />
                                  <h4 className="font-bold text-slate-700 text-xs">Rubrik Penilaian</h4>
                                </div>
                                <div className="space-y-4">
                                  {kktp.rubrics.map((rubric, rIdx) => (
                                    <div key={rIdx} className="overflow-hidden rounded-xl border border-white/40 bg-white/10">
                                      <div className="bg-white/30 p-2 border-b border-white/40">
                                        <p className="text-[10px] font-bold text-slate-800">{rubric.atp}</p>
                                      </div>
                                      <table className="w-full text-[9px] text-left border-collapse">
                                        <thead className="bg-slate-50/30">
                                          <tr>
                                            <th className="p-2 font-bold text-slate-400 uppercase tracking-widest border-r border-white/10">Kriteria</th>
                                            <th className="p-2 font-bold text-slate-400 uppercase tracking-widest border-r border-white/10">Perlu Bimbingan</th>
                                            <th className="p-2 font-bold text-slate-400 uppercase tracking-widest border-r border-white/10">Cukup</th>
                                            <th className="p-2 font-bold text-slate-400 uppercase tracking-widest border-r border-white/10">Baik</th>
                                            <th className="p-2 font-bold text-slate-400 uppercase tracking-widest">Sangat Baik</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          <tr className="bg-white/10">
                                            <td className="p-2 font-bold text-slate-500 border-r border-white/10">Deskripsi</td>
                                            <td className="p-2 text-slate-600 border-r border-white/10">{rubric.levels.perluBimbingan}</td>
                                            <td className="p-2 text-slate-600 border-r border-white/10">{rubric.levels.cukup}</td>
                                            <td className="p-2 text-slate-600 border-r border-white/10">{rubric.levels.baik}</td>
                                            <td className="p-2 text-slate-600">{rubric.levels.sangatBaik}</td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))
              ) : (
                <div className="bg-white/40 border border-white/60 backdrop-blur-md rounded-3xl p-12 text-center">
                  <FileText className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="font-bold text-slate-700">Belum ada riwayat KKTP untuk Kelas {selectedGrade}.</p>
                </div>
              )}
            </div>
          </>
        ) : (
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
                      <th className="p-4 font-bold text-slate-400 uppercase tracking-widest w-12 text-center">No</th>
                      <th className="p-4 font-bold text-slate-400 uppercase tracking-widest w-48">Elemen</th>
                      <th className="p-4 font-bold text-slate-400 uppercase tracking-widest">Alur Tujuan Pembelajaran (Total: {allAtps.length} ATP)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/20 text-sm">
                    {allAtps.map((item, idx) => {
                      const isSelected = selectedAtpIndices.includes(idx);
                      const shadingColor = getAtpColor(item.atp);
                      const dateStr = item.date ? format(item.date, "EEEE, d MMM yyyy", { locale: localeId }) : 'Belum diatur';
                      
                      return (
                        <tr 
                          key={idx} 
                          onClick={() => toggleAtp(idx)}
                          className={`cursor-pointer transition-colors ${isSelected ? 'bg-emerald-100/80' : 'hover:bg-white/40'}`}
                          style={{ backgroundColor: isSelected ? undefined : (shadingColor || undefined) }}
                        >
                          <td className="p-4 text-center">
                            <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center mx-auto transition-colors ${isSelected ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm' : 'border-slate-300 bg-white/50'}`}>
                              {isSelected && <CheckSquare size={16} />}
                            </div>
                          </td>
                          <td className="p-4 text-center font-bold text-slate-500">{idx + 1}</td>
                          <td className="p-4 font-bold text-slate-800">{item.elemen}</td>
                          <td className="p-4 text-slate-600 font-medium">
                            <div className="font-bold text-slate-800">{item.atp}</div>
                            <div className="text-xs text-emerald-600 mt-1">{dateStr}</div>
                            {shadingColor && <span className="mt-1 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-white/60 border border-slate-200">Sudah Diproses</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center flex flex-col items-center">
                <ClipboardList className="w-12 h-12 mb-4 text-emerald-200" />
                <p className="font-bold text-slate-700">Belum ada Prota untuk Kelas {selectedGrade}.</p>
                <p className="text-sm mt-1 text-slate-500">Silakan buat Program Tahunan terlebih dahulu.</p>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </Layout>
  );
}
