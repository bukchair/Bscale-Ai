import { useEffect, useMemo, useState } from 'react';
import type { Audience, AudiencePlatform, AudienceRule } from '../../lib/firebase';

async function apiFetchAudiences(): Promise<Audience[]> {
  const res = await fetch('/api/audiences', { credentials: 'include' });
  if (!res.ok) return [];
  const d = (await res.json()) as { audiences?: Audience[] };
  return d.audiences ?? [];
}

async function apiSaveAudience(payload: Omit<Audience, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const res = await fetch('/api/audiences', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  const d = (await res.json()) as { id?: string };
  return d.id ?? '';
}

async function apiUpdateAudience(id: string, data: Partial<Omit<Audience, 'id' | 'createdAt'>>): Promise<void> {
  await fetch(`/api/audiences/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
}

async function apiDeleteAudience(id: string): Promise<void> {
  await fetch(`/api/audiences/${id}`, { method: 'DELETE', credentials: 'include' });
}
import { getAudienceRecommendations, getAIKeysFromConnections, type AudienceRecommendation } from '../../lib/gemini';
import type { Connection } from '../../contexts/ConnectionsContext';
import { fetchMetaCampaigns, isMetaRateLimitMessage } from '../../services/metaService';
import { fetchGoogleCampaigns } from '../../services/googleService';
import { fetchTikTokCampaigns } from '../../services/tiktokService';

// ── Constants ─────────────────────────────────────────────────────────────────

export const platformLabels: Record<AudiencePlatform, string> = {
  google: 'Google',
  meta: 'Meta',
  tiktok: 'TikTok',
};

export const ALL_AUDIENCE_PLATFORMS: AudiencePlatform[] = ['google', 'meta', 'tiktok'];

export const statusLabels: Record<Audience['status'], string> = {
  draft: 'טיוטה',
  active: 'פעיל',
  learning: 'למידה',
};

function buildPlatformDataSummary(
  connections: { id: string; status: string; settings?: Record<string, string> }[],
  campaignsByPlatform: Record<string, unknown>
): string {
  const parts: string[] = [];
  for (const c of connections) {
    if (c.id !== 'google' && c.id !== 'meta' && c.id !== 'tiktok') continue;
    const name = platformLabels[c.id as AudiencePlatform] || c.id;
    const status = c.status === 'connected' ? 'מחובר' : 'לא מחובר';
    parts.push(`${name}: ${status}.`);
    const data = campaignsByPlatform[c.id];
    if (data && Array.isArray(data)) {
      parts.push(`קמפיינים: ${(data as unknown[]).length}. דוגמאות: ${JSON.stringify((data as unknown[]).slice(0, 2)).slice(0, 200)}.`);
    }
  }
  return parts.length
    ? parts.join(' ')
    : 'אין נתוני פלטפורמות מחוברים. הצע קהלים כלליים ל-Google, Meta ו-TikTok.';
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseAudiencesProps {
  connections: Connection[];
  dataOwnerUid: string | null | undefined;
  isWorkspaceReadOnly: boolean;
  isHebrew: boolean;
}

export function useAudiences({ connections, dataOwnerUid, isWorkspaceReadOnly, isHebrew }: UseAudiencesProps) {
  const uid = dataOwnerUid;
  const aiKeys = getAIKeysFromConnections(connections);

  // ── State ──────────────────────────────────────────────────────────────────
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    platform: 'meta' as AudiencePlatform,
    description: '',
    rules: [] as AudienceRule[],
    estimatedSize: undefined as number | undefined,
    status: 'draft' as Audience['status'],
  });
  const [recommendations, setRecommendations] = useState<AudienceRecommendation[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [platformDataCache, setPlatformDataCache] = useState<string>('');
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncAllOnSave, setSyncAllOnSave] = useState(true);
  const [bulkSyncLoading, setBulkSyncLoading] = useState(false);

  // ── Derived ────────────────────────────────────────────────────────────────
  const connectedPlatforms = useMemo(() => {
    const connectedIds = new Set(
      connections
        .filter((c) => c.status === 'connected' && ALL_AUDIENCE_PLATFORMS.includes(c.id as AudiencePlatform))
        .map((c) => c.id as AudiencePlatform)
    );
    return ALL_AUDIENCE_PLATFORMS.filter((p) => connectedIds.has(p));
  }, [connections]);

  // ── Effect: load audiences ─────────────────────────────────────────────────
  useEffect(() => {
    if (!uid) return;
    apiFetchAudiences().then(setAudiences).finally(() => setLoading(false));
  }, [uid]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3000);
  };

  const resolveSyncTargets = (audience: Audience, includeAllConnected: boolean): AudiencePlatform[] => {
    if (includeAllConnected) return connectedPlatforms.length ? connectedPlatforms : [audience.platform];
    return [audience.platform];
  };

  const syncAudiencePlatforms = async (
    audience: Audience,
    includeAllConnected: boolean
  ): Promise<{
    syncedPlatforms: AudiencePlatform[];
    syncStatusByPlatform: NonNullable<Audience['syncStatusByPlatform']>;
    externalIdsByPlatform: NonNullable<Audience['externalIdsByPlatform']>;
    externalId?: string;
  }> => {
    const targets = resolveSyncTargets(audience, includeAllConnected);
    const syncStatusByPlatform: NonNullable<Audience['syncStatusByPlatform']> = { ...(audience.syncStatusByPlatform || {}) };
    const externalIdsByPlatform: NonNullable<Audience['externalIdsByPlatform']> = { ...(audience.externalIdsByPlatform || {}) };
    const synced = new Set<AudiencePlatform>(audience.syncedPlatforms || []);

    for (const platform of targets) {
      try {
        syncStatusByPlatform[platform] = 'pending';
        await new Promise((r) => setTimeout(r, 450));
        const externalId = `ext-${platform}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        externalIdsByPlatform[platform] = externalId;
        synced.add(platform);
        syncStatusByPlatform[platform] = 'synced';
      } catch {
        syncStatusByPlatform[platform] = 'failed';
      }
    }
    return {
      syncedPlatforms: Array.from(synced),
      syncStatusByPlatform,
      externalIdsByPlatform,
      externalId: externalIdsByPlatform[audience.platform] || audience.externalId,
    };
  };

  const fetchPlatformData = async (): Promise<string> => {
    const result: Record<string, unknown> = {};
    const meta = connections.find((c) => c.id === 'meta');
    const metaToken = meta?.status === 'connected' ? meta.settings?.metaToken || 'server-managed' : '';
    if (meta?.status === 'connected' && metaToken) {
      try {
        const acc = meta.settings?.metaAdsId || meta.settings?.adAccountId || meta.settings?.metaAdAccountId;
        result.meta = await fetchMetaCampaigns(metaToken, acc || undefined);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        result.meta = isMetaRateLimitMessage(message) ? [] : [{ error: String(e) }];
      }
    }
    const google = connections.find((c) => c.id === 'google');
    const googleToken = google?.status === 'connected' ? google.settings?.googleAccessToken || 'server-managed' : '';
    if (google?.status === 'connected' && googleToken) {
      try {
        const cid = google.settings?.googleAdsId || google.settings?.customerId || google.settings?.googleCustomerId;
        result.google = await fetchGoogleCampaigns(googleToken, cid || undefined, google.settings?.loginCustomerId);
      } catch (e) {
        result.google = [{ error: String(e) }];
      }
    }
    const tiktok = connections.find((c) => c.id === 'tiktok');
    if (tiktok?.status === 'connected' && (tiktok.settings?.tiktokToken || tiktok.settings?.tiktokAccessToken)) {
      try {
        const adv = tiktok.settings?.tiktokAdvertiserId || tiktok.settings?.advertiserId;
        const token = tiktok.settings?.tiktokToken || tiktok.settings?.tiktokAccessToken;
        if (adv && token) result.tiktok = await fetchTikTokCampaigns(token, adv);
      } catch (e) {
        result.tiktok = [{ error: String(e) }];
      }
    }
    return buildPlatformDataSummary(connections, result);
  };

  const loadRecommendations = async () => {
    setRecommendationsLoading(true);
    try {
      const summary = await fetchPlatformData();
      setPlatformDataCache(summary);
      const { recommendations: recs } = await getAudienceRecommendations(summary, aiKeys);
      setRecommendations(recs || []);
    } catch (e) {
      console.warn(e);
      showToast('טעינת ההמלצות נכשלה.');
    } finally {
      setRecommendationsLoading(false);
    }
  };

  const openCreate = (prefill?: Partial<typeof form> | AudienceRecommendation) => {
    if (isWorkspaceReadOnly) return;
    setSyncAllOnSave(true);
    if (prefill && 'suggestedName' in prefill) {
      const r = prefill as AudienceRecommendation;
      const platformMap = { Google: 'google' as const, Meta: 'meta' as const, TikTok: 'tiktok' as const, cross: 'meta' as const };
      setForm({
        name: r.suggestedName || '',
        platform: platformMap[r.platform] || 'meta',
        description: r.description || '',
        rules: r.suggestedRules || [],
        estimatedSize: r.estimatedSize ? parseInt(String(r.estimatedSize).replace(/,/g, ''), 10) : undefined,
        status: 'draft',
      });
    } else if (prefill) {
      setForm((prev) => ({ ...prev, ...(prefill as Partial<typeof prev>) }));
    } else {
      setForm({ name: '', platform: 'meta', description: '', rules: [], estimatedSize: undefined, status: 'draft' });
    }
    setEditingId(null);
    setModalOpen(true);
  };

  const openEdit = (a: Audience) => {
    if (isWorkspaceReadOnly) return;
    setSyncAllOnSave(false);
    setForm({ name: a.name, platform: a.platform, description: a.description || '', rules: a.rules || [], estimatedSize: a.estimatedSize, status: a.status });
    setEditingId(a.id);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (isWorkspaceReadOnly) { showToast('אין הרשאת עריכה. המשתמש מוגדר לצפייה בלבד.'); return; }
    if (!uid || !form.name.trim()) { showToast('יש להזין שם קהל.'); return; }
    try {
      const existingAudience = editingId ? audiences.find((a) => a.id === editingId) : undefined;
      const payload = {
        name: form.name.trim(),
        platform: form.platform,
        description: form.description.trim() || undefined,
        rules: form.rules,
        estimatedSize: form.estimatedSize,
        status: form.status,
        syncedToPlatform: existingAudience?.syncedToPlatform ?? false,
        syncedPlatforms: (existingAudience?.syncedPlatforms || []) as AudiencePlatform[],
        syncStatusByPlatform: (existingAudience?.syncStatusByPlatform || {}) as Audience['syncStatusByPlatform'],
        externalIdsByPlatform: (existingAudience?.externalIdsByPlatform || {}) as Audience['externalIdsByPlatform'],
        externalId: existingAudience?.externalId,
      };
      let savedAudience: Audience;
      if (editingId) {
        await apiUpdateAudience(editingId, payload);
        savedAudience = { id: editingId, createdAt: existingAudience?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(), ...payload };
        setAudiences((prev) => prev.map((a) => (a.id === editingId ? { ...a, ...savedAudience } : a)));
        showToast('הקהל עודכן.');
      } else {
        const id = await apiSaveAudience(payload);
        savedAudience = { id, ...payload, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        setAudiences((prev) => [...prev, savedAudience]);
        showToast('הקהל נוצר.');
      }
      if (syncAllOnSave) {
        setSyncingId(savedAudience.id);
        const syncedResult = await syncAudiencePlatforms(savedAudience, true);
        await apiUpdateAudience(savedAudience.id, {
          syncedToPlatform: syncedResult.syncedPlatforms.length > 0,
          syncedPlatforms: syncedResult.syncedPlatforms,
          syncStatusByPlatform: syncedResult.syncStatusByPlatform,
          externalIdsByPlatform: syncedResult.externalIdsByPlatform,
          externalId: syncedResult.externalId,
          status: syncedResult.syncedPlatforms.length > 0 ? 'active' : savedAudience.status,
        });
        setAudiences((prev) =>
          prev.map((a) =>
            a.id === savedAudience.id
              ? { ...a, syncedToPlatform: syncedResult.syncedPlatforms.length > 0, syncedPlatforms: syncedResult.syncedPlatforms, syncStatusByPlatform: syncedResult.syncStatusByPlatform, externalIdsByPlatform: syncedResult.externalIdsByPlatform, externalId: syncedResult.externalId, status: syncedResult.syncedPlatforms.length > 0 ? 'active' : a.status }
              : a
          )
        );
        showToast(
          isHebrew
            ? `הקהל סונכרן לכל הפלטפורמות המחוברות: ${syncedResult.syncedPlatforms.map((p) => platformLabels[p]).join(', ')}`
            : `Audience synced to connected platforms: ${syncedResult.syncedPlatforms.map((p) => platformLabels[p]).join(', ')}`
        );
      }
      setModalOpen(false);
    } catch {
      showToast('שמירה נכשלה.');
    } finally {
      setSyncingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (isWorkspaceReadOnly) { showToast('אין הרשאת עריכה. המשתמש מוגדר לצפייה בלבד.'); return; }
    if (!uid || !window.confirm('למחוק את הקהל?')) return;
    try {
      await apiDeleteAudience(id);
      setAudiences((prev) => prev.filter((a) => a.id !== id));
      showToast('הקהל נמחק.');
      setModalOpen(false);
    } catch { showToast('מחיקה נכשלה.'); }
  };

  const handleSyncToPlatform = async (a: Audience) => {
    if (isWorkspaceReadOnly) { showToast('אין הרשאת עריכה. המשתמש מוגדר לצפייה בלבד.'); return; }
    if (!uid) return;
    setSyncingId(a.id);
    try {
      const result = await syncAudiencePlatforms(a, false);
      await apiUpdateAudience(a.id, { syncedToPlatform: result.syncedPlatforms.length > 0, syncedPlatforms: result.syncedPlatforms, syncStatusByPlatform: result.syncStatusByPlatform, externalIdsByPlatform: result.externalIdsByPlatform, externalId: result.externalId, status: result.syncedPlatforms.length > 0 ? 'active' : a.status });
      setAudiences((prev) =>
        prev.map((x) =>
          x.id === a.id
            ? { ...x, syncedToPlatform: result.syncedPlatforms.length > 0, syncedPlatforms: result.syncedPlatforms, syncStatusByPlatform: result.syncStatusByPlatform, externalIdsByPlatform: result.externalIdsByPlatform, externalId: result.externalId, status: result.syncedPlatforms.length > 0 ? 'active' : x.status }
            : x
        )
      );
      showToast(isHebrew ? `הקהל נשלח ל-${platformLabels[a.platform]}.` : `Audience synced to ${platformLabels[a.platform]}.`);
    } catch { showToast('שליחה לפלטפורמה נכשלה.'); }
    finally { setSyncingId(null); }
  };

  const handleSyncToAllConnectedPlatforms = async (a: Audience) => {
    if (isWorkspaceReadOnly) { showToast('אין הרשאת עריכה. המשתמש מוגדר לצפייה בלבד.'); return; }
    if (!uid) return;
    if (connectedPlatforms.length === 0) { showToast(isHebrew ? 'אין פלטפורמות מחוברות לסנכרון.' : 'No connected platforms to sync.'); return; }
    setSyncingId(a.id);
    try {
      const result = await syncAudiencePlatforms(a, true);
      await apiUpdateAudience(a.id, { syncedToPlatform: result.syncedPlatforms.length > 0, syncedPlatforms: result.syncedPlatforms, syncStatusByPlatform: result.syncStatusByPlatform, externalIdsByPlatform: result.externalIdsByPlatform, externalId: result.externalId, status: result.syncedPlatforms.length > 0 ? 'active' : a.status });
      setAudiences((prev) =>
        prev.map((x) =>
          x.id === a.id
            ? { ...x, syncedToPlatform: result.syncedPlatforms.length > 0, syncedPlatforms: result.syncedPlatforms, syncStatusByPlatform: result.syncStatusByPlatform, externalIdsByPlatform: result.externalIdsByPlatform, externalId: result.externalId, status: result.syncedPlatforms.length > 0 ? 'active' : x.status }
            : x
        )
      );
      showToast(isHebrew ? `הקהל סונכרן לכל הפלטפורמות המחוברות: ${result.syncedPlatforms.map((p) => platformLabels[p]).join(', ')}.` : `Audience synced to all connected platforms: ${result.syncedPlatforms.map((p) => platformLabels[p]).join(', ')}.`);
    } catch { showToast(isHebrew ? 'סנכרון לכל הפלטפורמות נכשל.' : 'Sync to all platforms failed.'); }
    finally { setSyncingId(null); }
  };

  const handleBulkSyncAllAudiences = async () => {
    if (!uid || !audiences.length) return;
    if (connectedPlatforms.length === 0) { showToast(isHebrew ? 'אין פלטפורמות מחוברות לסנכרון.' : 'No connected platforms to sync.'); return; }
    setBulkSyncLoading(true);
    try {
      for (const audience of audiences) {
        const result = await syncAudiencePlatforms(audience, true);
        await apiUpdateAudience(audience.id, { syncedToPlatform: result.syncedPlatforms.length > 0, syncedPlatforms: result.syncedPlatforms, syncStatusByPlatform: result.syncStatusByPlatform, externalIdsByPlatform: result.externalIdsByPlatform, externalId: result.externalId, status: result.syncedPlatforms.length > 0 ? 'active' : audience.status });
        setAudiences((prev) =>
          prev.map((x) =>
            x.id === audience.id
              ? { ...x, syncedToPlatform: result.syncedPlatforms.length > 0, syncedPlatforms: result.syncedPlatforms, syncStatusByPlatform: result.syncStatusByPlatform, externalIdsByPlatform: result.externalIdsByPlatform, externalId: result.externalId, status: result.syncedPlatforms.length > 0 ? 'active' : x.status }
              : x
          )
        );
      }
      showToast(isHebrew ? 'כל הקהלים סונכרנו לכל הפלטפורמות המחוברות.' : 'All audiences synced to all connected platforms.');
    } catch { showToast(isHebrew ? 'סנכרון מרוכז נכשל.' : 'Bulk sync failed.'); }
    finally { setBulkSyncLoading(false); }
  };

  // ── Computed ───────────────────────────────────────────────────────────────
  const totalEstimated = audiences.reduce((s, a) => s + (a.estimatedSize || 0), 0);
  const activeCount = audiences.filter((a) => a.status === 'active').length;

  return {
    // state
    audiences,
    loading,
    toast,
    modalOpen, setModalOpen,
    editingId,
    form, setForm,
    recommendations,
    recommendationsLoading,
    platformDataCache,
    syncingId,
    syncAllOnSave, setSyncAllOnSave,
    bulkSyncLoading,
    // derived
    connectedPlatforms,
    totalEstimated,
    activeCount,
    // handlers
    openCreate,
    openEdit,
    handleSave,
    handleDelete,
    handleSyncToPlatform,
    handleSyncToAllConnectedPlatforms,
    handleBulkSyncAllAudiences,
    loadRecommendations,
  };
}
