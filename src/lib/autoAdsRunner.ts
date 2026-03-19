import { getDoc, doc } from 'firebase/firestore';
import { db } from './firebase';
import { getAutoAdsSchedule, setAutoAdsSchedule, saveAdToFirestore, type AutoAdsSchedule } from './firebase';
import { fetchWooCommerceProducts } from '../services/woocommerceService';
import { getAIKeysFromConnections } from './gemini';
import { generateCreativeCopy } from './gemini';

function nextRunAt(schedule: AutoAdsSchedule): string {
  const now = new Date();
  const d = new Date(now);
  if (schedule.frequency === 'daily') d.setDate(d.getDate() + 1);
  else if (schedule.frequency === 'every_3_days') d.setDate(d.getDate() + 3);
  else d.setDate(d.getDate() + 7);
  return d.toISOString();
}

export async function runAutoAdsIfNeeded(uid: string, runNow = false): Promise<{ ran: boolean; created?: number }> {
  const schedule = await getAutoAdsSchedule(uid);
  if (!schedule?.enabled && !runNow) return { ran: false };
  const now = new Date().toISOString();
  if (!runNow && schedule?.nextRunAt && schedule.nextRunAt > now) return { ran: false };

  const settingsRef = doc(db, 'users', uid, 'settings', 'connections');
  const settingsSnap = await getDoc(settingsRef);
  const items = settingsSnap.data()?.items as Array<{ id: string; settings?: Record<string, string> }> | undefined;
  const woo = items?.find((c) => c.id === 'woocommerce');
  const aiKeys = items ? getAIKeysFromConnections(items) : {};
  if (!woo?.settings?.storeUrl || !woo?.settings?.wooKey || !woo?.settings?.wooSecret) {
    if (schedule?.enabled) await setAutoAdsSchedule(uid, { lastRunAt: now, nextRunAt: nextRunAt(schedule!) });
    return { ran: false };
  }

  const { storeUrl, wooKey, wooSecret } = woo.settings;
  let products: Array<{ id: number; name: string; short_description?: string; description?: string }>;
  try {
    products = await fetchWooCommerceProducts(storeUrl, wooKey, wooSecret);
  } catch {
    if (schedule?.enabled) await setAutoAdsSchedule(uid, { lastRunAt: now, nextRunAt: nextRunAt(schedule!) });
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
      const options = res?.options || [];
      const first = options[0];
      if (first) {
        await saveAdToFirestore(uid, {
          type: 'copy',
          createdAt: now,
          productName: name,
          payload: { headline: first.headline, primaryText: first.primaryText, description: first.description },
        });
        created++;
      }
    } catch (e) {
      console.warn('Auto-ad copy generation failed for product', p.id, e);
    }
  }

  if (schedule) {
    await setAutoAdsSchedule(uid, {
      lastRunAt: now,
      nextRunAt: schedule.enabled ? nextRunAt(schedule) : (schedule.nextRunAt ?? null),
    });
  }
  return { ran: true, created };
}
