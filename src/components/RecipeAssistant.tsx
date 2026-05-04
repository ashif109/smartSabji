import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Sparkles, Send, Bot, User, Loader2, X, ChefHat, ShoppingCart, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Product } from '../types';

interface RecipeAssistantProps {
  products: Product[];
  onAddToCart: (product: Product) => void;
  onClose: () => void;
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const RecipeAssistant: React.FC<RecipeAssistantProps> = ({ products, onAddToCart, onClose }) => {
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string, suggestedProducts?: string[] }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleAsk = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsTyping(true);

    try {
      const productList = products.map(p => `${p.name} (₹${p.price}/${p.unit})`).join(', ');
      const systemPrompt = `
        You are VegieRoute Chef, an AI culinary assistant for a hyperlocal vegetable delivery app.
        
        Available Fresh Produce:
        ${productList}

        Instructions:
        1. Suggest healthy, delicious recipes based on the user's mood or available vegetables.
        2. Format your response with a "Recipe Name", "Brief Intro", and "Steps".
        3. IMPORTANT: At the end of your response, list the available products required for this recipe in a specific format: "PRODUCTS_NEEDED: [Product Name 1, Product Name 2]".
        4. Match product names exactly as provided in the list above.
        5. Be encouraging and chef-like!
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: userMessage,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.8,
        },
      });

      const aiResponse = response.text || "I'm having trouble thinking of a recipe right now. How about a fresh salad?";
      
      // Parse suggested products
      let cleanedContent = aiResponse;
      let suggestedNames: string[] = [];
      const match = aiResponse.match(/PRODUCTS_NEEDED: \[(.*?)\]/);
      if (match) {
        suggestedNames = match[1].split(',').map(s => s.trim());
        cleanedContent = aiResponse.replace(/PRODUCTS_NEEDED: \[(.*?)\]/, '').trim();
      }

      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: cleanedContent,
        suggestedProducts: suggestedNames 
      }]);
    } catch (error) {
      console.error("Gemini Assistant Error:", error);
      setMessages(prev => [...prev, { role: 'assistant', content: "My kitchen is currently closed for maintenance. Please try again in a moment!" }]);
    } finally {
      setIsTyping(false);
    }
  };

  const getSuggestedProducts = (names: string[]) => {
    return products.filter(p => names.some(n => p.name.toLowerCase().includes(n.toLowerCase()) || n.toLowerCase().includes(p.name.toLowerCase())));
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="flex flex-col h-full bg-white relative"
    >
      {/* Header */}
      <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-brand/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center shadow-lg shadow-brand/20">
            <ChefHat className="text-white w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-black uppercase tracking-tighter text-dark">AI Recipe Coach</h4>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-bold text-gray-400">READY TO COOK</span>
            </div>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <X className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Chat Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6"
      >
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-30">
            <Bot className="w-16 h-16 text-brand" />
            <div className="space-y-2">
              <p className="font-black uppercase tracking-[0.2em] text-xs">Chef's Brain Active</p>
              <p className="text-[10px] max-w-xs font-bold leading-relaxed px-8">
                Tell me what you have in the fridge or what you're craving!
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={cn(
            "flex flex-col gap-3",
            msg.role === 'user' ? "items-end" : "items-start"
          )}>
            <div className={cn(
              "p-4 rounded-3xl text-sm leading-relaxed max-w-[85%]",
              msg.role === 'assistant' ? "bg-gray-50 border border-gray-100 text-dark" : "bg-brand text-white font-medium"
            )}>
              {msg.content}
            </div>
            
            {msg.suggestedProducts && msg.suggestedProducts.length > 0 && (
              <div className="w-full space-y-3 mt-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-brand">Add ingredients from VegieRoute:</p>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {getSuggestedProducts(msg.suggestedProducts).map(product => (
                    <div key={product.id} className="min-w-[140px] bg-white border border-gray-100 rounded-2xl p-3 shadow-sm flex flex-col items-center text-center space-y-2 border-b-4 border-b-brand/20">
                      <img src={product.imageUrl} alt={product.name} className="w-12 h-12 rounded-full object-cover border border-gray-100" />
                      <p className="text-[10px] font-black uppercase tracking-tight line-clamp-1">{product.name}</p>
                      <button 
                        onClick={() => onAddToCart(product)}
                        className="w-full py-1.5 bg-brand text-white rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1 hover:bg-brand/90 transition-all"
                      >
                        <ShoppingCart className="w-3 h-3" />
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {isTyping && (
          <div className="flex gap-4">
            <div className="bg-gray-50 border border-gray-100 px-6 py-4 rounded-3xl flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-brand animate-spin" />
              <span className="text-[10px] font-black uppercase tracking-widest text-brand">Thinking...</span>
            </div>
          </div>
        )}
      </div>

      {/* Suggested Queries */}
      {messages.length === 0 && (
        <div className="px-6 pb-2 flex gap-2 flex-wrap">
          {[
            "Something spicy with potatoes",
            "Weight loss dinner ideas",
            "Recipe for Spinach Paneer",
            "Quick 10-min salad"
          ].map((q, i) => (
            <button 
              key={i}
              onClick={() => { setInput(q); }}
              className="text-[9px] font-black uppercase tracking-widest px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-gray-400 hover:bg-brand/5 hover:text-brand hover:border-brand/20 transition-all"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input Area */}
      <form onSubmit={handleAsk} className="p-6 pt-2 border-t border-gray-50 bg-white">
        <div className="relative group">
          <input 
            type="text" 
            placeholder="Ask AI what to cook today..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-[24px] pl-6 pr-16 py-4 text-sm font-medium focus:bg-white focus:border-brand focus:ring-4 focus:ring-brand/5 outline-none transition-all"
          />
          <button 
            type="submit"
            disabled={!input.trim() || isTyping}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-brand text-white rounded-full flex items-center justify-center hover:shadow-lg hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </motion.div>
  );
};

export default RecipeAssistant;
