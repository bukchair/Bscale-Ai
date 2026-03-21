/**
 * Firestore persistence helpers for connection state.
 */

import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { AI_CONNECTION_IDS, PLATFORM_CONNECTION_IDS } from '../connectionsData';
import { stripUndefinedDeep } from '../connectionsUtils';
import type { Connection } from '../ConnectionsContext';

export const persistUserConnections = async (
  items: Connection[],
  dataOwnerUid: string | null
): Promise<void> => {
  const user = auth.currentUser;
  if (!user) return;
  const scopedOwnerUid = dataOwnerUid || user.uid;
  const ref = doc(db, 'users', scopedOwnerUid, 'settings', 'connections');
  try {
    await setDoc(ref, { items: stripUndefinedDeep(items) }, { merge: true });
  } catch (err) {
    console.error('Error persisting user connections:', err);
  }
};

export const persistGlobalAiConnections = async (items: Connection[]): Promise<void> => {
  const ref = doc(db, 'appSettings', 'connections');
  const aiOnly = items.filter((c) => (AI_CONNECTION_IDS as readonly string[]).includes(c.id));
  try {
    await setDoc(ref, { items: stripUndefinedDeep(aiOnly) }, { merge: true });
  } catch (err) {
    console.error('Error persisting global AI connections:', err);
  }
};

export const persistConnections = async (
  newConnections: Connection[],
  dataOwnerUid: string | null,
  updatedId?: string
): Promise<void> => {
  await persistUserConnections(newConnections, dataOwnerUid);
  if (updatedId && (AI_CONNECTION_IDS as readonly string[]).includes(updatedId)) {
    await persistGlobalAiConnections(newConnections);
  }
};
