import { GoogleGenAI, Type } from "@google/genai";

export interface SEOOptimizationResult {
  short_description: string;
  description: string;
  seo_title: string;
  seo_keywords: string[];
}

export async function optimizeProductSEO(product: {
  name: string;
  short_description: string;
  description: string;
  sku: string;
  categories: { name: string }[];
}): Promise<SEOOptimizationResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key is missing");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const prompt = `
    Optimize the following product for SEO in Hebrew.
    Product Name: ${product.name}
    SKU: ${product.sku}
    Categories: ${product.categories.map(c => c.name).join(', ')}
    Current Short Description: ${product.short_description}
    Current Full Description: ${product.description}

    Please provide:
    1. An improved, SEO-friendly short description.
    2. An improved, SEO-friendly full description.
    3. A suggested SEO title.
    4. A list of 5-10 SEO keywords.
    
    Return the result in JSON format.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          short_description: { type: Type.STRING },
          description: { type: Type.STRING },
          seo_title: { type: Type.STRING },
          seo_keywords: { 
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
        },
        required: ["short_description", "description", "seo_title", "seo_keywords"],
      },
    },
  });

  return JSON.parse(response.text);
}
