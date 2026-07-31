import fs from 'fs';
let content = fs.readFileSync('src/store/useStore.ts', 'utf8');
content = content.replace("  importData: (jsonData: string) => void;\n}", "  importData: (jsonData: string) => void;\n  geminiApiKey: string | null;\n  setGeminiApiKey: (key: string) => void;\n}");
content = content.replace("      savedProtas: {},\n\n      login", "      savedProtas: {},\n      geminiApiKey: null,\n      setGeminiApiKey: (key) => set({ geminiApiKey: key }),\n\n      login");
fs.writeFileSync('src/store/useStore.ts', content);
