import { GoogleGenAI, Type } from "@google/genai";
import { Product, MandiRate } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const AIService = {
  /**
   * AI Smart Basket: Analyzes user buying habits and items to suggest optimal vegetable combinations.
   */
  async getSmartBasketSuggestions(cartItems: any[], availableProducts: Product[]): Promise<{ productId: string; reason: string }[]> {
    try {
      const prompt = `
        As a culinary AI for VegieRoute, analyze the current cart items and suggest exactly 2 complementary vegetables from the available harvest that would complete a meal.
        Current Cart: ${JSON.stringify(cartItems.map(i => ({ name: i.name, category: i.category })))}
        Available Fresh Stock: ${JSON.stringify(availableProducts.map(p => ({ id: p.id, name: p.name, category: p.category, score: p.freshnessScore })))}
        
        Provide the response in JSON format.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          systemInstruction: "You are a smart vegetable shopping assistant. Return ONLY a JSON array of suggestions.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                productId: { type: Type.STRING },
                reason: { type: Type.STRING }
              },
              required: ["productId", "reason"]
            }
          }
        }
      });

      return JSON.parse(response.text || "[]");
    } catch (error) {
      console.error("AI Smart Basket Error:", error);
      return [];
    }
  },

  /**
   * Live Mandi Rates Insights: Generates AI-powered market trends.
   */
  async getMandiInsights(mandiRates: MandiRate[]): Promise<string> {
    try {
      const prompt = `
        Analyze these live Mandi prices and trends:
        ${JSON.stringify(mandiRates)}
        
        Provide a one-line startup-style insight like:
        "Today onion prices are rising - stock up now at local vendor rates!"
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      return response.text || "Market rates are stable today. Best time for leafy greens!";
    } catch (error) {
      return "Mandi rates are being updated. Check local vendor nodes for best prices.";
    }
  },

  /**
   * Voice Ordering Parser: Converts natural language to structured order intent.
   */
  async parseVoiceOrder(command: string, availableProducts: Product[]): Promise<{ items: { productId: string; quantity: number }[], timePreference?: string }> {
    try {
      const prompt = `
        Parse this vegetable order command: "${command}"
        Match items against this available harvest: ${JSON.stringify(availableProducts.map(p => ({ id: p.id, name: p.name, unit: p.unit })))}
        
        Also look for delivery time instructions like "Free at 4PM" or "Delivery tomorrow morning".
        
        Return a JSON object with:
        - items: an array of { productId, quantity }
        - timePreference: (Optional) string describing the user's availability/delivery preference detected in the command.

        For "quantity": a numeric value (e.g., for "2kg" return 2, for "500g" return 0.5)
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          systemInstruction: "You are a voice order parser. Return ONLY JSON.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    productId: { type: Type.STRING },
                    quantity: { type: Type.NUMBER }
                  },
                  required: ["productId", "quantity"]
                }
              },
              timePreference: { type: Type.STRING }
            },
            required: ["items"]
          }
        }
      });

      return JSON.parse(response.text || '{"items":[]}');
    } catch (error) {
      console.error("Voice Parser Error:", error);
      return { items: [] };
    }
  }
};
