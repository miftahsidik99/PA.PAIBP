import fs from 'fs';
let content = fs.readFileSync('src/pages/Prota.tsx', 'utf8');

content = content.replace(/import \{ doc, getDoc, setDoc \} from 'firebase\/firestore';\n/, "");
content = content.replace(/import \{ db \} from '\.\.\/lib\/firebase';\n/, "");

content = content.replace("const { user, calendarData, setCalendarData } = useStore();", "const { user, calendarData, schedules: storeSchedules, savedProtas: storeProtas, setSavedProtas: setStoreProtas } = useStore();");

const replacementFetch = `    const fetchSchedulesAndProta = async () => {
      if (!user) return;
      
      if (Object.keys(storeSchedules).length > 0) {
        setSchedules(storeSchedules);
      }
      
      if (Object.keys(storeProtas).length > 0) {
        setSavedProtas(storeProtas);
        if (storeProtas[1]) {
          setProtaData(storeProtas[1]);
        }
      }
      
      setLoading(false);
    };`;
content = content.replace(/    const fetchSchedulesAndProta = async \(\) => \{[\s\S]*?    \};/, replacementFetch);

const replacementSave = `    try {
      const newData = { ...savedProtas, [selectedGrade]: protaData };
      setStoreProtas(newData);
      setSavedProtas(newData);
      alert('Program Tahunan berhasil disimpan!');
    } catch (error) {`;
content = content.replace(/    try \{\n      const newData = \{ \.\.\.savedProtas, \[selectedGrade\]: protaData \};\n      await setDoc\(doc\(db, 'protas', user\.uid\), \{\n        uid: user\.uid,\n        data: newData,\n        updatedAt: new Date\(\)\n      \}\);\n      setSavedProtas\(newData\);\n      alert\('Program Tahunan berhasil disimpan!'\);\n    \} catch \(error\) \{/, replacementSave);

fs.writeFileSync('src/pages/Prota.tsx', content);
