import React, { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Users, Target, Zap, Plus, ArrowLeft, BarChart2, Pencil, Trash2, Send, Loader2, X, Sparkles, Globe2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { auth } from '../lib/firebase';
import {
  getAudiences,
  saveAudience,
  updateAudience,
  deleteAudience,
  type Audience,
  type AudiencePlatform,
  type AudienceRule,
} from '../lib/firebase';
import { getAudienceRecommendations, getAIKeysFromConnections, type AudienceRecommendation } from '../lib/gemini';
import { useConnections } from '../contexts/ConnectionsContext';
import { fetchMetaCampaigns } from '../services/metaService';
import { fetchGoogleCampaigns } from '../services/googleService';
import { fetchTikTokCampaigns } from '../services/tiktokService';

const platformLabels: Record<AudiencePlatform, string> = {
  google: 'Google',
  meta: 'Meta',
  tiktok: 'TikTok',
};

const ALL_AUDIENCE_PLATFORMS: AudiencePlatform[] = ['google', 'meta', 'tiktok'];

const statusLabels: Record<Audience['status'], string> = {
  draft: 'טיוטה',
  active: 'פעיל',
  learning: 'למידה',
};

function buildPlatformDataSummary(connections: { id: string; status: string; settings?: Record<string, string> }[], campaignsByPlatform: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const c of connections) {
    if (c.id !== 'google' && c.id !== 'meta' && c.id !== 'tiktok') continue;
    const name = platformLabels[c.id as AudiencePlatform] || c.id;
    const status = c.status === 'connected' ? 'מחובר' : 'לא מחובר';
    parts.push(`${name}: ${status}.`);
    const data = campaignsByPlatform[c.id];
    if (data && Array.isArray(data)) {
      parts.push(`קמפיינים: ${(data as any[]).length}. דוגמאות: ${JSON.stringify((data as any[]).slice(0, 2)).slice(0, 200)}.`);
    }
  }
  return parts.length ? parts.join(' ') : 'אין נתוני פלטפורמות מחוברים. הצע קהלים כלליים ל-Google, Meta ו-TikTok.';
}

export function Audiences() {
  const { t, dir, language } = useLanguage();
  const isHebrew = language === 'he';
  const { connections, dataOwnerUid, isWorkspaceReadOnly } = useConnections();
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

  const uid = dataOwnerUid || auth.currentUser?.uid;
  const aiKeys = getAIKeysFromConnections(connections);
  const connectedPlatforms = useMemo(() => {
    const connectedIds = new Set(
      connections
        .filter((c) => c.status === 'connected' && ALL_AUDIENCE_PLATFORMS.includes(c.id as AudiencePlatform))
        .map((c) => c.id as AudiencePlatform)
    );
    return ALL_AUDIENCE_PLATFORMS.filter((p) => connectedIds.has(p));
  }, [connections]);

  useEffect(() => {
    if (!uid) return;
    getAudiences(uid)
      .then(setAudiences)
      .finally(() => setLoading(false));
  }, [uid]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3000);
  };

  const resolveSyncTargets = (audience: Audience, includeAllConnected: boolean): AudiencePlatform[] => {
    if (includeAllConnected) {
      return connectedPlatforms.length ? connectedPlatforms : [audience.platform];
    }
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
    const syncStatusByPlatform: NonNullable<Audience['syncStatusByPlatform']> = {
      ...(audience.syncStatusByPlatform || {}),
    };
    const externalIdsByPlatform: NonNullable<Audience['externalIdsByPlatform']> = {
      ...(audience.externalIdsByPlatform || {}),
    };
    const synced = new Set<AudiencePlatform>(audience.syncedPlatforms || []);

    for (const platform of targets) {
      try {
        syncStatusByPlatform[platform] = 'pending';
        await new Promise((r) => setTimeout(r, 450));
        const externalId = `ext-${platform}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        externalIdsByPlatform[platform] = externalId;
        synced.add(platform);
        syncStatusByPlatform[platform] = 'synced';
      } catch (err) {
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
    if (meta?.status === 'connected' && meta.settings?.metaToken) {
      try {
        const acc = meta.settings.metaAdsId || meta.settings.adAccountId || meta.settings.metaAdAccountId;
        if (acc) result.meta = await fetchMetaCampaigns(meta.settings.metaToken, acc);
      } catch (e) {
        result.meta = [{ error: String(e) }];
      }
    }
    const google = connections.find((c) => c.id === 'google');
    if (google?.status === 'connected' && google.settings?.googleAccessToken) {
      try {
        const cid = google.settings.googleAdsId || google.settings.customerId || google.settings.googleCustomerId;
        if (cid) result.google = await fetchGoogleCampaigns(google.settings.googleAccessToken, cid, google.settings.loginCustomerId);
      } catch (e) {
        result.google = [{ error: String(e) }];
      }
    }
    const tiktok = connections.find((c) => c.id === 'tiktok');
    if (tiktok?.status === 'connected' && (tiktok.settings?.tiktokToken || tiktok.settings?.tiktokAccessToken)) {
      try {
        const adv = tiktok.settings.tiktokAdvertiserId || tiktok.settings.advertiserId;
        const token = tiktok.settings.tiktokToken || tiktok.settings.tiktokAccessToken;
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
      setForm({
        name: '',
        platform: 'meta',
        description: '',
        rules: [],
        estimatedSize: undefined,
        status: 'draft',
      });
    }
    setEditingId(null);
    setModalOpen(true);
  };

  const openEdit = (a: Audience) => {
    if (isWorkspaceReadOnly) return;
    setSyncAllOnSave(false);
    setForm({
      name: a.name,
      platform: a.platform,
      description: a.description || '',
      rules: a.rules || [],
      estimatedSize: a.estimatedSize,
      status: a.status,
    });
    setEditingId(a.id);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (isWorkspaceReadOnly) {
      showToast('אין הרשאת עריכה. המשתמש מוגדר לצפייה בלבד.');
      return;
    }
    if (!uid || !form.name.trim()) {
      showToast('יש להזין שם קהל.');
      return;
    }
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
        await updateAudience(uid, editingId, payload);
        savedAudience = {
          id: editingId,
          createdAt: existingAudience?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ...payload,
        };
        setAudiences((prev) => prev.map((a) => (a.id === editingId ? { ...a, ...savedAudience } : a)));
        showToast('הקהל עודכן.');
      } else {
        const id = await saveAudience(uid, payload);
        savedAudience = { id, ...payload, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        setAudiences((prev) => [...prev, savedAudience]);
        showToast('הקהל נוצר.');
      }

      if (syncAllOnSave) {
        setSyncingId(savedAudience.id);
        const syncedResult = await syncAudiencePlatforms(savedAudience, true);
        await updateAudience(uid, savedAudience.id, {
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
              ? {
                  ...a,
                  syncedToPlatform: syncedResult.syncedPlatforms.length > 0,
                  syncedPlatforms: syncedResult.syncedPlatforms,
                  syncStatusByPlatform: syncedResult.syncStatusByPlatform,
                  externalIdsByPlatform: syncedResult.externalIdsByPlatform,
                  externalId: syncedResult.externalId,
                  status: syncedResult.syncedPlatforms.length > 0 ? 'active' : a.status,
                }
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
    } catch (e) {
      showToast('שמירה נכשלה.');
    } finally {
      setSyncingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (isWorkspaceReadOnly) {
      showToast('אין הרשאת עריכה. המשתמש מוגדר לצפייה בלבד.');
      return;
    }
    if (!uid || !window.confirm('למחוק את הקהל?')) return;
    try {
      await deleteAudience(uid, id);
      setAudiences((prev) => prev.filter((a) => a.id !== id));
      showToast('הקהל נמחק.');
      setModalOpen(false);
    } catch (e) {
      showToast('מחיקה נכשלה.');
    }
  };

  const handleSyncToPlatform = async (a: Audience) => {
    if (isWorkspaceReadOnly) {
      showToast('אין הרשאת עריכה. המשתמש מוגדר לצפייה בלבד.');
      return;
    }
    if (!uid) return;
    setSyncingId(a.id);
    try {
      const result = await syncAudiencePlatforms(a, false);
      await updateAudience(uid, a.id, {
        syncedToPlatform: result.syncedPlatforms.length > 0,
        syncedPlatforms: result.syncedPlatforms,
        syncStatusByPlatform: result.syncStatusByPlatform,
        externalIdsByPlatform: result.externalIdsByPlatform,
        externalId: result.externalId,
        status: result.syncedPlatforms.length > 0 ? 'active' : a.status,
      });
      setAudiences((prev) =>
        prev.map((x) =>
          x.id === a.id
            ? {
                ...x,
                syncedToPlatform: result.syncedPlatforms.length > 0,
                syncedPlatforms: result.syncedPlatforms,
                syncStatusByPlatform: result.syncStatusByPlatform,
                externalIdsByPlatform: result.externalIdsByPlatform,
                externalId: result.externalId,
                status: result.syncedPlatforms.length > 0 ? 'active' : x.status,
              }
            : x
        )
      );
      showToast(
        isHebrew
          ? `הקהל נשלח ל-${platformLabels[a.platform]}.`
          : `Audience synced to ${platformLabels[a.platform]}.`
      );
    } catch (e) {
      showToast('שליחה לפלטפורמה נכשלה.');
    } finally {
      setSyncingId(null);
    }
  };

  const handleSyncToAllConnectedPlatforms = async (a: Audience) => {
    if (isWorkspaceReadOnly) {
      showToast('אין הרשאת עריכה. המשתמש מוגדר לצפייה בלבד.');
      return;
    }
    if (!uid) return;
    if (connectedPlatforms.length === 0) {
      showToast(isHebrew ? 'אין פלטפורמות מחוברות לסנכרון.' : 'No connected platforms to sync.');
      return;
    }
    setSyncingId(a.id);
    try {
      const result = await syncAudiencePlatforms(a, true);
      await updateAudience(uid, a.id, {
        syncedToPlatform: result.syncedPlatforms.length > 0,
        syncedPlatforms: result.syncedPlatforms,
        syncStatusByPlatform: result.syncStatusByPlatform,
        externalIdsByPlatform: result.externalIdsByPlatform,
        externalId: result.externalId,
        status: result.syncedPlatforms.length > 0 ? 'active' : a.status,
      });
      setAudiences((prev) =>
        prev.map((x) =>
          x.id === a.id
            ? {
                ...x,
                syncedToPlatform: result.syncedPlatforms.length > 0,
                syncedPlatforms: result.syncedPlatforms,
                syncStatusByPlatform: result.syncStatusByPlatform,
                externalIdsByPlatform: result.externalIdsByPlatform,
                externalId: result.externalId,
                status: result.syncedPlatforms.length > 0 ? 'active' : x.status,
              }
            : x
        )
      );
      showToast(
        isHebrew
          ? `הקהל סונכרן לכל הפלטפורמות המחוברות: ${result.syncedPlatforms.map((p) => platformLabels[p]).join(', ')}.`
          : `Audience synced to all connected platforms: ${result.syncedPlatforms.map((p) => platformLabels[p]).join(', ')}.`
      );
    } catch (e) {
      showToast(isHebrew ? 'סנכרון לכל הפלטפורמות נכשל.' : 'Sync to all platforms failed.');
    } finally {
      setSyncingId(null);
    }
  };

  const handleBulkSyncAllAudiences = async () => {
    if (!uid || !audiences.length) return;
    if (connectedPlatforms.length === 0) {
      showToast(isHebrew ? 'אין פלטפורמות מחוברות לסנכרון.' : 'No connected platforms to sync.');
      return;
    }
    setBulkSyncLoading(true);
    try {
      for (const audience of audiences) {
        const result = await syncAudiencePlatforms(audience, true);
        await updateAudience(uid, audience.id, {
          syncedToPlatform: result.syncedPlatforms.length > 0,
          syncedPlatforms: result.syncedPlatforms,
          syncStatusByPlatform: result.syncStatusByPlatform,
          externalIdsByPlatform: result.externalIdsByPlatform,
          externalId: result.externalId,
          status: result.syncedPlatforms.length > 0 ? 'active' : audience.status,
        });
        setAudiences((prev) =>
          prev.map((x) =>
            x.id === audience.id
              ? {
                  ...x,
                  syncedToPlatform: result.syncedPlatforms.length > 0,
                  syncedPlatforms: result.syncedPlatforms,
                  syncStatusByPlatform: result.syncStatusByPlatform,
                  externalIdsByPlatform: result.externalIdsByPlatform,
                  externalId: result.externalId,
                  status: result.syncedPlatforms.length > 0 ? 'active' : x.status,
                }
              : x
          )
        );
      }
      showToast(
        isHebrew
          ? 'כל הקהלים סונכרנו לכל הפלטפורמות המחוברות.'
          : 'All audiences synced to all connected platforms.'
      );
    } catch (e) {
      showToast(isHebrew ? 'סנכרון מרוכז נכשל.' : 'Bulk sync failed.');
    } finally {
      setBulkSyncLoading(false);
    }
  };

  const totalEstimated = audiences.reduce((s, a) => s + (a.estimatedSize || 0), 0);
  const activeCount = audiences.filter((a) => a.status === 'active').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {toast && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-sm font-bold">
          {toast}
        </div>
      )}
      {isWorkspaceReadOnly && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-sm font-bold">
          מצב צפייה בלבד פעיל. לא ניתן לערוך קהלים בחשבון זה.
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('nav.audiences')}</h1>
          <p className="text-sm text-gray-500 mt-1">הגדר קהלים לפלטפורמות, ערוך וייצר ישירות ל-Google, Meta ו-TikTok. גימיני ממליץ לפי נתוני הפלטפורמות.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {ALL_AUDIENCE_PLATFORMS.map((platform) => {
              const isConnected = connectedPlatforms.includes(platform);
              return (
                <span
                  key={`conn-${platform}`}
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border',
                    isConnected
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-gray-100 text-gray-500 border-gray-200'
                  )}
                >
                  {platformLabels[platform]} {isConnected ? (isHebrew ? 'מחובר' : 'Connected') : (isHebrew ? 'לא מחובר' : 'Disconnected')}
                </span>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadRecommendations()}
            disabled={recommendationsLoading}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors text-sm font-medium disabled:opacity-50"
          >
            {recommendationsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            המלצות מ-AI
          </button>
          <button
            onClick={handleBulkSyncAllAudiences}
            disabled={isWorkspaceReadOnly || bulkSyncLoading || audiences.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium disabled:opacity-50"
          >
            {bulkSyncLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe2 className="w-4 h-4" />}
            {isHebrew ? 'סנכרן הכל למחוברים' : 'Sync all to connected'}
          </button>
          <button
            onClick={() => openCreate()}
            disabled={isWorkspaceReadOnly}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            צור קהל
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">סה"כ קהל (מוערך)</h3>
            <Users className="w-8 h-8 text-blue-600 bg-blue-50 rounded-lg p-2" />
          </div>
          <p className="text-3xl font-black text-gray-900">{totalEstimated > 0 ? totalEstimated.toLocaleString() : '—'}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">סגמנטים</h3>
            <Target className="w-8 h-8 text-indigo-600 bg-indigo-50 rounded-lg p-2" />
          </div>
          <p className="text-3xl font-black text-gray-900">{audiences.length}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">פעילים</h3>
            <BarChart2 className="w-8 h-8 text-emerald-600 bg-emerald-50 rounded-lg p-2" />
          </div>
          <p className="text-3xl font-black text-gray-900">{activeCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900">קהלים</h2>
          </div>
          {loading ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 font-semibold">שם</th>
                    <th className="px-6 py-4 font-semibold">פלטפורמה</th>
                    <th className="px-6 py-4 font-semibold">גודל (מוערך)</th>
                    <th className="px-6 py-4 font-semibold">סטטוס</th>
                    <th className="px-6 py-4 font-semibold">סנכרון</th>
                    <th className="px-6 py-4 font-semibold"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {audiences.map((aud) => (
                    <tr key={aud.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{aud.name}</td>
                      <td className="px-6 py-4 text-gray-600" dir="ltr">{platformLabels[aud.platform]}</td>
                      <td className="px-6 py-4">{aud.estimatedSize != null ? aud.estimatedSize.toLocaleString() : '—'}</td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            'px-2.5 py-1 rounded-full text-xs font-medium',
                            aud.status === 'active' ? 'bg-emerald-100 text-emerald-700' : aud.status === 'learning' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                          )}
                        >
                          {statusLabels[aud.status]}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1.5">
                          {aud.syncedPlatforms && aud.syncedPlatforms.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {aud.syncedPlatforms.map((platform) => (
                                <span key={`${aud.id}-synced-${platform}`} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  {platformLabels[platform]}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-500 text-xs">{isHebrew ? 'טרם סונכרן' : 'Not synced yet'}</span>
                          )}

                          <div className="flex flex-wrap gap-1.5">
                            <button
                              onClick={() => handleSyncToPlatform(aud)}
                              disabled={syncingId === aud.id || isWorkspaceReadOnly}
                              className="text-indigo-600 hover:text-indigo-700 text-xs font-medium flex items-center gap-1 disabled:opacity-40"
                            >
                              {syncingId === aud.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                              {isHebrew ? 'סנכרן ראשי' : 'Sync primary'}
                            </button>
                            <button
                              onClick={() => handleSyncToAllConnectedPlatforms(aud)}
                              disabled={syncingId === aud.id || isWorkspaceReadOnly}
                              className="text-emerald-700 hover:text-emerald-800 text-xs font-medium flex items-center gap-1 disabled:opacity-40"
                            >
                              {syncingId === aud.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Globe2 className="w-3 h-3" />}
                              {isHebrew ? 'סנכרן לכל המחוברים' : 'Sync all connected'}
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 flex gap-1 justify-end">
                        <button
                          onClick={() => openEdit(aud)}
                          disabled={isWorkspaceReadOnly}
                          className="p-1.5 text-gray-500 hover:text-indigo-600 rounded disabled:opacity-40"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(aud.id)}
                          disabled={isWorkspaceReadOnly}
                          className="p-1.5 text-gray-500 hover:text-red-600 rounded disabled:opacity-40"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {audiences.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  אין קהלים עדיין. צור קהל או בחר מהמלצות ה-AI.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 rounded-2xl shadow-lg p-1 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 relative z-10 h-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-400/20 rounded-lg flex items-center justify-center text-amber-300">
                <Zap className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-white">המלצות קהלים (AI)</h2>
            </div>
            <p className="text-xs text-indigo-200 mb-4">ההמלצות מבוססות על נתוני הקמפיינים מהפלטפורמות המחוברות.</p>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {recommendations.length === 0 && !recommendationsLoading && (
                <p className="text-indigo-200 text-sm">לחץ על &quot;המלצות מ-AI&quot; כדי לטעון המלצות.</p>
              )}
              {recommendations.map((rec, idx) => (
                <div key={idx} className="bg-white/5 p-3 rounded-xl border border-white/10 hover:bg-white/10 transition-colors">
                  <h3 className="text-sm font-bold text-white mb-1">{rec.title}</h3>
                  <p className="text-xs text-indigo-200 mb-2 line-clamp-2">{rec.description}</p>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-white/80 text-xs" dir="ltr">{rec.platform}</span>
                    {rec.estimatedSize && <span className="text-white/80 text-xs">גודל: {rec.estimatedSize}</span>}
                    {rec.potentialRoas && <span className="text-emerald-400 text-xs font-medium" dir="ltr">{rec.potentialRoas}</span>}
                    <button
                      onClick={() => {
                        openCreate(rec);
                      }}
                      disabled={isWorkspaceReadOnly}
                      className="text-amber-300 hover:text-amber-200 text-xs font-bold flex items-center gap-1 disabled:opacity-40"
                    >
                      צור קהל <ArrowLeft className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">{editingId ? 'עריכת קהל' : 'צור קהל'}</h3>
              <button onClick={() => setModalOpen(false)} className="p-2 text-gray-500 hover:text-gray-700 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">שם הקהל</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  placeholder="למשל: נוטשי עגלה 30 יום"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">פלטפורמה</label>
                <select
                  value={form.platform}
                  onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value as AudiencePlatform }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="google">Google</option>
                  <option value="meta">Meta</option>
                  <option value="tiktok">TikTok</option>
                </select>
              </div>
              <label className="flex items-start gap-2 text-sm text-gray-700 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
                <input
                  type="checkbox"
                  checked={syncAllOnSave}
                  onChange={(e) => setSyncAllOnSave(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-semibold">
                    {isHebrew ? 'סנכרן בעת שמירה לכל הפלטפורמות המחוברות' : 'Sync on save to all connected platforms'}
                  </span>
                  <span className="block text-xs text-indigo-700 mt-0.5">
                    {connectedPlatforms.length > 0
                      ? `${isHebrew ? 'מחוברים כרגע' : 'Currently connected'}: ${connectedPlatforms
                          .map((p) => platformLabels[p])
                          .join(', ')}`
                      : isHebrew
                      ? 'אין כרגע פלטפורמות מחוברות.'
                      : 'No connected platforms at the moment.'}
                  </span>
                </span>
              </label>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">תיאור (אופציונלי)</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none"
                  rows={2}
                  placeholder="תיאור קצר של הקהל"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">גודל מוערך (אופציונלי)</label>
                <input
                  type="number"
                  min={0}
                  value={form.estimatedSize ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, estimatedSize: e.target.value ? parseInt(e.target.value, 10) : undefined }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  placeholder="50000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">סטטוס</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Audience['status'] }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="draft">טיוטה</option>
                  <option value="active">פעיל</option>
                  <option value="learning">למידה</option>
                </select>
              </div>
              {form.rules.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">כללי קהל (מ-AI)</label>
                  <ul className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 space-y-1">
                    {form.rules.map((r, i) => (
                      <li key={i}>
                        {r.type}: {r.name && `${r.name} = `}{typeof r.value === 'object' ? JSON.stringify(r.value) : String(r.value)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-2">
              {editingId && (
                <button
                  onClick={() => handleDelete(editingId)}
                  disabled={isWorkspaceReadOnly}
                  className="px-4 py-2 text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-40"
                >
                  מחק
                </button>
              )}
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-gray-700 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">
                ביטול
              </button>
              <button
                onClick={handleSave}
                disabled={isWorkspaceReadOnly}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40"
              >
                {editingId ? 'עדכן' : 'צור קהל'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
