import { GoogleGenAI } from "@google/genai";
import { getAIKeysFromConnections, requestJSON, hasAnyAIKey, type AIKeys } from "./multiAI";

export { getAIKeysFromConnections, hasAnyAIKey } from "./multiAI";

const DEFAULT_MODEL = "gemini-2.0-flash";

export type AIKeysOrApiKey = AIKeys | string | undefined;

function getEnvApiKey(): string | undefined {
  if (typeof process !== "undefined" && process.env?.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  if (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_GEMINI_API_KEY) return (import.meta as any).env.VITE_GEMINI_API_KEY;
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
    return runWithMultiAI<{ recommendations?: any[] }>(prompt, apiKeyOrKeys);
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
