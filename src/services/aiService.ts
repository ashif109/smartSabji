import { GoogleGenAI, Type } from "@google/genai";
import { Product, MandiRate } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const AIService = {
  /**
   * AI Smart Basket: Analyzes user buying habits and items to suggest optimal vegetable combinations.
   */
  async getSmartBasketSuggestions(cartItems: any[], availableProducts: Product[]): Promise<string> {
    try {
      const prompt = `
        As a culinary AI for VegieRoute, analyze the current cart items and suggest:
        1. A complementary vegetable that would complete a meal (e.g., if they have potatoes and onions, suggest tomatoes).
        2. A healthy "fresh arrival" tip.
        3. A brief reason for the suggestion based on common Indian culinary patterns.
        
        Current Cart: ${JSON.stringify(cartItems)}
        Available Fresh Stock: ${JSON.stringify(availableProducts.map(p => ({ name: p.name, category: p.category, score: p.freshnessScore })))}
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          systemInstruction: "You are a smart vegetable shopping assistant. Keep suggestions brief, helpful, and focused on freshness.",
        }
      });

      return response.text || "Fresh tomatoes would pair well with your current selection!";
    } catch (error) {
      console.error("AI Smart Basket Error:", error);
      return "Consider adding seasonal greens for a balanced meal.";
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
   * Voice Ordering Parser (Basic Simulation): Converts natural language to structured order intent.
   */
  async parseVoiceOrder(command: string): Promise<{ item: string; quantity: string }[]> {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Parse this vegetable order command: "${command}". Return a JSON array of items and quantities.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                item: { type: Type.STRING },
                quantity: { type: Type.STRING }
              },
              required: ["item", "quantity"]
            }
          }
        }
      });

      return JSON.parse(response.text || "[]");
    } catch (error) {
      return [];
    }
  }
};
