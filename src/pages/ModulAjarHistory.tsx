import { useState } from 'react';
import Layout from '../components/Layout';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { FileText, Download, Trash2, ArrowLeft, Clock, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, AlignmentType, BorderStyle, ShadingType } from 'docx';
import { saveAs } from 'file-saver';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

const GRADES = [1, 2, 3, 4, 5, 6];

const getRandomColor = () => {
  const h = Math.floor(Math.random() * 360);
  return `hsla(${h}, 70%, 85%, 0.8)`;
};

export default function ModulAjarHistory() {
  const { modulAjarHistories, clearModulAjarHistories, deleteModulAjarHistory, profile } = useStore();
  const navigate = useNavigate();

  const [selectedGrade, setSelectedGrade] = useState<number>(1);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const handleDownloadDocx = async (item: any) => {
    try {
      const data = item.data;
      const grade = item.grade;
      const atps = item.atps;
      const totalJp = atps.length * 4;
      const pertemuan = atps.length;

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
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "MODUL AJAR PAI DAN BUDI PEKERTI", bold: true, size: 48 })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 400 }, children: [new TextRun({ text: "BERBASIS PERMENDIKDASMEN NOMOR 13 TAHUN 2025", size: 24, italics: true })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 800, after: 800 }, children: [new TextRun({ text: "[ LOGO SEKOLAH ]", size: 20 })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Nama Guru: ${profile?.namaGuru || '-'}`, size: 24 })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Sekolah: ${profile?.namaSekolah || '-'}`, size: 24 })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Tahun Pelajaran: ${profile?.tahunPelajaran || '2026/2027'}`, size: 24 })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Fase: ${grade <= 2 ? 'A' : (grade <= 4 ? 'B' : 'C')}`, size: 24 })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Kelas: ${grade}`, size: 24 })] }),

            createHeading("I. IDENTITAS MODUL"),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                createTableRow("Elemen", data.identitas?.elemen || '-'),
                createTableRow("Materi", data.identitas?.materi || '-'),
                createTableRow("Alokasi Waktu", `${totalJp} JP (${pertemuan} Pertemuan) x 35 Menit`),
                createTableRow("Model Pembelajaran", data.identitas?.model || '-'),
                createTableRow("Pendekatan", data.identitas?.pendekatan || '-'),
                createTableRow("Metode", data.identitas?.metode || '-'),
                createTableRow("Media", data.identitas?.media || '-'),
                createTableRow("Sumber Belajar", data.identitas?.sumber || '-'),
                createTableRow("Karakteristik Siswa", item.karakteristik || '-'),
                createTableRow("Target Peserta Didik", data.identitas?.target || '-'),
                createTableRow("Sarana Prasarana", data.identitas?.sarana || '-'),
              ]
            }),

            createHeading("II. KOMPONEN INTI"),
            createSubHeading("Capaian Pembelajaran"),
            ...createNormalParagraph(data.komponenInti?.cp || ''),
            createSubHeading("Tujuan Pembelajaran"),
            ...createNormalParagraph(data.komponenInti?.tp || ''),
            createSubHeading("Alur Tujuan Pembelajaran"),
            ...createNormalParagraph(data.komponenInti?.atp || ''),
            createSubHeading("Pemahaman Bermakna"),
            ...createNormalParagraph(data.komponenInti?.pemahamanBermakna || ''),
            createSubHeading("Pertanyaan Pemantik"),
            ...(data.komponenInti?.pertanyaanPemantik || []).map((p: string, i: number) => createListParagraph(p, i + 1)),

            createHeading("III. ASESMEN DIAGNOSTIK"),
            ...createNormalParagraph(data.diagnostik?.deskripsi || ''),

            createHeading("IV. PEMBELAJARAN MENDALAM (DEEP LEARNING)"),
            ...createNormalParagraph(data.pembelajaranMendalam || ''),

            createHeading("V. LANGKAH PEMBELAJARAN"),
            ...(data.langkahPembelajaran || []).map((p: any) => ([
              createSubHeading(`Pertemuan Ke-${p.pertemuan} (${p.waktu})`),
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                  createTableRow("Pendahuluan", p.pendahuluan, true),
                  createTableRow("Kegiatan Inti", p.inti, true),
                  createTableRow("Penutup", p.penutup, true),
                ]
              })
            ])).flat(),

            createHeading("VI. ASESMEN & INSTRUMEN"),
            ...createNormalParagraph(`Jenis Asesmen: ${data.asesmen?.jenis || '-'}`),
            ...createNormalParagraph(data.asesmen?.deskripsi || ''),

            createHeading("VII. PENGAYAAN & REMEDIAL"),
            createSubHeading("Pengayaan"),
            ...createNormalParagraph(data.pengayaanRemedial?.pengayaan || ''),
            createSubHeading("Remedial"),
            ...createNormalParagraph(data.pengayaanRemedial?.remedial || ''),

            createHeading("VIII. REFLEKSI"),
            createSubHeading("Refleksi Guru"),
            ...(data.refleksi?.guru || []).map((p: string, i: number) => createListParagraph(p, i + 1)),
            createSubHeading("Refleksi Peserta Didik"),
            ...(data.refleksi?.siswa || []).map((p: string, i: number) => createListParagraph(p, i + 1)),

            createHeading("IX. LEMBAR KERJA PESERTA DIDIK (LKPD)"),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                createTableRow("Judul LKPD", data.lkpd?.judul || '', true),
                createTableRow("Tujuan", data.lkpd?.tujuan || '', true),
                createTableRow("Petunjuk", data.lkpd?.petunjuk || '', true),
                createTableRow("Alat & Bahan", data.lkpd?.alat || '', true),
                createTableRow("Langkah Kerja", data.lkpd?.langkah || '', true),
                createTableRow("Tugas", data.lkpd?.tugas || '', true),
                createTableRow("Soal", data.lkpd?.soal || '', true),
              ]
            }),

            createHeading("X. BAHAN BACAAN, GLOSARIUM & PUSTAKA"),
            createSubHeading("Bahan Bacaan Guru"),
            ...createNormalParagraph(data.bacaanGlosariumPustaka?.bacaanGuru || ''),
            createSubHeading("Bahan Bacaan Siswa"),
            ...createNormalParagraph(data.bacaanGlosariumPustaka?.bacaanSiswa || ''),

            createHeading("XI. LAMPIRAN"),
            ...createNormalParagraph(data.lampiran || ''),
          ]
        }]
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `Modul_Ajar_Kelas_${grade}_${Date.now()}.docx`);
    } catch (e) {
      console.error(e);
      alert('Gagal mengunduh dokumen Word.');
    }
  };

  const filteredHistories = modulAjarHistories.filter(item => item.grade === selectedGrade);

  return (
    <Layout>
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <button 
              onClick={() => navigate('/modul-ajar')}
              className="inline-flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl mb-3 hover:bg-emerald-100 transition-colors cursor-pointer"
            >
              <ArrowLeft size={16} />
              Kembali ke Pembuat Modul Ajar
            </button>
            <h1 className="text-2xl font-bold text-slate-900">Riwayat Modul Ajar</h1>
            <p className="text-slate-500 text-sm mt-1">Pratinjau, kelola, dan unduh kembali Modul Ajar yang telah dibuat per kelas.</p>
          </div>

          <div className="flex items-center gap-3">
            {modulAjarHistories.length > 0 && (
              <button
                onClick={() => {
                  if (window.confirm('Apakah Anda yakin ingin menghapus seluruh riwayat Modul Ajar?')) {
                    clearModulAjarHistories();
                  }
                }}
                className="flex items-center gap-2 bg-rose-50 text-rose-700 border border-rose-200 px-4 py-2.5 rounded-2xl text-xs font-bold hover:bg-rose-100 transition-colors cursor-pointer"
              >
                <Trash2 size={16} />
                Hapus Semua Riwayat
              </button>
            )}
          </div>
        </div>

        {/* Grade Navigation Tabs */}
        <div className="flex flex-wrap gap-2 bg-white/40 border border-white/60 backdrop-blur-md p-2 rounded-2xl shadow-sm">
          {GRADES.map(grade => {
            const count = modulAjarHistories.filter(h => h.grade === grade).length;
            const isSelected = selectedGrade === grade;
            return (
              <button
                key={grade}
                onClick={() => setSelectedGrade(grade)}
                className={`flex-1 min-w-[100px] py-2.5 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  isSelected 
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200' 
                    : 'text-slate-600 hover:bg-white/60'
                }`}
              >
                <span>Kelas {grade}</span>
                {count > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${isSelected ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* History List */}
        <div className="space-y-4">
          {filteredHistories.length > 0 ? (
            filteredHistories.map((item) => {
              const isExpanded = expandedItem === item.id;
              const cardColor = getRandomColor();
              return (
                <div key={item.id} className="bg-white/40 border border-white/60 backdrop-blur-md rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                  <div className="p-5 flex items-center justify-between">
                    <div 
                      className="flex items-center gap-4 cursor-pointer flex-1"
                      onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                    >
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-slate-800 font-bold text-xs shadow-sm shrink-0" style={{ backgroundColor: cardColor }}>
                        {format(new Date(item.createdAt), 'dd MMM')}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800 text-base">
                          {item.data?.identitas?.materi || `Modul Ajar Kelas ${item.grade}`}
                        </h3>
                        <p className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                          <span className="flex items-center gap-1"><Clock size={12} /> {format(new Date(item.createdAt), "EEEE, d MMMM yyyy", { locale: localeId })}</span>
                          <span>•</span>
                          <strong className="text-emerald-700">Karakteristik: {item.karakteristik}</strong>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => handleDownloadDocx(item)}
                        className="flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all shadow-sm shadow-emerald-200 cursor-pointer"
                      >
                        <Download size={16} />
                        Unduh Word
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteModulAjarHistory(item.id)}
                        className="p-2.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 transition-all cursor-pointer"
                        title="Hapus Riwayat"
                      >
                        <Trash2 size={16} />
                      </button>

                      <button
                        type="button"
                        onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                        className="p-2.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all cursor-pointer"
                      >
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div 
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="overflow-hidden border-t border-white/20 bg-white/20"
                      >
                        <div className="p-6 space-y-6 text-sm text-slate-700">
                          <div className="bg-emerald-50/80 p-4 rounded-2xl border border-emerald-100 grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <p className="text-xs text-slate-500 font-semibold">Elemen</p>
                              <p className="font-bold text-slate-800">{item.data?.identitas?.elemen || '-'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 font-semibold">Model Pembelajaran</p>
                              <p className="font-bold text-slate-800">{item.data?.identitas?.model || '-'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 font-semibold">Jumlah ATP Digunakan</p>
                              <p className="font-bold text-emerald-700">{item.atps?.length || 0} ATP</p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider text-slate-400">ATP yang Digunakan:</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {item.atps?.map((atp: string, idx: number) => (
                                <div key={idx} className="bg-white/60 p-3 rounded-2xl border border-slate-100 flex items-start gap-2">
                                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                                  <span className="text-xs text-slate-700 font-medium">{atp}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-3">
                            <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider text-slate-400">Tujuan Pembelajaran</h4>
                            <div className="bg-white/60 p-4 rounded-2xl border border-slate-100">
                              <p className="whitespace-pre-line text-xs text-slate-700">{item.data?.komponenInti?.tp || '-'}</p>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider text-slate-400">Langkah Pembelajaran</h4>
                            <div className="space-y-3">
                              {item.data?.langkahPembelajaran?.map((lp: any, i: number) => (
                                <div key={i} className="bg-white/60 p-4 rounded-2xl border border-slate-100 space-y-2">
                                  <h5 className="font-bold text-emerald-800 text-xs">Pertemuan {lp.pertemuan} ({lp.waktu})</h5>
                                  <div className="text-xs space-y-1 text-slate-600">
                                    <p><strong>Pendahuluan:</strong> {lp.pendahuluan}</p>
                                    <p><strong>Kegiatan Inti:</strong> {lp.inti}</p>
                                    <p><strong>Penutup:</strong> {lp.penutup}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          ) : (
            <div className="bg-white/40 border border-white/60 backdrop-blur-md rounded-3xl p-16 text-center">
              <FileText className="w-16 h-16 text-emerald-200 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-800">Belum Ada Riwayat Modul Ajar</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                Belum ada riwayat Modul Ajar yang tersimpan untuk Kelas {selectedGrade}. Buat dan simpan Modul Ajar baru dari halaman Pembuat Modul Ajar.
              </p>
              <button
                onClick={() => navigate('/modul-ajar')}
                className="mt-6 inline-flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-2xl text-xs font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all cursor-pointer"
              >
                Mulai Buat Modul Ajar
              </button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
