import fs from 'fs';
let content = fs.readFileSync('src/pages/ModulAjar.tsx', 'utf8');

// Add markAtpAsGenerated and storeGeneratedAtps to useStore destructuring
content = content.replace(
  "const { user, profile, geminiApiKey, schedules: storeSchedules, savedProtas: storeProtas } = useStore();",
  "const { user, profile, geminiApiKey, schedules: storeSchedules, savedProtas: storeProtas, generatedModulAtps: storeGeneratedAtps = {}, markAtpAsGenerated } = useStore();"
);

// Call markAtpAsGenerated after doc generated successfully
content = content.replace(
  "      saveAs(blob, `Modul_Ajar_Kelas_${selectedGrade}.docx`);",
  "      saveAs(blob, `Modul_Ajar_Kelas_${selectedGrade}.docx`);\n      markAtpAsGenerated(selectedGrade, selectedAtp);"
);

// Add "No" column and modify table header
const oldThead = `<thead className="sticky top-0 bg-white/90 border-b border-slate-100 z-10">
                  <tr>
                    <th className="p-4 font-bold text-slate-400 uppercase tracking-widest w-16 text-center">Pilih</th>
                    <th className="p-4 font-bold text-slate-400 uppercase tracking-widest w-48">Elemen</th>
                    <th className="p-4 font-bold text-slate-400 uppercase tracking-widest">Alur Tujuan Pembelajaran</th>
                  </tr>
                </thead>`;

const newThead = `<thead className="sticky top-0 bg-white/90 border-b border-slate-100 z-10">
                  <tr>
                    <th className="p-4 font-bold text-slate-400 uppercase tracking-widest w-16 text-center">Pilih</th>
                    <th className="p-4 font-bold text-slate-400 uppercase tracking-widest w-12 text-center">No</th>
                    <th className="p-4 font-bold text-slate-400 uppercase tracking-widest w-48">Elemen</th>
                    <th className="p-4 font-bold text-slate-400 uppercase tracking-widest">Alur Tujuan Pembelajaran (Total: {allAtps.length} ATP)</th>
                  </tr>
                </thead>`;
content = content.replace(oldThead, newThead);

// Modify table body to include No column and generated indicator
const oldMap = `{allAtps.map((item, idx) => {
                    const isSelected = selectedAtp.includes(item.atp);
                    return (
                      <tr 
                        key={idx} 
                        onClick={() => toggleAtp(item.atp)}
                        className={\`cursor-pointer transition-colors \${isSelected ? 'bg-emerald-50/50' : 'hover:bg-white/40'}\`}
                      >
                        <td className="p-4 text-center">
                          <div className={\`w-6 h-6 rounded-md border-2 flex items-center justify-center mx-auto transition-colors \${isSelected ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm' : 'border-slate-300 bg-white/50'}\`}>
                            {isSelected && <CheckSquare size={16} />}
                          </div>
                        </td>
                        <td className="p-4 font-bold text-slate-800">{item.elemen}</td>
                        <td className="p-4 text-slate-600 font-medium">{item.atp}</td>
                      </tr>
                    );
                  })}`;

const newMap = `{allAtps.map((item, idx) => {
                    const isSelected = selectedAtp.includes(item.atp);
                    const isGenerated = storeGeneratedAtps[selectedGrade]?.includes(item.atp);
                    return (
                      <tr 
                        key={idx} 
                        onClick={() => toggleAtp(item.atp)}
                        className={\`cursor-pointer transition-colors \${isSelected ? 'bg-emerald-100/60' : (isGenerated ? 'bg-slate-100/70 hover:bg-slate-200/50' : 'hover:bg-white/40')}\`}
                      >
                        <td className="p-4 text-center">
                          <div className={\`w-6 h-6 rounded-md border-2 flex items-center justify-center mx-auto transition-colors \${isSelected ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm' : (isGenerated ? 'border-slate-400 bg-slate-200 text-slate-500' : 'border-slate-300 bg-white/50')}\`}>
                            {(isSelected || isGenerated) && <CheckSquare size={16} />}
                          </div>
                        </td>
                        <td className="p-4 text-center font-bold text-slate-500">{idx + 1}</td>
                        <td className="p-4 font-bold text-slate-800">{item.elemen}</td>
                        <td className="p-4 text-slate-600 font-medium">
                          {item.atp}
                          {isGenerated && <span className="ml-3 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-200 text-slate-600">Sudah Dibuat</span>}
                        </td>
                      </tr>
                    );
                  })}`;

content = content.replace(oldMap, newMap);

fs.writeFileSync('src/pages/ModulAjar.tsx', content);
