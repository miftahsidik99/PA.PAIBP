import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import { useStore, JurnalEntry } from '../store/useStore';
import { Save, Download, Plus, Trash2, Calendar, FileText, BookOpen, Edit, Check, X } from 'lucide-react';
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, AlignmentType, BorderStyle, PageOrientation, VerticalAlign } from 'docx';
import { saveAs } from 'file-saver';
import { format, parseISO, eachDayOfInterval, getDay } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

const GRADES = [1, 2, 3, 4, 5, 6];

const MONTH_OPTIONS = [
  'JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI',
  'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'
];

const YEAR_OPTIONS = [2025, 2026, 2027, 2028, 2029, 2030];

export default function Jurnal() {
  const { profile, jurnalState, setJurnalState, jurnalEntries, setJurnalEntries, attendance, schedules, calendarData, savedProtas } = useStore();

  const [selectedGrade, setSelectedGrade] = useState<number>(1);
  const [selectedMonth, setSelectedMonth] = useState<string>(jurnalState?.bulan ? jurnalState.bulan.split(' ')[0] : 'JUNI');
  const [selectedYear, setSelectedYear] = useState<number>(jurnalState?.bulan ? parseInt(jurnalState.bulan.split(' ')[1] || '2026') : 2026);
  
  const [pengawasNama, setPengawasNama] = useState<string>(jurnalState?.pengawasNama || '');
  const [pengawasNip, setPengawasNip] = useState<string>(jurnalState?.pengawasNip || '');

  // Form state
  const [tanggal, setTanggal] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isManualDate, setIsManualDate] = useState(false);
  const lastKeyRef = useRef<string>('');
  const [jamPelajaran, setJamPelajaran] = useState('');
  const [rombel, setRombel] = useState('1');
  const [mataPelajaran, setMataPelajaran] = useState('Pendidikan Agama Islam dan Budi Pekerti');
  const [atp, setAtp] = useState('');
  const [hadir, setHadir] = useState(0);
  const [sakit, setSakit] = useState(0);
  const [izin, setIzin] = useState(0);
  const [alpa, setAlpa] = useState(0);
  const [metode, setMetode] = useState('');
  const [catatan, setCatatan] = useState('');
  const [paperSize, setPaperSize] = useState<'A4' | 'F4'>('A4');

  const [availableDates, setAvailableDates] = useState<{date: string, label: string}[]>([]);
  const [availableAtps, setAvailableAtps] = useState<string[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showToast, setShowToast] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDeleteConfirmId, setShowDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  useEffect(() => {
    // Re-run getEffectiveDates logic for the whole year to map ATPs
    if (!schedules[selectedGrade] || !schedules[selectedGrade].day) {
       setAvailableAtps([]);
       return;
    }
    
    const dayMap: Record<string, number> = {
      'Minggu': 0, 'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6
    };
    const dayIndex = dayMap[schedules[selectedGrade].day];
    
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
      if (dIndex === 0) return false;
      if (dIndex === 6 && weeklyDays === 5) return false;
      const ev = events[dateStr];
      if (ev && !ev.isEffective) return false;
      return true;
    });

    const protaData = savedProtas[selectedGrade] || [];
    let dateIndex = 0;
    const monthIdx = MONTH_OPTIONS.indexOf(selectedMonth);
    const atpsForMonth: string[] = [];

    protaData.forEach(item => {
      const atpCount = Math.max(1, item.atp?.length || 1);
      for (let atpIdx = 0; atpIdx < atpCount; atpIdx++) {
        const atpText = item.atp?.[atpIdx] || '-';
        if (atpText !== '-' && effective[dateIndex]) {
          const d = effective[dateIndex];
          if (d.getMonth() === monthIdx && d.getFullYear() === selectedYear) {
            if (!atpsForMonth.includes(atpText)) {
                atpsForMonth.push(atpText);
            }
          }
          dateIndex++;
        }
      }
    });

    setAvailableAtps(atpsForMonth);
    if (atpsForMonth.length > 0) {
      setAtp(prev => (prev === '[-]' || atpsForMonth.includes(prev)) ? prev : atpsForMonth[0]);
    } else {
      setAtp('[-]');
    }
  }, [selectedGrade, selectedMonth, selectedYear, schedules, calendarData, savedProtas]);

  useEffect(() => {
    const dayMap: Record<string, number> = {
      'Minggu': 0, 'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6
    };
    
    const dayName = schedules[selectedGrade]?.day;
    const dayIndex = dayName ? (dayMap[dayName] ?? -1) : -1;
    const monthIdx = MONTH_OPTIONS.indexOf(selectedMonth);

    if (dayIndex !== -1 && monthIdx !== -1) {
      let activeEvents = selectedGrade === 6 ? calendarData?.events6 : calendarData?.events1to5;
      activeEvents = activeEvents || {};
      
      const startDate = new Date(selectedYear, monthIdx, 1);
      const endDate = new Date(selectedYear, monthIdx + 1, 0);
      const allDays = eachDayOfInterval({ start: startDate, end: endDate });
      const matchingDays = allDays.filter(d => getDay(d) === dayIndex);
      
      const dates = matchingDays.map(d => {
        const dStr = format(d, 'yyyy-MM-dd');
        const formatted = format(d, 'EEEE, d MMMM yyyy', { locale: localeId });
        const ev = activeEvents[dStr];
        let label = formatted;
        if (ev && !ev.isEffective) {
          label += ` (Non-HEB: ${ev.label})`;
        } else {
          label += ` (HEB)`;
        }
        return { date: dStr, label };
      });
      setAvailableDates(dates);
      
      if (dates.length > 0) {
        if (!tanggal || !dates.find(d => d.date === tanggal)) {
          setTanggal(dates[0].date);
        }
      } else {
        const defaultDate = `${selectedYear}-${String(monthIdx + 1).padStart(2, '0')}-01`;
        if (!tanggal || tanggal.substring(0, 7) !== `${selectedYear}-${String(monthIdx + 1).padStart(2, '0')}`) {
          setTanggal(defaultDate);
        }
      }
    } else {
      setAvailableDates([]);
      const monthIdx = MONTH_OPTIONS.indexOf(selectedMonth);
      if (monthIdx !== -1) {
        const defaultDate = `${selectedYear}-${String(monthIdx + 1).padStart(2, '0')}-01`;
        if (!tanggal || tanggal.substring(0, 7) !== `${selectedYear}-${String(monthIdx + 1).padStart(2, '0')}`) {
          setTanggal(defaultDate);
        }
      }
    }
  }, [selectedGrade, selectedMonth, selectedYear, schedules, calendarData]);

  useEffect(() => {
    // Auto-calculate kehadiran based on selected date and grade
    if (tanggal && selectedGrade) {
      const currentKey = `${selectedGrade}_${tanggal}`;
      if (lastKeyRef.current !== currentKey) {
        lastKeyRef.current = currentKey;
        const yyyyMm = tanggal.substring(0, 7); // e.g. '2026-08'
        const gradeAttendance = attendance?.find(a => a.grade === selectedGrade && a.month === yyyyMm);
        if (gradeAttendance && gradeAttendance.records && gradeAttendance.records[tanggal]) {
          const recordsForDate = gradeAttendance.records[tanggal];
          let h = 0, s = 0, i = 0, a = 0;
          Object.values(recordsForDate).forEach(status => {
            if (status === 'H') h++;
            if (status === 'S') s++;
            if (status === 'I') i++;
            if (status === 'A') a++;
          });
          setHadir(h);
          setSakit(s);
          setIzin(i);
          setAlpa(a);
        } else {
          setHadir(0);
          setSakit(0);
          setIzin(0);
          setAlpa(0);
        }
      }
    }
  }, [tanggal, selectedGrade, attendance]);


  const currentGradeEntries = (jurnalEntries?.[selectedGrade] || []).filter(entry => {
    try {
      const d = parseISO(entry.tanggal);
      return d.getMonth() === MONTH_OPTIONS.indexOf(selectedMonth) && d.getFullYear() === selectedYear;
    } catch {
      return false;
    }
  }).sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());

  useEffect(() => {
    // Sync to store when pengawas info or month/year changes
    setJurnalState({
      ...jurnalState,
      bulan: `${selectedMonth} ${selectedYear}`,
      pengawasNama,
      pengawasNip,
      items: jurnalState?.items || {}
    });
  }, [selectedMonth, selectedYear, pengawasNama, pengawasNip]);

  const resetFormFields = () => {
    if (availableAtps.length > 0) {
      setAtp(availableAtps[0]);
    } else {
      setAtp('[-]');
    }
    setMetode('');
    setCatatan('');
  };

  const handleAddEntry = () => {
    if (!tanggal || !atp) {
      alert("Tanggal dan ATP wajib diisi!");
      return;
    }

    const currentEntries = jurnalEntries || {};
    const gradeEntries = currentEntries[selectedGrade] || [];

    if (editingId) {
      // Edit mode
      const updatedEntries = gradeEntries.map(entry => {
        if (entry.id === editingId) {
          return {
            ...entry,
            tanggal,
            jamPelajaran,
            kelas: selectedGrade,
            rombel,
            mataPelajaran,
            atp,
            kehadiran: { hadir, sakit, izin, alpa },
            metode,
            catatan
          };
        }
        return entry;
      });

      setJurnalEntries({
        ...currentEntries,
        [selectedGrade]: updatedEntries
      });

      setEditingId(null);
      setShowToast("Entri jurnal berhasil diperbarui!");
    } else {
      // Add mode
      const newEntry: JurnalEntry = {
        id: Date.now().toString(),
        tanggal,
        jamPelajaran,
        kelas: selectedGrade,
        rombel,
        mataPelajaran,
        atp,
        kehadiran: { hadir, sakit, izin, alpa },
        metode,
        catatan
      };

      setJurnalEntries({
        ...currentEntries,
        [selectedGrade]: [...gradeEntries, newEntry]
      });

      setShowToast("Entri jurnal berhasil ditambahkan!");
    }

    resetFormFields();
  };

  const handleEditEntry = (entry: JurnalEntry) => {
    setEditingId(entry.id);
    setTanggal(entry.tanggal);
    setJamPelajaran(entry.jamPelajaran || '');
    setRombel(entry.rombel);
    setMataPelajaran(entry.mataPelajaran);
    setAtp(entry.atp);
    setHadir(entry.kehadiran.hadir || 0);
    setSakit(entry.kehadiran.sakit || 0);
    setIzin(entry.kehadiran.izin || 0);
    setAlpa(entry.kehadiran.alpa || 0);
    setMetode(entry.metode || '');
    setCatatan(entry.catatan || '');

    const isDateInSchedule = availableDates.some(d => d.date === entry.tanggal);
    if (!isDateInSchedule) {
      setIsManualDate(true);
    } else {
      setIsManualDate(false);
    }

    // Scroll smoothly to the input form
    window.scrollTo({ top: 300, behavior: 'smooth' });
  };

  const handleDeleteEntry = (id: string) => {
    setShowDeleteConfirmId(id);
  };

  const handleDeleteEntryConfirm = (id: string) => {
    const currentEntries = jurnalEntries || {};
    const gradeEntries = currentEntries[selectedGrade] || [];
    setJurnalEntries({
      ...currentEntries,
      [selectedGrade]: gradeEntries.filter(e => e.id !== id)
    });
    if (editingId === id) {
      setEditingId(null);
      resetFormFields();
    }
    setShowDeleteConfirmId(null);
    setShowToast("Entri jurnal berhasil dihapus!");
  };

  const handleSaveData = () => {
    // If the form on the left has been worked on (ATP has text)
    if (atp.trim()) {
      if (!tanggal) {
        alert("Tanggal wajib diisi!");
        return;
      }

      const currentEntries = jurnalEntries || {};
      const gradeEntries = currentEntries[selectedGrade] || [];

      if (editingId) {
        // Save the edited changes
        const updatedEntries = gradeEntries.map(entry => {
          if (entry.id === editingId) {
            return {
              ...entry,
              tanggal,
              jamPelajaran,
              kelas: selectedGrade,
              rombel,
              mataPelajaran,
              atp,
              kehadiran: { hadir, sakit, izin, alpa },
              metode,
              catatan
            };
          }
          return entry;
        });

        setJurnalEntries({
          ...currentEntries,
          [selectedGrade]: updatedEntries
        });

        setEditingId(null);
        setShowToast("Perubahan entri jurnal berhasil disimpan!");
      } else {
        // Save new entry from form
        const newEntry: JurnalEntry = {
          id: Date.now().toString(),
          tanggal,
          jamPelajaran,
          kelas: selectedGrade,
          rombel,
          mataPelajaran,
          atp,
          kehadiran: { hadir, sakit, izin, alpa },
          metode,
          catatan
        };

        setJurnalEntries({
          ...currentEntries,
          [selectedGrade]: [...gradeEntries, newEntry]
        });

        setShowToast("Entri jurnal yang sedang dikerjakan berhasil disimpan!");
      }

      resetFormFields();
    } else {
      // If the form is empty, verify all current month data is in store
      setShowToast("Semua data Jurnal berhasil disimpan ke penyimpanan lokal!");
    }
  };

  const handleClearData = () => {
    if (currentGradeEntries.length === 0) {
      // If there are no table entries, just clear the form fields
      resetFormFields();
      setJamPelajaran('');
      setEditingId(null);
      setShowToast("Form input berhasil dibersihkan.");
      return;
    }
    // Show custom confirmation overlay
    setShowClearConfirm(true);
  };

  const handleClearDataConfirm = () => {
    // 1. Clear form fields
    resetFormFields();
    setJamPelajaran('');
    setEditingId(null);

    // 2. Clear table entries for this month
    const currentEntries = jurnalEntries || {};
    const gradeEntries = currentEntries[selectedGrade] || [];
    const currentMonthIds = new Set(currentGradeEntries.map(e => e.id));
    setJurnalEntries({
      ...currentEntries,
      [selectedGrade]: gradeEntries.filter(e => !currentMonthIds.has(e.id))
    });

    setShowClearConfirm(false);
    setShowToast("Data jurnal kelas ini pada bulan terpilih berhasil dibersihkan!");
  };

  const generateDocx = async () => {
    if (currentGradeEntries.length === 0) {
      alert(`Belum ada entri jurnal untuk Kelas ${selectedGrade} di bulan ${selectedMonth} ${selectedYear}`);
      return;
    }

    try {
      const cellBorders = {
        top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
        left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
        right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
      };

      const headerShading = { fill: "F3F4F6", color: "auto" };

      const colWidths = [4, 13, 6, 8, 11, 25, 9, 9, 9, 6];

      const createHeaderCell = (text: string, widthPct: number) => new TableCell({
        width: { size: widthPct, type: WidthType.PERCENTAGE },
        children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 19 })], alignment: AlignmentType.CENTER })],
        shading: headerShading,
        borders: cellBorders,
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 120, bottom: 120, left: 100, right: 100 }
      });

      const createCell = (text: string, widthPct: number, align: any = AlignmentType.LEFT) => new TableCell({
        width: { size: widthPct, type: WidthType.PERCENTAGE },
        children: [new Paragraph({ children: [new TextRun({ text: text || '-', size: 19 })], alignment: align })],
        borders: cellBorders,
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 100, bottom: 100, left: 100, right: 100 }
      });

      const tableRows = [
        new TableRow({
          tableHeader: true,
          children: [
            createHeaderCell("No", colWidths[0]),
            createHeaderCell("Hari / Tanggal", colWidths[1]),
            createHeaderCell("Jam", colWidths[2]),
            createHeaderCell("Kelas/Rombel", colWidths[3]),
            createHeaderCell("Mata Pelajaran", colWidths[4]),
            createHeaderCell("Alur Tujuan Pembelajaran", colWidths[5]),
            createHeaderCell("Kehadiran (H/S/I/A)", colWidths[6]),
            createHeaderCell("Metode Pembelajaran", colWidths[7]),
            createHeaderCell("Catatan / Refleksi", colWidths[8]),
            createHeaderCell("Paraf", colWidths[9]),
          ]
        }),
        ...currentGradeEntries.map((entry, idx) => {
          let tanggalStr = entry.tanggal || '-';
          try {
            const d = parseISO(entry.tanggal);
            tanggalStr = format(d, "EEEE, d MMM yyyy", { locale: localeId });
          } catch {
            tanggalStr = entry.tanggal;
          }
          const kehadiranStr = `H:${entry.kehadiran?.hadir || 0} S:${entry.kehadiran?.sakit || 0} I:${entry.kehadiran?.izin || 0} A:${entry.kehadiran?.alpa || 0}`;
          
          return new TableRow({
            children: [
              createCell((idx + 1).toString(), colWidths[0], AlignmentType.CENTER),
              createCell(tanggalStr, colWidths[1]),
              createCell(entry.jamPelajaran || '-', colWidths[2], AlignmentType.CENTER),
              createCell(`Kelas ${entry.kelas || selectedGrade} / ${entry.rombel || 'A'}`, colWidths[3], AlignmentType.CENTER),
              createCell(entry.mataPelajaran || 'PAI dan Budi Pekerti', colWidths[4]),
              createCell(entry.atp || '-', colWidths[5]),
              createCell(kehadiranStr, colWidths[6], AlignmentType.CENTER),
              createCell(entry.metode || '-', colWidths[7]),
              createCell(entry.catatan || '-', colWidths[8]),
              createCell("", colWidths[9]), // Paraf
            ]
          });
        })
      ];

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
              children: [new TextRun({ text: "JURNAL MENGAJAR GURU", bold: true, size: 26 })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 }
            }),
            new Paragraph({
              children: [
                new TextRun({ text: `${profile?.namaSekolah || 'SD NEGERI'} — KELAS ${selectedGrade}`, bold: true, size: 22 }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 }
            }),
            new Paragraph({
              children: [
                new TextRun({ text: `Bulan: ${selectedMonth} ${selectedYear}`, size: 20 }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 300 }
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: tableRows
            }),
            new Paragraph({ spacing: { before: 500, after: 150 }, children: [] }),
            new Table({
              borders: {
                top: { style: BorderStyle.NONE, size: 0, color: "auto" },
                bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
                left: { style: BorderStyle.NONE, size: 0, color: "auto" },
                right: { style: BorderStyle.NONE, size: 0, color: "auto" },
                insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
                insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
              },
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      children: [
                        new Paragraph({ children: [new TextRun({ text: "Mengetahui,", bold: true, size: 20 })], alignment: AlignmentType.CENTER }),
                        new Paragraph({ children: [new TextRun({ text: "Pengawas PAI,", bold: true, size: 20 })], alignment: AlignmentType.CENTER })
                      ]
                    }),
                    new TableCell({
                      children: [
                        new Paragraph({ children: [new TextRun({ text: "Mengetahui,", bold: true, size: 20 })], alignment: AlignmentType.CENTER }),
                        new Paragraph({ children: [new TextRun({ text: `Kepala Sekolah ${profile?.namaSekolah || ''}`, bold: true, size: 20 })], alignment: AlignmentType.CENTER })
                      ]
                    }),
                    new TableCell({
                      children: [
                        new Paragraph({ children: [new TextRun({ text: `${profile?.namaSekolah?.split(' ')[1] || 'Tempat'}, ${format(new Date(), "d MMMM yyyy", { locale: localeId })}`, size: 20 })], alignment: AlignmentType.CENTER }),
                        new Paragraph({ children: [new TextRun({ text: "Guru PAIBP,", bold: true, size: 20 })], alignment: AlignmentType.CENTER })
                      ]
                    }),
                  ]
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ spacing: { before: 700 } })] }),
                    new TableCell({ children: [new Paragraph({ spacing: { before: 700 } })] }),
                    new TableCell({ children: [new Paragraph({ spacing: { before: 700 } })] })
                  ]
                }),
                new TableRow({
                  children: [
                    new TableCell({
                      children: [
                        new Paragraph({ children: [new TextRun({ text: pengawasNama || '( ........................................ )', bold: true, underline: {}, size: 20 })], alignment: AlignmentType.CENTER }),
                        new Paragraph({ children: [new TextRun({ text: `NIP. ${pengawasNip || '........................................'}`, size: 19 })], alignment: AlignmentType.CENTER })
                      ]
                    }),
                    new TableCell({
                      children: [
                        new Paragraph({ children: [new TextRun({ text: profile?.namaKepalaSekolah || '( ........................................ )', bold: true, underline: {}, size: 20 })], alignment: AlignmentType.CENTER }),
                        new Paragraph({ children: [new TextRun({ text: `NIP. ${profile?.nipKepalaSekolah || '........................................'}`, size: 19 })], alignment: AlignmentType.CENTER })
                      ]
                    }),
                    new TableCell({
                      children: [
                        new Paragraph({ children: [new TextRun({ text: profile?.namaGuru || '( ........................................ )', bold: true, underline: {}, size: 20 })], alignment: AlignmentType.CENTER }),
                        new Paragraph({ children: [new TextRun({ text: `NIP. ${profile?.nip || '........................................'}`, size: 19 })], alignment: AlignmentType.CENTER })
                      ]
                    }),
                  ]
                })
              ]
            })
          ]
        }]
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `Jurnal_Mengajar_Kelas_${selectedGrade}_${selectedMonth}_${selectedYear}_${paperSize}.docx`);
    } catch (error) {
      console.error(error);
      alert('Terjadi kesalahan saat membuat dokumen Jurnal.');
    }
  };

  return (
    <Layout>
      <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
        
        {/* Banner Info */}
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-2xl shadow-sm flex items-center gap-3">
          <BookOpen className="text-blue-500 flex-shrink-0" size={20} />
          <span className="text-sm font-bold">Isi Jurnal Pada Hari Pelaksanaan Pembelajaran</span>
        </div>

        {/* Header & Settings */}
        <div className="bg-white/60 border border-white/80 backdrop-blur-md rounded-3xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Jurnal Mengajar</h1>
            <p className="text-slate-500 text-sm max-w-xl">
              Catat kegiatan pembelajaran harian, pilih kelas, dan unduh dokumen Jurnal dalam format Word yang rapi dan siap cetak.
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Paper Size Selector */}
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

            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:border-emerald-500 focus:ring-0 text-sm font-bold bg-white cursor-pointer"
            >
              {MONTH_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:border-emerald-500 focus:ring-0 text-sm font-bold bg-white cursor-pointer"
            >
              {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button
              onClick={generateDocx}
              disabled={currentGradeEntries.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
            >
              <Download size={18} />
              Unduh Word ({paperSize})
            </button>
          </div>
        </div>

        {/* Info Pengawas */}
        <div className="bg-white/60 border border-white/80 backdrop-blur-md rounded-3xl p-6 shadow-sm">
          <h2 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-widest flex items-center gap-2">
            <FileText size={16} className="text-emerald-500" />
            Pejabat Mengetahui
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Nama Pengawas PAI</label>
              <input
                type="text"
                value={pengawasNama}
                onChange={(e) => setPengawasNama(e.target.value)}
                placeholder="Contoh: H. Ahmad, S.Ag, M.Pd"
                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:border-emerald-500 focus:ring-0"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">NIP Pengawas PAI</label>
              <input
                type="text"
                value={pengawasNip}
                onChange={(e) => setPengawasNip(e.target.value)}
                placeholder="NIP Pengawas..."
                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:border-emerald-500 focus:ring-0"
              />
            </div>
          </div>
        </div>

        {/* Class Selection Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {GRADES.map(grade => (
            <button
              key={grade}
              onClick={() => setSelectedGrade(grade)}
              className={`px-6 py-3 rounded-2xl text-sm font-bold transition-colors whitespace-nowrap ${selectedGrade === grade ? 'bg-emerald-600 shadow-md shadow-emerald-600/20 text-white' : 'bg-white/60 text-slate-600 border border-slate-200 hover:bg-white'}`}
            >
              Kelas {grade}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* Form Input */}
          <div className="lg:col-span-1 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm sticky top-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">
              {editingId ? 'Edit Jurnal Kelas' : 'Input Jurnal Kelas'} {selectedGrade}
            </h2>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-600">Tanggal Pembelajaran <span className="text-red-500">*</span></label>
                  {availableDates.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsManualDate(!isManualDate)}
                      className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
                    >
                      {isManualDate ? 'Pilih dari Jadwal' : 'Input Tanggal Bebas'}
                    </button>
                  )}
                </div>
                {availableDates.length > 0 && !isManualDate ? (
                  <select
                    value={tanggal}
                    onChange={(e) => {
                      setTanggal(e.target.value);
                      if (e.target.value) {
                        try {
                          const d = parseISO(e.target.value);
                          if (!isNaN(d.getTime())) {
                            const mName = MONTH_OPTIONS[d.getMonth()];
                            const yNum = d.getFullYear();
                            if (mName !== selectedMonth || yNum !== selectedYear) {
                              setSelectedMonth(mName);
                              setSelectedYear(yNum);
                            }
                          }
                        } catch (err) {
                          console.error(err);
                        }
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white"
                  >
                    {availableDates.map(d => (
                      <option key={d.date} value={d.date}>{d.label}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="date"
                    value={tanggal}
                    onChange={(e) => {
                      const newVal = e.target.value;
                      setTanggal(newVal);
                      if (newVal) {
                        try {
                          const d = parseISO(newVal);
                          if (!isNaN(d.getTime())) {
                            const mName = MONTH_OPTIONS[d.getMonth()];
                            const yNum = d.getFullYear();
                            if (mName !== selectedMonth || yNum !== selectedYear) {
                              setSelectedMonth(mName);
                              setSelectedYear(yNum);
                            }
                          }
                        } catch (err) {
                          console.error(err);
                        }
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                  />
                )}
                {availableDates.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">Jadwal untuk kelas ini belum diatur, atau tidak ada hari yang sesuai di bulan ini.</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Jam Pelajaran</label>
                  <input
                    type="text"
                    value={jamPelajaran}
                    onChange={(e) => setJamPelajaran(e.target.value)}
                    placeholder="Misal: 1-3"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Rombel</label>
                  <input
                    type="text"
                    value={rombel}
                    onChange={(e) => setRombel(e.target.value)}
                    placeholder="A/B/1"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Mata Pelajaran</label>
                <input
                  type="text"
                  value={mataPelajaran}
                  onChange={(e) => setMataPelajaran(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Alur Tujuan Pembelajaran <span className="text-red-500">*</span></label>
                <div className="space-y-2">
                  <select
                    value={availableAtps.includes(atp) || atp === '[-]' ? atp : 'custom'}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'custom') {
                        setAtp('');
                      } else {
                        setAtp(val);
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white font-medium"
                  >
                    <option value="[-]">[-] (Tanggal Pembelajaran NON-HEB / Tanpa ATP)</option>
                    {availableAtps.map((opt, i) => (
                      <option key={i} value={opt}>{opt}</option>
                    ))}
                    <option value="custom">Ketik / Paste ATP Manual...</option>
                  </select>

                  {(atp !== '[-]' && !availableAtps.includes(atp)) && (
                    <textarea
                      value={atp}
                      onChange={(e) => setAtp(e.target.value)}
                      placeholder="Ketik atau paste ATP di sini..."
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm min-h-[80px]"
                    />
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">Kehadiran Siswa</label>
                <div className="grid grid-cols-4 gap-2">
                  <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-white">
                    <span className="bg-slate-100 px-2 py-2 text-xs font-bold text-slate-500 border-r border-slate-200" title="Hadir">H</span>
                    <input type="number" min="0" value={hadir} onChange={(e) => setHadir(Math.max(0, parseInt(e.target.value) || 0))} className="w-full px-1 py-1 text-sm border-0 focus:ring-0 text-center bg-transparent text-slate-700" title="Jumlah Hadir" />
                  </div>
                  <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-white">
                    <span className="bg-slate-100 px-2 py-2 text-xs font-bold text-slate-500 border-r border-slate-200" title="Sakit">S</span>
                    <input type="number" min="0" value={sakit} onChange={(e) => setSakit(Math.max(0, parseInt(e.target.value) || 0))} className="w-full px-1 py-1 text-sm border-0 focus:ring-0 text-center bg-transparent text-slate-700" title="Jumlah Sakit" />
                  </div>
                  <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-white">
                    <span className="bg-slate-100 px-2 py-2 text-xs font-bold text-slate-500 border-r border-slate-200" title="Izin">I</span>
                    <input type="number" min="0" value={izin} onChange={(e) => setIzin(Math.max(0, parseInt(e.target.value) || 0))} className="w-full px-1 py-1 text-sm border-0 focus:ring-0 text-center bg-transparent text-slate-700" title="Jumlah Izin" />
                  </div>
                  <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-white">
                    <span className="bg-slate-100 px-2 py-2 text-xs font-bold text-slate-500 border-r border-slate-200" title="Alpa">A</span>
                    <input type="number" min="0" value={alpa} onChange={(e) => setAlpa(Math.max(0, parseInt(e.target.value) || 0))} className="w-full px-1 py-1 text-sm border-0 focus:ring-0 text-center bg-transparent text-slate-700" title="Jumlah Alpa" />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">* Data ditarik otomatis dari Presensi (bisa diedit manual)</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Metode/Model Pembelajaran (Opsional)</label>
                <input
                  type="text"
                  value={metode}
                  onChange={(e) => setMetode(e.target.value)}
                  placeholder="Misal: PBL, Diskusi, dll"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Catatan / Refleksi (Opsional)</label>
                <textarea
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  placeholder="Catatan tambahan..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm min-h-[60px]"
                />
              </div>

              <button
                onClick={handleAddEntry}
                className={`w-full py-3 text-white rounded-xl text-sm font-bold shadow-md transition-colors flex items-center justify-center gap-2 mt-4 ${
                  editingId ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20' : 'bg-slate-900 hover:bg-slate-800'
                }`}
              >
                {editingId ? <Check size={18} /> : <Plus size={18} />}
                {editingId ? 'Simpan Perubahan' : 'Tambahkan ke Jurnal'}
              </button>
              {editingId && (
                <button
                  onClick={() => {
                    setEditingId(null);
                    setAtp('');
                    setMetode('');
                    setCatatan('');
                    setShowToast("Pengeditan dibatalkan");
                  }}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors mt-2"
                >
                  Batal Edit
                </button>
              )}
            </div>
          </div>

          {/* Table Preview */}
          <div className="lg:col-span-2 bg-white/60 border border-white/80 backdrop-blur-md rounded-3xl p-6 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
            <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-slate-900">Daftar Jurnal (Bulan Ini)</h2>
                <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full">
                  {currentGradeEntries.length} Entri
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleClearData}
                  disabled={currentGradeEntries.length === 0}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                  title="Bersihkan Semua Jurnal Bulan Ini"
                >
                  <Trash2 size={14} />
                  Clear Data
                </button>
                <button
                  onClick={handleSaveData}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                  title="Simpan Data Jurnal"
                >
                  <Save size={14} />
                  Simpan Data
                </button>
              </div>
            </div>
            
            {currentGradeEntries.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-12">
                <Calendar size={48} className="mb-4 text-slate-300" />
                <p>Belum ada jurnal untuk kelas dan bulan ini.</p>
                <p className="text-sm mt-1">Silakan tambahkan melalui form di samping.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white flex-1">
                <table className="w-full text-left text-xs md:text-sm border-collapse min-w-[1000px]">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="p-3 w-12 text-center">No</th>
                      <th className="p-3 w-32">Tanggal / Jam</th>
                      <th className="p-3 w-28">Rombel / Mapel</th>
                      <th className="p-3">ATP</th>
                      <th className="p-3 w-40 text-center">Kehadiran (H/S/I/A)</th>
                      <th className="p-3 w-28">Metode</th>
                      <th className="p-3 w-36">Catatan</th>
                      <th className="p-3 w-16 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs md:text-sm">
                    {currentGradeEntries.map((entry, idx) => (
                      <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-3 text-center text-slate-400 font-medium">{idx + 1}</td>
                        <td className="p-3">
                          <div className="font-semibold text-slate-800">
                            {format(parseISO(entry.tanggal), "dd MMM yyyy", { locale: localeId })}
                          </div>
                          <span className="text-xs text-slate-500">Jam: {entry.jamPelajaran || '-'}</span>
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-slate-700">Rombel {entry.rombel || '-'}</div>
                          <span className="text-[10px] text-slate-500 block truncate max-w-[120px]" title={entry.mataPelajaran}>{entry.mataPelajaran}</span>
                        </td>
                        <td className="p-3 text-slate-600 max-w-xs break-words font-medium" title={entry.atp}>{entry.atp}</td>
                        <td className="p-3 text-center text-slate-600">
                          <span className="inline-flex gap-2 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 font-bold">
                            <span className="text-emerald-600" title="Hadir">H:{entry.kehadiran.hadir || 0}</span>
                            <span className="text-amber-500" title="Sakit">S:{entry.kehadiran.sakit || 0}</span>
                            <span className="text-blue-500" title="Izin">I:{entry.kehadiran.izin || 0}</span>
                            <span className="text-red-500" title="Alpa">A:{entry.kehadiran.alpa || 0}</span>
                          </span>
                        </td>
                        <td className="p-3 text-slate-600 truncate max-w-[100px]" title={entry.metode || '-'}>{entry.metode || '-'}</td>
                        <td className="p-3 text-slate-600 truncate max-w-[120px]" title={entry.catatan || '-'}>{entry.catatan || '-'}</td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button 
                              onClick={() => handleEditEntry(entry)}
                              className="text-amber-500 hover:text-amber-600 transition-colors p-1"
                              title="Edit Entri"
                            >
                              <Edit size={16} />
                            </button>
                            <button 
                              onClick={() => handleDeleteEntry(entry.id)}
                              className="text-red-400 hover:text-red-600 transition-colors p-1"
                              title="Hapus Entri"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-sm font-semibold border border-slate-800 animate-fade-in">
          <Check className="text-emerald-400" size={18} />
          {showToast}
        </div>
      )}

      {/* Clear Data Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 animate-scale-up">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <div className="bg-rose-50 p-2.5 rounded-2xl">
                <Trash2 size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Bersihkan Data Jurnal?</h3>
            </div>
            <p className="text-slate-600 text-sm mb-6 leading-relaxed">
              Apakah Anda yakin ingin menghapus semua <strong className="text-slate-900">({currentGradeEntries.length}) entri jurnal</strong> untuk <strong className="text-slate-900">Kelas {selectedGrade}</strong> pada bulan <strong className="text-slate-900">{selectedMonth} {selectedYear}</strong>? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleClearDataConfirm}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-sm transition-colors shadow-lg shadow-rose-600/20"
              >
                Ya, Hapus Semua
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Entry Confirmation Modal */}
      {showDeleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 animate-scale-up">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <div className="bg-rose-50 p-2.5 rounded-2xl">
                <Trash2 size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Hapus Jurnal?</h3>
            </div>
            <p className="text-slate-600 text-sm mb-6 leading-relaxed">
              Apakah Anda yakin ingin menghapus entri jurnal terpilih ini? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirmId(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-colors"
              >
                Batal
              </button>
              <button
                onClick={() => handleDeleteEntryConfirm(showDeleteConfirmId)}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-sm transition-colors shadow-lg shadow-rose-600/20"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
