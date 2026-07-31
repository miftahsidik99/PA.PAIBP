import fs from 'fs';
let content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

const replacement = `  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };`;

content = content.replace(/  const handleChange = \(e: React\.ChangeEvent<HTMLInputElement>\) => \{[\s\S]*?  \};/, replacement);

const replacement2 = `  const [formData, setFormData] = useState({
    namaGuru: profile?.namaGuru || '',
    nip: profile?.nip || '',
    namaSekolah: profile?.namaSekolah || '',
    npsn: profile?.npsn || '',
    namaKepalaSekolah: profile?.namaKepalaSekolah || '',
    nipKepalaSekolah: profile?.nipKepalaSekolah || '',
  });`;
content = content.replace(/  const \[formData, setFormData\] = useState\(\{[\s\S]*?    nipKepalaSekolah: profile\?\.nipKepalaSekolah \|\| '',/, replacement2);


fs.writeFileSync('src/pages/Dashboard.tsx', content);
