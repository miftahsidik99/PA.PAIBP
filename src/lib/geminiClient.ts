import { GoogleGenAI, Type } from '@google/genai';

function getAI(apiKey?: string | null) {
  const key = apiKey || (typeof import.meta !== 'undefined' && (import.meta as any).env ? (import.meta as any).env.VITE_GEMINI_API_KEY : '');
  if (!key) {
    throw new Error("API Key Gemini belum diatur. Silakan atur API Key Gemini Anda melalui menu 'Pengaturan API' di sidebar kiri.");
  }
  return new GoogleGenAI({ 
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build-client',
      }
    }
  });
}

const FALLBACK_MODELS = ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-2.0-flash', 'gemini-2.5-flash'];

export async function generateAtpBatchClient(
  gradeCp: any[],
  jpPerWeek: number,
  totalMeetings: number,
  apiKey?: string | null
): Promise<any[]> {
  const ai = getAI(apiKey);

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
3. Distribusikan materi dari Semester 1 hingga Semester 2 secara logis dan berurutan.
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
  let retries = 4;
  let delay = 2000;
  let modelIndex = 0;
  let usedModel = FALLBACK_MODELS[0];

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
      console.warn(`Gemini ATP Client Error (${retries} retries left, model: ${usedModel}):`, err);
      if (
        err?.status === 429 || err?.message?.includes('429') ||
        err?.status === 503 || err?.message?.includes('503') ||
        err?.status === 'RESOURCE_EXHAUSTED' ||
        err?.status === 404 || err?.message?.includes('not found')
      ) {
        retries--;
        if (retries === 0) throw err;
        modelIndex = (modelIndex + 1) % FALLBACK_MODELS.length;
        usedModel = FALLBACK_MODELS[modelIndex];
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 1.5;
      } else {
        throw err;
      }
    }
  }

  text = text.trim();
  if (text.startsWith('```json')) {
    text = text.replace(/```json/g, '').replace(/```/g, '');
  }
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

  return protaArray;
}

export async function generateModulAjarClient(
  selectedAtp: string[],
  selectedGrade: number,
  totalJp: number,
  pertemuan: number,
  profile: any,
  karakteristik: string,
  apiKey?: string | null,
  studentCount?: number
): Promise<any> {
  const ai = getAI(apiKey);

  const studentInfoStr = studentCount !== undefined && studentCount > 0
    ? `${studentCount} Peserta Didik`
    : `[DIISI OLEH GURU] Peserta Didik`;

  const prompt = `Bertindaklah sebagai Tim Ahli Kurikulum Pendidikan Indonesia yang terdiri atas:
1. Ahli Kurikulum Kemendikdasmen
2. Pengembang Modul Ajar
3. Pengembang Kurikulum Merdeka
4. Pengembang Pembelajaran Mendalam (Deep Learning)
5. Pengawas Sekolah
6. Asesor Akreditasi Sekolah
7. Guru Inti Nasional
8. Editor Bahasa Indonesia
9. Desainer Dokumen Pendidikan

Anda memiliki pengalaman lebih dari 20 tahun dalam menyusun perangkat ajar SD.

Gunakan Bahasa Indonesia baku, profesional, jelas, dan mudah dipahami guru SD.
Hasil yang dibuat Wajib MODUL AJAR LENGKAP (SANGAT RINCI, BUKAN RINGKASAN), runtut, dan siap cetak/dipindahkan ke Word.
Jika data belum lengkap, gunakan placeholder [DIISI OLEH GURU] secara jelas. Jangan mengarang data yang belum diberikan.

LANDASAN PENYUSUNAN:
1. Permendikdasmen Nomor 13 Tahun 2025
2. Capaian Pembelajaran (CP) PAIBP Kelas ${selectedGrade} SD (Fase ${selectedGrade <= 2 ? 'A' : selectedGrade <= 4 ? 'B' : 'C'})
3. Prinsip Pembelajaran Mendalam (Deep Learning)
4. 8 Dimensi Profil Lulusan
5. Prinsip 8,3,3,4
6. Kurikulum Merdeka
7. KURIKULUM BERBASIS CINTA (KBC) untuk PAIBP SD

5 TEMA UTAMA KURIKULUM BERBASIS CINTA (KBC) YANG WAJIB DIINTEGRASIKAN:
1. Cinta Allah dan Rasul-Nya
2. Cinta Ilmu
3. Cinta Lingkungan
4. Cinta Diri dan Sesama
5. Cinta Tanah Air

INFORMASI MASUKAN:
- Kelas: ${selectedGrade} SD (Fase ${selectedGrade <= 2 ? 'A' : selectedGrade <= 4 ? 'B' : 'C'})
- Guru: ${profile?.namaGuru || '[DIISI OLEH GURU]'}
- Sekolah: ${profile?.namaSekolah || '[DIISI OLEH GURU]'}
- Tahun Pelajaran: ${profile?.tahunPelajaran || '2024/2025'}
- Total Alokasi Waktu: ${totalJp} JP (${pertemuan} Pertemuan x 35 Menit)
- Karakteristik Peserta Didik: ${karakteristik || 'Reguler/Tipikal'}
- Target Peserta Didik: ${studentInfoStr} Kelas ${selectedGrade} ${profile?.namaSekolah || ''} (${karakteristik || 'Reguler/Tipikal'})
- ATP yang dipilih:
${selectedAtp.map((atp: string, i: number) => `${i + 1}. ${atp}`).join('\n')}

PRINSIP INSERSI KBC DALAM MODUL:
1. Seluruh modul harus menyatu dengan pembelajaran mendalam (8,3,3,4) dan Kurikulum Berbasis Cinta (KBC).
2. KBC tidak boleh hanya disebut di satu bagian, tetapi harus diinsersi ke SELURUH komponen modul (Tujuan, Kegiatan, Asesmen, Rubrik, Refleksi, LKPD, Lampiran).
3. MODEL, PENDEKATAN, METODE, MEDIA: Tentukan HANYA 1 model utama (misal: PBL/PJBL/Discovery), HANYA 1 pendekatan utama (misal: TaRL/CRT/Saintifik), HANYA 1 metode dominan, HANYA 1 media utama.

ATURAN MUTLAK AKOMODASI SELURUH ATP & JUMLAH PERTEMUAN:
- PENGGUNA MEMILIH TEPAT ${selectedAtp.length} ATP DAN TOTAL ${pertemuan} PERTEMUAN.
- SELURUH ${selectedAtp.length} ATP YANG DIPILIH HARUS DIBAHAS DAN DIAKOMODASI SECARA LENGKAP PADA SELURUH KOMPONEN MODUL AJAR (Identitas, TP, ATP, Langkah Pembelajaran, Asesmen, LKPD, dst.).
- PADA SECTION identitas.materi: Wajib mencakup dan menyebutkan seluruh topik dari ${selectedAtp.length} ATP yang dipilih.
- PADA SECTION identitas.target: Wajib mencantumkan tepat "${studentInfoStr} Kelas ${selectedGrade} ${profile?.namaSekolah || ''} (${karakteristik || 'Reguler/Tipikal'})". DILARANG KERAS mengarang angka acak lain!
- PADA SECTION komponenInti.tp DAN komponenInti.atp: Wajib membreakdown seluruh ${selectedAtp.length} ATP secara terstruktur.
- PADA SECTION langkahPembelajaran: HARUS MEMILIKI TEPAT ${pertemuan} OBJEK PERTEMUAN (Pertemuan 1, Pertemuan 2, ... hingga Pertemuan ${pertemuan}).
- DILARANG HANYA MENAMPILKAN 1 PERTEMUAN ATAU HANYA MEMBREAKDOWN 1 ATP JIKA PENGGUNA MEMILIH LEBIH DARI 1 ATP/PERTEMUAN!
- Setiap pertemuan dalam langkahPembelajaran harus secara eksplisit menguraikan alur pendahuluan, kegiatan inti (sesuai ATP pada pertemuan tersebut), dan penutup.

STRUKTUR MODUL AJAR YANG HARUS DIHASILKAN (23 KOMPONEN DALAM FORMAT JSON):

Hasilkan HANYA output berupa objek JSON valid (tanpa markdown format codeblock, tanpa teks pengantar) dengan struktur berikut:

{
  "cover": {
    "judul": "MODUL AJAR PAI DAN BUDI PEKERTI SD BERBASIS PERMENDIKDASMEN 13 TAHUN 2025 DAN KURIKULUM BERBASIS CINTA (KBC)",
    "penegasan": "Disusun dengan Semangat Kurikulum Berbasis Cinta (KBC)"
  },
  "identitas": {
    "elemen": "...",
    "materi": "Materi lengkap yang mencakup seluruh ${selectedAtp.length} ATP yang dipilih...",
    "model": "...",
    "pendekatan": "...",
    "metode": "...",
    "media": "...",
    "sumber": "...",
    "karakteristik": "${karakteristik || 'Reguler/Tipikal'}",
    "target": "...",
    "sarana": "...",
    "integrasiKbc": "Uraian integrasi nilai-nilai Kurikulum Berbasis Cinta...",
    "temaKbcUtama": "Tentukan 1 atau kombinasi tema KBC utama (Cinta Allah & Rasul/Cinta Ilmu/Cinta Lingkungan/Cinta Diri & Sesama/Cinta Tanah Air)",
    "nilaiKarakter": "Nilai karakter spesifik KBC yang ditumbuhkan..."
  },
  "cp": {
    "deskripsi": "Deskripsi CP PAI BP yang relevan...",
    "keterkaitanKbc": "Penjelasan rinci keterkaitan Capaian Pembelajaran dengan Tema KBC..."
  },
  "komponenInti": {
    "cp": "...",
    "tp": "Tujuan Pembelajaran rinci yang mencakup SELURUH ${selectedAtp.length} ATP yang dipilih dengan KKO terukur dan nilai KBC...",
    "atp": "Alur Tujuan Pembelajaran bertahap dari ATP ke-1 hingga ATP ke-${selectedAtp.length} yang menguatkan KBC...",
    "pemahamanBermakna": "Manfaat nyata pembelajaran di rumah, sekolah, masyarakat, dan lingkungan...",
    "pertanyaanPemantik": [
      "Pertanyaan 1 (berpikir kritis & rasa syukur)",
      "Pertanyaan 2 (empati & kasih sayang)",
      "Pertanyaan 3 (tanggung jawab & adab)",
      "Pertanyaan 4 (praktik cinta lingkungan/sesama)",
      "Pertanyaan 5 (perilaku cinta Allah & Rasul secara nyata)"
    ]
  },
  "pemetaanKbc": [
    {
      "tema": "Tema KBC",
      "materiKegiatan": "Integrasi pada materi & kegiatan pembelajaran seluruh ATP",
      "pembiasaanKarakter": "Bentuk pembiasaan adab & karakter peserta didik"
    }
  ],
  "diagnostik": {
    "deskripsi": "Deskripsi asesmen diagnostik...",
    "instrumenKognitif": "Instrumen diagnostik kognitif...",
    "instrumenNonKognitif": "Instrumen diagnostik non-kognitif (menggali kebiasaan baik, adab, kepedulian, kemandirian, dan kesiapan sikap)..."
  },
  "pembelajaranMendalam": "Penjelasan rinci implementasi 8 Dimensi Profil Lulusan, 3 Prinsip (Mindful, Meaningful, Joyful Learning), 3 Pengalaman (Memahami, Mengaplikasi, Merefleksi), dan 4 Kerangka Pembelajaran (Praktik Pedagogis, Kemitraan, Lingkungan, Teknologi Digital) yang terintegrasi KBC...",
  "langkahPembelajaran": [
    // PENTING: Array ini HARUS berisi TEPAT ${pertemuan} objek (Pertemuan 1 sampai Pertemuan ${pertemuan}).
    // PASTIKAN Anda membuat objek untuk SETIAP PERTEMUAN. JANGAN HANYA MEMBUAT 1 JIKA PERTEMUAN > 1!
    ${Array.from({ length: pertemuan }).map((_, i) => `{
      "pertemuan": ${i + 1},
      "waktu": "${totalJp / pertemuan} JP x 35 Menit",
      "pendahuluan": "Rinci aktivitas pembukaan Pertemuan ${i + 1}, doa bersama dengan adab rasa cinta Allah, apersepsi, penyampaian tujuan (ATP ke-${i + 1})...",
      "inti": "Aktivitas guru dan peserta didik rinci untuk ATP ke-${i + 1}...",
      "penutup": "Rinci kegiatan penutup Pertemuan ${i + 1}..."
    }`).join(',\n    ')}
  ],
  "asesmen": {
    "jenis": "Diagnostik, Formatif, dan Sumatif",
    "deskripsi": "Uraian pelaksanaan asesmen yang selaras dengan KBC...",
    "instrumen": "Bentuk instrumen (Observasi, Kinerja, Produk, Tes Tertulis/Lisan, Praktik, Portofolio)...",
    "rubrik": "Deskripsi rubrik penilaian sikap, pengetahuan, dan keterampilan KBC..."
  },
  "pengayaanRemedial": {
    "pengayaan": "Kegiatan pengayaan lengkap untuk memperluas pengalaman mempraktikkan nilai cinta secara nyata...",
    "remedial": "Kegiatan remedial lengkap untuk membantu pemahaman & pembiasaan sikap baik..."
  },
  "refleksi": {
    "guru": [
      "Soal refleksi guru 1...", "Soal 2...", "Soal 3...", "Soal 4...", "Soal 5...",
      "Soal 6...", "Soal 7...", "Soal 8...", "Soal 9...", "Soal 10 (fokus pada keterlaksanaan integrasi KBC)..."
    ],
    "siswa": [
      "Pertanyaan refleksi siswa 1...", "Pertanyaan 2...", "Pertanyaan 3...", "Pertanyaan 4...", "Pertanyaan 5...",
      "Pertanyaan 6...", "Pertanyaan 7...", "Pertanyaan 8...", "Pertanyaan 9...", "Pertanyaan 10 (fokus rasa senang & praktik nilai cinta)..."
    ]
  },
  "lkpd": {
    "judul": "Lembar Kerja Peserta Didik Berbasis Cinta",
    "tujuan": "...",
    "petunjuk": "...",
    "alat": "...",
    "langkah": ["Langkah 1...", "Langkah 2..."],
    "tugas": "...",
    "soal": ["Soal 1...", "Soal 2..."],
    "ruangJawaban": "Tempat peserta didik menuliskan jawaban dan komitmen perilaku cinta..."
  },
  "bacaanGlosariumPustaka": {
    "bacaanGuru": "...",
    "bacaanSiswa": "...",
    "glosarium": "Glosarium istilah penting dan istilah KBC...",
    "pustaka": "Daftar pustaka resmi..."
  },
  "lampiran": "Lampiran lengkap memuat Lembar Observasi Sikap KBC, Jurnal Mengajar, Rubrik Penilaian, Instrumen Diagnostik, dan Bank Soal...",
  "validasi": [
    { "aspek": "Kelengkapan Komponen Modul", "status": "Lengkap", "catatan": "Seluruh 23 komponen telah terpenuhi secara terstruktur." },
    { "aspek": "Kesesuaian Data Input", "status": "Sesuai", "catatan": "Sesuai dengan kelas, ATP, dan profil guru/sekolah." },
    { "aspek": "Penggunaan Placeholder", "status": "Tepat", "catatan": "Menggunakan [DIISI OLEH GURU] hanya jika data belum tersedia." },
    { "aspek": "Konsistensi Tujuan, Kegiatan, & Asesmen", "status": "Konsisten", "catatan": "Tujuan, langkah pembelajaran, dan asesmen saling terhubung erat." },
    { "aspek": "Insersi Kurikulum Berbasis Cinta (KBC)", "status": "Terintegrasi Penuh", "catatan": "KBC telah diinsersikan secara konsisten di seluruh bagian modul." }
  ],
  "outputSummary": {
    "komponenDipenuhi": [
      "Cover & Identitas Modul Berbasis KBC",
      "CP, TP, ATP, & Pemetaan Integrasi KBC",
      "Pemahaman Bermakna & 5 Pertanyaan Pemantik",
      "Diagnostik Kognitif & Non-Kognitif",
      "Pembelajaran Mendalam (Deep Learning 8,3,3,4)",
      "Langkah Pembelajaran Rinci per Pertemuan",
      "Asesmen Formatif & Sumatif dengan Rubrik Sikap KBC",
      "Pengayaan & Remedial Berbasis Pembiasaan Cinta",
      "10 Refleksi Guru & 10 Refleksi Siswa",
      "LKPD Siap Cetak Berbasis Cinta",
      "Bahan Bacaan, Glosarium KBC, & Daftar Pustaka",
      "Lampiran & Tabel Validasi Otomatis"
    ],
    "placeholderGuru": [
      "[DIISI OLEH GURU] - Nama Guru jika belum diisi di profil",
      "[DIISI OLEH GURU] - Nama Sekolah jika belum diisi di profil"
    ],
    "saranPenyempurnaan": "Dapat disesuaikan dengan media fisik lokal dan kondisi nyata di ruang kelas masing-masing sekolah.",
    "penegasanKbc": "Modul Ajar ini telah disusun secara utuh dengan mengintegrasikan 5 Tema Utama Kurikulum Berbasis Cinta (KBC) secara konsisten pada setiap komponen."
  }
}

PASTIKAN SELURUH DOKUMEN SANGAT LENGKAP, SIAP CETAK, BUKAN RINGKASAN.`;

  let text = '';
  let retries = 4;
  let delay = 2000;
  let modelIndex = 0;
  let usedModel = FALLBACK_MODELS[0];

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

      const parsed = JSON.parse(text);
      return parsed;
    } catch (error: any) {
      console.warn(`Gemini Modul Ajar Client Error (${retries} retries left, model: ${usedModel}):`, error);
      if (
        (error?.status === 429 || error?.message?.includes('429') ||
         error?.status === 'RESOURCE_EXHAUSTED' ||
         error?.status === 503 ||
         error?.status === 404 || error?.message?.includes('not found')) && retries > 1
      ) {
        modelIndex = (modelIndex + 1) % FALLBACK_MODELS.length;
        usedModel = FALLBACK_MODELS[modelIndex];
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 1.5;
        retries--;
      } else {
        throw error;
      }
    }
  }

  throw new Error("Gagal menghasilkan Modul Ajar setelah beberapa kali percobaan.");
}

function distributeSumatifDifficulty(total: number, pctLots: number, pctMots: number, pctHots: number) {
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

function sanitizeSumatifSvg(rawSvg?: string): string {
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

export async function generateSumatifClient(params: {
  grade: number;
  jenisSumatif: string;
  semesterLabel: string;
  judulAsesmen: string;
  protaItems: any[];
  config: any;
  profile: any;
  previousQuestionStems: string[];
  userApiKey?: string | null;
}) {
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
  } = params;

  const client = getAI(userApiKey);
  const jumlahPg = Math.max(0, Number(config?.jumlahPg ?? 15));
  const jumlahIsian = Math.max(0, Number(config?.jumlahIsian ?? 5));
  const jumlahUraian = Math.max(0, Number(config?.jumlahUraian ?? 5));

  const pctLots = Number(config?.komposisiLots ?? 30);
  const pctMots = Number(config?.komposisiMots ?? 40);
  const pctHots = Number(config?.komposisiHots ?? 30);

  const pgDist = distributeSumatifDifficulty(jumlahPg, pctLots, pctMots, pctHots);
  const isianDist = distributeSumatifDifficulty(jumlahIsian, pctLots, pctMots, pctHots);
  const uraianDist = distributeSumatifDifficulty(jumlahUraian, pctLots, pctMots, pctHots);

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

  let rawText = '';
  const models = ['gemini-2.5-flash', 'gemini-3.1-flash-lite', 'gemini-2.0-flash'];
  let retries = models.length + 1;
  let delay = 2000;
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
      console.warn(`Sumatif Client error (${retries} retries left, model: ${models[modelIdx]}):`, err);
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
    svgIllustration: includeIllustrations ? sanitizeSumatifSvg(item.svgIllustration) : '',
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
    svgIllustration: includeIllustrations ? sanitizeSumatifSvg(item.svgIllustration) : '',
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
      svgIllustration: includeIllustrations ? sanitizeSumatifSvg(item.svgIllustration) : '',
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

  return {
    kisiKisi,
    soalPg,
    soalIsian,
    soalUraian,
    rubrikUmum
  };
}
