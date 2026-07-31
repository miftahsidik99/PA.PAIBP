import fs from 'fs';
let content = fs.readFileSync('src/pages/ModulAjar.tsx', 'utf8');
content = content.replace("const { user, profile } = useStore();", "const { user, profile, schedules: storeSchedules, savedProtas: storeProtas } = useStore();");
fs.writeFileSync('src/pages/ModulAjar.tsx', content);
