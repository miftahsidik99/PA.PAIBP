import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDoc, updateDoc, onSnapshot, getDocs, deleteDoc } from 'firebase/firestore';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  browserLocalPersistence,
  setPersistence 
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


