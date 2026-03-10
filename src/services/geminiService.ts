import { GoogleGenAI } from "@google/genai";

export async function generateAIRecommendations(apiKey: string, context: string) {
  const ai = new GoogleGenAI({ apiKey });
  
  const prompt = `
    You are an expert digital marketing AI assistant. 
    Analyze the following marketing context and provide 3-4 specific, actionable recommendations for Google Ads, Meta Ads, TikTok Ads, or cross-platform optimization.
    
    Context: ${context}
    
    Return the response in JSON format matching this structure:
    [
      {
        "id": "string",
        "platform": "google" | "meta" | "tiktok" | "cross",
        "type": "budget" | "creative" | "targeting" | "bid",
        "title": "string",
        "description": "string",
        "impact": "string (e.g. +15% ROAS)",
        "difficulty": "easy" | "medium" | "hard"
      }
    ]
    
    The recommendations should be in Hebrew.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });
    
    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
}
