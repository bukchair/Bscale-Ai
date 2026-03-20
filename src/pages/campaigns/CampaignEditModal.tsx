'use client';

import React from 'react';
import { Loader2, Pencil, X } from 'lucide-react';
import type { EditCampaignDraft, EditableStatus } from './types';

type CampaignEditModalTexts = {
  editCampaign: string;
  editCampaignSubtitle: string;
  editName: string;
  editStatus: string;
  editBudget: string;
  editApplyAds: string;
  editApplyAdsHint: string;
  cancel: string;
  saveChanges: string;
  saving: string;
};

type CampaignEditModalProps = {
  editingCampaign: EditCampaignDraft;
  editApplyToAds: boolean;
  editLoading: boolean;
  isHebrew: boolean;
  text: CampaignEditModalTexts;
  closeEditCampaign: () => void;
  saveEditedCampaign: () => void;
  setEditApplyToAds: (value: boolean) => void;
  setEditingCampaign: React.Dispatch<React.SetStateAction<EditCampaignDraft | null>>;
};

export function CampaignEditModal({
  editingCampaign,
  editApplyToAds,
  editLoading,
  isHebrew,
  text,
  closeEditCampaign,
  saveEditedCampaign,
  setEditApplyToAds,
  setEditingCampaign,
}: CampaignEditModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl bg-white border border-gray-200 shadow-xl">
        <div className="px-4 py-3 border-b border-gray-200 flex items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold text-gray-900">{text.editCampaign}</h4>
            <p className="text-xs text-gray-600 mt-0.5">{text.editCampaignSubtitle}</p>
          </div>
          <button
            type="button"
            onClick={closeEditCampaign}
            className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">{text.editName}</label>
            <input
              value={editingCampaign.name}
              onChange={(e) =>
                setEditingCampaign((prev) => (prev ? { ...prev, name: e.target.value } : prev))
              }
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">{text.editStatus}</label>
            <select
              value={editingCampaign.status}
              onChange={(e) =>
                setEditingCampaign((prev) =>
                  prev ? { ...prev, status: e.target.value as EditableStatus } : prev
                )
              }
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
            >
              <option value="Active">{isHebrew ? 'פעיל' : 'Active'}</option>
              <option value="Paused">{isHebrew ? 'מושהה' : 'Paused'}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">{text.editBudget}</label>
            <input
              type="number"
              min={0}
              step={1}
              value={editingCampaign.dailyBudget}
              onChange={(e) =>
                setEditingCampaign((prev) => (prev ? { ...prev, dailyBudget: e.target.value } : prev))
              }
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
              placeholder={isHebrew ? 'למשל 250' : 'e.g. 250'}
            />
          </div>
          <div className="rounded-md border border-indigo-100 bg-indigo-50/40 px-3 py-2">
            <label className="inline-flex items-center gap-2 text-xs font-bold text-indigo-900 cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
                checked={editApplyToAds}
                onChange={(e) => setEditApplyToAds(e.target.checked)}
              />
              {text.editApplyAds}
            </label>
            <p className="mt-1 text-[11px] text-indigo-700">{text.editApplyAdsHint}</p>
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={closeEditCampaign}
              className="px-3 py-2 rounded-md border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50"
            >
              {text.cancel}
            </button>
            <button
              type="button"
              onClick={saveEditedCampaign}
              disabled={editLoading}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60"
            >
              {editLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
              {editLoading ? text.saving : text.saveChanges}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
