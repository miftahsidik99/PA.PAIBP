import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { motion, AnimatePresence } from 'motion/react';
import { Save, Calendar, X, Download, Sparkles, Check } from 'lucide-react';
import { useStore } from '../store/useStore';
import { 
  startOfMonth, endOfMonth, eachDayOfInterval, format, getDay, 
  addMonths, isSameDay, parseISO 
} from 'date-fns';
import { id } from 'date-fns/locale';
import { 
  Document, Packer, Paragraph, Table, TableCell, TableRow, 
  TextRun, WidthType, AlignmentType, PageOrientation, VerticalAlign, 
  BorderStyle 
} from 'docx';
import { saveAs } from 'file-saver';
import { NATIONAL_HOLIDAYS } from '../data/nationalHolidays';

// Color Palette with Tailwind and Hex values for UI & DOCX export
export const COLOR_OPTIONS = [
  { label: 'Merah (Libur / Hari Besar)', value: 'bg-rose-500 text-white', dotBg: 'bg-rose-500', hex: 'F43F5E', isEffective: false },
  { label: 'Biru Tua (MPLS / Kegiatan)', value: 'bg-blue-700 text-white', dotBg: 'bg-blue-700', hex: '1D4ED8', isEffective: false },
  { label: 'Kuning / Oranye (Ujian / PTS / PAS)', value: 'bg-amber-500 text-white', dotBg: 'bg-amber-500', hex: 'F59E0B', isEffective: false },
  { label: 'Ungu (Koreksi / Rapor / PSAT)', value: 'bg-purple-600 text-white', dotBg: 'bg-purple-600', hex: '9333EA', isEffective: false },
  { label: 'Hijau (Awal Puasa / Pesantren Ramadhan)', value: 'bg-emerald-600 text-white', dotBg: 'bg-emerald-600', hex: '059669', isEffective: false },
  { label: 'Pink (Libur Khusus / Semester)', value: 'bg-pink-500 text-white', dotBg: 'bg-pink-500', hex: 'EC4899', isEffective: false },
  { label: 'Biru Muda (Efektif Khusus / Proyek)', value: 'bg-sky-500 text-white', dotBg: 'bg-sky-500', hex: '0EA5E9', isEffective: true },
];

const COLOR_HEX_MAP: Record<string, string> = {
  'bg-rose-500': 'F43F5E',
  'bg-red-500': 'EF4444',
  'bg-red-600': 'DC2626',
  'bg-blue-700': '1D4ED8',
  'bg-blue-600': '2563EB',
  'bg-blue-500': '3B82F6',
  'bg-yellow-500': 'EAB308',
  'bg-amber-500': 'F59E0B',
  'bg-orange-500': 'F97316',
  'bg-purple-600': '9333EA',
  'bg-purple-500': 'A855F7',
  'bg-emerald-600': '059669',
  'bg-emerald-500': '10B981',
  'bg-green-600': '16A34A',
  'bg-green-500': '22C55E',
  'bg-pink-500': 'EC4899',
  'bg-pink-600': 'DB2777',
  'bg-sky-500': '0EA5E9',
  'bg-sky-600': '0284C7',
};

const getHexColor = (colorStr: string): string => {
  if (!colorStr) return 'F43F5E';
  const match = colorStr.split(' ').find(cls => cls.startsWith('bg-'));
  if (match && COLOR_HEX_MAP[match]) return COLOR_HEX_MAP[match];
  if (colorStr.includes('rose') || colorStr.includes('red')) return 'F43F5E';
  if (colorStr.includes('blue')) return '2563EB';
  if (colorStr.includes('emerald') || colorStr.includes('green')) return '059669';
  if (colorStr.includes('yellow') || colorStr.includes('amber') || colorStr.includes('orange')) return 'F59E0B';
  if (colorStr.includes('purple')) return '9333EA';
  if (colorStr.includes('pink')) return 'EC4899';
  if (colorStr.includes('sky')) return '0EA5E9';
  return 'F43F5E';
};

const getDotBgClass = (colorStr: string): string => {
  if (!colorStr) return 'bg-rose-500';
  const match = colorStr.split(' ').find(cls => cls.startsWith('bg-'));
  return match || 'bg-rose-500';
};

interface MonthAgenda {
  label: string;
  color: string;
  dotBg: string;
  dateRangeText: string;
  startDate: Date;
  endDate: Date;
}

// Group contiguous dates with identical label and color into distinct agendas
const getMonthAgendas = (
  month: Date, 
  events: Record<string, { label: string; color: string; isEffective: boolean }>
): MonthAgenda[] => {
  const start = startOfMonth(month);
  const end = endOfMonth(month);
  const days = eachDayOfInterval({ start, end });
  const agendas: MonthAgenda[] = [];
  const visitedDateStrs = new Set<string>();

  days.forEach(day => {
    const dateStr = format(day, 'yyyy-MM-dd');
    if (visitedDateStrs.has(dateStr)) return;

    const ev = events[dateStr];
    if (!ev || !ev.label) return;

    // Contiguous search backwards (up to 45 days)
    let runStart = day;
    let currentBack = day;
    while (true) {
      const prevDay = new Date(currentBack);
      prevDay.setDate(prevDay.getDate() - 1);
      const prevStr = format(prevDay, 'yyyy-MM-dd');
      const prevEv = events[prevStr];
      if (prevEv && prevEv.label === ev.label && prevEv.color === ev.color) {
        runStart = prevDay;
        currentBack = prevDay;
      } else {
        break;
      }
    }

    // Contiguous search forwards (up to 45 days)
    let runEnd = day;
    let currentForward = day;
    while (true) {
      const nextDay = new Date(currentForward);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextStr = format(nextDay, 'yyyy-MM-dd');
      const nextEv = events[nextStr];
      if (nextEv && nextEv.label === ev.label && nextEv.color === ev.color) {
        runEnd = nextDay;
        currentForward = nextDay;
      } else {
        break;
      }
    }

    // Mark all days in this month that are part of this run as visited
    days.forEach(d => {
      if (d >= runStart && d <= runEnd) {
        visitedDateStrs.add(format(d, 'yyyy-MM-dd'));
      }
    });

    // Format date range text
    let dateRangeText = '';
    const sameYear = runStart.getFullYear() === runEnd.getFullYear();
    const sameMonth = sameYear && runStart.getMonth() === runEnd.getMonth();
    const sameDay = sameMonth && runStart.getDate() === runEnd.getDate();

    if (sameDay) {
      dateRangeText = format(runStart, 'd MMM yyyy', { locale: id });
    } else if (sameMonth) {
      dateRangeText = `${format(runStart, 'd')} - ${format(runEnd, 'd MMM yyyy', { locale: id })}`;
    } else if (sameYear) {
      dateRangeText = `${format(runStart, 'd MMM')} - ${format(runEnd, 'd MMM yyyy', { locale: id })}`;
    } else {
      dateRangeText = `${format(runStart, 'd MMM yyyy', { locale: id })} - ${format(runEnd, 'd MMM yyyy', { locale: id })}`;
    }

    agendas.push({
      label: ev.label,
      color: ev.color,
      dotBg: getDotBgClass(ev.color),
      dateRangeText,
      startDate: runStart,
      endDate: runEnd
    });
  });

  return agendas;
};

export default function AcademicCalendar() {
  const { user, profile, calendarData, setCalendarData } = useStore();
  
  const [academicYear, setAcademicYear] = useState('2026/2027');
  const [weeklyDays, setWeeklyDays] = useState<5 | 6>(5);
  const [activeTab, setActiveTab] = useState<'kelas1_5' | 'kelas6'>('kelas1_5');
  
  const [events1to5, setEvents1to5] = useState<Record<string, {label: string, color: string, isEffective: boolean}>>({});
  const [events6, setEvents6] = useState<Record<string, {label: string, color: string, isEffective: boolean}>>({});
  
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [eventLabel, setEventLabel] = useState('');
  const [eventColor, setEventColor] = useState(COLOR_OPTIONS[0].value);

  // Drag Selection State
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<Date | null>(null);
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);

  useEffect(() => {
    const handleMouseUp = () => {
      if (isSelecting) {
        setIsSelecting(false);
        if (selectionStart && hoveredDate) {
          const dates = eachDayOfInterval({
            start: selectionStart < hoveredDate ? selectionStart : hoveredDate,
            end: selectionStart > hoveredDate ? selectionStart : hoveredDate
          });
          setSelectedDates(dates);
          
          if (dates.length === 1) {
            const dateStr = format(dates[0], 'yyyy-MM-dd');
            const activeEvents = activeTab === 'kelas1_5' ? events1to5 : events6;
            if (activeEvents[dateStr]) {
              setEventLabel(activeEvents[dateStr].label);
              setEventColor(activeEvents[dateStr].color);
            } else {
              setEventLabel('');
              setEventColor(COLOR_OPTIONS[0].value);
            }
          } else {
            setEventLabel('');
            setEventColor(COLOR_OPTIONS[0].value);
          }
        }
      }
    };
    
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [isSelecting, selectionStart, hoveredDate, activeTab, events1to5, events6]);

  useEffect(() => {
    const fetchCalendar = async () => {
      if (!user) return;
      try {
        if (calendarData) {
          setAcademicYear(calendarData.academicYear || '2026/2027');
          setWeeklyDays(calendarData.weeklyDays || 5);
          setEvents1to5(calendarData.events1to5 || {});
          setEvents6(calendarData.events6 || {});
        } else {
          const startYear = parseInt(profile?.tahunPelajaran?.split('/')[0] || '2026');
          setAcademicYear(`${startYear}/${startYear + 1}`);
        }
      } catch (error) {
        console.error("Error fetching calendar:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchCalendar();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const data = {
        academicYear,
        weeklyDays,
        events1to5,
        events6
      };
      
      setCalendarData(data);
      alert('Kalender akademik berhasil disimpan!');
    } catch (error) {
      console.error("Error saving calendar:", error);
      alert('Gagal menyimpan kalender');
    } finally {
      setSaving(false);
    }
  };

  const activeEvents = activeTab === 'kelas1_5' ? events1to5 : events6;
  const setActiveEvents = activeTab === 'kelas1_5' ? setEvents1to5 : setEvents6;

  const handleApplyNationalHolidays = () => {
    const startYear = parseInt(academicYear.split('/')[0] || '2026');
    const endYear = startYear + 1;
    
    const startDate = new Date(startYear, 6, 1);
    const endDate = new Date(endYear, 5, 30);

    const newEvents = { ...activeEvents };
    
    Object.entries(NATIONAL_HOLIDAYS).forEach(([dateStr, label]) => {
      const d = parseISO(dateStr);
      if (d >= startDate && d <= endDate) {
        const redColor = COLOR_OPTIONS[0];
        if (!newEvents[dateStr]) {
          newEvents[dateStr] = {
            label: label,
            color: redColor.value,
            isEffective: false
          };
        }
      }
    });

    setActiveEvents(newEvents);
    alert(`Libur nasional untuk tahun ajaran ${academicYear} berhasil diterapkan pada ${activeTab === 'kelas1_5' ? 'Kelas 1 - 5' : 'Kelas 6'}. Klik "Simpan" untuk menyimpan perubahan.`);
  };

  const handleSaveEvent = () => {
    if (selectedDates.length === 0) return;
    const selectedColorOption = COLOR_OPTIONS.find(c => c.value === eventColor) || COLOR_OPTIONS[0];
    
    setActiveEvents(prev => {
      const newEvents = { ...prev };
      selectedDates.forEach(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        newEvents[dateStr] = {
          label: eventLabel,
          color: eventColor,
          isEffective: selectedColorOption.isEffective
        };
      });
      return newEvents;
    });
    setSelectedDates([]);
  };

  const handleDeleteEvent = () => {
    if (selectedDates.length === 0) return;
    setActiveEvents(prev => {
      const newEvents = { ...prev };
      selectedDates.forEach(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        delete newEvents[dateStr];
      });
      return newEvents;
    });
    setSelectedDates([]);
  };

  const handleDateMouseDown = (date: Date) => {
    setSelectionStart(date);
    setHoveredDate(date);
    setIsSelecting(true);
  };

  const handleDateMouseEnter = (date: Date) => {
    if (isSelecting) {
      setHoveredDate(date);
    }
  };

  // Generate Months (July -> June)
  const startYear = parseInt(academicYear.split('/')[0] || '2026');
  const startDate = new Date(startYear, 6, 1); // July 1st
  
  const semesters = [
    { 
      title: 'SEMESTER 1 (Ganjil)', 
      rangeText: `Juli - Desember ${startYear}`,
      months: Array.from({length: 6}).map((_, i) => addMonths(startDate, i)) 
    },
    { 
      title: 'SEMESTER 2 (Genap)', 
      rangeText: `Januari - Juni ${startYear + 1}`,
      months: Array.from({length: 6}).map((_, i) => addMonths(startDate, i + 6)) 
    }
  ];

  // Helper to determine day off
  // Monday-first indexing: 0: Sn, 1: Sl, 2: Rb, 3: Km, 4: Jm, 5: Sb, 6: Mg
  const isDayOffMondayFirst = (dayIndex: number) => {
    if (dayIndex === 6) return true; // Minggu
    if (dayIndex === 5 && weeklyDays === 5) return true; // Sabtu saat 5 hari kerja
    return false;
  };

  // DOCX Generation matching Image 2 with exact calendar colors
  const generateDoc = async () => {
    const schoolName = profile?.namaSekolah || 'SDN SUKATINGGAL';
    const teacherName = profile?.namaGuru || 'Nama Guru';
    const teacherNip = profile?.nip || '-';

    const buildMonthDocxCell = (month: Date) => {
      const start = startOfMonth(month);
      const end = endOfMonth(month);
      const days = eachDayOfInterval({ start, end });
      const startingDayIndex = (getDay(start) + 6) % 7; // Monday-first

      const monthName = format(month, 'MMMM yyyy', { locale: id });
      const agendas = getMonthAgendas(month, activeEvents);

      // Mini Calendar Table Rows
      const dayHeaders = ['Sn', 'Sl', 'Rb', 'Km', 'Jm', 'Sb', 'Mg'];
      const miniTableRows: TableRow[] = [];

      // Header row
      miniTableRows.push(
        new TableRow({
          children: dayHeaders.map((dh, idx) => 
            new TableCell({
              width: { size: 14, type: WidthType.PERCENTAGE },
              shading: { fill: 'F1F5F9' },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ 
                      text: dh, 
                      bold: true, 
                      size: 14, 
                      color: isDayOffMondayFirst(idx) ? 'EF4444' : '334155' 
                    })
                  ],
                  alignment: AlignmentType.CENTER
                })
              ],
              verticalAlign: VerticalAlign.CENTER
            })
          )
        })
      );

      // Date cells
      let currentWeekCells: TableCell[] = [];
      
      // Empty blanks before 1st day
      for (let i = 0; i < startingDayIndex; i++) {
        currentWeekCells.push(
          new TableCell({
            width: { size: 14, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ text: "", alignment: AlignmentType.CENTER })]
          })
        );
      }

      // Add each day
      days.forEach(d => {
        const dateStr = format(d, 'yyyy-MM-dd');
        const dayIdx = (getDay(d) + 6) % 7;
        const ev = activeEvents[dateStr];
        const isOff = isDayOffMondayFirst(dayIdx);

        let cellShading: any = undefined;
        let textColor = isOff ? 'EF4444' : '1E293B';
        let isBold = false;

        if (ev) {
          const hex = getHexColor(ev.color);
          cellShading = { fill: hex };
          textColor = 'FFFFFF';
          isBold = true;
        }

        currentWeekCells.push(
          new TableCell({
            width: { size: 14, type: WidthType.PERCENTAGE },
            shading: cellShading,
            children: [
              new Paragraph({
                children: [
                  new TextRun({ 
                    text: d.getDate().toString(), 
                    bold: isBold, 
                    size: 14, 
                    color: textColor 
                  })
                ],
                alignment: AlignmentType.CENTER
              })
            ],
            verticalAlign: VerticalAlign.CENTER
          })
        );

        if (currentWeekCells.length === 7) {
          miniTableRows.push(new TableRow({ children: currentWeekCells }));
          currentWeekCells = [];
        }
      });

      // Fill remaining blanks in last week
      if (currentWeekCells.length > 0) {
        while (currentWeekCells.length < 7) {
          currentWeekCells.push(
            new TableCell({
              width: { size: 14, type: WidthType.PERCENTAGE },
              children: [new Paragraph({ text: "", alignment: AlignmentType.CENTER })]
            })
          );
        }
        miniTableRows.push(new TableRow({ children: currentWeekCells }));
      }

      const miniCalendarTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: miniTableRows
      });

      // Agenda Paragraphs below calendar
      const agendaParagraphs: Paragraph[] = [
        new Paragraph({
          children: [
            new TextRun({ text: "Keterangan / Hari Libur:", bold: true, size: 15, color: "1E293B" })
          ],
          spacing: { before: 100, after: 40 }
        })
      ];

      if (agendas.length === 0) {
        agendaParagraphs.push(
          new Paragraph({
            children: [
              new TextRun({ text: "Tidak ada agenda libur/khusus", italics: true, size: 14, color: "94A3B8" })
            ],
            spacing: { after: 60 }
          })
        );
      } else {
        agendas.forEach((ag, idx) => {
          agendaParagraphs.push(
            new Paragraph({
              children: [
                new TextRun({ text: `${idx + 1}. `, bold: true, size: 14, color: "334155" }),
                new TextRun({ text: `${ag.dateRangeText}: `, bold: true, size: 14, color: "0F172A" }),
                new TextRun({ text: ag.label, size: 14, color: "334155" })
              ],
              spacing: { after: 30 }
            })
          );
        });
      }

      return new TableCell({
        width: { size: 33, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
          left: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
          right: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" }
        },
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: monthName.toUpperCase(), bold: true, size: 16, color: "1E3A8A" })
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 80, after: 80 }
          }),
          miniCalendarTable,
          ...agendaParagraphs
        ],
        verticalAlign: VerticalAlign.TOP
      });
    };

    const buildSemesterGridTable = (months: Date[]) => {
      // 3 columns x 2 rows
      const row1Months = months.slice(0, 3);
      const row2Months = months.slice(3, 6);

      return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: row1Months.map(m => buildMonthDocxCell(m))
          }),
          new TableRow({
            children: row2Months.map(m => buildMonthDocxCell(m))
          })
        ]
      });
    };

    const doc = new Document({
      sections: [
        // Section 1: Semester 1
        {
          properties: {
            page: {
              margin: { top: 720, right: 720, bottom: 720, left: 720 },
              size: { orientation: PageOrientation.PORTRAIT }
            }
          },
          children: [
            new Paragraph({
              children: [
                new TextRun({ 
                  text: `Kalender Akademik Guru Mata Pelajaran PAIBP ${schoolName.toUpperCase()}`, 
                  bold: true, 
                  size: 24, 
                  color: "0F172A" 
                })
              ],
              spacing: { after: 60 }
            }),
            new Paragraph({
              children: [
                new TextRun({ text: `Tahun Pelajaran ${academicYear}`, bold: true, size: 20, color: "334155" })
              ],
              spacing: { after: 120 }
            }),
            new Paragraph({
              children: [
                new TextRun({ text: `Nama Guru GPAI  : ${teacherName}`, size: 18, color: "1E293B" }),
              ],
              spacing: { after: 40 }
            }),
            new Paragraph({
              children: [
                new TextRun({ text: `NIP                       : ${teacherNip}`, size: 18, color: "1E293B" }),
              ],
              spacing: { after: 160 }
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "SEMESTER 1", bold: true, size: 22, color: "1E3A8A" })
              ],
              spacing: { after: 120 }
            }),
            buildSemesterGridTable(semesters[0].months)
          ]
        },
        // Section 2: Semester 2
        {
          properties: {
            page: {
              margin: { top: 720, right: 720, bottom: 720, left: 720 },
              size: { orientation: PageOrientation.PORTRAIT }
            }
          },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: "SEMESTER 2", bold: true, size: 22, color: "1E3A8A" })
              ],
              spacing: { after: 120 }
            }),
            buildSemesterGridTable(semesters[1].months)
          ]
        }
      ]
    });

    Packer.toBlob(doc).then((blob) => {
      saveAs(blob, `Kalender_Akademik_${academicYear.replace('/', '-')}_${activeTab}.docx`);
    });
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full text-slate-500 font-medium">Memuat Kalender...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 sm:p-8 max-w-7xl mx-auto min-h-full flex flex-col space-y-6">
        {/* Header Bar */}
        <div className="bg-white/70 backdrop-blur-xl border border-white p-6 rounded-3xl shadow-xl shadow-slate-200/50 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100 shadow-sm">
                <Calendar size={28} />
              </div>
              <span>Kalender Akademik</span>
            </h2>
            <p className="text-slate-500 mt-1 text-sm font-medium">
              Atur hari efektif, libur nasional, dan agenda khusus pembelajaran dengan visual warna interaktif.
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={handleApplyNationalHolidays}
              className="px-4 py-2.5 rounded-2xl bg-sky-50 border border-sky-200 text-sky-700 font-bold hover:bg-sky-100 transition-all shadow-xs flex items-center gap-2 text-xs"
            >
              <Sparkles size={16} />
              Terapkan Libur Nasional
            </button>
            <button
              onClick={generateDoc}
              className="px-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-all shadow-xs flex items-center gap-2 text-xs"
            >
              <Download size={16} />
              Unduh Dokumen Word (.docx)
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 rounded-2xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-all shadow-md shadow-emerald-200 flex items-center gap-2 disabled:opacity-50 text-xs"
            >
              <Save size={16} />
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </div>

        {/* Settings Bar & Tabs */}
        <div className="bg-white/70 backdrop-blur-xl border border-white p-5 rounded-3xl shadow-xl shadow-slate-200/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tahun Ajaran</label>
              <select
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-3.5 py-1.5 text-xs text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="2024/2025">2024/2025</option>
                <option value="2025/2026">2025/2026</option>
                <option value="2026/2027">2026/2027</option>
                <option value="2027/2028">2027/2028</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Hari Efektif Mingguan</label>
              <select
                value={weeklyDays}
                onChange={(e) => setWeeklyDays(Number(e.target.value) as 5|6)}
                className="bg-white border border-slate-200 rounded-xl px-3.5 py-1.5 text-xs text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={5}>5 Hari (Senin - Jumat)</option>
                <option value={6}>6 Hari (Senin - Sabtu)</option>
              </select>
            </div>
          </div>

          {/* Level Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-2xl w-full sm:w-auto border border-slate-200/60">
            <button
              onClick={() => setActiveTab('kelas1_5')}
              className={`flex-1 sm:px-6 py-2 rounded-xl font-bold text-xs transition-all ${
                activeTab === 'kelas1_5' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Kelas 1 - 5
            </button>
            <button
              onClick={() => setActiveTab('kelas6')}
              className={`flex-1 sm:px-6 py-2 rounded-xl font-bold text-xs transition-all ${
                activeTab === 'kelas6' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Kelas 6
            </button>
          </div>
        </div>

        {/* Semesters Container */}
        <div className="space-y-10">
          {semesters.map((sem, sIdx) => (
            <div key={sIdx} className="bg-white/80 backdrop-blur-xl border border-white rounded-3xl p-6 shadow-xl shadow-slate-200/40">
              {/* Semester Card Header */}
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                <h3 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2.5">
                  <Calendar className="text-blue-600" size={20} />
                  <span>{sem.title} • {sem.rangeText}</span>
                </h3>
                <span className="bg-blue-50 text-blue-600 border border-blue-100 text-xs font-semibold px-3 py-1 rounded-full shadow-xs">
                  6 Bulan
                </span>
              </div>

              {/* 3 Columns Grid for 6 Months */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sem.months.map((month, mIdx) => {
                  const start = startOfMonth(month);
                  const end = endOfMonth(month);
                  const days = eachDayOfInterval({ start, end });
                  const startingDayIndex = (getDay(start) + 6) % 7; // Monday-first
                  
                  const blanks = Array.from({ length: startingDayIndex });
                  const agendas = getMonthAgendas(month, activeEvents);
                  
                  return (
                    <div 
                      key={mIdx} 
                      className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col justify-between hover:border-blue-200 transition-colors"
                    >
                      {/* Month Header */}
                      <div className="bg-slate-50/80 border-b border-slate-100 py-2.5 px-4 text-center font-bold text-xs sm:text-sm text-blue-900 tracking-wider uppercase">
                        {format(month, 'MMMM yyyy', { locale: id })}
                      </div>

                      {/* Month Grid Body */}
                      <div className="p-3.5 flex-1 flex flex-col justify-between">
                        <div>
                          {/* Day Labels (Monday-first: Sn, Sl, Rb, Km, Jm, Sb, Mg) */}
                          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold mb-2 text-slate-500">
                            {['Sn', 'Sl', 'Rb', 'Km', 'Jm', 'Sb', 'Mg'].map((d, i) => (
                              <div 
                                key={i} 
                                className={isDayOffMondayFirst(i) ? 'text-rose-500' : 'text-slate-500'}
                              >
                                {d}
                              </div>
                            ))}
                          </div>

                          {/* Day Numbers Grid */}
                          <div className="grid grid-cols-7 gap-1 mb-4">
                            {blanks.map((_, i) => (
                              <div key={`blank-${i}`} className="h-7 sm:h-8"></div>
                            ))}
                            {days.map((date) => {
                              const dateStr = format(date, 'yyyy-MM-dd');
                              const dayIndex = (getDay(date) + 6) % 7;
                              const ev = activeEvents[dateStr];
                              const isOff = isDayOffMondayFirst(dayIndex);
                              
                              let baseClass = "h-7 sm:h-8 flex items-center justify-center text-xs font-semibold rounded-lg cursor-pointer transition-all select-none ";
                              
                              if (ev) {
                                baseClass += `${ev.color} shadow-xs font-bold`;
                              } else if (isOff) {
                                baseClass += "text-rose-500 hover:bg-slate-100 font-semibold";
                              } else {
                                baseClass += "text-slate-700 hover:bg-slate-100 font-medium";
                              }

                              // Selection Feedback
                              let isSelected = false;
                              if (isSelecting && selectionStart && hoveredDate) {
                                const minDate = selectionStart < hoveredDate ? selectionStart : hoveredDate;
                                const maxDate = selectionStart > hoveredDate ? selectionStart : hoveredDate;
                                if (date >= minDate && date <= maxDate) {
                                  isSelected = true;
                                }
                              } else if (selectedDates.length > 0) {
                                isSelected = selectedDates.some(d => isSameDay(d, date));
                              }
                              
                              if (isSelected) {
                                baseClass += " ring-2 ring-blue-500 ring-offset-1 ring-offset-white opacity-85 scale-105";
                              }

                              return (
                                <button
                                  key={dateStr}
                                  type="button"
                                  onMouseDown={() => handleDateMouseDown(date)}
                                  onMouseEnter={() => handleDateMouseEnter(date)}
                                  className={baseClass}
                                  title={ev ? `${dateStr}: ${ev.label}` : dateStr}
                                >
                                  {date.getDate()}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        
                        {/* Keterangan / Hari Libur Section below mini-calendar */}
                        <div className="border-t border-slate-100 pt-3 mt-auto">
                          <div className="flex items-center justify-between text-[11px] mb-2 font-bold text-slate-700">
                            <span>Keterangan / Hari Libur:</span>
                            <span className="text-slate-400 font-normal">{agendas.length} agenda</span>
                          </div>

                          {agendas.length === 0 ? (
                            <p className="text-[11px] text-slate-400 italic text-center py-2">
                              Tidak ada agenda libur/khusus
                            </p>
                          ) : (
                            <div className="space-y-1.5 text-[11px]">
                              {agendas.map((ag, i) => (
                                <div key={i} className="flex items-start gap-1.5 text-slate-600 leading-tight">
                                  <span className="font-semibold text-slate-400 shrink-0">{i + 1}.</span>
                                  <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${ag.dotBg}`} />
                                  <span className="text-slate-700">
                                    <strong className="text-slate-800 font-semibold">{ag.dateRangeText}:</strong> {ag.label}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Date Modal */}
      <AnimatePresence>
        {selectedDates.length > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full border border-slate-100"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-bold text-slate-800">
                  {selectedDates.length === 1 
                    ? format(selectedDates[0], 'EEEE, d MMMM yyyy', {locale: id})
                    : `${selectedDates.length} Hari Terpilih`}
                </h3>
                <button 
                  onClick={() => setSelectedDates([])} 
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Keterangan Agenda / Libur
                  </label>
                  <input
                    type="text"
                    value={eventLabel}
                    onChange={(e) => setEventLabel(e.target.value)}
                    placeholder="Contoh: Libur Akhir Semester"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                </div>
                
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Warna Penanda
                  </label>
                  <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto pr-1">
                    {COLOR_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setEventColor(opt.value)}
                        className={`text-left px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center justify-between ${
                          eventColor === opt.value 
                            ? 'bg-blue-50 border border-blue-200 text-blue-800' 
                            : 'hover:bg-slate-50 border border-transparent text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`w-3.5 h-3.5 rounded-full ${opt.dotBg}`}></div>
                          <span>{opt.label}</span>
                        </div>
                        {eventColor === opt.value && <Check size={14} className="text-blue-600" />}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="pt-3 flex gap-2.5">
                  <button
                    type="button"
                    onClick={handleDeleteEvent}
                    className="flex-1 py-2.5 rounded-xl font-bold text-xs text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors"
                  >
                    Hapus
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEvent}
                    disabled={!eventLabel.trim()}
                    className="flex-[2] py-2.5 rounded-xl font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-md shadow-blue-200"
                  >
                    Simpan Tanggal
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
