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

export interface UserData {
  profile: UserProfile | null;
  calendarData: CalendarData | null;
  schedules: Record<number, any>;
  savedProtas: Record<number, any[]>;
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

  // Actions
  login: (username: string) => void;
  logout: () => void;
  
  setProfile: (profile: UserProfile | null) => void;
  setCalendarData: (data: CalendarData | null) => void;
  setSchedules: (schedules: Record<number, any>) => void;
  setSavedProtas: (protas: Record<number, any[]>) => void;

  importData: (jsonData: string) => void;
  geminiApiKey: string | null;
  setGeminiApiKey: (key: string) => void;
}

const initialUserData: UserData = {
  profile: null,
  calendarData: null,
  schedules: {},
  savedProtas: {}
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
