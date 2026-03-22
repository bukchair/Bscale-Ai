import { useState } from 'react';
import { normalizeCampaignStatus, toAmount } from './utils';
import type { EditCampaignDraft, EditableStatus, CampaignRow, PlatformName } from './types';

export interface UseCampaignEditProps {
  isHebrew: boolean;
  onUpdateCampaigns: (updater: (prev: CampaignRow[]) => CampaignRow[]) => void;
}

export function useCampaignEdit({ isHebrew, onUpdateCampaigns }: UseCampaignEditProps) {
  const [editingCampaign, setEditingCampaign] = useState<EditCampaignDraft | null>(null);
  const [editApplyToAds, setEditApplyToAds] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editMessage, setEditMessage] = useState<string | null>(null);

  const isEditablePlatformCampaign = (campaign: CampaignRow) => {
    const platform = String(campaign?.platform || '');
    if (platform !== 'Google' && platform !== 'Meta' && platform !== 'TikTok') return false;
    const idValue = String(campaign?.campaignId || campaign?.id || '').trim();
    if (!idValue) return false;
    if (idValue.startsWith('local-') || idValue.startsWith('live-')) return false;
    return true;
  };

  const openEditCampaign = (campaign: CampaignRow) => {
    const platform = String(campaign?.platform || '') as PlatformName;
    const campaignId = String(campaign?.campaignId || campaign?.id || '').trim();
    if (!campaignId || !isEditablePlatformCampaign(campaign)) {
      setEditMessage(isHebrew ? 'עריכה זמינה רק לקמפיינים חיים מהפלטפורמות.' : 'Editing is available only for live platform campaigns.');
      return;
    }
    const normalizedStatus = normalizeCampaignStatus(campaign?.status);
    const status: EditableStatus = normalizedStatus === 'Paused' ? 'Paused' : 'Active';
    setEditMessage(null);
    setEditApplyToAds(false);
    setEditingCampaign({
      rowKey: `${platform}-${campaignId}`,
      platform,
      campaignId,
      name: String(campaign?.name || '').trim(),
      status,
      dailyBudget: toAmount(campaign?.budget) > 0 ? String(toAmount(campaign?.budget)) : '',
    });
  };

  const closeEditCampaign = () => {
    setEditingCampaign(null);
    setEditApplyToAds(false);
    setEditLoading(false);
  };

  // Session is maintained via httpOnly cookie — no bootstrap needed.
  const ensureManagedApiSession = async () => { /* no-op */ };

  const saveEditedCampaign = async () => {
    if (!editingCampaign) return;
    const trimmedName = editingCampaign.name.trim();
    if (!trimmedName) {
      setEditMessage(isHebrew ? 'נדרש שם קמפיין ובחירת לפחות פלטפורמה אחת.' : 'Campaign name and at least one platform are required.');
      return;
    }
    setEditLoading(true);
    setEditMessage(null);
    try {
      await ensureManagedApiSession();
      const parsedBudget = Number(editingCampaign.dailyBudget);
      const dailyBudget =
        editingCampaign.dailyBudget.trim().length > 0 && Number.isFinite(parsedBudget) && parsedBudget >= 0
          ? parsedBudget
          : null;
      const response = await fetch('/api/campaigns/update', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          platform: editingCampaign.platform,
          campaignId: editingCampaign.campaignId,
          name: trimmedName,
          status: editingCampaign.status,
          dailyBudget,
          applyToAds: editApplyToAds,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.success !== true) {
        throw new Error(payload?.message || (isHebrew ? 'עדכון הקמפיין נכשל.' : 'Failed to update campaign.'));
      }
      const updateRow = (row: CampaignRow) => {
        const rowId = String(row?.campaignId || row?.id || '').trim();
        const samePlatform = String(row?.platform || '') === editingCampaign.platform;
        if (!samePlatform || rowId !== editingCampaign.campaignId) return row;
        return {
          ...row,
          name: trimmedName,
          status: editingCampaign.status,
          budget: dailyBudget != null ? dailyBudget : row?.budget,
        };
      };
      onUpdateCampaigns((prev) => prev.map(updateRow));
      setEditMessage(payload?.message || (isHebrew ? 'הקמפיין עודכן בהצלחה.' : 'Campaign updated successfully.'));
      setTimeout(() => {
        setEditingCampaign(null);
        setEditApplyToAds(false);
      }, 250);
    } catch (error) {
      setEditMessage(error instanceof Error ? error.message : (isHebrew ? 'עדכון הקמפיין נכשל.' : 'Failed to update campaign.'));
    } finally {
      setEditLoading(false);
    }
  };

  return {
    editingCampaign, setEditingCampaign,
    editApplyToAds, setEditApplyToAds,
    editLoading,
    editMessage, setEditMessage,
    isEditablePlatformCampaign,
    openEditCampaign,
    closeEditCampaign,
    saveEditedCampaign,
  };
}
