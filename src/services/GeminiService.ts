import { GoogleGenAI } from "@google/genai";
import { Product } from '../types';

export class GeminiService {
  private static ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

  static async getRecipeSuggestions(userPrompt: string, availableProducts: Product[]) {
    const productList = availableProducts.map(p => `${p.name} (₹${p.price}/${p.unit})`).join(', ');
    
    const systemPrompt = `
      You are VegieRoute Chef, an AI culinary assistant. 
      Available Fresh Produce: ${productList}

      CRITICAL INSTRUCTIONS:
      1. Suggest recipes based on current stock.
      2. Format: "Recipe Name", "Brief Intro", "Steps".
      3. At the end, MUST include: "PRODUCTS_NEEDED: [Product Name 1, Product Name 2]".
      4. Only suggest products exactly as named in the list.
    `;

    try {
      const result = await this.ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.7,
        },
      });

      const text = result.text || "";
      return text;
    } catch (error) {
      console.error("Gemini Error:", error);
      throw error;
    }
  }
}
