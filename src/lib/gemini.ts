import { GoogleGenAI } from "@google/genai";

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY is not defined. AI features will not work.");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export async function generateAdCopy(productName: string, platform: string, targetAudience: string) {
  const ai = getAI();
  if (!ai) return {};

  const prompt = `Create an ad copy for ${platform} for the product "${productName}". Target audience: ${targetAudience}. 
  Include a catchy headline, engaging body text, and a strong call to action. 
  Keep it appropriate for the platform (e.g., short and punchy for TikTok, detailed for Google Search, visual/engaging for Meta).
  Return the response in JSON format with keys: "headline", "body", "cta".`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  return JSON.parse(response.text || "{}");
}

export async function optimizeProductSEO(productName: string, currentDescription: string) {
  const ai = getAI();
  if (!ai) return {};

  const prompt = `Optimize the SEO for a WooCommerce product named "${productName}". 
  Current description: "${currentDescription}".
  Provide an optimized short description, a detailed long description, and 3 suggested image alt texts.
  Return the response in JSON format with keys: "shortDescription", "longDescription", "imageAltTexts" (array of strings).`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  return JSON.parse(response.text || "{}");
}

export async function generateNegativeKeywords(campaignData: string) {
  const ai = getAI();
  if (!ai) return {};

  const prompt = `Based on the following campaign performance data and search terms, generate a list of negative keywords to add to Google Ads to improve ROI and reduce wasted spend.
  Data: ${campaignData}
  Return the response in JSON format with a key "negativeKeywords" containing an array of strings.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  return JSON.parse(response.text || "{}");
}

export async function getOptimizationRecommendations(platformData: string) {
    const ai = getAI();
    if (!ai) return {};

    const prompt = `Analyze the following advertising data across platforms and provide 3 actionable optimization recommendations.
    Data: ${platformData}
    Return the response in JSON format with a key "recommendations" containing an array of objects with keys "title", "description", "platform" (Google, Meta, TikTok, or All), and "impact" (High, Medium, Low).`;
  
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });
  
    return JSON.parse(response.text || "{}");
}

export async function generateCreativeCopy(productName: string, productDesc: string, additionalPrompt: string) {
  const ai = getAI();
  if (!ai) return {};

  const prompt = `Create 2 options for ad copy for a product named "${productName}". 
  Product description: "${productDesc}".
  Additional user instructions: "${additionalPrompt}".
  Return the response in JSON format with a key "options" containing an array of objects, each with keys "headline", "primaryText", and "description".
  Write the copy in Hebrew.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  return JSON.parse(response.text || "{}");
}
