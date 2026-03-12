import { GoogleGenAI } from "@google/genai";

const DEFAULT_MODEL = "gemini-2.0-flash";

function getEnvApiKey(): string | undefined {
  if (typeof process !== "undefined" && process.env?.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  if (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_GEMINI_API_KEY) return (import.meta as any).env.VITE_GEMINI_API_KEY;
  return undefined;
}

function getAI(apiKey?: string) {
  const key = apiKey?.trim() || getEnvApiKey();
  if (!key) {
    console.warn("GEMINI_API_KEY is not defined and no API key was passed. AI features will not work.");
    return null;
  }
  return new GoogleGenAI({ apiKey: key });
}

export async function generateAdCopy(productName: string, platform: string, targetAudience: string, apiKey?: string) {
  const ai = getAI(apiKey);
  if (!ai) return {};

  const prompt = `Create an ad copy for ${platform} for the product "${productName}". Target audience: ${targetAudience}. 
  Include a catchy headline, engaging body text, and a strong call to action. 
  Keep it appropriate for the platform (e.g., short and punchy for TikTok, detailed for Google Search, visual/engaging for Meta).
  Return the response in JSON format with keys: "headline", "body", "cta".`;

  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  return JSON.parse(response.text || "{}");
}

export async function optimizeProductSEO(productName: string, currentDescription: string, apiKey?: string) {
  const ai = getAI(apiKey);
  if (!ai) return {};

  const prompt = `Optimize the SEO for a WooCommerce product named "${productName}". 
  Current description: "${currentDescription}".
  Provide an optimized short description, a detailed long description, and 3 suggested image alt texts.
  Return the response in JSON format with keys: "shortDescription", "longDescription", "imageAltTexts" (array of strings).`;

  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  return JSON.parse(response.text || "{}");
}

export async function generateNegativeKeywords(campaignData: string, apiKey?: string) {
  const ai = getAI(apiKey);
  if (!ai) return {};

  const prompt = `Based on the following campaign performance data and search terms, generate a list of negative keywords to add to Google Ads to improve ROI and reduce wasted spend.
  Data: ${campaignData}
  Return the response in JSON format with a key "negativeKeywords" containing an array of strings.`;

  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  return JSON.parse(response.text || "{}");
}

export async function getOptimizationRecommendations(platformData: string, apiKey?: string) {
    const ai = getAI(apiKey);
    if (!ai) return {};

    const prompt = `Analyze the following advertising data across platforms and provide 3 actionable optimization recommendations.
    Data: ${platformData}
    Return the response in JSON format with a key "recommendations" containing an array of objects with keys "title", "description", "platform" (Google, Meta, TikTok, or All), and "impact" (High, Medium, Low).`;
  
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });
  
    return JSON.parse(response.text || "{}");
}

export async function generateCreativeCopy(productName: string, productDesc: string, additionalPrompt: string, apiKey?: string) {
  const ai = getAI(apiKey);
  if (!ai) return {};

  const prompt = `Create 2 options for ad copy for a product named "${productName}". 
  Product description: "${productDesc}".
  Additional user instructions: "${additionalPrompt}".
  Return the response in JSON format with a key "options" containing an array of objects, each with keys "headline", "primaryText", and "description".
  Write the copy in Hebrew.`;

  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
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

export async function getAudienceRecommendations(platformData: string, apiKey?: string): Promise<{ recommendations: AudienceRecommendation[] }> {
  const ai = getAI(apiKey);
  if (!ai) return { recommendations: [] };

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
