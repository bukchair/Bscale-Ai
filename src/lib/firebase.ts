/**
 * Firebase has been removed. This file only contains type definitions
 * that are still referenced by other files via `import type`.
 * All runtime Firebase functionality has been migrated to REST API routes.
 */

export type SharedAccessRole = 'manager' | 'viewer';
export type InvitationStatus = 'pending' | 'accepted';

export interface SharedAccessEntry {
  email: string;
  role: SharedAccessRole;
  createdAt: string;
  invitedByUid?: string;
  invitedByEmail?: string;
  inviteToken?: string;
}

export interface InvitationDoc {
  token: string;
  ownerUid: string;
  invitedEmail: string;
  role: SharedAccessRole;
  status: InvitationStatus;
  createdAt: string;
  acceptedAt?: string;
}

export interface WorkspaceScope {
  ownerUid: string;
  accessMode: 'owner' | 'shared';
  ownerName?: string;
  ownerEmail?: string;
  sharedRole?: SharedAccessRole;
}

export interface AutoAdsSchedule {
  enabled: boolean;
  frequency: 'daily' | 'every_3_days' | 'weekly';
  platforms: ('google' | 'meta' | 'tiktok')[];
  productLimit: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
}

export interface BudgetAutomationSettings {
  enabled: boolean;
  targetRoas: number;
  minPlatformSpend: number;
  reallocationPercent: number;
  updatedAt?: string;
}

export interface BudgetPlatformAllocations {
  google: number;
  meta: number;
  tiktok: number;
  updatedAt?: string;
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
