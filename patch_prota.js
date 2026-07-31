import fs from 'fs';
let content = fs.readFileSync('src/pages/Prota.tsx', 'utf8');

const regex = /  const handleGenerate = async \(\) => \{[\s\S]*?    \} catch \(error\) \{[\s\S]*?      console.error\(error\);\n    \}\n  \};/;

const replacementGenerate = `  const handleGenerate = async () => {
    const gradeCp = cpData[selectedGrade as keyof typeof cpData];
    if (!gradeCp) return;
    
    if (!schedules[selectedGrade] || !schedules[selectedGrade].day) {
      alert("Silakan atur Jadwal Hari Mengajar terlebih dahulu di menu Jadwal untuk mendapatkan rentang tanggal yang akurat selama setahun.");
      return;
    }
    
    if (!geminiApiKey) {
      alert("API Key Gemini belum diatur. Silakan atur di menu 'Pengaturan API' di sidebar kiri.");
      return;
    }

    setGenerating(true);
    try {
      const jpPerWeek = schedules[selectedGrade]?.jp || 4;
      const totalMeetings = getEffectiveDates().length;
      
      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      const prompt = \`Anda adalah seorang ahli pendidikan yang bertugas menyusun Program Tahunan (Prota) PAI dan Budi Pekerti Kelas \${selectedGrade} SD berdasarkan Permendikdasmen No. 13 Tahun 2025 (Pengganti Kurikulum Merdeka).
Capaian Pembelajaran dan Tujuan Pembelajaran Kelas \${selectedGrade}:
\${gradeCp.map(item => \`
Elemen: \${item.elemen}
CP: \${item.cp}
TP:
\${item.tp.map((t: string, i: number) => \`  \${i + 1}. \${t}\`).join('\\n')}\`).join('\\n')}

Tugas:
Pecah setiap Tujuan Pembelajaran di atas menjadi Alur Tujuan Pembelajaran (ATP) yang lebih rinci untuk alokasi waktu satu tahun ajaran penuh (Semester 1 dan Semester 2).
Setiap ATP akan dipelajari dalam 1 pertemuan (\${jpPerWeek} JP).

ATURAN SANGAT PENTING (WAJIB DIIKUTI):
1. TOTAL SELURUH ATP DARI SEMUA ELEMEN JIKA DIJUMLAHKAN HARUS SAMA PERSIS DENGAN \${totalMeetings} ATP!
2. Anda memiliki \${gradeCp.length} elemen. Jika total target adalah \${totalMeetings}, maka rata-rata setiap elemen harus memiliki sekitar \${Math.round(totalMeetings / gradeCp.length)} ATP di dalam array "atp"-nya.
3. Distribusikan materi dari Semester 1 hingga Semester 2 secara logis dan berurutan.
4. JANGAN menghasilkan lebih sedikit atau lebih banyak dari \${totalMeetings} ATP secara keseluruhan. Hitung dengan teliti!

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
Jangan ada teks apa pun selain JSON yang valid. Jangan gunakan tag markdown \`\`\`json.\`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      
      let text = response.text || "[]";
      if (text.startsWith('\`\`\`json')) {
        text = text.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '');
      }
      text = text.trim();
      if (text.endsWith('\`\`\`')) {
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

      setProtaData(protaArray);
    } catch (error) {
      console.error(error);
      alert('Gagal menghasilkan Prota: ' + (error as any).message);
    } finally {
      setGenerating(false);
    }
  };`;

content = content.replace(regex, replacementGenerate);
fs.writeFileSync('src/pages/Prota.tsx', content);
