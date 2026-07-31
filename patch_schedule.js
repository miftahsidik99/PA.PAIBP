import fs from 'fs';
let content = fs.readFileSync('src/pages/Schedule.tsx', 'utf8');

content = content.replace(/import \{ doc, getDoc, setDoc \} from 'firebase\/firestore';\n/, "");
content = content.replace(/import \{ db \} from '\.\.\/lib\/firebase';\n/, "");

content = content.replace("const { user } = useStore();", "const { user, schedules: storeSchedules, setSchedules: setStoreSchedules } = useStore();");

const replacementFetch = `    const fetchSchedules = async () => {
      if (!user) return;
      if (Object.keys(storeSchedules).length > 0) {
        setSchedules(storeSchedules);
      }
      setLoading(false);
    };`;
content = content.replace(/    const fetchSchedules = async \(\) => \{[\s\S]*?    \};/, replacementFetch);

const replacementSave = `    setSaving(true);
    try {
      setStoreSchedules(schedules);
      alert('Jadwal berhasil disimpan!');
    } catch (error) {`;
content = content.replace(/    setSaving\(true\);\n    try \{\n      await setDoc\(doc\(db, 'teaching_schedules', user\.uid\), \{\n        uid: user\.uid,\n        schedules,\n        updatedAt: new Date\(\)\n      \}\);\n      alert\('Jadwal berhasil disimpan!'\);\n    \} catch \(error\) \{/, replacementSave);

fs.writeFileSync('src/pages/Schedule.tsx', content);
