import { useState, useEffect, useMemo } from 'react';
import Layout from '../components/Layout';
import { motion, AnimatePresence } from 'motion/react';
import { useStore, AttendanceData, Student } from '../store/useStore';
import { Download, FileText, Users, Calendar, CheckCircle2, UserPlus, Trash2, RefreshCw, FileDown, Save } from 'lucide-react';
import { format, eachDayOfInterval, getDay, parse, startOfMonth, endOfMonth, isSameMonth, addMonths, subMonths } from 'date-fns';
import { id } from 'date-fns/locale';
import { 
  Document, Packer, Paragraph, Table, TableCell, TableRow, 
  TextRun, WidthType, AlignmentType, BorderStyle, ShadingType,
  PageOrientation, VerticalAlign
} from 'docx';
import { saveAs } from 'file-saver';

const dayMap: Record<string, number> = {
  'Minggu': 0, 'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6
};

export default function Presensi() {
  const { profile, students: storeStudents, calendarData, schedules, attendance, setAttendance } = useStore();
  
  const [selectedGrade, setSelectedGrade] = useState<number>(1);
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [selectedSemester, setSelectedSemester] = useState<1 | 2>(
    new Date().getMonth() >= 6 ? 1 : 2
  );
  const [loading, setLoading] = useState(false);
  const [activeAttendance, setActiveAttendance] = useState<AttendanceData | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showToast, setShowToast] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [paperSize, setPaperSize] = useState<'A4' | 'F4'>('A4');

  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  const handlePullData = (type: 'siswa' | 'hari') => {
    setLoading(true);
    // Data is already reactive via store, but we simulate a refresh for UX
    setTimeout(() => {
      setLoading(false);
      setShowToast(`Data ${type === 'siswa' ? 'Siswa' : 'Hari Efektif'} berhasil ditarik!`);
    }, 500);
  };

  const handleSave = () => {
    if (!activeAttendance) return;
    
    // Update store
    const newAttendance = attendance.filter(a => !(a.grade === selectedGrade && a.month === selectedMonth));
    newAttendance.push(activeAttendance);
    setAttendance(newAttendance);
    
    setHasChanges(false);
    setShowToast("Data presensi berhasil disimpan!");
  };

  // Load current attendance from store
  useEffect(() => {
    // If there are unsaved changes, prompt? For now we just reset as it's a simple app
    // but typically we'd warn the user.
    const current = attendance.find(a => a.grade === selectedGrade && a.month === selectedMonth);
    if (current) {
      setActiveAttendance(current);
    } else {
      setActiveAttendance({
        grade: selectedGrade,
        month: selectedMonth,
        records: {}
      });
    }
    setHasChanges(false);
  }, [selectedGrade, selectedMonth, attendance]);

  // Get effective days for selected grade and month
  const effectiveDates = useMemo(() => {
    if (!schedules[selectedGrade] || !schedules[selectedGrade].day) return [];
    
    const dayIndex = dayMap[schedules[selectedGrade].day];
    const monthStart = startOfMonth(parse(selectedMonth, 'yyyy-MM', new Date()));
    const monthEnd = endOfMonth(monthStart);
    
    const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const matchDays = allDays.filter(d => getDay(d) === dayIndex);
    
    const events = selectedGrade === 6 
      ? (calendarData?.events6 || {}) 
      : (calendarData?.events1to5 || {});

    return matchDays
      .map(d => {
        const dateStr = format(d, 'yyyy-MM-dd');
        const event = events[dateStr];
        return {
          date: dateStr,
          isEffective: event ? event.isEffective : true,
          label: event ? event.label : 'Efektif'
        };
      })
      .filter(d => d.isEffective);
  }, [selectedGrade, selectedMonth, schedules, calendarData]);

  const students = useMemo(() => storeStudents[selectedGrade] || [], [storeStudents, selectedGrade]);

  const handleStatusChange = (date: string, studentId: string, status: 'H' | 'S' | 'I' | 'A' | '') => {
    if (!activeAttendance) return;
    
    const newRecords = { ...activeAttendance.records };
    if (!newRecords[date]) newRecords[date] = {};
    
    if (status === '') {
      delete newRecords[date][studentId];
    } else {
      newRecords[date][studentId] = status;
    }
    
    const newActive = { ...activeAttendance, records: newRecords };
    setActiveAttendance(newActive);
    setHasChanges(true);
  };

  const handleCheckAllHadir = (date: string) => {
    if (!activeAttendance) return;
    
    const newRecords = { ...activeAttendance.records };
    const dateRecords = { ...(newRecords[date] || {}) };
    
    students.forEach(s => {
      // Only set to Hadir if not already set to something else
      if (!dateRecords[s.id]) {
        dateRecords[s.id] = 'H';
      }
    });
    
    newRecords[date] = dateRecords;
    const newActive = { ...activeAttendance, records: newRecords };
    setActiveAttendance(newActive);
    setHasChanges(true);
  };

  const handleClearAttendance = () => {
    if (window.confirm('Hapus semua data presensi bulan ini?')) {
      const newAttendance = attendance.filter(a => !(a.grade === selectedGrade && a.month === selectedMonth));
      setAttendance(newAttendance);
      setActiveAttendance({
        grade: selectedGrade,
        month: selectedMonth,
        records: {}
      });
    }
  };

  const handleExportWord = async () => {
    if (students.length === 0) return;
    setIsExporting(true);

    try {
      const currentYear = new Date().getFullYear();
      const academicYear = selectedSemester === 1 
        ? `${currentYear}/${currentYear + 1}` 
        : `${currentYear - 1}/${currentYear}`;
      
      const semesterMonths = selectedSemester === 1 
        ? ['07', '08', '09', '10', '11', '12']
        : ['01', '02', '03', '04', '05', '06'];
      
      const targetYear = selectedSemester === 2 && new Date().getMonth() >= 6 ? currentYear + 1 : currentYear;

      const headerShading = { fill: "2D3748", type: ShadingType.SOLID, color: "2D3748" };
      const cellBorders = {
        top: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
        left: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
        right: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
      };

      const docChildren: any[] = [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "REKAP PRESENSI SEMESTER (DETAIL HARIAN)", bold: true, size: 28 })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [new TextRun({ text: `SEMESTER ${selectedSemester === 1 ? 'I (GANJIL)' : 'II (GENAP)'} TAHUN AJARAN ${academicYear}`, bold: true, size: 24 })],
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `Mata Pelajaran: PAI & Budi Pekerti`, size: 20 })] })] }),
                new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `Kelas: ${selectedGrade}`, size: 20 })] })] }),
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `Nama Guru: ${profile?.namaGuru || '-'}`, size: 20 })] })] }),
                new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `Sekolah: ${profile?.namaSekolah || '-'}`, size: 20 })] })] }),
              ]
            })
          ]
        }),
      ];

      // For each month in the semester, add a detailed table
      for (const m of semesterMonths) {
        const monthYear = selectedSemester === 1 ? currentYear : targetYear;
        const monthKey = `${monthYear}-${m}`;
        const monthDate = parse(monthKey, 'yyyy-MM', new Date());
        const monthName = format(monthDate, 'MMMM yyyy', { locale: id }).toUpperCase();
        
        // Get effective dates for this month and grade
        const dayIndex = dayMap[schedules[selectedGrade]?.day || 'Senin'];
        const mStart = startOfMonth(monthDate);
        const mEnd = endOfMonth(mStart);
        const allDays = eachDayOfInterval({ start: mStart, end: mEnd });
        const events = selectedGrade === 6 ? (calendarData?.events6 || {}) : (calendarData?.events1to5 || {});
        
        const mEffectiveDates = allDays
          .filter(d => getDay(d) === dayIndex)
          .map(d => {
            const dateStr = format(d, 'yyyy-MM-dd');
            const event = events[dateStr];
            return { date: dateStr, isEffective: event ? event.isEffective : true };
          })
          .filter(d => d.isEffective);

        if (mEffectiveDates.length === 0) continue;

        const attData = attendance.find(a => a.grade === selectedGrade && a.month === monthKey);

        docChildren.push(new Paragraph({ spacing: { before: 400, after: 50 }, children: [new TextRun({ text: `BULAN: ${monthName}`, bold: true, size: 20 })] }));
        docChildren.push(new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: `Total Hari Efektif Belajar: ${mEffectiveDates.length} Hari`, size: 16, italics: true })] }));

        docChildren.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "NO", bold: true, color: "FFFFFF" })] })], shading: headerShading, borders: cellBorders, width: { size: 3, type: WidthType.PERCENTAGE } }),
                new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "NAMA SISWA", bold: true, color: "FFFFFF" })] })], shading: headerShading, borders: cellBorders, width: { size: 18, type: WidthType.PERCENTAGE } }),
                ...mEffectiveDates.map(d => {
                  const dateObj = parse(d.date, 'yyyy-MM-dd', new Date());
                  return new TableCell({ 
                    children: [
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: format(dateObj, 'EEE', { locale: id }), bold: true, color: "FFFFFF", size: 14 })] }),
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: format(dateObj, 'dd'), bold: true, color: "FFFFFF", size: 16 })] }),
                    ],
                    shading: headerShading, borders: cellBorders
                  });
                }),
                new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "S", bold: true, color: "FFFFFF" })] })], shading: headerShading, borders: cellBorders, width: { size: 2.5, type: WidthType.PERCENTAGE } }),
                new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "I", bold: true, color: "FFFFFF" })] })], shading: headerShading, borders: cellBorders, width: { size: 2.5, type: WidthType.PERCENTAGE } }),
                new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "A", bold: true, color: "FFFFFF" })] })], shading: headerShading, borders: cellBorders, width: { size: 2.5, type: WidthType.PERCENTAGE } }),
              ]
            }),
            ...students.map((student, idx) => {
              let s = 0, i = 0, a = 0;
              return new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: (idx + 1).toString() })] })], borders: cellBorders }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: student.nama })] })], borders: cellBorders }),
                  ...mEffectiveDates.map(d => {
                    const status = attData?.records[d.date]?.[student.id] || '';
                    if (status === 'S') s++; if (status === 'I') i++; if (status === 'A') a++;
                    return new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: status || '.' })] })], borders: cellBorders });
                  }),
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: s.toString() })] })], borders: cellBorders }),
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: i.toString() })] })], borders: cellBorders }),
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: a.toString() })] })], borders: cellBorders }),
                ]
              });
            })
          ]
        }));
      }

      // Signatures
      docChildren.push(new Paragraph({ spacing: { before: 600 } }));
      docChildren.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
        rows: [
          new TableRow({
            children: [
              new TableCell({ children: [
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Mengetahui," })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Kepala Sekolah" })] }),
                new Paragraph({ spacing: { before: 800 } }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "__________________________", bold: true })] }),
              ] }),
              new TableCell({ children: [
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${profile?.namaSekolah || '........'}, ${format(new Date(), 'dd MMMM yyyy', { locale: id })}` })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Guru Bidang Studi" })] }),
                new Paragraph({ spacing: { before: 800 } }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: profile?.namaGuru || "__________________________", bold: true })] }),
              ] })
            ]
          })
        ]
      }));

      const pageWidth = paperSize === 'F4' ? 18720 : 16838;
      const pageHeight = paperSize === 'F4' ? 12240 : 11906;

      const doc = new Document({
        sections: [{
          properties: {
            page: {
              size: {
                width: pageWidth,
                height: pageHeight,
                orientation: PageOrientation.LANDSCAPE
              },
              margin: {
                top: 1000,
                bottom: 1000,
                left: 1000,
                right: 1000
              }
            }
          },
          children: docChildren
        }]
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `Presensi_Semester_${selectedSemester}_Kelas_${selectedGrade}_${paperSize}.docx`);
    } catch (error) {
      console.error(error);
      alert("Gagal mengunduh dokumen.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportMonthlyWord = async () => {
    if (students.length === 0 || effectiveDates.length === 0) return;
    setIsExporting(true);

    try {
      const monthDate = parse(selectedMonth, 'yyyy-MM', new Date());
      const monthName = format(monthDate, 'MMMM yyyy', { locale: id }).toUpperCase();
      
      const currentYear = monthDate.getFullYear();
      const academicYear = monthDate.getMonth() >= 6 
        ? `${currentYear}/${currentYear + 1}` 
        : `${currentYear - 1}/${currentYear}`;

      const headerShading = { fill: "2D3748", type: ShadingType.SOLID, color: "2D3748" };
      const cellBorders = {
        top: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
        left: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
        right: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
      };

      const pageWidth = paperSize === 'F4' ? 18720 : 16838;
      const pageHeight = paperSize === 'F4' ? 12240 : 11906;

      const doc = new Document({
        sections: [{
          properties: {
            page: {
              size: {
                width: pageWidth,
                height: pageHeight,
                orientation: PageOrientation.LANDSCAPE
              },
              margin: {
                top: 1000,
                bottom: 1000,
                left: 1000,
                right: 1000
              }
            }
          },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: "LAPORAN PRESENSI BULANAN", bold: true, size: 28 })],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
              children: [new TextRun({ text: `BULAN: ${monthName} | TAHUN AJARAN ${academicYear}`, bold: true, size: 24 })],
            }),

            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
              children: [new TextRun({ text: `Total Hari Efektif Belajar: ${effectiveDates.length} Hari`, bold: true, size: 18, color: "059669" })],
            }),
            
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `Mata Pelajaran: PAI & Budi Pekerti`, size: 20 })] })] }),
                    new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `Kelas: ${selectedGrade}`, size: 20 })] })] }),
                  ]
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `Nama Guru: ${profile?.namaGuru || '-'}`, size: 20 })] })] }),
                    new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `Sekolah: ${profile?.namaSekolah || '-'}`, size: 20 })] })] }),
                  ]
                })
              ]
            }),

            new Paragraph({ spacing: { before: 200 } }),

            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "NO", bold: true, color: "FFFFFF" })] })], shading: headerShading, borders: cellBorders, width: { size: 3, type: WidthType.PERCENTAGE } }),
                    new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "NAMA SISWA", bold: true, color: "FFFFFF" })] })], shading: headerShading, borders: cellBorders, width: { size: 15, type: WidthType.PERCENTAGE } }),
                    new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "L/P", bold: true, color: "FFFFFF" })] })], shading: headerShading, borders: cellBorders, width: { size: 3, type: WidthType.PERCENTAGE } }),
                    ...effectiveDates.map(d => {
                      const dateObj = parse(d.date, 'yyyy-MM-dd', new Date());
                      return new TableCell({ 
                        children: [
                          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: format(dateObj, 'EEE', { locale: id }), bold: true, color: "FFFFFF", size: 14 })] }),
                          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: format(dateObj, 'dd'), bold: true, color: "FFFFFF", size: 16 })] }),
                        ],
                        shading: headerShading, borders: cellBorders
                      });
                    }),
                    new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "S", bold: true, color: "FFFFFF" })] })], shading: headerShading, borders: cellBorders, width: { size: 2.5, type: WidthType.PERCENTAGE } }),
                    new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "I", bold: true, color: "FFFFFF" })] })], shading: headerShading, borders: cellBorders, width: { size: 2.5, type: WidthType.PERCENTAGE } }),
                    new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "A", bold: true, color: "FFFFFF" })] })], shading: headerShading, borders: cellBorders, width: { size: 2.5, type: WidthType.PERCENTAGE } }),
                  ]
                }),
                ...students.map((student, idx) => {
                  let s = 0, i = 0, a = 0;
                  return new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: (idx + 1).toString() })] })], borders: cellBorders }),
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: student.nama })] })], borders: cellBorders }),
                      new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: student.jenisKelamin?.charAt(0) || '-' })] })], borders: cellBorders }),
                      ...effectiveDates.map(d => {
                        const status = activeAttendance?.records[d.date]?.[student.id] || '';
                        if (status === 'S') s++; if (status === 'I') i++; if (status === 'A') a++;
                        return new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: status || '.' })] })], borders: cellBorders });
                      }),
                      new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: s.toString() })] })], borders: cellBorders }),
                      new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: i.toString() })] })], borders: cellBorders }),
                      new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: a.toString() })] })], borders: cellBorders }),
                    ]
                  });
                })
              ]
            }),

            new Paragraph({ spacing: { before: 400 } }),

            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({ children: [
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Mengetahui," })] }),
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Kepala Sekolah" })] }),
                      new Paragraph({ spacing: { before: 800 } }),
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "__________________________", bold: true })] }),
                    ] }),
                    new TableCell({ children: [
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${profile?.namaSekolah || '........'}, ${format(new Date(), 'dd MMMM yyyy', { locale: id })}` })] }),
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Guru Bidang Studi" })] }),
                      new Paragraph({ spacing: { before: 800 } }),
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: profile?.namaGuru || "__________________________", bold: true })] }),
                    ] })
                  ]
                })
              ]
            })
          ]
        }]
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `Presensi_${format(monthName === "undefined" ? monthDate : monthDate, 'MMMM_yyyy', { locale: id })}_Kelas_${selectedGrade}_${paperSize}.docx`);
    } catch (error) {
      console.error(error);
      alert("Gagal mengunduh dokumen.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Layout>
      <div className="p-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Presensi Kehadiran Siswa</h1>
            <p className="text-slate-500 text-sm">Kelola daftar hadir harian berdasarkan hari efektif belajar.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
             <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setPaperSize('A4')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${paperSize === 'A4' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                A4
              </button>
              <button
                type="button"
                onClick={() => setPaperSize('F4')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${paperSize === 'F4' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                F4 (Folio)
              </button>
            </div>

             <button 
              onClick={handleSave}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl font-bold border transition-all text-sm shadow-sm ${
                hasChanges 
                  ? 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-700 animate-pulse' 
                  : 'bg-white text-slate-400 border-slate-200 cursor-not-allowed'
              }`}
            >
              <Save size={18} />
              Simpan Data
            </button>
             <button 
              onClick={handleExportMonthlyWord}
              disabled={isExporting}
              className="flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-2 rounded-2xl font-bold border border-blue-100 hover:bg-blue-100 transition-colors text-sm disabled:opacity-50"
            >
              {isExporting ? <RefreshCw size={18} className="animate-spin" /> : <FileDown size={18} />}
              Unduh Rekap Bulanan ({paperSize})
            </button>
             <button 
              onClick={handleExportWord}
              disabled={isExporting}
              className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-4 py-2 rounded-2xl font-bold border border-emerald-100 hover:bg-emerald-100 transition-colors text-sm disabled:opacity-50"
            >
              {isExporting ? <RefreshCw size={18} className="animate-spin" /> : <FileDown size={18} />}
              Unduh Rekap Semester ({paperSize})
            </button>
             <button 
              onClick={handleClearAttendance}
              className="flex items-center gap-2 bg-rose-50 text-rose-600 px-4 py-2 rounded-2xl font-bold border border-rose-100 hover:bg-rose-100 transition-colors text-sm"
            >
              <Trash2 size={18} />
              Reset Data
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mb-8">
          <div className="bg-white/40 backdrop-blur-md p-2 rounded-2xl border border-white/60 flex gap-1 shadow-sm">
            {[1,2,3,4,5,6].map(grade => (
              <button
                key={grade}
                onClick={() => setSelectedGrade(grade)}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${selectedGrade === grade ? 'bg-white shadow-sm text-emerald-700 border border-emerald-100' : 'text-slate-500 hover:bg-white/50'}`}
              >
                Kelas {grade}
              </button>
            ))}
          </div>

          <div className="bg-white/40 backdrop-blur-md p-2 rounded-2xl border border-white/60 flex gap-1 shadow-sm">
            {[1, 2].map(sem => (
              <button
                key={sem}
                onClick={() => setSelectedSemester(sem as 1 | 2)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${selectedSemester === sem ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:bg-white/50'}`}
              >
                Semester {sem === 1 ? 'I' : 'II'}
              </button>
            ))}
          </div>

          <div className="bg-white/40 backdrop-blur-md p-2 rounded-2xl border border-white/60 flex gap-2 shadow-sm items-center px-4">
            <Calendar size={18} className="text-slate-400" />
            <input 
              type="month" 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent border-none outline-none font-bold text-slate-700 text-sm"
            />
          </div>

          {effectiveDates.length > 0 && (
            <div className="bg-emerald-50 border border-emerald-100 px-4 py-2 rounded-2xl flex items-center gap-2 shadow-sm">
              <CheckCircle2 size={16} className="text-emerald-600" />
              <span className="text-xs font-bold text-emerald-700">
                Total Hari Efektif: {effectiveDates.length} Hari
              </span>
            </div>
          )}

          <div className="flex gap-2">
            <button 
              onClick={() => handlePullData('siswa')}
              className="flex items-center gap-2 bg-white/40 backdrop-blur-md px-4 py-2 rounded-2xl font-bold border border-white/60 hover:bg-white/60 transition-all text-xs text-slate-600 shadow-sm"
            >
              <UserPlus size={16} />
              Tarik Data Siswa
            </button>
            <button 
              onClick={() => handlePullData('hari')}
              className="flex items-center gap-2 bg-white/40 backdrop-blur-md px-4 py-2 rounded-2xl font-bold border border-white/60 hover:bg-white/60 transition-all text-xs text-slate-600 shadow-sm"
            >
              <RefreshCw size={16} />
              Tarik Hari Efektif
            </button>
          </div>
        </div>

        <AnimatePresence>
          {showToast && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-8 right-8 bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold shadow-xl z-50 flex items-center gap-2"
            >
              <CheckCircle2 size={18} />
              {showToast}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/40 border border-white/60 backdrop-blur-md rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden"
        >
          {students.length === 0 ? (
            <div className="p-20 text-center flex flex-col items-center">
              <Users className="w-16 h-16 text-slate-300 mb-4" />
              <h3 className="text-xl font-bold text-slate-700 mb-2">Belum ada data siswa</h3>
              <p className="text-slate-500 max-w-sm mb-6 text-sm">
                Tarik data siswa dari menu Daftar Siswa untuk mulai mengisi presensi di kelas {selectedGrade}.
              </p>
              <a href="/daftar-siswa" className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200">
                Ke Daftar Siswa
              </a>
            </div>
          ) : effectiveDates.length === 0 ? (
            <div className="p-20 text-center flex flex-col items-center">
              <RefreshCw className="w-16 h-16 text-slate-300 mb-4" />
              <h3 className="text-xl font-bold text-slate-700 mb-2">Tidak ada hari efektif</h3>
              <p className="text-slate-500 max-w-sm mb-6 text-sm">
                Pastikan Anda telah mengatur Jadwal Mengajar dan Kalender Akademik untuk melihat hari efektif di bulan {format(parse(selectedMonth, 'yyyy-MM', new Date()), 'MMMM yyyy', { locale: id })}.
              </p>
              <div className="flex gap-4">
                <a href="/schedule" className="bg-slate-700 text-white px-6 py-3 rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg">
                  Set Jadwal
                </a>
                <a href="/effective-days" className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200">
                  Cek Hari Efektif
                </a>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50/80 border-b border-slate-200 sticky top-0 z-10 backdrop-blur-sm">
                  <tr>
                    <th className="p-4 font-bold text-slate-500 uppercase tracking-widest w-12 text-center border-r border-slate-200 bg-slate-50/80">No</th>
                    <th className="p-4 font-bold text-slate-500 uppercase tracking-widest min-w-[200px] border-r border-slate-200 bg-slate-50/80">Nama Siswa</th>
                    <th className="p-4 font-bold text-slate-500 uppercase tracking-widest w-20 text-center border-r border-slate-200 bg-slate-50/80">L/P</th>
                    <th className="p-4 font-bold text-slate-500 uppercase tracking-widest w-20 text-center border-r border-slate-200 bg-slate-50/80">NISN</th>
                    {effectiveDates.map(d => (
                      <th key={d.date} className="p-2 text-center min-w-[80px] border-r border-slate-200 group relative">
                        <div className="font-bold text-emerald-700">{format(parse(d.date, 'yyyy-MM-dd', new Date()), 'dd')}</div>
                        <div className="text-[9px] text-slate-400 font-medium">{format(parse(d.date, 'yyyy-MM-dd', new Date()), 'EEE', { locale: id })}</div>
                        <button 
                          onClick={() => handleCheckAllHadir(d.date)}
                          className="mt-1 text-[9px] font-bold text-emerald-600 hover:text-emerald-800 flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <CheckCircle2 size={10} /> Semua H
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white/50">
                  {students.map((student, idx) => (
                    <tr key={student.id} className="hover:bg-white transition-colors">
                      <td className="p-4 text-center font-bold text-slate-400 border-r border-slate-100">{idx + 1}</td>
                      <td className="p-4 font-bold text-slate-700 border-r border-slate-100 whitespace-nowrap">{student.nama}</td>
                      <td className="p-4 text-center text-slate-500 font-medium border-r border-slate-100">{student.jenisKelamin?.charAt(0) || '-'}</td>
                      <td className="p-4 text-center text-slate-500 font-medium border-r border-slate-100">{student.nisn}</td>
                      {effectiveDates.map(d => {
                        const status = activeAttendance?.records[d.date]?.[student.id] || '';
                        return (
                          <td key={d.date} className="p-2 text-center border-r border-slate-100">
                            <select
                              value={status}
                              onChange={(e) => handleStatusChange(d.date, student.id, e.target.value as any)}
                              className={`w-full p-1.5 rounded-lg border text-center font-bold outline-none transition-all appearance-none cursor-pointer ${
                                status === 'H' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
                                status === 'S' ? 'bg-amber-50 border-amber-100 text-amber-700' :
                                status === 'I' ? 'bg-blue-50 border-blue-100 text-blue-700' :
                                status === 'A' ? 'bg-rose-50 border-rose-100 text-rose-700' :
                                'bg-slate-50 border-slate-200 text-slate-400 hover:border-emerald-300'
                              }`}
                            >
                              <option value="">-</option>
                              <option value="H">H</option>
                              <option value="S">S</option>
                              <option value="I">I</option>
                              <option value="A">A</option>
                            </select>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
        
        <div className="mt-6 flex flex-wrap gap-6 items-center justify-center p-4 bg-white/30 rounded-2xl border border-white/50 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700">H</span>
            <span>Hadir</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700">S</span>
            <span>Sakit</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700">I</span>
            <span>Izin</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-700">A</span>
            <span>Alfa</span>
          </div>
        </div>
      </div>
    </Layout>
  );
}
