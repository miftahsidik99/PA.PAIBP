import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import React from 'react';
import { useStore } from './store/useStore';

import Login from './pages/Login';
import Signup from './pages/Signup';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Schedule from './pages/Schedule';
import EffectiveDays from './pages/EffectiveDays';
import Prota from './pages/Prota';
import ModulAjar from './pages/ModulAjar';
import ModulAjarHistory from './pages/ModulAjarHistory';
import AcademicCalendar from './pages/AcademicCalendar';
import DaftarSiswa from './pages/DaftarSiswa';
import Presensi from './pages/Presensi';
import KKTP from './pages/KKTP';
import Jurnal from './pages/Jurnal';
import Admin from './pages/Admin';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile } = useStore();
  
  if (!user) {
    return <Navigate to="/" replace />;
  }
  
  if (!profile && window.location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  React.useEffect(() => {
    // Listen to Firebase and sync to useStore
    let unsubscribeUsers = () => {};
    let unsubscribeRequests = () => {};

    import('./lib/firebase').then(({ db, collection, onSnapshot }) => {
      unsubscribeUsers = onSnapshot(collection(db, 'global_users'), (snapshot) => {
        const usersData = useStore.getState().usersData;
        const updatedUsersData = { ...usersData };
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          const normalized = doc.id;
          if (updatedUsersData[normalized]) {
            updatedUsersData[normalized] = {
              ...updatedUsersData[normalized],
              ...data
            };
          } else {
            // New user from another device
            updatedUsersData[normalized] = {
              profile: data.profile || null,
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
              jurnalEntries: {},
              password: data.password,
              label: data.label || 'Demo',
              signupTime: data.signupTime || Date.now()
            };
          }
        });
        
        // Push any purely local users to Firestore
        import('./lib/firebase').then(({ setDoc, doc }) => {
          Object.keys(usersData).forEach(localUser => {
            if (!snapshot.docs.find(d => d.id === localUser)) {
               setDoc(doc(db, 'global_users', localUser), {
                 username: localUser,
                 password: usersData[localUser].password || '',
                 label: usersData[localUser].label || 'Demo',
                 signupTime: usersData[localUser].signupTime || Date.now(),
                 profile: usersData[localUser].profile || null
               }).catch(e => console.error(e));
            }
          });
        });
        
        useStore.setState({ usersData: updatedUsersData });
      });

      unsubscribeRequests = onSnapshot(collection(db, 'upgrade_requests'), (snapshot) => {
        const requests: any[] = [];
        snapshot.forEach((doc) => {
          requests.push(doc.data());
        });
        useStore.setState({ upgradeRequests: requests });
      });
    }).catch(e => console.error(e));

    const pressedKeys = new Set<string>();

    const handleKeyDown = (e: KeyboardEvent) => {
      pressedKeys.add(e.key.toLowerCase());
      
      const hasCtrl = e.ctrlKey || pressedKeys.has('control');
      const hasAlt = e.altKey || pressedKeys.has('alt');
      const hasI = pressedKeys.has('i');
      const hasP = pressedKeys.has('p');
      
      if (hasCtrl && hasAlt && hasI && hasP) {
        e.preventDefault();
        window.location.href = '/admin';
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      pressedKeys.delete(e.key.toLowerCase());
    };

    const handleBlur = () => {
      pressedKeys.clear();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      unsubscribeUsers();
      unsubscribeRequests();
    };
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/daftar-siswa" element={<ProtectedRoute><DaftarSiswa /></ProtectedRoute>} />
        <Route path="/academic-calendar" element={<ProtectedRoute><AcademicCalendar /></ProtectedRoute>} />
        <Route path="/schedule" element={<ProtectedRoute><Schedule /></ProtectedRoute>} />
        <Route path="/effective-days" element={<ProtectedRoute><EffectiveDays /></ProtectedRoute>} />
        <Route path="/presensi" element={<ProtectedRoute><Presensi /></ProtectedRoute>} />
        <Route path="/prota" element={<ProtectedRoute><Prota /></ProtectedRoute>} />
        <Route path="/modul-ajar" element={<ProtectedRoute><ModulAjar /></ProtectedRoute>} />
        <Route path="/modul-ajar-history" element={<ProtectedRoute><ModulAjarHistory /></ProtectedRoute>} />
        <Route path="/kktp" element={<ProtectedRoute><KKTP /></ProtectedRoute>} />
        <Route path="/jurnal" element={<ProtectedRoute><Jurnal /></ProtectedRoute>} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </Router>
  );
}
