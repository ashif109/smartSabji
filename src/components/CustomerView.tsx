import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, query, where, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingBag, MapPin, Search, Sprout, User, ArrowRight, Clock, Signal, Plus, Minus, UserX, ShieldCheck, Loader2, ChefHat, Sparkles } from 'lucide-react';
import { Order, UserProfile, Product, VegetableCategory } from '../types';
import { PRODUCTS } from '../constants';
import { cn, handleFirestoreError, OperationType } from '../lib/utils';
import ProductCard from './ProductCard';
import CartSidebar from './CartSidebar';
import BottomNav from './BottomNav';
import RecipeAssistant from './RecipeAssistant';
import { GoogleGenAI } from "@google/genai";

interface CustomerViewProps {
  user: UserProfile;
}

const CustomerView: React.FC<CustomerViewProps> = ({ user }) => {
  const [products, setProducts] = useState<Product[]>(PRODUCTS);
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

  // Sync Products from Firestore
  useEffect(() => {
    let isSeeding = false;
    const unsub = onSnapshot(collection(db, 'products'), async (snap) => {
      const pData = snap.docs.map(d => ({ ...d.data(), id: d.id } as Product));
      
      // Auto-seed if empty (Initial setup for user)
      if (pData.length === 0 && !isSeeding) {
        isSeeding = true;
        console.log("Seeding initial product inventory from catalog...");
        for (const p of PRODUCTS) {
          try {
            await addDoc(collection(db, 'products'), p);
          } catch (e) {
            console.error("Seeding failed for product:", p.name, e);
          }
        }
        isSeeding = false;
      } else if (pData.length > 0) {
        setProducts(pData);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products', auth);
    });
    return unsub;
  }, []);

  const categories: (VegetableCategory | 'All')[] = ['All', 'Daily', 'Leafy', 'Roots', 'Fruits', 'Exotic', 'Herbs'];

  // AI-powered smart search
  useEffect(() => {
    const searchTimer = setTimeout(async () => {
      const queryText = searchQuery.toLowerCase().trim();
      if (queryText.length > 2) {
        const queryWords = queryText.split(/\s+/);
        const hasDirectMatch = products.some(p => {
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

  const filteredProducts = products.filter(p => {
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
    <div className="min-h-screen bg-slate-50 text-dark pb-32 overflow-x-hidden relative font-sans">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md px-6 py-6 border-b border-slate-100 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center text-white shadow-lg shadow-brand/20">
            <Sprout className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-display font-bold text-dark tracking-tight uppercase leading-none italic">Vegie<span className="text-brand">Route</span></h1>
            <button 
              onClick={() => {/* Open location picker */}}
              className="flex items-center gap-1 mt-1 group"
            >
               <MapPin className="w-3 h-3 text-brand" />
               <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest line-clamp-1 max-w-[120px] group-hover:text-brand transition-colors">
                  {selectedLocation?.address || "Detecting Node..."}
               </span>
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
           <button 
             onClick={() => setShowCart(true)} 
             className="w-12 h-12 bg-dark rounded-2xl flex items-center justify-center relative shadow-lg active:scale-95 transition-transform"
           >
              <ShoppingBag className="text-white w-6 h-6" />
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-brand text-white text-[8px] font-black w-6 h-6 flex items-center justify-center rounded-full border-2 border-dark shadow-lg">
                   {cart.reduce((a, b) => a + b.quantity, 0)}
                </span>
              )}
           </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 mt-8">
        {activeTab === 'market' && (
          <div className="space-y-12">
            {/* AI Kitchen Banner */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setActiveTab('inbox')}
              className="bg-brand border border-brand/20 rounded-[32px] md:rounded-[40px] p-6 md:p-8 text-white flex flex-col md:flex-row items-center justify-between gap-6 md:gap-8 relative overflow-hidden cursor-pointer group hover:shadow-2xl hover:shadow-brand/20 transition-all duration-500"
            >
              <div className="absolute top-0 right-0 p-8 md:p-12 opacity-10 group-hover:scale-125 transition-transform duration-1000">
                <ChefHat className="w-32 md:w-48 h-32 md:h-48 fill-white" />
              </div>
              <div className="space-y-3 md:space-y-4 relative z-10 text-center md:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest">
                  <Sparkles className="w-3 h-3" />
                  <span>Chef Gemini Powered</span>
                </div>
                <h2 className="text-3xl md:text-5xl font-display font-bold italic tracking-tight leading-none uppercase">What should I <br /> cook today?</h2>
                <p className="text-white/80 text-[10px] md:text-xs font-medium max-w-sm tracking-wide">
                  Ask our AI to curate a recipe based on your mood. Add ingredients to cart in one click.
                </p>
                <div className="flex items-center justify-center md:justify-start gap-2 text-white font-bold uppercase tracking-widest text-[9px] md:text-[10px] group-hover:gap-4 transition-all">
                  <span>Start culinary session</span>
                  <ArrowRight className="w-3 md:w-4 h-3 md:h-4" />
                </div>
              </div>
              <div className="aspect-square w-24 md:w-48 bg-white/10 rounded-[24px] md:rounded-[32px] backdrop-blur-md flex items-center justify-center border border-white/20 shadow-xl group-hover:rotate-6 transition-transform">
                 <ChefHat className="w-12 md:w-24 h-12 md:h-24 text-white" />
              </div>
            </motion.div>

            {/* Search */}
            <div className="space-y-4 md:space-y-6">
              <div className="relative group">
                <div className="absolute left-6 md:left-8 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  {searchingAI ? (
                    <Loader2 className="animate-spin text-brand w-5 h-5 md:w-6 md:h-6" />
                  ) : (
                    <Search className="text-slate-300 w-5 h-5 md:w-6 md:h-6 group-focus-within:text-brand transition-colors" />
                  )}
                </div>
                <input 
                  type="text" 
                  placeholder="Search Subzi (Aloo, Kanda...)" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-100 rounded-[28px] md:rounded-[32px] pl-14 md:pl-20 pr-6 md:pr-20 py-4 md:py-7 text-sm md:text-base font-medium focus:ring-8 focus:ring-brand/5 focus:border-brand outline-none transition-all shadow-sm"
                />
                {searchingAI && (
                  <div className="absolute right-6 md:right-8 top-1/2 -translate-y-1/2 hidden sm:block">
                    <span className="text-[9px] md:text-[10px] font-black text-brand animate-pulse uppercase tracking-[0.2em]">AI Syncing...</span>
                  </div>
                )}
              </div>
              
              {!searchQuery && (
                <div className="flex gap-2 md:gap-3 overflow-x-auto pb-4 scrollbar-hide px-0 md:px-2">
                  {categories.map(cat => (
                    <button 
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={cn(
                        "px-6 md:px-8 py-3 md:py-4 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border cursor-pointer",
                        selectedCategory === cat 
                          ? "bg-dark text-white border-dark shadow-xl" 
                          : "bg-white text-slate-400 border-slate-100 hover:border-brand/40 hover:text-brand shadow-sm"
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Products */}
            <div className="space-y-8">
              <div className="flex justify-between items-end">
                <div>
                   <h3 className="text-3xl font-display font-bold italic tracking-tight uppercase text-dark">
                     {searchQuery ? `Inventory Search: "${searchQuery}"` : "Daily Harvest"}
                   </h3>
                   <div className="flex items-center gap-2 mt-1">
                      <div className="w-1.5 h-1.5 bg-brand rounded-full animate-pulse" />
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {searchQuery ? (smartTranslatedQuery ? `AI Result: ${smartTranslatedQuery}` : "Real-time matching active") : "Directly from micro-farms"}
                      </p>
                   </div>
                </div>
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery("")}
                    className="text-brand text-[10px] font-bold uppercase tracking-widest border-b border-brand/20 hover:border-brand transition-all pb-1"
                  >
                    Reset Filter
                  </button>
                )}
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-8">
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
                <div className="py-32 text-center space-y-6">
                  <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto border-2 border-dashed border-slate-200">
                    <Search className="w-10 h-10 text-slate-200" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-bold uppercase tracking-widest text-slate-400">Node match not found</p>
                    <p className="text-[10px] font-medium text-slate-300 uppercase italic">Try searching for local variants (e.g. Baigan, Batata)</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'inbox' && (
           <div className="h-[calc(100vh-180px)] min-h-[600px]">
              <RecipeAssistant 
                products={products} 
                onAddToCart={addToCart} 
                onClose={() => setActiveTab('market')} 
              />
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
