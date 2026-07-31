const fs = require('fs');
let content = fs.readFileSync('src/pages/Onboarding.tsx', 'utf8');
content = content.replace("await setDoc(doc(db, 'user_profiles', user.uid), profileData);", "");
fs.writeFileSync('src/pages/Onboarding.tsx', content);
