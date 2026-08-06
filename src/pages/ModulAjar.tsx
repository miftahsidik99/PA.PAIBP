import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { Download, CheckSquare, RefreshCw, History } from 'lucide-react';
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, AlignmentType, BorderStyle, ShadingType } from 'docx';
import { saveAs } from 'file-saver';
import { eachDayOfInterval, format, getDay } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { generateModulAjarClient } from '../lib/geminiClient';

export default function ModulAjar() {
    const { 
    user, profile, calendarData, geminiApiKey, 
    schedules: storeSchedules, savedProtas: storeProtas, 
    generatedModulAtps: storeGeneratedAtps = {}, markAtpAsGenerated,
    atpBatches, addAtpBatch, addModulAjarHistory
  } = useStore();
  const navigate = useNavigate();


  const [loading, setLoading] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState<number>(1);
  const [selectedAtpIndices, setSelectedAtpIndices] = useState<number[]>([]);

  const getRandomColor = () => {
    const h = Math.floor(Math.random() * 360);
    return `hsla(${h}, 70%, 90%, 0.6)`;
  };



  const handleGradeChange = (grade: number) => {
    setSelectedGrade(grade);
    setSelectedAtpIndices([]);
  };

  const toggleAtp = (idx: number) => {
    setSelectedAtpIndices(prev => 
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx].sort((a, b) => a - b)
    );
  };

  const syncATP = async () => {
    setLoading(true);
    setTimeout(() => {
      setSelectedAtpIndices([]);
      setLoading(false);
      alert('Data ATP berhasil disinkronkan dari Prota!');
    }, 500);
  };

  const getEffectiveDates = () => {
    if (!storeSchedules[selectedGrade] || !storeSchedules[selectedGrade].day) return [];
    
    const dayMap: Record<string, number> = {
      'Minggu': 0, 'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6
    };
    
    const dayIndex = dayMap[storeSchedules[selectedGrade].day];
    
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

  const protaList = storeProtas[selectedGrade] || [];
  const effectiveDates = getEffectiveDates();
  
  // Flatten ATPs with dates
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

  const [isGeneratingModul, setIsGeneratingModul] = useState(false);
  const [showKarakteristikModal, setShowKarakteristikModal] = useState(false);
  const [selectedKarakteristik, setSelectedKarakteristik] = useState('Reguler/Tipikal');

  const karakteristikOptions = [
    'Reguler/Tipikal',
    'Hambatan Belajar',
    'Pencapaian Tinggi (Cerdas Istimewa)',
    'Heterogen (Campuran)'
  ];

  const handleGenerateClick = () => {
    if (selectedAtpIndices.length === 0) return;
    setShowKarakteristikModal(true);
  };

  const generateModulAjar = async () => {
    if (selectedAtpIndices.length === 0) return;
    setShowKarakteristikModal(false);
    
    if (!geminiApiKey) {
      alert("API Key Gemini belum diatur. Silakan atur di menu 'Pengaturan API' di sidebar kiri.");
      return;
    }

    const selectedAtpData = selectedAtpIndices.map(idx => allAtps[idx]);
    const selectedAtpStrings = selectedAtpData.map(d => d.atp);

    const jpPerWeek = storeSchedules[selectedGrade]?.jp || 4;
    const totalJp = selectedAtpIndices.length * jpPerWeek;
    const pertemuan = selectedAtpIndices.length;
    setIsGeneratingModul(true);
    
    try {
      const data = await generateModulAjarClient(
        selectedAtpStrings,
        selectedGrade,
        totalJp,
        pertemuan,
        profile,
        selectedKarakteristik,
        geminiApiKey
      );
      
      const createHeading = (text: string, level: number = 1) => {
        return new Paragraph({
          children: [new TextRun({ text, bold: true, size: level === 1 ? 32 : 24, color: "10B981" })],
          spacing: { before: 400, after: 200 }
        });
      };

      const createSubHeading = (text: string) => {
        return new Paragraph({
          children: [new TextRun({ text, bold: true, size: 20, color: "374151" })],
          spacing: { before: 200, after: 100 }
        });
      };

      const createNormalParagraph = (text: string, forceJustify: boolean = true) => {
        if (!text) return [new Paragraph({ children: [] })];
        return text.split('\n').filter(p => p.trim()).map(p => {
          const trimmed = p.trim();
          // Check for numbered list (1., 2., etc) or lettered list (a., b., etc) or bullets
          const isList = /^[0-9]+[\.\)]\s+|^[a-z][\.\)]\s+|^[\-\•\-\*]\s+/i.test(trimmed);
          
          return new Paragraph({
            children: [new TextRun({ text: trimmed })],
            alignment: forceJustify ? AlignmentType.JUSTIFIED : undefined,
            indent: isList ? { left: 450, hanging: 450 } : undefined,
            spacing: { after: 150 }
          });
        });
      };

      const createListParagraph = (text: string, index: number) => {
        return new Paragraph({
          children: [new TextRun({ text: `${index}. ${text}` })],
          alignment: AlignmentType.JUSTIFIED,
          indent: { left: 450, hanging: 450 },
          spacing: { after: 100 }
        });
      };

      const headerShading = { fill: "F3F4F6", type: ShadingType.CLEAR, color: "auto" };
      const cellBorders = {
        top: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
        left: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
        right: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
      };

      const createTableRow = (label: string, content: any, justify: boolean = false) => {
        let cells: Paragraph[] = [];
        if (Array.isArray(content)) {
          cells = content.flatMap(c => createNormalParagraph(c, justify));
        } else if (typeof content === 'string') {
          cells = createNormalParagraph(content, justify);
        } else if (content instanceof Paragraph) {
          cells = [content];
        } else {
          cells = [new Paragraph({ text: String(content || '') })];
        }

        return new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 18 })] })],
              width: { size: 30, type: WidthType.PERCENTAGE },
              shading: headerShading,
              borders: cellBorders,
              margins: { top: 100, bottom: 100, left: 100, right: 100 }
            }),
            new TableCell({
              children: cells,
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
            // COVER
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.cover?.judul || "MODUL AJAR PAI DAN BUDI PEKERTI SD BERBASIS PERMENDIKDASMEN 13 TAHUN 2025 DAN KURIKULUM BERBASIS CINTA (KBC)", bold: true, size: 36 })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 150, after: 300 }, children: [new TextRun({ text: data.cover?.penegasan || "Disusun dengan Semangat Kurikulum Berbasis Cinta (KBC)", size: 22, italics: true, color: "059669" })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 600, after: 600 }, children: [new TextRun({ text: "[ LOGO SEKOLAH ]", size: 20 })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Nama Guru: ${profile?.namaGuru || '[DIISI OLEH GURU]'}`, size: 22 })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Sekolah: ${profile?.namaSekolah || '[DIISI OLEH GURU]'}`, size: 22 })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Tahun Pelajaran: ${profile?.tahunPelajaran || '2024/2025'}`, size: 22 })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Fase: ${selectedGrade <= 2 ? 'A' : (selectedGrade <= 4 ? 'B' : 'C')}`, size: 22 })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Kelas: ${selectedGrade}`, size: 22 })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Jadwal hari : ${storeSchedules[selectedGrade]?.day || '-'}`, size: 22, color: "FF0000" })] }),
            
            // IDENTITAS MODUL
            createHeading("I. IDENTITAS MODUL"),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                createTableRow("Elemen", data.identitas?.elemen || '-'),
                createTableRow("Materi", data.identitas?.materi || '-'),
                createTableRow("Alokasi Waktu", `${totalJp} JP (${pertemuan} Pertemuan) x 35 Menit`),
                ...selectedAtpData.map((atpItem, idx) => {
                  const dateStr = atpItem.date ? format(atpItem.date, "EEEE, d MMMM yyyy", { locale: localeId }) : '-';
                  const labelText = `Tanggal HEB ${jpPerWeek} JP Ke-${idx + 1}`;
                  return new TableRow({
                    children: [
                      new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: labelText, bold: true, size: 18, color: "FF0000" })] })],
                        width: { size: 30, type: WidthType.PERCENTAGE },
                        shading: headerShading,
                        borders: cellBorders,
                        margins: { top: 100, bottom: 100, left: 100, right: 100 }
                      }),
                      new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: dateStr, color: "FF0000" })] })],
                        width: { size: 70, type: WidthType.PERCENTAGE },
                        borders: cellBorders,
                        margins: { top: 100, bottom: 100, left: 100, right: 100 }
                      })
                    ]
                  });
                }),
                createTableRow("Model Pembelajaran", data.identitas?.model || '-'),
                createTableRow("Pendekatan", data.identitas?.pendekatan || '-'),
                createTableRow("Metode", data.identitas?.metode || '-'),
                createTableRow("Media", data.identitas?.media || '-'),
                createTableRow("Sumber Belajar", data.identitas?.sumber || '-'),
                createTableRow("Karakteristik Siswa", data.identitas?.karakteristik || '-'),
                createTableRow("Target Peserta Didik", data.identitas?.target || '-'),
                createTableRow("Sarana Prasarana", data.identitas?.sarana || '-'),
                createTableRow("Integrasi KBC", data.identitas?.integrasiKbc || 'Terintegrasi Kurikulum Berbasis Cinta'),
                createTableRow("Tema KBC Utama", data.identitas?.temaKbcUtama || 'Cinta Allah & Rasul, Cinta Diri & Sesama'),
                createTableRow("Nilai Karakter KBC", data.identitas?.nilaiKarakter || 'Kasih Sayang, Tanggung Jawab, Adab, Empati'),
              ]
            }),

            // CAPAIAN PEMBELAJARAN
            createHeading("II. CAPAIAN PEMBELAJARAN & KETERKAITAN KBC"),
            createSubHeading("Capaian Pembelajaran (CP)"),
            ...createNormalParagraph(typeof data.cp === 'object' ? data.cp?.deskripsi : (data.cp || data.komponenInti?.cp || '')),
            createSubHeading("Keterkaitan CP dengan Tema Kurikulum Berbasis Cinta (KBC)"),
            ...createNormalParagraph(typeof data.cp === 'object' ? data.cp?.keterkaitanKbc : (data.komponenInti?.cpKbc || 'CP ini dikembangkan untuk menumbuhkan rasa cinta Allah, Rasul, ilmu, lingkungan, sesama, dan tanah air.')),

            // KOMPONEN INTI
            createHeading("III. KOMPONEN INTI"),
            createSubHeading("Tujuan Pembelajaran"),
            ...createNormalParagraph(data.komponenInti?.tp || ''),
            createSubHeading("Alur Tujuan Pembelajaran"),
            ...createNormalParagraph(data.komponenInti?.atp || ''),
            createSubHeading("Pemahaman Bermakna"),
            ...createNormalParagraph(data.komponenInti?.pemahamanBermakna || ''),
            createSubHeading("Pertanyaan Pemantik"),
            ...(data.komponenInti?.pertanyaanPemantik || []).map((p: string, i: number) => createListParagraph(p, i + 1)),

            // PEMETAAN INTEGRASI KBC
            createHeading("IV. PEMETAAN INTEGRASI KURIKULUM BERBASIS CINTA (KBC)"),
            ...(Array.isArray(data.pemetaanKbc) && data.pemetaanKbc.length > 0 ? [
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "TEMA KBC", bold: true })] })], shading: headerShading, borders: cellBorders }),
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "INTEGRASI MATERI / KEGIATAN", bold: true })] })], shading: headerShading, borders: cellBorders }),
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "PEMBIASAAN KARAKTER", bold: true })] })], shading: headerShading, borders: cellBorders }),
                    ]
                  }),
                  ...data.pemetaanKbc.map((item: any) => new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph({ text: item.tema || '-' })], borders: cellBorders }),
                      new TableCell({ children: [new Paragraph({ text: item.materiKegiatan || '-' })], borders: cellBorders }),
                      new TableCell({ children: [new Paragraph({ text: item.pembiasaanKarakter || '-' })], borders: cellBorders }),
                    ]
                  }))
                ]
              })
            ] : createNormalParagraph("Terintegrasi secara konsisten pada seluruh aktivitas pembelajaran dan pembiasaan adab siswa.")),

            // DIAGNOSTIK
            createHeading("V. ASESMEN DIAGNOSTIK"),
            ...createNormalParagraph(data.diagnostik?.deskripsi || ''),
            createSubHeading("Instrumen Diagnostik Kognitif"),
            ...createNormalParagraph(data.diagnostik?.instrumenKognitif || ''),
            createSubHeading("Instrumen Diagnostik Non-Kognitif (Adab, Kebiasaan & Kesiapan Sikap)"),
            ...createNormalParagraph(data.diagnostik?.instrumenNonKognitif || ''),

            // PEMBELAJARAN MENDALAM
            createHeading("VI. PEMBELAJARAN MENDALAM (DEEP LEARNING 8,3,3,4)"),
            ...createNormalParagraph(data.pembelajaranMendalam || ''),

            // LANGKAH PEMBELAJARAN
            createHeading("VII. LANGKAH-LANGKAH PEMBELAJARAN"),
            ...(data.langkahPembelajaran || []).map((p: any) => ([
              createSubHeading(`Pertemuan Ke-${p.pertemuan} (${p.waktu || '2 JP x 35 Menit'})`),
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                  createTableRow("Pendahuluan (Doa, Adab, Apersepsi, KBC)", p.pendahuluan, true),
                  createTableRow("Kegiatan Inti (Aktivitas Guru & Siswa + KBC)", p.inti, true),
                  createTableRow("Penutup (Refleksi, Pembiasaan, Salam)", p.penutup, true),
                ]
              })
            ])).flat(),

            // ASESMEN
            createHeading("VIII. ASESMEN & INSTRUMEN PENILAIAN"),
            ...createNormalParagraph(`Jenis Asesmen: ${data.asesmen?.jenis || '-'}`),
            ...createNormalParagraph(data.asesmen?.deskripsi || ''),
            createSubHeading("Instrumen Penilaian"),
            ...createNormalParagraph(data.asesmen?.instrumen || ''),
            createSubHeading("Rubrik Penilaian Sikap, Pengetahuan & Keterampilan KBC"),
            ...createNormalParagraph(data.asesmen?.rubrik || ''),

            // PENGAYAAN & REMEDIAL
            createHeading("IX. PENGAYAAN & REMEDIAL"),
            createSubHeading("Pengayaan (Praktik Nilai Cinta Nyata)"),
            ...createNormalParagraph(data.pengayaanRemedial?.pengayaan || ''),
            createSubHeading("Remedial (Pembiasaan & Perbaikan Sikap)"),
            ...createNormalParagraph(data.pengayaanRemedial?.remedial || ''),

            // REFLEKSI
            createHeading("X. REFLEKSI GURU DAN PESERTA DIDIK"),
            createSubHeading("Refleksi Guru (Keterlaksanaan & Integrasi KBC)"),
            ...(data.refleksi?.guru || []).map((p: string, i: number) => createListParagraph(p, i + 1)),
            createSubHeading("Refleksi Peserta Didik (Pengalaman Belajar & Nilai Cinta)"),
            ...(data.refleksi?.siswa || []).map((p: string, i: number) => createListParagraph(p, i + 1)),

            // LKPD
            createHeading("XI. LEMBAR KERJA PESERTA DIDIK (LKPD) BERBASIS CINTA"),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                createTableRow("Judul LKPD", data.lkpd?.judul || '', true),
                createTableRow("Tujuan", data.lkpd?.tujuan || '', true),
                createTableRow("Petunjuk", data.lkpd?.petunjuk || '', true),
                createTableRow("Alat & Bahan", data.lkpd?.alat || '', true),
                createTableRow("Langkah Kerja", data.lkpd?.langkah || '', true),
                createTableRow("Tugas Praktik", data.lkpd?.tugas || '', true),
                createTableRow("Soal-soal", data.lkpd?.soal || '', true),
                createTableRow("Ruang Jawaban & Komitmen Perilaku Cinta", data.lkpd?.ruangJawaban || 'Tersedia ruang refleksi & komitmen perilaku cinta siswa.', true),
              ]
            }),

            // BACAAN DLL
            createHeading("XII. BAHAN BACAAN, GLOSARIUM & DAFTAR PUSTAKA"),
            createSubHeading("Bahan Bacaan Guru"),
            ...createNormalParagraph(data.bacaanGlosariumPustaka?.bacaanGuru || ''),
            createSubHeading("Bahan Bacaan Peserta Didik"),
            ...createNormalParagraph(data.bacaanGlosariumPustaka?.bacaanSiswa || ''),
            createSubHeading("Glosarium (Termasuk Istilah KBC)"),
            ...createNormalParagraph(data.bacaanGlosariumPustaka?.glosarium || ''),
            createSubHeading("Daftar Pustaka"),
            ...createNormalParagraph(data.bacaanGlosariumPustaka?.pustaka || ''),

            // LAMPIRAN
            createHeading("XIII. LAMPIRAN MODUL"),
            ...createNormalParagraph(data.lampiran || ''),

            // TABEL VALIDASI
            createHeading("XIV. TABEL VALIDASI OTOMATIS MODUL"),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "ASPEK VALIDASI", bold: true })] })], shading: headerShading, borders: cellBorders }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "STATUS", bold: true })] })], shading: headerShading, borders: cellBorders }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "CATATAN / PENGUATAN KBC", bold: true })] })], shading: headerShading, borders: cellBorders }),
                  ]
                }),
                ...(data.validasi || []).map((v: any) => new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ text: v.aspek || '-' })], borders: cellBorders }),
                    new TableCell({ children: [new Paragraph({ text: v.status || '-' })], borders: cellBorders }),
                    new TableCell({ children: [new Paragraph({ text: v.catatan || '-' })], borders: cellBorders }),
                  ]
                }))
              ]
            }),

            // RINGKASAN OUTPUT KBC
            createHeading("XV. RINGKASAN OUTPUT & PENEGASAN KBC"),
            createSubHeading("Daftar Komponen Terpenuhi:"),
            ...(data.outputSummary?.komponenDipenuhi || [
              "Cover & Identitas Modul Berbasis KBC",
              "Capaian Pembelajaran & Keterkaitan KBC",
              "Pemetaan Integrasi KBC",
              "Diagnostik & Deep Learning 8,3,3,4",
              "Langkah Pembelajaran Rinci + Insersi KBC",
              "Asesmen Formatif/Sumatif & Rubrik Sikap KBC",
              "LKPD, Refleksi, Lampiran & Validasi Otomatis"
            ]).map((k: string, i: number) => createListParagraph(k, i + 1)),
            createSubHeading("Bagian Placeholder Guru:"),
            ...(data.outputSummary?.placeholderGuru || ["- [DIISI OLEH GURU] pada Identitas Guru/Sekolah jika belum diisi"]).map((p: string, i: number) => createListParagraph(p, i + 1)),
            createSubHeading("Saran Penyempurnaan Modul:"),
            ...createNormalParagraph(data.outputSummary?.saranPenyempurnaan || "Modul siap digunakan dan dapat diselaraskan dengan media lingkungan fisik sekolah."),
            createSubHeading("Penegasan Integrasi Kurikulum Berbasis Cinta:"),
            ...createNormalParagraph(data.outputSummary?.penegasanKbc || "Modul Ajar ini telah mengintegrasikan Kurikulum Berbasis Cinta (KBC) secara utuh dan konsisten pada seluruh komponen."),
          ],
        }]
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `Modul_Ajar_Kelas_${selectedGrade}.docx`);
      markAtpAsGenerated(selectedGrade, selectedAtpStrings);
      addAtpBatch(selectedGrade, {
        atps: selectedAtpStrings,
        color: getRandomColor(),
        type: 'modul',
        timestamp: Date.now()
      });
      addModulAjarHistory({
        id: Date.now().toString(),
        grade: selectedGrade,
        atps: selectedAtpStrings,
        createdAt: Date.now(),
        karakteristik: selectedKarakteristik,
        data
      });
    } catch (error) {
      console.error(error);
      alert('Terjadi kesalahan saat menghasilkan Modul Ajar.');
    } finally {
      setIsGeneratingModul(false);
    }
  };

  if (loading) return <Layout><div className="p-8">Memuat data...</div></Layout>;

  return (
    <Layout>
      <div className="p-8">
        <div className="flex justify-between items-end mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-slate-900">Modul Ajar PAIBP SD</h1>
              <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
                Berbasis Cinta (KBC)
              </span>
            </div>
            <p className="text-slate-500 text-sm">
              Pilih ATP untuk digabungkan menjadi Modul Ajar PAIBP SD Berbasis Permendikdasmen 13/2025, Deep Learning (8,3,3,4), & Kurikulum Berbasis Cinta.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/modul-ajar-history')}
              className="flex items-center gap-2 bg-white/60 text-slate-700 border border-slate-200 px-4 py-2 rounded-2xl font-bold hover:bg-slate-50 transition-colors text-sm"
            >
              <History size={18} className="text-emerald-600" />
              Riwayat Modul Ajar
            </button>
            <button 
              onClick={syncATP}
              disabled={loading}
              className="flex items-center gap-2 bg-white/60 text-emerald-700 border border-emerald-200 px-4 py-2 rounded-2xl font-bold hover:bg-emerald-50 transition-colors disabled:opacity-50 text-sm"
            >
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
              Sinkron ATP
            </button>
            <button 
              onClick={handleGenerateClick}
              disabled={selectedAtpIndices.length === 0 || isGeneratingModul}
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-2xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-colors disabled:opacity-50 text-sm"
            >
              <Download size={18} />
              {isGeneratingModul ? 'Memproses...' : `Buat Modul Ajar (${selectedAtpIndices.length} ATP)`}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {showKarakteristikModal && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
              >
                <div className="p-6">
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Karakteristik Peserta Didik</h3>
                  <p className="text-slate-500 text-sm mb-6">Pilih karakteristik peserta didik yang paling sesuai untuk Modul Ajar ini.</p>
                  
                  <div className="space-y-2 mb-8">
                    {karakteristikOptions.map(option => (
                      <button
                        key={option}
                        onClick={() => setSelectedKarakteristik(option)}
                        className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${selectedKarakteristik === option ? 'border-emerald-600 bg-emerald-50 text-emerald-900' : 'border-slate-100 hover:border-slate-200 text-slate-600'}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold">{option}</span>
                          {selectedKarakteristik === option && <CheckSquare size={20} className="text-emerald-600" />}
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowKarakteristikModal(false)}
                      className="flex-1 px-4 py-3 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                    >
                      Batal
                    </button>
                    <button
                      onClick={generateModulAjar}
                      className="flex-1 px-4 py-3 rounded-2xl font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200"
                    >
                      Lanjutkan
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

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
                    <th className="p-4 font-bold text-slate-400 uppercase tracking-widest w-12 text-center">No</th>
                    <th className="p-4 font-bold text-slate-400 uppercase tracking-widest w-48">Elemen</th>
                    <th className="p-4 font-bold text-slate-400 uppercase tracking-widest">Alur Tujuan Pembelajaran (Total: {allAtps.length} ATP)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/20 text-sm">
                  {allAtps.map((item, idx) => {
                    const isSelected = selectedAtpIndices.includes(idx);
                    const isGenerated = storeGeneratedAtps[selectedGrade]?.includes(item.atp);
                    const batches = atpBatches[selectedGrade] || [];
                    const batch = batches.find(b => b.atps.includes(item.atp));
                    const shadingColor = batch ? batch.color : null;
                    
                    const dateStr = item.date ? format(item.date, "EEEE, d MMM yyyy", { locale: localeId }) : 'Belum diatur';
                    return (
                      <tr 
                        key={idx} 
                        onClick={() => toggleAtp(idx)}
                        className={`cursor-pointer transition-colors ${isSelected ? 'bg-emerald-100/60' : (shadingColor ? '' : (isGenerated ? 'bg-slate-100/70 hover:bg-slate-200/50' : 'hover:bg-white/40'))}`}
                        style={{ backgroundColor: isSelected ? undefined : (shadingColor || undefined) }}
                      >
                        <td className="p-4 text-center">
                          <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center mx-auto transition-colors ${isSelected ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm' : (isGenerated ? 'border-slate-400 bg-slate-200 text-slate-500' : 'border-slate-300 bg-white/50')}`}>
                            {(isSelected || isGenerated) && <CheckSquare size={16} />}
                          </div>
                        </td>
                        <td className="p-4 text-center font-bold text-slate-500">{idx + 1}</td>
                        <td className="p-4 font-bold text-slate-800">{item.elemen}</td>
                        <td className="p-4 text-slate-600 font-medium">
                          <div className="font-bold text-slate-800">{item.atp}</div>
                          <div className="text-xs text-emerald-600 mt-1">{dateStr}</div>
                          {isGenerated && <span className="mt-1 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-200 text-slate-600">Sudah Dibuat</span>}
                        </td>
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
