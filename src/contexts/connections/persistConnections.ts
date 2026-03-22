/**
 * Connection persistence helpers — stores to /api/user/connections instead of Firestore.
 */

import { AI_CONNECTION_IDS, PLATFORM_CONNECTION_IDS } from '../connectionsData';
import { stripUndefinedDeep } from '../connectionsUtils';
import type { Connection } from '../ConnectionsContext';

export const persistUserConnections = async (
  items: Connection[],
  _dataOwnerUid: string | null
): Promise<void> => {
  try {
    await fetch('/api/user/connections', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ connections: stripUndefinedDeep(items) }),
    });
  } catch (err) {
    console.error('Error persisting user connections:', err);
  }
};

export const persistGlobalAiConnections = async (_items: Connection[]): Promise<void> => {
  // Global AI connections were previously stored in Firestore appSettings.
  // Now a no-op; AI key settings are stored per-user via persistUserConnections.
  void _items;
};

export const persistConnections = async (
  newConnections: Connection[],
  dataOwnerUid: string | null,
  updatedId?: string
): Promise<void> => {
  void updatedId;
  await persistUserConnections(newConnections, dataOwnerUid);
};

void PLATFORM_CONNECTION_IDS;
void AI_CONNECTION_IDS;
