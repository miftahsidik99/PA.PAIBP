import fs from 'fs';
let content = fs.readFileSync('src/components/Layout.tsx', 'utf8');

if (!content.includes('import ApiKeyModal')) {
    content = content.replace("import { Link, useLocation } from 'react-router-dom';", "import { Link, useLocation } from 'react-router-dom';\nimport ApiKeyModal from './ApiKeyModal';\nimport { Key } from 'lucide-react';\nimport { useState } from 'react';");
}

if (!content.includes('isApiModalOpen')) {
    content = content.replace("const handleLogout = () => {", "const [isApiModalOpen, setIsApiModalOpen] = useState(false);\n  const handleLogout = () => {");
}

if (!content.includes('Pengaturan API')) {
    const btn = `          <button
            onClick={() => setIsApiModalOpen(true)}
            className="flex items-center w-full px-4 py-2 text-sm font-medium text-slate-600 rounded-xl hover:bg-white/40 transition-colors"
          >
            <Key className="mr-3 h-4 w-4 text-slate-400" />
            Pengaturan API
          </button>
          <input`;
    content = content.replace("<input", btn);
}

if (!content.includes('<ApiKeyModal')) {
    content = content.replace("</main>\n    </div>", "</main>\n      <ApiKeyModal isOpen={isApiModalOpen} onClose={() => setIsApiModalOpen(false)} />\n    </div>");
}

fs.writeFileSync('src/components/Layout.tsx', content);
