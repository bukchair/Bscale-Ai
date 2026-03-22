import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { httpStatusFromError } from '@/src/lib/integrations/core/errors';
import { logWithUserContext } from '@/src/lib/logging/server-structured-log';
import { connectionService } from '@/src/lib/integrations/services/connection-service';
import { createGoogleDraft } from '@/src/lib/one-click/builders/google';
import { createMetaDraft } from '@/src/lib/one-click/builders/meta';
import { createTikTokDraft } from '@/src/lib/one-click/builders/tiktok';
import type {
  OneClickObjective,
  OneClickPlatform,
  OneClickProductInfo,
  OneClickStrategy,
  PlatformResult,
} from '@/src/lib/one-click/types';

type ObjectiveType = 'sales' | 'traffic' | 'leads' | 'awareness' | 'retargeting';
type PlatformName = 'Google' | 'Meta' | 'TikTok';
type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
type WeeklySchedule = Record<string, Record<DayKey, number[]>>;

type CreateScheduledCampaignBody = {
  campaignName?: string;
  shortTitle?: string;
  brief?: string;
  objective?: ObjectiveType;
  dailyBudget?: number;
  country?: string;
  /** Ad / copy language hint (optional; reserved for future use) */
  language?: string;
  /** When true, campaigns are created ENABLED/ACTIVE on platforms regardless of weekly schedule. */
  activateImmediately?: boolean;
  platforms?: PlatformName[];
  weeklySchedule?: WeeklySchedule;
  audiences?: string[];
  contentType?: string;
  productType?: string;
  serviceType?: string;
  wooProductName?: string;
  timeRules?: unknown;
  product?: {
    name?: string;
    description?: string;
    price?: string;
    url?: string;
    imageUrl?: string;
  };
  platformCopyDrafts?: Partial<Record<PlatformName, { title?: string; description?: string }>>;
};

type PlatformCreateResult = {
  platform: PlatformName;
  ok: boolean;
  campaignId?: string;
  message: string;
  status: 'Scheduled' | 'Draft';
};

const DAY_BY_JS: Record<number, DayKey> = {
  0: 'sun',
  1: 'mon',
  2: 'tue',
  3: 'wed',
  4: 'thu',
  5: 'fri',
  6: 'sat',
};

const sanitizeName = (value: string) => value.trim().slice(0, 120);
const sanitizeAudienceName = (value: string) => value.trim().slice(0, 80);

const isHourActiveForPlatform = (schedule: WeeklySchedule | undefined, platform: PlatformName) => {
  const platformSchedule = schedule?.[platform];
  if (!platformSchedule) return false;
  const now = new Date();
  const day = DAY_BY_JS[now.getDay()];
  const hour = now.getHours();
  const activeHours = Array.isArray(platformSchedule[day]) ? platformSchedule[day] : [];
  return activeHours.includes(hour);
};

const normalizeAudienceInputs = (audiences: unknown): string[] => {
  if (!Array.isArray(audiences)) return [];
  const cleaned = audiences
    .map((item) => sanitizeAudienceName(String(item || '')))
    .filter((item) => item.length > 0);
  return [...new Set(cleaned)];
};

const mapObjectiveToOneClick = (objective: ObjectiveType): OneClickObjective => {
  if (objective === 'sales' || objective === 'retargeting') return 'sales';
  if (objective === 'leads') return 'leads';
  return 'traffic';
};

const buildOneClickStrategy = (
  body: CreateScheduledCampaignBody,
  resolvedCampaignName: string,
  objective: OneClickObjective
): OneClickStrategy => {
  const normalizedAudience = normalizeAudienceInputs(body.audiences);
  const drafts = body.platformCopyDrafts || {};
  const getDraft = (platform: OneClickPlatform) => ({
    title: sanitizeName(String(drafts?.[platform]?.title || body.shortTitle || resolvedCampaignName)),
    description: String(drafts?.[platform]?.description || body.brief || '').trim().slice(0, 240),
    cta: 'Shop Now',
  });
  return {
    campaignName: sanitizeName(resolvedCampaignName),
    shortTitle: sanitizeName(String(body.shortTitle || resolvedCampaignName)).slice(0, 90),
    audiences: normalizedAudience,
    objective,
    platformCopy: {
      Google: getDraft('Google'),
      Meta: getDraft('Meta'),
      TikTok: getDraft('TikTok'),
    },
  };
};

const buildProductPayload = (
  body: CreateScheduledCampaignBody,
  resolvedCampaignName: string
): OneClickProductInfo | undefined => {
  const direct = body.product || {};
  const product: OneClickProductInfo = {
    name: sanitizeName(String(direct.name || body.wooProductName || body.shortTitle || resolvedCampaignName)),
    description: String(direct.description || body.brief || '').trim().slice(0, 500),
    price: String(direct.price || '').trim().slice(0, 30),
    url: String(direct.url || '').trim().slice(0, 500),
    imageUrl: String(direct.imageUrl || '').trim().slice(0, 1000) || undefined,
  };
  if (!product.name && !product.description && !product.url && !product.imageUrl) return undefined;
  return product;
};

const isIncompletePlatformResult = (result: PlatformResult): boolean => {
  if (!result.ok) return true;
  const message = String(result.message || '').toLowerCase();
  return (
    message.includes('ad group failed') ||
    message.includes('ad set failed') ||
    message.includes('creative failed') ||
    message.includes('no image available') ||
    message.includes('skipped')
  );
};

const resolveActivateFlag = (body: CreateScheduledCampaignBody, platform: PlatformName) =>
  Boolean(body.activateImmediately) || isHourActiveForPlatform(body.weeklySchedule, platform);

const createGoogleCampaign = async (
  userId: string,
  body: CreateScheduledCampaignBody
): Promise<PlatformCreateResult> => {
  const activateFlag = resolveActivateFlag(body, 'Google');
  const objective = mapObjectiveToOneClick((body.objective || 'sales') as ObjectiveType);
  const strategy = buildOneClickStrategy(
    body,
    sanitizeName(body.campaignName || body.shortTitle || 'BScale Campaign'),
    objective
  );
  const product = buildProductPayload(body, strategy.campaignName);
  const result = await createGoogleDraft(
    userId,
    strategy.campaignName,
    objective,
    Math.max(Number(body.dailyBudget) || 20, 1),
    strategy,
    activateFlag,
    String(body.country || 'IL'),
    product
  );
  return {
    platform: 'Google',
    ok: !isIncompletePlatformResult(result),
    campaignId: result.campaignId,
    message: result.message,
    status: activateFlag ? 'Scheduled' : 'Draft',
  };
};

const createMetaCampaign = async (
  userId: string,
  body: CreateScheduledCampaignBody,
  mediaBuffer?: Buffer,
  mediaMimeType?: string
): Promise<PlatformCreateResult> => {
  const activateFlag = resolveActivateFlag(body, 'Meta');
  const objective = mapObjectiveToOneClick((body.objective || 'sales') as ObjectiveType);
  const strategy = buildOneClickStrategy(
    body,
    sanitizeName(body.campaignName || body.shortTitle || 'BScale Campaign'),
    objective
  );
  const product = buildProductPayload(body, strategy.campaignName);
  const result = await createMetaDraft(
    userId,
    strategy.campaignName,
    objective,
    Math.max(Number(body.dailyBudget) || 20, 1),
    strategy,
    activateFlag,
    String(body.country || 'IL'),
    product,
    mediaBuffer,
    mediaMimeType
  );
  return {
    platform: 'Meta',
    ok: !isIncompletePlatformResult(result),
    campaignId: result.campaignId,
    message: result.message,
    status: activateFlag ? 'Scheduled' : 'Draft',
  };
};

const createTikTokCampaign = async (
  userId: string,
  body: CreateScheduledCampaignBody,
  mediaBuffer?: Buffer,
  mediaMimeType?: string
): Promise<PlatformCreateResult> => {
  const activateFlag = resolveActivateFlag(body, 'TikTok');
  const objective = mapObjectiveToOneClick((body.objective || 'sales') as ObjectiveType);
  const strategy = buildOneClickStrategy(
    body,
    sanitizeName(body.campaignName || body.shortTitle || 'BScale Campaign'),
    objective
  );
  const product = buildProductPayload(body, strategy.campaignName);
  const result = await createTikTokDraft(
    userId,
    strategy.campaignName,
    objective,
    Math.max(Number(body.dailyBudget) || 50, 50),
    strategy,
    activateFlag,
    String(body.country || 'IL'),
    product,
    mediaBuffer,
    mediaMimeType
  );
  return {
    platform: 'TikTok',
    ok: !isIncompletePlatformResult(result),
    campaignId: result.campaignId,
    message: result.message,
    status: activateFlag ? 'Scheduled' : 'Draft',
  };
};

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    let body: CreateScheduledCampaignBody | null = null;
    let mediaBuffer: Buffer | undefined;
    let mediaMimeType: string | undefined;
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const rawBody = form.get('body');
      if (typeof rawBody === 'string') {
        body = (JSON.parse(rawBody) as CreateScheduledCampaignBody) || null;
      }
      const mediaFile = form.get('media');
      if (mediaFile instanceof File && mediaFile.size > 0) {
        mediaBuffer = Buffer.from(await mediaFile.arrayBuffer());
        mediaMimeType = mediaFile.type || 'image/jpeg';
      }
    } else {
      body = (await request.json().catch(() => null)) as CreateScheduledCampaignBody | null;
    }
    const resolvedCampaignName = sanitizeName(
      String(
        body?.campaignName ||
          body?.shortTitle ||
          body?.brief?.slice(0, 80) ||
          'BScale Campaign'
      )
    );
    if (!resolvedCampaignName) {
      return NextResponse.json(
        {
          success: false,
          message: 'campaignName (or shortTitle) is required.',
        },
        { status: 400 }
      );
    }

    let platforms = (Array.isArray(body?.platforms) ? body?.platforms : []).filter(
      (platform): platform is PlatformName =>
        platform === 'Google' || platform === 'Meta' || platform === 'TikTok'
    );
    if (!platforms.length) {
      const [googleConnection, metaConnection, tiktokConnection] = await Promise.all([
        connectionService.getByUserPlatform(user.id, 'GOOGLE_ADS'),
        connectionService.getByUserPlatform(user.id, 'META'),
        connectionService.getByUserPlatform(user.id, 'TIKTOK'),
      ]);
      platforms = [
        googleConnection?.status === 'CONNECTED' ? 'Google' : null,
        metaConnection?.status === 'CONNECTED' ? 'Meta' : null,
        tiktokConnection?.status === 'CONNECTED' ? 'TikTok' : null,
      ].filter((value): value is PlatformName => Boolean(value));
    }
    if (!platforms.length) {
      return NextResponse.json(
        {
          success: false,
          message: 'No connected ad platforms were provided.',
        },
        { status: 400 }
      );
    }

    const normalizedBody: CreateScheduledCampaignBody = {
      ...(body || {}),
      campaignName: resolvedCampaignName,
      platforms,
    };

    const results: PlatformCreateResult[] = [];
    for (const platform of platforms) {
      if (platform === 'Google') {
        results.push(await createGoogleCampaign(user.id, normalizedBody));
      } else if (platform === 'Meta') {
        results.push(await createMetaCampaign(user.id, normalizedBody, mediaBuffer, mediaMimeType));
      } else if (platform === 'TikTok') {
        results.push(await createTikTokCampaign(user.id, normalizedBody, mediaBuffer, mediaMimeType));
      }
    }

    const successCount = results.filter((item) => item.ok).length;
    return NextResponse.json(
      {
        success: successCount > 0,
        createdCount: successCount,
        failedCount: results.length - successCount,
        results,
      },
      { status: 200 }
    );
  } catch (error) {
    if (httpStatusFromError(error) >= 500) {
      logWithUserContext('ERROR', 'scheduled campaign creation failed', {
        path: '/api/campaigns/scheduled',
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create scheduled campaigns.',
      },
      { status: httpStatusFromError(error) }
    );
  }
}
