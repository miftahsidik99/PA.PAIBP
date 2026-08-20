import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, UserData, UpgradeRequest } from '../store/useStore';
import { motion } from 'motion/react';
import { 
  Users, 
  Key, 
  ShieldAlert, 
  CheckCircle, 
  Clock, 
  ArrowLeft, 
  RotateCcw, 
  UserCheck, 
  Award,
  RefreshCw,
  Search,
  Check,
  Phone,
  Trash2,
  Youtube,
  Plus,
  Edit3,
  Save,
  X,
  ExternalLink,
  Play
} from 'lucide-react';
import { getYouTubeThumbnailUrl } from '../lib/youtube';

export default function Admin() {
  const navigate = useNavigate();
  const { 
    usersData, 
    upgradeRequests, 
    adminResetPassword, 
    adminSetLabel, 
    adminApproveUpgrade,
    adminDeleteUser,
    adminUpdateUsername,
    flashcards,
    addFlashcard,
    updateFlashcard,
    deleteFlashcard,
    setFlashcards
  } = useStore();

  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(() => {
    return sessionStorage.getItem('paibp_admin_auth') === 'true';
  });
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const [cloudUsers, setCloudUsers] = useState<Record<string, UserData>>({});
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [resettingUser, setResettingUser] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [editingUsernameUser, setEditingUsernameUser] = useState<string | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);

  const showToast = React.useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  // Flashcards state
  const [inputTitle, setInputTitle] = useState('');
  const [inputUrl, setInputUrl] = useState('');
  const [editingFlashcardId, setEditingFlashcardId] = useState<string | null>(null);
  const [editFlashcardTitle, setEditFlashcardTitle] = useState('');
  const [editFlashcardUrl, setEditFlashcardUrl] = useState('');
  const [flashcardToDelete, setFlashcardToDelete] = useState<{ id: string; title: string } | null>(null);

  // Listen to all users and upgrade requests from Firestore when admin is unlocked
  const fetchAllData = React.useCallback(() => {
    setIsLoadingUsers(true);
    import('../lib/firebase').then(({ db, collection, getDocs, doc, setDoc }) => {
      // 1. Direct one-time fetch for instant display & auto cloud migration
      getDocs(collection(db, 'global_users')).then(snapshot => {
        const loaded: Record<string, UserData> = {};
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          const uid = docSnap.id.toLowerCase();
          loaded[uid] = {
            profile: data.profile || null,
            calendarData: data.calendarData || null,
            schedules: data.schedules || {},
            savedProtas: data.savedProtas || {},
            generatedModulAtps: data.generatedModulAtps || {},
            atpBatches: data.atpBatches || {},
            savedKktps: data.savedKktps || [],
            students: data.students || {},
            attendance: data.attendance || [],
            modulAjarHistories: data.modulAjarHistories || [],
            rombelConfig: data.rombelConfig || {},
            jurnalState: data.jurnalState || { bulan: 'JUNI 2026', pengawasNama: '', pengawasNip: '', items: {} },
            jurnalEntries: data.jurnalEntries || {},
            password: data.password || '123456',
            label: data.label || 'Demo',
            signupTime: data.signupTime || Date.now(),
            activeSessionId: data.activeSessionId || undefined
          };
        });

        // Check if current device has local accounts that haven't been uploaded to Cloud yet
        const currentLocal = useStore.getState().usersData || {};
        let uploadedCount = 0;
        Object.keys(currentLocal).forEach(uid => {
          const localUser = currentLocal[uid];
          if (localUser && !loaded[uid]) {
            loaded[uid] = localUser;
            uploadedCount++;
            // Automatically push this local account to Cloud Firestore
            setDoc(doc(db, 'global_users', uid), {
              username: uid,
              password: localUser.password || '123456',
              label: localUser.label || 'Demo',
              signupTime: localUser.signupTime || Date.now(),
              profile: localUser.profile || null,
              calendarData: localUser.calendarData || null,
              schedules: localUser.schedules || {},
              savedProtas: localUser.savedProtas || {},
              students: localUser.students || {},
              attendance: localUser.attendance || [],
              atpBatches: localUser.atpBatches || {},
              savedKktps: localUser.savedKktps || [],
              modulAjarHistories: localUser.modulAjarHistories || [],
              rombelConfig: localUser.rombelConfig || {},
              jurnalState: localUser.jurnalState || { bulan: 'JUNI 2026', pengawasNama: '', pengawasNip: '', items: {} },
              jurnalEntries: localUser.jurnalEntries || {},
              generatedModulAtps: localUser.generatedModulAtps || {}
            }, { merge: true }).catch(e => console.warn("Auto-upload user error:", e));
          }
        });

        if (uploadedCount > 0) {
          showToast(`Berhasil mengunggah ${uploadedCount} akun lokal ke Cloud Server!`);
        }

        setCloudUsers(loaded);
        useStore.setState({ usersData: loaded });
        setIsLoadingUsers(false);
      }).catch(err => {
        console.warn("getDocs users warning:", err);
        setIsLoadingUsers(false);
      });

      // 2. Direct one-time fetch for upgrade requests
      getDocs(collection(db, 'upgrade_requests')).then(snapshot => {
        const reqs: UpgradeRequest[] = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          reqs.push({
            id: docSnap.id,
            namaLengkap: data.namaLengkap || '',
            noWhatsapp: data.noWhatsapp || '',
            username: data.username || '',
            timestamp: data.timestamp || Date.now(),
            status: data.status || 'pending'
          });
        });
        reqs.sort((a, b) => a.timestamp - b.timestamp);
        useStore.setState({ upgradeRequests: reqs });
      }).catch(err => console.warn("getDocs upgrade_requests warning:", err));

    }).catch(err => {
      console.error(err);
      setIsLoadingUsers(false);
    });
  }, [showToast]);

  useEffect(() => {
    if (!isAdminUnlocked) return;

    fetchAllData();

    let unsubscribeUsers: (() => void) | undefined;
    let unsubscribeRequests: (() => void) | undefined;

    import('../lib/firebase').then(({ db, collection, onSnapshot, doc, setDoc }) => {
      // 1. Realtime listener for users
      unsubscribeUsers = onSnapshot(collection(db, 'global_users'), (snapshot) => {
        const loaded: Record<string, UserData> = {};
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          const uid = docSnap.id.toLowerCase();
          loaded[uid] = {
            profile: data.profile || null,
            calendarData: data.calendarData || null,
            schedules: data.schedules || {},
            savedProtas: data.savedProtas || {},
            generatedModulAtps: data.generatedModulAtps || {},
            atpBatches: data.atpBatches || {},
            savedKktps: data.savedKktps || [],
            students: data.students || {},
            attendance: data.attendance || [],
            modulAjarHistories: data.modulAjarHistories || [],
            rombelConfig: data.rombelConfig || {},
            jurnalState: data.jurnalState || { bulan: 'JUNI 2026', pengawasNama: '', pengawasNip: '', items: {} },
            jurnalEntries: data.jurnalEntries || {},
            password: data.password || '123456',
            label: data.label || 'Demo',
            signupTime: data.signupTime || Date.now(),
            activeSessionId: data.activeSessionId || undefined
          };
        });

        // Ensure any existing local users on this device are also retained and synced
        const currentLocal = useStore.getState().usersData || {};
        Object.keys(currentLocal).forEach(uid => {
          if (!loaded[uid] && currentLocal[uid]) {
            loaded[uid] = currentLocal[uid];
            setDoc(doc(db, 'global_users', uid), {
              username: uid,
              ...currentLocal[uid]
            }, { merge: true }).catch(e => console.warn(e));
          }
        });

        setCloudUsers(loaded);
        setIsLoadingUsers(false);
        useStore.setState({ usersData: loaded });
      }, (error) => {
        console.warn("Admin users listener warning:", error);
        setIsLoadingUsers(false);
      });

      // 2. Realtime listener for upgrade requests
      unsubscribeRequests = onSnapshot(collection(db, 'upgrade_requests'), (snapshot) => {
        const loadedRequests: UpgradeRequest[] = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          loadedRequests.push({
            id: docSnap.id,
            namaLengkap: data.namaLengkap || '',
            noWhatsapp: data.noWhatsapp || '',
            username: data.username || '',
            timestamp: data.timestamp || Date.now(),
            status: data.status || 'pending'
          });
        });
        loadedRequests.sort((a, b) => a.timestamp - b.timestamp);
        useStore.setState({ upgradeRequests: loadedRequests });
      }, (error) => {
        console.warn("Admin upgrade requests listener warning:", error);
      });

    }).catch(err => {
      console.error(err);
      setIsLoadingUsers(false);
    });

    return () => {
      if (unsubscribeUsers) unsubscribeUsers();
      if (unsubscribeRequests) unsubscribeRequests();
    };
  }, [isAdminUnlocked, fetchAllData]);

  // Sync flashcards real-time from Firestore
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    import('../lib/firebase').then(({ db, doc, onSnapshot }) => {
      unsubscribe = onSnapshot(doc(db, 'app_config', 'flashcards'), (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data && Array.isArray(data.items)) {
            setFlashcards(data.items);
          }
        }
      }, (error) => {
        console.warn("Firestore flashcards listener warning:", error);
      });
    }).catch(err => console.error(err));

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [setFlashcards]);

  const handleVerifyAdminPin = (e: React.FormEvent) => {
    e.preventDefault();
    const input = pinInput.trim();
    const validPins = ['Admin#PAIBP2025', '123456', '998877', 'paibpsmart'];
    
    // Check if input is valid PIN / password
    if (validPins.includes(input)) {
      sessionStorage.setItem('paibp_admin_auth', 'true');
      setIsAdminUnlocked(true);
      setPinError('');
      showToast('Berhasil masuk ke Panel Admin dengan Kata Sandi Master.');
      return;
    }

    setPinError('Kata Sandi Admin atau PIN tidak valid. Gunakan "paibpsmart" atau login dengan Akun Google.');
  };

  const handleGoogleAdminLogin = async () => {
    setIsGoogleSigningIn(true);
    setPinError('');
    try {
      const { getFirebaseAuth, getGoogleAuthProvider, signInWithPopup } = await import('../lib/firebase');
      const auth = getFirebaseAuth();
      const googleProvider = getGoogleAuthProvider();
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const userEmail = user?.email?.toLowerCase();

      // Check authorized admin emails
      const authorizedEmails = ['miftahsidik695@gmail.com'];
      
      if (userEmail && authorizedEmails.includes(userEmail)) {
        sessionStorage.setItem('paibp_admin_auth', 'true');
        sessionStorage.setItem('paibp_admin_email', userEmail);
        setIsAdminUnlocked(true);
        showToast(`Selamat datang Admin (${userEmail})! Panel Admin Terbuka.`);
      } else {
        setPinError(`Akun Google (${userEmail || 'tidak diketahui'}) tidak memiliki hak akses administrator.`);
      }
    } catch (err: any) {
      console.warn("Google Sign-In error:", err);
      // If popup was closed or network error
      if (err.code === 'auth/popup-closed-by-user') {
        setPinError('Proses login Google dibatalkan.');
      } else if (err.code === 'auth/unauthorized-domain') {
        // Fallback info if domain not yet whitelisted in Firebase console
        setPinError('Domain belum diwhitelist di Firebase Auth. Silakan gunakan kata sandi "paibpsmart".');
      } else {
        setPinError(`Gagal login dengan Google: ${err.message || 'Silakan gunakan kata sandi paibpsmart'}`);
      }
    } finally {
      setIsGoogleSigningIn(false);
    }
  };

  const handleAdminLock = () => {
    sessionStorage.removeItem('paibp_admin_auth');
    sessionStorage.removeItem('paibp_admin_email');
    import('../lib/firebase').then(({ getFirebaseAuth, signOut }) => {
      try {
        const auth = getFirebaseAuth();
        signOut(auth).catch(() => {});
      } catch (_) {}
    });
    setIsAdminUnlocked(false);
  };

  const handleAddFlashcardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputTitle.trim()) {
      alert("Judul flashcard/video tidak boleh kosong!");
      return;
    }
    if (!inputUrl.trim()) {
      alert("Link URL tidak boleh kosong!");
      return;
    }
    addFlashcard(inputTitle, inputUrl);
    setInputTitle('');
    setInputUrl('');
    showToast("Berhasil menambahkan link flashcard video baru!");
  };

  const handleStartEditFlashcard = (f: { id: string; title: string; url: string }) => {
    setEditingFlashcardId(f.id);
    setEditFlashcardTitle(f.title);
    setEditFlashcardUrl(f.url);
  };

  const handleSaveEditFlashcard = (id: string) => {
    if (!editFlashcardTitle.trim() || !editFlashcardUrl.trim()) {
      alert("Judul dan link tidak boleh kosong!");
      return;
    }
    updateFlashcard(id, editFlashcardTitle, editFlashcardUrl);
    setEditingFlashcardId(null);
    showToast("Flashcard berhasil diperbarui!");
  };

  const handleDeleteFlashcardItem = (id: string, title: string) => {
    setFlashcardToDelete({ id, title });
  };

  const confirmDeleteFlashcard = () => {
    if (flashcardToDelete) {
      deleteFlashcard(flashcardToDelete.id);
      showToast(`Flashcard "${flashcardToDelete.title}" berhasil dihapus.`);
      setFlashcardToDelete(null);
    }
  };

  const handleResetPassword = (username: string) => {
    if (!newPassword.trim()) {
      alert("Sandi baru tidak boleh kosong!");
      return;
    }
    adminResetPassword(username, newPassword.trim());
    setResettingUser(null);
    setNewPassword('');
    showToast(`Sandi untuk ${username} berhasil disetel ulang!`);
  };

  const handleToggleLabel = (username: string, currentLabel?: 'Full Time' | 'Demo') => {
    const nextLabel = currentLabel === 'Full Time' ? 'Demo' : 'Full Time';
    adminSetLabel(username, nextLabel);
    showToast(`Label ${username} diubah menjadi ${nextLabel}!`);
  };

  const handleApprove = (req: UpgradeRequest) => {
    adminApproveUpgrade(req.id);
    showToast(`Permintaan ${req.namaLengkap} disetujui. Akses diubah ke Full Time!`);
  };

  const handleDeleteUser = (username: string) => {
    setUserToDelete(username);
  };

  const confirmDeleteUser = () => {
    if (userToDelete) {
      adminDeleteUser(userToDelete);
      showToast(`Pengguna ${userToDelete} berhasil dihapus.`);
      setUserToDelete(null);
    }
  };

  const handleUpdateUsername = (oldUsername: string) => {
    const trimmed = newUsername.trim().toLowerCase();
    if (!trimmed) {
      alert("Username baru tidak boleh kosong!");
      return;
    }
    if (usersData[trimmed]) {
      alert("Username tersebut sudah digunakan oleh pengguna lain.");
      return;
    }
    adminUpdateUsername(oldUsername, trimmed);
    setEditingUsernameUser(null);
    setNewUsername('');
    showToast(`Username ${oldUsername} berhasil diubah menjadi ${trimmed}.`);
  };

  // Convert usersData/cloudUsers object to array
  const activeUsers = Object.keys(cloudUsers).length > 0 ? cloudUsers : usersData;
  const usersList = Object.keys(activeUsers).map(username => ({
    username,
    ...activeUsers[username]
  }));

  const filteredUsers = usersList.filter(u => 
    u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.profile?.namaGuru?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.profile?.namaSekolah?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isAdminUnlocked) {
    return (
      <div className="min-h-screen bg-slate-900 font-sans text-slate-100 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-slate-800 border border-slate-700 rounded-3xl p-8 shadow-2xl shadow-black/50 text-center"
        >
          <div className="mx-auto w-16 h-16 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-2xl flex items-center justify-center mb-5 shadow-inner">
            <ShieldAlert size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight mb-2">Autentikasi Administrator</h1>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            Masuk menggunakan Akun Google resmi (<span className="text-rose-400 font-semibold">miftahsidik695@gmail.com</span>) atau gunakan kata sandi master untuk menyinkronkan seluruh data lisensi & pengguna dari cloud.
          </p>

          {/* Google Sign In Button */}
          <button
            type="button"
            onClick={handleGoogleAdminLogin}
            disabled={isGoogleSigningIn}
            className="w-full py-3.5 px-4 mb-4 bg-white hover:bg-slate-100 text-slate-800 rounded-2xl font-bold text-sm transition-all shadow-md flex items-center justify-center gap-3 active:scale-[0.99] disabled:opacity-60 border border-slate-300"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            {isGoogleSigningIn ? "Menghubungkan ke Google..." : "Login dengan Google (miftahsidik695)"}
          </button>

          <div className="flex items-center gap-3 my-4">
            <div className="h-px bg-slate-700/80 flex-1"></div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">atau masukkan sandi</span>
            <div className="h-px bg-slate-700/80 flex-1"></div>
          </div>

          <form onSubmit={handleVerifyAdminPin} className="space-y-4">
            <div>
              <input
                type="password"
                placeholder="Masukkan Sandi Master (paibpsmart)"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                className="w-full px-4 py-3.5 bg-slate-900/80 border border-slate-700 rounded-2xl text-center text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 transition-all font-mono text-sm tracking-wider"
                autoFocus
                required
              />
            </div>
            {pinError && (
              <p className="text-xs text-rose-400 font-medium px-2">{pinError}</p>
            )}
            <button
              type="submit"
              className="w-full py-3.5 px-4 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white rounded-2xl font-bold text-sm transition-all shadow-lg shadow-rose-900/30 active:scale-[0.99]"
            >
              Buka dengan Kata Sandi
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-700/60 flex items-center justify-center">
            <button
              onClick={() => navigate('/')}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft size={14} /> Kembali ke Aplikasi
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 p-6 md:p-12">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-2xl transition-all shadow-sm text-slate-600"
              title="Kembali ke Aplikasi"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <ShieldAlert className="text-rose-600" size={24} />
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Panel Admin PAIBP Smart</h1>
              </div>
              <p className="text-slate-500 text-sm mt-0.5">Kelola pengguna, sandi, dan status akses lisensi aplikasi.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                fetchAllData();
                showToast("Menyinkronkan data dari cloud server...");
              }}
              disabled={isLoadingUsers}
              className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3.5 py-2 rounded-2xl border border-indigo-200 text-xs font-semibold transition-all shadow-sm disabled:opacity-60"
              title="Sinkronkan Ulang Cloud"
            >
              <RefreshCw size={15} className={isLoadingUsers ? "animate-spin text-indigo-600" : ""} />
              {isLoadingUsers ? "Memuat..." : "Refresh Cloud"}
            </button>
            <button
              onClick={handleAdminLock}
              className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 px-3.5 py-2 rounded-2xl border border-rose-200 text-xs font-semibold transition-all shadow-sm"
              title="Kunci Panel Admin"
            >
              <Key size={15} /> Kunci Panel
            </button>
            <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 px-4 py-2 rounded-2xl border border-emerald-100 text-sm font-semibold">
              <Award size={18} />
              {sessionStorage.getItem('paibp_admin_email') 
                ? `Admin: ${sessionStorage.getItem('paibp_admin_email')}` 
                : 'Admin Mode Aktif'}
            </div>
          </div>
        </div>

         {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Total Pengguna</span>
              <div className="p-2.5 bg-slate-50 rounded-2xl text-slate-600">
                <Users size={20} />
              </div>
            </div>
            <h2 className="text-3xl font-black text-slate-900">{usersList.length}</h2>
            <p className="text-xs text-slate-500 mt-2">Akun terdaftar secara realtime di server cloud.</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Akun Demo Aktif</span>
              <div className="p-2.5 bg-amber-50 rounded-2xl text-amber-600">
                <Clock size={20} />
              </div>
            </div>
            <h2 className="text-3xl font-black text-slate-900">
              {usersList.filter(u => u.label !== 'Full Time').length}
            </h2>
            <p className="text-xs text-slate-500 mt-2">Akun demo yang terdaftar di database cloud.</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Pengajuan Upgrade</span>
              <div className="p-2.5 bg-rose-50 rounded-2xl text-rose-600">
                <UserCheck size={20} />
              </div>
            </div>
            <h2 className="text-3xl font-black text-slate-900">
              {(upgradeRequests || []).filter(r => r.status === 'pending').length}
            </h2>
            <p className="text-xs text-slate-500 mt-2">Menunggu persetujuan upgrade ke Full Time secara realtime.</p>
          </div>
        </div>

        {/* Flashcard & Video Link Management Section */}
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden mb-10">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-100 text-rose-600 rounded-xl">
                  <Youtube size={20} />
                </div>
                <h2 className="text-lg font-bold text-slate-900">Kelola Flashcard Media & Video YouTube (Tampil di Login)</h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Input judul dan link video (YouTube) yang akan tampil secara otomatis sebagai thumbnail flashcard di halaman login aplikasi.
              </p>
            </div>
            <span className="px-3 py-1 bg-rose-50 text-rose-700 border border-rose-100 rounded-full text-xs font-bold flex items-center gap-1.5">
              <Play size={12} fill="currentColor" />
              {(flashcards || []).length} Flashcard Aktif
            </span>
          </div>

          {/* Form Input Flashcard Baru */}
          <div className="p-6 bg-slate-50/40 border-b border-slate-100">
            <form onSubmit={handleAddFlashcardSubmit} className="space-y-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Form Input Flashcard / Video Baru</h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">1. Input Judul</label>
                  <input
                    type="text"
                    placeholder="Contoh: Panduan Modul Ajar PAIBP SD"
                    value={inputTitle}
                    onChange={(e) => setInputTitle(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">2. Input Link (URL YouTube)</label>
                  <input
                    type="url"
                    placeholder="Contoh: https://www.youtube.com/watch?v=..."
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-mono"
                    required
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-600/10 flex items-center justify-center gap-1.5"
                  >
                    <Plus size={16} />
                    Tambah Flashcard
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Tabel Daftar Flashcard */}
          <div className="overflow-x-auto">
            {(!flashcards || flashcards.length === 0) ? (
              <div className="p-12 text-center text-slate-400">
                <Youtube size={48} className="mx-auto text-slate-300 mb-3" />
                <p className="font-medium text-sm">Belum ada flashcard video yang ditambahkan.</p>
                <p className="text-xs text-slate-400 mt-1">Gunakan form di atas untuk memasukkan judul dan link video YouTube.</p>
              </div>
            ) : (
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase tracking-widest font-bold text-slate-400">
                    <th className="p-4 pl-6 text-center w-12">No</th>
                    <th className="p-4 w-36">Thumbnail</th>
                    <th className="p-4">Judul & Link URL Video</th>
                    <th className="p-4 text-center w-48">Aksi Manajemen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {flashcards.map((item, idx) => {
                    const isEditing = editingFlashcardId === item.id;
                    const thumbUrl = getYouTubeThumbnailUrl(item.url);

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 pl-6 text-center font-bold text-slate-400 text-xs">
                          {idx + 1}
                        </td>
                        <td className="p-4">
                          <div className="relative w-28 h-16 bg-slate-900 rounded-xl overflow-hidden border border-slate-200 group flex items-center justify-center shadow-sm">
                            {thumbUrl ? (
                              <img 
                                src={thumbUrl} 
                                alt={item.title} 
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                              />
                            ) : (
                              <div className="flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                                <Play size={20} className="text-rose-500 mb-1" />
                                <span className="text-[9px]">Web Link</span>
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                              <div className="w-7 h-7 bg-rose-600/90 text-white rounded-full flex items-center justify-center shadow">
                                <Play size={12} className="ml-0.5 fill-white" />
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          {isEditing ? (
                            <div className="space-y-2">
                              <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Input Judul</label>
                                <input
                                  type="text"
                                  value={editFlashcardTitle}
                                  onChange={(e) => setEditFlashcardTitle(e.target.value)}
                                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Input Link</label>
                                <input
                                  type="url"
                                  value={editFlashcardUrl}
                                  onChange={(e) => setEditFlashcardUrl(e.target.value)}
                                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono text-indigo-600 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <h4 className="font-bold text-slate-800 text-sm">{item.title}</h4>
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-rose-600 hover:underline font-mono truncate max-w-md"
                              >
                                <ExternalLink size={12} />
                                {item.url}
                              </a>
                            </div>
                          )}
                        </td>
                        <td className="p-4 pr-6 text-center">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleSaveEditFlashcard(item.id)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors flex items-center gap-1 shadow-sm"
                                title="Simpan Perubahan"
                              >
                                <Save size={14} /> Simpan
                              </button>
                              <button
                                onClick={() => setEditingFlashcardId(null)}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs transition-colors flex items-center gap-1"
                                title="Batal"
                              >
                                <X size={14} /> Batal
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleStartEditFlashcard(item)}
                                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs transition-colors flex items-center gap-1"
                                title="Edit Flashcard"
                              >
                                <Edit3 size={13} /> Edit
                              </button>
                              <button
                                onClick={() => handleDeleteFlashcardItem(item.id, item.title)}
                                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded-xl text-xs transition-colors flex items-center gap-1"
                                title="Hapus Flashcard"
                              >
                                <Trash2 size={13} /> Hapus
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Upgrade Requests Section */}
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden mb-10">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Histori Pengajuan Upgrade & Donasi</h2>
              <p className="text-xs text-slate-500 mt-0.5">Daftar pengguna demo yang telah mengirim pengajuan donasi kopi & rokok Rp 50.000.</p>
            </div>
            <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold">
              {(upgradeRequests || []).length} Pengajuan
            </span>
          </div>
          
          <div className="overflow-x-auto">
            {(!upgradeRequests || upgradeRequests.length === 0) ? (
              <div className="p-12 text-center text-slate-400">
                <UserCheck size={48} className="mx-auto text-slate-300 mb-3" />
                <p className="font-medium text-sm">Belum ada riwayat pengajuan upgrade lisensi.</p>
              </div>
            ) : (
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase tracking-widest font-bold text-slate-400">
                    <th className="p-4 pl-6">Tanggal</th>
                    <th className="p-4">Nama Lengkap</th>
                    <th className="p-4">No. WhatsApp</th>
                    <th className="p-4">Akun Terdaftar (Username)</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 pr-6 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {upgradeRequests.slice().reverse().map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 pl-6 text-slate-500">
                        {new Date(req.timestamp).toLocaleString('id-ID')}
                      </td>
                      <td className="p-4 font-bold text-slate-800">{req.namaLengkap}</td>
                      <td className="p-4 text-slate-600 font-mono">
                        <a 
                          href={`https://wa.me/${req.noWhatsapp.replace(/[^0-9]/g, '')}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="flex items-center gap-1.5 text-emerald-600 hover:underline font-semibold"
                        >
                          <Phone size={14} />
                          {req.noWhatsapp}
                        </a>
                      </td>
                      <td className="p-4 font-mono font-semibold text-indigo-600">{req.username}</td>
                      <td className="p-4 text-center">
                        {req.status === 'approved' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-xs font-bold">
                            <CheckCircle size={12} />
                            Full Time
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded-full text-xs font-bold">
                            <Clock size={12} />
                            Tertunda
                          </span>
                        )}
                      </td>
                      <td className="p-4 pr-6 text-center">
                        {req.status === 'pending' ? (
                          <button
                            onClick={() => handleApprove(req)}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/10 flex items-center gap-1 mx-auto"
                          >
                            <Check size={14} /> Setujui & Jadikan Full Time
                          </button>
                        ) : (
                          <span className="text-slate-400 text-xs font-medium">Selesai disetujui</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* User Management Section */}
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Kelola Pengguna Aplikasi</h2>
              <p className="text-xs text-slate-500 mt-0.5">Ubah lisensi atau setel ulang sandi pengguna terdaftar secara langsung.</p>
            </div>
            
            {/* Search Bar */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Cari Guru, sekolah, username..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            {isLoadingUsers && usersList.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <RefreshCw className="mx-auto text-indigo-500 mb-3 animate-spin" size={40} />
                <p className="font-bold text-sm text-slate-800">Menghubungkan ke Cloud Database...</p>
                <p className="text-xs text-slate-400 mt-1">Mengambil data pengguna terbaru secara langsung dari server.</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Users className="mx-auto text-slate-300 mb-3" size={48} />
                <p className="font-medium text-sm">Tidak menemukan pengguna yang cocok.</p>
              </div>
            ) : (
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase tracking-widest font-bold text-slate-400">
                    <th className="p-4 pl-6">Username / Akun</th>
                    <th className="p-4">Nama Lengkap (Guru)</th>
                    <th className="p-4">Sekolah</th>
                    <th className="p-4">Kata Sandi</th>
                    <th className="p-4 text-center">Status Label</th>
                    <th className="p-4 pr-6 text-center">Aksi Manajemen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredUsers.map((u) => {
                    const isFullTime = u.label === 'Full Time';
                    const sTime = u.signupTime || Date.now();
                    const eTime = sTime + 24 * 60 * 60 * 1000;
                    const isExpired = !isFullTime && Date.now() >= eTime;
                    const timeLeft = Math.max(0, eTime - Date.now());
                    const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
                    const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

                    return (
                      <tr key={u.username} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 pl-6 font-mono font-bold text-indigo-700">
                          {editingUsernameUser === u.username ? (
                            <div className="flex flex-col gap-2">
                              <input
                                type="text"
                                placeholder="Username baru..."
                                value={newUsername}
                                onChange={(e) => setNewUsername(e.target.value)}
                                className="px-2 py-1 border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                              />
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleUpdateUsername(u.username)}
                                  className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-[10px] font-bold transition-colors"
                                >
                                  Simpan
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingUsernameUser(null);
                                    setNewUsername('');
                                  }}
                                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-md text-[10px] font-bold transition-colors"
                                >
                                  Batal
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              {u.username}
                              <button
                                onClick={() => {
                                  setEditingUsernameUser(u.username);
                                  setNewUsername(u.username);
                                }}
                                className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                                title="Edit Username"
                              >
                                <RotateCcw size={12} />
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="p-4 font-semibold text-slate-700">
                          {u.profile?.namaGuru || <span className="text-slate-400 italic text-xs">Belum diisi</span>}
                        </td>
                        <td className="p-4 text-slate-500">
                          {u.profile?.namaSekolah || <span className="text-slate-400 italic text-xs">Belum diisi</span>}
                        </td>
                        <td className="p-4">
                          {resettingUser === u.username ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                placeholder="Sandi baru..."
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs w-28 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 font-mono"
                              />
                              <button
                                onClick={() => handleResetPassword(u.username)}
                                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors"
                              >
                                Simpan
                              </button>
                              <button
                                onClick={() => {
                                  setResettingUser(null);
                                  setNewPassword('');
                                }}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg text-xs font-bold transition-colors"
                              >
                                Batal
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="font-mono bg-slate-100 px-2 py-1 rounded-md text-xs font-semibold text-slate-600">
                                {u.password || "paibpsmart"}
                              </span>
                              <button
                                onClick={() => {
                                  setResettingUser(u.username);
                                  setNewPassword(u.password || '');
                                }}
                                className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                                title="Reset Kata Sandi"
                              >
                                <RotateCcw size={14} />
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => handleToggleLabel(u.username, u.label)}
                            className={`inline-flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-sm ${
                              isFullTime 
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-100 hover:bg-emerald-100' 
                                : isExpired
                                ? 'bg-rose-50 text-rose-800 border-rose-100 hover:bg-rose-100'
                                : 'bg-amber-50 text-amber-800 border-amber-100 hover:bg-amber-100'
                            }`}
                            title="Klik untuk mengubah label"
                          >
                            <span className="flex items-center gap-1">
                              {isFullTime ? '🚀 Full Time' : isExpired ? '🔒 Demo (Expired)' : '⏳ Demo'}
                            </span>
                            {!isFullTime && !isExpired && (
                              <span className="text-[9px] font-normal opacity-75">
                                {hoursLeft}j {minutesLeft}m tersisa
                              </span>
                            )}
                          </button>
                        </td>
                        <td className="p-4 pr-6 text-center">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <button
                              onClick={() => handleToggleLabel(u.username, u.label)}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1 w-full"
                            >
                              <RefreshCw size={12} />
                              Ubah Label ke {isFullTime ? "Demo" : "Full Time"}
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u.username)}
                              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1 w-full"
                            >
                              <Trash2 size={12} />
                              Hapus Akun
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Flashcard Delete Confirmation Modal */}
      {flashcardToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="p-3 bg-rose-100 rounded-2xl">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Hapus Flashcard / Video</h3>
                <p className="text-xs text-slate-500">Konfirmasi tindakan penghapusan media</p>
              </div>
            </div>
            <p className="text-slate-600 mb-6 text-sm leading-relaxed">
              Apakah Anda yakin ingin menghapus flashcard <span className="font-bold text-slate-900">"{flashcardToDelete.title}"</span>? Video ini tidak akan lagi tampil pada halaman login.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setFlashcardToDelete(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
              >
                Batal
              </button>
              <button
                onClick={confirmDeleteFlashcard}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 shadow-md shadow-rose-600/20"
              >
                <Trash2 size={15} />
                Ya, Hapus Flashcard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Konfirmasi Hapus Akun</h3>
            <p className="text-slate-600 mb-6 text-sm">
              Apakah Anda yakin ingin menghapus pengguna <span className="font-bold text-slate-800">'{userToDelete}'</span> secara permanen? Data tidak dapat dikembalikan.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-colors"
              >
                Batal
              </button>
              <button
                onClick={confirmDeleteUser}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm transition-colors"
              >
                Hapus Akun
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-sm font-semibold border border-slate-800">
          <Check className="text-emerald-400" size={18} />
          {toastMessage}
        </div>
      )}
    </div>
  );
}
