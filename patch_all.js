import fs from 'fs';

// 1. Layout.tsx
let layout = fs.readFileSync('src/components/Layout.tsx', 'utf8');
layout = "import React from 'react';\n" + layout;
fs.writeFileSync('src/components/Layout.tsx', layout);

// 2. Dashboard.tsx
let dashboard = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');
dashboard = "import React from 'react';\n" + dashboard;
fs.writeFileSync('src/pages/Dashboard.tsx', dashboard);

// 3. AcademicCalendar.tsx
let ac = fs.readFileSync('src/pages/AcademicCalendar.tsx', 'utf8');
const replacementSave = `      };
      
      setCalendarData(data);
      alert('Kalender akademik berhasil disimpan!');
    } catch (error) {`;
ac = ac.replace(/      \};\n      await setDoc\(doc\(db, 'academic_calendar', user\.uid\), data\);\n      setCalendarData\(data\);\n      alert\('Kalender akademik berhasil disimpan!'\);\n    \} catch \(error\) \{/, replacementSave);
fs.writeFileSync('src/pages/AcademicCalendar.tsx', ac);

// 4. ModulAjar.tsx
let ma = fs.readFileSync('src/pages/ModulAjar.tsx', 'utf8');
ma = ma.replace("const { user, profile, calendarData } = useStore();", "const { user, profile, calendarData, schedules: storeSchedules, savedProtas: storeProtas } = useStore();");
fs.writeFileSync('src/pages/ModulAjar.tsx', ma);

