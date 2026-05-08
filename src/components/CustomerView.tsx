import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingBag, MapPin, Search, Sprout, User, ArrowRight, Clock, Signal, Plus, Minus, UserX, ShieldCheck, Loader2, ChefHat, Sparkles, ChevronRight, Zap, Navigation, XCircle, CreditCard, Crown, Calendar } from 'lucide-react';
import { Order, UserProfile, Product, VegetableCategory } from '../types';
import { PRODUCTS } from '../constants';
import { cn, handleFirestoreError, OperationType } from '../lib/utils';
import ProductCard from './ProductCard';
import CartSidebar from './CartSidebar';
import BottomNav from './BottomNav';
import RecipeAssistant from './RecipeAssistant';
import MapContainer from './MapContainer';
import { CartService, CartItem } from '../services/CartService';

interface CustomerViewProps {
  user: UserProfile;
}

const CustomerView: React.FC<CustomerViewProps> = ({ user }) => {
  const [products, setProducts] = useState<Product[]>(PRODUCTS);
  const [cart, setCart] = useState<CartItem[]>(CartService.getCart());
  const [showCart, setShowCart] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{lat: number, lng: number, address: string} | null>(null);
  const [isLocationConfirmed, setIsLocationConfirmed] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'market' | 'orders' | 'inbox' | 'profile'>('market');
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<VegetableCategory | 'All'>('All');
  const [loading, setLoading] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);

  // Sync Cart to LocalStorage
  useEffect(() => {
    CartService.saveCart(cart);
  }, [cart]);

  // Sync Products from Firestore
  useEffect(() => {
    let isSeeding = false;
    const unsub = onSnapshot(collection(db, 'products'), async (snap) => {
      const pData = snap.docs.map(d => ({ ...d.data(), id: d.id } as Product));
      
      if (pData.length === 0 && !isSeeding) {
        isSeeding = true;
        for (const p of PRODUCTS) {
          try {
            await addDoc(collection(db, 'products'), p);
          } catch (e) {
            console.error(e);
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

  // Fetch Orders
  useEffect(() => {
    const q = query(collection(db, 'orders'), where('customerId', '==', user.id));
    const unsubscribe = onSnapshot(q, (snap) => {
      const ordersData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setMyOrders(ordersData.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders', auth);
    });
    return unsubscribe;
  }, [user.id]);

  // Initial Location Setup
  useEffect(() => {
    if (!selectedLocation && !isLocationConfirmed) {
      setShowLocationModal(true);
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setSelectedLocation({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              address: "Detecting address..."
            });
          },
          () => {
            setSelectedLocation({
              lat: 19.0760,
              lng: 72.8777,
              address: "Sector A-12, Green Hub Node (Default)"
            });
          }
        );
      }
    }
  }, []);

  const categories: (VegetableCategory | 'All')[] = ['All', 'Daily', 'Leafy', 'Roots', 'Fruits', 'Exotic', 'Herbs'];

  const addToCart = (product: Product) => {
    if (!isLocationConfirmed) {
      setShowLocationModal(true);
      return;
    }
    setCart(prev => CartService.addToCart(prev, product));
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => CartService.updateQuantity(prev, id, delta));
  };

  const totalInfo = CartService.getTotals(cart);

  const upgradeSubscription = async (plan: string) => {
    setLoading(true);
    try {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 30);
      
      await updateDoc(doc(db, 'users', user.id), {
        subscriptionPlan: plan,
        subscriptionExpiry: expiry.toISOString()
      });
      alert(`Upgraded to ${plan.toUpperCase()}! Your fresh route is now priority.`);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${user.id}`, auth);
    } finally {
      setLoading(false);
    }
  };

  const placeOrder = async () => {
    if (!selectedLocation || !isLocationConfirmed) {
      setShowLocationModal(true);
      return;
    }
    
    setLoading(true);
    try {
      await addDoc(collection(db, 'orders'), {
        customerId: user.id,
        items: cart.map(c => ({ 
          id: c.id,
          name: c.name,
          unit: c.unit,
          quantity: c.quantity 
        })),
        status: 'pending',
        location: selectedLocation,
        totalAmount: totalInfo.total,
        timeSlot: '30 MIN EXPRESS',
        createdAt: new Date().toISOString()
      });

      setCart([]);
      CartService.clearCart();
      setShowCart(false);
      setActiveTab('orders');
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'orders', auth);
    } finally {
      setLoading(false);
    }
  };

  const cancelOrder = async (orderId: string) => {
    if (!window.confirm("Are you sure you want to cancel this order?")) return;
    
    setLoading(true);
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: 'cancelled',
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `orders/${orderId}`, auth);
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
    const matchesLocal = queryWords.every(qw => 
      p.name.toLowerCase().includes(qw) || 
      p.localNames?.some(ln => ln.toLowerCase().includes(qw))
    );
    return matchesLocal;
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-40 overflow-x-hidden relative font-sans">
      {/* Dynamic Header */}
      <header className="glass-premium px-4 md:px-8 py-4 md:py-5 flex justify-between items-center sticky top-0 z-50 transition-all border-b border-slate-100">
        <div className="flex items-center gap-3 md:gap-4">
          <motion.div 
            whileHover={{ rotate: 15 }}
            className="w-10 h-10 md:w-12 md:h-12 bg-brand rounded-xl md:rounded-2xl flex items-center justify-center text-white shadow-brand-glow"
          >
            <Sprout className="w-5 h-5 md:w-7 md:h-7" />
          </motion.div>
          <div>
            <h1 className="text-xl md:text-2xl font-display font-black text-slate-900 tracking-tighter uppercase leading-none drop-shadow-sm">
              Vegie<span className="text-brand">Route</span>
            </h1>
            <button 
              onClick={() => setShowLocationModal(true)}
              className="flex items-center gap-1 mt-0.5 md:mt-1 transition-all hover:opacity-70"
            >
               <MapPin className="w-3 h-3 text-brand" />
               <span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] line-clamp-1 max-w-[140px] md:max-w-[180px]">
                  {isLocationConfirmed ? selectedLocation?.address : "Detecting Node..."}
               </span>
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-2 md:gap-4">
           <button 
             onClick={() => setShowSearchModal(true)}
             className="w-10 h-10 md:w-12 md:h-12 bg-slate-50 border border-slate-100 rounded-xl md:rounded-2xl flex items-center justify-center text-slate-400 hover:text-brand hover:border-brand/20 transition-all shadow-sm"
           >
              <Search className="w-4 h-4 md:w-5 md:h-5" />
           </button>
           <button 
             onClick={() => setActiveTab('profile')} 
             className="w-10 h-10 md:w-12 md:h-12 bg-slate-50 border border-slate-100 rounded-xl md:rounded-2xl flex items-center justify-center text-slate-400 hover:text-brand hover:border-brand/20 transition-all shadow-sm"
           >
              <User className="w-4 h-4 md:w-5 md:h-5" />
           </button>
        </div>
      </header>

      {/* Global Search Modal */}
      <AnimatePresence>
        {showLocationModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => isLocationConfirmed && setShowLocationModal(false)}
               className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
             />
             <motion.div 
               initial={{ opacity: 0, scale: 0.9, y: 40 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.9, y: 40 }}
               className="relative w-full max-w-xl bg-white rounded-[48px] shadow-2xl overflow-hidden flex flex-col"
             >
                <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                   <div className="space-y-1">
                      <p className="text-brand text-[10px] font-black uppercase tracking-[0.4em]">Logistics Protocol</p>
                      <h3 className="text-3xl font-display font-black tracking-tighter uppercase italic text-slate-900 leading-none">Assign Node</h3>
                   </div>
                   {isLocationConfirmed && (
                     <button onClick={() => setShowLocationModal(false)} className="w-12 h-12 bg-white rounded-2xl border border-slate-100 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors">
                        <UserX className="w-6 h-6" />
                     </button>
                   )}
                </div>

                <div className="h-[400px] relative bg-slate-100">
                   <MapContainer 
                     centerPos={selectedLocation || { lat: 19.0760, lng: 72.8777 }}
                     zoom={15}
                     onMapClick={(lat, lng) => {
                        setSelectedLocation({ lat, lng, address: `Sector Node: ${lat.toFixed(4)}, ${lng.toFixed(4)}` });
                     }}
                     markers={selectedLocation ? [{ id: 'delivery', lat: selectedLocation.lat, lng: selectedLocation.lng, label: 'TARGET NODE' }] : []}
                   />
                   <div className="absolute top-6 left-6 right-6 pointer-events-none">
                      <div className="glass-premium p-6 rounded-[32px] border border-white/40 shadow-2xl pointer-events-auto">
                         <div className="flex items-center gap-2 mb-3">
                            <div className="w-2 h-2 bg-brand rounded-full animate-ping" />
                            <span className="text-[9px] font-black uppercase text-slate-500 tracking-[0.2em]">Live Signal Tracking</span>
                         </div>
                         <p className="text-sm font-black text-slate-900 uppercase italic tracking-tighter leading-tight">
                            {selectedLocation?.address || "Calibrating GPS..."}
                         </p>
                      </div>
                   </div>
                </div>

                <div className="p-10 space-y-4">
                   <button 
                     onClick={() => {
                        if ('geolocation' in navigator) {
                           setLoading(true);
                           navigator.geolocation.getCurrentPosition((pos) => {
                              setSelectedLocation({
                                 lat: pos.coords.latitude,
                                 lng: pos.coords.longitude,
                                 address: "Localized Hyper-Node Detected"
                              });
                              setLoading(false);
                           }, () => setLoading(false));
                        }
                     }}
                     className="btn-outline-premium w-full py-6"
                   >
                      <Navigation className="w-5 h-5 text-brand" />
                      <span>Transmit Current Signal</span>
                   </button>
                   <button 
                     disabled={!selectedLocation || loading}
                     onClick={() => {
                        setIsLocationConfirmed(true);
                        setShowLocationModal(false);
                     }}
                     className="btn-premium w-full py-7 text-lg"
                   >
                      <span>Lock Node Location</span>
                      <ChevronRight className="w-6 h-6" />
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showSearchModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setShowSearchModal(false)}
               className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
             />
             <motion.div 
               initial={{ opacity: 0, y: -40, scale: 0.95 }}
               animate={{ opacity: 1, y: 0, scale: 1 }}
               exit={{ opacity: 0, y: -40, scale: 0.95 }}
               className="relative w-full max-w-2xl bg-white rounded-[40px] shadow-2xl overflow-hidden"
             >
                <div className="p-8 space-y-8">
                   <div className="relative">
                      <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 w-6 h-6" />
                      <input 
                        autoFocus
                        type="text" 
                        placeholder="Search for organic produce..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-100 rounded-[28px] pl-16 pr-8 py-6 text-lg font-bold outline-none focus:ring-8 focus:ring-brand/5 focus:border-brand transition-all"
                      />
                   </div>

                   {!searchQuery && (
                      <div className="space-y-6">
                         <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">Trending Now</p>
                         <div className="flex flex-wrap gap-3">
                            {['Tomato', 'Palak', 'Gajar', 'Shimla Mirch', 'Dhaniya'].map(tag => (
                               <button 
                                 key={tag}
                                 onClick={() => setSearchQuery(tag)}
                                 className="px-6 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-black uppercase text-slate-500 hover:text-brand hover:border-brand/40 transition-all"
                               >
                                  {tag}
                               </button>
                            ))}
                         </div>
                      </div>
                   )}

                   {searchQuery && (
                      <div className="max-h-[400px] overflow-y-auto pr-4 scrollbar-hide space-y-4">
                         {filteredProducts.map(p => (
                            <div 
                              key={p.id}
                              onClick={() => {
                                 setShowSearchModal(false);
                                 // Maybe scroll to product or just highlight
                              }}
                              className="flex items-center gap-6 p-4 hover:bg-slate-50 rounded-[24px] transition-all cursor-pointer group"
                            >
                               <div className="w-16 h-16 rounded-[20px] overflow-hidden bg-slate-100">
                                  <img src={p.imageUrl} className="w-full h-full object-cover" alt={p.name} />
                               </div>
                               <div className="flex-1">
                                  <h4 className="text-base font-black uppercase tracking-tight text-slate-900 group-hover:text-brand transition-colors">{p.name}</h4>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{p.category} Node</p>
                               </div>
                               <button 
                                 onClick={(e) => {
                                    e.stopPropagation();
                                    addToCart(p);
                                 }}
                                 className="w-10 h-10 bg-brand text-white rounded-xl flex items-center justify-center shadow-lg shadow-brand/20 hover:scale-110 active:scale-95 transition-all"
                               >
                                  <Plus className="w-5 h-5" />
                               </button>
                            </div>
                         ))}
                      </div>
                   )}
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      <main className="max-w-7xl mx-auto px-4 md:px-8 mt-8">
        {activeTab === 'market' && (
          <div className="space-y-12 md:space-y-20">
            {/* Premium Hero */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
               <motion.div 
                 initial={{ opacity: 0, x: -30 }}
                 animate={{ opacity: 1, x: 0 }}
                 className="space-y-6 md:space-y-8"
               >
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand/10 rounded-full border border-brand/20">
                     <span className="w-1.5 h-1.5 bg-brand rounded-full animate-ping" />
                     <span className="text-[9px] font-black text-brand uppercase tracking-widest">Node #04 Active</span>
                  </div>
                  <h2 className="text-5xl md:text-8xl font-display font-black tracking-tighter leading-[0.85] text-slate-900 uppercase italic">
                    The Fresh <br />
                    <span className="text-brand">Protocol.</span>
                  </h2>
                  <p className="text-slate-500 text-base md:text-xl font-medium max-w-lg leading-relaxed">
                    Direct from farmer nodes to your doorstep in 20 minutes. Zero middleman. 100% transparency.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4">
                     <button className="btn-premium px-8 md:px-12 group py-4 md:py-5">
                        <span>Harvest Map</span>
                        <ArrowRight className="w-5 h-5 md:w-6 md:h-6 group-hover:translate-x-1 transition-transform" />
                     </button>
                     <div className="flex -space-x-2 items-center px-2">
                        {[1,2,3,4].map(i => (
                          <div key={i} className="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-white bg-slate-100 overflow-hidden shadow-lg">
                            <img src={`https://i.pravatar.cc/100?img=${i+40}`} alt="user" className="w-full h-full object-cover" />
                          </div>
                        ))}
                        <div className="pl-4">
                           <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none text-center">Trust Index</p>
                           <p className="text-xs font-black text-slate-900 italic tracking-tighter">4.9/5 RATING</p>
                        </div>
                     </div>
                  </div>
               </motion.div>

               <motion.div 
                 initial={{ opacity: 0, scale: 0.9 }}
                 animate={{ opacity: 1, scale: 1 }}
                 className="relative hidden lg:block"
               >
                  <div className="absolute -inset-10 bg-brand/5 blur-[120px] rounded-full" />
                  <div className="relative premium-card p-4 aspect-[4/3] rounded-[60px] overflow-hidden group">
                     {/* Floating vegetables using Framer Motion */}
                     <motion.div 
                       animate={{ 
                         y: [0, -20, 0],
                         rotate: [0, 5, 0]
                       }}
                       transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                       className="absolute top-10 right-10 z-20 w-32 h-32"
                     >
                        <img src="https://images.unsplash.com/photo-1594411132644-8cb96a1e389e?q=80&w=200&auto=format&fit=crop" className="w-full h-full object-cover rounded-3xl shadow-2xl rotate-12" alt="chillies" />
                     </motion.div>
                     
                     <img 
                       src="https://images.unsplash.com/photo-1610348725531-843dff563e2c?q=80&w=800&auto=format&fit=crop" 
                       alt="Harvest" 
                       className="w-full h-full object-cover rounded-[48px] scale-110 group-hover:scale-100 transition-transform duration-[3s]"
                     />
                     
                     <div className="absolute bottom-8 left-8 right-8 glass-premium p-6 rounded-[32px] border border-white/40">
                        <div className="flex items-center justify-between mb-4">
                           <p className="text-[10px] font-black text-brand uppercase tracking-[0.2em]">Live Traceability</p>
                           <Zap className="text-amber-500 w-4 h-4 fill-amber-500" />
                        </div>
                        <div className="flex justify-between items-end">
                           <div className="space-y-1">
                              <h4 className="text-2xl font-display font-black tracking-tighter text-slate-900 uppercase italic leading-none">Morning <br />Harvest</h4>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Picked 4 hrs ago</p>
                           </div>
                           <div className="text-right">
                              <p className="text-3xl font-display font-black text-brand tracking-tighter italic">₹499</p>
                              <p className="text-[8px] font-bold text-slate-300 uppercase tracking-[0.4em]">Starter Node Basket</p>
                           </div>
                        </div>
                     </div>
                  </div>
               </motion.div>
            </div>

            {/* AI Assistant Hook */}
            <motion.div 
               initial={{ opacity: 0, y: 20 }}
               whileInView={{ opacity: 1, y: 0 }}
               onClick={() => setActiveTab('inbox')}
               className="bg-slate-900 rounded-[32px] md:rounded-[40px] p-6 md:p-10 text-white flex flex-col md:flex-row items-center justify-between gap-8 md:gap-10 overflow-hidden relative group cursor-pointer shadow-2xl shadow-slate-900/20"
            >
               <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,_rgba(16,185,129,0.15)_0%,_transparent_50%)]" />
               <div className="space-y-4 md:space-y-6 relative z-10 flex-1 w-full text-center md:text-left">
                  <div className="w-fit bg-brand/20 text-brand px-3 md:px-4 py-1 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] border border-brand/20 mx-auto md:mx-0">
                     Proprietary Chef-Mind v2
                  </div>
                  <h3 className="text-3xl md:text-6xl font-display font-black tracking-tighter uppercase italic leading-[0.9]">
                    Stuck with <br /> <span className="text-brand">Kitchin-Logic?</span>
                  </h3>
                  <p className="text-slate-400 text-xs md:text-sm font-medium max-w-sm tracking-wide leading-relaxed mx-auto md:mx-0">
                    Our AI Culinary Assistant analyzes your ingredients and recommends the perfect harvest to add to your basket.
                  </p>
                  <button 
                    onClick={() => setActiveTab('inbox')}
                    className="btn-premium group shadow-none border border-brand/40 px-8 py-4 mx-auto md:mx-0"
                  >
                     <span>Engage AI Assistant</span>
                     <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
               </div>
               <div className="w-32 h-32 md:w-80 md:h-80 bg-white/5 rounded-[32px] md:rounded-[48px] backdrop-blur-xl border border-white/10 flex items-center justify-center transform rotate-6 hover:rotate-0 transition-transform duration-700 shadow-2xl group-hover:bg-brand/10">
                  <ChefHat className="w-16 md:w-40 h-16 md:h-40 text-brand opacity-40 group-hover:opacity-100 transition-opacity" />
               </div>
            </motion.div>

            {/* Enhanced Categories Grid */}
            <div className="space-y-6 md:space-y-10">
               <div className="flex justify-between items-end">
                  <div className="space-y-1">
                     <p className="text-brand text-[10px] font-black uppercase tracking-[0.4em]">Selection Modules</p>
                     <h3 className="text-3xl md:text-4xl font-display font-black tracking-tighter uppercase italic text-slate-900">The Catalog</h3>
                  </div>
                  <div className="hidden md:flex gap-2">
                     <div className="w-2.5 h-2.5 bg-brand rounded-full" />
                     <div className="w-2.5 h-2.5 bg-slate-200 rounded-full" />
                     <div className="w-2.5 h-2.5 bg-slate-200 rounded-full" />
                  </div>
               </div>
               <div className="flex gap-4 md:gap-6 overflow-x-auto pb-4 md:pb-8 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
                  {categories.map(cat => (
                    <button 
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={cn(
                        "group relative shrink-0",
                        selectedCategory === cat ? "scale-105 md:scale-110 z-10" : "scale-100 opacity-60 hover:opacity-100"
                      )}
                    >
                      <div className={cn(
                        "w-20 h-20 md:w-32 md:h-32 rounded-full flex flex-col items-center justify-center gap-1 md:gap-2 border-2 transition-all duration-500 shadow-premium",
                        selectedCategory === cat 
                          ? "bg-brand border-brand text-white shadow-brand-glow" 
                          : "bg-white border-slate-100 text-slate-500 hover:border-brand/40"
                      )}>
                        <Sprout className={cn("w-5 h-5 md:w-8 md:h-8", selectedCategory === cat ? "text-white" : "text-brand")} />
                        <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest">{cat}</span>
                      </div>
                      {selectedCategory === cat && (
                         <motion.div 
                           layoutId="cat-indicator"
                           className="absolute -bottom-2 md:-bottom-3 left-1/2 -translate-x-1/2 w-1.5 md:w-2 h-1.5 md:h-2 bg-brand rounded-full shadow-brand-glow"
                         />
                      )}
                    </button>
                  ))}
               </div>
            </div>

            {/* Product Waterfall */}
            <div className="space-y-12 pb-32">
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                     <div className="w-px h-8 bg-brand/30" />
                     <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">
                        {searchQuery ? `Detected ${filteredProducts.length} Entries` : "Current Stock Modules"}
                     </h4>
                  </div>
               </div>
               
               <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-10">
                 {filteredProducts.map(product => (
                   <ProductCard 
                     key={product.id} 
                     product={product} 
                     onAddToCart={addToCart} 
                     quantity={cart.find(i => i.id === product.id)?.quantity}
                     onUpdateQuantity={updateQuantity}
                   />
                 ))}
               </div>
            </div>
          </div>
        )}

        {/* Inbox/AI Tab */}
        {activeTab === 'inbox' && (
           <div className="h-[calc(100vh-220px)] min-h-[600px] border border-slate-100 rounded-[32px] overflow-hidden shadow-2xl bg-white">
              <RecipeAssistant 
                products={products} 
                onAddToCart={addToCart} 
                onClose={() => setActiveTab('market')} 
              />
           </div>
        )}

        {/* Orders Tab */}
        {activeTab === 'orders' && (
           <div className="space-y-8 py-4">
              <h2 className="text-4xl font-display font-black italic tracking-tighter uppercase text-slate-900">Your Orders</h2>
              <div className="space-y-4">
                 {myOrders.length === 0 ? (
                    <div className="bg-slate-50 rounded-[40px] p-20 text-center space-y-4">
                       <Clock className="w-16 h-16 mx-auto text-slate-200" />
                       <p className="text-xs font-black uppercase tracking-widest text-slate-400">No harvest history yet</p>
                    </div>
                 ) : (
                    myOrders.map(order => (
                      <div key={order.id} className="bg-white border border-slate-100 rounded-[32px] p-6 md:p-8 space-y-6 shadow-sm">
                         <div className="flex justify-between items-start">
                            <div className="space-y-2">
                               <div className="px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border bg-brand/10 text-brand border-brand/20 w-fit">
                                 {order.status}
                               </div>
                               <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight line-clamp-1">
                                  {order.items.map(i => i.name).join(', ')}
                               </h4>
                               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">NodeRef: #{order.id.slice(-6).toUpperCase()}</p>
                            </div>
                            <div className="text-right">
                               <p className="text-sm font-black text-slate-900">₹{order.totalAmount || "Calculated"}</p>
                               <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{new Date(order.createdAt).toLocaleDateString()}</p>
                               {(order.status === 'pending' || order.status === 'accepted') && (
                                 <button 
                                   disabled={loading}
                                   onClick={() => cancelOrder(order.id)}
                                   className="mt-2 flex items-center justify-end gap-1 text-[9px] font-black uppercase tracking-widest text-red-500 hover:text-red-600 transition-colors disabled:opacity-50"
                                 >
                                   <XCircle className="w-3 h-3" />
                                   Cancel Order
                                 </button>
                               )}
                            </div>
                         </div>
                         <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                            <div className="flex items-center gap-2 text-slate-400">
                               <MapPin className="w-4 h-4" />
                               <span className="text-[10px] font-bold uppercase truncate max-w-[150px] md:max-w-[300px]">{order.location.address}</span>
                            </div>
                            <span className="text-[10px] font-black uppercase text-brand flex items-center gap-1.5">
                               <div className="w-1.5 h-1.5 bg-brand rounded-full animate-pulse" /> Live Tracking
                            </span>
                         </div>
                      </div>
                    ))
                 )}
              </div>
           </div>
        )}

        {/* Profile Tab */}
        {activeTab === 'profile' && (
           <div className="space-y-12 py-4 pb-20">
              <div className="flex flex-col items-center gap-6 text-center">
                 <div className="w-24 h-24 bg-white rounded-[32px] flex items-center justify-center relative border border-slate-100 shadow-xl overflow-hidden">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt={user.fullName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <User className="w-12 h-12 text-slate-300" />
                    )}
                    <div className="absolute -bottom-1 -right-1 bg-brand text-white p-1.5 rounded-xl shadow-lg ring-4 ring-white">
                       <ShieldCheck className="w-4 h-4" />
                    </div>
                 </div>
                 <div className="space-y-1">
                    <h2 className="text-3xl font-display font-black italic tracking-tighter uppercase text-slate-900">{user.fullName}</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">{user.email}</p>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="bg-brand border border-brand/20 rounded-[40px] p-10 text-white space-y-6 shadow-xl shadow-brand/10 relative overflow-hidden group">
                    <Zap className="absolute -right-8 -top-8 w-40 h-40 opacity-10 group-hover:scale-110 transition-transform duration-1000" />
                    <h4 className="text-[10px] font-black uppercase tracking-[0.4em] opacity-80">Super Coins</h4>
                    <p className="text-7xl font-display font-black italic tracking-tighter tabular-nums">{user.superCoins || 0}</p>
                    <p className="text-xs font-bold text-white/80 uppercase tracking-widest leading-relaxed">Shop fresh, earn coins, get rewards. Every harvest counts at VegieRoute.</p>
                 </div>
                 <div className="flex flex-col gap-4 md:gap-6">
                    <div className="bg-white border border-slate-100 rounded-[32px] p-8 space-y-6 shadow-sm">
                       <div className="flex items-center justify-between">
                          <div>
                             <p className="text-[9px] font-black text-brand uppercase tracking-widest mb-1">Subscription Protocol</p>
                             <h4 className="text-xl font-black uppercase tracking-tight text-slate-900">
                                {user.subscriptionPlan ? user.subscriptionPlan : 'Free Tier'}
                             </h4>
                          </div>
                          <div className={cn(
                             "w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg",
                             user.subscriptionPlan === 'Gold' ? "bg-amber-400 text-white shadow-amber-200" : 
                             user.subscriptionPlan === 'Silver' ? "bg-slate-400 text-white shadow-slate-200" :
                             "bg-slate-100 text-slate-400 shadow-none border border-slate-200"
                          )}>
                             {user.subscriptionPlan === 'Gold' ? <Crown className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
                          </div>
                       </div>

                       {user.subscriptionExpiry && (
                          <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                             <Calendar className="w-4 h-4 text-slate-400" />
                             <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                Expires on: <span className="text-slate-900">{new Date(user.subscriptionExpiry).toLocaleDateString()}</span>
                             </div>
                          </div>
                       )}

                       <div className="space-y-3 pt-2">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Upgrade Channels</p>
                          <div className="grid grid-cols-2 gap-3">
                             <button 
                                disabled={loading || user.subscriptionPlan === 'Silver'}
                                onClick={() => upgradeSubscription('Silver')}
                                className="p-4 rounded-2xl border-2 border-slate-50 hover:border-slate-200 transition-all text-left disabled:opacity-50"
                             >
                                <p className="text-[8px] font-black uppercase text-slate-400 mb-1">Silver Node</p>
                                <p className="text-xs font-black uppercase text-slate-900">₹99/mo</p>
                             </button>
                             <button 
                                disabled={loading || user.subscriptionPlan === 'Gold'}
                                onClick={() => upgradeSubscription('Gold')}
                                className="p-4 rounded-2xl border-2 border-amber-50 hover:border-amber-100 bg-amber-50/30 transition-all text-left disabled:opacity-50"
                             >
                                <p className="text-[8px] font-black uppercase text-amber-500 mb-1">Gold Node</p>
                                <p className="text-xs font-black uppercase text-slate-900">₹299/mo</p>
                             </button>
                          </div>
                       </div>
                    </div>

                    <button className="bg-white border border-slate-100 rounded-[32px] p-6 text-left hover:border-brand/40 transition-all shadow-sm group">
                       <p className="text-[9px] font-black text-brand uppercase tracking-widest mb-1">Active Wallet</p>
                       <p className="text-sm font-black uppercase tracking-tight text-slate-900 group-hover:text-brand transition-colors">Manage Payments</p>
                    </button>
                    <button 
                       onClick={() => auth.signOut()}
                       className="w-full py-6 md:py-8 bg-red-50 text-red-500 rounded-[32px] text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-red-100 transition-all border border-red-100 shadow-sm"
                    >
                       <UserX className="w-5 h-5" />
                       Terminate Session
                    </button>
                 </div>
              </div>
           </div>
        )}
      </main>

      {/* Persistence Hook: The Mini Basket Bar (Mobile/Table Friendly) */}
      <AnimatePresence>
        {cart.length > 0 && activeTab === 'market' && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-24 md:bottom-28 left-4 right-4 z-40 max-w-xl mx-auto"
          >
            <div 
              onClick={() => setShowCart(true)}
              className="bg-brand text-white p-3 md:p-5 rounded-2xl md:rounded-3xl flex items-center justify-between shadow-2xl shadow-brand/40 cursor-pointer group hover:scale-[1.02] transition-transform active:scale-95 border-b-4 border-b-brand-dark/30"
            >
              <div className="flex items-center gap-3 md:gap-4">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5 md:w-6 md:h-6" />
                </div>
                <div>
                  <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] opacity-80">View Basket</p>
                  <p className="text-sm md:text-lg font-black tracking-tight leading-none">
                    {cart.reduce((acc, curr) => acc + curr.quantity, 0)} Items <span className="opacity-40">•</span> ₹{totalInfo.total}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 font-black text-[9px] md:text-[11px] uppercase tracking-widest">
                <span className="hidden xs:inline">Checkout</span>
                <ChevronRight className="w-4 h-4 md:w-5 md:h-5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
            
            {/* Delivery Promise Tag */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-3 py-1 rounded-full flex items-center gap-1.5 shadow-xl border border-white/10 whitespace-nowrap">
              <Zap className="w-2.5 h-2.5 text-brand fill-brand" />
              <span className="text-[8px] font-black uppercase tracking-widest italic">30 MINS PROMISE</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} cartCount={cart.length} />
      
      <CartSidebar 
        isOpen={showCart} 
        onClose={() => setShowCart(false)} 
        cart={cart.map(c => ({ product: c, quantity: c.quantity }))} // Adapt existing interface
        onUpdateQuantity={updateQuantity}
        onPlaceOrder={placeOrder}
        loading={loading}
      />
    </div>
  );
};

export default CustomerView;
