import { useEffect, useMemo, useState } from 'react';
import { auth, getBudgetAutomationSettings, getBudgetPlatformAllocations, setBudgetAutomationSettings, setBudgetPlatformAllocations } from '../../lib/firebase';
import { loadUnifiedCampaignLayerFromConnections } from '../../lib/unified-data/loaders';
import type { Connection } from '../../contexts/ConnectionsContext';

// ── Types ─────────────────────────────────────────────────────────────────────

export type PlatformId = 'google' | 'meta' | 'tiktok';
export type PlatformStatus = 'optimal' | 'overspending' | 'underperforming';

export type CampaignBudgetRow = {
  id: string;
  name: string;
  platform: PlatformId;
  status: string;
  spend: number;
  conversionValue: number;
  roas: number;
  budget: number;
};

export type PlatformSummary = {
  id: PlatformId;
  name: string;
  currentSpend: number;
  allocatedBudget: number;
  roas: number;
  status: PlatformStatus;
  campaignCount: number;
  conversionValue: number;
  connected: boolean;
};

export type TransferPlan = {
  from: PlatformId;
  to: PlatformId;
  amount: number;
  reason: string;
};

export const PLATFORM_LABELS: Record<PlatformId, string> = {
  google: 'Google Ads',
  meta: 'Meta Ads',
  tiktok: 'TikTok Ads',
};

export const toAmount = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const sumBy = <T,>(items: T[], pick: (row: T) => number) =>
  items.reduce((acc, row) => acc + pick(row), 0);

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseBudgetProps {
  connections: Connection[];
  dataOwnerUid: string | null | undefined;
  isWorkspaceReadOnly: boolean;
  startDate: Date;
  endDate: Date;
  isHebrew: boolean;
}

export function useBudget({ connections, dataOwnerUid, isWorkspaceReadOnly, startDate, endDate, isHebrew }: UseBudgetProps) {
  const currentWorkspaceUid = dataOwnerUid || auth.currentUser?.uid || null;

  // ── State ──────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [campaignRows, setCampaignRows] = useState<CampaignBudgetRow[]>([]);
  const [totalBudget, setTotalBudget] = useState(0);
  const [savedAllocations, setSavedAllocations] = useState<Partial<Record<PlatformId, number>>>({});
  const [smartEnabled, setSmartEnabled] = useState(true);
  const [targetRoas, setTargetRoas] = useState(2.5);
  const [minPlatformSpend, setMinPlatformSpend] = useState(200);
  const [reallocationPercent, setReallocationPercent] = useState(12);

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentWorkspaceUid) return;
    let cancelled = false;
    Promise.all([
      getBudgetAutomationSettings(currentWorkspaceUid).catch(() => null),
      getBudgetPlatformAllocations(currentWorkspaceUid).catch(() => null),
    ]).then(([automation, allocations]) => {
      if (cancelled) return;
      if (automation) {
        setSmartEnabled(Boolean(automation.enabled));
        setTargetRoas(toAmount(automation.targetRoas) || 2.5);
        setMinPlatformSpend(toAmount(automation.minPlatformSpend) || 200);
        setReallocationPercent(toAmount(automation.reallocationPercent) || 12);
      }
      if (allocations) {
        setSavedAllocations({
          google: toAmount(allocations.google),
          meta: toAmount(allocations.meta),
          tiktok: toAmount(allocations.tiktok),
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [currentWorkspaceUid]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const startIso = startDate.toISOString().slice(0, 10);
    const endIso = endDate.toISOString().slice(0, 10);

    let cancelled = false;
    const loadLive = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const { campaignRows: unifiedCampaignRows, errors } =
          await loadUnifiedCampaignLayerFromConnections({
            connections,
            startDate: startIso,
            endDate: endIso,
          });

        const allRows: CampaignBudgetRow[] = unifiedCampaignRows
          .map((row: Record<string, unknown>) => {
            const platformRaw = String(row?.platform || '').toLowerCase();
            const platform: PlatformId | null =
              platformRaw === 'google'
                ? 'google'
                : platformRaw === 'meta'
                ? 'meta'
                : platformRaw === 'tiktok'
                ? 'tiktok'
                : null;
            if (!platform) return null;
            return {
              id: String(row?.campaignId || row?.id || `${platform}-${row?.name || ''}`),
              name: String(row?.name || `${platform} campaign`),
              platform,
              status: String(row?.status || 'Unknown'),
              spend: toAmount(row?.spend),
              conversionValue: toAmount(row?.conversionValue),
              roas: toAmount(row?.roas),
              budget:
                toAmount(row?.dailyBudget) ||
                toAmount(row?.budget) ||
                toAmount(row?.lifetimeBudget),
            };
          })
          .filter((row): row is CampaignBudgetRow => Boolean(row));
        const filtered = allRows.filter(
          (row) =>
            row.spend > 0 ||
            row.conversionValue > 0 ||
            row.budget > 0 ||
            Boolean(row.name)
        );

        if (!cancelled) {
          setCampaignRows(filtered);

          const errorsList = Object.values(errors).filter(Boolean);
          if (filtered.length === 0 && errorsList.length > 0) {
            setLoadError(errorsList[0] || null);
          }

          const derivedAllocated = {
            google: sumBy(filtered.filter((r) => r.platform === 'google'), (r) => r.budget || r.spend * 1.2),
            meta: sumBy(filtered.filter((r) => r.platform === 'meta'), (r) => r.budget || r.spend * 1.2),
            tiktok: sumBy(filtered.filter((r) => r.platform === 'tiktok'), (r) => r.budget || r.spend * 1.2),
          };
          const fallbackTotal = sumBy(filtered, (r) => r.spend) * 1.2;
          const savedTotal = toAmount(savedAllocations.google) + toAmount(savedAllocations.meta) + toAmount(savedAllocations.tiktok);
          if (totalBudget <= 0) {
            setTotalBudget(Math.max(Math.round(savedTotal), Math.round(sumBy(Object.values(derivedAllocated), (x) => x)), Math.round(fallbackTotal), 1));
          }
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : isHebrew ? 'שגיאה בטעינת נתוני תקציב חיים' : 'Failed to load live budget data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadLive();
    return () => {
      cancelled = true;
    };
  }, [connections, startDate, endDate, isHebrew, savedAllocations.google, savedAllocations.meta, savedAllocations.tiktok, totalBudget]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Memos ──────────────────────────────────────────────────────────────────
  const connectedPlatformIds = useMemo(
    () =>
      new Set(
        connections
          .filter((c) => c.status === 'connected' && (c.id === 'google' || c.id === 'meta' || c.id === 'tiktok'))
          .map((c) => c.id as PlatformId)
      ),
    [connections]
  );

  const platformSummaries = useMemo<PlatformSummary[]>(() => {
    const rowsByPlatform: Record<PlatformId, CampaignBudgetRow[]> = {
      google: campaignRows.filter((r) => r.platform === 'google'),
      meta: campaignRows.filter((r) => r.platform === 'meta'),
      tiktok: campaignRows.filter((r) => r.platform === 'tiktok'),
    };

    const computeStatus = (spend: number, allocation: number, roas: number): PlatformStatus => {
      if (allocation > 0 && spend > allocation * 1.05) return 'overspending';
      if (spend >= minPlatformSpend && roas >= targetRoas) return 'optimal';
      return 'underperforming';
    };

    return (['google', 'meta', 'tiktok'] as PlatformId[]).map((platformId) => {
      const rows = rowsByPlatform[platformId];
      const spend = sumBy(rows, (r) => r.spend);
      const conversionValue = sumBy(rows, (r) => r.conversionValue);
      const derivedAllocation = sumBy(rows, (r) => (r.budget > 0 ? r.budget : r.spend * 1.2));
      const allocation = Math.max(0, toAmount(savedAllocations[platformId]) || derivedAllocation);
      const roas = spend > 0 ? conversionValue / spend : 0;
      return {
        id: platformId,
        name: PLATFORM_LABELS[platformId],
        currentSpend: spend,
        allocatedBudget: allocation,
        roas,
        status: computeStatus(spend, allocation, roas),
        campaignCount: rows.length,
        conversionValue,
        connected: connectedPlatformIds.has(platformId),
      };
    });
  }, [campaignRows, savedAllocations, connectedPlatformIds, minPlatformSpend, targetRoas]);

  const totalSpend = sumBy(platformSummaries, (p) => p.currentSpend);
  const remainingBudget = totalBudget - totalSpend;

  const currentAllocations = useMemo(
    () =>
      platformSummaries.reduce(
        (acc, row) => {
          acc[row.id] = row.allocatedBudget;
          return acc;
        },
        {} as Record<PlatformId, number>
      ),
    [platformSummaries]
  );

  const transferPlan = useMemo<TransferPlan | null>(() => {
    if (!smartEnabled) return null;
    const eligible = platformSummaries.filter((p) => p.connected && p.currentSpend >= minPlatformSpend);
    if (eligible.length < 2) return null;
    const loser = [...eligible]
      .filter((p) => p.roas < targetRoas && p.allocatedBudget > 0)
      .sort((a, b) => a.roas - b.roas)[0];
    const winner = [...eligible]
      .filter((p) => p.roas > targetRoas)
      .sort((a, b) => b.roas - a.roas)[0];
    if (!loser || !winner || loser.id === winner.id) return null;
    const maxShift = Math.max(0, loser.allocatedBudget * (reallocationPercent / 100));
    const amount = Math.min(maxShift, Math.max(0, loser.allocatedBudget - loser.currentSpend * 0.8));
    if (amount < 1) return null;
    const reason = isHebrew
      ? `ROAS נמוך ב-${loser.name} לעומת ביצועים חזקים ב-${winner.name}`
      : `Lower ROAS on ${loser.name} compared to stronger performance on ${winner.name}`;
    return { from: loser.id, to: winner.id, amount, reason };
  }, [smartEnabled, platformSummaries, minPlatformSpend, targetRoas, reallocationPercent, isHebrew]);

  const campaignControlPreview = useMemo(() => {
    if (!transferPlan) return [] as Array<{ id: string; name: string; platform: string; currentBudget: number; targetBudget: number }>;
    const fromCampaigns = campaignRows.filter((r) => r.platform === transferPlan.from).slice(0, 4);
    const toCampaigns = campaignRows.filter((r) => r.platform === transferPlan.to).slice(0, 4);
    const fromTotal = Math.max(sumBy(fromCampaigns, (r) => Math.max(r.budget, r.spend, 1)), 1);
    const toTotal = Math.max(sumBy(toCampaigns, (r) => Math.max(r.budget, r.spend, 1)), 1);

    const decreases = fromCampaigns.map((campaign) => {
      const baseline = Math.max(campaign.budget, campaign.spend, 1);
      const weight = baseline / fromTotal;
      const delta = transferPlan.amount * weight;
      return {
        id: campaign.id,
        name: campaign.name,
        platform: PLATFORM_LABELS[campaign.platform],
        currentBudget: baseline,
        targetBudget: Math.max(0, baseline - delta),
      };
    });
    const increases = toCampaigns.map((campaign) => {
      const baseline = Math.max(campaign.budget, campaign.spend, 1);
      const weight = baseline / toTotal;
      const delta = transferPlan.amount * weight;
      return {
        id: campaign.id,
        name: campaign.name,
        platform: PLATFORM_LABELS[campaign.platform],
        currentBudget: baseline,
        targetBudget: baseline + delta,
      };
    });
    return [...decreases, ...increases];
  }, [transferPlan, campaignRows]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const saveAutomationSettings = async () => {
    if (!currentWorkspaceUid || isWorkspaceReadOnly) return;
    await setBudgetAutomationSettings(currentWorkspaceUid, {
      enabled: smartEnabled,
      targetRoas,
      minPlatformSpend,
      reallocationPercent,
    });
    await setBudgetPlatformAllocations(currentWorkspaceUid, currentAllocations);
  };

  const applyTransferPlan = async () => {
    if (!transferPlan) return;
    const base = currentAllocations;
    const next = {
      ...base,
      [transferPlan.from]: Math.max(0, toAmount(base[transferPlan.from]) - transferPlan.amount),
      [transferPlan.to]: Math.max(0, toAmount(base[transferPlan.to]) + transferPlan.amount),
    };
    setApplying(true);
    try {
      setSavedAllocations(next);
      if (currentWorkspaceUid && !isWorkspaceReadOnly) {
        await setBudgetPlatformAllocations(currentWorkspaceUid, next);
        await saveAutomationSettings();
      }
    } finally {
      setApplying(false);
    }
  };

  return {
    // state
    loading,
    applying,
    loadError,
    campaignRows,
    totalBudget, setTotalBudget,
    savedAllocations, setSavedAllocations,
    smartEnabled, setSmartEnabled,
    targetRoas, setTargetRoas,
    minPlatformSpend, setMinPlatformSpend,
    reallocationPercent, setReallocationPercent,
    // memos
    platformSummaries,
    totalSpend,
    remainingBudget,
    currentAllocations,
    transferPlan,
    campaignControlPreview,
    // handlers
    saveAutomationSettings,
    applyTransferPlan,
  };
}
