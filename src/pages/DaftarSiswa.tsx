import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import { useStore, Student } from '../store/useStore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, Plus, Trash2, Save, Download, 
  FileSpreadsheet, Image as ImageIcon, X, FileText, 
  Check, AlertCircle, RefreshCw, Layers
} from 'lucide-react';
import { 
  Document, Packer, Paragraph, Table, TableCell, TableRow, 
  TextRun, WidthType, AlignmentType, BorderStyle, ShadingType,
  PageOrientation, ImageRun, VerticalAlign
} from 'docx';
import { saveAs } from 'file-saver';

export default function DaftarSiswa() {
  const { profile, students: storeStudents, setStudents, rombelConfig, setRombelConfig } = useStore();
  const [selectedGrade, setSelectedGrade] = useState<number>(1);
  const [rows, setRows] = useState<Student[]>([]);
  const [jumlahRombel, setJumlahRombel] = useState<number>(1);
  const [rombelLabels, setRombelLabels] = useState<string[]>([]);
  const [selectedRombelFilter, setSelectedRombelFilter] = useState<string>('all');
  const [isSaving, setIsSaving] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [paperSize, setPaperSize] = useState<'a4' | 'f4'>('a4');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('landscape');
  const [isExporting, setIsExporting] = useState(false);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  // Sync rombel config when grade changes
  useEffect(() => {
    const config = rombelConfig[selectedGrade];
    if (config) {
      setJumlahRombel(config.jumlahRombel);
      setRombelLabels(config.labels);
    } else {
      setJumlahRombel(1);
      const defaultLabels = [`Kelas ${selectedGrade}A`];
      setRombelLabels(defaultLabels);
      setRombelConfig(selectedGrade, { jumlahRombel: 1, labels: defaultLabels });
    }
    setSelectedRombelFilter('all');
  }, [selectedGrade, rombelConfig, setRombelConfig]);

  const handleJumlahRombelChange = (count: number) => {
    const newCount = Math.max(1, Math.min(6, count));
    setJumlahRombel(newCount);
    const newLabels = Array.from({ length: newCount }, (_, i) => {
      return rombelLabels[i] || `Kelas ${selectedGrade}${String.fromCharCode(65 + i)}`;
    });
    setRombelLabels(newLabels);
    setRombelConfig(selectedGrade, { jumlahRombel: newCount, labels: newLabels });
  };

  const handleLabelChange = (index: number, val: string) => {
    const newLabels = [...rombelLabels];
    newLabels[index] = val;
    setRombelLabels(newLabels);
    setRombelConfig(selectedGrade, { jumlahRombel, labels: newLabels });
  };

  // Initialize or load students for selected grade
  useEffect(() => {
    const loaded = storeStudents[selectedGrade] || [];
    const defaultKelas = rombelLabels[0] || `Kelas ${selectedGrade}A`;
    if (loaded.length > 0) {
      // Normalize existing rows to ensure new fields exist
      const normalized = loaded.map((s, idx) => ({
        id: s.id || `row-${Date.now()}-${idx}`,
        nama: s.nama || '',
        nipd: s.nipd || '',
        jk: s.jk || (s.jenisKelamin ? (s.jenisKelamin.startsWith('L') ? 'L' : 'P') : 'L'),
        jenisKelamin: s.jenisKelamin || (s.jk === 'P' ? 'Perempuan' : 'Laki-laki'),
        nisn: s.nisn || '',
        tempatLahir: s.tempatLahir || '',
        tanggalLahir: s.tanggalLahir || '',
        nik: s.nik || '',
        agama: s.agama || 'Islam',
        alamat: s.alamat || '',
        foto: s.foto || '',
        kelas: s.kelas || defaultKelas
      }));
      setRows(normalized);
    } else {
      // Create initial 5 blank rows
      const initialRows: Student[] = Array.from({ length: 5 }, (_, i) => ({
        id: `row-${Date.now()}-${i}`,
        nama: '',
        nipd: '',
        jk: 'L',
        jenisKelamin: 'Laki-laki',
        nisn: '',
        tempatLahir: '',
        tanggalLahir: '',
        nik: '',
        agama: 'Islam',
        alamat: '',
        foto: '',
        kelas: defaultKelas
      }));
      setRows(initialRows);
    }
  }, [selectedGrade, storeStudents, rombelLabels]);

  const handleGradeChange = (grade: number) => {
    setSelectedGrade(grade);
  };

  const handleAddRow = () => {
    const defaultKelas = rombelLabels[0] || `Kelas ${selectedGrade}A`;
    const newRow: Student = {
      id: `row-${Date.now()}-${rows.length}`,
      nama: '',
      nipd: '',
      jk: 'L',
      jenisKelamin: 'Laki-laki',
      nisn: '',
      tempatLahir: '',
      tanggalLahir: '',
      nik: '',
      agama: 'Islam',
      alamat: '',
      foto: '',
      kelas: defaultKelas
    };
    setRows([...rows, newRow]);
  };

  const handleAddMultipleRows = (count: number) => {
    const defaultKelas = rombelLabels[0] || `Kelas ${selectedGrade}A`;
    const newRows: Student[] = Array.from({ length: count }, (_, i) => ({
      id: `row-${Date.now()}-${rows.length + i}`,
      nama: '',
      nipd: '',
      jk: 'L',
      jenisKelamin: 'Laki-laki',
      nisn: '',
      tempatLahir: '',
      tanggalLahir: '',
      nik: '',
      agama: 'Islam',
      alamat: '',
      foto: '',
      kelas: defaultKelas
    }));
    setRows([...rows, ...newRows]);
  };

  const handleRowChange = (id: string, field: keyof Student, value: string) => {
    setRows(rows.map(row => {
      if (row.id !== id) return row;
      if (field === 'jk') {
        const normalizedJk = value.toUpperCase().startsWith('P') ? 'P' : 'L';
        return {
          ...row,
          jk: normalizedJk,
          jenisKelamin: normalizedJk === 'P' ? 'Perempuan' : 'Laki-laki'
        };
      }
      return { ...row, [field]: value };
    }));
  };

  const handleDeleteRow = (id: string) => {
    if (rows.length <= 1) {
      setRows([{
        id: `row-${Date.now()}`,
        nama: '',
        nipd: '',
        jk: 'L',
        jenisKelamin: 'Laki-laki',
        nisn: '',
        tempatLahir: '',
        tanggalLahir: '',
        nik: '',
        agama: 'Islam',
        alamat: '',
        foto: '',
        kelas: rombelLabels[0] || `Kelas ${selectedGrade}A`
      }]);
    } else {
      setRows(rows.filter(row => row.id !== id));
    }
  };

  const handleClearData = () => {
    if (window.confirm(`Apakah Anda yakin ingin mengosongkan semua data siswa untuk Kelas ${selectedGrade}?`)) {
      const resetRows: Student[] = Array.from({ length: 3 }, (_, i) => ({
        id: `row-${Date.now()}-${i}`,
        nama: '',
        nipd: '',
        jk: 'L',
        jenisKelamin: 'Laki-laki',
        nisn: '',
        tempatLahir: '',
        tanggalLahir: '',
        nik: '',
        agama: 'Islam',
        alamat: '',
        foto: '',
        kelas: rombelLabels[0] || `Kelas ${selectedGrade}A`
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

  // Handle direct paste on table inputs with Excel column mapping
  const handleInputPaste = (e: React.ClipboardEvent<HTMLInputElement>, startIdx: number, startCol: string) => {
    const clipboardData = e.clipboardData.getData('text');
    if (!clipboardData || !clipboardData.includes('\t')) return;
    
    e.preventDefault();
    const pastedLines = clipboardData.split(/\r?\n/).filter(line => line.trim() !== '');
    if (pastedLines.length === 0) return;

    const columnsOrder: (keyof Student)[] = [
      'nama', 'nipd', 'jk', 'nisn', 'tempatLahir', 'tanggalLahir', 'nik', 'agama', 'alamat'
    ];
    const startColIndex = columnsOrder.indexOf(startCol as keyof Student);
    if (startColIndex === -1) return;

    const newRows = [...rows];
    const defaultKelas = rombelLabels[0] || `Kelas ${selectedGrade}A`;

    pastedLines.forEach((line, lineIdx) => {
      const targetRowIdx = startIdx + lineIdx;
      const values = line.split('\t');

      // Expand rows if needed
      while (newRows.length <= targetRowIdx) {
        newRows.push({
          id: `row-${Date.now()}-${newRows.length}`,
          nama: '',
          nipd: '',
          jk: 'L',
          jenisKelamin: 'Laki-laki',
          nisn: '',
          tempatLahir: '',
          tanggalLahir: '',
          nik: '',
          agama: 'Islam',
          alamat: '',
          foto: '',
          kelas: defaultKelas
        });
      }

      values.forEach((val, valIdx) => {
        const colIndex = startColIndex + valIdx;
        if (colIndex < columnsOrder.length) {
          const field = columnsOrder[colIndex];
          const cleanVal = val.trim();
          if (field === 'jk') {
            const normalizedJk = cleanVal.toUpperCase().startsWith('P') ? 'P' : 'L';
            newRows[targetRowIdx] = {
              ...newRows[targetRowIdx],
              jk: normalizedJk,
              jenisKelamin: normalizedJk === 'P' ? 'Perempuan' : 'Laki-laki'
            };
          } else {
            newRows[targetRowIdx] = {
              ...newRows[targetRowIdx],
              [field]: cleanVal
            };
          }
        }
      });
    });

    setRows(newRows);
  };

  // Process paste from Modal (e.g. copied directly from Dapodik/Excel table)
  // Columns: No (optional) | Nama | NIPD | JK | NISN | Tempat Lahir | Tanggal Lahir | NIK | Agama | Alamat
  const handleProcessPasteModal = () => {
    if (!pasteText.trim()) {
      setIsPasteModalOpen(false);
      return;
    }

    const lines = pasteText.split(/\r?\n/).filter(l => l.trim() !== '');
    const defaultKelas = rombelLabels[0] || `Kelas ${selectedGrade}A`;

    const pastedStudents: Student[] = lines.map((line, i) => {
      const rawCols = line.split('\t').map(c => c.trim());
      
      // Determine if column 0 is a row number (e.g. '1', '2', '01'...)
      let cols = rawCols;
      if (rawCols.length >= 2 && /^\d+$/.test(rawCols[0]) && isNaN(Number(rawCols[1]))) {
        cols = rawCols.slice(1);
      }

      const rawJk = cols[2]?.toUpperCase() || '';
      const jkVal = rawJk.startsWith('P') ? 'P' : 'L';

      return {
        id: `row-pasted-${Date.now()}-${i}`,
        nama: cols[0] || '',
        nipd: cols[1] || '',
        jk: jkVal,
        jenisKelamin: jkVal === 'P' ? 'Perempuan' : 'Laki-laki',
        nisn: cols[3] || '',
        tempatLahir: cols[4] || '',
        tanggalLahir: cols[5] || '',
        nik: cols[6] || '',
        agama: cols[7] || 'Islam',
        alamat: cols[8] || '',
        foto: '',
        kelas: defaultKelas
      };
    });

    // Replace or append
    const nonBlankRows = rows.filter(r => r.nama.trim() !== '' || r.nisn.trim() !== '');
    if (nonBlankRows.length === 0) {
      setRows(pastedStudents);
    } else {
      setRows([...nonBlankRows, ...pastedStudents]);
    }

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

  // Export to Word Document (.docx) with the exact table columns and 3x4 photo embedding
  const exportToWord = async () => {
    setIsExporting(true);
    try {
      const activeStudents = rows.filter(r => 
        r.nama.trim() !== '' || r.nisn.trim() !== '' || r.nipd?.trim() !== ''
      );
      const dataToExport = activeStudents.length > 0 ? activeStudents : rows;

      // Define page dimensions (TWIPs: 1 inch = 1440 TWIPs)
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
        fill: "0F172A", // slate-900 / dark header
        type: ShadingType.CLEAR,
        color: "auto"
      };

      const cellBorders = {
        top: { style: BorderStyle.SINGLE, size: 2, color: "CBD5E1" },
        bottom: { style: BorderStyle.SINGLE, size: 2, color: "CBD5E1" },
        left: { style: BorderStyle.SINGLE, size: 2, color: "CBD5E1" },
        right: { style: BorderStyle.SINGLE, size: 2, color: "CBD5E1" },
      };

      // Col percentage widths for landscape layout:
      // Total: 4 + 17 + 8 + 5 + 9 + 10 + 10 + 12 + 7 + 11 + 7 = 100%
      const colWidths = [4, 17, 8, 5, 9, 10, 10, 12, 7, 11, 7];

      const createHeaderCell = (text: string, widthPct: number) => new TableCell({
        children: [
          new Paragraph({
            children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 18 })],
            alignment: AlignmentType.CENTER
          })
        ],
        shading: headerShading,
        borders: cellBorders,
        verticalAlign: VerticalAlign.CENTER,
        width: { size: widthPct, type: WidthType.PERCENTAGE },
        margins: { top: 120, bottom: 120, left: 60, right: 60 }
      });

      // Table Headers matching the user's image + Foto 3x4
      const headerRow = new TableRow({
        tableHeader: true,
        children: [
          createHeaderCell("No", colWidths[0]),
          createHeaderCell("Nama", colWidths[1]),
          createHeaderCell("NIPD", colWidths[2]),
          createHeaderCell("JK", colWidths[3]),
          createHeaderCell("NISN", colWidths[4]),
          createHeaderCell("Tempat Lahir", colWidths[5]),
          createHeaderCell("Tanggal Lahir", colWidths[6]),
          createHeaderCell("NIK", colWidths[7]),
          createHeaderCell("Agama", colWidths[8]),
          createHeaderCell("Alamat", colWidths[9]),
          createHeaderCell("Foto (3x4)", colWidths[10]),
        ]
      });

      // Data rows
      const dataRows = dataToExport.map((s, idx) => {
        let photoChildren: any[] = [
          new Paragraph({
            children: [new TextRun({ text: "[3x4]", color: "94A3B8", size: 16 })],
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
                      width: 48,  // 3x4 aspect ratio
                      height: 64
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

        const createDataCell = (text: string, widthPct: number, align: any = AlignmentType.LEFT) => new TableCell({
          children: [
            new Paragraph({
              children: [new TextRun({ text: text || '-', size: 18 })],
              alignment: align
            })
          ],
          borders: cellBorders,
          verticalAlign: VerticalAlign.CENTER,
          width: { size: widthPct, type: WidthType.PERCENTAGE },
          margins: { top: 80, bottom: 80, left: 60, right: 60 }
        });

        return new TableRow({
          children: [
            createDataCell((idx + 1).toString(), colWidths[0], AlignmentType.CENTER),
            createDataCell(s.nama, colWidths[1], AlignmentType.LEFT),
            createDataCell(s.nipd || '-', colWidths[2], AlignmentType.CENTER),
            createDataCell(s.jk || (s.jenisKelamin?.startsWith('P') ? 'P' : 'L'), colWidths[3], AlignmentType.CENTER),
            createDataCell(s.nisn || '-', colWidths[4], AlignmentType.CENTER),
            createDataCell(s.tempatLahir || '-', colWidths[5], AlignmentType.LEFT),
            createDataCell(s.tanggalLahir || '-', colWidths[6], AlignmentType.CENTER),
            createDataCell(s.nik || '-', colWidths[7], AlignmentType.CENTER),
            createDataCell(s.agama || 'Islam', colWidths[8], AlignmentType.CENTER),
            createDataCell(s.alamat || '-', colWidths[9], AlignmentType.LEFT),
            new TableCell({
              children: photoChildren,
              borders: cellBorders,
              verticalAlign: VerticalAlign.CENTER,
              width: { size: colWidths[10], type: WidthType.PERCENTAGE },
              margins: { top: 60, bottom: 60, left: 40, right: 40 }
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
                  top: 1000,
                  bottom: 1000,
                  left: 1000,
                  right: 1000
                }
              }
            },
            children: [
              // Header Titles at the VERY TOP of the document
              new Paragraph({
                children: [
                  new TextRun({
                    text: `DAFTAR SISWA KELAS ${selectedGrade}`,
                    bold: true,
                    size: 26
                  })
                ],
                alignment: AlignmentType.CENTER,
                spacing: { after: 100 }
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${profile?.namaSekolah || 'SEKOLAH DASAR'}`,
                    bold: true,
                    size: 22
                  })
                ],
                alignment: AlignmentType.CENTER,
                spacing: { after: 80 }
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Tahun Pelajaran: ${profile?.tahunPelajaran || '2025/2026'} | Semester: Ganjil & Genap`,
                    size: 20,
                    color: "334155"
                  })
                ],
                alignment: AlignmentType.CENTER,
                spacing: { after: 300 }
              }),

              // Data Table
              new Table({
                rows: [headerRow, ...dataRows],
                width: {
                  size: 100,
                  type: WidthType.PERCENTAGE
                }
              }),

              // Footer Signatures
              new Paragraph({ spacing: { before: 400 }, children: [] }),
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
                          new Paragraph({ children: [new TextRun({ text: "Mengetahui,", size: 20 })], alignment: AlignmentType.CENTER }),
                          new Paragraph({ children: [new TextRun({ text: `Kepala Sekolah ${profile?.namaSekolah || ''}`, bold: true, size: 20 })], alignment: AlignmentType.CENTER })
                        ]
                      }),
                      new TableCell({
                        children: [
                          new Paragraph({ children: [new TextRun({ text: `${profile?.namaSekolah?.split(' ')[1] || 'Tempat'}, ............................. 202...`, size: 20 })], alignment: AlignmentType.CENTER }),
                          new Paragraph({ children: [new TextRun({ text: "Guru PAI / Wali Kelas,", bold: true, size: 20 })], alignment: AlignmentType.CENTER })
                        ]
                      }),
                    ]
                  }),
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph({ spacing: { before: 700 } })] }),
                      new TableCell({ children: [new Paragraph({ spacing: { before: 700 } })] })
                    ]
                  }),
                  new TableRow({
                    children: [
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
              Kelola data lengkap peserta didik (NIPD, JK, NISN, NIK, Alamat, dan Foto 3x4), tempel langsung dari spreadsheet/Excel, serta ekspor dokumen Word siap cetak.
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

        {/* Rombel Configuration Card */}
        <div className="bg-white/60 border border-white/80 backdrop-blur-md rounded-3xl p-6 mb-6 shadow-sm">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <Layers size={18} className="text-emerald-600" />
                Pengaturan Rombongan Belajar (Rombel) Kelas {selectedGrade}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Tentukan jumlah rombel dan sesuaikan label setiap kelas (contoh: Kelas {selectedGrade}A, Kelas {selectedGrade}B).
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-slate-700">Jumlah Rombel:</label>
              <select
                value={jumlahRombel}
                onChange={(e) => handleJumlahRombelChange(parseInt(e.target.value))}
                className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                {[1, 2, 3, 4, 5, 6].map(n => (
                  <option key={n} value={n}>{n} Rombel</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {rombelLabels.map((label, idx) => (
              <div key={idx} className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500">Rombel {idx + 1} Label:</label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => handleLabelChange(idx, e.target.value)}
                  placeholder={`Kelas ${selectedGrade}${String.fromCharCode(65 + idx)}`}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            ))}
          </div>

          {/* Filter by Rombel */}
          {rombelLabels.length > 1 && (
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-500 mr-2">Filter Tampilan Rombel:</span>
              <button
                onClick={() => setSelectedRombelFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedRombelFilter === 'all'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                Semua Rombel ({rows.length})
              </button>
              {rombelLabels.map((lbl) => {
                const count = rows.filter(r => r.kelas === lbl).length;
                return (
                  <button
                    key={lbl}
                    onClick={() => setSelectedRombelFilter(lbl)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      selectedRombelFilter === lbl
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {lbl} ({count})
                  </button>
                );
              })}
            </div>
          )}
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
              <span>Daftar Siswa Kelas {selectedGrade} {selectedRombelFilter !== 'all' ? `(${selectedRombelFilter})` : ''}</span>
              <span className="text-xs text-slate-500 font-normal">
                ({rows.filter(r => selectedRombelFilter === 'all' || r.kelas === selectedRombelFilter).length} baris)
              </span>
            </div>

            <div className="text-xs text-slate-500 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 flex items-center gap-1.5">
              <Check size={14} className="text-emerald-600" />
              <span>Sesuai Format Lampiran Dapodik (Nama, NIPD, JK, NISN, Tempat Lahir, Tanggal Lahir, NIK, Agama, Alamat, Foto)</span>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[720px] overflow-y-auto rounded-2xl border border-slate-200/60 bg-white/70">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="sticky top-0 bg-slate-900 text-white z-10 shadow-sm">
                <tr>
                  <th className="p-3 font-bold uppercase tracking-wider w-10 text-center text-xs">No</th>
                  <th className="p-3 font-bold uppercase tracking-wider min-w-[200px] text-xs">Nama</th>
                  <th className="p-3 font-bold uppercase tracking-wider w-28 text-center text-xs">NIPD</th>
                  <th className="p-3 font-bold uppercase tracking-wider w-20 text-center text-xs">JK</th>
                  <th className="p-3 font-bold uppercase tracking-wider w-32 text-center text-xs">NISN</th>
                  <th className="p-3 font-bold uppercase tracking-wider min-w-[140px] text-xs">Tempat Lahir</th>
                  <th className="p-3 font-bold uppercase tracking-wider w-32 text-center text-xs">Tanggal Lahir</th>
                  <th className="p-3 font-bold uppercase tracking-wider w-40 text-center text-xs">NIK</th>
                  <th className="p-3 font-bold uppercase tracking-wider w-28 text-center text-xs">Agama</th>
                  <th className="p-3 font-bold uppercase tracking-wider min-w-[200px] text-xs">Alamat</th>
                  <th className="p-3 font-bold uppercase tracking-wider w-28 text-center text-xs">Foto (3x4)</th>
                  <th className="p-3 font-bold uppercase tracking-wider w-14 text-center text-xs">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 text-slate-700">
                {rows
                  .filter(row => selectedRombelFilter === 'all' || row.kelas === selectedRombelFilter)
                  .map((row, idx) => (
                  <tr
                    key={row.id}
                    className="hover:bg-emerald-50/30 transition-colors group"
                  >
                    {/* No */}
                    <td className="p-2 text-center font-bold text-slate-500 text-xs">
                      {idx + 1}
                    </td>

                    {/* Nama */}
                    <td className="p-1.5">
                      <input
                        type="text"
                        value={row.nama}
                        onChange={(e) => handleRowChange(row.id, 'nama', e.target.value)}
                        onPaste={(e) => handleInputPaste(e, idx, 'nama')}
                        placeholder="Nama Siswa..."
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white/80 border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all text-xs font-semibold text-slate-800"
                      />
                    </td>

                    {/* NIPD */}
                    <td className="p-1.5">
                      <input
                        type="text"
                        value={row.nipd || ''}
                        onChange={(e) => handleRowChange(row.id, 'nipd', e.target.value)}
                        onPaste={(e) => handleInputPaste(e, idx, 'nipd')}
                        placeholder="NIPD"
                        className="w-full px-2 py-1.5 text-center rounded-xl bg-white/80 border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all text-xs font-mono text-slate-700"
                      />
                    </td>

                    {/* JK */}
                    <td className="p-1.5">
                      <select
                        value={row.jk || (row.jenisKelamin?.startsWith('P') ? 'P' : 'L')}
                        onChange={(e) => handleRowChange(row.id, 'jk', e.target.value)}
                        className="w-full px-1.5 py-1.5 text-center rounded-xl bg-white border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all text-xs font-bold text-slate-800 cursor-pointer"
                      >
                        <option value="L">L</option>
                        <option value="P">P</option>
                      </select>
                    </td>

                    {/* NISN */}
                    <td className="p-1.5">
                      <input
                        type="text"
                        value={row.nisn}
                        onChange={(e) => handleRowChange(row.id, 'nisn', e.target.value)}
                        onPaste={(e) => handleInputPaste(e, idx, 'nisn')}
                        placeholder="NISN"
                        className="w-full px-2 py-1.5 text-center rounded-xl bg-white/80 border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all text-xs font-mono text-slate-700"
                      />
                    </td>

                    {/* Tempat Lahir */}
                    <td className="p-1.5">
                      <input
                        type="text"
                        value={row.tempatLahir || ''}
                        onChange={(e) => handleRowChange(row.id, 'tempatLahir', e.target.value)}
                        onPaste={(e) => handleInputPaste(e, idx, 'tempatLahir')}
                        placeholder="Tempat Lahir"
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white/80 border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all text-xs text-slate-700"
                      />
                    </td>

                    {/* Tanggal Lahir */}
                    <td className="p-1.5">
                      <input
                        type="text"
                        value={row.tanggalLahir}
                        onChange={(e) => handleRowChange(row.id, 'tanggalLahir', e.target.value)}
                        onPaste={(e) => handleInputPaste(e, idx, 'tanggalLahir')}
                        placeholder="DD/MM/YYYY"
                        className="w-full px-2 py-1.5 text-center rounded-xl bg-white/80 border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all text-xs text-slate-700 font-mono"
                      />
                    </td>

                    {/* NIK */}
                    <td className="p-1.5">
                      <input
                        type="text"
                        value={row.nik || ''}
                        onChange={(e) => handleRowChange(row.id, 'nik', e.target.value)}
                        onPaste={(e) => handleInputPaste(e, idx, 'nik')}
                        placeholder="NIK (16 Digit)"
                        className="w-full px-2 py-1.5 text-center rounded-xl bg-white/80 border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all text-xs font-mono text-slate-700"
                      />
                    </td>

                    {/* Agama */}
                    <td className="p-1.5">
                      <select
                        value={row.agama || 'Islam'}
                        onChange={(e) => handleRowChange(row.id, 'agama', e.target.value)}
                        className="w-full px-2 py-1.5 text-center rounded-xl bg-white border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all text-xs font-semibold text-slate-800 cursor-pointer"
                      >
                        <option value="Islam">Islam</option>
                        <option value="Kristen">Kristen</option>
                        <option value="Katolik">Katolik</option>
                        <option value="Hindu">Hindu</option>
                        <option value="Buddha">Buddha</option>
                        <option value="Konghucu">Konghucu</option>
                      </select>
                    </td>

                    {/* Alamat */}
                    <td className="p-1.5">
                      <input
                        type="text"
                        value={row.alamat}
                        onChange={(e) => handleRowChange(row.id, 'alamat', e.target.value)}
                        onPaste={(e) => handleInputPaste(e, idx, 'alamat')}
                        placeholder="Alamat tempat tinggal..."
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white/80 border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all text-xs text-slate-700"
                      />
                    </td>

                    {/* Foto Siswa (3x4 ratio) */}
                    <td className="p-1.5 text-center">
                      <div className="flex flex-col items-center justify-center">
                        {row.foto ? (
                          <div className="relative group/foto w-11 h-[58px] rounded-lg overflow-hidden border-2 border-emerald-500 bg-slate-100 shadow-sm mx-auto">
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
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => fileInputRefs.current[row.id]?.click()}
                            className="w-11 h-[58px] rounded-lg border border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50/80 hover:bg-emerald-50/50 flex flex-col items-center justify-center transition-colors text-slate-400 hover:text-emerald-600 gap-0.5"
                          >
                            <ImageIcon size={14} />
                            <span className="text-[9px] font-bold">3x4</span>
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
                    <td className="p-1.5 text-center">
                      <button
                        onClick={() => handleDeleteRow(row.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
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
                    Susunan Kolom yang Didukung:
                  </p>
                  <p className="leading-relaxed font-mono text-[11px] bg-white/80 p-2 rounded-xl border border-emerald-200 mb-2">
                    [No] &nbsp;|&nbsp; <strong>Nama</strong> &nbsp;|&nbsp; <strong>NIPD</strong> &nbsp;|&nbsp; <strong>JK (L/P)</strong> &nbsp;|&nbsp; <strong>NISN</strong> &nbsp;|&nbsp; <strong>Tempat Lahir</strong> &nbsp;|&nbsp; <strong>Tanggal Lahir</strong> &nbsp;|&nbsp; <strong>NIK</strong> &nbsp;|&nbsp; <strong>Agama</strong> &nbsp;|&nbsp; <strong>Alamat</strong>
                  </p>
                  <p className="leading-relaxed">
                    Cukup salin (Copy / Ctrl+C) tabel dari Excel atau Dapodik Anda, lalu tempelkan (Paste / Ctrl+V) pada kotak teks di bawah ini. Sistem secara otomatis mendeteksi kolom dan mengisi data ke tabel siswa.
                  </p>
                </div>

                <textarea
                  rows={8}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder="Tempelkan data yang Anda copy dari Excel di sini..."
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
                  Pilih ukuran kertas (A4 atau F4/Folio) dan orientasi halaman. Dokumen akan dilengkapi judul kelas, tahun ajaran, semester di bagian atas, tabel data rapi, serta foto siswa 3x4.
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
