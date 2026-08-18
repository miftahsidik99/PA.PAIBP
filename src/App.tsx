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
  const currentUser = useStore(state => state.currentUser);
  const currentUserSessionId = useStore(state => state.currentUserSessionId);

  React.useEffect(() => {
    let unsubscribeUser = () => {};
    let unsubscribeRequests = () => {};
    let lastWarningTime = 0;

    if (currentUser) {
      import('./lib/firebase').then(({ db, doc, onSnapshot }) => {
        unsubscribeUser = onSnapshot(doc(db, 'global_users', currentUser), (snapshot) => {
          if (!snapshot.exists()) return;
          const data = snapshot.data();
          const currentState = useStore.getState();
          const usersData = currentState.usersData;
          const currentLocal = usersData[currentUser] || {
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
            jurnalState: { bulan: 'JUNI 2026', pengawasNama: '', pengawasNip: '', items: {} },
            jurnalEntries: {},
            label: 'Demo',
            signupTime: Date.now()
          };

          const updatedUser = {
            ...currentLocal,
            ...data
          };

          useStore.setState({
            usersData: {
              ...usersData,
              [currentUser]: updatedUser
            }
          });

          // Session and login attempt warning check
          if (currentUserSessionId && data.activeSessionId && data.activeSessionId !== currentUserSessionId) {
            alert('Sesi tidak valid atau akun Anda telah diakses dari perangkat lain. Anda akan dikeluarkan.');
            currentState.logout();
          } else if (data.loginAttemptWarning && data.loginAttemptWarning > lastWarningTime) {
            lastWarningTime = data.loginAttemptWarning;
            if (Date.now() - data.loginAttemptWarning < 10000) {
              alert("Ada user dari perangkat berbeda yang berusaha masuk menggunakan akun anda");
            }
          }
        }, (error) => {
          console.warn("Firestore user listener warning:", error);
        });
      }).catch(e => console.error(e));
    }

    import('./lib/firebase').then(({ db, collection, onSnapshot }) => {
      unsubscribeRequests = onSnapshot(collection(db, 'upgrade_requests'), (snapshot) => {
        const requests: any[] = [];
        snapshot.forEach((doc) => {
          requests.push(doc.data());
        });
        useStore.setState({ upgradeRequests: requests });
      }, (error) => {
        console.warn("Firestore upgrade_requests listener warning:", error);
      });
    }).catch(e => console.error(e));

    return () => {
      unsubscribeUser();
      unsubscribeRequests();
    };
  }, [currentUser, currentUserSessionId]);

  React.useEffect(() => {
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
