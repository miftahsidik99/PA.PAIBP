import express from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// API Route to generate ATP using Gemini (Batch)
app.post('/api/generate-atp-batch', async (req, res) => {
    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY belum ditambahkan di Environment Variables Vercel! Silakan tambahkan GEMINI_API_KEY di setting Vercel Anda.");
      }

      const { gradeCp, jpPerWeek, totalMeetings } = req.body;
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
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
      let retries = 3;
      let delay = 2000;
      let usedModel = 'gemini-1.5-flash'; 
      
      while (retries > 0) {
        try {
          const response = await ai.models.generateContent({
            model: usedModel,
            contents: prompt,
          });
          text = response.text || "[]";
          break;
        } catch (err: any) {
          if (err?.status === 'RESOURCE_EXHAUSTED' || err?.status === 429 || err?.message?.includes('429') || err?.status === 503 || err?.message?.includes('503')) {
            retries--;
            if (retries === 0) throw err;
            console.log(`Rate limit or 503 hit on ${usedModel}. Retrying in ${delay/1000}s...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2;
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
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY belum ditambahkan di Environment Variables Vercel! Silakan tambahkan GEMINI_API_KEY di setting Vercel Anda.");
      }

      const { atps, grade } = req.body;
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const prompt = `
Anda adalah seorang ahli pendidikan yang bertugas menyusun Modul Ajar PAI dan Budi Pekerti Kelas ${grade} SD berdasarkan Permendikdasmen No. 13 Tahun 2025.
Alur Tujuan Pembelajaran (ATP) yang dipilih:
${atps.map((atp: string, i: number) => `${i+1}. ${atp}`).join('\n')}

Buatlah konten Modul Ajar yang menerapkan konsep 8,3,3,4:
- 8 Profil Lulusan (Beriman bertakwa, Berakhlak mulia, Mandiri, Bernalar kritis, Kreatif, Bergotong royong, Berkebinekaan global, Sehat jasmani rohani)
- 3 Prinsip Pembelajaran (Mindfull learning, Joy full learning, Meaning full learning)
- 3 Pengalaman Belajar (Memahami, Mengaplikasi, Merefleksi)
- 4 Kerangka Pembelajaran (Praktik pedagogis, Kemitraan pembelajaran, Lingkungan pembelajaran, Pemanfaatan teknologi digital)

Format balasan berupa JSON dengan struktur persis seperti berikut (Hanya output JSON, tanpa markdown code block, tanpa teks pengantar):
{
  "tujuanPembelajaran": "Tujuan utama pembelajaran berdasarkan ATP",
  "profilLulusan": ["Pilih 3-4 profil lulusan yang paling relevan dengan materi ini"],
  "prinsipPembelajaran": {
    "mindfullLearning": "Deskripsi penerapan mindfull learning (kesadaran penuh)",
    "joyfullLearning": "Deskripsi penerapan joy full learning (pembelajaran menyenangkan)",
    "meaningfullLearning": "Deskripsi penerapan meaning full learning (pembelajaran bermakna)"
  },
  "pengalamanBelajar": {
    "memahami": "Deskripsi kegiatan untuk memahami materi",
    "mengaplikasi": "Deskripsi kegiatan untuk mengaplikasikan materi",
    "merefleksi": "Deskripsi kegiatan untuk merefleksikan materi"
  },
  "kerangkaPembelajaran": {
    "praktikPedagogis": "Strategi dan pendekatan pedagogis yang digunakan",
    "kemitraanPembelajaran": "Kemitraan pembelajaran yang dibangun (kemitraan belajar)",
    "lingkunganPembelajaran": "Kondisi lingkungan belajar yang dibangun",
    "pemanfaatanTeknologiDigital": "Penggunaan alat atau media digital yang relevan"
  },
  "lkpd": {
    "judul": "Judul Lembar Kerja Peserta Didik",
    "tujuan": "Tujuan LKPD",
    "alatBahan": "Alat dan bahan yang dibutuhkan",
    "langkahKerja": ["Langkah 1", "Langkah 2"],
    "soalTugas": ["Soal atau tugas 1", "Soal atau tugas 2"]
  }
}
`;

      let text = '';
      let retries = 3;
      let delay = 2000;
      let usedModel = 'gemini-1.5-flash'; 
      
      while (retries > 0) {
        try {
          const response = await ai.models.generateContent({
            model: usedModel,
            contents: prompt,
          });
          
          text = response.text || '';
          if (text.startsWith('\`\`\`json')) {
            text = text.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '');
          }
          text = text.trim();
          if (text.endsWith('\`\`\`')) {
            text = text.slice(0, -3).trim();
          }
          if (!text.startsWith('{')) {
             text = text.substring(text.indexOf('{'));
          }
          if (!text.endsWith('}')) {
             text = text.substring(0, text.lastIndexOf('}') + 1);
          }
          
          JSON.parse(text); 
          break;
        } catch (error: any) {
          console.error(`Gemini Modul Ajar Error (${retries} retries left, model: ${usedModel}):`, error);
          if ((error?.status === 429 || error?.status === 503 || error?.message?.includes('429') || error?.message?.includes('503') || error?.status === 'RESOURCE_EXHAUSTED') && retries > 1) {
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

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
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

// Only start the server if we are not running on Vercel
if (!process.env.VERCEL) {
  startServer();
}

// Export the app for Vercel
export default app;
