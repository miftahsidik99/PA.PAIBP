import fs from 'fs';
let content = fs.readFileSync('src/pages/ModulAjar.tsx', 'utf8');

if (!content.includes('import { GoogleGenAI }')) {
    content = content.replace("import Layout from '../components/Layout';", "import Layout from '../components/Layout';\nimport { GoogleGenAI } from '@google/genai';");
}

content = content.replace("const { user, profile", "const { user, profile, geminiApiKey");

const replacementGenerate = `  const generateModulAjar = async () => {
    if (selectedAtp.length === 0) return;
    
    if (!geminiApiKey) {
      alert("API Key Gemini belum diatur. Silakan atur di menu 'Pengaturan API' di sidebar kiri.");
      return;
    }

    const jpPerWeek = schedules[selectedGrade]?.jp || 4;
    const totalJp = selectedAtp.length * jpPerWeek;
    const pertemuan = selectedAtp.length;
    setIsGeneratingModul(true);
    
    try {
      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      const prompt = \`Anda adalah seorang ahli pendidikan yang bertugas menyusun Modul Ajar PAI dan Budi Pekerti Kelas \${selectedGrade} SD berdasarkan Permendikdasmen No. 13 Tahun 2025.

Alur Tujuan Pembelajaran (ATP) yang dipilih:
\${selectedAtp.map((atp: string, i: number) => \`\${i+1}. \${atp}\`).join('\\n')}

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
}\`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      let text = response.text || '';
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
      
      const data = JSON.parse(text);

      const headerShading = {`;

content = content.replace(/  const generateModulAjar = async \(\) => \{[\s\S]*?      const headerShading = \{/, replacementGenerate);
fs.writeFileSync('src/pages/ModulAjar.tsx', content);
