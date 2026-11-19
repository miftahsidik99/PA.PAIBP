import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

function createAiClient(fallbackKey?: string) {
  const effectiveKey = process.env.GEMINI_API_KEY || fallbackKey || '';
  if (!effectiveKey) {
    throw new Error('API Key Gemini belum tersedia di server maupun pengaturan aplikasi.');
  }
  return new GoogleGenAI({
    apiKey: effectiveKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || 'missing-key',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

function distributeDifficultyCounts(total: number, pctLots: number, pctMots: number, pctHots: number) {
  if (total <= 0) return { lots: 0, mots: 0, hots: 0 };
  const sumPct = Math.max(1, pctLots + pctMots + pctHots);
  const exactLots = (total * pctLots) / sumPct;
  const exactMots = (total * pctMots) / sumPct;
  const exactHots = (total * pctHots) / sumPct;

  let lots = Math.floor(exactLots);
  let mots = Math.floor(exactMots);
  let hots = Math.floor(exactHots);
  let remainder = total - (lots + mots + hots);

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
  // Strip dangerous tags/attributes
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

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  app.use(express.json({ limit: '10mb' }));

  // API Route to generate ATP using Gemini (Batch)
  app.post('/api/generate-atp-batch', async (req, res) => {
    try {
      const { gradeCp, jpPerWeek, totalMeetings } = req.body;
      
      const prompt = `
Anda adalah ahli kurikulum PAI BP SD.
Berikut adalah array elemen, Capaian Pembelajaran (CP), dan Tujuan Pembelajaran (TP).

${gradeCp.map((item: any, index: number) => `
[Item ${index}]
Elemen: ${item.elemen}
CP: ${item.cp}
TP:
${item.tp.map((t: string, i: number) => `  ${i + 1}. ${t}`).join('\n')}
`).join('\n')}

Tugas:
Pecah setiap Tujuan Pembelajaran di atas menjadi Alur Tujuan Pembelajaran (ATP) yang lebih rinci untuk alokasi waktu satu tahun ajaran penuh (Semester 1 dan Semester 2).
Setiap ATP akan dipelajari dalam 1 pertemuan (${jpPerWeek} JP).

ATURAN SANGAT PENTING (WAJIB DIIKUTI):
1. TOTAL SELURUH ATP DARI SEMUA ELEMEN JIKA DIJUMLAHKAN HARUS SAMA PERSIS DENGAN ${totalMeetings || 36} ATP!
2. Anda memiliki ${gradeCp.length} elemen. Jika total target adalah ${totalMeetings || 36}, maka rata-rata setiap elemen harus memiliki sekitar ${Math.round((totalMeetings || 36) / gradeCp.length)} ATP di dalam array "atp"-nya.
3. Distribusikan materi dari Semester 1 hingga Semester 2 secara logis and berurutan.
4. JANGAN menghasilkan lebih sedikit atau lebih banyak dari ${totalMeetings || 36} ATP secara keseluruhan. Hitung dengan teliti!

Berikan output HANYA berupa array JSON yang persis dengan input, tetapi dengan properti tambahan "atp" (array of strings) di setiap itemnya.
Contoh Format:
[
  {
    "elemen": "...",
    "cp": "...",
    "tp": ["..."],
    "atp": ["ATP 1...", "ATP 2..."]
  }
]
Jangan ada teks apa pun selain JSON yang valid. Jangan gunakan tag markdown \`\`\`json.
`;
      
      let text = '';
      let retries = 5;
      let delay = 2000;
      let usedModel = 'gemini-4-hydrogen'; 
      
      while (retries > 0) {
        try {
          const response = await ai.models.generateContent({
            model: usedModel,
            contents: prompt,
            config: {
              responseMimeType: "application/json"
            }
          });
          text = response.text || "[]";
          break;
        } catch (err: any) {
          console.error(`Gemini ATP Error (${retries} retries left, model: ${usedModel}):`, err);
          if (err?.status === 429 || err?.message?.includes('429') || err?.status === 503 || err?.message?.includes('503') || err?.status === 'RESOURCE_EXHAUSTED' || err?.status === 404 || err?.message?.includes('not found') || err?.message?.includes('NOT_FOUND')) {
            retries--;
            if (retries === 0) throw err;
            
            const fallbackModels = ['gemini-4-hydrogen', 'gemini-3.8-flash', 'gemini-3.1-flash-lite'];
            const currentIdx = fallbackModels.indexOf(usedModel);
            usedModel = fallbackModels[currentIdx === -1 ? 0 : (currentIdx + 1) % fallbackModels.length];
            
            console.log(`Rotating to ${usedModel} due to error. Retrying in ${delay/1000}s...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 1.5;
          } else {
            throw err;
          }
        }
      }
      if (text.startsWith('```json')) {
        text = text.replace(/```json/g, '').replace(/```/g, '');
      }
      
      // Sometimes it ends with ```
      text = text.trim();
      if (text.endsWith('```')) {
        text = text.slice(0, -3).trim();
      }
      
      const protaArray = JSON.parse(text);
      
      // Post-processing to ENSURE exact total meetings
      let currentTotal = 0;
      protaArray.forEach((item: any) => {
        if (!Array.isArray(item.atp)) item.atp = ["Materi " + item.elemen];
        if (!Array.isArray(item.tp)) item.tp = [item.tp || ""];
        currentTotal += item.atp.length;
      });

      const targetTotal = totalMeetings || 36;
      
      if (protaArray.length > 0 && currentTotal < targetTotal) {
        let diff = targetTotal - currentTotal;
        let idx = 0;
        while (diff > 0) {
          protaArray[idx % protaArray.length].atp.push("Pendalaman Materi & Evaluasi");
          diff--;
          idx++;
        }
      } else if (protaArray.length > 0 && currentTotal > targetTotal) {
        let diff = currentTotal - targetTotal;
        let idx = protaArray.length - 1;
        while (diff > 0) {
          if (protaArray[idx].atp.length > 1) {
            protaArray[idx].atp.pop();
            diff--;
          }
          idx--;
          if (idx < 0) idx = protaArray.length - 1;
        }
      }
      
      res.json({ prota: protaArray });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Route to generate Modul Ajar using Gemini
  app.post('/api/generate-modul-ajar', async (req, res) => {
    try {
      const { selectedAtp, selectedGrade, totalJp, pertemuan, profile, karakteristik } = req.body;
      
      const prompt = `Anda adalah Tim Ahli Kurikulum Pendidikan Indonesia (Kemendikdasmen, Pengembang Kurikulum Merdeka, Ahli Deep Learning). 
Tugas Anda adalah menyusun MODUL AJAR LENGKAP (BUKAN RINGKASAN) mata pelajaran PAI dan Budi Pekerti Kelas ${selectedGrade} SD berdasarkan Permendikdasmen Nomor 13 Tahun 2025.

ATP yang dipilih:
${selectedAtp.map((atp: string, i: number) => `${i+1}. ${atp}`).join('\n')}

Identitas Sekolah:
Guru: ${profile?.namaGuru || '[DIISI OLEH GURU]'}
Sekolah: ${profile?.namaSekolah || '[DIISI OLEH GURU]'}
Tahun Pelajaran: 2024/2025
Karakteristik Peserta Didik: ${karakteristik || 'Reguler/Tipikal'}

IKUTI PRINSIP PEMBELAJARAN MENDALAM (DEEP LEARNING) 8,3,3,4:
- 8 Dimensi Profil Lulusan: Beriman bertakwa, Berakhlak mulia, Mandiri, Bernalar kritis, Kreatif, Bergotong royong, Berkebinekaan global, Sehat jasmani rohani.
- 3 Prinsip: Mindful, Meaningful, Joyful Learning.
- 3 Pengalaman: Memahami, Mengaplikasi, Merefleksi.
- 4 Kerangka: Praktik Pedagogis, Kemitraan, Lingkungan, Teknologi Digital.

STRUKTUR MODUL YANG HARUS DIHASILKAN (LENGKAP):
1. IDENTITAS: Nama Guru, Sekolah, Fase, Kelas, Semester, Mapel, Elemen, Materi, Alokasi Waktu (total ${totalJp} JP), Model (Maks 1), Pendekatan (Maks 1), Metode (Maks 1), Media (Maks 1), Sumber, Karakteristik Siswa (Gunakan: ${karakteristik || 'Reguler/Tipikal'}), Target, Sarana Prasarana.
KETENTUAN KHUSUS (PENTING): 
- Model: Tentukan HANYA 1 model utama (misal: PBL, PJBL, atau Discovery).
- Pendekatan: Tentukan HANYA 1 pendekatan utama (misal: TaRL, CRT, atau Saintifik).
- Metode: Tentukan HANYA 1 metode yang paling dominan (misal: Diskusi, Ceramah, atau Tanya Jawab).
- Media: Tentukan HANYA 1 media utama yang benar-benar digunakan.
- PASTIKAN JUMLAHNYA PAS 1 UNTUK MASING-MASING POIN DI ATAS.
2. KOMPONEN INTI: Capaian Pembelajaran, Tujuan Pembelajaran (KKO), Alur Tujuan Pembelajaran, Pemahaman Bermakna (manfaat nyata), Pertanyaan Pemantik (min 5).
3. DIAGNOSTIK: Deskripsi & Instrumen Diagnostik Kognitif & Non-Kognitif.
4. PEMBELAJARAN MENDALAM: Implementasi kontekstual 8,3,3,4 pada materi ini.
5. LANGKAH PEMBELAJARAN: Rinci per pertemuan (${pertemuan} pertemuan). Setiap pertemuan ada: Pendahuluan, Inti (aktivitas guru & siswa rinci), Penutup. Sertakan estimasi waktu.
6. ASESMEN & INSTRUMEN: Diagnostik, Formatif, Sumatif. Pilih instrumen & rubrik paling relevan (Observasi/Kinerja/Tes dll).
7. PENGAYAAN & REMEDIAL: Rencana lengkap.
8. REFLEKSI: Refleksi Guru (min 10 soal) & Refleksi Siswa (min 10 soal).
9. LKPD: Judul, Tujuan, Petunjuk, Alat, Langkah, Tugas, Soal, Ruang Jawaban.
10. BAHAN BACAAN, GLOSARIUM, DAFTAR PUSTAKA.
11. LAMPIRAN: (Lembar observasi, jurnal, bank soal, dll).
12. TABEL VALIDASI: Tabel pengecekan mandiri AI (Kelengkapan, Kesesuaian, Placeholder, Konsistensi).

Format balasan berupa JSON dengan struktur berikut (Hanya output JSON, tanpa markdown code block, tanpa teks pengantar):
{
  "identitas": { "elemen": "...", "materi": "...", "model": "...", "pendekatan": "...", "metode": "...", "media": "...", "sumber": "...", "karakteristik": "...", "target": "...", "sarana": "..." },
  "komponenInti": { "cp": "...", "tp": "...", "atp": "...", "pemahamanBermakna": "...", "pertanyaanPemantik": ["..."] },
  "diagnostik": { "deskripsi": "...", "instrumenKognitif": "...", "instrumenNonKognitif": "..." },
  "pembelajaranMendalam": "Deskripsi implementasi 8,3,3,4...",
  "langkahPembelajaran": [
    { "pertemuan": 1, "pendahuluan": "...", "inti": "...", "penutup": "...", "waktu": "..." }
  ],
  "asesmen": { "jenis": "...", "deskripsi": "...", "instrumen": "...", "rubrik": "..." },
  "pengayaanRemedial": { "pengayaan": "...", "remedial": "..." },
  "refleksi": { "guru": ["..."], "siswa": ["..."] },
  "lkpd": { "judul": "...", "tujuan": "...", "petunjuk": "...", "alat": "...", "langkah": ["..."], "tugas": "...", "soal": ["..."] },
  "bacaanGlosariumPustaka": { "bacaanGuru": "...", "bacaanSiswa": "...", "glosarium": "...", "pustaka": "..." },
  "lampiran": "...",
  "validasi": [
    { "aspek": "...", "status": "...", "catatan": "..." }
  ]
}

PASTIKAN KONTEN SANGAT RINCI DAN SIAP CETAK.`;
      
      let text = '';
      let retries = 5;
      let delay = 2000;
      let usedModel = 'gemini-4-hydrogen'; 
      
      while (retries > 0) {
        try {
          const response = await ai.models.generateContent({
            model: usedModel,
            contents: prompt,
            config: {
              responseMimeType: "application/json"
            }
          });
          
          text = response.text || '';
          
          if (text.startsWith('```json')) {
            text = text.replace(/```json/g, '').replace(/```/g, '');
          }
          text = text.trim();
          if (text.endsWith('```')) {
            text = text.slice(0, -3).trim();
          }
          
          JSON.parse(text); 
          break;
        } catch (error: any) {
          console.error(`Gemini Modul Ajar Error (${retries} retries left, model: ${usedModel}):`, error);
          if ((error?.status === 429 || error?.message?.includes('429') || error?.status === 'RESOURCE_EXHAUSTED' || error?.status === 503 || error?.status === 404 || error?.message?.includes('not found') || error?.message?.includes('NOT_FOUND')) && retries > 1) {
            const fallbackModels = ['gemini-4-hydrogen', 'gemini-3.8-flash', 'gemini-3.1-flash-lite'];
            const currentIdx = fallbackModels.indexOf(usedModel);
            usedModel = fallbackModels[currentIdx === -1 ? 0 : (currentIdx + 1) % fallbackModels.length];

            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 1.5;
            retries--;
          } else {
            throw error;
          }
        }
      }

      if (!text) {
        throw new Error("Failed to generate Modul Ajar after retries");
      }

      res.json(JSON.parse(text));
    } catch (error: any) {
      console.error('Error in /api/generate-modul-ajar:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Route to generate Sumatif Assessment (Kisi-kisi, Soal PG/Isian/Uraian, Kunci, Rubrik PPA SD 2026)
  app.post('/api/sumatif/generate', async (req, res) => {
    try {
      const {
        grade,
        jenisSumatif,
        semesterLabel,
        judulAsesmen,
        protaItems,
        config,
        profile,
        previousQuestionStems,
        userApiKey
      } = req.body;

      const client = createAiClient(userApiKey);
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

      let parsed: any = null;
      const models = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'];
      let retries = models.length + 1;
      let delay = 1500;
      let modelIdx = 0;

      while (retries > 0) {
        try {
          const activeModel = models[modelIdx];
          const response = await client.models.generateContent({
            model: activeModel,
            contents: prompt,
            config: {
              systemInstruction: 'Anda adalah pakar asesmen dan kurikulum PAI BP Sekolah Dasar Indonesia berdasarkan Panduan Pembelajaran dan Asesmen (PPA) 2026. Hasilkan soal yang sahih, valid, berbahasa Indonesia baku, beraksara Arab lengkap berharakat jika menyertakan dalil/hijaiah, serta tidak pernah menggambar wajah atau sosok Nabi dan Rasul dalam bentuk apapun termasuk wajah bercahaya.',
              responseMimeType: 'application/json',
              responseSchema,
              ...(activeModel === 'gemini-4-hydrogen' ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {})
            }
          });
          let rawText = (response.text ?? '{}').trim();
          if (rawText.startsWith('```json')) rawText = rawText.replace(/^```json\s*/i, '');
          if (rawText.startsWith('```')) rawText = rawText.replace(/^```\s*/i, '');
          if (rawText.endsWith('```')) rawText = rawText.slice(0, -3).trim();
          parsed = JSON.parse(rawText);
          break;
        } catch (err: any) {
          console.error(`Sumatif Gemini error (${retries} retries left, model: ${models[modelIdx]}):`, err);
          retries--;
          if (retries === 0) throw err;
          modelIdx = (modelIdx + 1) % models.length;
          const isNotFound = err?.status === 404 || err?.message?.includes('404') || err?.message?.includes('NOT_FOUND');
          await new Promise(resolve => setTimeout(resolve, isNotFound ? 250 : delay));
          if (!isNotFound) delay *= 1.5;
        }
      }

      // Normalize and sanitize output
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

      const rubrikUmum = {
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
      };

      res.json({
        kisiKisi,
        soalPg,
        soalIsian,
        soalUraian,
        rubrikUmum
      });
    } catch (error: any) {
      console.error('Error in /api/sumatif/generate:', error);
      res.status(500).json({ error: error?.message || 'Gagal menghasilkan Naskah Sumatif.' });
    }
  });

  // API Route to generate Single-TP / Single-ATP Educational Material Content (10 Template Styles + Multi-page PDF)
  app.post('/api/materi-ajar/generate', async (req, res) => {
    try {
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
        userApiKey
      } = req.body;

      if (!tp || !grade) {
        return res.status(400).json({ error: 'Tujuan Pembelajaran (TP/ATP) dan Kelas wajib dipilih.' });
      }

      const client = createAiClient(userApiKey);
      const resolvedFase = fase || (grade <= 2 ? 'A' : grade <= 4 ? 'B' : 'C');
      const resolvedFokus = fokusPilihan === 'atp' ? 'atp' : 'tp';
      const resolvedGaya = gayaTemplate || 'educational_infographic';
      const usiaInfo =
        grade <= 2
          ? 'usia 6–8 tahun (Kelas 1–2 SD, kalimat pendek, konkret, hangat, sangat mudah dipahami anak awal sekolah dasar)'
          : grade <= 4
          ? 'usia 8–10 tahun (Kelas 3–4 SD, kalimat jelas, komunikatif, dekat dengan dunia anak sekolah dasar)'
          : 'usia 10–12 tahun (Kelas 5–6 SD, runtut, bernalar kritis sederhana, tetap ramah anak dan konkret)';

      const styleInstructionMap: Record<string, string> = {
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
          'GAYA TEMPLATE: 10. Isometric 3D (Visualisasi objek). WAJIB isi `styleSpecific.isometricObjects` berisi 2–3 objek nyata/simbolik terkait materi (`namaObjek`, `fungsi`, `makna`, dan `svgIsometric` `<svg viewBox="0 0 280 180" xmlns="http://www.w3.org/2000/svg">...</svg>` bergaya balok/bidang perspektif isometrik 3D edukatif cerah, tanpa wajah Nabi/Rasul).'
      };

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

${styleInstructionMap[resolvedGaya] || styleInstructionMap.educational_infographic}

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
              pertanyaanPemantik: { type: Type.STRING }
            },
            required: ['pengantarSingkat', 'pertanyaanPemantik']
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
              captionIlustrasi: { type: Type.STRING }
            },
            required: ['pengertianKonsep', 'penjelasanUtama', 'poinPenting', 'contohKonkret', 'teksArab', 'artinyaArab', 'ilustrasiSvg', 'captionIlustrasi']
          },
          contohSehariHari: {
            type: Type.OBJECT,
            properties: {
              situasi: { type: Type.STRING },
              penerapan: { type: Type.ARRAY, items: { type: Type.STRING } },
              ilustrasiSvg: { type: Type.STRING },
              captionIlustrasi: { type: Type.STRING }
            },
            required: ['situasi', 'penerapan', 'ilustrasiSvg', 'captionIlustrasi']
          },
          aktivitasSiswa: {
            type: Type.OBJECT,
            properties: {
              judulAktivitas: { type: Type.STRING },
              langkah: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ['judulAktivitas', 'langkah']
          },
          rangkuman: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          latihanPemahaman: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                nomor: { type: Type.INTEGER },
                pertanyaan: { type: Type.STRING }
              },
              required: ['nomor', 'pertanyaan']
            }
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
                    nilai: { type: Type.STRING }
                  },
                  required: ['label', 'nilai']
                }
              },
              stickyNotes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    warna: { type: Type.STRING },
                    judul: { type: Type.STRING },
                    isi: { type: Type.STRING }
                  },
                  required: ['warna', 'judul', 'isi']
                }
              },
              mindMapCabang: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    cabang: { type: Type.STRING },
                    subPoin: { type: Type.ARRAY, items: { type: Type.STRING } }
                  },
                  required: ['cabang', 'subPoin']
                }
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
                    svgScene: { type: Type.STRING }
                  },
                  required: ['panelNo', 'latar', 'tokoh', 'dialog', 'narasi']
                }
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
                    tips: { type: Type.STRING }
                  },
                  required: ['nomor', 'depan', 'belakang', 'tips']
                }
              },
              stepByStep: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    langkahNo: { type: Type.INTEGER },
                    judulLangkah: { type: Type.STRING },
                    deskripsi: { type: Type.STRING },
                    catatan: { type: Type.STRING }
                  },
                  required: ['langkahNo', 'judulLangkah', 'deskripsi']
                }
              },
              timelineEvents: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    urutan: { type: Type.STRING },
                    judulPeristiwa: { type: Type.STRING },
                    keterangan: { type: Type.STRING },
                    hikmah: { type: Type.STRING }
                  },
                  required: ['urutan', 'judulPeristiwa', 'keterangan', 'hikmah']
                }
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
                        nilaiB: { type: Type.STRING }
                      },
                      required: ['aspek', 'nilaiA', 'nilaiB']
                    }
                  }
                },
                required: ['judulPerbandingan', 'kolomA', 'kolomB', 'baris']
              },
              isometricObjects: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    namaObjek: { type: Type.STRING },
                    fungsi: { type: Type.STRING },
                    makna: { type: Type.STRING },
                    svgIsometric: { type: Type.STRING }
                  },
                  required: ['namaObjek', 'fungsi', 'makna']
                }
              }
            }
          }
        },
        required: ['judulMateri', 'pengantarMateri', 'intiMateri', 'contohSehariHari', 'aktivitasSiswa', 'rangkuman', 'latihanPemahaman']
      };

      let parsed: any = null;
      const models = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'];
      let retries = models.length + 1;
      let delay = 1500;
      let modelIdx = 0;

      while (retries > 0) {
        try {
          const activeModel = models[modelIdx];
          const response = await client.models.generateContent({
            model: activeModel,
            contents: prompt,
            config: {
              systemInstruction: 'Anda adalah pakar kurikulum PAIBP SD Indonesia, ahli pedagogik anak usia SD, dan desainer grafis materi ajar profesional. Hasilkan materi akurat, fokus pada 1 TP/ATP, berbahasa ramah anak SD, beraksara Arab lengkap berharakat jika relevan, serta tidak pernah menggambarkan figur atau wajah Nabi dan Rasul termasuk wajah bercahaya.',
              responseMimeType: 'application/json',
              responseSchema,
              ...(activeModel === 'gemini-4-hydrogen' ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {})
            }
          });
          let rawText = (response.text ?? '{}').trim();
          if (rawText.startsWith('```json')) rawText = rawText.replace(/^```json\s*/i, '');
          if (rawText.startsWith('```')) rawText = rawText.replace(/^```\s*/i, '');
          if (rawText.endsWith('```')) rawText = rawText.slice(0, -3).trim();
          parsed = JSON.parse(rawText);
          break;
        } catch (err: any) {
          console.error(`Materi Ajar Gemini error (${retries} retries left, model: ${models[modelIdx]}):`, err);
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
              isi: n?.isi || ''
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
              svgScene: sanitizeSvg(p?.svgScene)
            }))
          : undefined,
        flashcards: Array.isArray(rawStyle.flashcards)
          ? rawStyle.flashcards.slice(0, 6).map((f: any, i: number) => ({
              nomor: Number(f?.nomor) || i + 1,
              depan: f?.depan || '',
              arab: f?.arab || '',
              belakang: f?.belakang || '',
              tips: f?.tips || ''
            }))
          : undefined,
        stepByStep: Array.isArray(rawStyle.stepByStep)
          ? rawStyle.stepByStep.slice(0, 6).map((st: any, i: number) => ({
              langkahNo: Number(st?.langkahNo) || i + 1,
              judulLangkah: st?.judulLangkah || '',
              deskripsi: st?.deskripsi || '',
              catatan: st?.catatan || ''
            }))
          : undefined,
        timelineEvents: Array.isArray(rawStyle.timelineEvents) ? rawStyle.timelineEvents.slice(0, 6) : undefined,
        comparisonData: rawStyle.comparisonData
          ? {
              judulPerbandingan: rawStyle.comparisonData.judulPerbandingan || 'Perbandingan Konsep',
              kolomA: rawStyle.comparisonData.kolomA || 'Konsep A',
              kolomB: rawStyle.comparisonData.kolomB || 'Konsep B',
              baris: Array.isArray(rawStyle.comparisonData.baris) ? rawStyle.comparisonData.baris.slice(0, 6) : []
            }
          : undefined,
        isometricObjects: Array.isArray(rawStyle.isometricObjects)
          ? rawStyle.isometricObjects.slice(0, 4).map((obj: any) => ({
              namaObjek: obj?.namaObjek || '',
              fungsi: obj?.fungsi || '',
              makna: obj?.makna || '',
              svgIsometric: sanitizeSvg(obj?.svgIsometric)
            }))
          : undefined
      };

      res.json({
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
          pertanyaanPemantik: parsed.pengantarMateri?.pertanyaanPemantik || ''
        },
        intiMateri: {
          pengertianKonsep: parsed.intiMateri?.pengertianKonsep || '',
          penjelasanUtama: parsed.intiMateri?.penjelasanUtama || '',
          poinPenting: Array.isArray(parsed.intiMateri?.poinPenting) ? parsed.intiMateri.poinPenting.slice(0, 5) : [],
          contohKonkret: Array.isArray(parsed.intiMateri?.contohKonkret) ? parsed.intiMateri.contohKonkret.slice(0, 4) : [],
          teksArab: parsed.intiMateri?.teksArab || '',
          artinyaArab: parsed.intiMateri?.artinyaArab || '',
          ilustrasiSvg: sanitizeSvg(parsed.intiMateri?.ilustrasiSvg),
          captionIlustrasi: parsed.intiMateri?.captionIlustrasi || ''
        },
        contohSehariHari: {
          situasi: parsed.contohSehariHari?.situasi || '',
          penerapan: Array.isArray(parsed.contohSehariHari?.penerapan) ? parsed.contohSehariHari.penerapan.slice(0, 4) : [],
          ilustrasiSvg: sanitizeSvg(parsed.contohSehariHari?.ilustrasiSvg),
          captionIlustrasi: parsed.contohSehariHari?.captionIlustrasi || ''
        },
        aktivitasSiswa: {
          judulAktivitas: parsed.aktivitasSiswa?.judulAktivitas || 'Ayo Praktikkan!',
          langkah: Array.isArray(parsed.aktivitasSiswa?.langkah) ? parsed.aktivitasSiswa.langkah.slice(0, 4) : []
        },
        rangkuman: Array.isArray(parsed.rangkuman) ? parsed.rangkuman.slice(0, 5) : [],
        latihanPemahaman: Array.isArray(parsed.latihanPemahaman)
          ? parsed.latihanPemahaman.slice(0, 3).map((q: any, idx: number) => ({
              nomor: idx + 1,
              pertanyaan: q?.pertanyaan || ''
            }))
          : [],
        styleSpecific
      });
    } catch (error: any) {
      console.error('Error in /api/materi-ajar/generate:', error);
      res.status(500).json({ error: error?.message || 'Gagal menghasilkan Materi Ajar.' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
