import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import React from 'react';
import { useStore, DEFAULT_SUMATIF_CONFIG } from './store/useStore';

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
import Sumatif from './pages/Sumatif';
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
    if (!currentUser) return;

    let unsubscribeUser = () => {};
    let lastWarningTime = 0;

    import('./lib/firebase').then(({ db, onSnapshot, doc, isFirestoreQuotaError, markFirestoreQuotaExceeded }) => {
      // Listen only to the active user's document (prevents collection-wide read/write amplification)
      unsubscribeUser = onSnapshot(doc(db, 'global_users', currentUser), (docSnap) => {
        if (!docSnap.exists()) return;
        const data = docSnap.data();
        const currentState = useStore.getState();

        // Check for multi-device session displacement or login warning
        if (
          currentState.currentUserSessionId &&
          data.activeSessionId &&
          data.activeSessionId !== currentState.currentUserSessionId
        ) {
          alert('Sesi tidak valid atau akun Anda telah diakses dari perangkat lain. Anda akan dikeluarkan.');
          currentState.logout();
          return;
        } else if (data.loginAttemptWarning && data.loginAttemptWarning > lastWarningTime) {
          lastWarningTime = data.loginAttemptWarning;
          if (Date.now() - data.loginAttemptWarning < 10000) {
            alert("Ada user dari perangkat berbeda yang berusaha masuk menggunakan akun anda");
          }
        }

        // Keep account metadata synced if updated by admin (e.g. Demo -> Full Time)
        const existingLocal = currentState.usersData?.[currentUser];
        if (existingLocal && (data.label !== existingLocal.label || data.password !== existingLocal.password)) {
          useStore.setState({
            usersData: {
              ...currentState.usersData,
              [currentUser]: {
                ...existingLocal,
                label: data.label || existingLocal.label || 'Demo',
                password: data.password || existingLocal.password,
                activeSessionId: data.activeSessionId || existingLocal.activeSessionId,
              }
            }
          });
        }
      }, (error) => {
        if (isFirestoreQuotaError(error)) {
          markFirestoreQuotaExceeded();
        }
        console.warn("Firestore active user listener warning:", error);
      });
    }).catch(e => console.error(e));

    return () => {
      unsubscribeUser();
    };
  }, [currentUser]);

  React.useEffect(() => {
    const pressedKeys = new Set<string>();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.key) return;
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
      if (!e.key) return;
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
        <Route path="/sumatif" element={<ProtectedRoute><Sumatif /></ProtectedRoute>} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </Router>
  );
}
