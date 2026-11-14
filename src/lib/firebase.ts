import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  getDocs,
  deleteDoc,
  DocumentReference,
  SetOptions,
} from 'firebase/firestore';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  browserLocalPersistence,
  setPersistence,
} from 'firebase/auth';

const firebaseConfig = {
  projectId: "gen-lang-client-0404668865",
  appId: "1:616219540712:web:2239323785ce35af425d5d",
  apiKey: "AIzaSyC_-qMYvivl13cl03G6Yczg87hPgFUZcIA",
  authDomain: "gen-lang-client-0404668865.firebaseapp.com",
  storageBucket: "gen-lang-client-0404668865.firebasestorage.app",
  messagingSenderId: "616219540712"
};

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app, "ai-studio-paibpsdapp-f8f3d217-88ba-4911-80ce-e3e8e97205e7");

const QUOTA_PAUSE_KEY = 'paibp_firestore_quota_pause_until';
const QUOTA_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes
let memoryQuotaPausedUntil = 0;

export function isFirestoreQuotaPaused(): boolean {
  const now = Date.now();
  if (memoryQuotaPausedUntil > now) return true;
  try {
    const raw = sessionStorage.getItem(QUOTA_PAUSE_KEY);
    if (raw) {
      const until = Number(raw);
      if (Number.isFinite(until) && until > now) {
        memoryQuotaPausedUntil = until;
        return true;
      }
      sessionStorage.removeItem(QUOTA_PAUSE_KEY);
    }
  } catch {
    // ignore storage errors
  }
  return false;
}

export function isFirestoreQuotaError(err: any): boolean {
  const code = String(err?.code || '').toLowerCase();
  const message = String(err?.message || '').toLowerCase();
  return (
    code.includes('resource-exhausted') ||
    message.includes('resource-exhausted') ||
    message.includes('quota limit exceeded') ||
    message.includes('quota exceeded')
  );
}

export function markFirestoreQuotaExceeded(): void {
  const until = Date.now() + QUOTA_COOLDOWN_MS;
  memoryQuotaPausedUntil = until;
  try {
    sessionStorage.setItem(QUOTA_PAUSE_KEY, String(until));
  } catch {
    // ignore storage errors
  }
}

export async function safeSetDoc(
  ref: DocumentReference<any>,
  data: any,
  options?: SetOptions
): Promise<boolean> {
  if (isFirestoreQuotaPaused()) {
    return false;
  }
  try {
    if (options) {
      await setDoc(ref, data, options);
    } else {
      await setDoc(ref, data);
    }
    return true;
  } catch (err: any) {
    if (isFirestoreQuotaError(err)) {
      markFirestoreQuotaExceeded();
      console.warn('Firestore quota exceeded; data disimpan aman di penyimpanan lokal.');
      return false;
    }
    console.warn('Firestore safeSetDoc warning:', err);
    return false;
  }
}

export async function safeUpdateDoc(
  ref: DocumentReference<any>,
  data: any
): Promise<boolean> {
  if (isFirestoreQuotaPaused()) {
    return false;
  }
  try {
    await updateDoc(ref, data);
    return true;
  } catch (err: any) {
    if (isFirestoreQuotaError(err)) {
      markFirestoreQuotaExceeded();
      console.warn('Firestore quota exceeded; data disimpan aman di penyimpanan lokal.');
      return false;
    }
    console.warn('Firestore safeUpdateDoc warning:', err);
    return false;
  }
}

export async function safeDeleteDoc(ref: DocumentReference<any>): Promise<boolean> {
  if (isFirestoreQuotaPaused()) {
    return false;
  }
  try {
    await deleteDoc(ref);
    return true;
  } catch (err: any) {
    if (isFirestoreQuotaError(err)) {
      markFirestoreQuotaExceeded();
      console.warn('Firestore quota exceeded; perubahan disimpan aman di penyimpanan lokal.');
      return false;
    }
    console.warn('Firestore safeDeleteDoc warning:', err);
    return false;
  }
}

export const getFirebaseAuth = () => {
  return getAuth(app);
};

export const getGoogleAuthProvider = () => {
  return new GoogleAuthProvider();
};

export {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  getDocs,
  deleteDoc,
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  browserLocalPersistence,
  setPersistence,
  getAuth,
  GoogleAuthProvider
};
