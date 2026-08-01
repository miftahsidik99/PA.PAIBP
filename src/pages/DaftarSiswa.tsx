import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import { useStore, Student } from '../store/useStore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, Plus, Trash2, Save, Download, Upload, 
  FileSpreadsheet, Image as ImageIcon, X, FileText, 
  Check, AlertCircle, RefreshCw, Layers
} from 'lucide-react';
import { 
  Document, Packer, Paragraph, Table, TableCell, TableRow, 
  TextRun, WidthType, AlignmentType, BorderStyle, ShadingType,
  PageOrientation, ImageRun
} from 'docx';
import { saveAs } from 'file-saver';

export default function DaftarSiswa() {
  const { user, profile, students: storeStudents, setStudents } = useStore();
  const [selectedGrade, setSelectedGrade] = useState<number>(1);
  const [rows, setRows] = useState<Student[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [paperSize, setPaperSize] = useState<'a4' | 'f4'>('a4');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('landscape');
  const [isExporting, setIsExporting] = useState(false);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  // Initialize or load students for selected grade
  useEffect(() => {
    const loaded = storeStudents[selectedGrade] || [];
    if (loaded.length > 0) {
      setRows(loaded);
    } else {
      // Create initial 5 blank rows
      const initialRows: Student[] = Array.from({ length: 5 }, (_, i) => ({
        id: `row-${Date.now()}-${i}`,
        nama: '',
        nisn: '',
        jenisKelamin: '',
        kelas: `Kelas ${selectedGrade}`,
        tanggalLahir: '',
        alamat: '',
        foto: ''
      }));
      setRows(initialRows);
    }
  }, [selectedGrade, storeStudents]);

  const handleGradeChange = (grade: number) => {
    setSelectedGrade(grade);
  };

  const handleAddRow = () => {
    const newRow: Student = {
      id: `row-${Date.now()}-${rows.length}`,
      nama: '',
      nisn: '',
      jenisKelamin: '',
      kelas: `Kelas ${selectedGrade}`,
      tanggalLahir: '',
      alamat: '',
      foto: ''
    };
    setRows([...rows, newRow]);
  };

  const handleAddMultipleRows = (count: number) => {
    const newRows: Student[] = Array.from({ length: count }, (_, i) => ({
      id: `row-${Date.now()}-${rows.length + i}`,
      nama: '',
      nisn: '',
      jenisKelamin: '',
      kelas: `Kelas ${selectedGrade}`,
      tanggalLahir: '',
      alamat: '',
      foto: ''
    }));
    setRows([...rows, ...newRows]);
  };

  const handleRowChange = (id: string, field: keyof Student, value: string) => {
    setRows(rows.map(row => row.id === id ? { ...row, [field]: value } : row));
  };

  const handleDeleteRow = (id: string) => {
    if (rows.length <= 1) {
      // Keep at least one row empty
      setRows([{
        id: `row-${Date.now()}`,
        nama: '',
        nisn: '',
        jenisKelamin: '',
        kelas: `Kelas ${selectedGrade}`,
        tanggalLahir: '',
        alamat: '',
        foto: ''
      }]);
    } else {
      setRows(rows.filter(row => row.id !== id));
    }
  };

  const handleClearData = () => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus semua data siswa untuk Kelas ${selectedGrade}?`)) {
      const resetRows: Student[] = Array.from({ length: 3 }, (_, i) => ({
        id: `row-${Date.now()}-${i}`,
        nama: '',
        nisn: '',
        jenisKelamin: '',
        kelas: `Kelas ${selectedGrade}`,
        tanggalLahir: '',
        alamat: '',
        foto: ''
      }));
      setRows(resetRows);
    }
  };

  const handleSave = () => {
    setIsSaving(true);
    const updated = {
      ...storeStudents,
      [selectedGrade]: rows
    };
    setStudents(updated);
    setTimeout(() => {
      setIsSaving(false);
      alert(`Data siswa Kelas ${selectedGrade} berhasil disimpan!`);
    }, 400);
  };

  // Handle image upload (3x4 aspect ratio photo)
  const handlePhotoUpload = (id: string, file: File) => {
    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
      alert('Format foto harus JPG, JPEG, atau PNG.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        handleRowChange(id, 'foto', e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle direct paste on table inputs
  const handleInputPaste = (e: React.ClipboardEvent<HTMLInputElement>, startIdx: number, startCol: string) => {
    const clipboardData = e.clipboardData.getData('text');
    if (!clipboardData || !clipboardData.includes('\t')) return; // Allow normal text paste if not tabular
    
    e.preventDefault();
    const pastedLines = clipboardData.split(/\r?\n/).filter(line => line.trim() !== '');
    if (pastedLines.length === 0) return;

    const columnsOrder: (keyof Student)[] = ['nama', 'nisn', 'jenisKelamin', 'kelas', 'tanggalLahir', 'alamat'];
    const startColIndex = columnsOrder.indexOf(startCol as keyof Student);
    if (startColIndex === -1) return;

    const newRows = [...rows];

    pastedLines.forEach((line, lineIdx) => {
      const targetRowIdx = startIdx + lineIdx;
      const values = line.split('\t');

      // Expand rows if needed
      while (newRows.length <= targetRowIdx) {
        newRows.push({
          id: `row-${Date.now()}-${newRows.length}`,
          nama: '',
          nisn: '',
          jenisKelamin: '',
          kelas: `Kelas ${selectedGrade}`,
          tanggalLahir: '',
          alamat: '',
          foto: ''
        });
      }

      values.forEach((val, valIdx) => {
        const colIndex = startColIndex + valIdx;
        if (colIndex < columnsOrder.length) {
          const field = columnsOrder[colIndex];
          newRows[targetRowIdx] = {
            ...newRows[targetRowIdx],
            [field]: val.trim()
          };
        }
      });
    });

    setRows(newRows);
  };

  // Process paste from Modal (e.g. copied from Excel/Spreadsheet)
  const handleProcessPasteModal = () => {
    if (!pasteText.trim()) {
      setIsPasteModalOpen(false);
      return;
    }

    const lines = pasteText.split(/\r?\n/).filter(l => l.trim() !== '');
    const pastedStudents: Student[] = lines.map((line, i) => {
      const cols = line.split('\t');
      return {
        id: `row-pasted-${Date.now()}-${i}`,
        nama: cols[0]?.trim() || '',
        nisn: cols[1]?.trim() || '',
        jenisKelamin: cols[2]?.trim() || '',
        kelas: cols[3]?.trim() || `Kelas ${selectedGrade}`,
        tanggalLahir: cols[4]?.trim() || '',
        alamat: cols[5]?.trim() || '',
        foto: ''
      };
    });

    // Determine whether to overwrite empty rows or append
    const nonBlankRows = rows.filter(r => r.nama.trim() !== '' || r.nisn.trim() !== '');
    setRows([...nonBlankRows, ...pastedStudents]);
    setPasteText('');
    setIsPasteModalOpen(false);
  };

  // Helper: Convert base64 DataURL to Uint8Array for docx embedding
  const dataURLtoUint8Array = (dataURL: string): Uint8Array => {
    const base64 = dataURL.split(',')[1];
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes;
  };

  // Export to Word Document (.docx)
  const exportToWord = async () => {
    setIsExporting(true);
    try {
      const activeStudents = rows.filter(r => 
        r.nama.trim() !== '' || r.nisn.trim() !== '' || r.alamat.trim() !== ''
      );
      const dataToExport = activeStudents.length > 0 ? activeStudents : rows;

      // Define page dimensions (TWIPs: 1 inch = 1440 TWIPs, 1 mm ~ 56.7 TWIPs)
      // A4: 210 x 297 mm -> 11906 x 16838
      // F4 (Folio): 215.9 x 330.2 mm -> 12240 x 18720
      let pageDimensions = {
        width: orientation === 'landscape' ? 16838 : 11906,
        height: orientation === 'landscape' ? 11906 : 16838
      };

      if (paperSize === 'f4') {
        pageDimensions = {
          width: orientation === 'landscape' ? 18720 : 12240,
          height: orientation === 'landscape' ? 12240 : 18720
        };
      }

      const headerShading = {
        fill: "047857", // emerald-700
        type: ShadingType.CLEAR,
        color: "auto"
      };

      const cellBorders = {
        top: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
        left: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
        right: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
      };

      // Table Headers
      const headerRow = new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: "NO", bold: true, color: "FFFFFF" })], alignment: AlignmentType.CENTER })],
            shading: headerShading,
            borders: cellBorders,
            width: { size: 5, type: WidthType.PERCENTAGE },
            margins: { top: 120, bottom: 120, left: 100, right: 100 }
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: "NAMA SISWA", bold: true, color: "FFFFFF" })] })],
            shading: headerShading,
            borders: cellBorders,
            width: { size: 24, type: WidthType.PERCENTAGE },
            margins: { top: 120, bottom: 120, left: 100, right: 100 }
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: "NISN", bold: true, color: "FFFFFF" })], alignment: AlignmentType.CENTER })],
            shading: headerShading,
            borders: cellBorders,
            width: { size: 13, type: WidthType.PERCENTAGE },
            margins: { top: 120, bottom: 120, left: 100, right: 100 }
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: "JENIS KELAMIN", bold: true, color: "FFFFFF" })], alignment: AlignmentType.CENTER })],
            shading: headerShading,
            borders: cellBorders,
            width: { size: 10, type: WidthType.PERCENTAGE },
            margins: { top: 120, bottom: 120, left: 100, right: 100 }
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: "KELAS", bold: true, color: "FFFFFF" })], alignment: AlignmentType.CENTER })],
            shading: headerShading,
            borders: cellBorders,
            width: { size: 8, type: WidthType.PERCENTAGE },
            margins: { top: 120, bottom: 120, left: 100, right: 100 }
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: "TANGGAL LAHIR", bold: true, color: "FFFFFF" })], alignment: AlignmentType.CENTER })],
            shading: headerShading,
            borders: cellBorders,
            width: { size: 12, type: WidthType.PERCENTAGE },
            margins: { top: 120, bottom: 120, left: 100, right: 100 }
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: "ALAMAT", bold: true, color: "FFFFFF" })] })],
            shading: headerShading,
            borders: cellBorders,
            width: { size: 17, type: WidthType.PERCENTAGE },
            margins: { top: 120, bottom: 120, left: 100, right: 100 }
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: "FOTO (3x4)", bold: true, color: "FFFFFF" })], alignment: AlignmentType.CENTER })],
            shading: headerShading,
            borders: cellBorders,
            width: { size: 11, type: WidthType.PERCENTAGE },
            margins: { top: 120, bottom: 120, left: 100, right: 100 }
          }),
        ]
      });

      // Data rows
      const dataRows = dataToExport.map((s, idx) => {
        let photoChildren: any[] = [
          new Paragraph({
            children: [new TextRun({ text: "[Foto 3x4]", color: "888888", size: 18 })],
            alignment: AlignmentType.CENTER
          })
        ];

        if (s.foto && s.foto.startsWith('data:image')) {
          try {
            const bytes = dataURLtoUint8Array(s.foto);
            photoChildren = [
              new Paragraph({
                children: [
                  new ImageRun({
                    data: bytes,
                    transformation: {
                      width: 60,  // approx 3cm aspect ratio 3:4
                      height: 80
                    },
                    type: s.foto.includes('png') ? "png" : "jpg"
                  })
                ],
                alignment: AlignmentType.CENTER
              })
            ];
          } catch (err) {
            console.error("Gagal mengolah foto untuk docx:", err);
          }
        }

        return new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: (idx + 1).toString() })], alignment: AlignmentType.CENTER })],
              borders: cellBorders,
              margins: { top: 100, bottom: 100, left: 100, right: 100 }
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: s.nama || '-' })] })],
              borders: cellBorders,
              margins: { top: 100, bottom: 100, left: 100, right: 100 }
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: s.nisn || '-' })], alignment: AlignmentType.CENTER })],
              borders: cellBorders,
              margins: { top: 100, bottom: 100, left: 100, right: 100 }
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: s.jenisKelamin || '-' })], alignment: AlignmentType.CENTER })],
              borders: cellBorders,
              margins: { top: 100, bottom: 100, left: 100, right: 100 }
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: s.kelas || `Kelas ${selectedGrade}` })], alignment: AlignmentType.CENTER })],
              borders: cellBorders,
              margins: { top: 100, bottom: 100, left: 100, right: 100 }
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: s.tanggalLahir || '-' })], alignment: AlignmentType.CENTER })],
              borders: cellBorders,
              margins: { top: 100, bottom: 100, left: 100, right: 100 }
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: s.alamat || '-' })] })],
              borders: cellBorders,
              margins: { top: 100, bottom: 100, left: 100, right: 100 }
            }),
            new TableCell({
              children: photoChildren,
              borders: cellBorders,
              margins: { top: 80, bottom: 80, left: 60, right: 60 }
            })
          ]
        });
      });

      const doc = new Document({
        sections: [
          {
            properties: {
              page: {
                size: {
                  width: pageDimensions.width,
                  height: pageDimensions.height,
                  orientation: orientation === 'landscape' ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT
                },
                margin: {
                  top: 1440, // 1 inch
                  bottom: 1440,
                  left: 1440,
                  right: 1440
                }
              }
            },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `DAFTAR DATA SISWA KELAS ${selectedGrade}`,
                    bold: true,
                    size: 28
                  })
                ],
                alignment: AlignmentType.CENTER,
                spacing: { after: 120 }
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${profile?.namaSekolah || 'SEKOLAH DASAR'} | Tahun Pelajaran: ${profile?.tahunPelajaran || '2025/2026'}`,
                    size: 22,
                    color: "475569"
                  })
                ],
                alignment: AlignmentType.CENTER,
                spacing: { after: 360 }
              }),
              new Table({
                rows: [headerRow, ...dataRows],
                width: {
                  size: 100,
                  type: WidthType.PERCENTAGE
                }
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Wali Kelas / Guru PAI: ${profile?.namaGuru || '______________________'}`,
                    size: 22
                  })
                ],
                alignment: AlignmentType.RIGHT,
                spacing: { before: 480 }
              })
            ]
          }
        ]
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `Daftar_Siswa_Kelas_${selectedGrade}_${paperSize.toUpperCase()}_${orientation}.docx`);
      setIsExportModalOpen(false);
    } catch (err) {
      console.error("Gagal mengunduh dokumen Word:", err);
      alert("Terjadi kesalahan saat membuat dokumen Word.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Layout>
      <div className="p-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm mb-1">
              <Users size={18} />
              <span>Manajemen Data Siswa</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Daftar Siswa</h1>
            <p className="text-slate-500 text-sm">
              Kelola data siswa per kelas, tempel (paste) dari spreadsheet, serta ekspor ke dokumen Word berformat rapi.
            </p>
          </div>

          {/* Top Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsPasteModalOpen(true)}
              className="flex items-center gap-2 bg-white/80 text-emerald-700 border border-emerald-200 px-4 py-2 rounded-2xl font-bold hover:bg-emerald-50 transition-colors shadow-sm text-sm"
            >
              <FileSpreadsheet size={18} />
              Paste dari Excel
            </button>
            
            <button
              onClick={handleClearData}
              className="flex items-center gap-2 bg-white/80 text-rose-600 border border-rose-200 px-4 py-2 rounded-2xl font-bold hover:bg-rose-50 transition-colors shadow-sm text-sm"
            >
              <Trash2 size={18} />
              Clear Data
            </button>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-2xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-colors disabled:opacity-50 text-sm"
            >
              {isSaving ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Simpan Data
                </>
              )}
            </button>

            <button
              onClick={() => setIsExportModalOpen(true)}
              className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-2xl font-bold shadow-lg shadow-slate-200 hover:bg-slate-900 transition-colors text-sm"
            >
              <Download size={18} />
              Unduh Word
            </button>
          </div>
        </div>

        {/* Grade Selection Tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 6].map((grade) => (
            <button
              key={grade}
              onClick={() => handleGradeChange(grade)}
              className={`px-5 py-2.5 rounded-2xl text-sm font-bold transition-all ${
                selectedGrade === grade
                  ? 'bg-emerald-600 shadow-md shadow-emerald-200 text-white'
                  : 'bg-white/60 text-slate-600 border border-white/80 hover:bg-white/80'
              }`}
            >
              Kelas {grade}
            </button>
          ))}
        </div>

        {/* Table Card */}
        <motion.div
          key={selectedGrade}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/60 border border-white/80 backdrop-blur-md rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden p-4"
        >
          <div className="flex justify-between items-center px-4 py-3 mb-2 border-b border-slate-100">
            <div className="font-bold text-slate-800 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold">
                {selectedGrade}
              </span>
              <span>Daftar Siswa Kelas {selectedGrade}</span>
              <span className="text-xs text-slate-500 font-normal">
                ({rows.length} baris tersedia)
              </span>
            </div>

            <div className="text-xs text-slate-500 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 flex items-center gap-1.5">
              <Check size={14} className="text-emerald-600" />
              <span>Tips: Blok & Paste data dari Excel langsung pada kolom teks</span>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[680px] overflow-y-auto rounded-2xl border border-slate-200/60 bg-white/70">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="sticky top-0 bg-slate-800 text-white z-10 shadow-sm">
                <tr>
                  <th className="p-3.5 font-bold uppercase tracking-wider w-12 text-center text-xs">No</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider min-w-[200px] text-xs">Nama Siswa</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider w-36 text-center text-xs">NISN</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider w-36 text-center text-xs">Jenis Kelamin</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider w-28 text-center text-xs">Kelas</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider w-36 text-center text-xs">Tanggal Lahir</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider min-w-[220px] text-xs">Alamat</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider w-32 text-center text-xs">Foto (3x4)</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider w-14 text-center text-xs">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 text-slate-700">
                {rows.map((row, idx) => (
                  <tr
                    key={row.id}
                    className="hover:bg-emerald-50/30 transition-colors group"
                  >
                    {/* No */}
                    <td className="p-3 text-center font-bold text-slate-500 text-xs">
                      {idx + 1}
                    </td>

                    {/* Nama Siswa */}
                    <td className="p-2">
                      <input
                        type="text"
                        value={row.nama}
                        onChange={(e) => handleRowChange(row.id, 'nama', e.target.value)}
                        onPaste={(e) => handleInputPaste(e, idx, 'nama')}
                        placeholder="Nama lengkap siswa..."
                        className="w-full px-3 py-2 rounded-xl bg-white/80 border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all text-sm font-medium text-slate-800"
                      />
                    </td>

                    {/* NISN */}
                    <td className="p-2">
                      <input
                        type="text"
                        value={row.nisn}
                        onChange={(e) => handleRowChange(row.id, 'nisn', e.target.value)}
                        onPaste={(e) => handleInputPaste(e, idx, 'nisn')}
                        placeholder="00xxxxxxxxx"
                        className="w-full px-3 py-2 text-center rounded-xl bg-white/80 border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all text-sm font-mono text-slate-700"
                      />
                    </td>

                    {/* Jenis Kelamin */}
                    <td className="p-2">
                      <select
                        value={row.jenisKelamin || ''}
                        onChange={(e) => handleRowChange(row.id, 'jenisKelamin', e.target.value)}
                        onPaste={(e: any) => handleInputPaste(e, idx, 'jenisKelamin')}
                        className="w-full px-3 py-2 text-center rounded-xl bg-white border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all text-sm font-semibold text-slate-800"
                      >
                        <option value="">- Pilih -</option>
                        <option value="Laki-laki">Laki-laki</option>
                        <option value="Perempuan">Perempuan</option>
                      </select>
                    </td>

                    {/* Kelas */}
                    <td className="p-2">
                      <input
                        type="text"
                        value={row.kelas}
                        onChange={(e) => handleRowChange(row.id, 'kelas', e.target.value)}
                        onPaste={(e) => handleInputPaste(e, idx, 'kelas')}
                        className="w-full px-2 py-2 text-center rounded-xl bg-white/80 border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all text-sm text-slate-700"
                      />
                    </td>

                    {/* Tanggal Lahir */}
                    <td className="p-2">
                      <input
                        type="text"
                        value={row.tanggalLahir}
                        onChange={(e) => handleRowChange(row.id, 'tanggalLahir', e.target.value)}
                        onPaste={(e) => handleInputPaste(e, idx, 'tanggalLahir')}
                        placeholder="DD/MM/YYYY"
                        className="w-full px-3 py-2 text-center rounded-xl bg-white/80 border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all text-sm text-slate-700"
                      />
                    </td>

                    {/* Alamat */}
                    <td className="p-2">
                      <input
                        type="text"
                        value={row.alamat}
                        onChange={(e) => handleRowChange(row.id, 'alamat', e.target.value)}
                        onPaste={(e) => handleInputPaste(e, idx, 'alamat')}
                        placeholder="Alamat lengkap..."
                        className="w-full px-3 py-2 rounded-xl bg-white/80 border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all text-sm text-slate-700"
                      />
                    </td>

                    {/* Foto Siswa (3x4 ratio) */}
                    <td className="p-2 text-center">
                      <div className="flex flex-col items-center justify-center">
                        {row.foto ? (
                          <div className="relative group/foto w-14 h-[74px] rounded-lg overflow-hidden border-2 border-emerald-400 bg-slate-100 shadow-sm mx-auto">
                            <img
                              src={row.foto}
                              alt="Foto Siswa"
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => handleRowChange(row.id, 'foto', '')}
                              title="Hapus foto"
                              className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover/foto:opacity-100 transition-opacity flex items-center justify-center text-white text-xs"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => fileInputRefs.current[row.id]?.click()}
                            className="w-14 h-[74px] rounded-lg border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50/80 hover:bg-emerald-50/50 flex flex-col items-center justify-center transition-colors text-slate-400 hover:text-emerald-600 gap-0.5"
                          >
                            <ImageIcon size={16} />
                            <span className="text-[10px] font-bold">3x4</span>
                          </button>
                        )}

                        <input
                          type="file"
                          accept=".jpg,.jpeg,.png"
                          ref={(el) => { fileInputRefs.current[row.id] = el; }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handlePhotoUpload(row.id, file);
                          }}
                          className="hidden"
                        />
                      </div>
                    </td>

                    {/* Aksi Hapus */}
                    <td className="p-2 text-center">
                      <button
                        onClick={() => handleDeleteRow(row.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                        title="Hapus baris ini"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bottom Table Action Bars */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-200/60">
            <div className="flex items-center gap-2">
              <button
                onClick={handleAddRow}
                className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-2xl font-bold hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-200 text-sm"
              >
                <Plus size={18} />
                Tambah 1 Baris
              </button>
              <button
                onClick={() => handleAddMultipleRows(5)}
                className="flex items-center gap-2 bg-white/80 text-emerald-700 border border-emerald-200 px-4 py-2 rounded-2xl font-bold hover:bg-emerald-50 transition-colors text-sm"
              >
                <Plus size={18} />
                +5 Baris
              </button>
            </div>

            <div className="text-xs text-slate-500 flex items-center gap-4">
              <span>Total baris: <strong>{rows.length}</strong></span>
              <span>Siswa terisi: <strong>{rows.filter(r => r.nama.trim() !== '' || r.nisn.trim() !== '').length}</strong></span>
            </div>
          </div>
        </motion.div>

        {/* EXCEL PASTE MODAL */}
        <AnimatePresence>
          {isPasteModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-2xl border border-slate-100"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-emerald-700 font-bold">
                    <FileSpreadsheet size={22} />
                    <h3 className="text-lg text-slate-900">Paste Data Siswa dari Excel / Spreadsheet</h3>
                  </div>
                  <button
                    onClick={() => setIsPasteModalOpen(false)}
                    className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3.5 mb-4 text-xs text-emerald-800">
                  <p className="font-bold mb-1 flex items-center gap-1.5">
                    <AlertCircle size={14} />
                    Cara Penggunaan:
                  </p>
                  <p className="leading-relaxed">
                    1. Buka file Excel Anda dan salin (blok & copy) kolom dengan urutan:<br />
                    <strong className="text-emerald-900">Nama Siswa | NISN | L/P | Kelas | Tanggal Lahir | Alamat</strong><br />
                    2. Tempel (Ctrl+V) langsung ke kotak di bawah ini, lalu klik tombol <strong>"Proses & Masukkan Data"</strong>.
                  </p>
                </div>

                <textarea
                  rows={8}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder="Tempel (Paste) data dari Excel di sini..."
                  className="w-full p-4 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none font-mono text-xs leading-relaxed text-slate-700 mb-4"
                />

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setIsPasteModalOpen(false)}
                    className="px-4 py-2.5 rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-sm"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleProcessPasteModal}
                    className="px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-200 flex items-center gap-2"
                  >
                    <Check size={18} />
                    Proses & Masukkan Data
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* EXPORT WORD MODAL (A4 / F4 & Portrait / Landscape) */}
        <AnimatePresence>
          {isExportModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-lg border border-slate-100"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-slate-800 font-bold">
                    <FileText size={22} className="text-emerald-600" />
                    <h3 className="text-lg">Pengaturan Ekspor Dokumen Word (.docx)</h3>
                  </div>
                  <button
                    onClick={() => setIsExportModalOpen(false)}
                    className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
                  >
                    <X size={18} />
                  </button>
                </div>

                <p className="text-slate-500 text-sm mb-6">
                  Pilih ukuran kertas (A4 atau F4) dan orientasi halaman yang sesuai dengan desain tabel data siswa yang telah Anda simpan.
                </p>

                {/* Ukuran Kertas Selection */}
                <div className="mb-5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                    1. Pilih Ukuran Kertas
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPaperSize('a4')}
                      className={`p-4 rounded-2xl border-2 text-left transition-all ${
                        paperSize === 'a4'
                          ? 'border-emerald-600 bg-emerald-50/60 text-emerald-900 font-bold shadow-sm'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-base font-bold">A4</span>
                        {paperSize === 'a4' && <Check size={18} className="text-emerald-600" />}
                      </div>
                      <span className="text-xs text-slate-500">210 × 297 mm (Standar ISO)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaperSize('f4')}
                      className={`p-4 rounded-2xl border-2 text-left transition-all ${
                        paperSize === 'f4'
                          ? 'border-emerald-600 bg-emerald-50/60 text-emerald-900 font-bold shadow-sm'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-base font-bold">F4 / Folio</span>
                        {paperSize === 'f4' && <Check size={18} className="text-emerald-600" />}
                      </div>
                      <span className="text-xs text-slate-500">215.9 × 330.2 mm (Folio)</span>
                    </button>
                  </div>
                </div>

                {/* Orientasi Kertas Selection */}
                <div className="mb-6">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                    2. Pilih Orientasi Halaman
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setOrientation('landscape')}
                      className={`p-4 rounded-2xl border-2 text-left transition-all ${
                        orientation === 'landscape'
                          ? 'border-emerald-600 bg-emerald-50/60 text-emerald-900 font-bold shadow-sm'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-base font-bold">Landscape</span>
                        {orientation === 'landscape' && <Check size={18} className="text-emerald-600" />}
                      </div>
                      <span className="text-xs text-slate-500">Mendatar (Sangat Disarankan)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setOrientation('portrait')}
                      className={`p-4 rounded-2xl border-2 text-left transition-all ${
                        orientation === 'portrait'
                          ? 'border-emerald-600 bg-emerald-50/60 text-emerald-900 font-bold shadow-sm'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-base font-bold">Portrait</span>
                        {orientation === 'portrait' && <Check size={18} className="text-emerald-600" />}
                      </div>
                      <span className="text-xs text-slate-500">Tegak (Vertikal)</span>
                    </button>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => setIsExportModalOpen(false)}
                    className="px-5 py-2.5 rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-sm"
                  >
                    Batal
                  </button>
                  <button
                    onClick={exportToWord}
                    disabled={isExporting}
                    className="px-6 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-sm shadow-lg shadow-slate-200 flex items-center gap-2 disabled:opacity-50"
                  >
                    {isExporting ? (
                      <>
                        <RefreshCw size={18} className="animate-spin" />
                        Membuat Dokumen...
                      </>
                    ) : (
                      <>
                        <Download size={18} />
                        Unduh Word ({paperSize.toUpperCase()} - {orientation})
                      </>
                    )}
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
