import { GoogleGenAI } from "@google/genai";
import { getAIKeysFromConnections, requestJSON, hasAnyAIKey, type AIKeys } from "./multiAI";

export { getAIKeysFromConnections, hasAnyAIKey } from "./multiAI";

const DEFAULT_MODEL = "gemini-2.0-flash-001";

export type AIKeysOrApiKey = AIKeys | string | undefined;

function getEnvApiKey(): string | undefined {
  if (typeof process !== "undefined" && process.env?.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  if (typeof import.meta !== "undefined" && (import.meta as unknown as { env?: Record<string, unknown> }).env?.VITE_GEMINI_API_KEY) return String((import.meta as unknown as { env?: Record<string, unknown> }).env!.VITE_GEMINI_API_KEY);
  return undefined;
}

function getAI(apiKey?: string) {
  const key = apiKey?.trim() || getEnvApiKey();
  if (!key) {
    return null;
  }
  return new GoogleGenAI({ apiKey: key });
}

function isAIKeys(v: AIKeysOrApiKey): v is AIKeys {
  return v != null && typeof v === "object" && ("gemini" in v || "openai" in v || "claude" in v);
}

async function runWithMultiAI<T>(prompt: string, keys: AIKeys): Promise<T> {
  const { data } = await requestJSON<T>(prompt, keys);
  return data;
}

export async function generateAdCopy(productName: string, platform: string, targetAudience: string, apiKeyOrKeys?: AIKeysOrApiKey) {
  const prompt = `Create an ad copy for ${platform} for the product "${productName}". Target audience: ${targetAudience}. 
  Include a catchy headline, engaging body text, and a strong call to action. 
  Keep it appropriate for the platform (e.g., short and punchy for TikTok, detailed for Google Search, visual/engaging for Meta).
  Return the response in JSON format with keys: "headline", "body", "cta".`;

  if (isAIKeys(apiKeyOrKeys) && hasAnyAIKey(apiKeyOrKeys)) {
    return runWithMultiAI<{ headline?: string; body?: string; cta?: string }>(prompt, apiKeyOrKeys);
  }
  const ai = getAI(typeof apiKeyOrKeys === "string" ? apiKeyOrKeys : undefined);
  if (!ai) return {};
  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    contents: prompt,
    config: { responseMimeType: "application/json" },
  });
  return JSON.parse(response.text || "{}");
}

export async function optimizeProductSEO(productName: string, currentDescription: string, apiKeyOrKeys?: AIKeysOrApiKey) {
  const prompt = `Optimize the SEO for a WooCommerce product named "${productName}". 
  Current description: "${currentDescription}".
  Provide an optimized short description, a detailed long description, and 3 suggested image alt texts.
  Return the response in JSON format with keys: "shortDescription", "longDescription", "imageAltTexts" (array of strings).`;

  if (isAIKeys(apiKeyOrKeys) && hasAnyAIKey(apiKeyOrKeys)) {
    return runWithMultiAI<{ shortDescription?: string; longDescription?: string; imageAltTexts?: string[] }>(prompt, apiKeyOrKeys);
  }
  const ai = getAI(typeof apiKeyOrKeys === "string" ? apiKeyOrKeys : undefined);
  if (!ai) return {};
  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    contents: prompt,
    config: { responseMimeType: "application/json" },
  });
  return JSON.parse(response.text || "{}");
}

export async function generateNegativeKeywords(campaignData: string, apiKeyOrKeys?: AIKeysOrApiKey) {
  const prompt = `Based on the following campaign performance data and search terms, generate a list of negative keywords to add to Google Ads to improve ROI and reduce wasted spend.
  Data: ${campaignData}
  Return the response in JSON format with a key "negativeKeywords" containing an array of strings.`;

  if (isAIKeys(apiKeyOrKeys) && hasAnyAIKey(apiKeyOrKeys)) {
    return runWithMultiAI<{ negativeKeywords?: string[] }>(prompt, apiKeyOrKeys);
  }
  const ai = getAI(typeof apiKeyOrKeys === "string" ? apiKeyOrKeys : undefined);
  if (!ai) return {};
  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    contents: prompt,
    config: { responseMimeType: "application/json" },
  });
  return JSON.parse(response.text || "{}");
}

export async function getOptimizationRecommendations(
  platformData: string,
  apiKeyOrKeys?: AIKeysOrApiKey,
  responseLanguage: string = 'English'
) {
  const prompt = `Analyze the following advertising data across platforms and provide 3 actionable optimization recommendations.
    Data: ${platformData}
    Return the response in JSON format with a key "recommendations" containing an array of objects with keys "title", "description", "platform" (Google, Meta, TikTok, or All), and "impact" (High, Medium, Low).
    IMPORTANT:
    - "title" and "description" must be written in ${responseLanguage}.
    - "platform" must remain one of: Google, Meta, TikTok, All.
    - "impact" must remain one of: High, Medium, Low.`;

  if (isAIKeys(apiKeyOrKeys) && hasAnyAIKey(apiKeyOrKeys)) {
    return runWithMultiAI<{ recommendations?: Record<string, unknown>[] }>(prompt, apiKeyOrKeys);
  }
  const ai = getAI(typeof apiKeyOrKeys === "string" ? apiKeyOrKeys : undefined);
  if (!ai) return {};
  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    contents: prompt,
    config: { responseMimeType: "application/json" },
  });
  return JSON.parse(response.text || "{}");
}

export async function generateCreativeCopy(productName: string, productDesc: string, additionalPrompt: string, apiKeyOrKeys?: AIKeysOrApiKey) {
  const prompt = `Create 2 options for ad copy for a product named "${productName}". 
  Product description: "${productDesc}".
  Additional user instructions: "${additionalPrompt}".
  Return the response in JSON format with a key "options" containing an array of objects, each with keys "headline", "primaryText", and "description".
  Write the copy in Hebrew.`;

  if (isAIKeys(apiKeyOrKeys) && hasAnyAIKey(apiKeyOrKeys)) {
    return runWithMultiAI<{ options?: { headline: string; primaryText: string; description: string }[] }>(prompt, apiKeyOrKeys);
  }
  const ai = getAI(typeof apiKeyOrKeys === "string" ? apiKeyOrKeys : undefined);
  if (!ai) return {};
  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    contents: prompt,
    config: { responseMimeType: "application/json" },
  });
  return JSON.parse(response.text || "{}");
}

export interface AudienceRecommendation {
  title: string;
  description: string;
  platform: 'Google' | 'Meta' | 'TikTok' | 'cross';
  suggestedName: string;
  suggestedRules: Array<{ type: string; name?: string; value?: string | number | string[] }>;
  estimatedSize?: string;
  potentialRoas?: string;
  impact: 'High' | 'Medium' | 'Low';
}

export async function getAudienceRecommendations(platformData: string, apiKeyOrKeys?: AIKeysOrApiKey): Promise<{ recommendations: AudienceRecommendation[] }> {
  const prompt = `You are an expert in paid advertising audiences for Google Ads, Meta (Facebook/Instagram), and TikTok Ads.
Based on the following platform performance data (campaigns, conversions, ROAS, spend, audiences), suggest 3-5 audience segments we could create or improve.
Data (JSON or summary):
${platformData}

Return ONLY valid JSON with this exact structure (write in Hebrew for title, description, suggestedName):
{
  "recommendations": [
    {
      "title": "short title in Hebrew",
      "description": "1-2 sentences in Hebrew explaining the segment and why it helps",
      "platform": "Google" or "Meta" or "TikTok" or "cross",
      "suggestedName": "audience name in Hebrew",
      "suggestedRules": [
        { "type": "demographics", "name": "age", "value": "25-44" }
      ],
      "estimatedSize": "optional e.g. 50,000",
      "potentialRoas": "optional e.g. 3.2x",
      "impact": "High" or "Medium" or "Low"
    }
  ]
}`;

  if (isAIKeys(apiKeyOrKeys) && hasAnyAIKey(apiKeyOrKeys)) {
    try {
      const data = await runWithMultiAI<{ recommendations?: AudienceRecommendation[] }>(prompt, apiKeyOrKeys);
      return {
        recommendations: Array.isArray(data?.recommendations) ? data.recommendations : [],
      };
    } catch (e) {
      console.warn("getAudienceRecommendations failed", e);
      return { recommendations: [] };
    }
  }
  const ai = getAI(typeof apiKeyOrKeys === "string" ? apiKeyOrKeys : undefined);
  if (!ai) return { recommendations: [] };
  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });
    const text = response.text || "{}";
    const parsed = JSON.parse(text);
    return Array.isArray(parsed?.recommendations) ? parsed : { recommendations: [] };
  } catch (e) {
    console.warn("getAudienceRecommendations failed", e);
    return { recommendations: [] };
  }
}

export interface AIRecommendation {
  id: string;
  platform: 'google' | 'meta' | 'tiktok' | 'cross';
  type: 'budget' | 'creative' | 'targeting' | 'bid';
  title: string;
  description: string;
  impact: string;
  difficulty: 'easy' | 'medium' | 'hard';
  status: 'pending' | 'applied' | 'dismissed';
}

export async function generateAIRecommendations(apiKeyOrKeys: string | AIKeys, context: string): Promise<AIRecommendation[]> {
  const prompt = `
    You are an expert digital marketing AI assistant.
    Analyze the following marketing context and provide 3-4 specific, actionable recommendations for Google Ads, Meta Ads, TikTok Ads, or cross-platform optimization.

    Context: ${context}

    Return ONLY valid JSON array (no markdown), exactly this structure:
    [
      {
        "id": "1",
        "platform": "google",
        "type": "budget",
        "title": "string in Hebrew",
        "description": "string in Hebrew",
        "impact": "e.g. +15% ROAS",
        "difficulty": "easy"
      }
    ]
    All recommendations in Hebrew. Platform must be one of: google, meta, tiktok, cross. Type: budget, creative, targeting, bid. Difficulty: easy, medium, hard.
  `;

  function mapRow(r: Record<string, unknown>, i: number): AIRecommendation {
    return {
      id: String(r?.id ?? i + 1),
      platform: (r?.platform as AIRecommendation['platform']) ?? 'cross',
      type: (r?.type as AIRecommendation['type']) ?? 'targeting',
      title: String(r?.title ?? 'המלצה'),
      description: String(r?.description ?? ''),
      impact: String(r?.impact ?? ''),
      difficulty: (r?.difficulty as AIRecommendation['difficulty']) ?? 'medium',
      status: 'pending',
    };
  }

  if (typeof apiKeyOrKeys === 'object' && hasAnyAIKey(apiKeyOrKeys)) {
    const data = await runWithMultiAI<unknown[]>(prompt, apiKeyOrKeys);
    return (Array.isArray(data) ? data : []).map((r, i) => mapRow(r as Record<string, unknown>, i));
  }

  const ai = getAI(typeof apiKeyOrKeys === 'string' ? apiKeyOrKeys : undefined);
  if (!ai) throw new Error('Gemini API key is missing. Add it in Integrations (Gemini) or set GEMINI_API_KEY in .env.');
  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });
    const text = response.text || '[]';
    const arr = JSON.parse(text);
    return (Array.isArray(arr) ? arr : []).map((r, i) => mapRow(r as Record<string, unknown>, i));
  } catch (error) {
    console.error('Gemini API Error:', error);
    throw error;
  }
}

export interface CampaignBuilderSuggestion {
  shortTitle?: string;
  campaignName?: string;
  objective?: 'sales' | 'traffic' | 'leads' | 'awareness' | 'retargeting';
  contentType?: 'product' | 'offer' | 'educational' | 'testimonial' | 'video';
  productType?: 'fashion' | 'beauty' | 'tech' | 'home' | 'fitness' | 'services' | 'other';
  serviceType?: string;
  audiences?: string[];
  recommendedHoursByPlatform?: {
    Google?: number[];
    Meta?: number[];
    TikTok?: number[];
  };
  targetingRules?: Array<{
    platform: 'Google' | 'Meta' | 'TikTok';
    startHour: number;
    endHour: number;
    action: 'boost' | 'limit' | 'pause';
    minRoas: number;
    reason?: string;
  }>;
  platformCopy?: {
    Google?: { title: string; description: string };
    Meta?: { title: string; description: string };
    TikTok?: { title: string; description: string };
  };
}

export async function getCampaignBuilderSuggestions(
  contextData: string,
  apiKeyOrKeys?: AIKeysOrApiKey,
  responseLanguage: string = 'Hebrew'
): Promise<CampaignBuilderSuggestion> {
  const prompt = `You are an ad strategy planner for Google, Meta and TikTok.
Given campaign context and connected platform performance data, return one smart editable campaign setup.
Context data:
${contextData}

Return ONLY strict JSON with this structure:
{
  "shortTitle": "main campaign title, MAX 90 characters, in ${responseLanguage}. If the context includes a product price, include it in the title (e.g. 'Product Name – ₪XX'). NEVER exceed 90 characters.",
  "campaignName": "short internal campaign name in ${responseLanguage}",
  "objective": "sales|traffic|leads|awareness|retargeting",
  "contentType": "product|offer|educational|testimonial|video",
  "productType": "fashion|beauty|tech|home|fitness|services|other",
  "serviceType": "free text in ${responseLanguage}",
  "audiences": ["..."],
  "recommendedHoursByPlatform": {
    "Google": [9,10,11,18,19],
    "Meta": [12,13,20,21],
    "TikTok": [19,20,21,22]
  },
  "targetingRules": [
    {
      "platform": "Google|Meta|TikTok",
      "startHour": 0,
      "endHour": 23,
      "action": "boost|limit|pause",
      "minRoas": 0,
      "reason": "short reason in ${responseLanguage}"
    }
  ],
  "platformCopy": {
    "Google": {
      "title": "Google Search headline, STRICT MAX 30 characters (Google enforces this limit). If product has price, include it.",
      "description": "Google Search description, STRICT MAX 90 characters"
    },
    "Meta": {
      "title": "Meta ad headline, MAX 40 characters",
      "description": "Meta primary text, 80-125 characters, engaging and conversational"
    },
    "TikTok": {
      "title": "TikTok hook/caption title, MAX 40 characters, trendy and direct",
      "description": "TikTok ad caption, MAX 100 characters"
    }
  }
}

Rules:
- Keep hours integers between 0 and 23.
- Keep arrays concise and practical.
- Ensure objective/contentType/productType are from allowed values only.
- shortTitle MUST be 90 characters or fewer — count carefully.
- Google title MUST be 30 characters or fewer — Google will reject longer headlines.
- If the context data contains a product price (e.g. WooCommerce price), always weave it into shortTitle and relevant platform copy.`;

  if (isAIKeys(apiKeyOrKeys) && hasAnyAIKey(apiKeyOrKeys)) {
    try {
      const data = await runWithMultiAI<CampaignBuilderSuggestion>(prompt, apiKeyOrKeys);
      return data || {};
    } catch (e) {
      console.warn('getCampaignBuilderSuggestions failed', e);
      return {};
    }
  }

  const ai = getAI(typeof apiKeyOrKeys === 'string' ? apiKeyOrKeys : undefined);
  if (!ai) return {};
  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });
    const parsed = JSON.parse(response.text || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    console.warn('getCampaignBuilderSuggestions failed', e);
    return {};
  }
}
