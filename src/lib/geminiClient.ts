import { GoogleGenAI } from '@google/genai';

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
  apiKey?: string | null
): Promise<any> {
  const ai = getAI(apiKey);

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
