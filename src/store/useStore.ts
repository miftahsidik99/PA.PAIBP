import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  nisn: string;
  jenisKelamin?: string; // 'L' | 'P' | 'Laki-laki' | 'Perempuan' | ''
  kelas: string;
  tanggalLahir: string;
  alamat: string;
  foto: string; // base64 or data URL
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
}

interface AppState {
  currentUser: string | null;
  usersData: Record<string, UserData>;
  
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

  // Actions
  login: (username: string) => void;
  logout: () => void;
  
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

  importData: (jsonData: string) => void;
  geminiApiKey: string | null;
  setGeminiApiKey: (key: string) => void;
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
  modulAjarHistories: []
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      usersData: {},
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
      geminiApiKey: null,
      setGeminiApiKey: (key) => set({ geminiApiKey: key }),

      login: (username: string) => {
        const state = get();
        const userData = state.usersData[username] || { ...initialUserData };
        set({
          currentUser: username,
          user: { uid: username, displayName: username },
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
          usersData: {
            ...state.usersData,
            [username]: userData
          }
        });
      },

      logout: () => {
        set({
          currentUser: null,
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
