import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Order, UserProfile, VegetableItem } from '../types';
import { Sparkles, Send, Bot, User, Loader2, BarChart2, TrendingUp, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface GeminiMarketInsightsProps {
  orders: Order[];
  users: UserProfile[];
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const GeminiMarketInsights: React.FC<GeminiMarketInsightsProps> = ({ orders, users }) => {
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const generateReportData = () => {
    const totalOrders = orders.length;
    const deliveredOrders = orders.filter(o => o.status === 'delivered').length;
    const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
    const sellersCount = users.filter(u => u.role === 'seller').length;
    const customersCount = users.filter(u => u.role === 'customer').length;

    // Item popularity
    const itemStats: Record<string, number> = {};
    orders.forEach(o => {
      o.items.forEach(item => {
        itemStats[item.name] = (itemStats[item.name] || 0) + (item.quantity || 1);
      });
    });

    const topSelling = Object.entries(itemStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => `${name}: ${count} units`)
      .join(', ');

    return {
      totalOrders,
      deliveredOrders,
      totalRevenue,
      sellersCount,
      customersCount,
      topSelling,
      recentOrders: orders.slice(-5).map(o => ({
        id: o.id,
        status: o.status,
        amount: o.totalAmount,
        date: o.createdAt
      }))
    };
  };

  const handleAsk = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsTyping(true);

    try {
      const dataSummary = generateReportData();
      const systemPrompt = `
        You are VegieRoute AI, a specialized market analyst for the VegieRoute platform.
        VegieRoute is a premium vegetable delivery service connecting sellers to customers.
        
        Current Database Statistics:
        - Total Orders: ${dataSummary.totalOrders}
        - Delivered Orders: ${dataSummary.deliveredOrders}
        - Total platform Revenue: ₹${dataSummary.totalRevenue}
        - Active Sellers: ${dataSummary.sellersCount}
        - Total Registered Customers: ${dataSummary.customersCount}
        - Top Selling Vegetables: ${dataSummary.topSelling}
        
        Detailed Recent Orders for Context:
        ${JSON.stringify(dataSummary.recentOrders)}

        Respond only with professional, data-driven insights. Be concise but insightful.
        If asked about specific vegetables, use the popularity data provided.
        If asked about "Sector A-12" or specific areas, mention that data is currently being synthesized for specific geolocation boundaries if not present in the stats.
        Answer strictly based on the statistics provided or general market logic for a vegetable delivery business.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: userMessage,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.7,
        },
      });

      const aiResponse = response.text || "I'm sorry, I couldn't process that insight right now.";
      setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
    } catch (error) {
      console.error("Gemini Error:", error);
      setMessages(prev => [...prev, { role: 'assistant', content: "Calibration error in the neural network. Please try again." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-[500px] md:h-[600px] bg-white border border-slate-100 rounded-[32px] md:rounded-[40px] shadow-premium overflow-hidden border-t-8 border-t-brand">
      {/* Header */}
      <div className="p-5 md:p-8 border-b border-slate-50 bg-slate-50/30 flex justify-between items-center">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-brand/10 rounded-xl md:rounded-2xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-brand" />
          </div>
          <div>
            <h4 className="text-sm md:text-base font-display font-black uppercase tracking-tighter text-slate-900 italic">Market Engine</h4>
            <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-[0.4em]">Real-time Logic Synthesis</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2.5 bg-white px-3 py-1.5 rounded-full border border-slate-100">
          <div className="w-2 h-2 bg-brand rounded-full animate-pulse shadow-brand-glow" />
          <span className="text-[9px] font-black text-brand uppercase tracking-widest italic">Core Active</span>
        </div>
      </div>

      {/* Chat Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 scrollbar-hide"
      >
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-30">
            <Bot className="w-12 h-12 md:w-16 md:h-16 text-brand" />
            <div className="space-y-2">
              <p className="font-black uppercase tracking-[0.2em] text-[10px] md:text-xs">Awaiting Query</p>
              <p className="text-[9px] md:text-[10px] max-w-xs font-bold leading-relaxed px-4 md:px-8">
                Ask about volume, top sellers, delivery efficiency, or market trends.
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "flex gap-3 md:gap-4 max-w-[90%] md:max-w-[85%]",
              msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
            )}
          >
            <div className={cn(
              "p-2 rounded-xl border h-fit shrink-0",
              msg.role === 'assistant' ? "bg-brand/5 border-brand/10 text-brand" : "bg-gray-50 border-gray-100 text-gray-400"
            )}>
              {msg.role === 'assistant' ? <Bot className="w-3.5 h-3.5 md:w-4 md:h-4" /> : <User className="w-3.5 h-3.5 md:w-4 md:h-4" />}
            </div>
            <div className={cn(
              "p-4 md:p-5 rounded-2xl md:rounded-3xl text-xs md:text-sm leading-relaxed",
              msg.role === 'assistant' ? "bg-white border border-gray-100 text-gray-800 shadow-sm" : "bg-brand text-white font-medium shadow-md shadow-brand/10"
            )}>
              {msg.content}
            </div>
          </motion.div>
        ))}

        {isTyping && (
          <div className="flex gap-3 md:gap-4">
            <div className="p-2 rounded-xl bg-brand/5 border border-brand/10 h-fit">
              <Bot className="w-3.5 h-3.5 md:w-4 md:h-4 text-brand" />
            </div>
            <div className="bg-white border border-gray-100 px-4 md:px-6 py-3 md:py-4 rounded-2xl md:rounded-3xl flex items-center gap-2 shadow-sm">
              <Loader2 className="w-3.5 h-3.5 md:w-4 md:h-4 text-brand animate-spin" />
              <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-brand">Synthesizing...</span>
            </div>
          </div>
        )}
      </div>

      {/* Suggested Queries */}
      {messages.length === 0 && (
        <div className="px-4 md:px-6 pb-2 flex gap-2 flex-wrap max-h-32 overflow-y-auto scrollbar-hide">
          {[
            "Top-selling vegetables?",
            "Revenue pool?",
            "Node efficiency",
            "User growth"
          ].map((q, i) => (
            <button 
              key={i}
              onClick={() => { setInput(q); }}
              className="text-[8px] md:text-[9px] font-black uppercase tracking-widest px-2.5 md:px-3 py-1.5 md:py-2 bg-gray-50 border border-gray-100 rounded-lg text-gray-400 hover:bg-brand/5 hover:text-brand hover:border-brand/20 transition-all"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input Area */}
      <form onSubmit={handleAsk} className="p-4 md:p-6 pt-2 border-t border-gray-50 bg-white">
        <div className="relative group">
          <input 
            type="text" 
            placeholder="Ask AI Engine..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-[24px] pl-5 md:pl-6 pr-14 md:pr-16 py-3 md:py-4 text-xs md:text-sm font-medium focus:bg-white focus:border-brand focus:ring-4 focus:ring-brand/5 outline-none transition-all"
          />
          <button 
            type="submit"
            disabled={!input.trim() || isTyping}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 md:w-10 md:h-10 bg-brand text-white rounded-full flex items-center justify-center hover:shadow-lg hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all shadow-md shadow-brand/20"
          >
            <Send className="w-3.5 h-3.5 md:w-4 md:h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default GeminiMarketInsights;
