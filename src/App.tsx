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
      </Routes>
    </Router>
  );
}
