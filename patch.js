import fs from 'fs';
let content = fs.readFileSync('src/pages/Onboarding.tsx', 'utf8');
content = content.replace("await setDoc(doc(db, 'user_profiles', user.uid), profileData);", "");
fs.writeFileSync('src/pages/Onboarding.tsx', content);

content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');
content = content.replace(/import \{ doc, updateDoc \} from 'firebase\/firestore';\n/, "");
content = content.replace(/import \{ db \} from '\.\.\/lib\/firebase';\n/, "");
content = content.replace("const profileRef = doc(db, 'user_profiles', user.uid);", "");
content = content.replace("await updateDoc(profileRef, {", "");
content = content.replace("...formData,", "");
content = content.replace("updatedAt: new Date(),", "");
content = content.replace("});", "");
fs.writeFileSync('src/pages/Dashboard.tsx', content);
