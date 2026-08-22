import { useState, useEffect, useMemo } from 'react';
import Layout from '../components/Layout';
import { motion } from 'motion/react';
import { useStore } from '../store/useStore';
import { Download, FileText, Calendar, CheckCircle2, Info, ArrowRight, Layers } from 'lucide-react';
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
  VerticalAlign,
  PageOrientation,
} from 'docx';
import { saveAs } from 'file-saver';
import { eachDayOfInterval, format, getDay } from 'date-fns';
import { id } from 'date-fns/locale';

// Map Indonesian day string to date-fns getDay index (0 = Sunday, 1 = Monday)
const dayMap: Record<string, number> = {
  'Minggu': 0,
  'Senin': 1,
  'Selasa': 2,
  'Rabu': 3,
  'Kamis': 4,
  'Jumat': 5,
  "Jum'at": 5,
  'Sabtu': 6
};

const ROMAN_GRADES: Record<number, string> = {
  1: 'I',
  2: 'II',
  3: 'III',
  4: 'IV',
  5: 'V',
  6: 'VI'
};

const DEFAULT_SCHEDULES: Record<number, { day: string; jp: number; jamKe: string }> = {
  1: { day: 'Senin', jp: 3, jamKe: '3, 4, 5' },
  2: { day: 'Selasa', jp: 3, jamKe: '2, 3, 4' },
  3: { day: 'Rabu', jp: 3, jamKe: '2, 3, 4' },
  4: { day: "Jum'at", jp: 3, jamKe: '4, 5, 6' },
  5: { day: 'Kamis', jp: 3, jamKe: '2, 3, 4' },
  6: { day: 'Kamis', jp: 3, jamKe: '6, 7, 8' },
};

export default function EffectiveDays() {
  const { user, profile, calendarData, schedules: storeSchedules } = useStore();
  const [viewMode, setViewMode] = useState<'analysis' | 'detail'>('analysis');
  const [selectedGrade, setSelectedGrade] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [generatingDoc, setGeneratingDoc] = useState(false);

  useEffect(() => {
    if (user) {
      setLoading(false);
    }
  }, [user]);

  // Merge schedules with default fallbacks
  const schedules = useMemo(() => {
    const merged: Record<number, { day: string; jp: number; jamKe: string }> = {};
    for (let g = 1; g <= 6; g++) {
      const storeItem = storeSchedules?.[g];
      merged[g] = {
        day: storeItem?.day || DEFAULT_SCHEDULES[g].day,
        jp: storeItem?.jp !== undefined && storeItem?.jp > 0 ? storeItem.jp : DEFAULT_SCHEDULES[g].jp,
        jamKe: storeItem?.jamKe || DEFAULT_SCHEDULES[g].jamKe
      };
    }
    return merged;
  }, [storeSchedules]);

  // Academic year parsing
  const academicYear = calendarData?.academicYear || profile?.tahunPelajaran || '2026/2027';
  const academicYearFormatted = academicYear.replace('/', '-');
  const startYear = parseInt(academicYear.split('/')[0] || academicYear.split('-')[0] || '2026');
  const weeklyDays = calendarData?.weeklyDays || 5;

  // Month configurations for Semester 1 (Jul-Des) and Semester 2 (Jan-Jun)
  const semester1Months = useMemo(() => [
    { label: 'JUL', code: `JUL-${String(startYear).slice(-2)}`, fullName: 'Juli', year: startYear, month: 6 },
    { label: 'AGUST', code: `AGUST-${String(startYear).slice(-2)}`, fullName: 'Agustus', year: startYear, month: 7 },
    { label: 'SEP', code: `SEP-${String(startYear).slice(-2)}`, fullName: 'September', year: startYear, month: 8 },
    { label: 'OKT', code: `OKT-${String(startYear).slice(-2)}`, fullName: 'Oktober', year: startYear, month: 9 },
    { label: 'NOP', code: `NOP-${String(startYear).slice(-2)}`, fullName: 'November', year: startYear, month: 10 },
    { label: 'DES', code: `DES-${String(startYear).slice(-2)}`, fullName: 'Desember', year: startYear, month: 11 },
  ], [startYear]);

  const semester2Months = useMemo(() => [
    { label: 'JAN', code: `JAN-${String(startYear + 1).slice(-2)}`, fullName: 'Januari', year: startYear + 1, month: 0 },
    { label: 'FEB', code: `FEB-${String(startYear + 1).slice(-2)}`, fullName: 'Februari', year: startYear + 1, month: 1 },
    { label: 'MAR', code: `MAR-${String(startYear + 1).slice(-2)}`, fullName: 'Maret', year: startYear + 1, month: 2 },
    { label: 'APR', code: `APR-${String(startYear + 1).slice(-2)}`, fullName: 'April', year: startYear + 1, month: 3 },
    { label: 'MEI', code: `MEI-${String(startYear + 1).slice(-2)}`, fullName: 'Mei', year: startYear + 1, month: 4 },
    { label: 'JUN', code: `JUN-${String(startYear + 1).slice(-2)}`, fullName: 'Juni', year: startYear + 1, month: 5 },
  ], [startYear]);

  // Compute HBE for a specific grade in a given month
  const computeMonthGradeHBE = (grade: number, year: number, month: number) => {
    const dayName = schedules[grade]?.day;
    const dayIndex = dayMap[dayName];
    if (dayIndex === undefined) return 0;

    const events = grade === 6 ? (calendarData?.events6 || {}) : (calendarData?.events1to5 || {});
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0); // last day of month
    const allDays = eachDayOfInterval({ start: startDate, end: endDate });

    let count = 0;
    allDays.forEach(d => {
      if (getDay(d) === dayIndex) {
        const dateStr = format(d, 'yyyy-MM-dd');
        const ev = events[dateStr];
        if (ev) {
          if (ev.isEffective) {
            count++;
          }
        } else {
          // If no event, default school days
          const dow = getDay(d);
          if (weeklyDays === 5) {
            if (dow >= 1 && dow <= 5) count++;
          } else {
            if (dow >= 1 && dow <= 6) count++;
          }
        }
      }
    });

    return count;
  };

  // Full matrix calculation
  const matrixData = useMemo(() => {
    // Semester 1 monthly data: monthObj -> { gradeCounts: Record<number, number>, total: number }
    const sem1Data = semester1Months.map(m => {
      const gradeCounts: Record<number, number> = {};
      let total = 0;
      for (let g = 1; g <= 6; g++) {
        const count = computeMonthGradeHBE(g, m.year, m.month);
        gradeCounts[g] = count;
        total += count;
      }
      return { ...m, gradeCounts, total };
    });

    // Semester 1 totals per grade
    const sem1Totals: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    let sem1GrandTotal = 0;
    sem1Data.forEach(row => {
      for (let g = 1; g <= 6; g++) {
        sem1Totals[g] += row.gradeCounts[g];
      }
      sem1GrandTotal += row.total;
    });

    // Semester 2 monthly data
    const sem2Data = semester2Months.map(m => {
      const gradeCounts: Record<number, number> = {};
      let total = 0;
      for (let g = 1; g <= 6; g++) {
        const count = computeMonthGradeHBE(g, m.year, m.month);
        gradeCounts[g] = count;
        total += count;
      }
      return { ...m, gradeCounts, total };
    });

    // Semester 2 totals per grade
    const sem2Totals: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    let sem2GrandTotal = 0;
    sem2Data.forEach(row => {
      for (let g = 1; g <= 6; g++) {
        sem2Totals[g] += row.gradeCounts[g];
      }
      sem2GrandTotal += row.total;
    });

    // Combined totals
    const combinedTotals: Record<number, number> = {};
    for (let g = 1; g <= 6; g++) {
      combinedTotals[g] = sem1Totals[g] + sem2Totals[g];
    }
    const combinedGrandTotal = sem1GrandTotal + sem2GrandTotal;

    return {
      sem1Data,
      sem1Totals,
      sem1GrandTotal,
      sem2Data,
      sem2Totals,
      sem2GrandTotal,
      combinedTotals,
      combinedGrandTotal
    };
  }, [semester1Months, semester2Months, schedules, calendarData, weeklyDays]);

  // Per-grade detailed dates list for selectedGrade
  const selectedGradeDates = useMemo(() => {
    const dayName = schedules[selectedGrade]?.day;
    const dayIndex = dayMap[dayName];
    if (dayIndex === undefined) return [];

    const startDate = new Date(startYear, 6, 1);
    const endDate = new Date(startYear + 1, 5, 30);
    const allDays = eachDayOfInterval({ start: startDate, end: endDate });
    const matchDays = allDays.filter(d => getDay(d) === dayIndex);

    const events = selectedGrade === 6 ? (calendarData?.events6 || {}) : (calendarData?.events1to5 || {});

    return matchDays.map(d => {
      const dateStr = format(d, 'yyyy-MM-dd');
      const semester = d.getMonth() >= 6 ? 1 : 2;
      let isEffective = true;
      let label = 'Hari Efektif Belajar';

      if (events[dateStr]) {
        label = events[dateStr].label;
        isEffective = events[dateStr].isEffective;
      } else {
        const dow = getDay(d);
        if (weeklyDays === 5 && (dow === 0 || dow === 6)) {
          isEffective = false;
          label = 'Libur Akhir Pekan';
        }
      }

      return {
        date: dateStr,
        label,
        isEffective,
        semester
      };
    });
  }, [selectedGrade, schedules, startYear, calendarData, weeklyDays]);

  // Generate Word (.docx) matching the uploaded image format precisely
  const generateOfficialDocx = async () => {
    setGeneratingDoc(true);
    try {
      const tableBorder = {
        top: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
        left: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
        right: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
      };

      const cellMargins = { top: 70, bottom: 70, left: 90, right: 90 };

      // Helper for clean table cell
      const createCell = (
        text: string | number,
        options: {
          bold?: boolean;
          align?: (typeof AlignmentType)[keyof typeof AlignmentType];
          widthPercent?: number;
          rowSpan?: number;
          colSpan?: number;
          shading?: string;
        } = {}
      ) => {
        return new TableCell({
          width: options.widthPercent ? { size: options.widthPercent, type: WidthType.PERCENTAGE } : undefined,
          rowSpan: options.rowSpan,
          columnSpan: options.colSpan,
          borders: tableBorder,
          margins: cellMargins,
          shading: options.shading ? { fill: options.shading } : undefined,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: options.align || AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: text.toString(),
                  bold: options.bold ?? false,
                  size: 19, // ~9.5pt
                  font: "Times New Roman"
                })
              ]
            })
          ]
        });
      };

      // TABLE 1: ANALISA HBE SEMESTER 1 & 2
      const table1Rows: TableRow[] = [
        // Header Row 1
        new TableRow({
          children: [
            new TableCell({
              borders: tableBorder,
              margins: cellMargins,
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  alignment: AlignmentType.LEFT,
                  children: [new TextRun({ text: "HARI", bold: true, size: 19, font: "Times New Roman" })]
                }),
                new Paragraph({
                  alignment: AlignmentType.LEFT,
                  children: [new TextRun({ text: "BULAN", bold: true, size: 19, font: "Times New Roman" })]
                })
              ]
            }),
            createCell(`${schedules[1].day}\nKls 1`, { bold: true }),
            createCell(`${schedules[2].day}\nKls 2`, { bold: true }),
            createCell(`${schedules[3].day}\nKls 3`, { bold: true }),
            createCell(`${schedules[4].day.replace('Jumat', "Jum'at")}\nKls 4`, { bold: true }),
            createCell(`${schedules[5].day}\nKls 5`, { bold: true }),
            createCell(`${schedules[6].day}\nKls 6`, { bold: true }),
            new TableCell({
              borders: tableBorder,
              margins: cellMargins,
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: "TOTAL /", bold: true, size: 19, font: "Times New Roman" })]
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: "BULAN", bold: true, size: 19, font: "Times New Roman" })]
                })
              ]
            }),
          ]
        }),

        // Semester 1 Rows
        ...matrixData.sem1Data.map(row => (
          new TableRow({
            children: [
              createCell(row.code, { align: AlignmentType.LEFT }),
              createCell(row.gradeCounts[1] || ''),
              createCell(row.gradeCounts[2] || ''),
              createCell(row.gradeCounts[3] || ''),
              createCell(row.gradeCounts[4] || ''),
              createCell(row.gradeCounts[5] || ''),
              createCell(row.gradeCounts[6] || ''),
              createCell(row.total || '', { bold: true }),
            ]
          })
        )),

        // Total Semester 1 Row
        new TableRow({
          children: [
            createCell("TOTAL/SEMESTER 1", { bold: true, align: AlignmentType.LEFT }),
            createCell(matrixData.sem1Totals[1], { bold: true }),
            createCell(matrixData.sem1Totals[2], { bold: true }),
            createCell(matrixData.sem1Totals[3], { bold: true }),
            createCell(matrixData.sem1Totals[4], { bold: true }),
            createCell(matrixData.sem1Totals[5], { bold: true }),
            createCell(matrixData.sem1Totals[6], { bold: true }),
            createCell(matrixData.sem1GrandTotal, { bold: true }),
          ]
        }),

        // Empty Separator Row
        new TableRow({
          children: [
            createCell(""),
            createCell(""),
            createCell(""),
            createCell(""),
            createCell(""),
            createCell(""),
            createCell(""),
            createCell(""),
          ]
        }),

        // Semester 2 Rows
        ...matrixData.sem2Data.map(row => (
          new TableRow({
            children: [
              createCell(row.code, { align: AlignmentType.LEFT }),
              createCell(row.gradeCounts[1] || ''),
              createCell(row.gradeCounts[2] || ''),
              createCell(row.gradeCounts[3] || ''),
              createCell(row.gradeCounts[4] || ''),
              createCell(row.gradeCounts[5] || ''),
              createCell(row.gradeCounts[6] || ''),
              createCell(row.total || '', { bold: true }),
            ]
          })
        )),

        // Total Semester 2 Row
        new TableRow({
          children: [
            createCell("TOTAL/SEMESTER 2", { bold: true, align: AlignmentType.LEFT }),
            createCell(matrixData.sem2Totals[1], { bold: true }),
            createCell(matrixData.sem2Totals[2], { bold: true }),
            createCell(matrixData.sem2Totals[3], { bold: true }),
            createCell(matrixData.sem2Totals[4], { bold: true }),
            createCell(matrixData.sem2Totals[5], { bold: true }),
            createCell(matrixData.sem2Totals[6], { bold: true }),
            createCell(matrixData.sem2GrandTotal, { bold: true }),
          ]
        }),

        // Grand Total Row
        new TableRow({
          children: [
            createCell("TOTAL SEMESTER 1 & 2", { bold: true, align: AlignmentType.LEFT }),
            createCell(matrixData.combinedTotals[1], { bold: true }),
            createCell(matrixData.combinedTotals[2], { bold: true }),
            createCell(matrixData.combinedTotals[3], { bold: true }),
            createCell(matrixData.combinedTotals[4], { bold: true }),
            createCell(matrixData.combinedTotals[5], { bold: true }),
            createCell(matrixData.combinedTotals[6], { bold: true }),
            createCell(matrixData.combinedGrandTotal, { bold: true }),
          ]
        }),
      ];

      // TABLE 2: PERHITUNGAN JUMLAH JAMPEL SEMESTER 1
      const table2Rows: TableRow[] = [
        new TableRow({
          children: [
            createCell("No", { bold: true, widthPercent: 8 }),
            createCell("K E L A S", { bold: true, widthPercent: 16 }),
            createCell("Jam/mg", { bold: true, widthPercent: 14 }),
            createCell("Hari (dijadwal)", { bold: true, widthPercent: 20 }),
            createCell("Jml HBE", { bold: true, widthPercent: 14 }),
            createCell("Jam Pel", { bold: true, widthPercent: 14 }),
            createCell("Total Jam/Smt", { bold: true, widthPercent: 14 }),
          ]
        }),
        ...[1, 2, 3, 4, 5, 6].map((g, idx) => (
          new TableRow({
            children: [
              createCell((idx + 1).toString()),
              createCell(ROMAN_GRADES[g], { bold: true }),
              createCell(schedules[g].jp),
              createCell(schedules[g].day.replace('Jumat', "Jum'at")),
              createCell(matrixData.sem1Totals[g]),
              createCell(schedules[g].jp),
              createCell(matrixData.sem1Totals[g] * schedules[g].jp, { bold: true }),
            ]
          })
        ))
      ];

      // TABLE 3: PERHITUNGAN JUMLAH JAMPEL SEMESTER 2
      const table3Rows: TableRow[] = [
        new TableRow({
          children: [
            createCell("No", { bold: true, widthPercent: 8 }),
            createCell("K E L A S", { bold: true, widthPercent: 16 }),
            createCell("Jam/mg", { bold: true, widthPercent: 14 }),
            createCell("Hari (dijadwal)", { bold: true, widthPercent: 20 }),
            createCell("Jml HBE", { bold: true, widthPercent: 14 }),
            createCell("Jam Pel", { bold: true, widthPercent: 14 }),
            createCell("Total Jam/Smt", { bold: true, widthPercent: 14 }),
          ]
        }),
        ...[1, 2, 3, 4, 5, 6].map((g, idx) => (
          new TableRow({
            children: [
              createCell((idx + 1).toString()),
              createCell(ROMAN_GRADES[g], { bold: true }),
              createCell(schedules[g].jp),
              createCell(schedules[g].day.replace('Jumat', "Jum'at")),
              createCell(matrixData.sem2Totals[g]),
              createCell(schedules[g].jp),
              createCell(matrixData.sem2Totals[g] * schedules[g].jp, { bold: true }),
            ]
          })
        ))
      ];

      // TABLE 4: PENGATURAN BEBAN JAM PELAJARAN KURMER PAI BP PERMINGGU
      const totalJpWeekly = [1, 2, 3, 4, 5, 6].reduce((acc, g) => acc + schedules[g].jp, 0);
      const table4Rows: TableRow[] = [
        new TableRow({
          children: [
            createCell("MAPEL", { bold: true, rowSpan: 2, widthPercent: 16 }),
            createCell("JAM PELAJARAN PERMINGGU", { bold: true, colSpan: 6, widthPercent: 68 }),
            createCell("Jumlah", { bold: true, rowSpan: 2, widthPercent: 16 }),
          ]
        }),
        new TableRow({
          children: [
            createCell("KLS 1", { bold: true }),
            createCell("KLS 2", { bold: true }),
            createCell("KLS 3", { bold: true }),
            createCell("KLS 4", { bold: true }),
            createCell("KLS 5", { bold: true }),
            createCell("KLS 6", { bold: true }),
          ]
        }),
        new TableRow({
          children: [
            createCell("PAIBP", { align: AlignmentType.LEFT }),
            createCell(schedules[1].jp),
            createCell(schedules[2].jp),
            createCell(schedules[3].jp),
            createCell(schedules[4].jp),
            createCell(schedules[5].jp),
            createCell(schedules[6].jp),
            createCell(totalJpWeekly, { bold: true }),
          ]
        }),
        new TableRow({
          children: [
            createCell("TOTAL", { bold: true, align: AlignmentType.LEFT }),
            createCell(schedules[1].jp, { bold: true }),
            createCell(schedules[2].jp, { bold: true }),
            createCell(schedules[3].jp, { bold: true }),
            createCell(schedules[4].jp, { bold: true }),
            createCell(schedules[5].jp, { bold: true }),
            createCell(schedules[6].jp, { bold: true }),
            createCell(totalJpWeekly, { bold: true }),
          ]
        })
      ];

      // TABLE 5: JADWAL PELAJARAN (HARI & JAM KE-)
      const table5Rows: TableRow[] = [
        new TableRow({
          children: [
            createCell("KELAS", { bold: true, rowSpan: 2, widthPercent: 25 }),
            createCell("HARI/JAMPEL", { bold: true, colSpan: 2, widthPercent: 75 }),
          ]
        }),
        new TableRow({
          children: [
            createCell("HARI", { bold: true, widthPercent: 35 }),
            createCell("JAM KE-", { bold: true, widthPercent: 40 }),
          ]
        }),
        ...[1, 2, 3, 4, 5, 6].map(g => (
          new TableRow({
            children: [
              createCell(ROMAN_GRADES[g], { bold: true }),
              createCell(schedules[g].day.replace('Jumat', "Jum'at"), { align: AlignmentType.LEFT }),
              createCell(schedules[g].jamKe || '-'),
            ]
          })
        ))
      ];

      const kotaKab = "Kabupaten Bandung";
      const todayStr = format(new Date(), 'd MMMM yyyy', { locale: id });

      const doc = new Document({
        sections: [
          // PAGE 1: Analisa HBE, Perhitungan Jam Pelajaran Sem 1 & Sem 2
          {
            properties: {
              page: {
                margin: { top: 720, right: 720, bottom: 720, left: 720 },
                size: { orientation: PageOrientation.PORTRAIT }
              }
            },
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [
                  new TextRun({
                    text: "Analisa HBE Semester I Ganjil dan Semester II Genap Kls I, II, III, IV, V & VI",
                    bold: true,
                    size: 24, // 12pt
                    font: "Times New Roman"
                  })
                ],
                spacing: { after: 60 }
              }),
              new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [
                  new TextRun({
                    text: `Tahun Ajaran ${academicYearFormatted}`,
                    bold: true,
                    size: 24, // 12pt
                    font: "Times New Roman"
                  })
                ],
                spacing: { after: 180 }
              }),

              // Table 1: Analisa HBE
              new Table({
                rows: table1Rows,
                width: { size: 100, type: WidthType.PERCENTAGE }
              }),

              new Paragraph({ text: "", spacing: { after: 200 } }),

              // Table 2: Heading & Table Sem 1
              new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [
                  new TextRun({
                    text: "PERHITUNGAN JUMLAH JAMPEL PAIBP SEMESTER 1",
                    bold: true,
                    size: 22, // 11pt
                    font: "Times New Roman"
                  })
                ],
                spacing: { after: 80 }
              }),
              new Table({
                rows: table2Rows,
                width: { size: 100, type: WidthType.PERCENTAGE }
              }),

              new Paragraph({ text: "", spacing: { after: 200 } }),

              // Table 3: Heading & Table Sem 2
              new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [
                  new TextRun({
                    text: "PERHITUNGAN JUMLAH JAMPEL PAIBP SEMESTER 2",
                    bold: true,
                    size: 22, // 11pt
                    font: "Times New Roman"
                  })
                ],
                spacing: { after: 80 }
              }),
              new Table({
                rows: table3Rows,
                width: { size: 100, type: WidthType.PERCENTAGE }
              }),
            ]
          },

          // PAGE 2: Pengaturan Beban Jam, Jadwal Pelajaran (Jam Ke-), & Tanda Tangan
          {
            properties: {
              page: {
                margin: { top: 720, right: 720, bottom: 720, left: 720 },
                size: { orientation: PageOrientation.PORTRAIT }
              }
            },
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [
                  new TextRun({
                    text: "PENGATURAN BEBAN JAM PELAJARAN KURMER PAI BP PERMINGGU",
                    bold: true,
                    size: 22, // 11pt
                    font: "Times New Roman"
                  })
                ],
                spacing: { after: 100 }
              }),
              new Table({
                rows: table4Rows,
                width: { size: 100, type: WidthType.PERCENTAGE }
              }),

              new Paragraph({ text: "", spacing: { after: 240 } }),

              new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [
                  new TextRun({
                    text: "JADWAL PELAJARAN",
                    bold: true,
                    size: 22, // 11pt
                    font: "Times New Roman"
                  })
                ],
                spacing: { after: 100 }
              }),
              new Table({
                rows: table5Rows,
                width: { size: 100, type: WidthType.PERCENTAGE }
              }),

              new Paragraph({ text: "", spacing: { after: 360 } }),

              // Signatures Table
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: {
                  top: { style: BorderStyle.NONE },
                  bottom: { style: BorderStyle.NONE },
                  left: { style: BorderStyle.NONE },
                  right: { style: BorderStyle.NONE },
                },
                rows: [
                  new TableRow({
                    children: [
                      new TableCell({
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                        children: [
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                              new TextRun({ text: "Mengetahui,", size: 20, font: "Times New Roman" })
                            ]
                          }),
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                              new TextRun({ text: "Kepala Sekolah", size: 20, font: "Times New Roman" })
                            ]
                          }),
                          new Paragraph({ text: "", spacing: { after: 800 } }),
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                              new TextRun({ text: profile?.namaKepalaSekolah || "Yuni Sri Rahayu, M.Pd.", size: 20, font: "Times New Roman" })
                            ]
                          }),
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                              new TextRun({ text: `NIP. ${profile?.nipKepalaSekolah || '198706162019032007'}`, size: 20, font: "Times New Roman" })
                            ]
                          }),
                        ]
                      }),
                      new TableCell({
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                        children: [
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                              new TextRun({ text: `${kotaKab}, ${todayStr}`, size: 20, font: "Times New Roman" })
                            ]
                          }),
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                              new TextRun({ text: "Guru Mata Pelajaran PAIBP", size: 20, font: "Times New Roman" })
                            ]
                          }),
                          new Paragraph({ text: "", spacing: { after: 800 } }),
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                              new TextRun({ text: profile?.namaGuru || "Nama Guru", size: 20, font: "Times New Roman" })
                            ]
                          }),
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                              new TextRun({ text: `NIP. ${profile?.nip || '...........................................'}`, size: 20, font: "Times New Roman" })
                            ]
                          }),
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
      saveAs(blob, `Analisis_HBE_Semester_1_2_Kls_I-VI_${academicYearFormatted}.docx`);
    } catch (err) {
      console.error(err);
      alert('Gagal membuat dokumen Word. Silakan coba lagi.');
    } finally {
      setGeneratingDoc(false);
    }
  };

  if (loading) return <Layout><div className="p-8">Memuat data analisis...</div></Layout>;

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
        {/* Header Title and Actions */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
                <CheckCircle2 size={13} />
                Analisis Hari Belajar Efektif (HBE)
              </span>
              <span className="bg-slate-100 text-slate-700 text-xs font-bold px-3 py-1 rounded-full">
                TP {academicYearFormatted}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              Analisis Hari Efektif Belajar & Beban JP
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Perhitungan akurat Hari Belajar Efektif (HBE) Semester 1 & 2 untuk Kelas I - VI beserta pengaturan Jam Pelajaran Kurikulum Merdeka.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex bg-slate-200/80 p-1 rounded-2xl text-xs font-bold text-slate-700">
              <button
                type="button"
                onClick={() => setViewMode('analysis')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
                  viewMode === 'analysis' ? 'bg-white shadow-sm text-emerald-800 font-extrabold' : 'hover:text-slate-900'
                }`}
              >
                <FileText size={15} />
                Dokumen Analisis Resmi
              </button>
              <button
                type="button"
                onClick={() => setViewMode('detail')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
                  viewMode === 'detail' ? 'bg-white shadow-sm text-emerald-800 font-extrabold' : 'hover:text-slate-900'
                }`}
              >
                <Calendar size={15} />
                Rincian Tanggal Per Kelas
              </button>
            </div>

            {/* Word Export Button */}
            <button
              onClick={generateOfficialDocx}
              disabled={generatingDoc}
              className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-2xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all cursor-pointer text-sm active:scale-95 disabled:opacity-50"
            >
              <Download size={17} />
              {generatingDoc ? 'Membuat Word...' : 'Unduh Dokumen Word (.docx)'}
            </button>
          </div>
        </div>

        {/* View Mode: Analysis (Official Table Format as Uploaded Image) */}
        {viewMode === 'analysis' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Top Metric Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white/70 border border-white/80 p-4 rounded-2xl shadow-sm backdrop-blur-md">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total HBE Sem 1</p>
                <p className="text-2xl font-black text-emerald-700">{matrixData.sem1GrandTotal} <span className="text-xs font-semibold text-slate-400">Pertemuan</span></p>
              </div>
              <div className="bg-white/70 border border-white/80 p-4 rounded-2xl shadow-sm backdrop-blur-md">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total HBE Sem 2</p>
                <p className="text-2xl font-black text-emerald-700">{matrixData.sem2GrandTotal} <span className="text-xs font-semibold text-slate-400">Pertemuan</span></p>
              </div>
              <div className="bg-emerald-50/70 border border-emerald-100 p-4 rounded-2xl shadow-sm backdrop-blur-md">
                <p className="text-xs font-bold text-emerald-700/70 uppercase tracking-wider mb-1">Total HBE Setahun</p>
                <p className="text-2xl font-black text-emerald-800">{matrixData.combinedGrandTotal} <span className="text-xs font-semibold text-emerald-600">Pertemuan</span></p>
              </div>
              <div className="bg-white/70 border border-white/80 p-4 rounded-2xl shadow-sm backdrop-blur-md">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Beban JP Mingguan</p>
                <p className="text-2xl font-black text-slate-800">{[1,2,3,4,5,6].reduce((acc, g) => acc + schedules[g].jp, 0)} <span className="text-xs font-semibold text-slate-400">JP / Minggu</span></p>
              </div>
            </div>

            {/* Document Preview Box */}
            <div className="bg-white border border-slate-300 rounded-3xl p-6 md:p-10 shadow-xl space-y-8 font-serif text-slate-900 overflow-x-auto">
              {/* Document Header */}
              <div>
                <h2 className="text-lg md:text-xl font-bold tracking-tight text-slate-900">
                  Analisa HBE Semester I Ganjil dan Semester II Genap Kls I, II, III, IV, V & VI
                </h2>
                <h3 className="text-base font-bold underline text-slate-800 mt-1">
                  Tahun Ajaran {academicYearFormatted}
                </h3>
              </div>

              {/* TABLE 1: ANALISA HBE */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs md:text-sm border-collapse border border-slate-900 text-center">
                  <thead>
                    <tr className="bg-slate-50 font-bold">
                      <th className="border border-slate-900 p-2.5 text-left w-32">
                        <div>HARI</div>
                        <div>BULAN</div>
                      </th>
                      {[1, 2, 3, 4, 5, 6].map(g => (
                        <th key={g} className="border border-slate-900 p-2.5 font-bold min-w-[70px]">
                          <div>{schedules[g].day.replace('Jumat', "Jum'at")}</div>
                          <div className="text-slate-600">Kls {g}</div>
                        </th>
                      ))}
                      <th className="border border-slate-900 p-2.5 font-bold min-w-[80px]">
                        <div>TOTAL /</div>
                        <div>BULAN</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Semester 1 Rows */}
                    {matrixData.sem1Data.map(row => (
                      <tr key={row.code} className="hover:bg-slate-50/50">
                        <td className="border border-slate-900 p-2 text-left font-medium">{row.code}</td>
                        {[1, 2, 3, 4, 5, 6].map(g => (
                          <td key={g} className="border border-slate-900 p-2">
                            {row.gradeCounts[g] || ''}
                          </td>
                        ))}
                        <td className="border border-slate-900 p-2 font-bold bg-slate-50/30">{row.total || ''}</td>
                      </tr>
                    ))}

                    {/* Total Semester 1 Row */}
                    <tr className="bg-slate-100 font-bold">
                      <td className="border border-slate-900 p-2 text-left">TOTAL/SEMESTER 1</td>
                      {[1, 2, 3, 4, 5, 6].map(g => (
                        <td key={g} className="border border-slate-900 p-2">{matrixData.sem1Totals[g]}</td>
                      ))}
                      <td className="border border-slate-900 p-2 bg-emerald-50 text-emerald-900 font-black">{matrixData.sem1GrandTotal}</td>
                    </tr>

                    {/* Divider Row */}
                    <tr>
                      <td colSpan={8} className="border border-slate-900 p-1 bg-slate-50"></td>
                    </tr>

                    {/* Semester 2 Rows */}
                    {matrixData.sem2Data.map(row => (
                      <tr key={row.code} className="hover:bg-slate-50/50">
                        <td className="border border-slate-900 p-2 text-left font-medium">{row.code}</td>
                        {[1, 2, 3, 4, 5, 6].map(g => (
                          <td key={g} className="border border-slate-900 p-2">
                            {row.gradeCounts[g] || ''}
                          </td>
                        ))}
                        <td className="border border-slate-900 p-2 font-bold bg-slate-50/30">{row.total || ''}</td>
                      </tr>
                    ))}

                    {/* Total Semester 2 Row */}
                    <tr className="bg-slate-100 font-bold">
                      <td className="border border-slate-900 p-2 text-left">TOTAL/SEMESTER 2</td>
                      {[1, 2, 3, 4, 5, 6].map(g => (
                        <td key={g} className="border border-slate-900 p-2">{matrixData.sem2Totals[g]}</td>
                      ))}
                      <td className="border border-slate-900 p-2 bg-emerald-50 text-emerald-900 font-black">{matrixData.sem2GrandTotal}</td>
                    </tr>

                    {/* Grand Total Row */}
                    <tr className="bg-slate-200/80 font-black">
                      <td className="border border-slate-900 p-2.5 text-left">TOTAL SEMESTER 1 & 2</td>
                      {[1, 2, 3, 4, 5, 6].map(g => (
                        <td key={g} className="border border-slate-900 p-2.5">{matrixData.combinedTotals[g]}</td>
                      ))}
                      <td className="border border-slate-900 p-2.5 bg-emerald-100 text-emerald-950 font-black text-base">{matrixData.combinedGrandTotal}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* TABLE 2 & TABLE 3: PERHITUNGAN JAMPEL SEMESTER 1 & SEMESTER 2 */}
              <div className="space-y-6 pt-4">
                <div>
                  <h4 className="font-bold text-sm md:text-base uppercase tracking-wider mb-2">
                    Perhitungan Jumlah Jampel PAIBP Semester 1
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs md:text-sm border-collapse border border-slate-900 text-center">
                      <thead>
                        <tr className="bg-slate-50 font-bold">
                          <th className="border border-slate-900 p-2 w-12">No</th>
                          <th className="border border-slate-900 p-2">K E L A S</th>
                          <th className="border border-slate-900 p-2">Jam/mg</th>
                          <th className="border border-slate-900 p-2 text-left">Hari (dijadwal)</th>
                          <th className="border border-slate-900 p-2">Jml HBE</th>
                          <th className="border border-slate-900 p-2">Jam Pel</th>
                          <th className="border border-slate-900 p-2 font-bold">Total Jam/Smt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[1, 2, 3, 4, 5, 6].map((g, idx) => (
                          <tr key={g} className="hover:bg-slate-50/50">
                            <td className="border border-slate-900 p-2">{idx + 1}</td>
                            <td className="border border-slate-900 p-2 font-bold">{ROMAN_GRADES[g]}</td>
                            <td className="border border-slate-900 p-2">{schedules[g].jp}</td>
                            <td className="border border-slate-900 p-2 text-left">{schedules[g].day.replace('Jumat', "Jum'at")}</td>
                            <td className="border border-slate-900 p-2">{matrixData.sem1Totals[g]}</td>
                            <td className="border border-slate-900 p-2">{schedules[g].jp}</td>
                            <td className="border border-slate-900 p-2 font-bold text-emerald-900">{matrixData.sem1Totals[g] * schedules[g].jp}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-sm md:text-base uppercase tracking-wider mb-2">
                    Perhitungan Jumlah Jampel PAIBP Semester 2
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs md:text-sm border-collapse border border-slate-900 text-center">
                      <thead>
                        <tr className="bg-slate-50 font-bold">
                          <th className="border border-slate-900 p-2 w-12">No</th>
                          <th className="border border-slate-900 p-2">K E L A S</th>
                          <th className="border border-slate-900 p-2">Jam/mg</th>
                          <th className="border border-slate-900 p-2 text-left">Hari (dijadwal)</th>
                          <th className="border border-slate-900 p-2">Jml HBE</th>
                          <th className="border border-slate-900 p-2">Jam Pel</th>
                          <th className="border border-slate-900 p-2 font-bold">Total Jam/Smt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[1, 2, 3, 4, 5, 6].map((g, idx) => (
                          <tr key={g} className="hover:bg-slate-50/50">
                            <td className="border border-slate-900 p-2">{idx + 1}</td>
                            <td className="border border-slate-900 p-2 font-bold">{ROMAN_GRADES[g]}</td>
                            <td className="border border-slate-900 p-2">{schedules[g].jp}</td>
                            <td className="border border-slate-900 p-2 text-left">{schedules[g].day.replace('Jumat', "Jum'at")}</td>
                            <td className="border border-slate-900 p-2">{matrixData.sem2Totals[g]}</td>
                            <td className="border border-slate-900 p-2">{schedules[g].jp}</td>
                            <td className="border border-slate-900 p-2 font-bold text-emerald-900">{matrixData.sem2Totals[g] * schedules[g].jp}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* TABLE 4: PENGATURAN BEBAN JAM PELAJARAN KURMER PAI BP PERMINGGU */}
              <div className="pt-6 border-t-2 border-dashed border-slate-300">
                <h4 className="font-bold text-sm md:text-base uppercase tracking-wider mb-2">
                  Pengaturan Beban Jam Pelajaran Kurmer PAI BP Perminggu
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs md:text-sm border-collapse border border-slate-900 text-center">
                    <thead>
                      <tr className="bg-slate-50 font-bold">
                        <th rowSpan={2} className="border border-slate-900 p-2.5 text-left w-24">MAPEL</th>
                        <th colSpan={6} className="border border-slate-900 p-2.5">JAM PELAJARAN PERMINGGU</th>
                        <th rowSpan={2} className="border border-slate-900 p-2.5 w-24">Jumlah</th>
                      </tr>
                      <tr className="bg-slate-50 font-bold">
                        <th className="border border-slate-900 p-2">KLS 1</th>
                        <th className="border border-slate-900 p-2">KLS 2</th>
                        <th className="border border-slate-900 p-2">KLS 3</th>
                        <th className="border border-slate-900 p-2">KLS 4</th>
                        <th className="border border-slate-900 p-2">KLS 5</th>
                        <th className="border border-slate-900 p-2">KLS 6</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-slate-900 p-2 text-left font-semibold">PAIBP</td>
                        {[1, 2, 3, 4, 5, 6].map(g => (
                          <td key={g} className="border border-slate-900 p-2">{schedules[g].jp}</td>
                        ))}
                        <td className="border border-slate-900 p-2 font-bold">{[1,2,3,4,5,6].reduce((acc, g) => acc + schedules[g].jp, 0)}</td>
                      </tr>
                      <tr className="bg-slate-100 font-bold">
                        <td className="border border-slate-900 p-2 text-left">TOTAL</td>
                        {[1, 2, 3, 4, 5, 6].map(g => (
                          <td key={g} className="border border-slate-900 p-2">{schedules[g].jp}</td>
                        ))}
                        <td className="border border-slate-900 p-2 font-black">{[1,2,3,4,5,6].reduce((acc, g) => acc + schedules[g].jp, 0)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* TABLE 5: JADWAL PELAJARAN BESERTA JAM KE- */}
              <div className="pt-4">
                <h4 className="font-bold text-sm md:text-base uppercase tracking-wider mb-2">
                  Jadwal Pelajaran
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs md:text-sm border-collapse border border-slate-900 text-center">
                    <thead>
                      <tr className="bg-slate-50 font-bold">
                        <th rowSpan={2} className="border border-slate-900 p-2.5 w-28">KELAS</th>
                        <th colSpan={2} className="border border-slate-900 p-2.5">HARI/JAMPEL</th>
                      </tr>
                      <tr className="bg-slate-50 font-bold">
                        <th className="border border-slate-900 p-2 text-left w-48">HARI</th>
                        <th className="border border-slate-900 p-2">JAM KE-</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[1, 2, 3, 4, 5, 6].map(g => (
                        <tr key={g} className="hover:bg-slate-50/50">
                          <td className="border border-slate-900 p-2 font-bold">{ROMAN_GRADES[g]}</td>
                          <td className="border border-slate-900 p-2 text-left">{schedules[g].day.replace('Jumat', "Jum'at")}</td>
                          <td className="border border-slate-900 p-2 font-semibold text-slate-800">{schedules[g].jamKe || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Signatures Section */}
              <div className="pt-10 grid grid-cols-2 text-xs md:text-sm text-center">
                <div className="space-y-16">
                  <div>
                    <p>Mengetahui,</p>
                    <p className="font-semibold">Kepala Sekolah</p>
                  </div>
                  <div>
                    <p className="font-bold underline">{profile?.namaKepalaSekolah || 'Yuni Sri Rahayu, M.Pd.'}</p>
                    <p className="text-xs text-slate-600 mt-0.5">NIP. {profile?.nipKepalaSekolah || '198706162019032007'}</p>
                  </div>
                </div>

                <div className="space-y-16">
                  <div>
                    <p>Kabupaten Bandung, {format(new Date(), 'd MMMM yyyy', { locale: id })}</p>
                    <p className="font-semibold">Guru Mata Pelajaran PAIBP</p>
                  </div>
                  <div>
                    <p className="font-bold underline">{profile?.namaGuru || 'Nama Guru'}</p>
                    <p className="text-xs text-slate-600 mt-0.5">NIP. {profile?.nip || '...........................................'}</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* View Mode: Detail Dates Per Grade */}
        {viewMode === 'detail' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Grade Selector Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {[1, 2, 3, 4, 5, 6].map(grade => (
                <button
                  key={grade}
                  onClick={() => setSelectedGrade(grade)}
                  className={`px-5 py-2.5 rounded-2xl text-sm font-bold transition-all flex items-center gap-2 shrink-0 ${
                    selectedGrade === grade
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200'
                      : 'bg-white/60 text-slate-600 border border-white/80 hover:bg-white'
                  }`}
                >
                  <span>Kelas {ROMAN_GRADES[grade]}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${selectedGrade === grade ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    {schedules[grade]?.day || '-'}
                  </span>
                </button>
              ))}
            </div>

            {/* Single Grade Detail Card */}
            <div className="bg-white/60 border border-white/80 backdrop-blur-xl rounded-3xl p-6 shadow-xl shadow-slate-200/50 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white/80 p-4 rounded-2xl border border-slate-100 shadow-sm">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Semester 1 ({startYear})</p>
                  <p className="text-3xl font-black text-emerald-600">
                    {matrixData.sem1Totals[selectedGrade]} <span className="text-sm font-medium text-slate-400">Hari Efektif</span>
                  </p>
                </div>
                <div className="bg-white/80 p-4 rounded-2xl border border-slate-100 shadow-sm">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Semester 2 ({startYear + 1})</p>
                  <p className="text-3xl font-black text-emerald-600">
                    {matrixData.sem2Totals[selectedGrade]} <span className="text-sm font-medium text-slate-400">Hari Efektif</span>
                  </p>
                </div>
                <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 shadow-sm">
                  <p className="text-xs font-bold text-emerald-700/80 uppercase tracking-widest mb-1">Total Setahun (Kls {ROMAN_GRADES[selectedGrade]})</p>
                  <p className="text-3xl font-black text-emerald-800">
                    {matrixData.combinedTotals[selectedGrade]} <span className="text-sm font-medium text-emerald-600">Hari Efektif</span>
                  </p>
                </div>
              </div>

              {/* Information Alert */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-medium text-slate-600 flex items-center gap-3">
                <Info className="text-emerald-600 shrink-0" size={18} />
                <span>
                  Hari mengajar Kelas {ROMAN_GRADES[selectedGrade]} dijadwalkan pada hari <strong className="text-slate-800">{schedules[selectedGrade]?.day}</strong> (Jam ke: <strong className="text-slate-800">{schedules[selectedGrade]?.jamKe || '-'}</strong>) dengan beban <strong className="text-emerald-700">{schedules[selectedGrade]?.jp} JP/Minggu</strong>.
                </span>
              </div>

              {/* Table of all matched dates */}
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto rounded-2xl border border-slate-200 bg-white">
                <table className="w-full text-left text-xs md:text-sm border-collapse">
                  <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 z-10 font-bold text-slate-600">
                    <tr>
                      <th className="p-3.5 text-center w-16">No</th>
                      <th className="p-3.5">Tanggal ({schedules[selectedGrade]?.day})</th>
                      <th className="p-3.5 text-center">Semester</th>
                      <th className="p-3.5 text-right">Status & Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedGradeDates.map((item, idx) => (
                      <tr key={idx} className={`hover:bg-slate-50 transition-colors ${!item.isEffective ? 'bg-rose-50/40' : ''}`}>
                        <td className="p-3.5 text-center font-bold text-slate-400">{idx + 1}</td>
                        <td className="p-3.5 font-bold text-slate-800">
                          {format(new Date(item.date), 'EEEE, dd MMMM yyyy', { locale: id })}
                        </td>
                        <td className="p-3.5 text-center font-semibold text-slate-600">
                          Semester {item.semester}
                        </td>
                        <td className="p-3.5 text-right">
                          <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${
                            item.isEffective
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}>
                            {item.label}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </Layout>
  );
}
