import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, updateDoc, deleteDoc, addDoc, query, where, limit } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { trackEvent } from './tracking';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();
export const ADMIN_SALES_EMAIL = 'asher205@gmail.com';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TRIAL_DAYS = 3;
const TRIAL_DURATION_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;

export { signInWithPopup, signInWithRedirect, onAuthStateChanged, signOut };

const normalizeIsoDate = (value: unknown): string | null => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString();
};

const computeTrialEndsAt = (trialStartedAt: string) => {
  return new Date(new Date(trialStartedAt).getTime() + TRIAL_DURATION_MS).toISOString();
};

export async function syncUserProfile(user: any) {
  if (!user) return null;

  const userRef = doc(db, 'users', user.uid);
  const userDoc = await getDoc(userRef);
  const isAdmin = user.email === ADMIN_SALES_EMAIL;

  if (!userDoc.exists()) {
    // Determine initial role
    const initialRole = isAdmin ? 'admin' : 'owner';

    const userData = {
      uid: user.uid,
      email: user.email,
      name: user.displayName || 'User',
      role: initialRole,
      plan: 'trial_3_days',
      subscriptionStatus: isAdmin ? 'active' : 'trial',
      trialStartedAt: isAdmin ? null : new Date().toISOString(),
      trialEndsAt: isAdmin ? null : computeTrialEndsAt(new Date().toISOString()),
      createdAt: new Date().toISOString(),
      storeIds: [],
      photoURL: user.photoURL,
      sharedAccess: [],
      sharedAccessEmails: [],
      sharedEditorsEmails: []
    };

    await setDoc(userRef, userData);
    return userData;
  }

  const existing = userDoc.data() as Record<string, any>;
  const updates: Record<string, any> = {};

  if (!isAdmin && existing.subscriptionStatus === 'trial') {
    const trialStartedAt =
      normalizeIsoDate(existing.trialStartedAt) ||
      normalizeIsoDate(existing.createdAt) ||
      new Date().toISOString();
    const trialEndsAt = normalizeIsoDate(existing.trialEndsAt) || computeTrialEndsAt(trialStartedAt);
    if (existing.trialStartedAt !== trialStartedAt) updates.trialStartedAt = trialStartedAt;
    if (existing.trialEndsAt !== trialEndsAt) updates.trialEndsAt = trialEndsAt;
    if (Date.parse(trialEndsAt) <= Date.now()) {
      updates.subscriptionStatus = 'demo';
      updates.plan = 'demo';
      updates.trialExpiredAt = new Date().toISOString();
    }
  }

  if (Object.keys(updates).length > 0) {
    await setDoc(userRef, updates, { merge: true });
  }

  return { ...existing, ...updates };
}

export type SharedAccessRole = 'manager' | 'viewer';

export interface SharedAccessEntry {
  email: string;
  role: SharedAccessRole;
  createdAt: string;
  invitedByUid?: string;
  invitedByEmail?: string;
}

export interface WorkspaceScope {
  ownerUid: string;
  accessMode: 'owner' | 'shared';
  ownerName?: string;
  ownerEmail?: string;
  sharedRole?: SharedAccessRole;
}

const normalizeEmail = (value: string | undefined | null) => (value || '').trim().toLowerCase();

const normalizeSharedAccessList = (raw: unknown): SharedAccessEntry[] => {
  if (!Array.isArray(raw)) return [];
  const entries: SharedAccessEntry[] = [];
  raw.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const row = item as Record<string, unknown>;
    const email = normalizeEmail(typeof row.email === 'string' ? row.email : '');
    if (!email || !EMAIL_REGEX.test(email)) return;
    const role: SharedAccessRole = row.role === 'viewer' ? 'viewer' : 'manager';
    entries.push({
      email,
      role,
      createdAt: typeof row.createdAt === 'string' ? row.createdAt : new Date().toISOString(),
      invitedByUid: typeof row.invitedByUid === 'string' ? row.invitedByUid : undefined,
      invitedByEmail: typeof row.invitedByEmail === 'string' ? row.invitedByEmail : undefined,
    });
  });
  return entries;
};

export async function getUserSharedAccess(uid: string): Promise<SharedAccessEntry[]> {
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return [];
  return normalizeSharedAccessList(snap.data().sharedAccess);
}

export async function upsertUserSharedAccess(
  uid: string,
  invitedEmail: string,
  role: SharedAccessRole,
  inviter?: { uid?: string; email?: string | null }
): Promise<SharedAccessEntry[]> {
  const email = normalizeEmail(invitedEmail);
  if (!EMAIL_REGEX.test(email)) {
    throw new Error('Invalid email');
  }

  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  const ownerEmail = normalizeEmail(snap.data()?.email as string | undefined);
  if (ownerEmail && email === ownerEmail) {
    throw new Error('Cannot share with yourself');
  }

  const current = normalizeSharedAccessList(snap.data()?.sharedAccess);
  const existing = current.find((entry) => entry.email === email);
  const nextEntry: SharedAccessEntry = {
    email,
    role,
    createdAt: existing?.createdAt || new Date().toISOString(),
    invitedByUid: inviter?.uid || existing?.invitedByUid,
    invitedByEmail: normalizeEmail(inviter?.email) || existing?.invitedByEmail,
  };
  const next = [...current.filter((entry) => entry.email !== email), nextEntry];
  const sharedAccessEmails = Array.from(new Set(next.map((entry) => entry.email)));
  const sharedEditorsEmails = Array.from(
    new Set(next.filter((entry) => entry.role === 'manager').map((entry) => entry.email))
  );

  await setDoc(
    userRef,
    {
      sharedAccess: next,
      sharedAccessEmails,
      sharedEditorsEmails,
    },
    { merge: true }
  );
  return next;
}

export async function removeUserSharedAccess(uid: string, invitedEmail: string): Promise<SharedAccessEntry[]> {
  const email = normalizeEmail(invitedEmail);
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  const current = normalizeSharedAccessList(snap.data()?.sharedAccess);
  const next = current.filter((entry) => entry.email !== email);
  const sharedAccessEmails = Array.from(new Set(next.map((entry) => entry.email)));
  const sharedEditorsEmails = Array.from(
    new Set(next.filter((entry) => entry.role === 'manager').map((entry) => entry.email))
  );
  await setDoc(
    userRef,
    {
      sharedAccess: next,
      sharedAccessEmails,
      sharedEditorsEmails,
    },
    { merge: true }
  );
  return next;
}

export async function resolveWorkspaceScope(user: { uid: string; email?: string | null } | null): Promise<WorkspaceScope | null> {
  if (!user?.uid) return null;
  const myEmail = normalizeEmail(user.email);
  const myRef = doc(db, 'users', user.uid);
  const mySnap = await getDoc(myRef);
  const myData = mySnap.exists() ? mySnap.data() : {};

  if (!myEmail) {
    return {
      ownerUid: user.uid,
      accessMode: 'owner',
      ownerName: typeof myData?.name === 'string' ? myData.name : undefined,
      ownerEmail: typeof myData?.email === 'string' ? myData.email : undefined,
    };
  }

  const ownersRef = collection(db, 'users');
  const q = query(ownersRef, where('sharedAccessEmails', 'array-contains', myEmail), limit(5));
  const sharedSnap = await getDocs(q);
  const ownerDoc = sharedSnap.docs.find((row) => row.id !== user.uid);
  if (!ownerDoc) {
    return {
      ownerUid: user.uid,
      accessMode: 'owner',
      ownerName: typeof myData?.name === 'string' ? myData.name : undefined,
      ownerEmail: typeof myData?.email === 'string' ? myData.email : undefined,
    };
  }

  const ownerData = ownerDoc.data();
  const sharedAccess = normalizeSharedAccessList(ownerData.sharedAccess);
  const role = sharedAccess.find((entry) => entry.email === myEmail)?.role;

  return {
    ownerUid: ownerDoc.id,
    accessMode: 'shared',
    ownerName: typeof ownerData.name === 'string' ? ownerData.name : undefined,
    ownerEmail: typeof ownerData.email === 'string' ? ownerData.email : undefined,
    sharedRole: role,
  };
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
  syncedPlatforms?: AudiencePlatform[];
  syncStatusByPlatform?: Partial<Record<AudiencePlatform, 'pending' | 'synced' | 'failed'>>;
  externalIdsByPlatform?: Partial<Record<AudiencePlatform, string>>;
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
  const createdAt = new Date().toISOString();
  const safeName = (input.name || '').trim().slice(0, 120);
  const safeEmail = (input.email || '').trim().slice(0, 200);
  const safePhone = (input.phone || '').trim().slice(0, 80);
  const safeSourcePath = (input.sourcePath || '/').trim().slice(0, 300);
  const safeMessage = (input.message || '').trim().slice(0, 4000);
  const safeWebsite = (input.website || '').trim().slice(0, 500);
  const safeAssignedAdmin = (input.assignedAdminEmail || ADMIN_SALES_EMAIL).trim().slice(0, 200);

  const payload: Omit<SalesLead, 'id'> = {
    name: safeName,
    email: safeEmail,
    phone: safePhone,
    website: safeWebsite,
    sourcePath: safeSourcePath,
    message: safeMessage,
    assignedAdminEmail: safeAssignedAdmin,
    createdAt,
    status: 'new',
    readBy: {},
  };

  try {
    const ref = await addDoc(collection(db, 'salesLeads'), payload);
    trackEvent('bscale_lead_submit', {
      source: safeSourcePath || 'unknown',
      has_email: Boolean(safeEmail),
      has_phone: Boolean(safePhone),
    });
    return ref.id;
  } catch (error) {
    // Fallback for stricter legacy rules that may reject extra fields.
    const minimalPayload = {
      name: safeName,
      email: safeEmail,
      phone: safePhone,
      sourcePath: safeSourcePath,
      message: safeMessage,
      createdAt,
      status: 'new' as const,
    };
    try {
      const ref = await addDoc(collection(db, 'salesLeads'), minimalPayload);
      trackEvent('bscale_lead_submit', {
        source: safeSourcePath || 'unknown',
        has_email: Boolean(safeEmail),
        has_phone: Boolean(safePhone),
        mode: 'fallback_minimal_payload',
      });
      return ref.id;
    } catch (fallbackError) {
      console.error('createPublicSalesLead failed (full + minimal payload):', error, fallbackError);
      throw fallbackError;
    }
  }
}
