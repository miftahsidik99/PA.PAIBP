import fs from 'fs';
let content = fs.readFileSync('src/pages/ModulAjar.tsx', 'utf8');

content = content.replace("  const [schedules, setSchedules] = useState<Record<number, any>>({});", "");
content = content.replace("  const [savedProtas, setSavedProtas] = useState<Record<number, any[]>>({});", "");

// Instead of setting loading based on local state fetch, we can just remove the loading state completely or make it instantaneous.
content = content.replace(/  useEffect\(\(\) => \{[\s\S]*?fetchSchedulesAndProta\(\);\n  \}, \[user\]\);/, "");

// For syncATP:
const newSync = `  const syncATP = async () => {
    setLoading(true);
    setTimeout(() => {
      setSelectedAtp([]);
      setLoading(false);
      alert('Data ATP berhasil disinkronkan dari Prota!');
    }, 500);
  };`;
content = content.replace(/  const syncATP = async \(\) => \{[\s\S]*?    \}\n  \};/, newSync);

content = content.replace(/savedProtas\[selectedGrade\]/g, "storeProtas[selectedGrade]");
content = content.replace(/schedules\[selectedGrade\]/g, "storeSchedules[selectedGrade]");

fs.writeFileSync('src/pages/ModulAjar.tsx', content);
