import { create } from 'zustand';
import { User } from 'firebase/auth';

interface UserProfile {
  namaGuru: string;
  namaSekolah: string;
  npsn: string;
  tahunPelajaran: string;
  nip: string;
  namaKepalaSekolah: string;
  nipKepalaSekolah: string;
}

interface CalendarEvent {
  label: string;
  color: string;
  isEffective: boolean;
}

interface CalendarData {
  academicYear: string;
  weeklyDays: number; // 5 or 6
  events1to5: Record<string, CalendarEvent>;
  events6: Record<string, CalendarEvent>;
}

interface AppState {
  user: User | null;
  setUser: (user: User | null) => void;
  profile: UserProfile | null;
  setProfile: (profile: UserProfile | null) => void;
  calendarData: CalendarData | null;
  setCalendarData: (data: CalendarData | null) => void;
}

export const useStore = create<AppState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  profile: null,
  setProfile: (profile) => set({ profile }),
  calendarData: null,
  setCalendarData: (calendarData) => set({ calendarData }),
}));
