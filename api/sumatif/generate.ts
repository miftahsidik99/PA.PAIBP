import { GoogleGenAI, Type } from '@google/genai';

function distributeDifficultyCounts(total: number, pctLots: number, pctMots: number, pctHots: number) {
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

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const {
      grade,
      jenisSumatif,
      semesterLabel,
      judulAsesmen,
      protaItems,
      config,
      profile,
      previousQuestionStems,
      userApiKey,
    } = body;

    const effectiveKey = process.env.GEMINI_API_KEY || userApiKey || '';
    if (!effectiveKey) {
      return res.status(400).json({
        error: 'API Key Gemini belum dikonfigurasi di Vercel maupun Pengaturan API.',
      });
    }

    const client = new GoogleGenAI({ apiKey: effectiveKey });

    const jumlahPg = Math.max(0, Number(config?.jumlahPg ?? 15));
    const jumlahIsian = Math.max(0, Number(config?.jumlahIsian ?? 5));
    const jumlahUraian = Math.max(0, Number(config?.jumlahUraian ?? 5));

    const pctLots = Number(config?.komposisiLots ?? 30);
    const pctMots = Number(config?.komposisiMots ?? 40);
    const pctHots = Number(config?.komposisiHots ?? 30);

    const pgDist = distributeDifficultyCounts(jumlahPg, pctLots, pctMots, pctHots);
    const isianDist = distributeDifficultyCounts(jumlahIsian, pctLots, pctMots, pctHots);
    const uraianDist = distributeDifficultyCounts(jumlahUraian, pctLots, pctMots, pctHots);

    const fase = grade <= 2 ? 'A' : grade <= 4 ? 'B' : 'C';
    const tahunPelajaran = profile?.tahunPelajaran || '2026/2027';
    const optionLayout = config?.optionLayout || 'vertical';
    const includeIllustrations = Boolean(config?.includeIllustrations);
    const uniqueSeed = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const protaContext = (protaItems || []).map((item: any, idx: number) => `
[Elemen ${idx + 1}: ${item.elemen}]
- CP: ${item.cp}
- TP: ${Array.isArray(item.tp) ? item.tp.join(' | ') : item.tp}
- ATP Terpilih (Dari Prota Terkunci):
${(item.selectedAtps || item.atp || []).map((a: string, i: number) => `  ${i + 1}. ${a}`).join('\n')}
`).join('\n');

    const antiDuplicationList = Array.isArray(previousQuestionStems) && previousQuestionStems.length > 0
      ? previousQuestionStems.slice(0, 60).map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')
      : 'Belum ada soal sebelumnya.';

    const prompt = `Anda adalah Tim Pakar Asesmen Pendidikan Agama Islam dan Budi Pekerti (PAI BP) Jenjang Sekolah Dasar (SD) Kementerian Pendidikan Dasar dan Menengah (Kemendikdasmen) RI.

TUGAS UTAMA:
Susun perangkat lengkap Naskah Asesmen Sumatif yang VALID, SAH, SIAP CETAK, dan SIAP DISEBARKAN KEPADA SISWA berdasarkan **Panduan Pembelajaran dan Asesmen (PPA) Jenjang SD Tahun 2026** dan **Kurikulum Merdeka**.

IDENTITAS ASESMEN:
- Jenis Asesmen: ${jenisSumatif} (${judulAsesmen})
- Kelas / Fase: Kelas ${grade} SD / Fase ${fase}
- Semester: ${semesterLabel}
- Tahun Pelajaran: ${tahunPelajaran}
- Sekolah: ${profile?.namaSekolah || 'SD Negeri'}
- Seed Unik Variasi: ${uniqueSeed}

SUMBER DATABASE PROTA YANG SUDAH DIHASILKAN & DIKUNCI PENGGUNA:
${protaContext}

KONFIGURASI SOAL WAJIB DIIKUTI:
1. Jumlah Soal Pilihan Ganda (PG): TEPAT ${jumlahPg} butir (Nomor 1 s.d. ${jumlahPg}).
   - Sebaran kesulitan PG: ${pgDist.lots} soal LOTS (C1-C2), ${pgDist.mots} soal MOTS (C3), ${pgDist.hots} soal HOTS (C4-C6).
   - Tata Letak Opsi A, B, C, D pilihan pengguna: ${optionLayout === 'horizontal' ? 'HORIZONTAL SEJAJAR 1 BARIS KE SAMPING (buat teks setiap opsi A, B, C, D RINGKAS maksimal 2-4 kata agar sejajar rapi dalam 1 baris!)' : 'VERTIKAL A-D KE BAWAH (opsi boleh berupa frasa/kalimat singkat yang jelas dan sejajar panjangnya).' }
2. Jumlah Soal Isian Singkat: TEPAT ${jumlahIsian} butir (Nomor 1 s.d. ${jumlahIsian}).
   - Sebaran kesulitan Isian: ${isianDist.lots} LOTS, ${isianDist.mots} MOTS, ${isianDist.hots} HOTS.
3. Jumlah Soal Uraian: TEPAT ${jumlahUraian} butir (Nomor 1 s.d. ${jumlahUraian}).
   - Sebaran kesulitan Uraian: ${uraianDist.lots} LOTS, ${uraianDist.mots} MOTS, ${uraianDist.hots} HOTS.

PEDOMAN KHUSUS YANG HARUS DIPATUHI 100%:
1. KESESUAIAN PPA SD TAHUN 2026:
   - Indikator soal di Kisi-Kisi harus operasional menggunakan KKO terukur (LOTS: menyebutkan, mengidentifikasi, menjelaskan; MOTS: menerapkan, mencontohkan, mengurutkan; HOTS: menganalisis, menyimpulkan, mengevaluasi kasus nyata).
   - Rubrik Penilaian & Penskoran mengikuti PPA 2026 dengan Interval Ketercapaian Tujuan Pembelajaran (KKTP): Perlu Bimbingan (0-60), Cukup (61-75), Baik (76-89), Sangat Baik (90-100), lengkap dengan tindak lanjut (Remedial/Pengayaan).
   - Bahasa Indonesia baku sesuai EYD V dan disesuaikan dengan tingkat keterbacaan anak SD Kelas ${grade} (Fase ${fase}).
2. TULISAN ARAB RAPI DAN BENAR:
   - Setiap ayat Al-Qur'an, hadis, huruf hijaiah, bacaan salat, atau lafaz doa WAJIB menggunakan aksara Arab Unicode yang SAHIH dan BERHARAKAT LENGKAP (fathah, kasrah, dammah, sukun, tasydid, tanwin).
   - Letakkan tulisan Arab di field \`teksArab\` secara terpisah dari kalimat soal bahasa Indonesia (\`pertanyaan\`) agar penataan RTL tidak tercampur atau terbalik. Jika tidak ada lafaz Arab pada soal tersebut, isi \`teksArab\` dengan string kosong "".
3. ANTI-DUPLIKASI (DILARANG KERAS MEMBUAT SOAL KEMBAR ANTAR KELAS ATAU ANTAR SESI):
   - Jangan pernah mengulang soal yang sudah pernah ada di kelas lain maupun membuat dua soal mirip dalam naskah ini! Gunakan variasi nama tokoh cerita anak Indonesia yang segar, kasus kehidupan sehari-hari yang beragam, dan sudut pandang ATP yang berbeda.
   - Daftar stem soal yang DILARANG diulang/dimiripkan:
${antiDuplicationList}
4. PEDOMAN GAMBAR ILUSTRASI KONTEKSTUAL (SVG):
   - ${includeIllustrations ? `Sisipkan ilustrasi vektor SVG yang JELAS, INFORMATIF, DAN BERKAITAN LANGSUNG dengan soal pada 2 hingga 4 butir soal terpilih (misal pada PG/Isian tentang gerakan wudhu/salat, huruf hijaiah berharakat jelas, perilaku menolong teman/berinfaq, masjid, alam semesta ciptaan Allah, atau kaligrafi). Gunakan tag \`<svg viewBox="0 0 320 170" xmlns="http://www.w3.org/2000/svg">...</svg>\` dengan warna edukatif yang bersih dan latar terang (#F8FAFC atau #FFFFFF) agar jelas saat dicetak di kertas putih.` : 'Jangan buat ilustrasi SVG (isi semua svgIllustration dengan string kosong "").'}
   - **LARANGAN MUTLAK PENGGAMBARAN NABI DAN RASUL**:
     JIKA ada soal atau materi terkait kisah Nabi dan Rasul (elemen Sejarah Peradaban Islam atau Akidah tentang Rasul), **DILARANG KERAS** menggambar figur manusia, siluet tubuh, atau wajah Nabi dan Rasul, **TERMASUK DILARANG KERAS** menggambarkan sosok manusia yang wajahnya ditutupi cahaya/sinar/halo/awan!
     Sebagai gantinya, untuk soal kisah Nabi & Rasul cukup gunakan ilustrasi benda/tempat/simbol non-manusia (seperti Ka'bah, Gua Hira di bukit, Masjid Nabawi, perahu di lautan, pohon kurma, unta di padang pasir, atau kitab wahyu), atau biarkan \`svgIllustration\` kosong \`""\` dan gunakan stimulus narasi teks yang kuat.
5. KELENGKAPAN KISI-KISI:
   - Array \`kisiKisi\` harus berisi TEPAT ${jumlahPg + jumlahIsian + jumlahUraian} baris (satu baris untuk setiap butir soal PG, Isian Singkat, dan Uraian secara berurutan!).
6. BOBOT PENSKORAN:
   - Hitung skor maksimal secara konsisten: PG = 1 poin/soal (total ${jumlahPg}), Isian = 2 poin/soal (total ${jumlahIsian * 2}), Uraian = 4 poin/soal (total ${jumlahUraian * 4}), atau sesuaikan agar \`totalSkorMaksimal\` tepat merupakan penjumlahan seluruh skor maksimal butir soal PG + Isian + Uraian!`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        kisiKisi: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              no: { type: Type.INTEGER },
              elemen: { type: Type.STRING },
              cp: { type: Type.STRING },
              tpAtp: { type: Type.STRING },
              materiPokok: { type: Type.STRING },
              indikatorSoal: { type: Type.STRING },
              levelKognitif: { type: Type.STRING },
              kategoriKesulitan: { type: Type.STRING },
              bentukSoal: { type: Type.STRING },
              nomorSoal: { type: Type.INTEGER }
            },
            required: ['no', 'elemen', 'cp', 'tpAtp', 'materiPokok', 'indikatorSoal', 'levelKognitif', 'kategoriKesulitan', 'bentukSoal', 'nomorSoal']
          }
        },
        soalPg: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              nomor: { type: Type.INTEGER },
              elemen: { type: Type.STRING },
              kategoriKesulitan: { type: Type.STRING },
              levelKognitif: { type: Type.STRING },
              stimulus: { type: Type.STRING },
              pertanyaan: { type: Type.STRING },
              teksArab: { type: Type.STRING },
              svgIllustration: { type: Type.STRING },
              illustrationCaption: { type: Type.STRING },
              opsi: {
                type: Type.OBJECT,
                properties: {
                  A: { type: Type.STRING },
                  B: { type: Type.STRING },
                  C: { type: Type.STRING },
                  D: { type: Type.STRING }
                },
                required: ['A', 'B', 'C', 'D']
              },
              kunciJawaban: { type: Type.STRING },
              pembahasan: { type: Type.STRING }
            },
            required: ['nomor', 'elemen', 'kategoriKesulitan', 'levelKognitif', 'pertanyaan', 'opsi', 'kunciJawaban', 'pembahasan']
          }
        },
        soalIsian: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              nomor: { type: Type.INTEGER },
              elemen: { type: Type.STRING },
              kategoriKesulitan: { type: Type.STRING },
              levelKognitif: { type: Type.STRING },
              stimulus: { type: Type.STRING },
              pertanyaan: { type: Type.STRING },
              teksArab: { type: Type.STRING },
              svgIllustration: { type: Type.STRING },
              illustrationCaption: { type: Type.STRING },
              kunciJawaban: { type: Type.STRING },
              skorMaksimal: { type: Type.INTEGER },
              pedomanPenskoran: { type: Type.STRING }
            },
            required: ['nomor', 'elemen', 'kategoriKesulitan', 'levelKognitif', 'pertanyaan', 'kunciJawaban', 'skorMaksimal', 'pedomanPenskoran']
          }
        },
        soalUraian: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              nomor: { type: Type.INTEGER },
              elemen: { type: Type.STRING },
              kategoriKesulitan: { type: Type.STRING },
              levelKognitif: { type: Type.STRING },
              stimulus: { type: Type.STRING },
              pertanyaan: { type: Type.STRING },
              teksArab: { type: Type.STRING },
              svgIllustration: { type: Type.STRING },
              illustrationCaption: { type: Type.STRING },
              kunciJawaban: { type: Type.STRING },
              skorMaksimal: { type: Type.INTEGER },
              rubrikPenskoran: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    skor: { type: Type.INTEGER },
                    kriteria: { type: Type.STRING }
                  },
                  required: ['skor', 'kriteria']
                }
              }
            },
            required: ['nomor', 'elemen', 'kategoriKesulitan', 'levelKognitif', 'pertanyaan', 'kunciJawaban', 'skorMaksimal', 'rubrikPenskoran']
          }
        }
      },
      required: ['kisiKisi', 'soalPg', 'soalIsian', 'soalUraian']
    };

    const models = ['gemini-2.5-flash', 'gemini-3.1-flash-lite', 'gemini-2.0-flash'];
    let rawText = '';
    let retries = models.length + 1;
    let delay = 1500;
    let modelIdx = 0;

    while (retries > 0) {
      try {
        const response = await client.models.generateContent({
          model: models[modelIdx],
          contents: prompt,
          config: {
            systemInstruction: 'Anda adalah pakar asesmen dan kurikulum PAI BP Sekolah Dasar Indonesia berdasarkan Panduan Pembelajaran dan Asesmen (PPA) 2026. Hasilkan soal yang sahih, valid, berbahasa Indonesia baku, beraksara Arab lengkap berharakat jika menyertakan dalil/hijaiah, serta tidak pernah menggambar wajah atau sosok Nabi dan Rasul dalam bentuk apapun termasuk wajah bercahaya.',
            responseMimeType: 'application/json',
            responseSchema
          }
        });
        rawText = response.text ?? '{}';
        break;
      } catch (err: any) {
        retries--;
        if (retries === 0) throw err;
        modelIdx = (modelIdx + 1) % models.length;
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 1.5;
      }
    }

    const parsed = JSON.parse(rawText);

    const soalPg = (Array.isArray(parsed.soalPg) ? parsed.soalPg : []).slice(0, jumlahPg).map((item: any, idx: number) => ({
      nomor: idx + 1,
      elemen: item.elemen || 'PAI BP',
      kategoriKesulitan: (['LOTS', 'MOTS', 'HOTS'].includes(item.kategoriKesulitan) ? item.kategoriKesulitan : 'MOTS') as 'LOTS' | 'MOTS' | 'HOTS',
      levelKognitif: item.levelKognitif || 'C2',
      stimulus: item.stimulus || '',
      pertanyaan: item.pertanyaan || '',
      teksArab: item.teksArab || '',
      svgIllustration: includeIllustrations ? sanitizeSvg(item.svgIllustration) : '',
      illustrationCaption: includeIllustrations ? (item.illustrationCaption || '') : '',
      opsi: {
        A: item.opsi?.A || '-',
        B: item.opsi?.B || '-',
        C: item.opsi?.C || '-',
        D: item.opsi?.D || '-'
      },
      kunciJawaban: (['A', 'B', 'C', 'D'].includes((item.kunciJawaban || '').toUpperCase()) ? item.kunciJawaban.toUpperCase() : 'A') as 'A' | 'B' | 'C' | 'D',
      pembahasan: item.pembahasan || ''
    }));

    const soalIsian = (Array.isArray(parsed.soalIsian) ? parsed.soalIsian : []).slice(0, jumlahIsian).map((item: any, idx: number) => ({
      nomor: idx + 1,
      elemen: item.elemen || 'PAI BP',
      kategoriKesulitan: (['LOTS', 'MOTS', 'HOTS'].includes(item.kategoriKesulitan) ? item.kategoriKesulitan : 'MOTS') as 'LOTS' | 'MOTS' | 'HOTS',
      levelKognitif: item.levelKognitif || 'C2',
      stimulus: item.stimulus || '',
      pertanyaan: item.pertanyaan || '',
      teksArab: item.teksArab || '',
      svgIllustration: includeIllustrations ? sanitizeSvg(item.svgIllustration) : '',
      illustrationCaption: includeIllustrations ? (item.illustrationCaption || '') : '',
      kunciJawaban: item.kunciJawaban || '-',
      skorMaksimal: Number(item.skorMaksimal) || 2,
      pedomanPenskoran: item.pedomanPenskoran || 'Skor penuh jika jawaban tepat sesuai konsep.'
    }));

    const soalUraian = (Array.isArray(parsed.soalUraian) ? parsed.soalUraian : []).slice(0, jumlahUraian).map((item: any, idx: number) => {
      const maxSkor = Number(item.skorMaksimal) || 4;
      return {
        nomor: idx + 1,
        elemen: item.elemen || 'PAI BP',
        kategoriKesulitan: (['LOTS', 'MOTS', 'HOTS'].includes(item.kategoriKesulitan) ? item.kategoriKesulitan : 'HOTS') as 'LOTS' | 'MOTS' | 'HOTS',
        levelKognitif: item.levelKognitif || 'C4',
        stimulus: item.stimulus || '',
        pertanyaan: item.pertanyaan || '',
        teksArab: item.teksArab || '',
        svgIllustration: includeIllustrations ? sanitizeSvg(item.svgIllustration) : '',
        illustrationCaption: includeIllustrations ? (item.illustrationCaption || '') : '',
        kunciJawaban: item.kunciJawaban || '-',
        skorMaksimal: maxSkor,
        rubrikPenskoran: Array.isArray(item.rubrikPenskoran) && item.rubrikPenskoran.length > 0
          ? item.rubrikPenskoran
          : [
              { skor: maxSkor, kriteria: 'Menjawab dengan sangat lengkap, runtut, dan tepat sesuai nilai PAI BP.' },
              { skor: Math.max(1, Math.floor(maxSkor * 0.75)), kriteria: 'Menjawab benar namun kurang lengkap pada satu aspek.' },
              { skor: Math.max(1, Math.floor(maxSkor * 0.5)), kriteria: 'Menjawab sebagian konsep dengan tepat.' },
              { skor: 1, kriteria: 'Mencoba menjawab namun masih kurang tepat.' },
              { skor: 0, kriteria: 'Tidak menjawab atau jawaban tidak relevan.' }
            ]
      };
    });

    const kisiKisi = (Array.isArray(parsed.kisiKisi) ? parsed.kisiKisi : []).map((item: any, idx: number) => ({
      no: idx + 1,
      elemen: item.elemen || 'PAI BP',
      cp: item.cp || '',
      tpAtp: item.tpAtp || '',
      materiPokok: item.materiPokok || '',
      indikatorSoal: item.indikatorSoal || '',
      levelKognitif: item.levelKognitif || 'C2',
      kategoriKesulitan: (['LOTS', 'MOTS', 'HOTS'].includes(item.kategoriKesulitan) ? item.kategoriKesulitan : 'MOTS') as 'LOTS' | 'MOTS' | 'HOTS',
      bentukSoal: item.bentukSoal || 'Pilihan Ganda',
      nomorSoal: Number(item.nomorSoal) || (idx + 1)
    }));

    const skorMaksPg = soalPg.length * 1;
    const skorMaksIsian = soalIsian.reduce((sum: number, s: any) => sum + (Number(s.skorMaksimal) || 2), 0);
    const skorMaksUraian = soalUraian.reduce((sum: number, s: any) => sum + (Number(s.skorMaksimal) || 4), 0);
    const totalSkorMaksimal = Math.max(1, skorMaksPg + skorMaksIsian + skorMaksUraian);

    return res.status(200).json({
      kisiKisi,
      soalPg,
      soalIsian,
      soalUraian,
      rubrikUmum: {
        bobotPgPerSoal: 1,
        skorMaksPg,
        skorMaksIsian,
        skorMaksUraian,
        totalSkorMaksimal,
        rumusNilaiAkhir: `Nilai Akhir = (Jumlah Skor Perolehan ÷ ${totalSkorMaksimal}) × 100`,
        intervalKktp: [
          {
            rentang: '0 - 60',
            predikat: 'Perlu Bimbingan',
            tindakLanjut: 'Belum mencapai ketuntasan; wajib mengikuti pembelajaran remedial pada indikator yang belum dikuasai.'
          },
          {
            rentang: '61 - 75',
            predikat: 'Cukup',
            tindakLanjut: 'Sudah mencapai ketuntasan minimal; diberikan pendalaman konsep pada bagian yang masih lemah.'
          },
          {
            rentang: '76 - 89',
            predikat: 'Baik',
            tindakLanjut: 'Sudah mencapai ketuntasan dengan baik; dapat melanjutkan ke materi berikutnya.'
          },
          {
            rentang: '90 - 100',
            predikat: 'Sangat Baik',
            tindakLanjut: 'Melampaui ketuntasan; diberikan program pengayaan dan tantangan literasi PAI BP lanjutan.'
          }
        ]
      }
    });
  } catch (error: any) {
    console.error('Vercel /api/sumatif/generate error:', error);
    return res.status(500).json({
      error: error?.message || 'Gagal menghasilkan Naskah Sumatif.',
    });
  }
}
