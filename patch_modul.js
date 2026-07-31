import fs from 'fs';
let content = fs.readFileSync('src/pages/ModulAjar.tsx', 'utf8');

content = content.replace(/import \{ doc, getDoc \} from 'firebase\/firestore';\n/, "");
content = content.replace(/import \{ db \} from '\.\.\/lib\/firebase';\n/, "");

content = content.replace("const { user, profile, calendarData } = useStore();", "const { user, profile, calendarData, schedules: storeSchedules, savedProtas: storeProtas } = useStore();");

const replacementFetch = `    const fetchSchedulesAndProta = async () => {
      if (!user) return;
      
      if (Object.keys(storeSchedules).length > 0) {
        setSchedules(storeSchedules);
      }
      
      if (Object.keys(storeProtas).length > 0) {
        setSavedProtas(storeProtas);
      }
      
      setLoading(false);
    };`;
content = content.replace(/    const fetchSchedulesAndProta = async \(\) => \{[\s\S]*?    \};/, replacementFetch);

const replacementSync = `    setLoading(true);
    try {
      if (Object.keys(storeProtas).length > 0) {
        setSavedProtas(storeProtas);
      }
      setSelectedAtp([]);
    } catch (err) {`;
content = content.replace(/    setLoading\(true\);\n    try \{\n      const protaRef = doc\(db, 'protas', user\.uid\);\n      const protaSnap = await getDoc\(protaRef\);\n      if \(protaSnap\.exists\(\)\) \{\n        setSavedProtas\(protaSnap\.data\(\)\.data \|\| \{\}\);\n      \}\n      setSelectedAtp\(\[\]\);\n    \} catch \(err\) \{/, replacementSync);

fs.writeFileSync('src/pages/ModulAjar.tsx', content);
