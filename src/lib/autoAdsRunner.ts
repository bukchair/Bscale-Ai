import type { AutoAdsSchedule } from './firebase';
import { fetchWooCommerceProducts } from '../services/woocommerceService';
import { getAIKeysFromConnections } from './gemini';
import { generateCreativeCopy } from './gemini';
import { resolveWooCredentials } from './integrations/woocommerceCredentials';

function nextRunAt(schedule: AutoAdsSchedule): string {
  const now = new Date();
  const d = new Date(now);
  if (schedule.frequency === 'daily') d.setDate(d.getDate() + 1);
  else if (schedule.frequency === 'every_3_days') d.setDate(d.getDate() + 3);
  else d.setDate(d.getDate() + 7);
  return d.toISOString();
}

async function fetchSchedule(): Promise<AutoAdsSchedule | null> {
  try {
    const res = await fetch('/api/user/settings', { credentials: 'include' });
    if (!res.ok) return null;
    const d = (await res.json()) as { settings?: Record<string, unknown> };
    return (d.settings?.autoAdsSchedule as AutoAdsSchedule) || null;
  } catch {
    return null;
  }
}

async function saveSchedule(update: Partial<AutoAdsSchedule>): Promise<void> {
  try {
    const current = await fetchSchedule();
    await fetch('/api/user/settings', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ autoAdsSchedule: { ...(current ?? {}), ...update } }),
    });
  } catch { /* best effort */ }
}

async function saveAd(ad: { type: string; createdAt: string; productName?: string; payload: Record<string, unknown> }): Promise<void> {
  await fetch('/api/saved-ads', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(ad),
  });
}

async function fetchConnections(): Promise<Array<{ id: string; settings?: Record<string, string> }>> {
  try {
    const res = await fetch('/api/user/connections', { credentials: 'include' });
    if (!res.ok) return [];
    const d = (await res.json()) as { connections?: Array<{ id: string; settings?: Record<string, string> }> };
    return d.connections ?? [];
  } catch {
    return [];
  }
}

export async function runAutoAdsIfNeeded(_uid: string, runNow = false): Promise<{ ran: boolean; created?: number }> {
  const schedule = await fetchSchedule();
  if (!schedule?.enabled && !runNow) return { ran: false };
  const now = new Date().toISOString();
  if (!runNow && schedule?.nextRunAt && schedule.nextRunAt > now) return { ran: false };

  const items = await fetchConnections();
  const woo = items.find((c) => c.id === 'woocommerce');
  const aiKeys = getAIKeysFromConnections(items);
  const { storeUrl, wooKey, wooSecret } = resolveWooCredentials(woo?.settings as Record<string, unknown> | undefined);

  if (!storeUrl || !wooKey || !wooSecret) {
    if (schedule?.enabled) await saveSchedule({ lastRunAt: now, nextRunAt: nextRunAt(schedule) });
    return { ran: false };
  }

  let products: Array<{ id: number; name: string; short_description?: string; description?: string }>;
  try {
    products = await fetchWooCommerceProducts(storeUrl, wooKey, wooSecret);
  } catch {
    if (schedule?.enabled) await saveSchedule({ lastRunAt: now, nextRunAt: nextRunAt(schedule) });
    return { ran: false };
  }

  const limit = Math.min(schedule?.productLimit ?? 3, products.length);
  let created = 0;
  for (let i = 0; i < limit; i++) {
    const p = products[i];
    const name = p.name || 'מוצר';
    const desc = (p.description || p.short_description || '').slice(0, 500);
    try {
      const res = await generateCreativeCopy(name, desc, 'צור קופירייטינג למודעות רשתות חברתיות.', aiKeys);
      const first = res?.options?.[0];
      if (first) {
        await saveAd({ type: 'copy', createdAt: now, productName: name, payload: { headline: first.headline, primaryText: first.primaryText, description: first.description } });
        created++;
      }
    } catch (e) {
      console.warn('Auto-ad copy generation failed for product', p.id, e);
    }
  }

  if (schedule) {
    await saveSchedule({ lastRunAt: now, nextRunAt: schedule.enabled ? nextRunAt(schedule) : (schedule.nextRunAt ?? null) });
  }
  return { ran: true, created };
}
