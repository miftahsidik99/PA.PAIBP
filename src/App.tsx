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
    let unsubscribeUsers = () => {};
    let unsubscribeRequests = () => {};
    let lastWarningTime = 0;

    import('./lib/firebase').then(({ db, collection, onSnapshot, doc, setDoc }) => {
      // 1. Listen to all global_users in real time across all devices
      unsubscribeUsers = onSnapshot(collection(db, 'global_users'), (snapshot) => {
        const loaded: Record<string, any> = {};
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const uid = docSnap.id.toLowerCase();
          loaded[uid] = {
            username: data.username || uid,
            password: data.password || '123456',
            label: data.label || 'Demo',
            signupTime: data.signupTime || Date.now(),
            profile: data.profile || null,
            calendarData: data.calendarData || null,
            schedules: data.schedules || {},
            savedProtas: data.savedProtas || {},
            students: data.students || {},
            attendance: data.attendance || [],
            atpBatches: data.atpBatches || {},
            savedKktps: data.savedKktps || [],
            modulAjarHistories: data.modulAjarHistories || [],
            rombelConfig: data.rombelConfig || {},
            jurnalState: data.jurnalState || { bulan: 'JUNI 2026', pengawasNama: '', pengawasNip: '', items: {} },
            jurnalEntries: data.jurnalEntries || {},
            generatedModulAtps: data.generatedModulAtps || {},
            activeSessionId: data.activeSessionId || null
          };
        });

        const currentState = useStore.getState();
        const currentLocal = currentState.usersData || {};

        // Merge any existing local accounts that might not yet be in cloud, and upload them
        Object.keys(currentLocal).forEach(uid => {
          if (!loaded[uid] && currentLocal[uid]) {
            loaded[uid] = currentLocal[uid];
            setDoc(doc(db, 'global_users', uid), {
              username: uid,
              ...currentLocal[uid]
            }, { merge: true }).catch(err => console.warn("App auto-sync user error:", err));
          }
        });

        useStore.setState({ usersData: loaded });

        // If user is currently logged in, check for multi-device session displacement or warning
        if (currentState.currentUser && loaded[currentState.currentUser]) {
          const activeUserDoc = loaded[currentState.currentUser];
          if (
            currentState.currentUserSessionId &&
            activeUserDoc.activeSessionId &&
            activeUserDoc.activeSessionId !== currentState.currentUserSessionId
          ) {
            alert('Sesi tidak valid atau akun Anda telah diakses dari perangkat lain. Anda akan dikeluarkan.');
            currentState.logout();
          } else if (activeUserDoc.loginAttemptWarning && activeUserDoc.loginAttemptWarning > lastWarningTime) {
            lastWarningTime = activeUserDoc.loginAttemptWarning;
            if (Date.now() - activeUserDoc.loginAttemptWarning < 10000) {
              alert("Ada user dari perangkat berbeda yang berusaha masuk menggunakan akun anda");
            }
          }
        }
      }, (error) => {
        console.warn("Firestore global_users listener warning:", error);
      });

      // 2. Listen to all upgrade_requests in real time
      unsubscribeRequests = onSnapshot(collection(db, 'upgrade_requests'), (snapshot) => {
        const requests: any[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          requests.push({
            id: docSnap.id,
            namaLengkap: data.namaLengkap || '',
            noWhatsapp: data.noWhatsapp || '',
            username: data.username || '',
            timestamp: data.timestamp || Date.now(),
            status: data.status || 'pending'
          });
        });
        requests.sort((a, b) => a.timestamp - b.timestamp);
        useStore.setState({ upgradeRequests: requests });
      }, (error) => {
        console.warn("Firestore upgrade_requests listener warning:", error);
      });
    }).catch(e => console.error(e));

    return () => {
      unsubscribeUsers();
      unsubscribeRequests();
    };
  }, []);

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
