import React, { useMemo, useState } from 'react';
import Layout from '../components/Layout';
import {
  DEFAULT_SUMATIF_CONFIG,
  SumatifConfig,
  SumatifDocument,
  SumatifFontFamily,
  SumatifOptionLayout,
  SumatifType,
  useStore,
} from '../store/useStore';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  KeyRound,
  Layers,
  Loader2,
  Lock,
  Sparkles,
  Trash2,
  Unlock,
} from 'lucide-react';
import { eachDayOfInterval, format, getDay } from 'date-fns';
import { Link } from 'react-router-dom';
import {
  downloadKisiKisiDocx,
  downloadKunciJawabanDocx,
  downloadNaskahSoalDocx,
  downloadPaketLengkapDocx,
  downloadRubrikPenskoranDocx,
} from '../lib/sumatifDocx';

interface FlattenedAtpItem {
  globalIdx: number;
  elemen: string;
  cp: string;
  tp: string[];
  atpText: string;
  semester: 1 | 2;
}

type PreviewTab = 'kisi' | 'naskah' | 'kunci' | 'rubrik';

const FONT_FAMILIES: SumatifFontFamily[] = [
  'Times New Roman',
  'Arial',
  'Calibri',
  'Book Antiqua',
  'Georgia',
];

const FONT_SIZES = [10, 11, 12, 13, 14];

function sanitizeClientSvg(raw?: string): string {
  if (!raw || typeof raw !== 'string') return '';
  let svg = raw.trim();
  const start = svg.indexOf('<svg');
  const end = svg.lastIndexOf('</svg>');
  if (start === -1 || end === -1) return '';
  svg = svg.slice(start, end + 6);
  svg = svg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son\w+\s*=\s*(['"])[\s\S]*?\1/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/<image[^>]*>/gi, '');
  return svg;
}

function distributeClientCounts(total: number, pctLots: number, pctMots: number, pctHots: number) {
  if (total <= 0) return { lots: 0, mots: 0, hots: 0 };
  const sumPct = Math.max(1, pctLots + pctMots + pctHots);
  const exactLots = (total * pctLots) / sumPct;
  const exactMots = (total * pctMots) / sumPct;
  const exactHots = (total * pctHots) / sumPct;

  let lots = Math.floor(exactLots);
  let mots = Math.floor(exactMots);
  let hots = Math.floor(exactHots);
  const remainder = total - (lots + mots + hots);

  const fractions = [
    { key: 'lots', frac: exactLots - lots },
    { key: 'mots', frac: exactMots - mots },
    { key: 'hots', frac: exactHots - hots },
  ].sort((a, b) => b.frac - a.frac);

  for (let i = 0; i < remainder; i++) {
    const target = fractions[i % fractions.length].key;
    if (target === 'lots') lots++;
    else if (target === 'mots') mots++;
    else hots++;
  }
  return { lots, mots, hots };
}

export default function Sumatif() {
  const {
    profile,
    calendarData,
    schedules,
    savedProtas,
    lockedProtas = {},
    geminiApiKey,
    sumatifConfig = DEFAULT_SUMATIF_CONFIG,
    isSumatifConfigLocked = false,
    savedSumatifs = [],
    setSumatifConfig,
    toggleLockSumatifConfig,
    addSavedSumatif,
    deleteSavedSumatif,
  } = useStore();

  const [generating, setGenerating] = useState(false);
  const [exportingPart, setExportingPart] = useState<string | null>(null);
  const [activeDocId, setActiveDocId] = useState<string | null>(
    savedSumatifs[0]?.id || null
  );
  const [activeTab, setActiveTab] = useState<PreviewTab>('naskah');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activeGrade = sumatifConfig.grade || 1;
  const activeJenis = sumatifConfig.jenisSumatif || 'ASAS';
  const gradeProta = savedProtas[activeGrade] || [];
  const isProtaLocked = Boolean(lockedProtas[activeGrade]) && gradeProta.length > 0;

  // Map Prota ATPs to Semester 1 / Semester 2 using calendarData & schedule
  const flattenedAtps = useMemo<FlattenedAtpItem[]>(() => {
    if (!Array.isArray(gradeProta) || gradeProta.length === 0) return [];

    // Compute effective teaching dates for activeGrade if schedule exists
    const effectiveDates: Date[] = [];
    const schedule = schedules[activeGrade];
    if (schedule?.day) {
      const dayMap: Record<string, number> = {
        Minggu: 0,
        Senin: 1,
        Selasa: 2,
        Rabu: 3,
        Kamis: 4,
        Jumat: 5,
        Sabtu: 6,
      };
      const targetDayIdx = dayMap[schedule.day];
      if (targetDayIdx !== undefined) {
        const startYear = calendarData
          ? parseInt(calendarData.academicYear.split('/')[0] || '2026', 10)
          : 2026;
        const startDate = new Date(startYear, 6, 1);
        const endDate = new Date(startYear + 1, 5, 30);
        const events =
          activeGrade === 6
            ? calendarData?.events6 || {}
            : calendarData?.events1to5 || {};
        const weeklyDays = calendarData?.weeklyDays ?? 5;

        const allDays = eachDayOfInterval({ start: startDate, end: endDate });
        for (const d of allDays) {
          if (getDay(d) !== targetDayIdx) continue;
          const dIdx = getDay(d);
          if (dIdx === 0) continue;
          if (dIdx === 6 && weeklyDays === 5) continue;
          const dateStr = format(d, 'yyyy-MM-dd');
          const ev = events[dateStr];
          if (ev && !ev.isEffective) continue;
          effectiveDates.push(d);
        }
      }
    }

    const rawItems: Omit<FlattenedAtpItem, 'semester'>[] = [];
    let counter = 0;
    for (const item of gradeProta) {
      const atps: string[] = Array.isArray(item.atp) ? item.atp : [];
      for (const atpText of atps) {
        rawItems.push({
          globalIdx: counter++,
          elemen: item.elemen || 'PAI BP',
          cp: item.cp || '',
          tp: Array.isArray(item.tp) ? item.tp : [item.tp || ''],
          atpText,
        });
      }
    }

    const total = rawItems.length;
    return rawItems.map((it, idx) => {
      let semester: 1 | 2 = idx < Math.ceil(total / 2) ? 1 : 2;
      if (effectiveDates[idx]) {
        semester = effectiveDates[idx].getMonth() >= 6 ? 1 : 2;
      }
      return { ...it, semester };
    });
  }, [gradeProta, schedules, calendarData, activeGrade]);

  const targetAtps = useMemo(() => {
    if (activeJenis === 'ASAS') {
      const sem1 = flattenedAtps.filter((a) => a.semester === 1);
      return sem1.length > 0 ? sem1 : flattenedAtps;
    }
    if (activeJenis === 'ASAT' || activeJenis === 'ASAJ') {
      const sem2 = flattenedAtps.filter((a) => a.semester === 2);
      return sem2.length > 0 ? sem2 : flattenedAtps;
    }
    // HARIAN: use user-selected indices
    const selectedSet = new Set(sumatifConfig.selectedAtpIndices || []);
    return flattenedAtps.filter((a) => selectedSet.has(a.globalIdx));
  }, [activeJenis, flattenedAtps, sumatifConfig.selectedAtpIndices]);

  const activeDoc: SumatifDocument | null = useMemo(() => {
    if (activeDocId) {
      const found = savedSumatifs.find((d) => d.id === activeDocId);
      if (found) return found;
    }
    return savedSumatifs[0] || null;
  }, [activeDocId, savedSumatifs]);

  const difficultySum =
    Number(sumatifConfig.komposisiLots || 0) +
    Number(sumatifConfig.komposisiMots || 0) +
    Number(sumatifConfig.komposisiHots || 0);

  const totalQuestions =
    Number(sumatifConfig.jumlahPg || 0) +
    Number(sumatifConfig.jumlahIsian || 0) +
    Number(sumatifConfig.jumlahUraian || 0);

  const pgDist = distributeClientCounts(
    Number(sumatifConfig.jumlahPg || 0),
    sumatifConfig.komposisiLots,
    sumatifConfig.komposisiMots,
    sumatifConfig.komposisiHots
  );
  const totalDist = distributeClientCounts(
    totalQuestions,
    sumatifConfig.komposisiLots,
    sumatifConfig.komposisiMots,
    sumatifConfig.komposisiHots
  );

  const updateConfig = (patch: Partial<SumatifConfig>) => {
    if (isSumatifConfigLocked) return;
    setSumatifConfig({
      ...sumatifConfig,
      ...patch,
    });
  };

  const handleGradeSelect = (nextGrade: number) => {
    if (isSumatifConfigLocked) return;
    let nextJenis = sumatifConfig.jenisSumatif;
    if (nextGrade === 6 && nextJenis === 'ASAT') {
      nextJenis = 'ASAJ';
    } else if (nextGrade < 6 && nextJenis === 'ASAJ') {
      nextJenis = 'ASAT';
    }
    setSumatifConfig({
      ...sumatifConfig,
      grade: nextGrade,
      jenisSumatif: nextJenis,
      selectedAtpIndices: [],
    });
  };

  const handleJenisSelect = (nextJenis: SumatifType) => {
    if (isSumatifConfigLocked) return;
    let nextGrade = sumatifConfig.grade;
    if (nextJenis === 'ASAT' && nextGrade === 6) {
      nextGrade = 5;
    } else if (nextJenis === 'ASAJ' && nextGrade !== 6) {
      nextGrade = 6;
    }
    setSumatifConfig({
      ...sumatifConfig,
      jenisSumatif: nextJenis,
      grade: nextGrade,
      selectedAtpIndices: nextGrade !== sumatifConfig.grade ? [] : sumatifConfig.selectedAtpIndices,
    });
  };

  const toggleAtpSelection = (globalIdx: number) => {
    if (isSumatifConfigLocked) return;
    const current = new Set(sumatifConfig.selectedAtpIndices || []);
    if (current.has(globalIdx)) current.delete(globalIdx);
    else current.add(globalIdx);
    updateConfig({ selectedAtpIndices: Array.from(current).sort((a, b) => a - b) });
  };

  const selectAllAtps = (sem?: 1 | 2) => {
    if (isSumatifConfigLocked) return;
    const indices = flattenedAtps
      .filter((a) => (sem ? a.semester === sem : true))
      .map((a) => a.globalIdx);
    updateConfig({ selectedAtpIndices: indices });
  };

  const getSemesterLabel = (jenis: SumatifType): string => {
    if (jenis === 'ASAS') return 'Semester 1 (Ganjil)';
    if (jenis === 'ASAT' || jenis === 'ASAJ') return 'Semester 2 (Genap)';
    const semSet = new Set(targetAtps.map((a) => a.semester));
    if (semSet.size === 1 && semSet.has(2)) return 'Semester 2 (Genap)';
    if (semSet.size === 1 && semSet.has(1)) return 'Semester 1 (Ganjil)';
    return 'Semester 1 & 2';
  };

  const getJudulAsesmen = (jenis: SumatifType, grade: number): string => {
    switch (jenis) {
      case 'HARIAN':
        return `Asesmen Sumatif Harian PAI BP Kelas ${grade}`;
      case 'ASAS':
        return `Asesmen Sumatif Akhir Semester (ASAS) 1 Kelas ${grade}`;
      case 'ASAT':
        return `Asesmen Sumatif Akhir Tahun (ASAT) Kelas ${grade}`;
      case 'ASAJ':
        return `Asesmen Sumatif Akhir Jenjang (ASAJ) Kelas 6`;
    }
  };

  const handleGenerate = async () => {
    setErrorMsg(null);
    if (!isProtaLocked) {
      setErrorMsg(
        `Program Tahunan Kelas ${activeGrade} belum dibuat atau belum dikunci. Silakan simpan dan kunci Prota terlebih dahulu.`
      );
      return;
    }
    if (activeJenis === 'ASAT' && activeGrade === 6) {
      setErrorMsg('ASAT Semester 2 hanya tersedia untuk Kelas 1 sampai Kelas 5. Untuk Kelas 6 gunakan ASAJ.');
      return;
    }
    if (activeJenis === 'ASAJ' && activeGrade !== 6) {
      setErrorMsg('ASAJ Semester 2 khusus untuk Kelas 6.');
      return;
    }
    if (activeJenis === 'HARIAN' && targetAtps.length === 0) {
      setErrorMsg('Pilih minimal 1 ATP dari database Prota untuk membuat Sumatif Harian.');
      return;
    }
    if (difficultySum !== 100) {
      setErrorMsg(`Total komposisi LOTS + MOTS + HOTS harus tepat 100% (saat ini ${difficultySum}%).`);
      return;
    }
    if (totalQuestions <= 0) {
      setErrorMsg('Total jumlah soal (PG + Isian + Uraian) harus lebih dari 0.');
      return;
    }

    // Group targetAtps by Elemen so prompt gets exact locked Prota context
    const groupedMap = new Map<
      string,
      { elemen: string; cp: string; tp: string[]; selectedAtps: string[] }
    >();
    for (const item of targetAtps) {
      const existing = groupedMap.get(item.elemen);
      if (existing) {
        existing.selectedAtps.push(item.atpText);
      } else {
        groupedMap.set(item.elemen, {
          elemen: item.elemen,
          cp: item.cp,
          tp: item.tp,
          selectedAtps: [item.atpText],
        });
      }
    }

    // Collect stems from ALL saved assessments across ALL grades for strict anti-duplication
    const previousQuestionStems: string[] = [];
    for (const doc of savedSumatifs) {
      for (const s of doc.soalPg || []) {
        if (s.pertanyaan) previousQuestionStems.push(`[Kls ${doc.grade}] ${s.pertanyaan}`);
      }
      for (const s of doc.soalIsian || []) {
        if (s.pertanyaan) previousQuestionStems.push(`[Kls ${doc.grade}] ${s.pertanyaan}`);
      }
      for (const s of doc.soalUraian || []) {
        if (s.pertanyaan) previousQuestionStems.push(`[Kls ${doc.grade}] ${s.pertanyaan}`);
      }
    }

    const semesterLabel = getSemesterLabel(activeJenis);
    const judulAsesmen = getJudulAsesmen(activeJenis, activeGrade);

    setGenerating(true);
    try {
      const response = await fetch('/api/sumatif/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grade: activeGrade,
          jenisSumatif: activeJenis,
          semesterLabel,
          judulAsesmen,
          protaItems: Array.from(groupedMap.values()),
          config: sumatifConfig,
          profile,
          previousQuestionStems,
          userApiKey: geminiApiKey || undefined,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Gagal menghasilkan Naskah Sumatif.');
      }

      const newDoc: SumatifDocument = {
        id: `sumatif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt: Date.now(),
        grade: activeGrade,
        jenisSumatif: activeJenis,
        semesterLabel,
        judulAsesmen,
        configSnapshot: { ...sumatifConfig },
        kisiKisi: payload.kisiKisi || [],
        soalPg: payload.soalPg || [],
        soalIsian: payload.soalIsian || [],
        soalUraian: payload.soalUraian || [],
        rubrikUmum: payload.rubrikUmum,
      };

      addSavedSumatif(newDoc);
      setActiveDocId(newDoc.id);
      setActiveTab('naskah');
    } catch (err: any) {
      console.error('Sumatif generate error:', err);
      setErrorMsg(err?.message || 'Terjadi kesalahan saat menyusun naskah sumatif.');
    } finally {
      setGenerating(false);
    }
  };

  const handleExport = async (
    key: 'kisi' | 'naskah' | 'kunci' | 'rubrik' | 'paket'
  ) => {
    if (!activeDoc) return;
    setExportingPart(key);
    try {
      if (key === 'kisi') await downloadKisiKisiDocx(activeDoc, profile);
      else if (key === 'naskah') await downloadNaskahSoalDocx(activeDoc, profile);
      else if (key === 'kunci') await downloadKunciJawabanDocx(activeDoc, profile);
      else if (key === 'rubrik') await downloadRubrikPenskoranDocx(activeDoc, profile);
      else await downloadPaketLengkapDocx(activeDoc, profile);
    } catch (err) {
      console.error('Export Word error:', err);
      setErrorMsg('Gagal mengunduh dokumen Word. Silakan coba lagi.');
    } finally {
      setExportingPart(null);
    }
  };

  const previewFontStyle = activeDoc
    ? {
        fontFamily: `"${activeDoc.configSnapshot.fontFamily}", serif`,
        fontSize: `${activeDoc.configSnapshot.fontSize}pt`,
      }
    : undefined;

  return (
    <Layout>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-1">
              <FileCheck2 className="w-4 h-4" />
              <span>Asesmen PPA Jenjang SD Tahun 2026</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">
              Pembuat Naskah Sumatif PAI BP
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Menghasilkan Kisi-Kisi, Naskah Soal, Kunci Jawaban, dan Rubrik Penskoran langsung dari database Prota yang telah dikunci.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={toggleLockSumatifConfig}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors border ${
                isSumatifConfigLocked
                  ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                  : 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
              }`}
            >
              {isSumatifConfigLocked ? (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Konfigurasi Terkunci (Buka Kunci)</span>
                </>
              ) : (
                <>
                  <Unlock className="w-4 h-4" />
                  <span>Kunci Konfigurasi Naskah</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Grade & Prota Lock Status Selector */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                1. Pilih Kelas & Verifikasi Database Prota Terkunci
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Hanya kelas dengan Program Tahunan yang sudah disimpan & dikunci yang dapat menghasilkan naskah soal.
              </p>
            </div>
            <Link
              to="/prota"
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 underline whitespace-nowrap"
            >
              Kelola & Kunci Prota
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[1, 2, 3, 4, 5, 6].map((g) => {
              const hasProta = (savedProtas[g] || []).length > 0;
              const locked = Boolean(lockedProtas[g]) && hasProta;
              const isSelected = activeGrade === g;

              return (
                <button
                  key={g}
                  type="button"
                  disabled={isSumatifConfigLocked}
                  onClick={() => handleGradeSelect(g)}
                  className={`flex flex-col items-start p-3.5 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/20'
                      : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/70'
                  } ${isSumatifConfigLocked ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-sm font-bold text-slate-900">Kelas {g}</span>
                    {locked ? (
                      <Lock className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    )}
                  </div>
                  <span
                    className={`text-[11px] font-medium ${
                      locked ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {locked
                      ? 'Prota Terkunci'
                      : hasProta
                      ? 'Belum Dikunci'
                      : 'Prota Kosong'}
                  </span>
                </button>
              );
            })}
          </div>

          {!isProtaLocked && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">
                    Database Prota Kelas {activeGrade} belum siap / belum dikunci.
                  </p>
                  <p className="text-xs text-amber-800 mt-0.5">
                    Buka menu Program Tahunan, hasilkan Prota Kelas {activeGrade}, klik Simpan, lalu aktifkan tombol Kunci Prota agar naskah sumatif dapat disusun.
                  </p>
                </div>
              </div>
              <Link
                to="/prota"
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold whitespace-nowrap text-center"
              >
                Buka Program Tahunan
              </Link>
            </div>
          )}
        </div>

        {/* Assessment Type & Config Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Jenis Asesmen + ATP Scope + Generate */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                2. Jenis Asesmen Sumatif
              </h2>

              <div className="grid grid-cols-1 gap-2.5">
                {(
                  [
                    {
                      type: 'HARIAN' as SumatifType,
                      title: '1. Sumatif Harian',
                      desc: 'Aktif untuk Kelas 1 s.d. 6 berdasarkan pilihan ATP dari Prota.',
                      eligible: true,
                      badge: 'Kelas 1 – 6',
                    },
                    {
                      type: 'ASAS' as SumatifType,
                      title: '2. Asesmen Sumatif Akhir Semester (ASAS) 1',
                      desc: 'Cakupan materi Semester 1. Aktif untuk Kelas 1, 2, 3, 4, 5, dan 6.',
                      eligible: true,
                      badge: 'Sem 1 • Kls 1–6',
                    },
                    {
                      type: 'ASAT' as SumatifType,
                      title: '3. Asesmen Sumatif Akhir Tahun (ASAT)',
                      desc: 'Cakupan Semester 2. Aktif khusus Kelas 1, 2, 3, 4, dan 5.',
                      eligible: activeGrade <= 5,
                      badge: activeGrade === 6 ? 'Nonaktif (Khusus Kls 1–5)' : 'Sem 2 • Kls 1–5',
                    },
                    {
                      type: 'ASAJ' as SumatifType,
                      title: '4. Asesmen Sumatif Akhir Jenjang (ASAJ)',
                      desc: 'Khusus Kelas 6 Semester 2 (kelulusan jenjang SD).',
                      eligible: activeGrade === 6,
                      badge: activeGrade === 6 ? 'Aktif • Kls 6 Sem 2' : 'Khusus Kls 6 Sem 2',
                    },
                  ] as const
                ).map((item) => {
                  const isActive = activeJenis === item.type;
                  // Allow switching to ASAT (auto-moves to grade 5) or ASAJ (auto-moves to grade 6) if unlocked,
                  // while clearly showing eligibility indicator for active grade.
                  const isDisabled = isSumatifConfigLocked;

                  return (
                    <button
                      key={item.type}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => handleJenisSelect(item.type)}
                      className={`p-3.5 rounded-xl border text-left transition-all ${
                        isActive
                          ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20'
                          : item.eligible
                          ? 'bg-white border-slate-200 hover:bg-slate-50'
                          : 'bg-slate-50 border-slate-200/70 opacity-75 hover:opacity-100'
                      } ${isDisabled ? 'cursor-not-allowed opacity-75' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-slate-900">
                          {item.title}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-600 whitespace-nowrap">
                          {item.badge}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">{item.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ATP Picker for Sumatif Harian OR Summary for ASAS/ASAT/ASAJ */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  3. Cakupan ATP Prota Kelas {activeGrade}
                </h2>
                <span className="text-xs font-semibold text-emerald-700 tabular-nums whitespace-nowrap">
                  {targetAtps.length} ATP terpilih
                </span>
              </div>

              {activeJenis === 'HARIAN' ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={isSumatifConfigLocked || flattenedAtps.length === 0}
                      onClick={() => selectAllAtps(1)}
                      className="px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg whitespace-nowrap disabled:opacity-50"
                    >
                      Pilih Sem 1
                    </button>
                    <button
                      type="button"
                      disabled={isSumatifConfigLocked || flattenedAtps.length === 0}
                      onClick={() => selectAllAtps(2)}
                      className="px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg whitespace-nowrap disabled:opacity-50"
                    >
                      Pilih Sem 2
                    </button>
                    <button
                      type="button"
                      disabled={isSumatifConfigLocked || flattenedAtps.length === 0}
                      onClick={() => updateConfig({ selectedAtpIndices: [] })}
                      className="px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg whitespace-nowrap disabled:opacity-50"
                    >
                      Kosongkan
                    </button>
                  </div>

                  {flattenedAtps.length === 0 ? (
                    <p className="text-xs text-slate-500 py-3">
                      Belum ada ATP di database Prota Kelas {activeGrade}.
                    </p>
                  ) : (
                    <div className="max-h-72 overflow-y-auto pr-1 space-y-2">
                      {flattenedAtps.map((atp) => {
                        const checked = (sumatifConfig.selectedAtpIndices || []).includes(
                          atp.globalIdx
                        );
                        return (
                          <label
                            key={atp.globalIdx}
                            className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                              checked
                                ? 'bg-emerald-50/70 border-emerald-400'
                                : 'bg-slate-50/50 border-slate-200 hover:bg-slate-100/60'
                            } ${isSumatifConfigLocked ? 'opacity-70 cursor-not-allowed' : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={isSumatifConfigLocked}
                              onChange={() => toggleAtpSelection(atp.globalIdx)}
                              className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-500 mb-0.5">
                                <span className="truncate">{atp.elemen}</span>
                                <span className="whitespace-nowrap">Sem {atp.semester}</span>
                              </div>
                              <p className="text-slate-800 leading-relaxed">{atp.atpText}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                  <p className="text-xs text-slate-700 leading-relaxed">
                    Untuk <strong>{activeJenis}</strong>, sistem otomatis memetakan seluruh{' '}
                    <strong>{targetAtps.length} ATP</strong> pada{' '}
                    <strong>{getSemesterLabel(activeJenis)}</strong> dari Prota Kelas {activeGrade} yang telah dikunci.
                  </p>
                  {targetAtps.length > 0 && (
                    <ul className="max-h-44 overflow-y-auto space-y-1 text-xs text-slate-600 list-disc pl-4">
                      {targetAtps.map((a) => (
                        <li key={a.globalIdx}>
                          <span className="font-semibold text-slate-700">{a.elemen}:</span> {a.atpText}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: Configuration Options + Generate Button */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    4. Konfigurasi Naskah & Tata Letak Word
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Pengaturan ini langsung diterapkan ke pratinjau dan seluruh dokumen Word (.docx).
                  </p>
                </div>
                {isSumatifConfigLocked && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 whitespace-nowrap">
                    <Lock className="w-3.5 h-3.5" />
                    Terkunci
                  </span>
                )}
              </div>

              {/* Font & Size & Paper & Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jenis Huruf (Font)
                  </label>
                  <select
                    value={sumatifConfig.fontFamily}
                    disabled={isSumatifConfigLocked}
                    onChange={(e) =>
                      updateConfig({ fontFamily: e.target.value as SumatifFontFamily })
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 disabled:bg-slate-100"
                  >
                    {FONT_FAMILIES.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ukuran Font (Size)
                  </label>
                  <select
                    value={sumatifConfig.fontSize}
                    disabled={isSumatifConfigLocked}
                    onChange={(e) =>
                      updateConfig({ fontSize: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 tabular-nums disabled:bg-slate-100"
                  >
                    {FONT_SIZES.map((s) => (
                      <option key={s} value={s}>
                        {s} pt
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ukuran Kertas
                  </label>
                  <select
                    value={sumatifConfig.paperSize}
                    disabled={isSumatifConfigLocked}
                    onChange={(e) =>
                      updateConfig({ paperSize: e.target.value as 'A4' | 'F4' })
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 disabled:bg-slate-100"
                  >
                    <option value="A4">A4 (21 x 29,7 cm)</option>
                    <option value="F4">F4 / Folio (21,5 x 33 cm)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Waktu (Menit)
                  </label>
                  <input
                    type="number"
                    min={15}
                    max={180}
                    step={5}
                    disabled={isSumatifConfigLocked}
                    value={sumatifConfig.waktuMenit}
                    onChange={(e) =>
                      updateConfig({ waktuMenit: Math.max(15, Number(e.target.value) || 60) })
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 tabular-nums disabled:bg-slate-100"
                  />
                </div>
              </div>

              {/* Opsi Pilihan Ganda Horizontal vs Vertical */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Tata Letak Opsi Pilihan Ganda (A, B, C, D)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(
                    [
                      {
                        value: 'horizontal' as SumatifOptionLayout,
                        title: 'Horizontal (Sejajar 1 Baris ke Samping)',
                        preview: 'A. ...    B. ...    C. ...    D. ...',
                      },
                      {
                        value: 'vertical' as SumatifOptionLayout,
                        title: 'Vertikal (A s.d. D Satu Baris ke Bawah)',
                        preview: 'A. ... / B. ... / C. ... / D. ...',
                      },
                    ] as const
                  ).map((opt) => {
                    const selected = sumatifConfig.optionLayout === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={isSumatifConfigLocked}
                        onClick={() => updateConfig({ optionLayout: opt.value })}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          selected
                            ? 'bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/20'
                            : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/70'
                        } ${isSumatifConfigLocked ? 'opacity-70 cursor-not-allowed' : ''}`}
                      >
                        <div className="text-xs font-bold text-slate-900">{opt.title}</div>
                        <div className="text-[11px] font-mono text-slate-600 mt-1">
                          {opt.preview}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Question Counts */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jumlah Pilihan Ganda (PG)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    disabled={isSumatifConfigLocked}
                    value={sumatifConfig.jumlahPg}
                    onChange={(e) =>
                      updateConfig({ jumlahPg: Math.max(0, Math.min(50, Number(e.target.value) || 0)) })
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 tabular-nums disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jumlah Isian Singkat
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    disabled={isSumatifConfigLocked}
                    value={sumatifConfig.jumlahIsian}
                    onChange={(e) =>
                      updateConfig({ jumlahIsian: Math.max(0, Math.min(30, Number(e.target.value) || 0)) })
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 tabular-nums disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jumlah Soal Uraian
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    disabled={isSumatifConfigLocked}
                    value={sumatifConfig.jumlahUraian}
                    onChange={(e) =>
                      updateConfig({ jumlahUraian: Math.max(0, Math.min(20, Number(e.target.value) || 0)) })
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 tabular-nums disabled:bg-slate-100"
                  />
                </div>
              </div>

              {/* Difficulty Composition LOTS / MOTS / HOTS */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Komposisi Tingkat Kesulitan (%)
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Total wajib 100% ({totalDist.lots} LOTS, {totalDist.mots} MOTS, {totalDist.hots} HOTS dari {totalQuestions} soal)
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={isSumatifConfigLocked}
                      onClick={() =>
                        updateConfig({ komposisiLots: 30, komposisiMots: 40, komposisiHots: 30 })
                      }
                      className="px-2 py-1 text-[11px] font-semibold bg-white border border-slate-300 rounded-lg hover:bg-slate-100 whitespace-nowrap disabled:opacity-50"
                    >
                      30 / 40 / 30
                    </button>
                    <button
                      type="button"
                      disabled={isSumatifConfigLocked}
                      onClick={() =>
                        updateConfig({ komposisiLots: 25, komposisiMots: 50, komposisiHots: 25 })
                      }
                      className="px-2 py-1 text-[11px] font-semibold bg-white border border-slate-300 rounded-lg hover:bg-slate-100 whitespace-nowrap disabled:opacity-50"
                    >
                      25 / 50 / 25
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      LOTS (C1–C2) %
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      disabled={isSumatifConfigLocked}
                      value={sumatifConfig.komposisiLots}
                      onChange={(e) =>
                        updateConfig({ komposisiLots: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })
                      }
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-800 tabular-nums disabled:bg-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      MOTS (C3) %
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      disabled={isSumatifConfigLocked}
                      value={sumatifConfig.komposisiMots}
                      onChange={(e) =>
                        updateConfig({ komposisiMots: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })
                      }
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-800 tabular-nums disabled:bg-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      HOTS (C4–C6) %
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      disabled={isSumatifConfigLocked}
                      value={sumatifConfig.komposisiHots}
                      onChange={(e) =>
                        updateConfig({ komposisiHots: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })
                      }
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-800 tabular-nums disabled:bg-slate-100"
                    />
                  </div>
                </div>

                {difficultySum !== 100 && (
                  <p className="text-xs font-semibold text-rose-600">
                    Jumlah persentase saat ini {difficultySum}%. Sesuaikan agar tepat 100%.
                  </p>
                )}
              </div>

              {/* Date & Illustrations toggle */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tanggal Pelaksanaan (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: 8 Desember 2026"
                    disabled={isSumatifConfigLocked}
                    value={sumatifConfig.tanggalPelaksanaan || ''}
                    onChange={(e) => updateConfig({ tanggalPelaksanaan: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 disabled:bg-slate-100"
                  />
                </div>

                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/70 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sumatifConfig.includeIllustrations}
                    disabled={isSumatifConfigLocked}
                    onChange={(e) => updateConfig({ includeIllustrations: e.target.checked })}
                    className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div className="text-xs">
                    <div className="font-semibold text-slate-800">
                      Sertakan Gambar Ilustrasi Kontekstual
                    </div>
                    <div className="text-slate-500 mt-0.5">
                      Otomatis tanpa memvisualisasikan sosok atau wajah Nabi & Rasul (termasuk wajah bercahaya).
                    </div>
                  </div>
                </label>
              </div>

              {errorMsg && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-200">
                <div className="text-xs text-slate-600 space-y-0.5">
                  <div>
                    Target PG: <strong>{pgDist.lots} LOTS</strong>, <strong>{pgDist.mots} MOTS</strong>,{' '}
                    <strong>{pgDist.hots} HOTS</strong>
                  </div>
                  <div className="text-slate-500">
                    Bebas soal kembar lintas kelas • Aksara Arab Unicode berharakat lengkap
                  </div>
                </div>

                <button
                  type="button"
                  disabled={generating || !isProtaLocked}
                  onClick={handleGenerate}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold whitespace-nowrap shadow-sm transition-colors"
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menyusun Perangkat Sumatif...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Buat Naskah Sumatif</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Saved Sumatifs Selector & Export + Preview */}
        {savedSumatifs.length > 0 && (
          <div className="space-y-4">
            {/* History Bar */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Arsip Naskah Sumatif Tersimpan ({savedSumatifs.length})
                </h3>
              </div>
              <div className="flex gap-2.5 overflow-x-auto pb-1">
                {savedSumatifs.map((item) => {
                  const selected = activeDoc?.id === item.id;
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border shrink-0 transition-colors ${
                        selected
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-900'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setActiveDocId(item.id)}
                        className="text-left"
                      >
                        <div className="text-xs font-bold whitespace-nowrap">
                          {item.jenisSumatif} • Kelas {item.grade}
                        </div>
                        <div className="text-[11px] text-slate-500 whitespace-nowrap tabular-nums">
                          {item.soalPg.length} PG / {item.soalIsian.length} Isian / {item.soalUraian.length} Uraian
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteSavedSumatif(item.id)}
                        title="Hapus naskah ini"
                        className="p-1 text-slate-400 hover:text-rose-600 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {activeDoc && (
              <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
                {/* Export Bar */}
                <div className="p-5 bg-slate-50 border-b border-slate-200 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{activeDoc.semesterLabel} • {activeDoc.configSnapshot.fontFamily} {activeDoc.configSnapshot.fontSize}pt • Opsi {activeDoc.configSnapshot.optionLayout === 'horizontal' ? 'Horizontal 1 Baris' : 'Vertikal ke Bawah'}</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                      {activeDoc.judulAsesmen}
                    </h3>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={exportingPart !== null}
                      onClick={() => handleExport('kisi')}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 rounded-xl text-xs font-semibold whitespace-nowrap"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{exportingPart === 'kisi' ? 'Mengunduh...' : '1. Kisi-Kisi (.docx)'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={exportingPart !== null}
                      onClick={() => handleExport('naskah')}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 rounded-xl text-xs font-semibold whitespace-nowrap"
                    >
                      <FileText className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{exportingPart === 'naskah' ? 'Mengunduh...' : '2. Naskah Soal (.docx)'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={exportingPart !== null}
                      onClick={() => handleExport('kunci')}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 rounded-xl text-xs font-semibold whitespace-nowrap"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{exportingPart === 'kunci' ? 'Mengunduh...' : '3. Kunci Jawaban (.docx)'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={exportingPart !== null}
                      onClick={() => handleExport('rubrik')}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 rounded-xl text-xs font-semibold whitespace-nowrap"
                    >
                      <ClipboardCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{exportingPart === 'rubrik' ? 'Mengunduh...' : '4. Rubrik & Penskoran (.docx)'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={exportingPart !== null}
                      onClick={() => handleExport('paket')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold whitespace-nowrap shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{exportingPart === 'paket' ? 'Menyiapkan...' : 'Unduh Paket Lengkap (.docx)'}</span>
                    </button>
                  </div>
                </div>

                {/* Preview Tabs */}
                <div className="flex border-b border-slate-200 bg-white px-4 overflow-x-auto">
                  {(
                    [
                      { id: 'kisi', label: `Kisi-Kisi Soal (${activeDoc.kisiKisi.length})`, icon: Layers },
                      { id: 'naskah', label: 'Naskah Soal', icon: BookOpen },
                      { id: 'kunci', label: 'Kunci Jawaban', icon: KeyRound },
                      { id: 'rubrik', label: 'Rubrik & Penskoran PPA 2026', icon: ClipboardCheck },
                    ] as const
                  ).map((t) => {
                    const active = activeTab === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setActiveTab(t.id)}
                        className={`inline-flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
                          active
                            ? 'border-emerald-600 text-emerald-700'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <t.icon className="w-4 h-4" />
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Preview Body */}
                <div className="p-6 lg:p-8 bg-white overflow-x-auto" style={previewFontStyle}>
                  {activeTab === 'kisi' && (
                    <div className="space-y-4">
                      <div className="text-center border-b-2 border-slate-800 pb-3">
                        <div className="font-bold text-base">KISI-KISI PENULISAN SOAL</div>
                        <div className="font-bold">{activeDoc.judulAsesmen}</div>
                        <div className="text-xs text-slate-600">
                          {profile?.namaSekolah || 'SD Negeri'} • Tahun Pelajaran {profile?.tahunPelajaran || '2026/2027'} • Acuan PPA SD 2026
                        </div>
                      </div>

                      <table className="w-full border-collapse border border-slate-400 text-xs">
                        <thead>
                          <tr className="bg-slate-100">
                            <th className="border border-slate-400 p-2 text-center">No</th>
                            <th className="border border-slate-400 p-2 text-left">Elemen</th>
                            <th className="border border-slate-400 p-2 text-left">TP / ATP (Prota)</th>
                            <th className="border border-slate-400 p-2 text-left">Materi Pokok</th>
                            <th className="border border-slate-400 p-2 text-left">Indikator Soal</th>
                            <th className="border border-slate-400 p-2 text-center">Level</th>
                            <th className="border border-slate-400 p-2 text-center">Kategori</th>
                            <th className="border border-slate-400 p-2 text-center">Bentuk</th>
                            <th className="border border-slate-400 p-2 text-center">No. Soal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeDoc.kisiKisi.map((row) => (
                            <tr key={row.no}>
                              <td className="border border-slate-400 p-2 text-center tabular-nums">{row.no}</td>
                              <td className="border border-slate-400 p-2">{row.elemen}</td>
                              <td className="border border-slate-400 p-2">{row.tpAtp}</td>
                              <td className="border border-slate-400 p-2">{row.materiPokok}</td>
                              <td className="border border-slate-400 p-2">{row.indikatorSoal}</td>
                              <td className="border border-slate-400 p-2 text-center">{row.levelKognitif}</td>
                              <td className="border border-slate-400 p-2 text-center font-bold">{row.kategoriKesulitan}</td>
                              <td className="border border-slate-400 p-2 text-center">{row.bentukSoal}</td>
                              <td className="border border-slate-400 p-2 text-center font-bold tabular-nums">{row.nomorSoal}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {activeTab === 'naskah' && (
                    <div className="max-w-4xl mx-auto space-y-6 text-slate-900">
                      <div className="text-center border-b-4 border-double border-slate-900 pb-3">
                        <div className="font-bold uppercase tracking-wide">
                          {profile?.namaSekolah || 'PEMERINTAH KABUPATEN/KOTA • DINAS PENDIDIKAN'}
                        </div>
                        <div className="font-bold text-lg">{activeDoc.judulAsesmen}</div>
                        <div className="text-sm">
                          Mata Pelajaran: Pendidikan Agama Islam dan Budi Pekerti • Kelas {activeDoc.grade} • {activeDoc.semesterLabel}
                        </div>
                      </div>

                      {activeDoc.soalPg.length > 0 && (
                        <div className="space-y-4">
                          <h4 className="font-bold">
                            I. Berilah tanda silang (X) pada huruf A, B, C, atau D pada jawaban yang paling benar!
                          </h4>
                          <div className="space-y-4">
                            {activeDoc.soalPg.map((item) => {
                              const safeSvg = sanitizeClientSvg(item.svgIllustration);
                              return (
                                <div key={item.nomor} className="space-y-2">
                                  {item.stimulus && (
                                    <p className="italic text-slate-700 pl-6">{item.stimulus}</p>
                                  )}
                                  {safeSvg && (
                                    <div className="pl-6 py-1 flex flex-col items-start">
                                      <div
                                        className="border border-slate-200 rounded-lg p-2 bg-white max-w-xs"
                                        dangerouslySetInnerHTML={{ __html: safeSvg }}
                                      />
                                      {item.illustrationCaption && (
                                        <span className="text-xs italic text-slate-500 mt-1">
                                          {item.illustrationCaption}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  {item.teksArab && (
                                    <div className="arabic-text text-center text-2xl py-1 bg-slate-50/70 rounded-lg px-4">
                                      {item.teksArab}
                                    </div>
                                  )}
                                  <div className="flex gap-2">
                                    <span className="font-bold tabular-nums">{item.nomor}.</span>
                                    <div className="flex-1 space-y-2">
                                      <p>{item.pertanyaan}</p>
                                      {activeDoc.configSnapshot.optionLayout === 'horizontal' ? (
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                                          {(['A', 'B', 'C', 'D'] as const).map((k) => (
                                            <div key={k}>
                                              <span className="font-bold">{k}.</span> {item.opsi[k]}
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <div className="space-y-1 pl-1">
                                          {(['A', 'B', 'C', 'D'] as const).map((k) => (
                                            <div key={k}>
                                              <span className="font-bold">{k}.</span> {item.opsi[k]}
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
                      )}

                      {activeDoc.soalIsian.length > 0 && (
                        <div className="space-y-3 pt-4 border-t border-slate-200">
                          <h4 className="font-bold">
                            II. Isilah titik-titik di bawah ini dengan jawaban yang singkat dan tepat!
                          </h4>
                          {activeDoc.soalIsian.map((item) => {
                            const safeSvg = sanitizeClientSvg(item.svgIllustration);
                            return (
                              <div key={item.nomor} className="space-y-1.5">
                                {item.stimulus && <p className="italic text-slate-700 pl-6">{item.stimulus}</p>}
                                {safeSvg && (
                                  <div className="pl-6 py-1">
                                    <div
                                      className="border border-slate-200 rounded-lg p-2 bg-white max-w-xs"
                                      dangerouslySetInnerHTML={{ __html: safeSvg }}
                                    />
                                  </div>
                                )}
                                {item.teksArab && (
                                  <div className="arabic-text text-center text-2xl py-1 bg-slate-50/70 rounded-lg px-4">
                                    {item.teksArab}
                                  </div>
                                )}
                                <div className="flex gap-2">
                                  <span className="font-bold tabular-nums">{item.nomor}.</span>
                                  <p>{item.pertanyaan} ...........................................</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {activeDoc.soalUraian.length > 0 && (
                        <div className="space-y-3 pt-4 border-t border-slate-200">
                          <h4 className="font-bold">
                            III. Jawablah pertanyaan-pertanyaan berikut ini dengan jelas dan benar!
                          </h4>
                          {activeDoc.soalUraian.map((item) => {
                            const safeSvg = sanitizeClientSvg(item.svgIllustration);
                            return (
                              <div key={item.nomor} className="space-y-1.5">
                                {item.stimulus && <p className="italic text-slate-700 pl-6">{item.stimulus}</p>}
                                {safeSvg && (
                                  <div className="pl-6 py-1">
                                    <div
                                      className="border border-slate-200 rounded-lg p-2 bg-white max-w-xs"
                                      dangerouslySetInnerHTML={{ __html: safeSvg }}
                                    />
                                  </div>
                                )}
                                {item.teksArab && (
                                  <div className="arabic-text text-center text-2xl py-1 bg-slate-50/70 rounded-lg px-4">
                                    {item.teksArab}
                                  </div>
                                )}
                                <div className="flex gap-2">
                                  <span className="font-bold tabular-nums">{item.nomor}.</span>
                                  <p>{item.pertanyaan}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'kunci' && (
                    <div className="max-w-4xl mx-auto space-y-6">
                      {activeDoc.soalPg.length > 0 && (
                        <div>
                          <h4 className="font-bold mb-2">I. Kunci Jawaban Pilihan Ganda</h4>
                          <table className="w-full border-collapse border border-slate-400 text-xs">
                            <thead>
                              <tr className="bg-slate-100">
                                <th className="border border-slate-400 p-2 w-12">No</th>
                                <th className="border border-slate-400 p-2 w-16">Kunci</th>
                                <th className="border border-slate-400 p-2 w-28">Level</th>
                                <th className="border border-slate-400 p-2 text-left">Pembahasan</th>
                              </tr>
                            </thead>
                            <tbody>
                              {activeDoc.soalPg.map((s) => (
                                <tr key={s.nomor}>
                                  <td className="border border-slate-400 p-2 text-center tabular-nums">{s.nomor}</td>
                                  <td className="border border-slate-400 p-2 text-center font-bold">{s.kunciJawaban}</td>
                                  <td className="border border-slate-400 p-2 text-center">{s.levelKognitif} ({s.kategoriKesulitan})</td>
                                  <td className="border border-slate-400 p-2">{s.pembahasan}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {activeDoc.soalIsian.length > 0 && (
                        <div>
                          <h4 className="font-bold mb-2">II. Kunci Jawaban Isian Singkat</h4>
                          <table className="w-full border-collapse border border-slate-400 text-xs">
                            <thead>
                              <tr className="bg-slate-100">
                                <th className="border border-slate-400 p-2 w-12">No</th>
                                <th className="border border-slate-400 p-2 text-left">Kunci Jawaban</th>
                                <th className="border border-slate-400 p-2 w-20">Skor</th>
                                <th className="border border-slate-400 p-2 text-left">Pedoman</th>
                              </tr>
                            </thead>
                            <tbody>
                              {activeDoc.soalIsian.map((s) => (
                                <tr key={s.nomor}>
                                  <td className="border border-slate-400 p-2 text-center tabular-nums">{s.nomor}</td>
                                  <td className="border border-slate-400 p-2 font-semibold">{s.kunciJawaban}</td>
                                  <td className="border border-slate-400 p-2 text-center tabular-nums">{s.skorMaksimal}</td>
                                  <td className="border border-slate-400 p-2">{s.pedomanPenskoran}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {activeDoc.soalUraian.length > 0 && (
                        <div>
                          <h4 className="font-bold mb-2">III. Kunci Jawaban Uraian</h4>
                          <table className="w-full border-collapse border border-slate-400 text-xs">
                            <thead>
                              <tr className="bg-slate-100">
                                <th className="border border-slate-400 p-2 w-12">No</th>
                                <th className="border border-slate-400 p-2 text-left">Kunci Jawaban</th>
                                <th className="border border-slate-400 p-2 w-24">Skor Maks</th>
                              </tr>
                            </thead>
                            <tbody>
                              {activeDoc.soalUraian.map((s) => (
                                <tr key={s.nomor}>
                                  <td className="border border-slate-400 p-2 text-center tabular-nums">{s.nomor}</td>
                                  <td className="border border-slate-400 p-2">{s.kunciJawaban}</td>
                                  <td className="border border-slate-400 p-2 text-center font-bold tabular-nums">{s.skorMaksimal}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'rubrik' && (
                    <div className="max-w-4xl mx-auto space-y-6">
                      <div>
                        <h4 className="font-bold mb-2">A. Rekapitulasi Bobot & Skor Maksimal</h4>
                        <table className="w-full border-collapse border border-slate-400 text-xs">
                          <thead>
                            <tr className="bg-slate-100">
                              <th className="border border-slate-400 p-2 text-left">Bentuk Soal</th>
                              <th className="border border-slate-400 p-2 text-center">Jumlah Soal</th>
                              <th className="border border-slate-400 p-2 text-center">Skor Maksimal</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td className="border border-slate-400 p-2">Pilihan Ganda</td>
                              <td className="border border-slate-400 p-2 text-center tabular-nums">{activeDoc.soalPg.length}</td>
                              <td className="border border-slate-400 p-2 text-center tabular-nums">{activeDoc.rubrikUmum.skorMaksPg}</td>
                            </tr>
                            <tr>
                              <td className="border border-slate-400 p-2">Isian Singkat</td>
                              <td className="border border-slate-400 p-2 text-center tabular-nums">{activeDoc.soalIsian.length}</td>
                              <td className="border border-slate-400 p-2 text-center tabular-nums">{activeDoc.rubrikUmum.skorMaksIsian}</td>
                            </tr>
                            <tr>
                              <td className="border border-slate-400 p-2">Uraian</td>
                              <td className="border border-slate-400 p-2 text-center tabular-nums">{activeDoc.soalUraian.length}</td>
                              <td className="border border-slate-400 p-2 text-center tabular-nums">{activeDoc.rubrikUmum.skorMaksUraian}</td>
                            </tr>
                            <tr className="bg-slate-50 font-bold">
                              <td className="border border-slate-400 p-2">Total Skor Maksimal</td>
                              <td className="border border-slate-400 p-2 text-center tabular-nums">
                                {activeDoc.soalPg.length + activeDoc.soalIsian.length + activeDoc.soalUraian.length}
                              </td>
                              <td className="border border-slate-400 p-2 text-center tabular-nums">{activeDoc.rubrikUmum.totalSkorMaksimal}</td>
                            </tr>
                          </tbody>
                        </table>
                        <p className="mt-3 text-sm font-bold">{activeDoc.rubrikUmum.rumusNilaiAkhir}</p>
                      </div>

                      {activeDoc.soalUraian.length > 0 && (
                        <div>
                          <h4 className="font-bold mb-2">B. Rubrik Analitik Soal Uraian</h4>
                          <table className="w-full border-collapse border border-slate-400 text-xs">
                            <thead>
                              <tr className="bg-slate-100">
                                <th className="border border-slate-400 p-2 w-16">No</th>
                                <th className="border border-slate-400 p-2 text-left">Pertanyaan</th>
                                <th className="border border-slate-400 p-2 w-16">Skor</th>
                                <th className="border border-slate-400 p-2 text-left">Kriteria Penilaian</th>
                              </tr>
                            </thead>
                            <tbody>
                              {activeDoc.soalUraian.flatMap((u) =>
                                u.rubrikPenskoran.map((r, i) => (
                                  <tr key={`${u.nomor}-${i}`}>
                                    <td className="border border-slate-400 p-2 text-center font-bold tabular-nums">
                                      {i === 0 ? u.nomor : ''}
                                    </td>
                                    <td className="border border-slate-400 p-2">
                                      {i === 0 ? u.pertanyaan : ''}
                                    </td>
                                    <td className="border border-slate-400 p-2 text-center font-bold tabular-nums">
                                      {r.skor}
                                    </td>
                                    <td className="border border-slate-400 p-2">{r.kriteria}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}

                      <div>
                        <h4 className="font-bold mb-2">C. Interval KKTP & Tindak Lanjut (PPA SD 2026)</h4>
                        <table className="w-full border-collapse border border-slate-400 text-xs">
                          <thead>
                            <tr className="bg-slate-100">
                              <th className="border border-slate-400 p-2 w-28">Interval</th>
                              <th className="border border-slate-400 p-2 w-40">Predikat KKTP</th>
                              <th className="border border-slate-400 p-2 text-left">Tindak Lanjut (Remedial / Pengayaan)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeDoc.rubrikUmum.intervalKktp.map((row) => (
                              <tr key={row.rentang}>
                                <td className="border border-slate-400 p-2 text-center font-bold tabular-nums">{row.rentang}</td>
                                <td className="border border-slate-400 p-2 text-center font-semibold">{row.predikat}</td>
                                <td className="border border-slate-400 p-2">{row.tindakLanjut}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
