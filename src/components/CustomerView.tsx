import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, query, where, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingBag, MapPin, Search, Sprout, User, ArrowRight, Clock, Signal, Plus, Minus, UserX, ShieldCheck, Loader2 } from 'lucide-react';
import { Order, UserProfile, Product, VegetableCategory } from '../types';
import { PRODUCTS } from '../constants';
import { cn, handleFirestoreError, OperationType } from '../lib/utils';
import ProductCard from './ProductCard';
import CartSidebar from './CartSidebar';
import BottomNav from './BottomNav';
import { GoogleGenAI } from "@google/genai";

interface CustomerViewProps {
  user: UserProfile;
}

const CustomerView: React.FC<CustomerViewProps> = ({ user }) => {
  const [cart, setCart] = useState<{ product: Product, quantity: number }[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{lat: number, lng: number, address: string} | null>(null);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'market' | 'orders' | 'inbox' | 'profile'>('market');
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<VegetableCategory | 'All'>('All');
  const [loading, setLoading] = useState(false);
  const [smartTranslatedQuery, setSmartTranslatedQuery] = useState<string | null>(null);
  const [searchingAI, setSearchingAI] = useState(false);

  const categories: (VegetableCategory | 'All')[] = ['All', 'Daily', 'Leafy', 'Roots', 'Fruits', 'Exotic', 'Herbs'];

  // AI-powered smart search for ANY language
  useEffect(() => {
    const searchTimer = setTimeout(async () => {
      const queryText = searchQuery.toLowerCase().trim();
      if (queryText.length > 2) {
        // 1. First, check if we have a direct word-by-word match (Fast)
        const queryWords = queryText.split(/\s+/);
        const hasDirectMatch = PRODUCTS.some(p => {
          const productWords = [
            ...p.name.toLowerCase().split(/\s+/),
            ...(p.localNames?.flatMap(ln => ln.toLowerCase().split(/\s+/)) || [])
          ];
          return queryWords.every(qw => productWords.some(pw => pw.includes(qw) || qw.includes(pw)));
        });

        if (!hasDirectMatch) {
          setSearchingAI(true);
          try {
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
            
            const prompt = `You are a high-accuracy multilingual botanical and grocery search engine. 
            USER QUERY: "${searchQuery}"
            The user is searching for a vegetable, fruit, or herb in a local language (Hindi, Punjabi, Bengali, Tamil, Telugu, Malayalam, Spanish, etc.) or a phonetic transliteration (e.g., 'aloo', 'vangi', 'tamatar', 'seb').
            
            TASK: 
            1. Determine the EXACT vegetable or herb the user is referring to.
            2. Return ONLY the standard English common names for this item that match our potential catalog (e.g., if 'baigan', return 'eggplant, brinjal').
            3. If the term is common but we might have a related category, return the keyword (e.g., if 'saag', return 'spinach, leafy').
            4. If it is definitely NOT a vegetable or edible plant, return 'none'.
            
            EXTREME ACCURACY MODE: Even if it's a minor misspelling, try to find the intended vegetable.
            OUTPUT ONLY THE WORDS, NO EXPLANATION.`;
            
            const result = await ai.models.generateContent({
              model: "gemini-3-flash-preview",
              contents: prompt
            });
            
            const text = result.text.trim().toLowerCase();
            
            if (text !== 'none' && text.length > 2) {
              setSmartTranslatedQuery(text);
            } else {
              setSmartTranslatedQuery(null);
            }
          } catch (e) {
            console.error("Smart Search Error:", e);
          } finally {
            setSearchingAI(false);
          }
        } else {
          setSmartTranslatedQuery(null);
          setSearchingAI(false);
        }
      } else {
        setSmartTranslatedQuery(null);
        setSearchingAI(false);
      }
    }, 500);

    return () => clearTimeout(searchTimer);
  }, [searchQuery]);

  useEffect(() => {
    const q = query(collection(db, 'orders'), where('customerId', '==', user.id));
    const unsubscribe = onSnapshot(q, (snap) => {
      const orders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setMyOrders(orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders', auth);
    });
    return unsubscribe;
  }, [user.id]);

  useEffect(() => {
    // Basic location simulation if not set
    if (!selectedLocation && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setSelectedLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          address: "Sector A-12, Green Hub"
        });
      });
    }
  }, []);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) {
        return prev.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(i => 
      i.product.id === id ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i
    ).filter(i => i.quantity > 0));
  };

  const placeOrder = async () => {
    if (!selectedLocation) {
      alert("Please set a delivery location first.");
      return;
    }
    
    setLoading(true);
    try {
      await addDoc(collection(db, 'orders'), {
        customerId: user.id,
        items: cart.map(c => ({ 
          id: c.product.id,
          name: c.product.name,
          unit: c.product.unit,
          quantity: c.quantity 
        })),
        status: 'pending',
        location: selectedLocation,
        timeSlot: '30 MIN EXPRESS',
        createdAt: new Date().toISOString()
      });

      setCart([]);
      setShowCart(false);
      setActiveTab('orders');
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'orders', auth);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = PRODUCTS.filter(p => {
    const rawQuery = searchQuery.toLowerCase().trim();
    if (!rawQuery) {
      return selectedCategory === 'All' || p.category === selectedCategory;
    }

    const queryWords = rawQuery.split(/\s+/);
    
    // Check local names and product name for all query words
    const matchesLocal = queryWords.every(qw => 
      p.name.toLowerCase().includes(qw) || 
      p.localNames?.some(ln => ln.toLowerCase().includes(qw) || qw.includes(ln.toLowerCase()))
    );

    // AI Translation matching
    let matchesAI = false;
    if (smartTranslatedQuery) {
      const aiWords = smartTranslatedQuery.split(/,\s*/);
      matchesAI = aiWords.some(aw => 
        p.name.toLowerCase().includes(aw) || 
        aw.includes(p.name.toLowerCase()) ||
        p.localNames?.some(ln => ln.toLowerCase().includes(aw) || aw.includes(ln.toLowerCase()))
      );
    }

    return matchesLocal || matchesAI;
  });

  return (
    <div className="min-h-screen bg-white text-dark pb-32 overflow-x-hidden relative font-sans">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md px-6 py-6 border-b border-gray-100 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center text-white shadow-lg shadow-brand/20">
            <Sprout className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-dark tracking-tighter uppercase leading-none italic">Smart <span className="text-brand">Sabji</span></h1>
            <div className="flex items-center gap-1 mt-1">
               <MapPin className="w-3 h-3 text-brand" />
               <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest line-clamp-1 max-w-[120px]">
                  {selectedLocation?.address || "Detecting Node..."}
               </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
           <button 
             onClick={() => setShowCart(true)} 
             className="w-12 h-12 bg-dark rounded-2xl flex items-center justify-center relative shadow-lg active:scale-95 transition-transform"
           >
              <ShoppingBag className="text-white w-6 h-6" />
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-brand text-white text-[8px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-dark">
                   {cart.reduce((a, b) => a + b.quantity, 0)}
                </span>
              )}
           </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 mt-8">
        {activeTab === 'market' && (
          <div className="space-y-12">
            {/* Search & Categories */}
            <div className="space-y-6">
              <div className="relative group">
                <div className="absolute left-6 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  {searchingAI ? (
                    <Loader2 className="animate-spin text-brand w-5 h-5" />
                  ) : (
                    <Search className="text-gray-400 w-5 h-5 group-focus-within:text-brand transition-colors" />
                  )}
                </div>
                <input 
                  type="text" 
                  placeholder="Search Subzi in any language (Aloo, Kanda, Mirch...)" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-100 rounded-[28px] px-16 py-5 text-sm font-medium focus:bg-white focus:border-brand focus:ring-4 focus:ring-brand/5 outline-none transition-all shadow-sm"
                />
                {searchingAI && (
                  <div className="absolute right-6 top-1/2 -translate-y-1/2">
                    <span className="text-[10px] font-black text-brand animate-pulse uppercase tracking-widest">Smart Identifying...</span>
                  </div>
                )}
              </div>
              
              {!searchQuery && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide"
                >
                  {categories.map(cat => (
                    <button 
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={cn(
                        "px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border cursor-pointer",
                        selectedCategory === cat 
                          ? "bg-dark text-white border-dark" 
                          : "bg-white text-gray-400 border-gray-100 hover:border-brand/40 hover:text-brand"
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </motion.div>
              )}
            </div>

            {/* Grid */}
            <div className="space-y-6">
              <div className="flex justify-between items-end">
                <div>
                   <h3 className="text-2xl font-black italic tracking-tighter uppercase text-dark">
                     {searchQuery ? `Search Results for "${searchQuery}"` : "Fresh Arrivals"}
                   </h3>
                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                     {searchQuery ? (smartTranslatedQuery ? `AI Identified: ${smartTranslatedQuery}` : "Matching traditional & English names") : "From local micro-farms to your door"}
                   </p>
                </div>
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery("")}
                    className="text-brand text-[10px] font-black uppercase tracking-widest"
                  >
                    Clear Search
                  </button>
                )}
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {filteredProducts.map(product => (
                  <ProductCard 
                    key={product.id} 
                    product={product} 
                    onAddToCart={addToCart} 
                    quantity={cart.find(i => i.product.id === product.id)?.quantity}
                    onUpdateQuantity={updateQuantity}
                  />
                ))}
              </div>

              {filteredProducts.length === 0 && (
                <div className="py-20 text-center space-y-4 opacity-50">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto">
                    <Search className="w-8 h-8 text-gray-300" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-black uppercase tracking-widest">No Sabji found</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Try searching for Aloo, Mirch, or Tamatar</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
           <div className="space-y-8 py-4">
              <h2 className="text-4xl font-black italic tracking-tighter uppercase text-dark">Your Orders</h2>
              <div className="space-y-6">
                 {myOrders.length === 0 ? (
                    <div className="bg-gray-50 rounded-[40px] p-20 text-center space-y-4 opacity-50">
                       <Clock className="w-16 h-16 mx-auto text-gray-300" />
                       <p className="text-xs font-black uppercase tracking-widest">No orders yet</p>
                    </div>
                 ) : (
                    myOrders.map(order => (
                      <div key={order.id} className="bg-white border border-gray-100 rounded-[32px] p-8 space-y-6 shadow-sm">
                         <div className="flex justify-between items-start">
                            <div className="space-y-1">
                               <div className="px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border bg-brand/10 text-brand border-brand/20 w-fit">
                                 {order.status}
                               </div>
                               <h4 className="text-sm font-black text-dark uppercase tracking-tight line-clamp-1 mt-2">
                                  {order.items.map(i => i.name).join(', ')}
                               </h4>
                               <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest italic">#{order.id.slice(-6).toUpperCase()}</p>
                            </div>
                            <div className="text-right">
                               
                               <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{new Date(order.createdAt).toLocaleDateString()}</p>
                            </div>
                         </div>
                         <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                            <div className="flex items-center gap-2 text-gray-400">
                               <MapPin className="w-4 h-4" />
                               <span className="text-[10px] font-bold uppercase truncate max-w-[200px]">{order.location.address}</span>
                            </div>
                            <span className="text-[10px] font-black uppercase text-brand flex items-center gap-1">
                               <Signal className="w-3 h-3" /> Live Tracking
                            </span>
                         </div>
                      </div>
                    ))
                 )}
              </div>
           </div>
        )}

        {activeTab === 'profile' && (
           <div className="space-y-12 py-4 pb-20">
              <div className="flex flex-col items-center gap-6 text-center">
                 <div className="w-24 h-24 bg-gray-50 rounded-[32px] flex items-center justify-center relative border border-gray-100 shadow-xl">
                    <User className="w-12 h-12 text-gray-300" />
                    <div className="absolute -bottom-1 -right-1 bg-brand text-white p-1.5 rounded-xl shadow-lg ring-2 ring-white">
                       <ShieldCheck className="w-4 h-4" />
                    </div>
                 </div>
                 <div className="space-y-1">
                    <h2 className="text-3xl font-black italic tracking-tighter uppercase text-dark">{user.fullName}</h2>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{user.email}</p>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="bg-brand border border-brand/20 rounded-[40px] p-10 text-white space-y-6 shadow-xl shadow-brand/10">
                    <h4 className="text-sm font-black uppercase tracking-[0.3em]">Super Coins</h4>
                    <p className="text-6xl font-black italic tracking-tighter tabular-nums">{user.superCoins || 0}</p>
                    <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest leading-relaxed">Shop fresh, earn coins, get rewards. Every harvest counts.</p>
                 </div>
                 <div className="flex flex-col gap-6">
                    <button className="bg-white border border-gray-100 rounded-[32px] p-6 text-left hover:border-brand/40 transition-all shadow-sm">
                       <p className="text-[9px] font-black text-brand uppercase tracking-widest mb-1">Active Wallet</p>
                       <p className="text-sm font-black uppercase tracking-tight">Manage Payments</p>
                    </button>
                    <button 
                       onClick={() => auth.signOut()}
                       className="w-full py-6 bg-red-50 text-red-500 rounded-[32px] text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-red-100 transition-all border border-red-100"
                    >
                       <UserX className="w-5 h-5" />
                       Terminate Session
                    </button>
                 </div>
              </div>
           </div>
        )}
      </main>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} cartCount={cart.length} />
      
      <CartSidebar 
        isOpen={showCart} 
        onClose={() => setShowCart(false)} 
        cart={cart}
        onUpdateQuantity={updateQuantity}
        onPlaceOrder={placeOrder}
        loading={loading}
      />
    </div>
  );
};

export default CustomerView;
