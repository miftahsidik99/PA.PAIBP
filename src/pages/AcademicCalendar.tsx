import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, Calendar, Edit2, X, Download } from 'lucide-react';
import { useStore } from '../store/useStore';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  startOfMonth, endOfMonth, eachDayOfInterval, format, getDay, 
  addMonths, isSameMonth, parse, isSameDay, parseISO
} from 'date-fns';
import { id } from 'date-fns/locale';
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, AlignmentType, PageOrientation, VerticalAlign } from 'docx';
import { saveAs } from 'file-saver';
import { NATIONAL_HOLIDAYS } from '../data/nationalHolidays';

// Default Colors
const COLOR_OPTIONS = [
  { label: 'Merah (Libur)', value: 'bg-rose-500 text-white', isEffective: false },
  { label: 'Biru Tua (MPLS)', value: 'bg-blue-700 text-white', isEffective: false },
  { label: 'Kuning (Ujian)', value: 'bg-yellow-500 text-white', isEffective: false },
  { label: 'Ungu (Koreksi/Rapor)', value: 'bg-purple-600 text-white', isEffective: false },
  { label: 'Hijau (Awal Puasa/Raya)', value: 'bg-emerald-600 text-white', isEffective: false },
  { label: 'Pink (Libur Khusus)', value: 'bg-pink-500 text-white', isEffective: false },
  { label: 'Biru Muda (Efektif Khusus)', value: 'bg-sky-500 text-white', isEffective: true },
];

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
          
          // Pre-fill if only 1 day selected
          if (dates.length === 1) {
            const dateStr = format(dates[0], 'yyyy-MM-dd');
            if (events1to5[dateStr] || events6[dateStr]) {
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
        const docRef = doc(db, 'academic_calendar', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setAcademicYear(data.academicYear || '2026/2027');
          setWeeklyDays(data.weeklyDays || 5);
          setEvents1to5(data.events1to5 || {});
          setEvents6(data.events6 || {});
          setCalendarData(data as any);
        } else {
          // Initialize defaults
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
      await setDoc(doc(db, 'academic_calendar', user.uid), data);
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
        const redColor = COLOR_OPTIONS.find(c => c.value.includes('rose')) || COLOR_OPTIONS[0];
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
    { title: 'Semester 1 (Ganjil)', months: Array.from({length: 6}).map((_, i) => addMonths(startDate, i)) },
    { title: 'Semester 2 (Genap)', months: Array.from({length: 6}).map((_, i) => addMonths(startDate, i + 6)) }
  ];

  const getDayLabelColor = (dayIndex: number) => {
    if (dayIndex === 0) return 'text-red-500'; // Minggu
    if (dayIndex === 6 && weeklyDays === 5) return 'text-red-500'; // Sabtu libur
    return 'text-slate-700';
  };

  const isDayOff = (dayIndex: number) => {
    if (dayIndex === 0) return true;
    if (dayIndex === 6 && weeklyDays === 5) return true;
    return false;
  };

  // DOCX Generation
  const generateDoc = async () => {
    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
            size: { orientation: PageOrientation.LANDSCAPE }
          }
        },
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: "ANALISIS HARI EFEKTIF BELAJAR", bold: true, size: 28 })
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 }
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Tahun Pelajaran : ${academicYear}`, size: 24 }),
            ],
            spacing: { after: 400 }
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Kalender: ${activeTab === 'kelas1_5' ? 'Kelas 1 - 5' : 'Kelas 6'}`, size: 24 }),
            ],
            spacing: { after: 400 }
          }),
          ...generateTableForSemester(0, "Semester 1 (Ganjil)"),
          new Paragraph({ text: "", spacing: { before: 400, after: 400 } }),
          ...generateTableForSemester(1, "Semester 2 (Genap)")
        ]
      }]
    });

    Packer.toBlob(doc).then((blob) => {
      saveAs(blob, `Analisis_Hari_Efektif_${academicYear.replace('/', '-')}_${activeTab}.docx`);
    });
  };

  const generateTableForSemester = (semIndex: number, title: string) => {
    const months = semesters[semIndex].months;
    const rows = [
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Bulan", bold: true })], alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Jml Minggu", bold: true })], alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Minggu Efektif", bold: true })], alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Minggu Tidak Efektif", bold: true })], alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Keterangan", bold: true })], alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER })
        ]
      })
    ];

    let totalMinggu = 0;
    let totalEfektif = 0;
    let totalTidakEfektif = 0;

    months.forEach(month => {
      const start = startOfMonth(month);
      const end = endOfMonth(month);
      const days = eachDayOfInterval({ start, end });
      
      // A simple heuristic for week counts: count Mondays
      const mondays = days.filter(d => getDay(d) === 1);
      const jmlMinggu = mondays.length || 4; // Fallback if a short month has 0/few mondays
      
      let hariEfektifCount = 0;
      days.forEach(d => {
        const dStr = format(d, 'yyyy-MM-dd');
        const dayIdx = getDay(d);
        if (!isDayOff(dayIdx)) {
          const ev = activeEvents[dStr];
          if (!ev || ev.isEffective) {
            hariEfektifCount++;
          }
        }
      });
      
      // Calculate effective weeks based on effective days (assuming 5 or 6 days/week)
      const mEfektif = Math.floor(hariEfektifCount / weeklyDays);
      const mTidakEfektif = Math.max(0, jmlMinggu - mEfektif);

      totalMinggu += jmlMinggu;
      totalEfektif += mEfektif;
      totalTidakEfektif += mTidakEfektif;

      // Extract unique labels for keterangan
      const ket = Array.from(new Set(
        days.map(d => activeEvents[format(d, 'yyyy-MM-dd')]?.label).filter(Boolean)
      )).join(', ');

      rows.push(new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: format(month, 'MMMM yyyy', {locale: id}) })] }),
          new TableCell({ children: [new Paragraph({ text: jmlMinggu.toString(), alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: mEfektif.toString(), alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: mTidakEfektif.toString(), alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: ket || "-" })] }),
        ]
      }));
    });

    // Total Row
    rows.push(new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Jumlah", bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: totalMinggu.toString(), bold: true })], alignment: AlignmentType.CENTER })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: totalEfektif.toString(), bold: true })], alignment: AlignmentType.CENTER })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: totalTidakEfektif.toString(), bold: true })], alignment: AlignmentType.CENTER })] }),
        new TableCell({ children: [new Paragraph({ text: "-" })] }),
      ]
    }));

    return [
      new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 24 })], spacing: { after: 200 } }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: rows
      })
    ];
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">Memuat...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-8 max-w-7xl mx-auto min-h-full flex flex-col space-y-6">
        {/* Header */}
        <div className="bg-white/60 backdrop-blur-xl border border-white p-6 rounded-3xl shadow-xl shadow-slate-200/50 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
              <Calendar className="text-emerald-500" size={32} />
              Kalender Akademik
            </h2>
            <p className="text-slate-500 mt-1 font-medium">Atur hari efektif dan hari libur untuk keperluan analisis dan program tahunan.</p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={handleApplyNationalHolidays}
              className="px-5 py-2.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-700 font-bold hover:bg-sky-100 transition-all shadow-sm flex items-center gap-2"
            >
              <Calendar size={18} />
              Terapkan Libur Nasional
            </button>
            <button
              onClick={generateDoc}
              className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2"
            >
              <Download size={18} />
              Export DOCX
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-all shadow-md shadow-emerald-200 flex items-center gap-2 disabled:opacity-50"
            >
              <Save size={18} />
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </div>

        {/* Settings Bar */}
        <div className="bg-white/60 backdrop-blur-xl border border-white p-6 rounded-3xl shadow-xl shadow-slate-200/50 flex flex-col sm:flex-row gap-6">
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Tahun Ajaran</label>
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-2 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="2024/2025">2024/2025</option>
              <option value="2025/2026">2025/2026</option>
              <option value="2026/2027">2026/2027</option>
              <option value="2027/2028">2027/2028</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Hari Efektif Mingguan</label>
            <select
              value={weeklyDays}
              onChange={(e) => setWeeklyDays(Number(e.target.value) as 5|6)}
              className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-2 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value={5}>5 Hari (Senin - Jumat)</option>
              <option value={6}>6 Hari (Senin - Sabtu)</option>
            </select>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-white/40 p-1 rounded-2xl w-full sm:w-max mx-auto shadow-sm border border-white/60">
          <button
            onClick={() => setActiveTab('kelas1_5')}
            className={`flex-1 sm:px-8 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'kelas1_5' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Kelas 1 - 5
          </button>
          <button
            onClick={() => setActiveTab('kelas6')}
            className={`flex-1 sm:px-8 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'kelas6' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Kelas 6
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="space-y-12">
          {semesters.map((sem, sIdx) => (
            <div key={sIdx}>
              <h3 className="text-xl font-bold text-slate-700 mb-6 border-b-2 border-emerald-500/20 pb-2 inline-block">{sem.title}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {sem.months.map((month, mIdx) => {
                  const start = startOfMonth(month);
                  const end = endOfMonth(month);
                  const days = eachDayOfInterval({ start, end });
                  const startingDayIndex = getDay(start); // 0 = Sunday
                  
                  // Blanks before first day
                  const blanks = Array.from({ length: startingDayIndex });
                  
                  return (
                    <div key={mIdx} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                      <div className="bg-blue-600 text-white text-center py-2 font-bold">
                        {format(month, 'MMMM yyyy', {locale: id})}
                      </div>
                      <div className="p-3">
                        <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold mb-2">
                          {['Mg', 'Sn', 'Sl', 'Rb', 'Km', 'Jm', 'Sb'].map((d, i) => (
                            <div key={i} className={getDayLabelColor(i)}>{d}</div>
                          ))}
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                          {blanks.map((_, i) => (
                            <div key={`blank-${i}`} className="h-8"></div>
                          ))}
                          {days.map((date) => {
                            const dateStr = format(date, 'yyyy-MM-dd');
                            const dayIndex = getDay(date);
                            const ev = activeEvents[dateStr];
                            const isOff = isDayOff(dayIndex);
                            
                            let baseClass = "h-8 flex items-center justify-center text-sm font-medium rounded-md cursor-pointer transition-colors select-none ";
                            
                            if (ev) {
                              baseClass += ev.color;
                            } else if (isOff) {
                              baseClass += "text-red-500 hover:bg-slate-100";
                            } else {
                              baseClass += "text-slate-700 hover:bg-slate-100";
                            }

                            // Selection visual feedback
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
                              baseClass += " ring-2 ring-emerald-500 ring-offset-1 ring-offset-white opacity-80";
                            }

                            return (
                              <button
                                key={dateStr}
                                onMouseDown={() => handleDateMouseDown(date)}
                                onMouseEnter={() => handleDateMouseEnter(date)}
                                className={baseClass}
                              >
                                {date.getDate()}
                              </button>
                            );
                          })}
                        </div>
                        
                        {/* Legend / Keterangan per bulan */}
                        <div className="mt-4 text-xs space-y-1">
                          {Array.from(new Set(
                            days.map(d => activeEvents[format(d, 'yyyy-MM-dd')]?.label).filter(Boolean)
                          )).map((lbl, i) => {
                            // Find the event color mapping for this label
                            const sampleDate = days.find(d => activeEvents[format(d, 'yyyy-MM-dd')]?.label === lbl);
                            const ev = sampleDate ? activeEvents[format(sampleDate, 'yyyy-MM-dd')] : null;
                            const dotColor = ev ? ev.color.split(' ')[0].replace('bg-', 'text-') : 'text-slate-400';
                            
                            return (
                              <div key={i} className="flex items-start text-slate-600 font-medium">
                                <span className={`mr-1.5 ${dotColor}`}>●</span>
                                <span>{lbl}</span>
                              </div>
                            );
                          })}
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-800">
                  {selectedDates.length === 1 
                    ? format(selectedDates[0], 'EEEE, d MMMM yyyy', {locale: id})
                    : `${selectedDates.length} Hari Terpilih`}
                </h3>
                <button onClick={() => setSelectedDates([])} className="text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Keterangan</label>
                  <input
                    type="text"
                    value={eventLabel}
                    onChange={(e) => setEventLabel(e.target.value)}
                    placeholder="Contoh: Libur Semester"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Warna Tanda</label>
                  <div className="grid grid-cols-1 gap-2">
                    {COLOR_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setEventColor(opt.value)}
                        className={`text-left px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${eventColor === opt.value ? 'bg-slate-100 ring-2 ring-slate-300' : 'hover:bg-slate-50'}`}
                      >
                        <div className={`w-4 h-4 rounded-full ${opt.value.split(' ')[0]}`}></div>
                        <span className="text-slate-700">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="pt-4 flex gap-3">
                  <button
                    onClick={handleDeleteEvent}
                    className="flex-1 py-2.5 rounded-xl font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                  >
                    Hapus
                  </button>
                  <button
                    onClick={handleSaveEvent}
                    disabled={!eventLabel}
                    className="flex-[2] py-2.5 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-50"
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
