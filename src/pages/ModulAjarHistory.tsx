import { useState } from 'react';
import Layout from '../components/Layout';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { FileText, Download, Trash2, Eye, ArrowLeft, Clock, CheckCircle2 } from 'lucide-react';
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, AlignmentType, BorderStyle, ShadingType } from 'docx';
import { saveAs } from 'file-saver';
import { useNavigate } from 'react-router-dom';

export default function ModulAjarHistory() {
  const { modulAjarHistories, clearModulAjarHistories, deleteModulAjarHistory, profile } = useStore();
  const navigate = useNavigate();

  const [previewItem, setPreviewItem] = useState<any | null>(null);

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

  return (
    <Layout>
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <button 
              onClick={() => navigate('/modul-ajar')}
              className="inline-flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl mb-3 hover:bg-emerald-100 transition-colors"
            >
              <ArrowLeft size={16} />
              Kembali ke Pembuat Modul Ajar
            </button>
            <h1 className="text-2xl font-bold text-slate-900">Riwayat Modul Ajar</h1>
            <p className="text-slate-500 text-sm mt-1">Kelola, pratinjau, dan unduh kembali Modul Ajar yang telah Anda buat sebelumnya.</p>
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

        {/* History List */}
        {modulAjarHistories.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {modulAjarHistories.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/60 border border-white/80 backdrop-blur-xl rounded-3xl p-6 shadow-xl shadow-slate-200/50 flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full">
                      Kelas {item.grade}
                    </span>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock size={12} />
                      {new Date(item.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-800 text-base mb-2 line-clamp-1">
                    {item.data?.identitas?.materi || `Modul Ajar Kelas ${item.grade}`}
                  </h3>

                  <div className="space-y-1 mb-3">
                    <p className="text-xs font-semibold text-slate-500">ATP yang Digunakan ({item.atps?.length || 0}):</p>
                    <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                      {item.atps?.map((atp, idx) => (
                        <div key={idx} className="text-xs text-slate-600 bg-white/80 px-2.5 py-1 rounded-xl border border-slate-100 flex items-start gap-1.5">
                          <CheckCircle2 size={12} className="text-emerald-600 shrink-0 mt-0.5" />
                          <span className="line-clamp-1">{atp}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 font-medium">Karakteristik: <strong className="text-slate-700">{item.karakteristik}</strong></p>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-slate-200/60">
                  <button
                    onClick={() => setPreviewItem(item)}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-white border border-slate-200 text-slate-700 px-3 py-2 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer shadow-sm"
                  >
                    <Eye size={14} className="text-emerald-600" />
                    Pratinjau
                  </button>

                  <button
                    onClick={() => handleDownloadDocx(item)}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors cursor-pointer shadow-sm shadow-emerald-200"
                  >
                    <Download size={14} />
                    Unduh Word
                  </button>

                  <button
                    onClick={() => deleteModulAjarHistory(item.id)}
                    title="Hapus"
                    className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl transition-colors cursor-pointer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="bg-white/40 border border-white/60 backdrop-blur-xl rounded-3xl p-16 text-center shadow-xl shadow-slate-200/50">
            <FileText className="w-16 h-16 text-emerald-200 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-800">Belum Ada Riwayat Modul Ajar</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              Modul Ajar yang Anda buat dari halaman Pembuat Modul Ajar akan otomatis tersimpan di sini agar dapat dipratinjau dan diunduh kembali kapan saja.
            </p>
            <button
              onClick={() => navigate('/modul-ajar')}
              className="mt-6 inline-flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-2xl text-xs font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all cursor-pointer"
            >
              Mulai Buat Modul Ajar
            </button>
          </div>
        )}

        {/* Preview Modal */}
        <AnimatePresence>
          {previewItem && (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
              >
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <div>
                    <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full">
                      Kelas {previewItem.grade}
                    </span>
                    <h2 className="text-xl font-bold text-slate-900 mt-2">
                      {previewItem.data?.identitas?.materi || 'Pratinjau Modul Ajar'}
                    </h2>
                  </div>
                  <button
                    onClick={() => setPreviewItem(null)}
                    className="text-slate-400 hover:text-slate-600 font-bold text-lg p-2"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-700">
                  <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 space-y-2">
                    <p><strong>Elemen:</strong> {previewItem.data?.identitas?.elemen}</p>
                    <p><strong>Karakteristik:</strong> {previewItem.karakteristik}</p>
                    <p><strong>Model Pembelajaran:</strong> {previewItem.data?.identitas?.model}</p>
                  </div>

                  <div>
                    <h3 className="font-bold text-emerald-800 text-base mb-2">Tujuan Pembelajaran</h3>
                    <p className="whitespace-pre-line bg-slate-50 p-4 rounded-2xl border border-slate-100">{previewItem.data?.komponenInti?.tp}</p>
                  </div>

                  <div>
                    <h3 className="font-bold text-emerald-800 text-base mb-2">Pemahaman Bermakna</h3>
                    <p className="whitespace-pre-line bg-slate-50 p-4 rounded-2xl border border-slate-100">{previewItem.data?.komponenInti?.pemahamanBermakna}</p>
                  </div>

                  <div>
                    <h3 className="font-bold text-emerald-800 text-base mb-2">Langkah Pembelajaran</h3>
                    <div className="space-y-4">
                      {previewItem.data?.langkahPembelajaran?.map((lp: any, i: number) => (
                        <div key={i} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                          <h4 className="font-bold text-slate-800">Pertemuan {lp.pertemuan} ({lp.waktu})</h4>
                          <p><strong>Pendahuluan:</strong> {lp.pendahuluan}</p>
                          <p><strong>Kegiatan Inti:</strong> {lp.inti}</p>
                          <p><strong>Penutup:</strong> {lp.penutup}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                  <button
                    onClick={() => setPreviewItem(null)}
                    className="px-4 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-200/60 transition-colors text-xs"
                  >
                    Tutup
                  </button>
                  <button
                    onClick={() => {
                      handleDownloadDocx(previewItem);
                      setPreviewItem(null);
                    }}
                    className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200"
                  >
                    <Download size={14} />
                    Unduh Dokumen Word
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
}
