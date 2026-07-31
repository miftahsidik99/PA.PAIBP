import fs from 'fs';
let content = fs.readFileSync('src/pages/EffectiveDays.tsx', 'utf8');

content = content.replace(/import \{ doc, getDoc \} from 'firebase\/firestore';\n/, "");
content = content.replace(/import \{ db \} from '\.\.\/lib\/firebase';\n/, "");

content = content.replace("const { user, calendarData } = useStore();", "const { user, calendarData, schedules: storeSchedules } = useStore();");

const replacementFetch = `    const fetchSchedules = async () => {
      if (!user) return;
      if (Object.keys(storeSchedules).length > 0) {
        setSchedules(storeSchedules);
      }
      
      setLoading(false);
    };`;
content = content.replace(/    const fetchSchedules = async \(\) => \{[\s\S]*?    \};/, replacementFetch);

fs.writeFileSync('src/pages/EffectiveDays.tsx', content);
