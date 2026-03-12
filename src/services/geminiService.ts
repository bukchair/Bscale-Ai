import { GoogleGenAI } from "@google/genai";

const DEFAULT_MODEL = "gemini-2.0-flash";

function parseJsonSafe<T>(text: string, fallback: T): T {
  if (!text || !text.trim()) return fallback;
  const raw = text.trim().replace(/^```json\s*/i, "").replace(/\s*```$/i, "");
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function generateAIRecommendations(apiKey: string, context: string) {
  if (!apiKey?.trim()) throw new Error("Gemini API key is missing. Add it in Integrations (Gemini) or set GEMINI_API_KEY in .env.");
  const ai = new GoogleGenAI({ apiKey: apiKey.trim() });

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

  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });
    const text = (response as any).text ?? (response as any).candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsed = parseJsonSafe<unknown>(text, []);
    const arr = Array.isArray(parsed) ? parsed : [];
    return arr.map((r: any, i: number) => ({
      id: String(r?.id ?? i + 1),
      platform: r?.platform ?? "cross",
      type: r?.type ?? "targeting",
      title: r?.title ?? "המלצה",
      description: r?.description ?? "",
      impact: r?.impact ?? "",
      difficulty: r?.difficulty ?? "medium",
      status: "pending",
    }));
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
}
