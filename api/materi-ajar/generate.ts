import { GoogleGenAI, Type } from '@google/genai';

function sanitizeSvg(rawSvg?: string): string {
  if (!rawSvg || typeof rawSvg !== 'string') return '';
  let svg = rawSvg.trim();
  const startIdx = svg.indexOf('<svg');
  const endIdx = svg.lastIndexOf('</svg>');
  if (startIdx === -1 || endIdx === -1) return '';
  svg = svg.slice(startIdx, endIdx + 6);
  svg = svg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son\w+\s*=\s*(['"])[\s\S]*?\1/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/<image[^>]*>/gi, '');
  if (!svg.includes('xmlns=')) {
    svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  return svg;
}

const STYLE_INSTRUCTION_MAP: Record<string, string> = {
  educational_infographic:
    'GAYA TEMPLATE: 1. Educational Infographic (Materi lengkap). Sajikan penjelasan komprehensif, poin kunci terstruktur, contoh konkret, ilustrasi SVG pendukung yang jelas, contoh sehari-hari, aktivitas siswa, rangkuman, dan latihan.',
  cheat_sheet:
    'GAYA TEMPLATE: 2. Cheat Sheet (Ringkasan materi). WAJIB isi `styleSpecific.cheatSheetFacts` berisi 5–6 kartu fakta ringkas (label + nilai padat siap ulang sebelum ujian) di samping komponen inti materi.',
  sticky_notes:
    'GAYA TEMPLATE: 3. Sticky Notes (Catatan penting). WAJIB isi `styleSpecific.stickyNotes` berisi 4–6 catatan tempel berwarna (`warna`: "yellow" | "mint" | "sky" | "rose", `judul`, `isi` singkat padat mudah diingat).',
  mind_map:
    'GAYA TEMPLATE: 4. Mind Map (Pemetaan konsep). WAJIB isi `styleSpecific.mindMapCabang` berisi 4–5 cabang konsep utama dari judul materi, masing-masing dengan 2–3 `subPoin` ringkas.',
  comic_strip:
    'GAYA TEMPLATE: 5. Comic Strip (Cerita pembelajaran). WAJIB isi `styleSpecific.comicPanels` berisi 4 panel cerita berurutan (`panelNo` 1–4, `latar`, `tokoh` anak/guru Indonesia seperti Raka, Siti, Bu Guru, `dialog` singkat alami, `narasi` alur, dan `svgScene` ilustrasi panel sederhana `<svg viewBox="0 0 300 160" xmlns="http://www.w3.org/2000/svg">...</svg>`). Patuhi larangan mutlak tidak menggambarkan fisik/wajah Nabi & Rasul!',
  flashcard:
    'GAYA TEMPLATE: 6. Flashcard (Hafalan dan latihan). WAJIB isi `styleSpecific.flashcards` berisi 4–6 kartu belajar (`nomor`, `depan` berupa pertanyaan/lafaz/istilah, `arab` berharakat lengkap jika ada lafaz Arab atau "", `belakang` berupa jawaban/arti/penjelasan singkat, `tips` cara mengingat).',
  step_by_step:
    'GAYA TEMPLATE: 7. Step-by-Step (Tahapan proses). WAJIB isi `styleSpecific.stepByStep` berisi 4–6 tahapan berurutan (`langkahNo` 1..N, `judulLangkah`, `deskripsi` operasional jelas untuk anak SD, `catatan` adab/hal penting).',
  timeline:
    'GAYA TEMPLATE: 8. Timeline (Kronologi sejarah). WAJIB isi `styleSpecific.timelineEvents` berisi 4–6 peristiwa berurutan (`urutan` misal "Tahap 1" / "Periode Awal", `judulPeristiwa`, `keterangan`, `hikmah` keteladanan).',
  comparison_chart:
    'GAYA TEMPLATE: 9. Comparison Chart (Perbandingan konsep). WAJIB isi `styleSpecific.comparisonData` (`judulPerbandingan`, `kolomA`, `kolomB`, dan 4–5 `baris` dengan `aspek`, `nilaiA`, `nilaiB` yang akurat dan kontras jelas).',
  isometric_3d:
    'GAYA TEMPLATE: 10. Isometric 3D (Visualisasi objek). WAJIB isi `styleSpecific.isometricObjects` berisi 2–3 objek nyata/simbolik terkait materi (`namaObjek`, `fungsi`, `makna`, dan `svgIsometric` `<svg viewBox="0 0 280 180" xmlns="http://www.w3.org/2000/svg">...</svg>` bergaya balok/bidang perspektif isometrik 3D edukatif cerah, tanpa wajah Nabi/Rasul).',
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const {
      grade,
      fase,
      elemen,
      cp,
      tp,
      fokusPilihan,
      gayaTemplate,
      temaWarna,
      profile,
      userApiKey,
    } = body;

    if (!tp || !grade) {
      return res.status(400).json({ error: 'Tujuan Pembelajaran (TP/ATP) dan Kelas wajib dipilih.' });
    }

    const effectiveKey = process.env.GEMINI_API_KEY || userApiKey || '';
    if (!effectiveKey) {
      return res.status(400).json({
        error: 'API Key Gemini belum dikonfigurasi di Vercel maupun Pengaturan API.',
      });
    }

    const client = new GoogleGenAI({ apiKey: effectiveKey });
    const resolvedFase = fase || (grade <= 2 ? 'A' : grade <= 4 ? 'B' : 'C');
    const resolvedFokus = fokusPilihan === 'atp' ? 'atp' : 'tp';
    const resolvedGaya = gayaTemplate || 'educational_infographic';
    const usiaInfo =
      grade <= 2
        ? 'usia 6–8 tahun (Kelas 1–2 SD, kalimat pendek, konkret, hangat, sangat mudah dipahami anak awal sekolah dasar)'
        : grade <= 4
        ? 'usia 8–10 tahun (Kelas 3–4 SD, kalimat jelas, komunikatif, dekat dengan dunia anak sekolah dasar)'
        : 'usia 10–12 tahun (Kelas 5–6 SD, runtut, bernalar kritis sederhana, tetap ramah anak dan konkret)';

    const prompt = `Anda bertindak sebagai Ahli Pengembang Kurikulum Jenjang Dikdasmen, Ahli Pedagogik, Penulis Materi Ajar PAIBP SD, sekaligus Desainer Grafis Pendidikan Profesional.

TUGAS UTAMA:
Kembangkan SATU ${resolvedFokus === 'atp' ? 'Alur Tujuan Pembelajaran (ATP)' : 'Tujuan Pembelajaran (TP)'} berikut menjadi materi ajar PDF multi-halaman ukuran A4 Portrait yang informatif, modern, valid keilmuannya, fokus hanya pada ruang lingkup ${resolvedFokus.toUpperCase()} ini, dan mudah dipahami peserta didik Kelas ${grade} SD (${usiaInfo}).

IDENTITAS PEMBELAJARAN:
- Mata Pelajaran: Pendidikan Agama Islam dan Budi Pekerti (PAIBP)
- Kelas / Fase: Kelas ${grade} SD / Fase ${resolvedFase}
- Elemen: ${elemen}
- Capaian Pembelajaran (CP) Terkait: ${cp}
- Fokus Pengembangan (${resolvedFokus.toUpperCase()}): ${tp}
- Sekolah: ${profile?.namaSekolah || 'SD Negeri'}

${STYLE_INSTRUCTION_MAP[resolvedGaya] || STYLE_INSTRUCTION_MAP.educational_infographic}

ATURAN KONTEN & PEDAGOGIK WAJIB:
1. FOKUS TUNGGAL & VALID: Seluruh isi HANYA membahas ${resolvedFokus.toUpperCase()} terpilih dan selaras dengan CP-nya. Jangan melebar ke materi lain. Pastikan konsep keilmuan Islam (Al-Qur'an, Hadis, Akidah, Akhlak, Fikih, SPI) sahih sesuai buku teks resmi PAIBP Kemendikdasmen.
2. BAHASA SESUAI USIA: Gunakan Bahasa Indonesia baku yang sederhana, ramah anak, ceria, dan tepat untuk siswa Kelas ${grade} SD.
3. STRUKTUR LENGKAP MATERI:
   - judulMateri: Judul menarik & jelas (maksimal 9 kata).
   - pengantarMateri: pengantarSingkat + pertanyaanPemantik.
   - intiMateri: pengertianKonsep, penjelasanUtama (rinci namun ramah anak), poinPenting (3–5 poin), contohKonkret (3 contoh), teksArab (berharakat lengkap jika relevan dengan ayat/doa/hijaiah/hadis/asmaulhusna, selain itu ""), artinyaArab, ilustrasiSvg (\`<svg viewBox="0 0 360 190" xmlns="http://www.w3.org/2000/svg">...</svg>\` latar cerah #FFFFFF/#F8FAFC), captionIlustrasi.
   - contohSehariHari: situasi, penerapan (3 contoh dekat kehidupan anak Indonesia), ilustrasiSvg (\`<svg viewBox="0 0 360 170" xmlns="http://www.w3.org/2000/svg">...</svg>\`), captionIlustrasi.
   - aktivitasSiswa: judulAktivitas + 3–4 langkah praktis.
   - rangkuman: 3–5 poin kunci yang perlu diingat.
   - latihanPemahaman: tepat 3 soal sederhana (nomor 1, 2, 3) sesuai ${resolvedFokus.toUpperCase()}.
   - styleSpecific: WAJIB isi properti khusus yang sesuai dengan \`${resolvedGaya}\` secara lengkap dan edukatif!
4. LARANGAN MUTLAK VISUALISASI NABI & RASUL:
   Jika materi membahas Nabi atau Rasul, **DILARANG KERAS** menggambar figur manusia, siluet tubuh, atau wajah Nabi dan Rasul dalam SVG apa pun (termasuk \`comicPanels[].svgScene\` dan \`isometricObjects[].svgIsometric\`), **TERMASUK DILARANG KERAS** menggambar sosok manusia dengan wajah ditutupi cahaya/sinar/awan! Gunakan ilustrasi benda/tempat/simbol non-manusia (Ka'bah, Masjid Nabawi, Gua Hira, perahu, kurma, unta, kitab suci) atau tokoh siswa/guru masa kini.`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        judulMateri: { type: Type.STRING },
        pengantarMateri: {
          type: Type.OBJECT,
          properties: {
            pengantarSingkat: { type: Type.STRING },
            pertanyaanPemantik: { type: Type.STRING },
          },
          required: ['pengantarSingkat', 'pertanyaanPemantik'],
        },
        intiMateri: {
          type: Type.OBJECT,
          properties: {
            pengertianKonsep: { type: Type.STRING },
            penjelasanUtama: { type: Type.STRING },
            poinPenting: { type: Type.ARRAY, items: { type: Type.STRING } },
            contohKonkret: { type: Type.ARRAY, items: { type: Type.STRING } },
            teksArab: { type: Type.STRING },
            artinyaArab: { type: Type.STRING },
            ilustrasiSvg: { type: Type.STRING },
            captionIlustrasi: { type: Type.STRING },
          },
          required: ['pengertianKonsep', 'penjelasanUtama', 'poinPenting', 'contohKonkret', 'teksArab', 'artinyaArab', 'ilustrasiSvg', 'captionIlustrasi'],
        },
        contohSehariHari: {
          type: Type.OBJECT,
          properties: {
            situasi: { type: Type.STRING },
            penerapan: { type: Type.ARRAY, items: { type: Type.STRING } },
            ilustrasiSvg: { type: Type.STRING },
            captionIlustrasi: { type: Type.STRING },
          },
          required: ['situasi', 'penerapan', 'ilustrasiSvg', 'captionIlustrasi'],
        },
        aktivitasSiswa: {
          type: Type.OBJECT,
          properties: {
            judulAktivitas: { type: Type.STRING },
            langkah: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['judulAktivitas', 'langkah'],
        },
        rangkuman: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        latihanPemahaman: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              nomor: { type: Type.INTEGER },
              pertanyaan: { type: Type.STRING },
            },
            required: ['nomor', 'pertanyaan'],
          },
        },
        styleSpecific: {
          type: Type.OBJECT,
          properties: {
            cheatSheetFacts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  nilai: { type: Type.STRING },
                },
                required: ['label', 'nilai'],
              },
            },
            stickyNotes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  warna: { type: Type.STRING },
                  judul: { type: Type.STRING },
                  isi: { type: Type.STRING },
                },
                required: ['warna', 'judul', 'isi'],
              },
            },
            mindMapCabang: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  cabang: { type: Type.STRING },
                  subPoin: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ['cabang', 'subPoin'],
              },
            },
            comicPanels: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  panelNo: { type: Type.INTEGER },
                  latar: { type: Type.STRING },
                  tokoh: { type: Type.STRING },
                  dialog: { type: Type.STRING },
                  narasi: { type: Type.STRING },
                  svgScene: { type: Type.STRING },
                },
                required: ['panelNo', 'latar', 'tokoh', 'dialog', 'narasi'],
              },
            },
            flashcards: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  nomor: { type: Type.INTEGER },
                  depan: { type: Type.STRING },
                  arab: { type: Type.STRING },
                  belakang: { type: Type.STRING },
                  tips: { type: Type.STRING },
                },
                required: ['nomor', 'depan', 'belakang', 'tips'],
              },
            },
            stepByStep: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  langkahNo: { type: Type.INTEGER },
                  judulLangkah: { type: Type.STRING },
                  deskripsi: { type: Type.STRING },
                  catatan: { type: Type.STRING },
                },
                required: ['langkahNo', 'judulLangkah', 'deskripsi'],
              },
            },
            timelineEvents: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  urutan: { type: Type.STRING },
                  judulPeristiwa: { type: Type.STRING },
                  keterangan: { type: Type.STRING },
                  hikmah: { type: Type.STRING },
                },
                required: ['urutan', 'judulPeristiwa', 'keterangan', 'hikmah'],
              },
            },
            comparisonData: {
              type: Type.OBJECT,
              properties: {
                judulPerbandingan: { type: Type.STRING },
                kolomA: { type: Type.STRING },
                kolomB: { type: Type.STRING },
                baris: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      aspek: { type: Type.STRING },
                      nilaiA: { type: Type.STRING },
                      nilaiB: { type: Type.STRING },
                    },
                    required: ['aspek', 'nilaiA', 'nilaiB'],
                  },
                },
              },
              required: ['judulPerbandingan', 'kolomA', 'kolomB', 'baris'],
            },
            isometricObjects: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  namaObjek: { type: Type.STRING },
                  fungsi: { type: Type.STRING },
                  makna: { type: Type.STRING },
                  svgIsometric: { type: Type.STRING },
                },
                required: ['namaObjek', 'fungsi', 'makna'],
              },
            },
          },
        },
      },
      required: ['judulMateri', 'pengantarMateri', 'intiMateri', 'contohSehariHari', 'aktivitasSiswa', 'rangkuman', 'latihanPemahaman'],
    };

    const models = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-4-hydrogen'];
    let parsed: any = null;
    let retries = models.length + 1;
    let delay = 1500;
    let modelIdx = 0;

    while (retries > 0) {
      try {
        const response = await client.models.generateContent({
          model: models[modelIdx],
          contents: prompt,
          config: {
            systemInstruction: 'Anda adalah pakar kurikulum PAIBP SD Indonesia, ahli pedagogik anak usia SD, dan desainer grafis materi ajar profesional. Hasilkan materi akurat, fokus pada 1 TP/ATP, berbahasa ramah anak SD, beraksara Arab lengkap berharakat jika relevan, serta tidak pernah menggambarkan figur atau wajah Nabi dan Rasul termasuk wajah bercahaya.',
            responseMimeType: 'application/json',
            responseSchema,
          },
        });
        let rawText = (response.text ?? '{}').trim();
        if (rawText.startsWith('```json')) rawText = rawText.replace(/^```json\s*/i, '');
        if (rawText.startsWith('```')) rawText = rawText.replace(/^```\s*/i, '');
        if (rawText.endsWith('```')) rawText = rawText.slice(0, -3).trim();
        parsed = JSON.parse(rawText);
        break;
      } catch (err: any) {
        retries--;
        if (retries === 0) throw err;
        modelIdx = (modelIdx + 1) % models.length;
        const isNotFound = err?.status === 404 || err?.message?.includes('404') || err?.message?.includes('NOT_FOUND');
        await new Promise(resolve => setTimeout(resolve, isNotFound ? 250 : delay));
        if (!isNotFound) delay *= 1.5;
      }
    }

    const rawStyle = parsed.styleSpecific || {};
    const styleSpecific = {
      cheatSheetFacts: Array.isArray(rawStyle.cheatSheetFacts) ? rawStyle.cheatSheetFacts.slice(0, 6) : undefined,
      stickyNotes: Array.isArray(rawStyle.stickyNotes)
        ? rawStyle.stickyNotes.slice(0, 6).map((n: any) => ({
            warna: ['yellow', 'mint', 'sky', 'rose'].includes(n?.warna) ? n.warna : 'yellow',
            judul: n?.judul || '',
            isi: n?.isi || '',
          }))
        : undefined,
      mindMapCabang: Array.isArray(rawStyle.mindMapCabang) ? rawStyle.mindMapCabang.slice(0, 5) : undefined,
      comicPanels: Array.isArray(rawStyle.comicPanels)
        ? rawStyle.comicPanels.slice(0, 6).map((p: any, i: number) => ({
            panelNo: Number(p?.panelNo) || i + 1,
            latar: p?.latar || '',
            tokoh: p?.tokoh || '',
            dialog: p?.dialog || '',
            narasi: p?.narasi || '',
            svgScene: sanitizeSvg(p?.svgScene),
          }))
        : undefined,
      flashcards: Array.isArray(rawStyle.flashcards)
        ? rawStyle.flashcards.slice(0, 6).map((f: any, i: number) => ({
            nomor: Number(f?.nomor) || i + 1,
            depan: f?.depan || '',
            arab: f?.arab || '',
            belakang: f?.belakang || '',
            tips: f?.tips || '',
          }))
        : undefined,
      stepByStep: Array.isArray(rawStyle.stepByStep)
        ? rawStyle.stepByStep.slice(0, 6).map((st: any, i: number) => ({
            langkahNo: Number(st?.langkahNo) || i + 1,
            judulLangkah: st?.judulLangkah || '',
            deskripsi: st?.deskripsi || '',
            catatan: st?.catatan || '',
          }))
        : undefined,
      timelineEvents: Array.isArray(rawStyle.timelineEvents) ? rawStyle.timelineEvents.slice(0, 6) : undefined,
      comparisonData: rawStyle.comparisonData
        ? {
            judulPerbandingan: rawStyle.comparisonData.judulPerbandingan || 'Perbandingan Konsep',
            kolomA: rawStyle.comparisonData.kolomA || 'Konsep A',
            kolomB: rawStyle.comparisonData.kolomB || 'Konsep B',
            baris: Array.isArray(rawStyle.comparisonData.baris) ? rawStyle.comparisonData.baris.slice(0, 6) : [],
          }
        : undefined,
      isometricObjects: Array.isArray(rawStyle.isometricObjects)
        ? rawStyle.isometricObjects.slice(0, 4).map((obj: any) => ({
            namaObjek: obj?.namaObjek || '',
            fungsi: obj?.fungsi || '',
            makna: obj?.makna || '',
            svgIsometric: sanitizeSvg(obj?.svgIsometric),
          }))
        : undefined,
    };

    return res.status(200).json({
      grade: Number(grade),
      fase: resolvedFase,
      elemen,
      cp,
      tp,
      fokusPilihan: resolvedFokus,
      gayaTemplate: resolvedGaya,
      temaWarna: temaWarna || 'emerald',
      judulMateri: parsed.judulMateri || tp,
      pengantarMateri: {
        pengantarSingkat: parsed.pengantarMateri?.pengantarSingkat || '',
        pertanyaanPemantik: parsed.pengantarMateri?.pertanyaanPemantik || '',
      },
      intiMateri: {
        pengertianKonsep: parsed.intiMateri?.pengertianKonsep || '',
        penjelasanUtama: parsed.intiMateri?.penjelasanUtama || '',
        poinPenting: Array.isArray(parsed.intiMateri?.poinPenting) ? parsed.intiMateri.poinPenting.slice(0, 5) : [],
        contohKonkret: Array.isArray(parsed.intiMateri?.contohKonkret) ? parsed.intiMateri.contohKonkret.slice(0, 4) : [],
        teksArab: parsed.intiMateri?.teksArab || '',
        artinyaArab: parsed.intiMateri?.artinyaArab || '',
        ilustrasiSvg: sanitizeSvg(parsed.intiMateri?.ilustrasiSvg),
        captionIlustrasi: parsed.intiMateri?.captionIlustrasi || '',
      },
      contohSehariHari: {
        situasi: parsed.contohSehariHari?.situasi || '',
        penerapan: Array.isArray(parsed.contohSehariHari?.penerapan) ? parsed.contohSehariHari.penerapan.slice(0, 4) : [],
        ilustrasiSvg: sanitizeSvg(parsed.contohSehariHari?.ilustrasiSvg),
        captionIlustrasi: parsed.contohSehariHari?.captionIlustrasi || '',
      },
      aktivitasSiswa: {
        judulAktivitas: parsed.aktivitasSiswa?.judulAktivitas || 'Ayo Praktikkan!',
        langkah: Array.isArray(parsed.aktivitasSiswa?.langkah) ? parsed.aktivitasSiswa.langkah.slice(0, 4) : [],
      },
      rangkuman: Array.isArray(parsed.rangkuman) ? parsed.rangkuman.slice(0, 5) : [],
      latihanPemahaman: Array.isArray(parsed.latihanPemahaman)
        ? parsed.latihanPemahaman.slice(0, 3).map((q: any, idx: number) => ({
            nomor: idx + 1,
            pertanyaan: q?.pertanyaan || '',
          }))
        : [],
      styleSpecific,
    });
  } catch (error: any) {
    console.error('Vercel /api/materi-ajar/generate error:', error);
    return res.status(500).json({
      error: error?.message || 'Gagal menghasilkan Materi Ajar.',
    });
  }
}
