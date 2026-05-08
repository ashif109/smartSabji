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
    <div className="flex flex-col h-[600px] bg-white border border-slate-100 rounded-[40px] shadow-premium overflow-hidden border-t-8 border-t-brand">
      {/* Header */}
      <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-brand/10 rounded-2xl flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-brand" />
          </div>
          <div>
            <h4 className="text-base font-display font-black uppercase tracking-tighter text-slate-900 italic">Market Engine</h4>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em]">Real-time Logic Synthesis</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 bg-white px-3 py-1.5 rounded-full border border-slate-100">
          <div className="w-2 h-2 bg-brand rounded-full animate-pulse shadow-brand-glow" />
          <span className="text-[9px] font-black text-brand uppercase tracking-widest italic">Core Active</span>
        </div>
      </div>

      {/* Chat Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide"
      >
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-30">
            <Bot className="w-16 h-16 text-brand" />
            <div className="space-y-2">
              <p className="font-black uppercase tracking-[0.2em] text-xs">Awaiting Query</p>
              <p className="text-[10px] max-w-xs font-bold leading-relaxed px-8">
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
              "flex gap-4 max-w-[85%]",
              msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
            )}
          >
            <div className={cn(
              "p-2 rounded-xl border h-fit",
              msg.role === 'assistant' ? "bg-brand/5 border-brand/10 text-brand" : "bg-gray-50 border-gray-100 text-gray-400"
            )}>
              {msg.role === 'assistant' ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
            </div>
            <div className={cn(
              "p-5 rounded-3xl text-sm leading-relaxed",
              msg.role === 'assistant' ? "bg-white border border-gray-100 text-gray-800 shadow-sm" : "bg-brand text-white font-medium"
            )}>
              {msg.content}
            </div>
          </motion.div>
        ))}

        {isTyping && (
          <div className="flex gap-4">
            <div className="p-2 rounded-xl bg-brand/5 border border-brand/10 h-fit">
              <Bot className="w-4 h-4 text-brand" />
            </div>
            <div className="bg-white border border-gray-100 px-6 py-4 rounded-3xl flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-brand animate-spin" />
              <span className="text-[10px] font-black uppercase tracking-widest text-brand">Synthesizing...</span>
            </div>
          </div>
        )}
      </div>

      {/* Suggested Queries */}
      {messages.length === 0 && (
        <div className="px-6 pb-2 flex gap-2 flex-wrap">
          {[
            "Top-selling vegetables this week?",
            "Total platform revenue?",
            "Market efficiency overview",
            "Seller vs Customer ratio"
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
            placeholder="Ask AI for market insights..."
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
    </div>
  );
};

export default GeminiMarketInsights;
