import fs from 'fs';
let content = fs.readFileSync('src/store/useStore.ts', 'utf8');

const replacement = `      importData: (jsonData) => {
        try {
          const parsed = JSON.parse(jsonData);
          if (parsed && typeof parsed === 'object' && parsed.state) {
             set({
               usersData: parsed.state.usersData,
               currentUser: null,
               user: null,
               profile: null,
               calendarData: null,
               schedules: {},
               savedProtas: {}
             });
             alert('Data berhasil dipulihkan! Silakan masuk kembali.');
          } else {
             alert('Format file backup tidak valid.');
          }
        } catch (e) {
          console.error('Failed to parse backup data', e);
          alert('Gagal memproses file backup.');
        }
      }`;
      
content = content.replace(/      importData: \(jsonData\) => \{[\s\S]*?      \}/, replacement);
fs.writeFileSync('src/store/useStore.ts', content);
