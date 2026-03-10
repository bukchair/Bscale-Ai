import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

export { signInWithPopup, signInWithRedirect, onAuthStateChanged, signOut };

export async function syncUserProfile(user: any) {
  if (!user) return null;

  const userRef = doc(db, 'users', user.uid);
  const userDoc = await getDoc(userRef);

  if (!userDoc.exists()) {
    // Determine initial role
    const isAdmin = user.email === 'asher205@gmail.com';
    const initialRole = isAdmin ? 'admin' : 'owner';

    const userData = {
      uid: user.uid,
      email: user.email,
      name: user.displayName || 'User',
      role: initialRole,
      createdAt: new Date().toISOString(),
      storeIds: [],
      photoURL: user.photoURL
    };

    await setDoc(userRef, userData);
    return userData;
  }

  return userDoc.data();
}
