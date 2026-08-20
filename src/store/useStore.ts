import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { FlashcardLink } from '../lib/youtube';

export interface UserProfile {
  namaGuru: string;
  namaSekolah: string;
  npsn: string;
  tahunPelajaran: string;
  nip: string;
  namaKepalaSekolah: string;
  nipKepalaSekolah: string;
}

export interface CalendarEvent {
  label: string;
  color: string;
  isEffective: boolean;
}

export interface CalendarData {
  academicYear: string;
  weeklyDays: number; // 5 or 6
  events1to5: Record<string, CalendarEvent>;
  events6: Record<string, CalendarEvent>;
}

export interface Student {
  id: string;
  nama: string;
  nipd?: string;
  jk?: string; // 'L' | 'P' | 'Laki-laki' | 'Perempuan'
  jenisKelamin?: string; // backwards compatibility
  nisn: string;
  tempatLahir?: string;
  tanggalLahir: string;
  nik?: string;
  agama?: string;
  alamat: string;
  foto: string; // base64 or data URL
  kelas: string;
  rombel?: string;
}

export interface AttendanceRecord {
  studentId: string;
  status: 'H' | 'S' | 'I' | 'A'; // Hadir, Sakit, Izin, Alfa
}

export interface AttendanceData {
  grade: number;
  month: string; // YYYY-MM
  records: Record<string, Record<string, 'H' | 'S' | 'I' | 'A'>>; // [date][studentId]
}

export interface KKTPRubric {
  atp: string;
  levels: {
    perluBimbingan: string;
    cukup: string;
    baik: string;
    sangatBaik: string;
  };
}

export interface KKTPRecord {
  id: string;
  grade: number;
  atps: string[];
  date: string;
  studentData: {
    studentId: string;
    predicate: string; // 'Sangat Baik' | 'Baik' | 'Cukup' | 'Perlu Bimbingan'
    description: string;
  }[];
  rubrics?: KKTPRubric[];
  color: string;
}

export interface ATPBatch {
  atps: string[];
  color: string;
  type: 'modul' | 'kktp';
  timestamp: number;
}

export interface ModulAjarHistoryItem {
  id: string;
  grade: number;
  atps: string[];
  createdAt: number;
  karakteristik: string;
  data: any;
}

export interface JurnalItem {
  grade: number;
  jadwalHari: string;
  rombel: string;
  minggu1: string;
  minggu2: string;
  minggu3: string;
  minggu4: string;
  minggu5: string;
  tuntas: 'Ya' | 'Tidak';
}

export interface JurnalStateData {
  bulan: string;
  pengawasNama: string;
  pengawasNip: string;
  items: Record<number, JurnalItem>;
}

export interface JurnalEntry {
  id: string;
  tanggal: string;
  jamPelajaran: string;
  kelas: number;
  rombel: string;
  mataPelajaran: string;
  atp: string;
  kehadiran: { hadir?: number; sakit: number; izin: number; alpa: number };
  metode: string;
  catatan: string;
}

export interface UpgradeRequest {
  id: string;
  namaLengkap: string;
  noWhatsapp: string;
  username: string;
  timestamp: number;
  status: 'pending' | 'approved';
}

export interface UserData {
  profile: UserProfile | null;
  calendarData: CalendarData | null;
  schedules: Record<number, any>;
  savedProtas: Record<number, any[]>;
  generatedModulAtps: Record<number, string[]>;
  atpBatches?: Record<number, ATPBatch[]>;
  savedKktps?: KKTPRecord[];
  students?: Record<number, Student[]>;
  attendance?: AttendanceData[];
  modulAjarHistories?: ModulAjarHistoryItem[];
  rombelConfig?: Record<number, { jumlahRombel: number; labels: string[] }>;
  jurnalState?: JurnalStateData;
  jurnalEntries?: Record<number, JurnalEntry[]>;
  password?: string;
  label?: 'Full Time' | 'Demo';
  signupTime?: number;
  activeSessionId?: string;
  loginAttemptWarning?: number;
}

interface AppState {
  currentUser: string | null;
  currentUserSessionId: string | null;
  usersData: Record<string, UserData>;
  upgradeRequests?: UpgradeRequest[];
  
  // Current user's active states
  user: { uid: string, displayName: string } | null;
  profile: UserProfile | null;
  calendarData: CalendarData | null;
  schedules: Record<number, any>;
  savedProtas: Record<number, any[]>;
  students: Record<number, Student[]>;
  attendance: AttendanceData[];
  atpBatches: Record<number, ATPBatch[]>;
  savedKktps: KKTPRecord[];
  modulAjarHistories: ModulAjarHistoryItem[];
  rombelConfig: Record<number, { jumlahRombel: number; labels: string[] }>;
  jurnalState: JurnalStateData;
  jurnalEntries: Record<number, JurnalEntry[]>;

  // Actions
  login: (username: string) => void;
  logout: () => void;
  registerUser: (username: string, password: string) => boolean;
  verifyAndLogin: (username: string, password: string) => 'success' | 'invalid_password' | 'not_found' | 'already_active';
  adminResetPassword: (username: string, newPassword: string) => void;
  adminSetLabel: (username: string, label: 'Full Time' | 'Demo') => void;
  adminDeleteUser: (username: string) => void;
  adminUpdateUsername: (oldUsername: string, newUsername: string) => void;
  submitUpgradeRequest: (namaLengkap: string, noWhatsapp: string, username: string) => void;
  adminApproveUpgrade: (requestId: string) => void;
  
  setProfile: (profile: UserProfile | null) => void;
  setCalendarData: (data: CalendarData | null) => void;
  setSchedules: (schedules: Record<number, any>) => void;
  setSavedProtas: (protas: Record<number, any[]>) => void;
  setStudents: (students: Record<number, Student[]>) => void;
  setAttendance: (attendance: AttendanceData[]) => void;
  generatedModulAtps: Record<number, string[]>;
  markAtpAsGenerated: (grade: number, atps: string[]) => void;
  addAtpBatch: (grade: number, batch: ATPBatch) => void;
  setAtpBatches: (atpBatches: Record<number, ATPBatch[]>) => void;
  addKktp: (kktp: KKTPRecord) => void;
  setSavedKktps: (kktps: KKTPRecord[]) => void;
  addModulAjarHistory: (item: ModulAjarHistoryItem) => void;
  clearModulAjarHistories: () => void;
  deleteModulAjarHistory: (id: string) => void;
  setRombelConfig: (grade: number, config: { jumlahRombel: number; labels: string[] }) => void;
  setJurnalState: (state: JurnalStateData) => void;
  setJurnalEntries: (entries: Record<number, JurnalEntry[]>) => void;

  importData: (jsonData: string) => void;
  syncUserDataToCloud: () => void;
  loadUserFromCloud: (username: string) => Promise<boolean>;
  geminiApiKey: string | null;
  setGeminiApiKey: (key: string) => void;

  // Flashcards state and actions
  flashcards: FlashcardLink[];
  addFlashcard: (title: string, url: string) => void;
  updateFlashcard: (id: string, title: string, url: string) => void;
  deleteFlashcard: (id: string) => void;
  setFlashcards: (flashcards: FlashcardLink[]) => void;
}

const initialUserData: UserData = {
  profile: null,
  calendarData: null,
  schedules: {},
  savedProtas: {},
  generatedModulAtps: {},
  atpBatches: {},
  savedKktps: [],
  students: {},
  attendance: [],
  modulAjarHistories: [],
  rombelConfig: {},
  jurnalState: {
    bulan: 'JUNI 2026',
    pengawasNama: '',
    pengawasNip: '',
    items: {}
  },
  jurnalEntries: {}
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      currentUserSessionId: null,
      usersData: {},
      upgradeRequests: [],
      user: null,
      profile: null,
      calendarData: null,
      schedules: {},
      savedProtas: {},
      students: {},
      attendance: [],
      generatedModulAtps: {},
      atpBatches: {},
      savedKktps: [],
      modulAjarHistories: [],
      rombelConfig: {},
      jurnalState: {
        bulan: 'JUNI 2026',
        pengawasNama: '',
        pengawasNip: '',
        items: {}
      },
      jurnalEntries: {},
      geminiApiKey: null,
      setGeminiApiKey: (key) => set({ geminiApiKey: key }),

      flashcards: [],

      addFlashcard: (title: string, url: string) => {
        const state = get();
        const newCard: FlashcardLink = {
          id: 'flash-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
          title: title.trim(),
          url: url.trim(),
          createdAt: Date.now()
        };
        const updated = [newCard, ...(state.flashcards || [])];
        set({ flashcards: updated });

        import('../lib/firebase').then(({ db, doc, setDoc }) => {
          setDoc(doc(db, 'app_config', 'flashcards'), { items: updated });
        }).catch(err => console.error(err));
      },

      updateFlashcard: (id: string, title: string, url: string) => {
        const state = get();
        const updated = (state.flashcards || []).map(f => f.id === id ? { ...f, title: title.trim(), url: url.trim() } : f);
        set({ flashcards: updated });

        import('../lib/firebase').then(({ db, doc, setDoc }) => {
          setDoc(doc(db, 'app_config', 'flashcards'), { items: updated });
        }).catch(err => console.error(err));
      },

      deleteFlashcard: (id: string) => {
        const state = get();
        const updated = (state.flashcards || []).filter(f => f.id !== id);
        set({ flashcards: updated });

        import('../lib/firebase').then(({ db, doc, setDoc }) => {
          setDoc(doc(db, 'app_config', 'flashcards'), { items: updated });
        }).catch(err => console.error(err));
      },

      setFlashcards: (flashcards: FlashcardLink[]) => {
        set({ flashcards });
      },

      registerUser: (username: string, password: string) => {
        const state = get();
        const normalized = username.trim().toLowerCase();
        if (state.usersData[normalized]) {
          return false;
        }
        const newUser: UserData = {
          ...initialUserData,
          password,
          label: 'Demo',
          signupTime: Date.now()
        };
        set({
          usersData: {
            ...state.usersData,
            [normalized]: newUser
          }
        });
        
        // Sync to Firestore
        import('../lib/firebase').then(({ db, doc, setDoc }) => {
          setDoc(doc(db, 'global_users', normalized), {
            username: normalized,
            password,
            label: 'Demo',
            signupTime: newUser.signupTime
          });
        }).catch(err => console.error(err));

        return true;
      },

      verifyAndLogin: (username: string, password: string) => {
        const state = get();
        const normalized = username.trim().toLowerCase();
        const userData = state.usersData[normalized];
        if (!userData) {
          return 'not_found';
        }
        // If password exists, check it
        if (userData.password && userData.password !== password) {
          return 'invalid_password';
        }
        
        // Otherwise success, login
        state.login(normalized);

        // If password wasn't set, set it now
        if (!userData.password) {
          const updatedUsers = { ...get().usersData };
          updatedUsers[normalized] = {
            ...userData,
            password
          };
          set({ usersData: updatedUsers });
        }
        return 'success';
      },

      adminResetPassword: (username: string, newPassword: string) => {
        const state = get();
        const normalized = username.trim().toLowerCase();
        const userData = state.usersData[normalized] || initialUserData;
        const updatedUser: UserData = {
          ...userData,
          password: newPassword
        };
        set({
          usersData: {
            ...state.usersData,
            [normalized]: updatedUser
          }
        });
        
        import('../lib/firebase').then(({ db, doc, setDoc }) => {
          setDoc(doc(db, 'global_users', normalized), {
            username: normalized,
            password: newPassword
          }, { merge: true }).catch(e => console.error("Error resetting password in Firestore:", e));
        }).catch(e => console.error(e));
      },

      adminSetLabel: (username: string, label: 'Full Time' | 'Demo') => {
        const state = get();
        const normalized = username.trim().toLowerCase();
        const userData = state.usersData[normalized] || initialUserData;
        const newSignupTime = label === 'Demo' ? Date.now() : (userData.signupTime || Date.now());
        const updatedUser: UserData = {
          ...userData,
          label,
          signupTime: newSignupTime
        };
        set({
          usersData: {
            ...state.usersData,
            [normalized]: updatedUser
          }
        });
        
        import('../lib/firebase').then(({ db, doc, setDoc }) => {
          setDoc(doc(db, 'global_users', normalized), {
            username: normalized,
            label,
            signupTime: newSignupTime
          }, { merge: true }).catch(e => console.error("Error setting label in Firestore:", e));
        }).catch(e => console.error(e));
      },

      adminDeleteUser: (username: string) => {
        const state = get();
        const normalized = username.trim().toLowerCase();
        const newUsersData = { ...state.usersData };
        delete newUsersData[normalized];
        set({ usersData: newUsersData });
        
        import('../lib/firebase').then(({ db, doc, deleteDoc }) => {
          deleteDoc(doc(db, 'global_users', normalized)).catch(e => console.error("Error deleting user from Firestore:", e));
        }).catch(e => console.error(e));
      },

      adminUpdateUsername: (oldUsername: string, newUsername: string) => {
        const state = get();
        const normalizedOld = oldUsername.trim().toLowerCase();
        const normalizedNew = newUsername.trim().toLowerCase();
        
        const userData = state.usersData[normalizedOld];
        if (userData && normalizedOld !== normalizedNew && !state.usersData[normalizedNew]) {
          const newUsersData = { ...state.usersData };
          newUsersData[normalizedNew] = { ...userData };
          delete newUsersData[normalizedOld];
          set({ usersData: newUsersData });
          
          import('../lib/firebase').then(({ db, doc, setDoc, deleteDoc }) => {
            setDoc(doc(db, 'global_users', normalizedNew), {
              ...userData,
              username: normalizedNew
            }, { merge: true }).then(() => {
              deleteDoc(doc(db, 'global_users', normalizedOld)).catch(e => console.error(e));
            }).catch(e => console.error(e));
          }).catch(e => console.error(e));
        }
      },

      submitUpgradeRequest: (namaLengkap: string, noWhatsapp: string, username: string) => {
        const state = get();
        const requests = state.upgradeRequests || [];
        const newRequest: UpgradeRequest = {
          id: Date.now().toString(),
          namaLengkap,
          noWhatsapp,
          username: username.trim().toLowerCase(),
          timestamp: Date.now(),
          status: 'pending'
        };
        set({
          upgradeRequests: [...requests, newRequest]
        });
        
        import('../lib/firebase').then(({ db, doc, setDoc }) => {
          setDoc(doc(db, 'upgrade_requests', newRequest.id), newRequest, { merge: true }).catch(e => console.error(e));
        });
      },

      adminApproveUpgrade: (requestId: string) => {
        const state = get();
        const requests = state.upgradeRequests || [];
        const request = requests.find(r => r.id === requestId);
        if (request) {
          const updatedRequests = requests.map(r => r.id === requestId ? { ...r, status: 'approved' as const } : r);
          const normalized = request.username.trim().toLowerCase();
          const userData = state.usersData[normalized] || initialUserData;
          const updatedUsersData = {
            ...state.usersData,
            [normalized]: {
              ...userData,
              label: 'Full Time' as const
            }
          };
          set({
            upgradeRequests: updatedRequests,
            usersData: updatedUsersData
          });
          
          import('../lib/firebase').then(({ db, doc, setDoc }) => {
            setDoc(doc(db, 'upgrade_requests', requestId), { status: 'approved' }, { merge: true }).catch(e => console.error(e));
            setDoc(doc(db, 'global_users', normalized), { label: 'Full Time' }, { merge: true }).catch(e => console.error(e));
          }).catch(e => console.error(e));
        }
      },

      login: (username: string) => {
        const state = get();
        const normalized = username.trim().toLowerCase();
        let userData = state.usersData[normalized];
        if (!userData) {
          userData = { 
            ...initialUserData,
            label: 'Demo',
            signupTime: Date.now()
          };
        } else {
          if (!userData.label) {
            userData = { ...userData, label: 'Demo' };
          }
          if (!userData.signupTime) {
            userData = { ...userData, signupTime: Date.now() };
          }
        }
        
        const sessionId = Date.now().toString() + Math.random().toString(36).substring(7);
        userData.activeSessionId = sessionId;
        
        set({
          currentUser: normalized,
          currentUserSessionId: sessionId,
          user: { uid: normalized, displayName: normalized },
          profile: userData.profile,
          calendarData: userData.calendarData,
          schedules: userData.schedules,
          savedProtas: userData.savedProtas,
          students: userData.students || {},
          attendance: userData.attendance || [],
          generatedModulAtps: userData.generatedModulAtps || {},
          atpBatches: userData.atpBatches || {},
          savedKktps: userData.savedKktps || [],
          modulAjarHistories: userData.modulAjarHistories || [],
          rombelConfig: userData.rombelConfig || {},
          jurnalState: userData.jurnalState || { bulan: 'JUNI 2026', pengawasNama: '', pengawasNip: '', items: {} },
          jurnalEntries: userData.jurnalEntries || {},
          usersData: {
            ...state.usersData,
            [normalized]: userData
          }
        });
        
        import('../lib/firebase').then(({ db, doc, setDoc }) => {
          setDoc(doc(db, 'global_users', normalized), {
            activeSessionId: sessionId
          }, { merge: true }).catch(e => console.error(e));
        });
      },

      logout: () => {
        const state = get();
        if (state.currentUser) {
          import('../lib/firebase').then(({ db, doc, updateDoc }) => {
            updateDoc(doc(db, 'global_users', state.currentUser!), {
              activeSessionId: null
            }).catch(e => console.error(e));
          });
        }
        set({
          currentUser: null,
          currentUserSessionId: null,
          user: null,
          profile: null,
          calendarData: null,
          schedules: {},
          savedProtas: {},
          students: {},
          attendance: [],
          generatedModulAtps: {},
          atpBatches: {},
          savedKktps: [],
          modulAjarHistories: [],
          rombelConfig: {},
          jurnalState: { bulan: 'JUNI 2026', pengawasNama: '', pengawasNip: '', items: {} },
          jurnalEntries: {},
        });
      },

      setProfile: (profile) => {
        const state = get();
        if (!state.currentUser) return;
        set({
          profile,
          usersData: {
            ...state.usersData,
            [state.currentUser]: { ...state.usersData[state.currentUser], profile }
          }
        });
        state.syncUserDataToCloud();
      },

      setCalendarData: (calendarData) => {
        const state = get();
        if (!state.currentUser) return;
        set({
          calendarData,
          usersData: {
            ...state.usersData,
            [state.currentUser]: { ...state.usersData[state.currentUser], calendarData }
          }
        });
        state.syncUserDataToCloud();
      },

      setSchedules: (schedules) => {
        const state = get();
        if (!state.currentUser) return;
        set({
          schedules,
          usersData: {
            ...state.usersData,
            [state.currentUser]: { ...state.usersData[state.currentUser], schedules }
          }
        });
        state.syncUserDataToCloud();
      },

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
        state.syncUserDataToCloud();
      },

      addAtpBatch: (grade, batch) => {
        const state = get();
        if (!state.currentUser) return;
        const currentBatches = state.atpBatches[grade] || [];
        const newBatches = { ...state.atpBatches, [grade]: [...currentBatches, batch] };
        set({
          atpBatches: newBatches,
          usersData: {
            ...state.usersData,
            [state.currentUser]: { ...state.usersData[state.currentUser], atpBatches: newBatches }
          }
        });
        state.syncUserDataToCloud();
      },

      setAtpBatches: (atpBatches) => {
        const state = get();
        if (!state.currentUser) return;
        set({
          atpBatches,
          usersData: {
            ...state.usersData,
            [state.currentUser]: { ...state.usersData[state.currentUser], atpBatches }
          }
        });
        state.syncUserDataToCloud();
      },

      addKktp: (kktp) => {
        const state = get();
        if (!state.currentUser) return;
        const newKktps = [...state.savedKktps, kktp];
        set({
          savedKktps: newKktps,
          usersData: {
            ...state.usersData,
            [state.currentUser]: { ...state.usersData[state.currentUser], savedKktps: newKktps }
          }
        });
        state.syncUserDataToCloud();
      },

      setSavedKktps: (savedKktps) => {
        const state = get();
        if (!state.currentUser) return;
        set({
          savedKktps,
          usersData: {
            ...state.usersData,
            [state.currentUser]: { ...state.usersData[state.currentUser], savedKktps }
          }
        });
        state.syncUserDataToCloud();
      },

      setSavedProtas: (savedProtas) => {
        const state = get();
        if (!state.currentUser) return;
        set({
          savedProtas,
          usersData: {
            ...state.usersData,
            [state.currentUser]: { ...state.usersData[state.currentUser], savedProtas }
          }
        });
        state.syncUserDataToCloud();
      },

      addModulAjarHistory: (item) => {
        const state = get();
        if (!state.currentUser) return;
        const newHistories = [item, ...state.modulAjarHistories];
        set({
          modulAjarHistories: newHistories,
          usersData: {
            ...state.usersData,
            [state.currentUser]: { ...state.usersData[state.currentUser], modulAjarHistories: newHistories }
          }
        });
        state.syncUserDataToCloud();
      },

      clearModulAjarHistories: () => {
        const state = get();
        if (!state.currentUser) return;
        set({
          modulAjarHistories: [],
          usersData: {
            ...state.usersData,
            [state.currentUser]: { ...state.usersData[state.currentUser], modulAjarHistories: [] }
          }
        });
        state.syncUserDataToCloud();
      },

      deleteModulAjarHistory: (id) => {
        const state = get();
        if (!state.currentUser) return;
        const newHistories = state.modulAjarHistories.filter(h => h.id !== id);
        set({
          modulAjarHistories: newHistories,
          usersData: {
            ...state.usersData,
            [state.currentUser]: { ...state.usersData[state.currentUser], modulAjarHistories: newHistories }
          }
        });
        state.syncUserDataToCloud();
      },

      setStudents: (students) => {
        const state = get();
        if (!state.currentUser) return;
        set({
          students,
          usersData: {
            ...state.usersData,
            [state.currentUser]: { ...state.usersData[state.currentUser], students }
          }
        });
        state.syncUserDataToCloud();
      },

      setRombelConfig: (grade, config) => {
        const state = get();
        if (!state.currentUser) return;
        const newConfig = { ...state.rombelConfig, [grade]: config };
        set({
          rombelConfig: newConfig,
          usersData: {
            ...state.usersData,
            [state.currentUser]: { ...state.usersData[state.currentUser], rombelConfig: newConfig }
          }
        });
        state.syncUserDataToCloud();
      },

      setJurnalState: (jurnalState) => {
        const state = get();
        if (!state.currentUser) return;
        set({
          jurnalState,
          usersData: {
            ...state.usersData,
            [state.currentUser]: { ...state.usersData[state.currentUser], jurnalState }
          }
        });
        state.syncUserDataToCloud();
      },

      setJurnalEntries: (jurnalEntries) => {
        const state = get();
        if (!state.currentUser) return;
        set({
          jurnalEntries,
          usersData: {
            ...state.usersData,
            [state.currentUser]: { ...state.usersData[state.currentUser], jurnalEntries }
          }
        });
        state.syncUserDataToCloud();
      },

      setAttendance: (attendance) => {
        const state = get();
        if (!state.currentUser) return;
        set({
          attendance,
          usersData: {
            ...state.usersData,
            [state.currentUser]: { ...state.usersData[state.currentUser], attendance }
          }
        });
        state.syncUserDataToCloud();
      },

      syncUserDataToCloud: () => {
        const state = get();
        const username = state.currentUser;
        if (!username) return;
        const currentData = state.usersData[username];
        if (!currentData) return;

        import('../lib/firebase').then(({ db, doc, setDoc }) => {
          setDoc(doc(db, 'global_users', username), {
            username,
            profile: currentData.profile || null,
            calendarData: currentData.calendarData || null,
            schedules: currentData.schedules || {},
            savedProtas: currentData.savedProtas || {},
            students: currentData.students || {},
            attendance: currentData.attendance || [],
            atpBatches: currentData.atpBatches || {},
            savedKktps: currentData.savedKktps || [],
            modulAjarHistories: currentData.modulAjarHistories || [],
            rombelConfig: currentData.rombelConfig || {},
            jurnalState: currentData.jurnalState || { bulan: 'JUNI 2026', pengawasNama: '', pengawasNip: '', items: {} },
            jurnalEntries: currentData.jurnalEntries || {},
            generatedModulAtps: currentData.generatedModulAtps || {},
            activeSessionId: currentData.activeSessionId || null
          }, { merge: true }).catch(err => {
            console.warn("Firestore syncUserDataToCloud warning:", err);
          });
        }).catch(err => console.warn(err));
      },

      loadUserFromCloud: async (username: string) => {
        const normalized = username.trim().toLowerCase();
        try {
          const { db, doc, getDoc } = await import('../lib/firebase');
          const docSnap = await getDoc(doc(db, 'global_users', normalized));
          if (docSnap.exists()) {
            const cloudData = docSnap.data();
            const state = get();
            const existingLocal = state.usersData[normalized] || initialUserData;
            
            const mergedUser: UserData = {
              ...existingLocal,
              password: cloudData.password || existingLocal.password,
              label: cloudData.label || existingLocal.label || 'Demo',
              signupTime: cloudData.signupTime || existingLocal.signupTime || Date.now(),
              profile: cloudData.profile || existingLocal.profile,
              calendarData: cloudData.calendarData || existingLocal.calendarData,
              schedules: cloudData.schedules || existingLocal.schedules,
              savedProtas: cloudData.savedProtas || existingLocal.savedProtas,
              students: cloudData.students || existingLocal.students || {},
              attendance: cloudData.attendance || existingLocal.attendance || [],
              atpBatches: cloudData.atpBatches || existingLocal.atpBatches || {},
              savedKktps: cloudData.savedKktps || existingLocal.savedKktps || [],
              modulAjarHistories: cloudData.modulAjarHistories || existingLocal.modulAjarHistories || [],
              rombelConfig: cloudData.rombelConfig || existingLocal.rombelConfig || {},
              jurnalState: cloudData.jurnalState || existingLocal.jurnalState || { bulan: 'JUNI 2026', pengawasNama: '', pengawasNip: '', items: {} },
              jurnalEntries: cloudData.jurnalEntries || existingLocal.jurnalEntries || {},
              generatedModulAtps: cloudData.generatedModulAtps || existingLocal.generatedModulAtps || {},
              activeSessionId: cloudData.activeSessionId || existingLocal.activeSessionId
            };

            set({
              usersData: {
                ...state.usersData,
                [normalized]: mergedUser
              }
            });
            return true;
          }
        } catch (e) {
          console.warn("Gagal memuat data cloud untuk user", normalized, e);
        }
        return false;
      },

      importData: (jsonData) => {
        try {
          const parsed = JSON.parse(jsonData);
          // Simple validation
          if (parsed && typeof parsed === 'object' && parsed.state) {
             set({
               usersData: parsed.state.usersData,
               currentUser: null,
               user: null,
               profile: null,
               calendarData: null,
               schedules: {},
               savedProtas: {}
             });
             alert('Data berhasil dipulihkan! Silakan masuk kembali.');
          } else {
             alert('Format file backup tidak valid.');
          }
        } catch (e) {
          console.error('Failed to parse backup data', e);
          alert('Gagal memproses file backup.');
        }
      }
    }),
    {
      name: 'paibp-smart-storage',
    }
  )
);
