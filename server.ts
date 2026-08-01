import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY!,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  app.use(express.json());

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
      let delay = 3000;
      let usedModel = 'gemini-3.6-flash'; 
      
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
          if (err?.status === 429 || err?.message?.includes('429') || err?.status === 503 || err?.message?.includes('503') || err?.status === 'RESOURCE_EXHAUSTED' || err?.status === 404 || err?.message?.includes('not found')) {
            retries--;
            if (retries === 0) throw err;
            
            // Cycle through stable models
            const fallbackModels = ['gemini-3.6-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
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
      let delay = 3000;
      let usedModel = 'gemini-3.6-flash'; 
      
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
          if ((error?.status === 429 || error?.message?.includes('429') || error?.status === 'RESOURCE_EXHAUSTED' || error?.status === 503 || error?.status === 404 || error?.message?.includes('not found')) && retries > 1) {
            // Cycle through stable models
            const fallbackModels = ['gemini-3.6-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
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
