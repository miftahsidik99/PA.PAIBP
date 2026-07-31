import fs from 'fs';
let content = fs.readFileSync('src/pages/AcademicCalendar.tsx', 'utf8');
content = content.replace(/import \{ doc, getDoc, setDoc \} from 'firebase\/firestore';\n/, "");
content = content.replace(/import \{ db \} from '\.\.\/lib\/firebase';\n/, "");

const replacementFetch = `      if (!user) return;
      try {
        if (calendarData) {
          setAcademicYear(calendarData.academicYear || '2026/2027');
          setWeeklyDays(calendarData.weeklyDays || 5);
          setEvents1to5(calendarData.events1to5 || {});
          setEvents6(calendarData.events6 || {});
        } else {`;
content = content.replace(/      if \(!user\) return;\n      try \{\n        const docRef = doc\(db, 'academic_calendar', user\.uid\);\n        const docSnap = await getDoc\(docRef\);\n        if \(docSnap\.exists\(\)\) \{\n          const data = docSnap\.data\(\);\n          setAcademicYear\(data\.academicYear \|\| '2026\/2027'\);\n          setWeeklyDays\(data\.weeklyDays \|\| 5\);\n          setEvents1to5\(data\.events1to5 \|\| \{\}\);\n          setEvents6\(data\.events6 \|\| \{\}\);\n          setCalendarData\(data as any\);\n        \} else \{/, replacementFetch);

const replacementSave = `      };
      
      setCalendarData(data);
      alert('Kalender akademik berhasil disimpan!');
    } catch (error) {`;
content = content.replace(/      \};\n      \n      await setDoc\(doc\(db, 'academic_calendar', user\.uid\), data\);\n      setCalendarData\(data\);\n      alert\('Kalender akademik berhasil disimpan!'\);\n    \} catch \(error\) \{/, replacementSave);

fs.writeFileSync('src/pages/AcademicCalendar.tsx', content);
