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
  disableNetwork,
  setLogLevel,
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

const QUOTA_PAUSE_KEY = 'paibp_firestore_quota_pause_until_v2';
const QUOTA_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes
const WRITE_TIMEOUT_MS = 4500; // Abort & pause if Firestore WriteStream enters backoff
let memoryQuotaPausedUntil = 0;
let networkDisabledDueToQuota = false;

export function isFirestoreQuotaPaused(): boolean {
  const now = Date.now();
  if (memoryQuotaPausedUntil > now) return true;
  try {
    const raw = localStorage.getItem(QUOTA_PAUSE_KEY) || sessionStorage.getItem(QUOTA_PAUSE_KEY);
    if (raw) {
      const until = Number(raw);
      if (Number.isFinite(until) && until > now) {
        memoryQuotaPausedUntil = until;
        return true;
      }
      localStorage.removeItem(QUOTA_PAUSE_KEY);
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
    localStorage.setItem(QUOTA_PAUSE_KEY, String(until));
    sessionStorage.setItem(QUOTA_PAUSE_KEY, String(until));
  } catch {
    // ignore storage errors
  }
  if (!networkDisabledDueToQuota) {
    networkDisabledDueToQuota = true;
    try {
      setLogLevel('silent');
    } catch {
      // ignore
    }
    disableNetwork(db).catch(() => {});
  }
}

async function runWriteWithBackoffGuard(writeOp: () => Promise<void>): Promise<boolean> {
  if (isFirestoreQuotaPaused()) {
    return false;
  }

  let settled = false;
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error('resource-exhausted: Firestore write timed out in backoff'));
        }
      }, WRITE_TIMEOUT_MS);

      writeOp()
        .then(() => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve();
          }
        })
        .catch((err) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(err);
          }
        });
    });
    return true;
  } catch (err: any) {
    if (isFirestoreQuotaError(err)) {
      markFirestoreQuotaExceeded();
      return false;
    }
    console.warn('Firestore write warning:', err);
    return false;
  }
}

export async function safeSetDoc(
  ref: DocumentReference<any>,
  data: any,
  options?: SetOptions
): Promise<boolean> {
  return runWriteWithBackoffGuard(() =>
    options ? setDoc(ref, data, options) : setDoc(ref, data)
  );
}

export async function safeUpdateDoc(
  ref: DocumentReference<any>,
  data: any
): Promise<boolean> {
  return runWriteWithBackoffGuard(() => updateDoc(ref, data));
}

export async function safeDeleteDoc(ref: DocumentReference<any>): Promise<boolean> {
  return runWriteWithBackoffGuard(() => deleteDoc(ref));
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
