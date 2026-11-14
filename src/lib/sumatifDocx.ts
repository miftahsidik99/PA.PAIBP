import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  PageOrientation,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';
import { saveAs } from 'file-saver';
import {
  SumatifDocument,
  SumatifIsianItem,
  SumatifPgItem,
  SumatifUraianItem,
  UserProfile,
} from '../store/useStore';

const ALL_BORDERS = {
  top: { style: BorderStyle.SINGLE, size: 4, color: '1E293B' },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: '1E293B' },
  left: { style: BorderStyle.SINGLE, size: 4, color: '1E293B' },
  right: { style: BorderStyle.SINGLE, size: 4, color: '1E293B' },
};

const NO_BORDERS = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
};

function getPageDimensions(paperSize: 'A4' | 'F4', landscape = false) {
  const w = paperSize === 'F4' ? 12240 : 11906;
  const h = paperSize === 'F4' ? 18720 : 16838;
  return {
    width: landscape ? h : w,
    height: landscape ? w : h,
  };
}

function getSafeFileName(doc: SumatifDocument, part: string): string {
  const safeJenis = doc.jenisSumatif.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safePart = part.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${safePart}_${safeJenis}_Kelas_${doc.grade}_PAI_BP.docx`;
}

export async function svgToPngBytes(
  svgString?: string,
  width = 460,
  height = 245
): Promise<Uint8Array | null> {
  if (!svgString || !svgString.trim().startsWith('<svg')) return null;

  try {
    let normalizedSvg = svgString.trim();
    if (!normalizedSvg.includes('xmlns=')) {
      normalizedSvg = normalizedSvg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }

    const svgBlob = new Blob([normalizedSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        const timer = setTimeout(() => reject(new Error('SVG load timeout')), 4000);
        image.onload = () => {
          clearTimeout(timer);
          resolve(image);
        };
        image.onerror = () => {
          clearTimeout(timer);
          reject(new Error('SVG load error'));
        };
        image.src = url;
      });

      const canvas = document.createElement('canvas');
      canvas.width = width * 2;
      canvas.height = height * 2;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const pngBlob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((blob) => resolve(blob), 'image/png')
      );
      if (!pngBlob) return null;
      const buf = await pngBlob.arrayBuffer();
      return new Uint8Array(buf);
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch (err) {
    console.warn('svgToPngBytes failed, skipping illustration in Word:', err);
    return null;
  }
}

function createHeaderCell(text: string, widthPct: number, font: string, sizeHalfPt: number) {
  return new TableCell({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    shading: { fill: 'E2E8F0', color: 'auto' },
    borders: ALL_BORDERS,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 100, bottom: 100, left: 90, right: 90 },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text, bold: true, font, size: sizeHalfPt })],
      }),
    ],
  });
}

function createBodyCell(
  text: string,
  widthPct: number,
  font: string,
  sizeHalfPt: number,
  align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT,
  bold = false
) {
  return new TableCell({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    borders: ALL_BORDERS,
    verticalAlign: VerticalAlign.TOP,
    margins: { top: 80, bottom: 80, left: 90, right: 90 },
    children: [
      new Paragraph({
        alignment: align,
        children: [new TextRun({ text: text || '-', font, size: sizeHalfPt, bold })],
      }),
    ],
  });
}

function createKopParagraphs(
  doc: SumatifDocument,
  profile: UserProfile | null,
  subtitle: string
): Paragraph[] {
  const font = doc.configSnapshot.fontFamily;
  const baseHalfPt = doc.configSnapshot.fontSize * 2;
  const sekolah = (profile?.namaSekolah || 'SD NEGERI / SWASTA').toUpperCase();
  const tahun = profile?.tahunPelajaran || '2026/2027';

  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: subtitle.toUpperCase(),
          bold: true,
          font,
          size: baseHalfPt + 6,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: `${doc.judulAsesmen.toUpperCase()} — TAHUN PELAJARAN ${tahun}`,
          bold: true,
          font,
          size: baseHalfPt + 2,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 140 },
      border: {
        bottom: { style: BorderStyle.DOUBLE, size: 8, color: '0F172A' },
      },
      children: [
        new TextRun({
          text: `${sekolah}  |  MATA PELAJARAN: PENDIDIKAN AGAMA ISLAM DAN BUDI PEKERTI  |  KELAS ${doc.grade}`,
          bold: true,
          font,
          size: Math.max(18, baseHalfPt - 2),
        }),
      ],
    }),
  ];
}

function createSignatureTable(doc: SumatifDocument, profile: UserProfile | null): Table {
  const font = doc.configSnapshot.fontFamily;
  const size = doc.configSnapshot.fontSize * 2;
  const namaKepsek = profile?.namaKepalaSekolah || '..........................................';
  const nipKepsek = profile?.nipKepalaSekolah ? `NIP. ${profile.nipKepalaSekolah}` : 'NIP. .................................';
  const namaGuru = profile?.namaGuru || '..........................................';
  const nipGuru = profile?.nip ? `NIP. ${profile.nip}` : 'NIP. .................................';
  const tanggalText = doc.configSnapshot.tanggalPelaksanaan
    ? doc.configSnapshot.tanggalPelaksanaan
    : '........................ 2026';

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: NO_BORDERS,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: 'Mengetahui,', font, size })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 720 },
                children: [new TextRun({ text: 'Kepala Sekolah', font, size })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: namaKepsek, bold: true, underline: {}, font, size })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: nipKepsek, font, size: Math.max(18, size - 2) })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: NO_BORDERS,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: `.................., ${tanggalText}`, font, size })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 720 },
                children: [new TextRun({ text: 'Guru Mata Pelajaran PAI BP', font, size })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: namaGuru, bold: true, underline: {}, font, size })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: nipGuru, font, size: Math.max(18, size - 2) })],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function createArabicParagraph(teksArab: string, baseFontSizePt: number): Paragraph {
  const arabHalfPt = Math.max(28, (baseFontSizePt + 4) * 2);
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    bidirectional: true,
    spacing: { before: 80, after: 100 },
    children: [
      new TextRun({
        text: teksArab,
        font: 'Traditional Arabic',
        size: arabHalfPt,
        rightToLeft: true,
      }),
    ],
  });
}

async function buildKisiKisiChildren(
  doc: SumatifDocument,
  profile: UserProfile | null
): Promise<(Paragraph | Table)[]> {
  const font = doc.configSnapshot.fontFamily;
  const tableFontSize = Math.max(18, (doc.configSnapshot.fontSize - 1) * 2);
  const bodySize = doc.configSnapshot.fontSize * 2;
  const fase = doc.grade <= 2 ? 'A' : doc.grade <= 4 ? 'B' : 'C';

  const infoTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: NO_BORDERS,
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: `Satuan Pendidikan : ${profile?.namaSekolah || '-'}`, font, size: bodySize }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: 'Mata Pelajaran      : Pendidikan Agama Islam & Budi Pekerti', font, size: bodySize }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: `Kelas / Fase         : Kelas ${doc.grade} SD / Fase ${fase}`, font, size: bodySize }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: NO_BORDERS,
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: `Jenis Asesmen   : ${doc.jenisSumatif} (${doc.semesterLabel})`, font, size: bodySize }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: `Tahun Pelajaran : ${profile?.tahunPelajaran || '2026/2027'}`, font, size: bodySize }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Acuan Kurikulum : PPA Jenjang SD Tahun 2026 (${doc.soalPg.length} PG, ${doc.soalIsian.length} Isian, ${doc.soalUraian.length} Uraian)`,
                    font,
                    size: bodySize,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const colWidths = [4, 10, 16, 16, 11, 19, 7, 7, 6, 4];
  const kisiTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          createHeaderCell('No', colWidths[0], font, tableFontSize),
          createHeaderCell('Elemen', colWidths[1], font, tableFontSize),
          createHeaderCell('Capaian Pembelajaran', colWidths[2], font, tableFontSize),
          createHeaderCell('TP / ATP (Prota Terkunci)', colWidths[3], font, tableFontSize),
          createHeaderCell('Materi Pokok', colWidths[4], font, tableFontSize),
          createHeaderCell('Indikator Soal', colWidths[5], font, tableFontSize),
          createHeaderCell('Level', colWidths[6], font, tableFontSize),
          createHeaderCell('Kesulitan', colWidths[7], font, tableFontSize),
          createHeaderCell('Bentuk', colWidths[8], font, tableFontSize),
          createHeaderCell('No. Soal', colWidths[9], font, tableFontSize),
        ],
      }),
      ...doc.kisiKisi.map(
        (item) =>
          new TableRow({
            children: [
              createBodyCell(String(item.no), colWidths[0], font, tableFontSize, AlignmentType.CENTER),
              createBodyCell(item.elemen, colWidths[1], font, tableFontSize),
              createBodyCell(item.cp, colWidths[2], font, tableFontSize),
              createBodyCell(item.tpAtp, colWidths[3], font, tableFontSize),
              createBodyCell(item.materiPokok, colWidths[4], font, tableFontSize),
              createBodyCell(item.indikatorSoal, colWidths[5], font, tableFontSize),
              createBodyCell(item.levelKognitif, colWidths[6], font, tableFontSize, AlignmentType.CENTER),
              createBodyCell(item.kategoriKesulitan, colWidths[7], font, tableFontSize, AlignmentType.CENTER, true),
              createBodyCell(item.bentukSoal, colWidths[8], font, tableFontSize, AlignmentType.CENTER),
              createBodyCell(String(item.nomorSoal), colWidths[9], font, tableFontSize, AlignmentType.CENTER, true),
            ],
          })
      ),
    ],
  });

  const lotsCount = doc.kisiKisi.filter((k) => k.kategoriKesulitan === 'LOTS').length;
  const motsCount = doc.kisiKisi.filter((k) => k.kategoriKesulitan === 'MOTS').length;
  const hotsCount = doc.kisiKisi.filter((k) => k.kategoriKesulitan === 'HOTS').length;

  return [
    ...createKopParagraphs(doc, profile, 'KISI-KISI PENULISAN SOAL ASESMEN SUMATIF'),
    infoTable,
    new Paragraph({ spacing: { before: 120, after: 80 }, children: [] }),
    kisiTable,
    new Paragraph({
      spacing: { before: 140, after: 140 },
      children: [
        new TextRun({
          text: `Rekapitulasi Komposisi Soal: Total ${doc.kisiKisi.length} Butir — LOTS: ${lotsCount} butir, MOTS: ${motsCount} butir, HOTS: ${hotsCount} butir.`,
          bold: true,
          font,
          size: bodySize,
        }),
      ],
    }),
    createSignatureTable(doc, profile),
  ];
}

async function buildItemVisualBlocks(
  item: SumatifPgItem | SumatifIsianItem | SumatifUraianItem,
  font: string,
  baseFontSizePt: number
): Promise<Paragraph[]> {
  const blocks: Paragraph[] = [];
  const baseHalfPt = baseFontSizePt * 2;

  if (item.stimulus && item.stimulus.trim()) {
    blocks.push(
      new Paragraph({
        spacing: { before: 60, after: 60 },
        indent: { left: 360 },
        children: [
          new TextRun({
            text: item.stimulus.trim(),
            italics: true,
            font,
            size: baseHalfPt,
          }),
        ],
      })
    );
  }

  if (item.svgIllustration && item.svgIllustration.trim()) {
    const pngBytes = await svgToPngBytes(item.svgIllustration, 380, 200);
    if (pngBytes) {
      blocks.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 80, after: 40 },
          children: [
            new ImageRun({
              type: 'png',
              data: pngBytes,
              transformation: { width: 300, height: 158 },
            }),
          ],
        })
      );
      if (item.illustrationCaption) {
        blocks.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: item.illustrationCaption,
                italics: true,
                font,
                size: Math.max(18, baseHalfPt - 2),
              }),
            ],
          })
        );
      }
    }
  }

  if (item.teksArab && item.teksArab.trim()) {
    blocks.push(createArabicParagraph(item.teksArab.trim(), baseFontSizePt));
  }

  return blocks;
}

async function buildNaskahSoalChildren(
  doc: SumatifDocument,
  profile: UserProfile | null
): Promise<(Paragraph | Table)[]> {
  const font = doc.configSnapshot.fontFamily;
  const baseFontSizePt = doc.configSnapshot.fontSize;
  const baseHalfPt = baseFontSizePt * 2;
  const optionLayout = doc.configSnapshot.optionLayout;
  const fase = doc.grade <= 2 ? 'A' : doc.grade <= 4 ? 'B' : 'C';

  const identityBox = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 55, type: WidthType.PERCENTAGE },
            borders: ALL_BORDERS,
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [
              new Paragraph({
                children: [new TextRun({ text: 'Nama Siswa      : ....................................................', font, size: baseHalfPt })],
              }),
              new Paragraph({
                children: [new TextRun({ text: 'No. Absen/Ujian : ....................................................', font, size: baseHalfPt })],
              }),
              new Paragraph({
                children: [new TextRun({ text: `Kelas / Fase       : ${doc.grade} SD / Fase ${fase}`, font, size: baseHalfPt })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 45, type: WidthType.PERCENTAGE },
            borders: ALL_BORDERS,
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Hari / Tanggal : ${doc.configSnapshot.tanggalPelaksanaan || '..............................'}`,
                    font,
                    size: baseHalfPt,
                  }),
                ],
              }),
              new Paragraph({
                children: [new TextRun({ text: `Waktu              : ${doc.configSnapshot.waktuMenit} Menit`, font, size: baseHalfPt })],
              }),
              new Paragraph({
                children: [new TextRun({ text: `Semester          : ${doc.semesterLabel}`, font, size: baseHalfPt })],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const children: (Paragraph | Table)[] = [
    ...createKopParagraphs(doc, profile, 'NASKAH SOAL ASESMEN SUMATIF'),
    identityBox,
    new Paragraph({
      spacing: { before: 120, after: 40 },
      children: [new TextRun({ text: 'Petunjuk Umum:', bold: true, font, size: baseHalfPt })],
    }),
    new Paragraph({
      spacing: { after: 30 },
      children: [new TextRun({ text: '1. Mulailah dengan membaca Basmalah dan berdoa sebelum mengerjakan soal.', font, size: baseHalfPt })],
    }),
    new Paragraph({
      spacing: { after: 30 },
      children: [new TextRun({ text: '2. Tulislah nama lengkap dan nomor absen pada kolom yang tersedia.', font, size: baseHalfPt })],
    }),
    new Paragraph({
      spacing: { after: 140 },
      children: [new TextRun({ text: '3. Kerjakan dengan jujur, teliti, dan periksalah kembali jawabanmu sebelum dikumpulkan.', font, size: baseHalfPt })],
    }),
  ];

  // Section I: Pilihan Ganda
  if (doc.soalPg.length > 0) {
    children.push(
      new Paragraph({
        spacing: { before: 80, after: 100 },
        children: [
          new TextRun({
            text: 'I. Berilah tanda silang (X) pada huruf A, B, C, atau D pada jawaban yang paling benar!',
            bold: true,
            font,
            size: baseHalfPt,
          }),
        ],
      })
    );

    for (const item of doc.soalPg) {
      const visuals = await buildItemVisualBlocks(item, font, baseFontSizePt);
      children.push(...visuals);

      children.push(
        new Paragraph({
          spacing: { before: 80, after: 60 },
          indent: { left: 360, hanging: 360 },
          children: [
            new TextRun({ text: `${item.nomor}.  `, bold: true, font, size: baseHalfPt }),
            new TextRun({ text: item.pertanyaan, font, size: baseHalfPt }),
          ],
        })
      );

      if (optionLayout === 'horizontal') {
        children.push(
          new Table({
            width: { size: 95, type: WidthType.PERCENTAGE },
            indent: { size: 360, type: WidthType.DXA },
            rows: [
              new TableRow({
                children: (['A', 'B', 'C', 'D'] as const).map(
                  (key) =>
                    new TableCell({
                      width: { size: 25, type: WidthType.PERCENTAGE },
                      borders: NO_BORDERS,
                      margins: { top: 20, bottom: 80, left: 40, right: 60 },
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({ text: `${key}. `, bold: true, font, size: baseHalfPt }),
                            new TextRun({ text: item.opsi[key], font, size: baseHalfPt }),
                          ],
                        }),
                      ],
                    })
                ),
              }),
            ],
          })
        );
      } else {
        (['A', 'B', 'C', 'D'] as const).forEach((key, optIdx) => {
          children.push(
            new Paragraph({
              spacing: { after: optIdx === 3 ? 100 : 30 },
              indent: { left: 720, hanging: 360 },
              children: [
                new TextRun({ text: `${key}.  `, bold: true, font, size: baseHalfPt }),
                new TextRun({ text: item.opsi[key], font, size: baseHalfPt }),
              ],
            })
          );
        });
      }
    }
  }

  // Section II: Isian Singkat
  if (doc.soalIsian.length > 0) {
    children.push(
      new Paragraph({
        spacing: { before: 160, after: 100 },
        children: [
          new TextRun({
            text: 'II. Isilah titik-titik di bawah ini dengan jawaban yang singkat dan tepat!',
            bold: true,
            font,
            size: baseHalfPt,
          }),
        ],
      })
    );

    for (const item of doc.soalIsian) {
      const visuals = await buildItemVisualBlocks(item, font, baseFontSizePt);
      children.push(...visuals);
      children.push(
        new Paragraph({
          spacing: { before: 60, after: 80 },
          indent: { left: 360, hanging: 360 },
          children: [
            new TextRun({ text: `${item.nomor}.  `, bold: true, font, size: baseHalfPt }),
            new TextRun({ text: `${item.pertanyaan}  ........................................................`, font, size: baseHalfPt }),
          ],
        })
      );
    }
  }

  // Section III: Uraian
  if (doc.soalUraian.length > 0) {
    children.push(
      new Paragraph({
        spacing: { before: 160, after: 100 },
        children: [
          new TextRun({
            text: 'III. Jawablah pertanyaan-pertanyaan berikut ini dengan jelas dan benar!',
            bold: true,
            font,
            size: baseHalfPt,
          }),
        ],
      })
    );

    for (const item of doc.soalUraian) {
      const visuals = await buildItemVisualBlocks(item, font, baseFontSizePt);
      children.push(...visuals);
      children.push(
        new Paragraph({
          spacing: { before: 60, after: 40 },
          indent: { left: 360, hanging: 360 },
          children: [
            new TextRun({ text: `${item.nomor}.  `, bold: true, font, size: baseHalfPt }),
            new TextRun({ text: item.pertanyaan, font, size: baseHalfPt }),
          ],
        })
      );
      children.push(
        new Paragraph({
          indent: { left: 360 },
          spacing: { after: 30 },
          children: [new TextRun({ text: 'Jawab: .........................................................................................................................', font, size: baseHalfPt })],
        }),
        new Paragraph({
          indent: { left: 360 },
          spacing: { after: 80 },
          children: [new TextRun({ text: '.......................................................................................................................................', font, size: baseHalfPt })],
        })
      );
    }
  }

  return children;
}

function buildKunciJawabanChildren(
  doc: SumatifDocument,
  profile: UserProfile | null
): (Paragraph | Table)[] {
  const font = doc.configSnapshot.fontFamily;
  const size = doc.configSnapshot.fontSize * 2;
  const smallSize = Math.max(18, size - 2);

  const children: (Paragraph | Table)[] = [
    ...createKopParagraphs(doc, profile, 'KUNCI JAWABAN DAN PEMBAHASAN'),
  ];

  if (doc.soalPg.length > 0) {
    children.push(
      new Paragraph({
        spacing: { before: 80, after: 80 },
        children: [new TextRun({ text: 'I. Kunci Jawaban Pilihan Ganda', bold: true, font, size })],
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            tableHeader: true,
            children: [
              createHeaderCell('No', 8, font, smallSize),
              createHeaderCell('Kunci', 10, font, smallSize),
              createHeaderCell('Level / Kesulitan', 18, font, smallSize),
              createHeaderCell('Pembahasan Singkat', 64, font, smallSize),
            ],
          }),
          ...doc.soalPg.map(
            (item) =>
              new TableRow({
                children: [
                  createBodyCell(String(item.nomor), 8, font, smallSize, AlignmentType.CENTER),
                  createBodyCell(item.kunciJawaban, 10, font, smallSize, AlignmentType.CENTER, true),
                  createBodyCell(`${item.levelKognitif} (${item.kategoriKesulitan})`, 18, font, smallSize, AlignmentType.CENTER),
                  createBodyCell(item.pembahasan, 64, font, smallSize),
                ],
              })
          ),
        ],
      })
    );
  }

  if (doc.soalIsian.length > 0) {
    children.push(
      new Paragraph({
        spacing: { before: 160, after: 80 },
        children: [new TextRun({ text: 'II. Kunci Jawaban Isian Singkat', bold: true, font, size })],
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            tableHeader: true,
            children: [
              createHeaderCell('No', 8, font, smallSize),
              createHeaderCell('Kunci Jawaban', 42, font, smallSize),
              createHeaderCell('Skor Maks', 12, font, smallSize),
              createHeaderCell('Pedoman Penskoran', 38, font, smallSize),
            ],
          }),
          ...doc.soalIsian.map(
            (item) =>
              new TableRow({
                children: [
                  createBodyCell(String(item.nomor), 8, font, smallSize, AlignmentType.CENTER),
                  createBodyCell(item.kunciJawaban, 42, font, smallSize, AlignmentType.LEFT, true),
                  createBodyCell(String(item.skorMaksimal), 12, font, smallSize, AlignmentType.CENTER),
                  createBodyCell(item.pedomanPenskoran, 38, font, smallSize),
                ],
              })
          ),
        ],
      })
    );
  }

  if (doc.soalUraian.length > 0) {
    children.push(
      new Paragraph({
        spacing: { before: 160, after: 80 },
        children: [new TextRun({ text: 'III. Kunci Jawaban Uraian', bold: true, font, size })],
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            tableHeader: true,
            children: [
              createHeaderCell('No', 8, font, smallSize),
              createHeaderCell('Uraian Jawaban yang Diharapkan', 77, font, smallSize),
              createHeaderCell('Skor Maks', 15, font, smallSize),
            ],
          }),
          ...doc.soalUraian.map(
            (item) =>
              new TableRow({
                children: [
                  createBodyCell(String(item.nomor), 8, font, smallSize, AlignmentType.CENTER),
                  createBodyCell(item.kunciJawaban, 77, font, smallSize),
                  createBodyCell(String(item.skorMaksimal), 15, font, smallSize, AlignmentType.CENTER, true),
                ],
              })
          ),
        ],
      })
    );
  }

  children.push(new Paragraph({ spacing: { before: 180 }, children: [] }), createSignatureTable(doc, profile));
  return children;
}

function buildRubrikPenskoranChildren(
  doc: SumatifDocument,
  profile: UserProfile | null
): (Paragraph | Table)[] {
  const font = doc.configSnapshot.fontFamily;
  const size = doc.configSnapshot.fontSize * 2;
  const smallSize = Math.max(18, size - 2);
  const { rubrikUmum } = doc;

  const children: (Paragraph | Table)[] = [
    ...createKopParagraphs(doc, profile, 'RUBRIK PENILAIAN DAN PEDOMAN PENSKORAN (PPA SD 2026)'),
    new Paragraph({
      spacing: { before: 60, after: 80 },
      children: [new TextRun({ text: 'A. Rekapitulasi Bobot & Skor Maksimal', bold: true, font, size })],
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            createHeaderCell('Bentuk Soal', 34, font, smallSize),
            createHeaderCell('Jumlah Butir', 22, font, smallSize),
            createHeaderCell('Skor per Butir', 22, font, smallSize),
            createHeaderCell('Total Skor Maksimal', 22, font, smallSize),
          ],
        }),
        new TableRow({
          children: [
            createBodyCell('Pilihan Ganda', 34, font, smallSize),
            createBodyCell(String(doc.soalPg.length), 22, font, smallSize, AlignmentType.CENTER),
            createBodyCell(`${rubrikUmum.bobotPgPerSoal} (benar = 1, salah = 0)`, 22, font, smallSize, AlignmentType.CENTER),
            createBodyCell(String(rubrikUmum.skorMaksPg), 22, font, smallSize, AlignmentType.CENTER, true),
          ],
        }),
        new TableRow({
          children: [
            createBodyCell('Isian Singkat', 34, font, smallSize),
            createBodyCell(String(doc.soalIsian.length), 22, font, smallSize, AlignmentType.CENTER),
            createBodyCell('Sesuai rubrik (rata-rata 2)', 22, font, smallSize, AlignmentType.CENTER),
            createBodyCell(String(rubrikUmum.skorMaksIsian), 22, font, smallSize, AlignmentType.CENTER, true),
          ],
        }),
        new TableRow({
          children: [
            createBodyCell('Uraian', 34, font, smallSize),
            createBodyCell(String(doc.soalUraian.length), 22, font, smallSize, AlignmentType.CENTER),
            createBodyCell('Sesuai rubrik analitik', 22, font, smallSize, AlignmentType.CENTER),
            createBodyCell(String(rubrikUmum.skorMaksUraian), 22, font, smallSize, AlignmentType.CENTER, true),
          ],
        }),
        new TableRow({
          children: [
            createBodyCell('TOTAL SKOR MAKSIMAL', 34, font, smallSize, AlignmentType.LEFT, true),
            createBodyCell(
              String(doc.soalPg.length + doc.soalIsian.length + doc.soalUraian.length),
              22,
              font,
              smallSize,
              AlignmentType.CENTER,
              true
            ),
            createBodyCell('-', 22, font, smallSize, AlignmentType.CENTER),
            createBodyCell(String(rubrikUmum.totalSkorMaksimal), 22, font, smallSize, AlignmentType.CENTER, true),
          ],
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 120, after: 120 },
      children: [
        new TextRun({ text: 'Rumus Pengolahan Nilai Akhir: ', bold: true, font, size }),
        new TextRun({ text: rubrikUmum.rumusNilaiAkhir, bold: true, font, size }),
      ],
    }),
  ];

  if (doc.soalUraian.length > 0) {
    children.push(
      new Paragraph({
        spacing: { before: 80, after: 80 },
        children: [new TextRun({ text: 'B. Rubrik Penilaian Analitik Soal Uraian', bold: true, font, size })],
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            tableHeader: true,
            children: [
              createHeaderCell('No. Uraian', 12, font, smallSize),
              createHeaderCell('Pertanyaan Ringkas', 33, font, smallSize),
              createHeaderCell('Skor', 10, font, smallSize),
              createHeaderCell('Kriteria Penskoran', 45, font, smallSize),
            ],
          }),
          ...doc.soalUraian.flatMap((u) =>
            u.rubrikPenskoran.map(
              (r, idx) =>
                new TableRow({
                  children: [
                    createBodyCell(idx === 0 ? String(u.nomor) : '', 12, font, smallSize, AlignmentType.CENTER, true),
                    createBodyCell(idx === 0 ? u.pertanyaan : '', 33, font, smallSize),
                    createBodyCell(String(r.skor), 10, font, smallSize, AlignmentType.CENTER, true),
                    createBodyCell(r.kriteria, 45, font, smallSize),
                  ],
                })
            )
          ),
        ],
      })
    );
  }

  children.push(
    new Paragraph({
      spacing: { before: 140, after: 80 },
      children: [
        new TextRun({
          text: 'C. Interval KKTP & Tindak Lanjut (PPA Jenjang SD Tahun 2026)',
          bold: true,
          font,
          size,
        }),
      ],
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            createHeaderCell('Interval Nilai', 18, font, smallSize),
            createHeaderCell('Predikat KKTP', 24, font, smallSize),
            createHeaderCell('Deskripsi & Tindak Lanjut (Remedial / Pengayaan)', 58, font, smallSize),
          ],
        }),
        ...rubrikUmum.intervalKktp.map(
          (row) =>
            new TableRow({
              children: [
                createBodyCell(row.rentang, 18, font, smallSize, AlignmentType.CENTER, true),
                createBodyCell(row.predikat, 24, font, smallSize, AlignmentType.CENTER, true),
                createBodyCell(row.tindakLanjut, 58, font, smallSize),
              ],
            })
        ),
      ],
    }),
    new Paragraph({ spacing: { before: 180 }, children: [] }),
    createSignatureTable(doc, profile)
  );

  return children;
}

export async function downloadKisiKisiDocx(doc: SumatifDocument, profile: UserProfile | null) {
  const size = getPageDimensions(doc.configSnapshot.paperSize, true);
  const children = await buildKisiKisiChildren(doc, profile);
  const wordDoc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { ...size, orientation: PageOrientation.LANDSCAPE },
            margin: { top: 720, bottom: 720, left: 720, right: 720 },
          },
        },
        children,
      },
    ],
  });
  const blob = await Packer.toBlob(wordDoc);
  saveAs(blob, getSafeFileName(doc, '1_Kisi_Kisi'));
}

export async function downloadNaskahSoalDocx(doc: SumatifDocument, profile: UserProfile | null) {
  const size = getPageDimensions(doc.configSnapshot.paperSize, false);
  const children = await buildNaskahSoalChildren(doc, profile);
  const wordDoc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { ...size, orientation: PageOrientation.PORTRAIT },
            margin: { top: 720, bottom: 720, left: 850, right: 850 },
          },
        },
        children,
      },
    ],
  });
  const blob = await Packer.toBlob(wordDoc);
  saveAs(blob, getSafeFileName(doc, '2_Naskah_Soal'));
}

export async function downloadKunciJawabanDocx(doc: SumatifDocument, profile: UserProfile | null) {
  const size = getPageDimensions(doc.configSnapshot.paperSize, false);
  const children = buildKunciJawabanChildren(doc, profile);
  const wordDoc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { ...size, orientation: PageOrientation.PORTRAIT },
            margin: { top: 720, bottom: 720, left: 850, right: 850 },
          },
        },
        children,
      },
    ],
  });
  const blob = await Packer.toBlob(wordDoc);
  saveAs(blob, getSafeFileName(doc, '3_Kunci_Jawaban'));
}

export async function downloadRubrikPenskoranDocx(doc: SumatifDocument, profile: UserProfile | null) {
  const size = getPageDimensions(doc.configSnapshot.paperSize, false);
  const children = buildRubrikPenskoranChildren(doc, profile);
  const wordDoc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { ...size, orientation: PageOrientation.PORTRAIT },
            margin: { top: 720, bottom: 720, left: 850, right: 850 },
          },
        },
        children,
      },
    ],
  });
  const blob = await Packer.toBlob(wordDoc);
  saveAs(blob, getSafeFileName(doc, '4_Rubrik_Penskoran'));
}

export async function downloadPaketLengkapDocx(doc: SumatifDocument, profile: UserProfile | null) {
  const landscapeSize = getPageDimensions(doc.configSnapshot.paperSize, true);
  const portraitSize = getPageDimensions(doc.configSnapshot.paperSize, false);

  const [kisiChildren, naskahChildren] = await Promise.all([
    buildKisiKisiChildren(doc, profile),
    buildNaskahSoalChildren(doc, profile),
  ]);
  const kunciChildren = buildKunciJawabanChildren(doc, profile);
  const rubrikChildren = buildRubrikPenskoranChildren(doc, profile);

  const wordDoc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { ...landscapeSize, orientation: PageOrientation.LANDSCAPE },
            margin: { top: 720, bottom: 720, left: 720, right: 720 },
          },
        },
        children: kisiChildren,
      },
      {
        properties: {
          page: {
            size: { ...portraitSize, orientation: PageOrientation.PORTRAIT },
            margin: { top: 720, bottom: 720, left: 850, right: 850 },
          },
        },
        children: naskahChildren,
      },
      {
        properties: {
          page: {
            size: { ...portraitSize, orientation: PageOrientation.PORTRAIT },
            margin: { top: 720, bottom: 720, left: 850, right: 850 },
          },
        },
        children: kunciChildren,
      },
      {
        properties: {
          page: {
            size: { ...portraitSize, orientation: PageOrientation.PORTRAIT },
            margin: { top: 720, bottom: 720, left: 850, right: 850 },
          },
        },
        children: rubrikChildren,
      },
    ],
  });
  const blob = await Packer.toBlob(wordDoc);
  saveAs(blob, getSafeFileName(doc, 'Paket_Lengkap_Asesmen'));
}
