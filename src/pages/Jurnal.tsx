import React, { useState, useEffect, useMemo, useRef } from 'react';
import Layout from '../components/Layout';
import { useStore, JurnalEntry } from '../store/useStore';
import { 
  Save, 
  Download, 
  Plus, 
  Trash2, 
  Calendar, 
  FileText, 
  BookOpen, 
  Edit, 
  Check, 
  X, 
  RefreshCw,
  Lock,
  Sparkles,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { 
  Document, 
  Packer, 
  Paragraph, 
  Table, 
  TableCell, 
  TableRow, 
  TextRun, 
  WidthType, 
  AlignmentType, 
  BorderStyle, 
  PageOrientation, 
  VerticalAlign 
} from 'docx';
import { saveAs } from 'file-saver';
import { format, parseISO, eachDayOfInterval, getDay } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

const GRADES = [1, 2, 3, 4, 5, 6];

const MONTH_OPTIONS = [
  'JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI',
  'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'
];

const YEAR_OPTIONS = [2025, 2026, 2027, 2028, 2029, 2030];

const DEFAULT_SCHEDULES: Record<number, { day: string; jp: number; jamKe: string }> = {
  1: { day: 'Senin', jp: 3, jamKe: '3, 4, 5' },
  2: { day: 'Selasa', jp: 3, jamKe: '2, 3, 4' },
  3: { day: 'Rabu', jp: 3, jamKe: '2, 3, 4' },
  4: { day: "Jum'at", jp: 3, jamKe: '4, 5, 6' },
  5: { day: 'Kamis', jp: 3, jamKe: '2, 3, 4' },
  6: { day: 'Kamis', jp: 3, jamKe: '6, 7, 8' },
};

const DAY_MAP: Record<string, number> = {
  'Minggu': 0,
  'Senin': 1,
  'Selasa': 2,
  'Rabu': 3,
  'Kamis': 4,
  'Jumat': 5,
  "Jum'at": 5,
  'Sabtu': 6
};

export default function Jurnal() {
  const { 
    profile, 
    jurnalState, 
    setJurnalState, 
    jurnalEntries = {}, 
    setJurnalEntries, 
    students = {},
    attendance = [], 
    schedules = {}, 
    calendarData, 
    savedProtas = {},
    lockedProtas = {},
    rombelConfig = {},
    syncUserDataToCloud 
  } = useStore();

  const [selectedGrade, setSelectedGrade] = useState<number>(1);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return jurnalState?.bulan ? jurnalState.bulan.split(' ')[0] : 'SEPTEMBER';
  });
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    return jurnalState?.bulan ? parseInt(jurnalState.bulan.split(' ')[1] || '2026') : 2026;
  });
  
  // Pejabat Pengawas default
  const [pengawasNama, setPengawasNama] = useState<string>(
    jurnalState?.pengawasNama || 'Taufikolloh, S.Pd.I, M.Pd.'
  );
  const [pengawasNip, setPengawasNip] = useState<string>(
    jurnalState?.pengawasNip || '197303022007011007'
  );

  const [isSaving, setIsSaving] = useState(false);
  const [paperSize, setPaperSize] = useState<'A4' | 'F4'>('A4');

  // Form state for manual / quick override
  const [tanggal, setTanggal] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [jamPelajaran, setJamPelajaran] = useState('');
  const [rombel, setRombel] = useState('1');
  const [mataPelajaran, setMataPelajaran] = useState('Pendidikan Agama Islam dan Budi Pekerti');
  const [atp, setAtp] = useState('');
  const [hadir, setHadir] = useState(0);
  const [sakit, setSakit] = useState(0);
  const [izin, setIzin] = useState(0);
  const [alpa, setAlpa] = useState(0);
  const [metode, setMetode] = useState('RPM');
  const [catatan, setCatatan] = useState('-');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showToast, setShowToast] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDeleteConfirmId, setShowDeleteConfirmId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  // Read schedules for active grade
  const currentSchedule = useMemo(() => {
    const s = schedules[selectedGrade];
    return {
      day: s?.day || DEFAULT_SCHEDULES[selectedGrade]?.day || 'Senin',
      jp: s?.jp || DEFAULT_SCHEDULES[selectedGrade]?.jp || 3,
      jamKe: s?.jamKe || DEFAULT_SCHEDULES[selectedGrade]?.jamKe || '1'
    };
  }, [schedules, selectedGrade]);

  // Academic year start year
  const academicYear = calendarData?.academicYear || profile?.tahunPelajaran || '2026/2027';
  const startYear = parseInt(academicYear.split('/')[0] || academicYear.split('-')[0] || '2026');
  const weeklyDays = calendarData?.weeklyDays || 5;

  // Flattened ATP list from saved/locked Prota for this grade
  const protaAtpList = useMemo(() => {
    const protaItems = savedProtas[selectedGrade] || [];
    const list: string[] = [];
    protaItems.forEach(item => {
      if (Array.isArray(item.atp)) {
        item.atp.forEach((a: string) => {
          if (a && a !== '-') list.push(a);
        });
      } else if (item.atp && item.atp !== '-') {
        list.push(item.atp);
      }
    });
    return list;
  }, [savedProtas, selectedGrade]);

  // Compute all effective teaching dates (HEB) across the entire academic year (July 1 to June 30)
  const academicYearHebDates = useMemo(() => {
    const dayIndex = DAY_MAP[currentSchedule.day] ?? 1;
    const startDate = new Date(startYear, 6, 1); // 1 Juli
    const endDate = new Date(startYear + 1, 5, 30); // 30 Juni
    const events = selectedGrade === 6 ? (calendarData?.events6 || {}) : (calendarData?.events1to5 || {});

    const allDays = eachDayOfInterval({ start: startDate, end: endDate });
    const matchDays = allDays.filter(d => getDay(d) === dayIndex);

    return matchDays.filter(d => {
      const dIndex = getDay(d);
      if (dIndex === 0) return false;
      if (dIndex === 6 && weeklyDays === 5) return false;
      const dStr = format(d, 'yyyy-MM-dd');
      const ev = events[dStr];
      if (ev && !ev.isEffective) return false;
      return true;
    }).map(d => format(d, 'yyyy-MM-dd'));
  }, [currentSchedule.day, startYear, weeklyDays, selectedGrade, calendarData]);

  // Compute all dates of the scheduled day within the selected Month and Year
  const monthScheduledDates = useMemo(() => {
    const dayIndex = DAY_MAP[currentSchedule.day] ?? 1;
    const monthIdx = MONTH_OPTIONS.indexOf(selectedMonth);
    if (monthIdx === -1) return [];

    const startDate = new Date(selectedYear, monthIdx, 1);
    const endDate = new Date(selectedYear, monthIdx + 1, 0); // last day of month
    const allDays = eachDayOfInterval({ start: startDate, end: endDate });
    return allDays.filter(d => getDay(d) === dayIndex);
  }, [currentSchedule.day, selectedMonth, selectedYear]);

  // Total enrolled students for this grade
  const gradeStudents = useMemo(() => {
    return students?.[selectedGrade] || [];
  }, [students, selectedGrade]);

  const totalEnrolled = gradeStudents.length;

  // Active rombel string (e.g. '1')
  const defaultRombel = rombelConfig?.[selectedGrade]?.labels?.[0] || '1';

  // Compute automated journal entries for the selected month
  const autoCalculatedEntries = useMemo(() => {
    const events = selectedGrade === 6 ? (calendarData?.events6 || {}) : (calendarData?.events1to5 || {});
    const existingEntries = jurnalEntries?.[selectedGrade] || [];
    const existingMap = new Map<string, JurnalEntry>();
    existingEntries.forEach(e => existingMap.set(e.tanggal, e));

    return monthScheduledDates.map((d, idx) => {
      const dStr = format(d, 'yyyy-MM-dd');
      const dow = getDay(d);
      const ev = events[dStr];

      let isHeb = true;
      let nonHebLabel = '';

      if (ev && !ev.isEffective) {
        isHeb = false;
        nonHebLabel = ev.label || 'Hari Libur / Non-HEB';
      } else if (dow === 0 || (dow === 6 && weeklyDays === 5)) {
        isHeb = false;
        nonHebLabel = 'Libur Akhir Pekan';
      }

      // Check if user has previously saved an entry for this exact date
      const saved = existingMap.get(dStr);

      // ATP determination: on Non-HEB, ATP is marked [-]
      let calculatedAtp = '';
      if (!isHeb) {
        calculatedAtp = (saved?.atp && saved.atp !== '[-]' && !saved.atp.startsWith('Non-HEB')) 
          ? saved.atp 
          : '[-]';
      } else {
        const hebIndex = academicYearHebDates.indexOf(dStr);
        if (hebIndex !== -1 && protaAtpList[hebIndex]) {
          calculatedAtp = protaAtpList[hebIndex];
        } else if (protaAtpList.length > 0) {
          calculatedAtp = protaAtpList[idx % protaAtpList.length];
        } else {
          calculatedAtp = 'Materi Pembelajaran PAIBP (Prota belum diisi)';
        }
      }

      // Jam Pelajaran
      let calculatedJam = '1';
      if (!isHeb) {
        calculatedJam = '-';
      } else if (currentSchedule.jamKe) {
        // Use first period or jamKe
        const parts = currentSchedule.jamKe.split(',');
        calculatedJam = parts[0]?.trim() || '1';
      }

      // Kehadiran (H/S/I/A) calculation
      let calculatedHadir = 0;
      let calculatedSakit = 0;
      let calculatedIzin = 0;
      let calculatedAlpa = 0;

      if (!isHeb) {
        calculatedHadir = 0;
        calculatedSakit = 0;
        calculatedIzin = 0;
        calculatedAlpa = 0;
      } else {
        const yyyyMm = dStr.substring(0, 7);
        const gradeAttendance = attendance?.find(a => a.grade === selectedGrade && a.month === yyyyMm);
        const recordsForDate = gradeAttendance?.records?.[dStr];

        if (recordsForDate) {
          Object.values(recordsForDate).forEach(status => {
            if (status === 'H') calculatedHadir++;
            if (status === 'S') calculatedSakit++;
            if (status === 'I') calculatedIzin++;
            if (status === 'A') calculatedAlpa++;
          });
          // If absences are recorded but hadir was not explicitly marked, remaining students are Hadir
          if (totalEnrolled > 0) {
            const recordedTotal = calculatedHadir + calculatedSakit + calculatedIzin + calculatedAlpa;
            if (recordedTotal < totalEnrolled && (calculatedSakit > 0 || calculatedIzin > 0 || calculatedAlpa > 0)) {
              calculatedHadir = Math.max(0, totalEnrolled - (calculatedSakit + calculatedIzin + calculatedAlpa));
            }
          }
        } else {
          // Default all enrolled students to Hadir when no absence records exist
          calculatedHadir = totalEnrolled > 0 ? totalEnrolled : 0;
          calculatedSakit = 0;
          calculatedIzin = 0;
          calculatedAlpa = 0;
        }
      }

      // Catatan/Refleksi determination:
      // For Non-HEB dates, directly display the exact event label configured by user in Academic Calendar!
      let resolvedCatatan = '-';
      if (!isHeb) {
        resolvedCatatan = (saved?.catatan && saved.catatan !== '-' && saved.catatan !== 'Libur Akhir Pekan')
          ? saved.catatan
          : (nonHebLabel || 'Non-HEB');
      } else {
        resolvedCatatan = saved?.catatan !== undefined ? saved.catatan : '-';
      }

      let resolvedMetode = 'RPM';
      if (!isHeb) {
        resolvedMetode = (saved?.metode && saved.metode !== 'RPM') ? saved.metode : '-';
      } else {
        resolvedMetode = saved?.metode !== undefined ? saved.metode : 'RPM';
      }

      // Merge with user's manual inputs if exists
      return {
        id: saved?.id || `auto-${selectedGrade}-${dStr}`,
        tanggal: dStr,
        isHeb,
        nonHebLabel,
        jamPelajaran: saved?.jamPelajaran || calculatedJam,
        kelas: selectedGrade,
        rombel: saved?.rombel || defaultRombel,
        mataPelajaran: saved?.mataPelajaran || 'Pendidikan Agama Islam dan Budi Pekerti',
        atp: (!isHeb && (!saved?.atp || saved.atp.startsWith('Non-HEB'))) ? '[-]' : (saved?.atp || calculatedAtp),
        kehadiran: saved?.kehadiran || {
          hadir: calculatedHadir,
          sakit: calculatedSakit,
          izin: calculatedIzin,
          alpa: calculatedAlpa
        },
        metode: resolvedMetode,
        catatan: resolvedCatatan
      };
    });
  }, [
    monthScheduledDates, 
    selectedGrade, 
    calendarData, 
    weeklyDays, 
    jurnalEntries, 
    academicYearHebDates, 
    protaAtpList, 
    currentSchedule, 
    attendance, 
    totalEnrolled, 
    defaultRombel
  ]);

  // Combined active journal entries for this month:
  // Includes autoCalculatedEntries plus any user-added manual dates for this month
  const currentGradeEntries = useMemo(() => {
    const autoMap = new Map<string, any>();
    autoCalculatedEntries.forEach(e => autoMap.set(e.tanggal, e));

    const savedList = (jurnalEntries?.[selectedGrade] || []).filter(e => {
      try {
        const d = parseISO(e.tanggal);
        return d.getMonth() === MONTH_OPTIONS.indexOf(selectedMonth) && d.getFullYear() === selectedYear;
      } catch {
        return false;
      }
    });

    // Add manual entries that don't match schedule day
    savedList.forEach(saved => {
      if (!autoMap.has(saved.tanggal)) {
        autoMap.set(saved.tanggal, {
          ...saved,
          isHeb: true,
          nonHebLabel: ''
        });
      }
    });

    return Array.from(autoMap.values()).sort(
      (a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime()
    );
  }, [autoCalculatedEntries, jurnalEntries, selectedGrade, selectedMonth, selectedYear]);

  // Sync pengawas info to store when changed
  useEffect(() => {
    setJurnalState({
      ...jurnalState,
      bulan: `${selectedMonth} ${selectedYear}`,
      pengawasNama,
      pengawasNip,
      items: jurnalState?.items || {}
    });
  }, [selectedMonth, selectedYear, pengawasNama, pengawasNip]);

  // Handle direct in-table update of manual fields (Metode & Catatan)
  const handleInlineChange = (tanggalStr: string, field: 'metode' | 'catatan', value: string) => {
    const currentList = jurnalEntries?.[selectedGrade] || [];
    const existingIndex = currentList.findIndex(e => e.tanggal === tanggalStr);

    let updatedList: JurnalEntry[];

    if (existingIndex >= 0) {
      updatedList = currentList.map((entry, idx) => {
        if (idx === existingIndex) {
          return { ...entry, [field]: value };
        }
        return entry;
      });
    } else {
      // Find the auto entry to initialize
      const autoEntry = currentGradeEntries.find(e => e.tanggal === tanggalStr);
      const newEntry: JurnalEntry = {
        id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
        tanggal: tanggalStr,
        jamPelajaran: autoEntry?.jamPelajaran || '1',
        kelas: selectedGrade,
        rombel: autoEntry?.rombel || defaultRombel,
        mataPelajaran: autoEntry?.mataPelajaran || 'Pendidikan Agama Islam dan Budi Pekerti',
        atp: autoEntry?.atp || (autoEntry?.isHeb === false ? '[-]' : '-'),
        kehadiran: autoEntry?.kehadiran || { hadir: totalEnrolled, sakit: 0, izin: 0, alpa: 0 },
        metode: autoEntry?.metode || (autoEntry?.isHeb === false ? '-' : 'RPM'),
        catatan: autoEntry?.catatan || (autoEntry?.isHeb === false ? (autoEntry?.nonHebLabel || 'Non-HEB') : '-'),
        [field]: value
      };
      updatedList = [...currentList, newEntry];
    }

    setJurnalEntries({
      ...jurnalEntries,
      [selectedGrade]: updatedList
    });
  };

  // Save current month's entries to store and cloud
  const handleSaveData = () => {
    setIsSaving(true);
    const currentList = jurnalEntries?.[selectedGrade] || [];
    const activeMap = new Map<string, JurnalEntry>();

    // Start with existing saved entries outside this month
    currentList.forEach(e => {
      try {
        const d = parseISO(e.tanggal);
        if (d.getMonth() !== MONTH_OPTIONS.indexOf(selectedMonth) || d.getFullYear() !== selectedYear) {
          activeMap.set(e.tanggal, e);
        }
      } catch {
        activeMap.set(e.tanggal, e);
      }
    });

    // Commit all entries currently shown for this month
    currentGradeEntries.forEach(entry => {
      activeMap.set(entry.tanggal, {
        id: entry.id,
        tanggal: entry.tanggal,
        jamPelajaran: entry.jamPelajaran || (entry.isHeb === false ? '-' : '1'),
        kelas: entry.kelas || selectedGrade,
        rombel: entry.rombel || defaultRombel,
        mataPelajaran: entry.mataPelajaran || 'Pendidikan Agama Islam dan Budi Pekerti',
        atp: entry.atp || (entry.isHeb === false ? '[-]' : '-'),
        kehadiran: entry.kehadiran || { hadir: 0, sakit: 0, izin: 0, alpa: 0 },
        metode: entry.metode || (entry.isHeb === false ? '-' : 'RPM'),
        catatan: entry.catatan || (entry.isHeb === false ? (entry.nonHebLabel || 'Non-HEB') : '-')
      });
    });

    const finalGradeEntries = Array.from(activeMap.values());

    setJurnalEntries({
      ...jurnalEntries,
      [selectedGrade]: finalGradeEntries
    });

    setJurnalState({
      ...jurnalState,
      bulan: `${selectedMonth} ${selectedYear}`,
      pengawasNama,
      pengawasNip,
      items: jurnalState?.items || {}
    });

    if (typeof syncUserDataToCloud === 'function') {
      syncUserDataToCloud();
    }

    setTimeout(() => {
      setIsSaving(false);
      setShowToast(`Data Jurnal Kelas ${selectedGrade} bulan ${selectedMonth} ${selectedYear} berhasil disimpan!`);
    }, 350);
  };

  // Form submit for adding or editing an entry
  const handleSaveFormEntry = () => {
    if (!tanggal || !atp) {
      alert("Tanggal dan ATP wajib diisi!");
      return;
    }

    const currentEntries = jurnalEntries?.[selectedGrade] || [];
    const entryId = editingId || (Date.now().toString() + Math.random().toString(36).substring(2, 5));

    const newEntry: JurnalEntry = {
      id: entryId,
      tanggal,
      jamPelajaran: jamPelajaran || '1',
      kelas: selectedGrade,
      rombel: rombel || defaultRombel,
      mataPelajaran,
      atp,
      kehadiran: { hadir, sakit, izin, alpa },
      metode: metode || 'RPM',
      catatan: catatan || '-'
    };

    let updatedList: JurnalEntry[];
    const exists = currentEntries.some(e => e.tanggal === tanggal || e.id === entryId);
    if (exists) {
      updatedList = currentEntries.map(e => (e.tanggal === tanggal || e.id === entryId ? newEntry : e));
    } else {
      updatedList = [...currentEntries, newEntry];
    }

    setJurnalEntries({
      ...jurnalEntries,
      [selectedGrade]: updatedList
    });

    setEditingId(null);
    setIsFormOpen(false);
    setShowToast("Entri jurnal berhasil diperbarui!");
  };

  const handleEditEntry = (entry: any) => {
    setEditingId(entry.id);
    setTanggal(entry.tanggal);
    setJamPelajaran(entry.jamPelajaran || '1');
    setRombel(entry.rombel || defaultRombel);
    setMataPelajaran(entry.mataPelajaran || 'Pendidikan Agama Islam dan Budi Pekerti');
    setAtp(entry.atp);
    setHadir(entry.kehadiran?.hadir || 0);
    setSakit(entry.kehadiran?.sakit || 0);
    setIzin(entry.kehadiran?.izin || 0);
    setAlpa(entry.kehadiran?.alpa || 0);
    setMetode(entry.metode || 'RPM');
    setCatatan(entry.catatan || '-');
    setIsFormOpen(true);
  };

  const handleDeleteEntryConfirm = (id: string) => {
    const currentList = jurnalEntries?.[selectedGrade] || [];
    setJurnalEntries({
      ...jurnalEntries,
      [selectedGrade]: currentList.filter(e => e.id !== id)
    });
    setShowDeleteConfirmId(null);
    setShowToast("Entri manual berhasil dihapus");
  };

  // Generate Word Document (.docx) strictly following the uploaded image format
  const generateDocx = async () => {
    if (currentGradeEntries.length === 0) {
      alert(`Belum ada data jurnal untuk Kelas ${selectedGrade} di bulan ${selectedMonth} ${selectedYear}`);
      return;
    }

    try {
      const cellBorders = {
        top: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
        left: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
        right: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
      };

      const colWidths = [4, 13, 5, 11, 13, 24, 10, 8, 7, 5];

      const createHeaderCell = (text: string, widthPct: number) => new TableCell({
        width: { size: widthPct, type: WidthType.PERCENTAGE },
        children: [
          new Paragraph({
            children: [
              new TextRun({ 
                text, 
                bold: true, 
                size: 20, 
                font: "Times New Roman" 
              })
            ],
            alignment: AlignmentType.CENTER
          })
        ],
        borders: cellBorders,
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 120, bottom: 120, left: 80, right: 80 }
      });

      const createCell = (
        text: string, 
        widthPct: number, 
        align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT,
        bold: boolean = false
      ) => new TableCell({
        width: { size: widthPct, type: WidthType.PERCENTAGE },
        children: [
          new Paragraph({
            children: [
              new TextRun({ 
                text: text || '-', 
                size: 19, 
                font: "Times New Roman",
                bold
              })
            ],
            alignment: align
          })
        ],
        borders: cellBorders,
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 90, bottom: 90, left: 80, right: 80 }
      });

      // Table Rows
      const tableRows = [
        new TableRow({
          tableHeader: true,
          children: [
            createHeaderCell("No", colWidths[0]),
            createHeaderCell("Hari /\nTanggal", colWidths[1]),
            createHeaderCell("Jam", colWidths[2]),
            createHeaderCell("Kelas/Rombel", colWidths[3]),
            createHeaderCell("Mata\nPelajaran", colWidths[4]),
            createHeaderCell("Alur Tujuan\nPembelajaran", colWidths[5]),
            createHeaderCell("Kehadiran\n(H/S/I/A)", colWidths[6]),
            createHeaderCell("Metode\nPembelajaran", colWidths[7]),
            createHeaderCell("Catatan\n/\nRefleksi", colWidths[8]),
            createHeaderCell("Paraf", colWidths[9]),
          ]
        }),
        ...currentGradeEntries.map((entry, idx) => {
          let tanggalStr = entry.tanggal;
          try {
            const d = parseISO(entry.tanggal);
            tanggalStr = format(d, "EEEE, d\nMMM yyyy", { locale: localeId });
          } catch {
            tanggalStr = entry.tanggal;
          }

          let kehadiranStr = '-';
          if (entry.isHeb !== false) {
            const h = entry.kehadiran?.hadir ?? 0;
            const s = entry.kehadiran?.sakit ?? 0;
            const i = entry.kehadiran?.izin ?? 0;
            const a = entry.kehadiran?.alpa ?? 0;
            kehadiranStr = `H:${h} S:${s} I:${i}\nA:${a}`;
          }

          return new TableRow({
            children: [
              createCell((idx + 1).toString(), colWidths[0], AlignmentType.CENTER),
              createCell(tanggalStr, colWidths[1], AlignmentType.LEFT),
              createCell(entry.jamPelajaran || '-', colWidths[2], AlignmentType.CENTER),
              createCell(`Kelas ${entry.kelas || selectedGrade} / ${entry.rombel || '1'}`, colWidths[3], AlignmentType.CENTER),
              createCell(entry.mataPelajaran || 'Pendidikan Agama Islam dan Budi Pekerti', colWidths[4]),
              createCell(entry.atp || '-', colWidths[5]),
              createCell(kehadiranStr, colWidths[6], AlignmentType.CENTER),
              createCell(
                (entry.catatan && entry.catatan !== '-') 
                  ? entry.catatan 
                  : (entry.isHeb === false ? (entry.nonHebLabel || 'Non-HEB') : '-'), 
                colWidths[8], 
                AlignmentType.CENTER
              ),
              createCell("", colWidths[9], AlignmentType.CENTER), // Paraf
            ]
          });
        })
      ];

      const pageWidth = paperSize === 'F4' ? 18720 : 16838;
      const pageHeight = paperSize === 'F4' ? 12240 : 11906;

      const schoolName = profile?.namaSekolah || 'SDN SUKATINGGAL';
      // Location extracted from school name (e.g. "SUKATINGGAL")
      const locationName = schoolName.replace(/^(SDN|SD NEGERI|SD)\s*/i, '').trim() || 'SUKATINGGAL';
      const todayFormatted = format(new Date(), "d MMMM yyyy", { locale: localeId });

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
                top: 800,
                bottom: 800,
                left: 900,
                right: 900
              }
            }
          },
          children: [
            new Paragraph({
              children: [
                new TextRun({ 
                  text: "JURNAL MENGAJAR GURU", 
                  bold: true, 
                  size: 26, 
                  font: "Times New Roman" 
                })
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 60 }
            }),
            new Paragraph({
              children: [
                new TextRun({ 
                  text: `${schoolName.toUpperCase()} — KELAS ${selectedGrade}`, 
                  bold: true, 
                  size: 22, 
                  font: "Times New Roman" 
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 60 }
            }),
            new Paragraph({
              children: [
                new TextRun({ 
                  text: `Bulan: ${selectedMonth} ${selectedYear}`, 
                  size: 20, 
                  font: "Times New Roman" 
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 240 }
            }),

            // The main Journal Table
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: tableRows
            }),

            new Paragraph({ spacing: { before: 360, after: 100 }, children: [] }),

            // Signatures: 3 Columns (Pengawas PAI, Kepala Sekolah, Guru PAIBP)
            new Table({
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
                insideHorizontal: { style: BorderStyle.NONE },
                insideVertical: { style: BorderStyle.NONE },
              },
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: 33, type: WidthType.PERCENTAGE },
                      children: [
                        new Paragraph({ 
                          children: [new TextRun({ text: "Mengetahui,", bold: true, size: 20, font: "Times New Roman" })], 
                          alignment: AlignmentType.CENTER 
                        }),
                        new Paragraph({ 
                          children: [new TextRun({ text: "Pengawas PAI,", bold: true, size: 20, font: "Times New Roman" })], 
                          alignment: AlignmentType.CENTER 
                        })
                      ]
                    }),
                    new TableCell({
                      width: { size: 34, type: WidthType.PERCENTAGE },
                      children: [
                        new Paragraph({ 
                          children: [new TextRun({ text: "Mengetahui,", bold: true, size: 20, font: "Times New Roman" })], 
                          alignment: AlignmentType.CENTER 
                        }),
                        new Paragraph({ 
                          children: [new TextRun({ text: `Kepala Sekolah ${schoolName}`, bold: true, size: 20, font: "Times New Roman" })], 
                          alignment: AlignmentType.CENTER 
                        })
                      ]
                    }),
                    new TableCell({
                      width: { size: 33, type: WidthType.PERCENTAGE },
                      children: [
                        new Paragraph({ 
                          children: [new TextRun({ text: `${locationName.toUpperCase()}, ${todayFormatted}`, size: 20, font: "Times New Roman" })], 
                          alignment: AlignmentType.CENTER 
                        }),
                        new Paragraph({ 
                          children: [new TextRun({ text: "Guru PAIBP,", bold: true, size: 20, font: "Times New Roman" })], 
                          alignment: AlignmentType.CENTER 
                        })
                      ]
                    }),
                  ]
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ spacing: { before: 800 } })] }),
                    new TableCell({ children: [new Paragraph({ spacing: { before: 800 } })] }),
                    new TableCell({ children: [new Paragraph({ spacing: { before: 800 } })] })
                  ]
                }),
                new TableRow({
                  children: [
                    new TableCell({
                      children: [
                        new Paragraph({ 
                          children: [
                            new TextRun({ 
                              text: pengawasNama || 'Taufikolloh, S.Pd.I, M.Pd.', 
                              bold: true, 
                              underline: {}, 
                              size: 20, 
                              font: "Times New Roman" 
                            })
                          ], 
                          alignment: AlignmentType.CENTER 
                        }),
                        new Paragraph({ 
                          children: [
                            new TextRun({ 
                              text: `NIP. ${pengawasNip || '197303022007011007'}`, 
                              size: 19, 
                              font: "Times New Roman" 
                            })
                          ], 
                          alignment: AlignmentType.CENTER 
                        })
                      ]
                    }),
                    new TableCell({
                      children: [
                        new Paragraph({ 
                          children: [
                            new TextRun({ 
                              text: profile?.namaKepalaSekolah || 'Yuni Sri Rahayu, M.Pd.', 
                              bold: true, 
                              underline: {}, 
                              size: 20, 
                              font: "Times New Roman" 
                            })
                          ], 
                          alignment: AlignmentType.CENTER 
                        }),
                        new Paragraph({ 
                          children: [
                            new TextRun({ 
                              text: `NIP. ${profile?.nipKepalaSekolah || '198706162019032007'}`, 
                              size: 19, 
                              font: "Times New Roman" 
                            })
                          ], 
                          alignment: AlignmentType.CENTER 
                        })
                      ]
                    }),
                    new TableCell({
                      children: [
                        new Paragraph({ 
                          children: [
                            new TextRun({ 
                              text: profile?.namaGuru || 'Acep Miftah Hilah Ash-shidiq, S.Pd.', 
                              bold: true, 
                              underline: {}, 
                              size: 20, 
                              font: "Times New Roman" 
                            })
                          ], 
                          alignment: AlignmentType.CENTER 
                        }),
                        new Paragraph({ 
                          children: [
                            new TextRun({ 
                              text: `NIP. ${profile?.nip || '199602152025211094'}`, 
                              size: 19, 
                              font: "Times New Roman" 
                            })
                          ], 
                          alignment: AlignmentType.CENTER 
                        })
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
      alert('Terjadi kesalahan saat membuat dokumen Jurnal Word.');
    }
  };

  // Readiness diagnostics
  const isProfileComplete = Boolean(profile?.namaGuru && profile?.namaSekolah);
  const isStudentsComplete = totalEnrolled > 0;
  const isCalendarConfigured = Boolean(calendarData?.academicYear);
  const isProtaReady = protaAtpList.length > 0;
  const isProtaLocked = Boolean(lockedProtas[selectedGrade]);

  return (
    <Layout>
      <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-6">
        
        {/* Readiness Status Header Banner */}
        <div className="bg-gradient-to-r from-emerald-900 to-teal-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
                  <Sparkles size={13} />
                  Otomatisasi Jurnal Mengajar PAI BP
                </span>
                {isProtaLocked && (
                  <span className="bg-amber-500/20 text-amber-300 border border-amber-400/30 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
                    <Lock size={12} />
                    Prota Terkunci
                  </span>
                )}
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                Jurnal Mengajar Guru Kelas {selectedGrade}
              </h1>
              <p className="text-emerald-100/80 text-xs md:text-sm mt-1 max-w-2xl">
                Tanggal pembelajaran, status Non-HEB, Jam Pelajaran, Rombel, Alur Tujuan Pembelajaran (ATP), dan Kehadiran (H/S/I/A) dihitung secara <strong>otomatis & akurat</strong> berdasarkan Kalender Akademik, Jadwal, Daftar Siswa, dan Prota. Metode & Catatan dapat diedit langsung.
              </p>
            </div>

            {/* Quick Readiness Indicators */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className={`p-2.5 rounded-xl border ${isProfileComplete ? 'bg-emerald-800/60 border-emerald-500/40' : 'bg-rose-900/40 border-rose-500/40'}`}>
                <div className="text-[10px] text-slate-300 uppercase font-semibold">1. Profil Guru</div>
                <div className="font-bold flex items-center gap-1 mt-0.5">
                  {isProfileComplete ? <CheckCircle2 size={13} className="text-emerald-400" /> : <AlertCircle size={13} className="text-rose-400" />}
                  {isProfileComplete ? 'Lengkap' : 'Belum'}
                </div>
              </div>
              <div className={`p-2.5 rounded-xl border ${isStudentsComplete ? 'bg-emerald-800/60 border-emerald-500/40' : 'bg-rose-900/40 border-rose-500/40'}`}>
                <div className="text-[10px] text-slate-300 uppercase font-semibold">2. Siswa</div>
                <div className="font-bold flex items-center gap-1 mt-0.5">
                  {isStudentsComplete ? <CheckCircle2 size={13} className="text-emerald-400" /> : <AlertCircle size={13} className="text-rose-400" />}
                  {isStudentsComplete ? `${totalEnrolled} Siswa` : 'Kosong'}
                </div>
              </div>
              <div className={`p-2.5 rounded-xl border ${isCalendarConfigured ? 'bg-emerald-800/60 border-emerald-500/40' : 'bg-rose-900/40 border-rose-500/40'}`}>
                <div className="text-[10px] text-slate-300 uppercase font-semibold">3. Kalender</div>
                <div className="font-bold flex items-center gap-1 mt-0.5">
                  {isCalendarConfigured ? <CheckCircle2 size={13} className="text-emerald-400" /> : <AlertCircle size={13} className="text-rose-400" />}
                  {currentSchedule.day}
                </div>
              </div>
              <div className={`p-2.5 rounded-xl border ${isProtaReady ? 'bg-emerald-800/60 border-emerald-500/40' : 'bg-amber-900/40 border-amber-500/40'}`}>
                <div className="text-[10px] text-slate-300 uppercase font-semibold">4. Prota ATP</div>
                <div className="font-bold flex items-center gap-1 mt-0.5">
                  {isProtaReady ? <CheckCircle2 size={13} className="text-emerald-400" /> : <AlertCircle size={13} className="text-amber-400" />}
                  {isProtaLocked ? 'Terkunci' : (isProtaReady ? 'Tersimpan' : 'Belum')}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Controls & Action Bar */}
        <div className="bg-white/80 border border-slate-200/80 backdrop-blur-md rounded-3xl p-5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Class Grade Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 overflow-x-auto">
              {GRADES.map(grade => (
                <button
                  key={grade}
                  onClick={() => setSelectedGrade(grade)}
                  className={`px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
                    selectedGrade === grade 
                      ? 'bg-emerald-600 text-white shadow-sm' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Kelas {grade}
                </button>
              ))}
            </div>

            {/* Month & Year Selectors */}
            <div className="flex items-center gap-2">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white font-bold text-xs md:text-sm text-slate-800 cursor-pointer focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              >
                {MONTH_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white font-bold text-xs md:text-sm text-slate-800 cursor-pointer focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              >
                {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
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
                F4
              </button>
            </div>

            {/* Simpan Jurnal */}
            <button
              onClick={handleSaveData}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs md:text-sm font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
              title="Simpan Jurnal & Perubahan Manual"
            >
              {isSaving ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
              {isSaving ? 'Menyimpan...' : 'Simpan Jurnal'}
            </button>

            {/* Word Export */}
            <button
              onClick={generateDocx}
              disabled={currentGradeEntries.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs md:text-sm font-bold shadow-md transition-all cursor-pointer disabled:opacity-50"
              title="Unduh Dokumen Word Resmi"
            >
              <Download size={15} />
              Unduh Word ({paperSize})
            </button>
          </div>
        </div>

        {/* Info Pengawas PAI Bar */}
        <div className="bg-white/70 border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <FileText size={16} className="text-emerald-600" />
            <span>Pejabat Pengawas PAI (Tanda Tangan Kiri Dokumen):</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <input
              type="text"
              value={pengawasNama}
              onChange={(e) => setPengawasNama(e.target.value)}
              placeholder="Nama Pengawas PAI..."
              className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl font-medium w-full sm:w-60 focus:border-emerald-500 focus:ring-0"
              title="Nama Pengawas PAI"
            />
            <input
              type="text"
              value={pengawasNip}
              onChange={(e) => setPengawasNip(e.target.value)}
              placeholder="NIP Pengawas..."
              className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl font-medium w-full sm:w-44 focus:border-emerald-500 focus:ring-0"
              title="NIP Pengawas PAI"
            />
          </div>
        </div>

        {/* Main Document & Journal Table */}
        <div className="bg-white border border-slate-300 rounded-3xl p-6 md:p-8 shadow-xl space-y-6 overflow-hidden">
          {/* Header Title inside Document Preview */}
          <div className="text-center font-serif text-slate-900 border-b border-slate-200 pb-4">
            <h2 className="text-lg md:text-xl font-bold uppercase tracking-wide">
              JURNAL MENGAJAR GURU
            </h2>
            <h3 className="text-sm md:text-base font-bold uppercase mt-1">
              {profile?.namaSekolah || 'SDN SUKATINGGAL'} — KELAS {selectedGrade}
            </h3>
            <p className="text-xs md:text-sm font-medium text-slate-700 mt-1">
              Bulan: {selectedMonth} {selectedYear}
            </p>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs md:text-sm border-collapse border border-slate-900 font-serif text-slate-900">
              <thead>
                <tr className="bg-slate-50 font-bold text-center">
                  <th className="border border-slate-900 p-2.5 w-10">No</th>
                  <th className="border border-slate-900 p-2.5 w-32">Hari /<br />Tanggal</th>
                  <th className="border border-slate-900 p-2.5 w-14">Jam</th>
                  <th className="border border-slate-900 p-2.5 w-28">Kelas/Rombel</th>
                  <th className="border border-slate-900 p-2.5 w-36">Mata<br />Pelajaran</th>
                  <th className="border border-slate-900 p-2.5">Alur Tujuan<br />Pembelajaran</th>
                  <th className="border border-slate-900 p-2.5 w-28">Kehadiran<br />(H/S/I/A)</th>
                  <th className="border border-slate-900 p-2.5 w-24">Metode<br />Pembelajaran</th>
                  <th className="border border-slate-900 p-2.5 w-28">Catatan<br />/<br />Refleksi</th>
                  <th className="border border-slate-900 p-2.5 w-14">Paraf</th>
                </tr>
              </thead>
              <tbody>
                {currentGradeEntries.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="border border-slate-900 p-8 text-center text-slate-400 font-sans">
                      <Calendar size={36} className="mx-auto mb-2 text-slate-300" />
                      Tidak ada hari mengajar {currentSchedule.day} pada bulan {selectedMonth} {selectedYear}.
                    </td>
                  </tr>
                ) : (
                  currentGradeEntries.map((entry, idx) => {
                    let formattedDate = entry.tanggal;
                    try {
                      formattedDate = format(parseISO(entry.tanggal), "EEEE, d MMM yyyy", { locale: localeId });
                    } catch {
                      formattedDate = entry.tanggal;
                    }

                    const isNonHeb = entry.isHeb === false;

                    return (
                      <tr 
                        key={entry.id || entry.tanggal} 
                        className={`hover:bg-slate-50/70 transition-colors ${isNonHeb ? 'bg-amber-50/50' : ''}`}
                      >
                        {/* 1. No */}
                        <td className="border border-slate-900 p-2 text-center font-medium">
                          {idx + 1}
                        </td>

                        {/* 2. Hari / Tanggal */}
                        <td className="border border-slate-900 p-2">
                          <div className="font-semibold">{formattedDate}</div>
                          {isNonHeb && (
                            <span className="inline-block text-[10px] text-amber-700 bg-amber-100/80 px-1.5 py-0.5 rounded font-sans font-bold mt-0.5">
                              Non-HEB
                            </span>
                          )}
                        </td>

                        {/* 3. Jam */}
                        <td className="border border-slate-900 p-2 text-center font-medium">
                          {entry.jamPelajaran || '-'}
                        </td>

                        {/* 4. Kelas/Rombel */}
                        <td className="border border-slate-900 p-2 text-center font-medium">
                          Kelas {entry.kelas || selectedGrade} / {entry.rombel || defaultRombel}
                        </td>

                        {/* 5. Mata Pelajaran */}
                        <td className="border border-slate-900 p-2">
                          {entry.mataPelajaran || 'Pendidikan Agama Islam dan Budi Pekerti'}
                        </td>

                        {/* 6. Alur Tujuan Pembelajaran */}
                        <td className="border border-slate-900 p-2 leading-relaxed">
                          <span className={isNonHeb ? 'font-semibold text-amber-900' : 'text-slate-800'}>
                            {entry.atp || '-'}
                          </span>
                        </td>

                        {/* 7. Kehadiran (H/S/I/A) */}
                        <td className="border border-slate-900 p-2 text-center font-semibold">
                          {isNonHeb ? (
                            <span className="text-slate-400 font-normal">-</span>
                          ) : (
                            <div className="text-xs font-mono">
                              <div>H:{entry.kehadiran?.hadir ?? 0} S:{entry.kehadiran?.sakit ?? 0}</div>
                              <div>I:{entry.kehadiran?.izin ?? 0} A:{entry.kehadiran?.alpa ?? 0}</div>
                            </div>
                          )}
                        </td>

                        {/* 8. Metode Pembelajaran (Manual Editable Inline) */}
                        <td className="border border-slate-900 p-1.5 text-center">
                          <input
                            type="text"
                            value={entry.metode ?? 'RPM'}
                            onChange={(e) => handleInlineChange(entry.tanggal, 'metode', e.target.value)}
                            className="w-full text-center p-1 border border-transparent hover:border-slate-300 focus:border-emerald-500 rounded bg-transparent text-xs font-sans font-medium focus:bg-white"
                            placeholder="RPM"
                            title="Edit manual metode pembelajaran"
                          />
                        </td>

                        {/* 9. Catatan / Refleksi (Manual Editable Inline) */}
                        <td className="border border-slate-900 p-1.5 text-center">
                          <input
                            type="text"
                            value={entry.catatan ?? (isNonHeb ? (entry.nonHebLabel || 'Non-HEB') : '-')}
                            onChange={(e) => handleInlineChange(entry.tanggal, 'catatan', e.target.value)}
                            className={`w-full text-center p-1 border border-transparent hover:border-slate-300 focus:border-emerald-500 rounded bg-transparent text-xs font-sans font-medium focus:bg-white ${
                              isNonHeb ? 'font-semibold text-amber-900 bg-amber-50/70' : ''
                            }`}
                            placeholder={isNonHeb ? (entry.nonHebLabel || 'Non-HEB') : "-"}
                            title="Edit manual catatan/refleksi"
                          />
                        </td>

                        {/* 10. Paraf */}
                        <td className="border border-slate-900 p-2 text-center text-slate-400 font-sans">
                          -
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Signatures matching Sample Document */}
          <div className="pt-8 grid grid-cols-1 md:grid-cols-3 gap-6 font-serif text-slate-900 text-center">
            {/* Left: Pengawas PAI */}
            <div className="space-y-16">
              <div>
                <p className="font-bold">Mengetahui,</p>
                <p className="font-bold">Pengawas PAI,</p>
              </div>
              <div>
                <p className="font-bold underline text-sm md:text-base">
                  {pengawasNama || 'Taufikolloh, S.Pd.I, M.Pd.'}
                </p>
                <p className="text-xs md:text-sm">
                  NIP. {pengawasNip || '197303022007011007'}
                </p>
              </div>
            </div>

            {/* Middle: Kepala Sekolah */}
            <div className="space-y-16">
              <div>
                <p className="font-bold">Mengetahui,</p>
                <p className="font-bold">Kepala Sekolah {profile?.namaSekolah || 'SDN SUKATINGGAL'}</p>
              </div>
              <div>
                <p className="font-bold underline text-sm md:text-base">
                  {profile?.namaKepalaSekolah || 'Yuni Sri Rahayu, M.Pd.'}
                </p>
                <p className="text-xs md:text-sm">
                  NIP. {profile?.nipKepalaSekolah || '198706162019032007'}
                </p>
              </div>
            </div>

            {/* Right: Guru PAIBP */}
            <div className="space-y-16">
              <div>
                <p className="font-medium text-xs md:text-sm">
                  {(profile?.namaSekolah?.replace(/^(SDN|SD NEGERI|SD)\s*/i, '') || 'SUKATINGGAL').toUpperCase()}, {format(new Date(), "d MMMM yyyy", { locale: localeId })}
                </p>
                <p className="font-bold">Guru PAIBP,</p>
              </div>
              <div>
                <p className="font-bold underline text-sm md:text-base">
                  {profile?.namaGuru || 'Acep Miftah Hilah Ash-shidiq, S.Pd.'}
                </p>
                <p className="text-xs md:text-sm">
                  NIP. {profile?.nip || '199602152025211094'}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Action Hint */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200 text-xs text-slate-500 font-sans">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Kolom <strong>Metode Pembelajaran</strong> & <strong>Catatan / Refleksi</strong> dapat diketik langsung pada tabel di atas.
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsFormOpen(true)}
                className="text-emerald-700 hover:text-emerald-800 font-bold underline flex items-center gap-1"
              >
                <Plus size={14} />
                Tambah / Edit Tanggal Tertentu
              </button>
            </div>
          </div>
        </div>

        {/* Modal: Tambah / Edit Entri Khusus */}
        {isFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900">
                  {editingId ? 'Edit Entri Jurnal' : 'Tambah Entri Jurnal Manual'}
                </h3>
                <button
                  type="button"
                  onClick={() => { setIsFormOpen(false); setEditingId(null); }}
                  className="p-1 rounded-xl text-slate-400 hover:text-slate-600"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tanggal Pembelajaran</label>
                  <input
                    type="date"
                    value={tanggal}
                    onChange={(e) => setTanggal(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-800"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Jam Pelajaran</label>
                    <input
                      type="text"
                      value={jamPelajaran}
                      onChange={(e) => setJamPelajaran(e.target.value)}
                      placeholder="Contoh: 1 atau 3, 4, 5"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Rombel</label>
                    <input
                      type="text"
                      value={rombel}
                      onChange={(e) => setRombel(e.target.value)}
                      placeholder="1"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Alur Tujuan Pembelajaran (ATP)</label>
                  <textarea
                    value={atp}
                    onChange={(e) => setAtp(e.target.value)}
                    rows={3}
                    placeholder="Masukkan deskripsi ATP..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Kehadiran Siswa</label>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="border border-slate-200 rounded-xl p-1.5 text-center">
                      <span className="block text-[10px] text-emerald-700 font-bold">Hadir</span>
                      <input
                        type="number"
                        min="0"
                        value={hadir}
                        onChange={(e) => setHadir(parseInt(e.target.value) || 0)}
                        className="w-full text-center font-bold text-slate-800 border-0 focus:ring-0 p-0"
                      />
                    </div>
                    <div className="border border-slate-200 rounded-xl p-1.5 text-center">
                      <span className="block text-[10px] text-amber-700 font-bold">Sakit</span>
                      <input
                        type="number"
                        min="0"
                        value={sakit}
                        onChange={(e) => setSakit(parseInt(e.target.value) || 0)}
                        className="w-full text-center font-bold text-slate-800 border-0 focus:ring-0 p-0"
                      />
                    </div>
                    <div className="border border-slate-200 rounded-xl p-1.5 text-center">
                      <span className="block text-[10px] text-blue-700 font-bold">Izin</span>
                      <input
                        type="number"
                        min="0"
                        value={izin}
                        onChange={(e) => setIzin(parseInt(e.target.value) || 0)}
                        className="w-full text-center font-bold text-slate-800 border-0 focus:ring-0 p-0"
                      />
                    </div>
                    <div className="border border-slate-200 rounded-xl p-1.5 text-center">
                      <span className="block text-[10px] text-rose-700 font-bold">Alpa</span>
                      <input
                        type="number"
                        min="0"
                        value={alpa}
                        onChange={(e) => setAlpa(parseInt(e.target.value) || 0)}
                        className="w-full text-center font-bold text-slate-800 border-0 focus:ring-0 p-0"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Metode Pembelajaran</label>
                    <input
                      type="text"
                      value={metode}
                      onChange={(e) => setMetode(e.target.value)}
                      placeholder="RPM / PBL / dsb"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Catatan / Refleksi</label>
                    <input
                      type="text"
                      value={catatan}
                      onChange={(e) => setCatatan(e.target.value)}
                      placeholder="-"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setIsFormOpen(false); setEditingId(null); }}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveFormEntry}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors shadow-md"
                >
                  Simpan Entri
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirmId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 animate-scale-up">
              <h3 className="text-base font-bold text-slate-900 mb-2">Hapus Entri Jurnal?</h3>
              <p className="text-slate-600 text-xs mb-4">
                Apakah Anda yakin ingin menghapus entri ini? Tindakan ini tidak dapat dibatalkan.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirmId(null)}
                  className="flex-1 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs"
                >
                  Batal
                </button>
                <button
                  onClick={() => handleDeleteEntryConfirm(showDeleteConfirmId)}
                  className="flex-1 py-2 bg-rose-600 text-white font-bold rounded-xl text-xs"
                >
                  Hapus
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast Notification */}
        {showToast && (
          <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs md:text-sm font-semibold border border-slate-800 animate-fade-in">
            <Check className="text-emerald-400" size={17} />
            {showToast}
          </div>
        )}

      </div>
    </Layout>
  );
}
