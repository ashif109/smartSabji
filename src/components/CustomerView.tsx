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
      <header className="bg-white/90 backdrop-blur-xl px-4 md:px-6 py-4 md:py-6 border-b border-slate-100 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand/20">
            <Sprout className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-display font-black text-slate-900 tracking-tight uppercase leading-none italic">Vegie<span className="text-brand">Route</span></h1>
            <button 
              onClick={() => {
                setShowLocationModal(true);
              }}
              className="flex items-center gap-1 mt-1 group"
            >
               <MapPin className="w-3 h-3 text-brand" />
               <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest line-clamp-1 max-w-[150px] group-hover:text-brand transition-colors">
                  {isLocationConfirmed ? selectedLocation?.address : "Set Delivery Location"}
               </span>
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
           <button 
             onClick={() => setActiveTab('profile')} 
             className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-slate-400 hover:text-brand transition-colors"
           >
              <User className="w-5 h-5" />
           </button>
        </div>
      </header>

      {/* Location Confirmation Modal */}
      <AnimatePresence>
        {showLocationModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => isLocationConfirmed && setShowLocationModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
               <div className="p-8 border-b border-slate-100">
                  <h3 className="text-3xl font-display font-black italic tracking-tighter uppercase text-slate-900">Set Node Location</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Direct from local nodes to your precise doorstep</p>
               </div>

               <div className="flex-1 min-h-[300px] bg-slate-50 relative">
                  <MapContainer 
                    centerPos={selectedLocation || { lat: 19.0760, lng: 72.8777 }}
                    zoom={15}
                    onMapClick={(lat, lng) => {
                      setSelectedLocation({ lat, lng, address: `Sector Node: ${lat.toFixed(4)}, ${lng.toFixed(4)}` });
                    }}
                    markers={selectedLocation ? [{ id: 'selected', lat: selectedLocation.lat, lng: selectedLocation.lng, label: 'DELIVERY POINT' }] : []}
                  />
                  <div className="absolute top-4 left-4 right-4 pointer-events-none">
                     <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-slate-100 shadow-xl pointer-events-auto">
                        <div className="flex items-center gap-2 mb-2">
                           <div className="w-2 h-2 bg-brand rounded-full animate-pulse" />
                           <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Current selection</span>
                        </div>
                        <p className="text-xs font-bold text-slate-900 leading-tight uppercase italic">{selectedLocation?.address || "Click map to select node"}</p>
                     </div>
                  </div>
               </div>

               <div className="p-8 space-y-4">
                  <button 
                    onClick={() => {
                      if ('geolocation' in navigator) {
                        navigator.geolocation.getCurrentPosition((pos) => {
                          setSelectedLocation({
                            lat: pos.coords.latitude,
                            lng: pos.coords.longitude,
                            address: "Detected Hyperlocal Node"
                          });
                        });
                      }
                    }}
                    className="w-full py-4 border-2 border-slate-100 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all"
                  >
                    <Navigation className="w-4 h-4" />
                    Detect Live Location
                  </button>
                  <button 
                    disabled={!selectedLocation}
                    onClick={() => {
                      setIsLocationConfirmed(true);
                      setShowLocationModal(false);
                    }}
                    className="w-full py-6 bg-brand text-white rounded-2xl flex items-center justify-center gap-3 text-sm font-black uppercase tracking-widest shadow-xl shadow-brand/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
                  >
                    Confirm Delivery Node
                    <ArrowRight className="w-5 h-5" />
                  </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <main className="max-w-7xl mx-auto px-4 md:px-6 mt-6 md:mt-8">
        {activeTab === 'market' && (
          <div className="space-y-8 md:space-y-12">
            {/* AI Kitchen Banner */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setActiveTab('inbox')}
              className="bg-brand rounded-[28px] md:rounded-[40px] p-6 md:p-10 text-white flex flex-col md:flex-row items-center justify-between gap-6 md:gap-10 relative overflow-hidden cursor-pointer group hover:shadow-2xl hover:shadow-brand/20 transition-all duration-500"
            >
              <div className="absolute top-0 right-0 p-8 md:p-12 opacity-10 group-hover:scale-125 transition-transform duration-1000">
                <ChefHat className="w-32 md:w-64 h-32 md:h-64 fill-white" />
              </div>
              <div className="space-y-3 md:space-y-5 relative z-10 text-center md:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em]">
                  <Sparkles className="w-3 h-3" />
                  <span>GenAI Powered</span>
                </div>
                <h2 className="text-3xl md:text-6xl font-display font-black italic tracking-tighter leading-[0.9] uppercase">Kitchen<br />Assistant</h2>
                <p className="text-white/80 text-[10px] md:text-sm font-medium max-w-sm tracking-wide leading-relaxed">
                  Stuck with ingredients? Ask VegieRoute Chef for a recipe and auto-fill your basket.
                </p>
                <div className="flex items-center justify-center md:justify-start gap-4 pt-2">
                  <div className="h-10 md:h-12 px-6 md:px-8 bg-white text-brand rounded-full flex items-center justify-center gap-2 font-black text-[10px] md:text-[11px] uppercase tracking-widest shadow-xl group-hover:scale-105 transition-all">
                    <span>Ask Chef</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
              <div className="aspect-square w-24 md:w-56 bg-white/10 rounded-[28px] md:rounded-[48px] backdrop-blur-md flex items-center justify-center border border-white/20 shadow-xl group-hover:rotate-6 transition-transform">
                 <ChefHat className="w-12 md:w-28 h-12 md:h-28 text-white" />
              </div>
            </motion.div>

            {/* Sticky Search & Filter */}
            <div className="space-y-4 md:space-y-6">
              <div className="relative group">
                <div className="absolute left-5 md:left-8 top-1/2 -translate-y-1/2 transition-transform group-focus-within:scale-110">
                  <Search className="text-slate-300 w-5 h-5 md:w-6 md:h-6 group-focus-within:text-brand transition-colors" />
                </div>
                <input 
                  type="text" 
                  placeholder="Search Aloo, Kanda, Mirchi..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-[24px] md:rounded-[32px] pl-14 md:pl-20 pr-6 md:pr-20 py-4 md:py-7 text-sm md:text-base font-bold focus:ring-8 focus:ring-brand/5 focus:border-brand outline-none transition-all shadow-sm"
                />
              </div>
              
              {!searchQuery && (
                <div className="flex gap-2 md:gap-3 overflow-x-auto pb-4 scrollbar-hide">
                  {categories.map(cat => (
                    <button 
                      key={cat}
                      onClick={() => setSelectedCategory(cat === 'All' ? 'All' : cat)}
                      className={cn(
                        "px-6 md:px-10 py-3 md:py-4 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border cursor-pointer",
                        selectedCategory === cat 
                          ? "bg-slate-900 text-white border-slate-900 shadow-xl" 
                          : "bg-white text-slate-500 border-slate-200 hover:border-brand/40 hover:text-brand shadow-sm"
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product Display */}
            <div className="space-y-6 md:space-y-10 pb-20">
              <div className="flex justify-between items-end">
                <div>
                   <h3 className="text-2xl md:text-4xl font-display font-black italic tracking-tighter uppercase text-slate-900">
                     {searchQuery ? `Search Results` : "Fresh Harvest"}
                   </h3>
                   <div className="flex items-center gap-2 mt-1">
                      <div className="w-1.5 h-1.5 bg-brand rounded-full animate-pulse" />
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">
                        30 MIN EXPRESS DELIVERY
                      </p>
                   </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-8">
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
            className="fixed bottom-24 left-4 right-4 z-40"
          >
            <div 
              onClick={() => setShowCart(true)}
              className="bg-brand text-white p-4 md:p-5 rounded-2xl md:rounded-3xl flex items-center justify-between shadow-2xl shadow-brand/40 cursor-pointer group hover:scale-[1.02] transition-transform active:scale-95 border-b-4 border-b-brand-dark/30"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5 md:w-6 md:h-6" />
                </div>
                <div>
                  <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] opacity-80">View Basket</p>
                  <p className="text-sm md:text-lg font-black tracking-tight leading-none">
                    {cart.reduce((acc, curr) => acc + curr.quantity, 0)} Items <span className="opacity-40">•</span> ₹{totalInfo.total}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 font-black text-[10px] md:text-[11px] uppercase tracking-widest">
                <span>Checkout</span>
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
