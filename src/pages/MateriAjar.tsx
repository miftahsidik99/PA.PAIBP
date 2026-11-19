import React, { useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout';
import {
  MateriAjarInfografis,
  MateriFokusMode,
  MateriTemplateStyle,
  useStore,
} from '../store/useStore';
import { cpData } from '../data/cp';
import { generateMateriAjarClient } from '../lib/geminiClient';
import {
  INFOGRAFIS_THEMES,
  downloadMateriPdf,
  renderMateriPdfPagesPreview,
} from '../lib/materiPdf';
import {
  MATERI_TEMPLATE_OPTIONS,
  getTemplateOption,
  recommendMateriTemplates,
} from '../lib/materiTemplates';
import {
  AlertCircle,
  BookOpen,
  Check,
  Download,
  FileText,
  Layers,
  Loader2,
  Maximize2,
  Minimize2,
  Sparkles,
  Trash2,
} from 'lucide-react';

type TemplatePickMode = 'rekomendasi' | 'manual';

interface TpCandidate {
  id: string;
  elemen: string;
  cp: string;
  tp: string;
  sourceLabel: string;
}

export default function MateriAjar() {
  const {
    profile,
    savedProtas,
    lockedProtas,
    geminiApiKey,
    savedMateriAjars,
    addSavedMateriAjar,
    deleteSavedMateriAjar,
  } = useStore();

  const [selectedGrade, setSelectedGrade] = useState<number>(1);
  const [fokusPilihan, setFokusPilihan] = useState<MateriFokusMode>('tp');
  const [selectedElemen, setSelectedElemen] = useState<string>('');
  const [selectedTpId, setSelectedTpId] = useState<string>('');

  const [templateMode, setTemplateMode] = useState<TemplatePickMode>('rekomendasi');
  const [chosenRecStyle, setChosenRecStyle] = useState<MateriTemplateStyle | null>(null);
  const [manualStyle, setManualStyle] = useState<MateriTemplateStyle>('educational_infographic');
  const [temaWarna, setTemaWarna] = useState<MateriAjarInfografis['temaWarna']>('emerald');

  const [generating, setGenerating] = useState(false);
  const [renderingPdf, setRenderingPdf] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [previewPages, setPreviewPages] = useState<string[]>([]);
  const [isZoomed, setIsZoomed] = useState(false);

  const fase: 'A' | 'B' | 'C' =
    selectedGrade <= 2 ? 'A' : selectedGrade <= 4 ? 'B' : 'C';

  const hasSavedProtaForGrade =
    Array.isArray(savedProtas?.[selectedGrade]) && savedProtas[selectedGrade].length > 0;
  const isProtaLocked = Boolean(lockedProtas?.[selectedGrade]);

  // Auto-switch back to 'tp' if the selected grade has no saved Prota
  useEffect(() => {
    if (fokusPilihan === 'atp' && !hasSavedProtaForGrade) {
      setFokusPilihan('tp');
    }
  }, [fokusPilihan, hasSavedProtaForGrade]);

  // Build candidate TPs or ATPs from cpData ('tp') or savedProtas[selectedGrade] ('atp')
  const gradeCandidates: TpCandidate[] = useMemo(() => {
    if (fokusPilihan === 'atp') {
      const gradeProta = savedProtas?.[selectedGrade];
      if (Array.isArray(gradeProta) && gradeProta.length > 0) {
        const list: TpCandidate[] = [];
        gradeProta.forEach((item: any, eIdx: number) => {
          const elemen = item.elemen || 'PAI BP';
          const cp = item.cp || '';
          const atps: string[] =
            Array.isArray(item.atp) && item.atp.length > 0
              ? item.atp
              : Array.isArray(item.tp)
              ? item.tp
              : [];
          atps.forEach((tpText: string, tIdx: number) => {
            if (!tpText || !tpText.trim()) return;
            list.push({
              id: `prota-${selectedGrade}-${eIdx}-${tIdx}`,
              elemen,
              cp,
              tp: tpText.trim(),
              sourceLabel: `ATP ${tIdx + 1}`,
            });
          });
        });
        if (list.length > 0) return list;
      }
    }

    const rawCp =
      (cpData as Record<number, { elemen: string; cp: string; tp: string[] }[]>)[selectedGrade] ||
      [];
    const list: TpCandidate[] = [];
    rawCp.forEach((item, eIdx) => {
      (item.tp || []).forEach((tpText, tIdx) => {
        list.push({
          id: `cp-${selectedGrade}-${eIdx}-${tIdx}`,
          elemen: item.elemen,
          cp: item.cp,
          tp: tpText,
          sourceLabel: `TP ${tIdx + 1}`,
        });
      });
    });
    return list;
  }, [selectedGrade, fokusPilihan, savedProtas]);

  const elemenOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: string[] = [];
    for (const c of gradeCandidates) {
      if (!seen.has(c.elemen)) {
        seen.add(c.elemen);
        opts.push(c.elemen);
      }
    }
    return opts;
  }, [gradeCandidates]);

  useEffect(() => {
    if (elemenOptions.length > 0 && !elemenOptions.includes(selectedElemen)) {
      setSelectedElemen(elemenOptions[0]);
    }
  }, [elemenOptions, selectedElemen]);

  const filteredCandidates = useMemo(() => {
    return gradeCandidates.filter((c) => !selectedElemen || c.elemen === selectedElemen);
  }, [gradeCandidates, selectedElemen]);

  useEffect(() => {
    if (
      filteredCandidates.length > 0 &&
      !filteredCandidates.some((c) => c.id === selectedTpId)
    ) {
      setSelectedTpId(filteredCandidates[0].id);
    }
  }, [filteredCandidates, selectedTpId]);

  const selectedCandidate = useMemo(() => {
    return filteredCandidates.find((c) => c.id === selectedTpId) || filteredCandidates[0] || null;
  }, [filteredCandidates, selectedTpId]);

  const recommendation = useMemo(() => {
    return recommendMateriTemplates(
      fokusPilihan,
      selectedCandidate?.elemen || selectedElemen,
      selectedCandidate?.tp || ''
    );
  }, [fokusPilihan, selectedCandidate, selectedElemen]);

  // Reset recommended alternative selection when focus or candidate changes
  useEffect(() => {
    setChosenRecStyle(recommendation.primary);
  }, [recommendation.primary, selectedCandidate?.id, fokusPilihan]);

  const recommendedOptions = useMemo(() => {
    return [recommendation.primary, ...recommendation.alternatives];
  }, [recommendation]);

  const activeGayaTemplate: MateriTemplateStyle =
    templateMode === 'rekomendasi'
      ? chosenRecStyle && recommendedOptions.includes(chosenRecStyle)
        ? chosenRecStyle
        : recommendation.primary
      : manualStyle;

  const activeTemplateMeta = useMemo(
    () => getTemplateOption(activeGayaTemplate),
    [activeGayaTemplate]
  );

  const activeItem: MateriAjarInfografis | null = useMemo(() => {
    if (activeId) {
      const found = savedMateriAjars.find((m) => m.id === activeId);
      if (found) return found;
    }
    return savedMateriAjars[0] || null;
  }, [activeId, savedMateriAjars]);

  // Render multi-page A4 Portrait preview whenever activeItem or profile changes
  useEffect(() => {
    let cancelled = false;
    if (!activeItem) {
      setPreviewPages([]);
      return;
    }
    setRenderingPdf(true);
    renderMateriPdfPagesPreview(activeItem, profile)
      .then((pages) => {
        if (!cancelled) {
          setPreviewPages(pages);
        }
      })
      .catch((err) => {
        console.error('Gagal merender pratinjau PDF materi ajar:', err);
      })
      .finally(() => {
        if (!cancelled) {
          setRenderingPdf(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeItem, profile]);

  const handleGenerate = async () => {
    setErrorMsg(null);
    if (!selectedCandidate) {
      setErrorMsg(
        `Pilih minimal 1 ${fokusPilihan === 'atp' ? 'Alur Tujuan Pembelajaran (ATP)' : 'Tujuan Pembelajaran (TP)'} terlebih dahulu.`
      );
      return;
    }

    setGenerating(true);
    try {
      const requestBody = {
        grade: selectedGrade,
        fase,
        elemen: selectedCandidate.elemen,
        cp: selectedCandidate.cp,
        tp: selectedCandidate.tp,
        fokusPilihan,
        gayaTemplate: activeGayaTemplate,
        temaWarna,
        profile,
        userApiKey: geminiApiKey || undefined,
      };

      let payload: any = null;
      let serverErrorMessage: string | null = null;
      let serverErrorObj: Error | null = null;

      try {
        const response = await fetch('/api/materi-ajar/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        const rawText = await response.text();
        let parsedJson: any = null;
        if (rawText && rawText.trim().startsWith('{')) {
          try {
            parsedJson = JSON.parse(rawText);
          } catch {
            parsedJson = null;
          }
        }

        if (response.ok && parsedJson && parsedJson.judulMateri) {
          payload = parsedJson;
        } else if (parsedJson?.error) {
          serverErrorObj = new Error(parsedJson.error);
        } else if (!response.ok) {
          serverErrorMessage = `Server merespons dengan status ${response.status}.`;
        }
      } catch (fetchErr: any) {
        serverErrorMessage = fetchErr?.message || null;
      }

      if (serverErrorObj) {
        throw serverErrorObj;
      }

      if (!payload) {
        const isAiStudioProxyHost =
          typeof window !== 'undefined' &&
          (window.location.hostname.endsWith('.run.app') ||
            window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1');

        if (
          !isAiStudioProxyHost &&
          (geminiApiKey ||
            (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GEMINI_API_KEY))
        ) {
          payload = await generateMateriAjarClient(requestBody);
        } else {
          throw new Error(
            serverErrorMessage ||
              'Gagal terhubung ke layanan pembuat Materi Ajar. Silakan coba beberapa saat lagi.'
          );
        }
      }

      const newItem: MateriAjarInfografis = {
        id: `materi-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt: Date.now(),
        grade: Number(payload.grade || selectedGrade),
        fase: (payload.fase || fase) as 'A' | 'B' | 'C',
        elemen: payload.elemen || selectedCandidate.elemen,
        cp: payload.cp || selectedCandidate.cp,
        tp: payload.tp || selectedCandidate.tp,
        fokusPilihan: (payload.fokusPilihan || fokusPilihan) as MateriFokusMode,
        gayaTemplate: (payload.gayaTemplate || activeGayaTemplate) as MateriTemplateStyle,
        temaWarna,
        judulMateri: payload.judulMateri || selectedCandidate.tp,
        pengantarMateri: payload.pengantarMateri,
        intiMateri: payload.intiMateri,
        contohSehariHari: payload.contohSehariHari,
        aktivitasSiswa: payload.aktivitasSiswa,
        rangkuman: payload.rangkuman || [],
        latihanPemahaman: payload.latihanPemahaman || [],
        styleSpecific: payload.styleSpecific,
      };

      addSavedMateriAjar(newItem);
      setActiveId(newItem.id);
    } catch (err: any) {
      console.error('Materi Ajar generate error:', err);
      setErrorMsg(err?.message || 'Terjadi kesalahan saat menghasilkan materi ajar PDF.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!activeItem) return;
    setDownloadingPdf(true);
    try {
      await downloadMateriPdf(activeItem, profile);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal mengunduh dokumen PDF materi ajar.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const activeItemTemplate = getTemplateOption(activeItem?.gayaTemplate);

  return (
    <Layout>
      <div className="p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-200/80 pb-5">
          <div>
            <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
              Hasilkan Materi Ajar
            </h1>
            <p className="text-sm text-slate-600 mt-1 max-w-2xl">
              Kembangkan satu TP atau ATP menjadi dokumen materi ajar PAIBP SD bergaya visual pilihan dengan tata letak PDF A4 multi-halaman siap cetak.
            </p>
            <div className="mt-2.5 text-[13px] font-medium text-slate-600 tabular-nums">
              <span>{profile?.namaSekolah || 'Sekolah belum diatur'}</span>
              <span className="mx-2 text-slate-300" aria-hidden="true">·</span>
              <span>Guru: {profile?.namaGuru || 'Belum diisi'}</span>
              <span className="mx-2 text-slate-300" aria-hidden="true">·</span>
              <span>Tahun Pelajaran {profile?.tahunPelajaran || '2026/2027'}</span>
            </div>
          </div>

          {activeItem && (
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={downloadingPdf || renderingPdf}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-bold rounded-xl shadow-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {downloadingPdf ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>
                  Unduh PDF (A4{previewPages.length > 0 ? ` · ${previewPages.length} Hal` : ''})
                </span>
              </button>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-2xl flex items-start gap-3 text-sm">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">{errorMsg}</div>
          </div>
        )}

        {/* Main 2-column workspace */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Left Panel: Configuration & Archive */}
          <div className="xl:col-span-5 space-y-6">
            <div className="bg-white/95 border border-slate-200 rounded-2xl p-5 shadow-sm space-y-5">
              {/* 1. Grade & Fase */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold tracking-wide text-slate-600">
                    1. Pilih Kelas &amp; Fase
                  </label>
                  <span className="text-xs font-bold text-emerald-700 tabular-nums">
                    Kelas {selectedGrade} · Fase {fase}
                  </span>
                </div>
                <div className="grid grid-cols-6 gap-2">
                  {[1, 2, 3, 4, 5, 6].map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setSelectedGrade(g)}
                      className={`py-2.5 rounded-xl text-sm font-bold transition-colors whitespace-nowrap cursor-pointer tabular-nums ${
                        selectedGrade === g
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      Kls {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Fokus Materi (TP vs ATP) */}
              <div>
                <label className="block text-xs font-bold tracking-wide text-slate-600 mb-2">
                  2. Fokus Materi Ajar (TP atau ATP)
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setFokusPilihan('tp')}
                    className={`px-3 py-2.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                      fokusPilihan === 'tp'
                        ? 'bg-white text-emerald-800 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Fokus TP (Kurikulum)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFokusPilihan('atp')}
                    disabled={!hasSavedProtaForGrade}
                    className={`px-3 py-2.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                      fokusPilihan === 'atp'
                        ? 'bg-white text-emerald-800 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Fokus ATP {hasSavedProtaForGrade ? (isProtaLocked ? '(Terkunci)' : '(Prota)') : '(Kosong)'}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                  {fokusPilihan === 'atp'
                    ? 'Menyusun materi spesifik per pertemuan berdasarkan Alur Tujuan Pembelajaran (ATP) dari Prota tersimpan.'
                    : 'Menyusun materi utuh satu Tujuan Pembelajaran (TP) selaras Capaian Pembelajaran (CP) PAIBP.'}
                </p>
              </div>

              {/* 3. Elemen PAIBP */}
              <div>
                <label className="block text-xs font-bold tracking-wide text-slate-600 mb-2">
                  3. Pilih Elemen PAIBP
                </label>
                <div className="flex flex-wrap gap-2">
                  {elemenOptions.map((el) => (
                    <button
                      key={el}
                      type="button"
                      onClick={() => setSelectedElemen(el)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap cursor-pointer ${
                        selectedElemen === el
                          ? 'bg-slate-900 border-slate-900 text-white'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {el}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Select 1 TP / ATP */}
              <div>
                <label className="block text-xs font-bold tracking-wide text-slate-600 mb-2">
                  4. Pilih 1 {fokusPilihan === 'atp' ? 'ATP (Prota)' : 'Tujuan Pembelajaran (TP)'}
                </label>
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {filteredCandidates.map((cand) => {
                    const isSelected = cand.id === selectedCandidate?.id;
                    return (
                      <button
                        key={cand.id}
                        type="button"
                        onClick={() => setSelectedTpId(cand.id)}
                        className={`w-full text-left p-3 rounded-xl border transition-colors flex items-start gap-2.5 cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-50/90 border-emerald-500 text-slate-900'
                            : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        <span
                          className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold tabular-nums ${
                            isSelected
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {isSelected ? <Check className="w-3.5 h-3.5" /> : cand.sourceLabel.replace(/\D/g, '') || '•'}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-bold text-emerald-700 tracking-wide">
                            {cand.sourceLabel}
                          </div>
                          <div className="text-xs font-medium leading-relaxed mt-0.5">
                            {cand.tp}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* CP context preview */}
              {selectedCandidate && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 leading-relaxed">
                  <div className="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Capaian Pembelajaran (CP) Terkait</span>
                  </div>
                  <p>{selectedCandidate.cp}</p>
                </div>
              )}

              {/* 5. Gaya Template Materi Ajar (Rekomendasi vs Manual 10 Gaya) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-bold tracking-wide text-slate-600">
                    5. Gaya Template Materi Ajar
                  </label>
                  <span className="text-xs font-semibold text-emerald-700 truncate max-w-[200px]">
                    {activeTemplateMeta.number}. {activeTemplateMeta.name}
                  </span>
                </div>

                {/* Mode switcher: Rekomendasi vs Pilihan Manual */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setTemplateMode('rekomendasi')}
                    className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                      templateMode === 'rekomendasi'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Rekomendasi ({fokusPilihan.toUpperCase()})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTemplateMode('manual')}
                    className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                      templateMode === 'manual'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Pilihan Manual (10 Gaya)
                  </button>
                </div>

                {templateMode === 'rekomendasi' ? (
                  <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 space-y-3">
                    <p className="text-xs text-slate-700 leading-relaxed">
                      {recommendation.reason}
                    </p>
                    <div className="space-y-2">
                      {recommendedOptions.map((styleId, idx) => {
                        const opt = getTemplateOption(styleId);
                        const active = activeGayaTemplate === styleId;
                        return (
                          <button
                            key={styleId}
                            type="button"
                            onClick={() => setChosenRecStyle(styleId)}
                            className={`w-full text-left p-2.5 rounded-xl border transition-colors flex items-start justify-between gap-2 cursor-pointer ${
                              active
                                ? 'bg-white border-emerald-600 text-slate-900 shadow-sm'
                                : 'bg-white/70 border-emerald-200/80 text-slate-700 hover:bg-white'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-900">
                                <span className="tabular-nums">{opt.number}.</span> {opt.name}{' '}
                                <span className="font-medium text-slate-500">· {opt.subtitle}</span>
                              </div>
                              <div className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                                {opt.description}
                              </div>
                            </div>
                            <span className="text-[11px] font-bold text-emerald-700 shrink-0 whitespace-nowrap">
                              {idx === 0 ? 'Utama' : `Alternatif ${idx}`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                      {MATERI_TEMPLATE_OPTIONS.map((opt) => {
                        const active = manualStyle === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setManualStyle(opt.id)}
                            className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                              active
                                ? 'bg-emerald-50 border-emerald-600 text-slate-900 shadow-sm'
                                : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                            }`}
                          >
                            <div className="text-xs font-bold text-slate-900 truncate tabular-nums">
                              {opt.number}. {opt.name}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate mt-0.5">
                              {opt.subtitle}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 leading-relaxed">
                      <span className="font-bold text-slate-800">{activeTemplateMeta.name}:</span>{' '}
                      {activeTemplateMeta.description}
                    </div>
                  </div>
                )}
              </div>

              {/* 6. Theme Palette */}
              <div>
                <label className="block text-xs font-bold tracking-wide text-slate-600 mb-2">
                  6. Tema Warna Dokumen PDF
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(Object.keys(INFOGRAFIS_THEMES) as MateriAjarInfografis['temaWarna'][]).map((key) => {
                    const t = INFOGRAFIS_THEMES[key];
                    const active = temaWarna === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setTemaWarna(key)}
                        className={`p-2 rounded-xl border text-left transition-colors cursor-pointer ${
                          active
                            ? 'border-slate-900 bg-slate-50 shadow-sm'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-4 h-4 rounded-full shrink-0"
                            style={{ backgroundColor: t.primary }}
                          />
                          <span className="text-[11px] font-bold text-slate-800 truncate">
                            {t.name.split(' ')[0]}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Generate Button */}
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating || !selectedCandidate}
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-sm rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menyusun Materi &amp; Dokumen PDF...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Hasilkan Materi Ajar (PDF)</span>
                  </>
                )}
              </button>
            </div>

            {/* Archive in localStorage */}
            <div className="bg-white/95 border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  <span>Arsip Materi Ajar Tersimpan</span>
                </h2>
                <span className="text-xs font-bold text-slate-500 tabular-nums">
                  {savedMateriAjars.length} dokumen
                </span>
              </div>

              {savedMateriAjars.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">
                  Belum ada dokumen materi ajar tersimpan. Pilih TP/ATP dan gaya template lalu klik Hasilkan.
                </p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {savedMateriAjars.map((item) => {
                    const isActive = item.id === activeItem?.id;
                    const itemTpl = getTemplateOption(item.gayaTemplate);
                    const itemFokus = item.fokusPilihan === 'atp' ? 'Fokus ATP' : 'Fokus TP';
                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-xl border transition-colors flex items-start justify-between gap-2 ${
                          isActive
                            ? 'bg-emerald-50 border-emerald-500'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setActiveId(item.id)}
                          className="text-left flex-1 min-w-0 cursor-pointer"
                        >
                          <div className="text-[11px] font-semibold text-emerald-700 tabular-nums truncate">
                            {itemTpl.name} · {itemFokus} · Kelas {item.grade} · {item.elemen}
                          </div>
                          <div className="text-xs font-bold text-slate-900 truncate mt-0.5">
                            {item.judulMateri}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate mt-0.5">
                            {item.tp}
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            deleteSavedMateriAjar(item.id);
                            if (activeId === item.id) setActiveId(null);
                          }}
                          title="Hapus dari arsip"
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors shrink-0 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Live Multi-Page A4 PDF Preview */}
          <div className="xl:col-span-7">
            <div className="bg-white/95 border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Pratinjau Dokumen PDF (A4 Portrait · Multi-Halaman)
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                    {activeItem
                      ? `${activeItem.judulMateri} · ${activeItemTemplate.name} · Kelas ${activeItem.grade} (Fase ${activeItem.fase})${previewPages.length > 0 ? ` · ${previewPages.length} Halaman` : ''}`
                      : 'Pilih 1 TP atau ATP dan gaya template untuk membuat dokumen PDF siap cetak.'}
                  </p>
                </div>

                {previewPages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsZoomed((z) => !z)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {isZoomed ? (
                      <>
                        <Minimize2 className="w-3.5 h-3.5" />
                        <span>Sesuaikan Layar</span>
                      </>
                    ) : (
                      <>
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>Perbesar Detail</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              <div className="mt-4 bg-slate-100 border border-slate-200 rounded-2xl p-4 overflow-auto max-h-[82vh]">
                {generating || renderingPdf ? (
                  <div className="py-28 flex flex-col items-center justify-center text-center gap-3">
                    <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
                    <div className="text-sm font-bold text-slate-800">
                      {generating
                        ? `Sedang menyusun materi ajar bergaya ${activeTemplateMeta.name}...`
                        : 'Menata halaman PDF A4 Portrait multi-halaman...'}
                    </div>
                    <p className="text-xs text-slate-500 max-w-md">
                      Materi panjang otomatis dibagi rapi ke beberapa halaman A4 agar seluruh teks, ilustrasi, aktivitas, rangkuman, dan latihan terbaca utuh tanpa terpotong.
                    </p>
                  </div>
                ) : previewPages.length > 0 ? (
                  <div className="flex flex-col items-center gap-6">
                    {previewPages.map((pageUrl, idx) => (
                      <div key={idx} className="flex flex-col items-center gap-2">
                        <div className="text-xs font-semibold text-slate-500 tabular-nums">
                          Halaman {idx + 1} dari {previewPages.length} · A4 Portrait
                        </div>
                        <img
                          src={pageUrl}
                          alt={`${activeItem?.judulMateri || 'Materi Ajar PAIBP'} - Halaman ${idx + 1}`}
                          className={`rounded-xl shadow-lg bg-white transition-all border border-slate-200 ${
                            isZoomed ? 'w-[980px] max-w-none h-auto' : 'w-full max-w-[660px] h-auto'
                          }`}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-24 px-6 mx-auto text-center max-w-md space-y-3">
                    <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <FileText className="w-7 h-7" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900">
                      Siap Membuat Materi Ajar PDF
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Pilih kelas, fokus TP atau ATP, satu butir pembelajaran, serta gaya template (Rekomendasi otomatis atau Pilihan Manual 10 gaya), lalu tekan{' '}
                      <strong>Hasilkan Materi Ajar (PDF)</strong> untuk mengunduh PDF A4 multi-halaman siap cetak.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
