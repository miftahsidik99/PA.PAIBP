import fs from 'fs';
let content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

const replacement = `  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      if (profile) {
        setProfile({ ...profile, ...formData });
      }
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update profile", error);
      alert("Gagal memperbarui profil.");
    } finally {
      setIsSaving(false);
    }
  };`;

content = content.replace(/  const handleSave = async \(\) => \{[\s\S]*?  \};/, replacement);
fs.writeFileSync('src/pages/Dashboard.tsx', content);
