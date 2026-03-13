import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, updateDoc, deleteDoc, addDoc } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();
export const ADMIN_SALES_EMAIL = 'asher205@gmail.com';

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
      plan: 'demo',
      subscriptionStatus: 'demo',
      createdAt: new Date().toISOString(),
      storeIds: [],
      photoURL: user.photoURL
    };

    await setDoc(userRef, userData);
    return userData;
  }

  return userDoc.data();
}

export interface AutoAdsSchedule {
  enabled: boolean;
  frequency: 'daily' | 'every_3_days' | 'weekly';
  platforms: ('google' | 'meta' | 'tiktok')[];
  productLimit: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
}

export async function getAutoAdsSchedule(uid: string): Promise<AutoAdsSchedule | null> {
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  const data = snap.data();
  return (data?.autoAdsSchedule as AutoAdsSchedule) || null;
}

export async function setAutoAdsSchedule(uid: string, schedule: Partial<AutoAdsSchedule>) {
  const userRef = doc(db, 'users', uid);
  await setDoc(userRef, { autoAdsSchedule: schedule }, { merge: true });
}

export interface SavedAd {
  id: string;
  type: 'copy' | 'image';
  createdAt: string;
  productName?: string;
  payload: {
    headline?: string;
    primaryText?: string;
    description?: string;
    imageDataUrl?: string;
    overlayHeadline?: string;
    overlayCta?: string;
  };
}

export async function getSavedAds(uid: string): Promise<SavedAd[]> {
  const ref = collection(db, 'users', uid, 'savedAds');
  const snap = await getDocs(ref);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as SavedAd));
}

export async function saveAdToFirestore(uid: string, ad: Omit<SavedAd, 'id'>): Promise<string> {
  const ref = doc(collection(db, 'users', uid, 'savedAds'));
  const id = ref.id;
  await setDoc(ref, { ...ad, id });
  return id;
}

export type AudiencePlatform = 'google' | 'meta' | 'tiktok';

export interface AudienceRule {
  type?: string;
  name?: string;
  value?: string | number | string[];
  [key: string]: unknown;
}

export interface Audience {
  id: string;
  name: string;
  platform: AudiencePlatform;
  description?: string;
  rules: AudienceRule[];
  estimatedSize?: number;
  status: 'draft' | 'active' | 'learning';
  syncedToPlatform: boolean;
  externalId?: string;
  createdAt: string;
  updatedAt: string;
}

export async function getAudiences(uid: string): Promise<Audience[]> {
  const ref = collection(db, 'users', uid, 'audiences');
  const snap = await getDocs(ref);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Audience));
}

export async function saveAudience(uid: string, audience: Omit<Audience, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const ref = doc(collection(db, 'users', uid, 'audiences'));
  const id = ref.id;
  const now = new Date().toISOString();
  await setDoc(ref, { ...audience, id, createdAt: now, updatedAt: now });
  return id;
}

export async function updateAudience(uid: string, id: string, data: Partial<Omit<Audience, 'id' | 'createdAt'>>): Promise<void> {
  const ref = doc(db, 'users', uid, 'audiences', id);
  await updateDoc(ref, { ...data, updatedAt: new Date().toISOString() });
}

export async function deleteAudience(uid: string, id: string): Promise<void> {
  const ref = doc(db, 'users', uid, 'audiences', id);
  await deleteDoc(ref);
}

export interface SalesLeadInput {
  name: string;
  email?: string;
  phone?: string;
  website?: string;
  sourcePath?: string;
  message?: string;
  assignedAdminEmail?: string;
}

export interface SalesLead extends SalesLeadInput {
  id: string;
  createdAt: string;
  status: 'new' | 'contacted' | 'closed';
  readBy?: Record<string, string>;
}

export async function createPublicSalesLead(input: SalesLeadInput): Promise<string> {
  const payload: Omit<SalesLead, 'id'> = {
    name: input.name.trim(),
    email: input.email?.trim() || '',
    phone: input.phone?.trim() || '',
    website: input.website?.trim() || '',
    sourcePath: input.sourcePath?.trim() || '/',
    message: input.message?.trim() || '',
    assignedAdminEmail: input.assignedAdminEmail?.trim() || ADMIN_SALES_EMAIL,
    createdAt: new Date().toISOString(),
    status: 'new',
    readBy: {},
  };

  const ref = await addDoc(collection(db, 'salesLeads'), payload);
  return ref.id;
}
