import fs from 'fs';
let content = fs.readFileSync('src/store/useStore.ts', 'utf8');

if (!content.includes('generatedModulAtps')) {
  // Update UserData interface
  content = content.replace(
    "  savedProtas: Record<number, any[]>;\n}",
    "  savedProtas: Record<number, any[]>;\n  generatedModulAtps: Record<number, string[]>;\n}"
  );

  // Update AppState interface
  content = content.replace(
    "  setSavedProtas: (protas: Record<number, any[]>) => void;\n",
    "  setSavedProtas: (protas: Record<number, any[]>) => void;\n  generatedModulAtps: Record<number, string[]>;\n  markAtpAsGenerated: (grade: number, atps: string[]) => void;\n"
  );

  // Update initialUserData
  content = content.replace(
    "  savedProtas: {}\n};",
    "  savedProtas: {},\n  generatedModulAtps: {}\n};"
  );

  // Update store defaults
  content = content.replace(
    "      savedProtas: {},\n      geminiApiKey: null,",
    "      savedProtas: {},\n      generatedModulAtps: {},\n      geminiApiKey: null,"
  );

  // Update login
  content = content.replace(
    "          savedProtas: userData.savedProtas,",
    "          savedProtas: userData.savedProtas,\n          generatedModulAtps: userData.generatedModulAtps || {},"
  );

  // Update logout
  content = content.replace(
    "          savedProtas: {},\n        });",
    "          savedProtas: {},\n          generatedModulAtps: {},\n        });"
  );

  // Add markAtpAsGenerated action
  const markAction = `
      markAtpAsGenerated: (grade, atps) => {
        const state = get();
        if (!state.currentUser) return;
        const currentGenerated = state.generatedModulAtps[grade] || [];
        const newGenerated = [...new Set([...currentGenerated, ...atps])];
        const newGeneratedModulAtps = { ...state.generatedModulAtps, [grade]: newGenerated };
        set({
          generatedModulAtps: newGeneratedModulAtps,
          usersData: {
            ...state.usersData,
            [state.currentUser]: { ...state.usersData[state.currentUser], generatedModulAtps: newGeneratedModulAtps }
          }
        });
      },`;

  content = content.replace(
    "      setSavedProtas: (savedProtas) => {",
    `${markAction}\n\n      setSavedProtas: (savedProtas) => {`
  );

  fs.writeFileSync('src/store/useStore.ts', content);
}
