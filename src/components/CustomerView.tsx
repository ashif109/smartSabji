import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, doc, updateDoc, runTransaction } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingCart, MapPin, Clock, Search, Minus, Plus, CreditCard, Coins, X, Loader2, Navigation, Signal, Zap, Gift, Info, Leaf, Sprout, ShieldCheck, Play, AlertCircle, Star } from 'lucide-react';
import { Order, UserProfile, VegetableItem, SellerProfile } from '../types';
import { VEGETABLES } from '../constants';
import MapContainer from './MapContainer';
import { cn, formatCurrency, handleFirestoreError, OperationType } from '../lib/utils';

interface CustomerViewProps {
  user: UserProfile;
}

const CustomerView: React.FC<CustomerViewProps> = ({ user }) => {
  const [cart, setCart] = useState<VegetableItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{lat: number, lng: number, address: string} | null>(null);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'market' | 'orders'>('market');
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [nearbySellers, setNearbySellers] = useState<SellerProfile[]>([]);
  const [claiming, setClaiming] = useState(false);
  const [scratchReward, setScratchReward] = useState<Order | null>(null);
  const [scratchProgress, setScratchProgress] = useState(0);
  const [gpsDenied, setGpsDenied] = useState(false);
  const [userCoords, setUserCoords] = useState<{lat: number, lng: number} | null>(null);
  const [showTerms, setShowTerms] = useState(false);

  const superCoins = user.superCoins || 0;
  const isWeekend = [0, 6].includes(new Date().getDay()); // 0 is Sunday, 6 is Saturday
  const cheapestVeggie = [...VEGETABLES].sort((a, b) => a.price - b.price)[0];
  const canRedeem = superCoins >= 100 && isWeekend;

  const claimWeekendReward = async () => {
    if (!canRedeem) {
      if (superCoins < 100) alert("Collect 100 Super Coins first!");
      else if (!isWeekend) alert("Rewards can only be claimed on Weekends!");
      return;
    }
    if (!selectedLocation) {
      setShowMapPicker(true);
      return;
    }
    
    setClaiming(true);
    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', user.id);
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) throw new Error("Entity missing");
        
        const currentSuper = userSnap.data().superCoins || 0;
        if (currentSuper < 100) throw new Error("INSUFFICIENT_ENERGY");

        transaction.update(userRef, { superCoins: currentSuper - 100 });
        
        const newOrderRef = doc(collection(db, 'orders'));
        transaction.set(newOrderRef, {
          customerId: user.id,
          items: [{ ...cheapestVeggie, quantity: 1 }],
          totalAmount: 0,
          status: 'pending',
          location: selectedLocation,
          timeSlot: 'WEEKEND_REWARD',
          createdAt: new Date().toISOString(),
          type: 'reward'
        });
      });
      alert(`Success! 1kg of ${cheapestVeggie.name} is on your way for FREE!`);
      setActiveTab('orders');
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'superCoins/redeem', auth);
    } finally {
      setClaiming(false);
    }
  };

  useEffect(() => {
    const q = query(
      collection(db, 'users'), 
      where('role', '==', 'seller'), 
      where('isOnline', '==', true)
    );
    
    const unsubscribe = onSnapshot(q, (snap) => {
      const sellers = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SellerProfile));
      setNearbySellers(sellers);
    }, (error) => {
      if (error.code === 'permission-denied') {
        console.warn("Seller radar restricted or awaiting permissions.");
      } else {
        handleFirestoreError(error, OperationType.LIST, 'users/sellers', auth);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'orders'), where('customerId', '==', user.id));
    const unsubscribe = onSnapshot(q, (snap) => {
      const orders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setMyOrders(orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      
      const reward = orders.find(o => o.status === 'delivered' && o.rewardAvailable);
      if (reward && !scratchReward) {
        setScratchReward(reward);
      }
    }, (error) => {
      if (error.code === 'permission-denied') {
        console.warn("Order pipeline access pending...");
      } else {
        handleFirestoreError(error, OperationType.LIST, 'orders', auth);
      }
    });
    return unsubscribe;
  }, [user.id]);

  const handleScratch = async () => {
    if (!scratchReward || claiming) return;
    setClaiming(true);
    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', user.id);
        const orderRef = doc(db, 'orders', scratchReward.id);
        
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) throw new Error("Entity missing");

        transaction.update(userRef, { 
          superCoins: (userSnap.data().superCoins || 0) + (scratchReward.rewardAmount || 0) 
        });
        transaction.update(orderRef, { rewardAvailable: false });
      });
      setScratchReward(null);
      setScratchProgress(0);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'reward/scratch', auth);
    } finally {
      setClaiming(false);
    }
  };

  const useCurrentLocation = (mandatory = false) => {
    if ('geolocation' in navigator) {
      setLoading(true);
      navigator.geolocation.getCurrentPosition((pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserCoords(coords);
        setSelectedLocation({
          ...coords,
          address: `Current Position (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`
        });
        setGpsDenied(false);
        setLoading(false);
      }, (err) => {
        console.error(err);
        setLoading(false);
        if (mandatory) setGpsDenied(true);
      }, { enableHighAccuracy: true });
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(2);
  };

  const addToCart = (item: VegetableItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: (i.quantity || 0) + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(i => 
      i.id === id ? { ...i, quantity: Math.max(0, (i.quantity || 0) + delta) } : i
    ).filter(i => (i.quantity || 0) > 0));
  };

  const totalAmount = cart.reduce((acc, item) => acc + (item.price * (item.quantity || 0)), 0);

  const placeOrder = async () => {
    if (!selectedLocation) {
      setShowMapPicker(true);
      return;
    }
    
    setLoading(true);
    try {
      await addDoc(collection(db, 'orders'), {
        customerId: user.id || auth.currentUser?.uid,
        items: cart,
        totalAmount,
        status: 'pending',
        location: selectedLocation,
        timeSlot: '5PM - 7PM',
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

  const filteredVegetables = VEGETABLES.filter(v => 
    v.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-dark text-white pb-32 overflow-x-hidden relative">
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-5 z-0">
         <Sprout className="absolute h-64 w-64 -top-20 -left-20 text-brand rotate-12" />
         <Leaf className="absolute h-48 w-48 top-1/2 -right-10 text-brand -rotate-45" />
         <Sprout className="absolute h-96 w-96 -bottom-32 left-1/3 text-brand opacity-10" />
      </div>

      <div className="max-w-7xl mx-auto p-4 sm:p-6 relative z-10">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-16 sm:mb-24 px-2 sm:px-4 gap-8 sm:gap-12 mt-8 sm:mt-20">
          <div className="space-y-4 sm:space-y-8">
            <div className="glass-pill w-fit tracking-widest text-brand border-brand/20 text-[10px] sm:text-xs">Authorized Consumer Node</div>
            <h1 className="text-5xl sm:text-7xl lg:text-9xl tracking-tighter uppercase font-black leading-[0.8] sm:leading-[0.8]">Market<br/><span className="text-neutral-800">Supply</span></h1>
            <p className="text-neutral-500 font-bold uppercase tracking-[0.2em] sm:tracking-[0.3em] flex flex-wrap items-center gap-3 sm:gap-4 text-[9px] sm:text-[10px]">
              <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-brand" /> 
              Coordinate: {selectedLocation?.address || "Undefined Region"}
              <button onClick={() => setShowMapPicker(true)} className="text-white hover:text-brand transition-colors decoration-brand/30 underline underline-offset-8 decoration-2 border-l border-line pl-3 sm:pl-4">Relocate Signal</button>
            </p>
          </div>
          <div className="flex items-center gap-4 sm:gap-8">
            <div className="hidden sm:flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-brand rounded-full animate-ping" />
                <span className="text-[10px] font-black uppercase text-brand tracking-widest">{nearbySellers.length} Sellers Live</span>
              </div>
              <p className="text-[8px] text-neutral-600 font-bold uppercase tracking-widest uppercase">Radar Active</p>
            </div>
            <div className="bg-surface border border-line px-6 py-5 sm:px-10 sm:py-8 rounded-[24px] sm:rounded-[40px] flex items-center gap-4 sm:gap-6 shadow-2xl relative overflow-hidden group flex-1 sm:flex-none justify-center">
              <div className="absolute inset-0 bg-brand/5 -translate-x-full group-hover:translate-x-0 transition-transform duration-700" />
              <div className="w-10 h-10 sm:w-14 sm:h-14 bg-brand/10 flex items-center justify-center rounded-xl sm:rounded-2xl relative z-10">
                <Zap className="w-5 h-5 sm:w-7 sm:h-7 text-brand animate-pulse" />
              </div>
              <div className="relative z-10">
                <p className="text-[8px] sm:text-[10px] font-black uppercase text-neutral-600 tracking-[0.2em] mb-1 sm:mb-2 leading-none">Super Coins Earned</p>
                <p className="text-2xl sm:text-4xl font-black tabular-nums leading-none tracking-tighter text-brand">{user.superCoins || 0}</p>
              </div>
            </div>
            <button 
              onClick={() => setShowCart(true)} 
              className="relative w-20 h-20 sm:w-28 sm:h-28 flex items-center justify-center bg-brand text-dark rounded-[24px] sm:rounded-[40px] shadow-[0_20px_40px_-10px_rgba(255,184,0,0.5)] hover:scale-105 active:scale-95 transition-all group"
            >
              <ShoppingCart className="w-8 h-8 sm:w-12 sm:h-12 group-hover:rotate-12 transition-transform" />
              {cart.length > 0 && (
                <span className="absolute -top-2 -right-2 sm:-top-4 sm:-right-4 bg-white text-dark text-[10px] sm:text-xs w-7 h-7 sm:w-10 sm:h-10 flex items-center justify-center rounded-full border-2 sm:border-4 border-dark font-black shadow-2xl">
                  {cart.reduce((a, b) => a + (b.quantity || 0), 0)}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="flex gap-8 sm:gap-12 mb-12 sm:mb-16 border-b border-line px-2 sm:px-4 overflow-x-auto custom-scrollbar whitespace-nowrap scrollbar-hide">
          {[
            { id: 'market', label: 'Fresh Market' },
            { id: 'orders', label: 'Active Pipeline' },
          ].map((tab) => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "font-display font-black uppercase text-[10px] sm:text-xs tracking-[0.2em] sm:tracking-[0.3em] transition-all relative pb-4 sm:pb-6",
                activeTab === tab.id ? "text-brand" : "text-neutral-600 hover:text-neutral-400"
              )}
            >
              {tab.label}
              {activeTab === tab.id && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-1 sm:h-1.5 bg-brand rounded-full" />}
            </button>
          ))}
        </div>

        {activeTab === 'market' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 sm:space-y-12">
            <div className="px-2 sm:px-4">
              <div className="premium-card p-8 sm:p-12 bg-gradient-to-br from-brand/10 to-surface-hover border-brand/30 overflow-hidden relative group">
                <div className="absolute top-0 right-0 p-8 sm:p-12 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Gift className="w-32 h-32 sm:w-48 sm:h-48 text-brand rotate-12" />
                </div>
                <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                  <div className="space-y-4 sm:space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-brand rounded-xl flex items-center justify-center">
                        <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-dark fill-current" />
                      </div>
                      <h3 className="text-2xl sm:text-4xl font-black uppercase tracking-tighter">Super Coin Hub</h3>
                    </div>
                    <p className="text-neutral-500 font-bold uppercase tracking-widest text-[10px] sm:text-xs max-w-md leading-relaxed">
                      Earn 1-3 Super Coins on every delivery. Reach 100 to unlock a <span className="text-brand">FREE VEGETABLE</span> on Saturdays and Sundays.
                    </p>
                    <div className="space-y-3">
                      <div className="flex justify-between items-end">
                        <span className="text-[10px] font-black uppercase text-neutral-600 tracking-widest leading-none">Redemption Progress</span>
                        <span className="text-lg font-black text-white tabular-nums leading-none">{superCoins}/100</span>
                      </div>
                      <div className="h-2 bg-line rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(superCoins, 100)}%` }}
                          className="h-full bg-brand shadow-[0_0_10px_#FFB800]"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-end gap-6">
                    <div className="text-center sm:text-right hidden sm:block">
                      <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest mb-1">Status</p>
                      <div className="flex items-center gap-2 justify-end">
                        <div className={cn("w-2 h-2 rounded-full", isWeekend ? "bg-green-500 animate-pulse" : "bg-neutral-800")} />
                        <span className="text-xs font-bold text-white uppercase">{isWeekend ? 'WEEKEND ACTIVE' : 'AWAITING WEEKEND'}</span>
                      </div>
                    </div>
                    <button 
                      onClick={claimWeekendReward}
                      disabled={claiming}
                      className={cn(
                        "px-10 h-20 sm:h-24 rounded-[28px] font-black uppercase tracking-[0.2em] text-xs sm:text-sm transition-all flex items-center justify-center gap-3",
                        canRedeem 
                          ? "bg-brand text-dark shadow-[0_15px_30px_-5px_rgba(255,184,0,0.4)] hover:scale-105 active:scale-95" 
                          : "bg-surface text-neutral-700 border border-line cursor-not-allowed"
                      )}
                    >
                      {claiming ? <Loader2 className="w-5 h-5 animate-spin" /> : <Gift className="w-5 h-5 sm:w-6 sm:h-6" />}
                      {canRedeem ? "Claim Free Veggie" : "Locked"}
                    </button>
                    {!canRedeem && superCoins >= 100 && !isWeekend && (
                      <div className="absolute -bottom-1 lg:bottom-4 px-4 py-2 bg-brand/10 border border-brand/20 rounded-full flex items-center gap-2">
                        <Info className="w-3 h-3 text-brand" />
                        <span className="text-[8px] font-black text-brand uppercase tracking-widest">Wait until Saturday to redeem your coins!</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="px-2 sm:px-4">
              <div className="premium-card p-0 h-[400px] sm:h-[500px] overflow-hidden relative shadow-2xl border-brand/10 group">
                <MapContainer 
                  markers={[
                    ...(selectedLocation ? [{ 
                      id: 'me', 
                      ...selectedLocation, 
                      icon: 'green', 
                      label: 'ME',
                      description: selectedLocation.address
                    }] : []),
                    ...nearbySellers.filter(s => s.currentLocation).map(s => {
                      const dist = userCoords ? calculateDistance(userCoords.lat, userCoords.lng, s.currentLocation!.lat, s.currentLocation!.lng) : null;
                      return {
                        id: s.id,
                        lat: s.currentLocation!.lat,
                        lng: s.currentLocation!.lng,
                        label: `SELLER: ${s.fullName}`,
                        description: `${s.averageRating ? `Rating: ${s.averageRating.toFixed(1)} ⭐ | ` : ''}${dist ? `${dist}km away - Mobile Unit` : 'Mobile Supply Unit Active'}`,
                        icon: 'brand'
                      };
                    })
                  ]}
                  zoom={15}
                  centerPos={userCoords || selectedLocation || undefined}
                  onMapClick={(lat, lng) => {
                    setSelectedLocation({ 
                      lat, 
                      lng, 
                      address: `Coordinate (${lat.toFixed(4)}, ${lng.toFixed(4)})` 
                    });
                  }}
                />
                <div className="absolute inset-0 pointer-events-none p-4 flex flex-col justify-between">
                  <div className="flex flex-col gap-1.5 items-start">
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="bg-dark/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-line shadow-xl flex items-center gap-2"
                    >
                      <div className="w-1 h-1 bg-brand rounded-full animate-pulse" />
                      <span className="text-[10px] font-black text-white uppercase tracking-widest leading-none">
                        {nearbySellers.length} Units Online
                      </span>
                    </motion.div>
                  </div>
                  <div className="flex items-end justify-between gap-4">
                    <motion.button 
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        if (!selectedLocation) {
                          setShowMapPicker(true);
                          return;
                        }
                        addDoc(collection(db, 'orders'), {
                          customerId: user.id || auth.currentUser?.uid,
                          items: [{ id: 'signal', name: 'DEMAND SIGNAL', quantity: 1, price: 0, unit: 'signal' }],
                          totalAmount: 0,
                          status: 'pending',
                          location: selectedLocation,
                          createdAt: new Date().toISOString(),
                          type: 'signal'
                        }).then(() => alert("Signal Broadcasted. Operators notified."))
                          .catch(e => handleFirestoreError(e, OperationType.CREATE, 'orders', auth));
                      }}
                      className="px-6 py-4 bg-brand text-dark rounded-xl font-black uppercase tracking-widest text-[10px] shadow-2xl pointer-events-auto flex items-center gap-2"
                    >
                      <Signal className="w-4 h-4" />
                      Broadcast Signal
                    </motion.button>
                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={() => useCurrentLocation()}
                        className="w-10 h-10 bg-white text-dark rounded-lg flex items-center justify-center shadow-xl pointer-events-auto hover:bg-brand transition-colors"
                        title="Sync GPS"
                      >
                        <Navigation className="w-4 h-4 fill-current" />
                      </button>
                      <button 
                        onClick={() => setShowMapPicker(true)}
                        className="w-10 h-10 bg-dark/90 text-white rounded-lg flex items-center justify-center shadow-xl border border-line pointer-events-auto hover:bg-brand hover:text-dark transition-colors"
                        title="Set Target"
                      >
                        <MapPin className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative px-2 sm:px-4">
              <Search className="absolute left-6 sm:left-10 top-1/2 -translate-y-1/2 text-neutral-600 w-5 h-5 sm:w-6 sm:h-6" />
              <input 
                type="text" 
                placeholder="Search logistics payload..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-premium pl-16 sm:pl-20 py-4 sm:py-6 text-sm sm:text-base"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-8 px-2 sm:px-4">
              {filteredVegetables.map((item) => (
                <motion.div 
                  key={item.id}
                  whileHover={{ y: -8 }}
                  className="premium-card p-4 sm:p-8 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4 sm:gap-8">
                    <div className="w-16 h-16 sm:w-24 sm:h-24 bg-surface-hover rounded-2xl sm:rounded-[32px] flex items-center justify-center text-3xl sm:text-5xl border border-line shadow-inner">
                      {item.name === 'Tomato' && '🍅'}
                      {item.name === 'Potato' && '🥔'}
                      {item.name === 'Onion' && '🧅'}
                      {item.name === 'Spinach' && '🥬'}
                      {item.name === 'Carrot' && '🥕'}
                      {item.name === 'Cauliflower' && '🥦'}
                      {item.name === 'Cabbage' && '🥬'}
                      {item.name === 'Lady Finger' && '🥒'}
                    </div>
                    <div>
                      <h3 className="text-xl sm:text-2xl font-black mb-1 tracking-tighter uppercase leading-none">{item.name}</h3>
                      <p className="text-brand font-bold text-base sm:text-lg leading-none mt-2">₹{item.price}<span className="text-neutral-500 text-xs sm:text-sm ml-1 font-medium italic lowercase">/ {item.unit}</span></p>
                    </div>
                  </div>
                  <button 
                    onClick={() => addToCart(item)}
                    className="w-12 h-12 sm:w-16 sm:h-16 bg-line hover:bg-brand text-white hover:text-dark rounded-full flex items-center justify-center transition-all active:scale-90"
                  >
                    <Plus className="w-6 h-6 sm:w-8 sm:h-8" />
                  </button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'orders' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 sm:space-y-8 px-2 sm:px-4">
            {myOrders.length === 0 ? (
              <div className="text-center py-24 sm:py-32 premium-card">
                <Clock className="w-16 h-16 sm:w-20 sm:h-20 text-neutral-800 mx-auto mb-6 sm:mb-8" />
                <p className="text-neutral-500 font-bold uppercase tracking-widest text-xs sm:text-base">No Active Logistics Found</p>
              </div>
            ) : (
              myOrders.map((order) => (
                <div key={order.id} className="premium-card p-6 sm:p-10 group relative">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-10 gap-4 sm:gap-6">
                    <div className="space-y-2 sm:space-y-3">
                       <span className={cn(
                        "px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em] border shadow-sm",
                        order.status === 'pending' ? "bg-white/5 text-white border-white/10" :
                        order.status === 'accepted' ? "bg-brand/10 text-brand border-brand/20" :
                        order.status === 'delivered' ? "bg-brand text-dark border-brand" : "bg-neutral-900 text-neutral-500 border-line"
                      )}>
                        {order.status}
                      </span>
                      <p className="text-[10px] sm:text-xs text-neutral-600 font-bold uppercase tracking-widest">Protocol ID: {order.id.split('-')[0].toUpperCase()}</p>
                    </div>
                    <p className="text-2xl sm:text-4xl font-black tracking-tighter tabular-nums">{formatCurrency(order.totalAmount)}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 mb-6 sm:mb-8 pb-6 sm:pb-8 border-b border-line">
                     <div className="space-y-1 sm:space-y-2">
                       <p className="text-[8px] sm:text-[10px] font-black text-neutral-600 uppercase tracking-widest leading-none">Payload Items</p>
                       <p className="text-base sm:text-lg font-bold text-neutral-300 leading-none">
                          {order.items.map(i => `${i.name} (x${i.quantity})`).join(', ')}
                       </p>
                     </div>
                     <div className="space-y-1 sm:space-y-2">
                       <p className="text-[8px] sm:text-[10px] font-black text-neutral-600 uppercase tracking-widest leading-none">Logistics Destination</p>
                       <p className="flex items-center gap-2 text-base sm:text-lg font-bold text-neutral-300 leading-none">
                         <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-brand" /> {order.location?.address}
                       </p>
                     </div>
                  </div>
                  {order.sellerId && order.status === 'delivered' && !order.rating && (
                     <OrderRatingAction order={order} />
                  )}
                  {order.sellerId && (
                     <SellerInfoDisplay 
                       sellerId={order.sellerId} 
                       status={order.status} 
                       orderLocation={order.location} 
                       orderId={order.id} 
                     />
                  )}
                  <button className="w-full py-3 sm:py-4 text-neutral-500 font-black uppercase text-[8px] sm:text-[10px] tracking-[0.3em] sm:tracking-[0.4em] hover:text-brand transition-colors">
                    TRACK LIVE DATA
                  </button>
                </div>
              ))
            )}
          </motion.div>
        )}

        <AnimatePresence>
          {showCart && (
            <div className="fixed inset-0 z-50 flex justify-end">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setShowCart(false)}
                className="absolute inset-0 bg-dark/95 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="relative w-full max-w-xl bg-surface border-l border-line shadow-[-40px_0_100px_rgba(0,0,0,0.5)] flex flex-col h-[100dvh]"
              >
                <div className="p-6 sm:p-12 pb-6 sm:pb-8 flex flex-col gap-3 sm:gap-4 border-b border-line">
                  <div className="flex justify-between items-center">
                    <h3 className="text-2xl sm:text-4xl tracking-tighter uppercase font-black leading-none">Bag Overflow</h3>
                    <button onClick={() => setShowCart(false)} className="w-10 h-10 sm:w-14 sm:h-14 flex items-center justify-center bg-line rounded-full hover:bg-brand hover:text-dark transition-all">
                      <X className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>
                  </div>
                  <p className="text-neutral-500 font-bold uppercase tracking-widest text-[10px] sm:text-xs">Review your logistics payload</p>
                </div>
                <div className="flex-1 overflow-y-auto p-6 sm:p-12 py-6 sm:py-8 space-y-6 sm:space-y-10 custom-scrollbar">
                  {cart.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full opacity-20">
                      <ShoppingCart className="w-16 h-16 sm:w-24 sm:h-24 mb-4 sm:mb-6" />
                      <p className="font-black uppercase tracking-widest text-sm sm:text-base">Null Reference</p>
                    </div>
                  ) : (
                    cart.map(item => (
                      <div key={item.id} className="flex justify-between items-center gap-4 sm:gap-8 group">
                        <div className="flex-1">
                          <div className="text-[8px] sm:text-[10px] font-black uppercase text-brand tracking-widest mb-1 sm:mb-2 leading-none">Veg-Standard</div>
                          <p className="font-black text-xl sm:text-3xl tracking-tighter uppercase leading-none">{item.name}</p>
                          <p className="text-neutral-500 font-bold text-xs sm:text-sm mt-1 sm:mt-2">₹{item.price} / {item.unit}</p>
                        </div>
                        <div className="flex items-center gap-3 sm:gap-6 bg-dark p-1.5 sm:p-2 rounded-xl sm:rounded-[24px] border border-line">
                          <button onClick={() => updateQuantity(item.id, -1)} className="w-8 h-8 sm:w-12 sm:h-12 flex items-center justify-center hover:bg-neutral-800 rounded-full transition-colors"><Minus className="w-3 h-3 sm:w-4 sm:h-4" /></button>
                          <span className="font-black text-lg sm:text-2xl w-6 sm:w-8 text-center tabular-nums leading-none">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, 1)} className="w-8 h-8 sm:w-12 sm:h-12 flex items-center justify-center hover:bg-neutral-800 rounded-full transition-colors"><Plus className="w-3 h-3 sm:w-4 sm:h-4" /></button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {cart.length > 0 && (
                  <div className="p-6 sm:p-12 pt-6 sm:pt-8 bg-dark border-t border-line space-y-6 sm:space-y-10 mb-[env(safe-area-inset-bottom)]">
                    <div className="flex justify-between items-end">
                      <div className="space-y-1">
                        <p className="text-neutral-600 font-black uppercase tracking-[0.2em] text-[8px] sm:text-[10px] leading-none">Logistics Total</p>
                        <p className="text-brand font-bold text-[10px] sm:text-sm uppercase leading-none mt-1 sm:mt-2">Secure Billing Applied</p>
                      </div>
                      <span className="text-3xl sm:text-6xl font-black tracking-tighter tabular-nums leading-none text-white">{formatCurrency(totalAmount)}</span>
                    </div>
                    <button 
                      onClick={placeOrder}
                      disabled={loading}
                      className="btn-brand w-full flex items-center justify-center gap-3 sm:gap-4 py-4 sm:py-6 text-xs sm:text-base font-black"
                    >
                      {loading && <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />}
                      {loading ? "Authorizing..." : "Authorize Pipeline"}
                    </button>
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showMapPicker && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setShowMapPicker(false)}
                className="absolute inset-0 bg-dark/95 backdrop-blur-2xl"
              />
              <motion.div 
                initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                className="relative w-full max-w-4xl h-[85vh] bg-dark rounded-[32px] sm:rounded-[48px] overflow-hidden border border-line flex flex-col shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8)]"
              >
                <div className="p-6 sm:p-10 border-b border-line flex justify-between items-center bg-dark">
                  <div className="space-y-1">
                    <h3 className="text-2xl sm:text-3xl font-black tracking-tighter uppercase leading-none">Signal Drop</h3>
                     <p className="text-[8px] sm:text-[10px] font-black uppercase text-neutral-600 tracking-widest leading-none mt-1 sm:mt-2">Pinpoint Delivery Coordinate</p>
                  </div>
                  <button onClick={() => setShowMapPicker(false)} className="w-10 h-10 sm:w-14 sm:h-14 flex items-center justify-center bg-surface border border-line rounded-full"><X className="w-5 h-5 sm:w-6 sm:h-6" /></button>
                </div>
                <div className="flex-1 relative bg-neutral-900 overflow-hidden">
                  <MapContainer 
                    onMapClick={(lat, lng) => setSelectedLocation({ lat, lng, address: `Coordinate (${lat.toFixed(4)}, ${lng.toFixed(4)})` })}
                    markers={[
                      ...(selectedLocation ? [{ 
                        id: 'selected', 
                        ...selectedLocation, 
                        icon: 'green', 
                        label: 'YOUR SIGNAL',
                        description: 'Drop point confirmed'
                      }] : []),
                      ...nearbySellers.filter(s => s.currentLocation).map(s => ({
                        id: s.id,
                        lat: s.currentLocation!.lat,
                        lng: s.currentLocation!.lng,
                        label: `MOBILE SELLER (${s.fullName})`,
                        description: 'Operational in Sector',
                        icon: 'brand'
                      }))
                    ]}
                    zoom={15}
                  />
                </div>
                <div className="p-6 sm:p-12 bg-dark flex flex-col md:flex-row items-center gap-6 sm:gap-10 pb-8 sm:pb-12">
                  <div className="flex-1 space-y-1 sm:space-y-2 text-center md:text-left">
                    <p className="text-[8px] sm:text-[10px] font-black text-neutral-600 uppercase tracking-widest leading-none">Validated Address</p>
                    <p className="text-xl sm:text-3xl font-black tracking-tight text-white line-clamp-1 leading-none mt-1 sm:mt-2 uppercase">
                      {selectedLocation?.address || "Signal Required..."}
                    </p>
                  </div>
                  <button 
                    disabled={!selectedLocation}
                    onClick={() => setShowMapPicker(false)}
                    className="btn-brand md:w-fit whitespace-nowrap w-full py-4 sm:py-6 text-sm"
                  >
                    Confirm Coordinate
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {scratchReward && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-dark/95 backdrop-blur-3xl"
              />
              <motion.div 
                initial={{ scale: 0.8, y: 50, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.8, y: 50, opacity: 0 }}
                className="relative w-full max-w-lg bg-surface border border-brand/30 rounded-[48px] p-8 sm:p-12 text-center shadow-[0_0_100px_rgba(255,184,0,0.2)] overflow-hidden"
              >
                 <div className="absolute top-0 inset-x-0 h-1 bg-brand" />
                 <Gift className="w-16 h-16 sm:w-24 sm:h-24 text-brand mx-auto mb-8 animate-bounce" />
                 <h2 className="text-4xl sm:text-6xl font-black uppercase tracking-tighter mb-4">Congratulation!</h2>
                 <p className="text-neutral-500 font-bold uppercase tracking-widest text-[10px] sm:text-xs mb-10">Your delivery was completed successfully. Scratch below to reveal your Super Coins!</p>
                 <div className="relative aspect-video w-full bg-dark rounded-[32px] border border-line overflow-hidden mb-10 group cursor-crosshair">
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                       <p className="text-[10px] font-black text-brand uppercase tracking-[0.3em] mb-2 leading-none">Neural Jackpot</p>
                       <p className="text-7xl font-black text-white leading-none tracking-tighter">+{scratchReward.rewardAmount}</p>
                       <p className="text-xs font-bold text-neutral-600 uppercase tracking-widest mt-2">Super Coins Added</p>
                    </div>
                    <motion.div 
                      drag
                      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                      dragElastic={1}
                      onDrag={(e, info) => {
                        const progress = scratchProgress + (Math.abs(info.delta.x) + Math.abs(info.delta.y));
                        setScratchProgress(progress);
                      }}
                      animate={scratchProgress > 500 ? { y: '-150%', opacity: 0 } : {}}
                      className="absolute inset-0 bg-neutral-800 flex flex-col items-center justify-center p-8 select-none z-10"
                    >
                       <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mb-4">
                          <Zap className="w-6 h-6 text-neutral-600" />
                       </div>
                       <p className="text-neutral-400 font-black uppercase tracking-[0.2em] text-[10px]">Scratch to Reveal</p>
                       <div className="mt-4 flex gap-1">
                          {[1,2,3,4,5].map(i => (
                            <div key={i} className="w-6 h-1 bg-neutral-700 rounded-full overflow-hidden">
                               <motion.div 
                                 initial={{ width: 0 }}
                                 animate={{ width: `${Math.min((scratchProgress/500) * 100, 100)}%` }}
                                 className="h-full bg-brand"
                               />
                            </div>
                          ))}
                       </div>
                    </motion.div>
                 </div>
                 <button 
                   onClick={handleScratch}
                   disabled={scratchProgress < 500 || claiming}
                   className={cn(
                     "w-full py-6 rounded-2xl font-black uppercase tracking-widest text-xs transition-all",
                     scratchProgress > 500 
                       ? "bg-brand text-dark hover:scale-105" 
                       : "bg-surface text-neutral-700 border border-line cursor-not-allowed"
                   )}
                 >
                   {claiming ? "Processing Link..." : scratchProgress > 500 ? "Claim Super Coins" : "Complete Scratching First"}
                 </button>
                 <button 
                   onClick={() => setShowTerms(true)}
                   className="mt-8 text-[9px] font-black text-neutral-600 uppercase tracking-widest hover:text-brand transition-colors"
                 >
                   System Terms & Conditions
                 </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showTerms && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setShowTerms(false)}
                className="absolute inset-0 bg-dark/95 backdrop-blur-xl"
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                className="relative w-full max-w-xl bg-surface border border-line rounded-[32px] p-8 sm:p-12 shadow-2xl"
              >
                 <h3 className="text-2xl font-black uppercase tracking-tighter mb-6 flex items-center gap-3">
                    <Info className="text-brand w-6 h-6" /> Loyalty Protocol (v1.4)
                 </h3>
                 <div className="space-y-6 text-neutral-400 text-xs font-bold uppercase leading-relaxed tracking-wide">
                    <p>1. Every authentic delivery earns 1-3 Super Coins via neural randomization.</p>
                    <p>2. Accrue 100 Super Coins to qualify for a free supply payload.</p>
                    <p>3. Redemptions are restricted to saturation points (Saturdays/Sundays) to optimize logistics flow.</p>
                    <p>4. Free rewards target the most cost-efficient inventory unit to maintain system stability.</p>
                    <p>5. Live GPS status must be active for real-time radar functionality.</p>
                 </div>
                 <button 
                   onClick={() => setShowTerms(false)}
                   className="w-full mt-10 py-4 bg-dark border border-line rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-brand hover:text-dark transition-all"
                 >
                   Acknowledge Matrix
                 </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const OrderRatingAction: React.FC<{ order: Order }> = ({ order }) => {
  const [rating, setRating] = useState(0);
  const [qualityRating, setQualityRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [hoverQuality, setHoverQuality] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitRating = async () => {
    if (rating === 0 || qualityRating === 0) return;
    if (!order.sellerId) return;

    setIsSubmitting(true);
    try {
      await runTransaction(db, async (transaction) => {
        const orderRef = doc(db, 'orders', order.id);
        const sellerRef = doc(db, 'users', order.sellerId!);
        
        const sellerSnap = await transaction.get(sellerRef);
        if (!sellerSnap.exists()) throw new Error("SELLER_NOT_FOUND");
        
        const sellerData = sellerSnap.data() as SellerProfile;
        const currentTotal = sellerData.totalRatings || 0;
        const currentAvg = sellerData.averageRating || 0;
        
        // Use average of both ratings for global seller score
        const newRatingScore = (rating + qualityRating) / 2;
        const newTotal = currentTotal + 1;
        const newAvg = ((currentAvg * currentTotal) + newRatingScore) / newTotal;

        transaction.update(orderRef, { 
          rating, 
          qualityRating,
          updatedAt: new Date().toISOString() 
        });
        
        transaction.update(sellerRef, { 
          averageRating: newAvg, 
          totalRatings: newTotal 
        });
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'order/rate', auth);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-brand/5 border border-brand/20 rounded-[28px] p-6 sm:p-8 mb-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <Star className="w-16 h-16 text-brand" />
      </div>
      <div className="relative z-10 space-y-6">
        <div className="space-y-1">
          <p className="text-[10px] font-black text-brand uppercase tracking-[0.2em] leading-none mb-2">Service Evaluation Required</p>
          <h4 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tighter">Rate your experience</h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-3">
             <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Seller Behavior</p>
             <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(star)}
                    className="transition-transform active:scale-90"
                  >
                    <Star 
                      className={cn(
                        "w-6 h-6 transition-colors",
                        (hoverRating || rating) >= star ? "text-brand fill-brand" : "text-neutral-800"
                      )} 
                    />
                  </button>
                ))}
             </div>
          </div>
          <div className="space-y-3">
             <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Produce Quality</p>
             <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onMouseEnter={() => setHoverQuality(star)}
                    onMouseLeave={() => setHoverQuality(0)}
                    onClick={() => setQualityRating(star)}
                    className="transition-transform active:scale-90"
                  >
                    <Star 
                      className={cn(
                        "w-6 h-6 transition-colors",
                        (hoverQuality || qualityRating) >= star ? "text-brand fill-brand" : "text-neutral-800"
                      )} 
                    />
                  </button>
                ))}
             </div>
          </div>
        </div>

        <button 
          onClick={submitRating}
          disabled={rating === 0 || qualityRating === 0 || isSubmitting}
          className={cn(
            "w-full h-14 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2",
            (rating > 0 && qualityRating > 0) 
              ? "bg-brand text-dark shadow-lg shadow-brand/20 hover:scale-[1.02]" 
              : "bg-surface-hover text-neutral-700 border border-line cursor-not-allowed"
          )}
        >
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Authorize Rating Payload"}
        </button>
      </div>
    </div>
  );
};

const SellerInfoDisplay: React.FC<{ sellerId: string; status: string; orderLocation: { lat: number, lng: number }; orderId: string }> = ({ sellerId, status, orderLocation, orderId }) => {
  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [sellerOrders, setSellerOrders] = useState<Order[]>([]);
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    const unsubSeller = onSnapshot(doc(db, 'users', sellerId), (snap) => {
      if (snap.exists()) {
        setSeller({ id: snap.id, ...snap.data() } as SellerProfile);
      }
    });

    // Fetch active orders for this seller to calculate queue position/ETA
    const q = query(
      collection(db, 'orders'), 
      where('sellerId', '==', sellerId),
      where('status', 'in', ['accepted', 'ongoing'])
    );

    const unsubOrders = onSnapshot(q, (snap) => {
      const orders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setSellerOrders(orders);
    });

    return () => {
      unsubSeller();
      unsubOrders();
    };
  }, [sellerId]);

  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const etaInfo = useMemo(() => {
    if (!seller || !seller.currentLocation || sellerOrders.length === 0) return null;

    // Use the same optimization logic as in SellerView to find the queue
    const targets = [...sellerOrders];
    let currentPos = seller.currentLocation;
    const remaining = [...targets];
    const optimized: Order[] = [];
    const now = Date.now();

    while (remaining.length > 0) {
      let nextBestIdx = 0;
      let maxScore = -Infinity;
      
      for (let i = 0; i < remaining.length; i++) {
        const target = remaining[i];
        const dist = getDistance(currentPos.lat, currentPos.lng, target.location.lat, target.location.lng);
        const ageInMs = target.createdAt ? (now - new Date(target.createdAt).getTime()) : 0;
        const ageWeight = (ageInMs / 60000) * 0.1;

        const neighbors = remaining.filter((other, idx) => {
          if (idx === i) return false;
          return getDistance(target.location.lat, target.location.lng, other.location.lat, other.location.lng) < 0.5;
        });
        const densityWeight = neighbors.length * 0.5;
        const statusWeight = (target.status === 'accepted' || target.status === 'ongoing') ? 1.0 : 0;

        const score = (10 / (dist + 0.1)) + ageWeight + densityWeight + statusWeight;

        if (score > maxScore) {
          maxScore = score;
          nextBestIdx = i;
        }
      }
      
      const next = remaining.splice(nextBestIdx, 1)[0];
      optimized.push(next);
      currentPos = next.location;
    }

    // Calculate total distance to reach "this" orderId
    let totalDist = 0;
    let currentPathPos = seller.currentLocation;
    let stopsBefore = 0;
    
    for (const ord of optimized) {
      totalDist += getDistance(currentPathPos.lat, currentPathPos.lng, ord.location.lat, ord.location.lng);
      if (ord.id === orderId) break;
      currentPathPos = ord.location;
      stopsBefore++;
    }

    const AVG_SPEED_KMPH = 12; // Adjusted for urban vegetable carts
    const travelTimeMinutes = (totalDist / AVG_SPEED_KMPH) * 60;
    const serviceTimeMinutes = stopsBefore * 3; // 3 mins per stop delivery
    const totalMinutes = Math.round(travelTimeMinutes + serviceTimeMinutes);

    return {
      minutes: totalMinutes,
      stops: stopsBefore,
      distance: totalDist.toFixed(1)
    };
  }, [seller, sellerOrders, orderId]);

  if (!seller) return null;

  return (
    <>
      <div className="bg-surface border border-line rounded-[24px] sm:rounded-[32px] p-5 sm:p-8 mb-6 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
          <ShieldCheck className="w-20 h-20 sm:w-32 sm:h-32 text-brand rotate-12" />
        </div>

        <div className="flex items-center justify-between mb-6 relative z-10">
          <div className="space-y-1 sm:space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-brand rounded-full animate-pulse" />
              <p className="text-[8px] sm:text-[10px] font-black text-brand uppercase tracking-widest leading-none">Verified Merchant Hub</p>
            </div>
            <div className="flex items-center gap-3">
              <h4 className="text-lg sm:text-2xl font-black text-white uppercase tracking-tighter leading-none">{seller.businessDetails?.shopName || seller.fullName}</h4>
              {seller.averageRating && (
                <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg">
                  <Star className="w-3 h-3 text-brand fill-brand" />
                  <span className="text-[10px] sm:text-xs font-black text-white tabular-nums">{seller.averageRating.toFixed(1)}</span>
                  <span className="text-[8px] font-bold text-neutral-500">({seller.totalRatings})</span>
                </div>
              )}
            </div>
            
            {status !== 'delivered' && etaInfo && (
              <div className="flex items-center gap-3 mt-3">
                <div className="bg-brand/10 border border-brand/20 px-3 py-1.5 rounded-xl flex items-center gap-2">
                  <Clock className="w-3 h-3 text-brand" />
                  <span className="text-[10px] font-black text-brand uppercase tracking-widest tabular-nums">ETA {etaInfo.minutes} MINS</span>
                </div>
                <p className="text-[8px] font-bold text-neutral-500 uppercase tracking-widest">
                  {etaInfo.stops > 0 ? `${etaInfo.stops} STOPS AWAY` : 'NEXT ARRIVAL'}
                </p>
              </div>
            )}
          </div>
          <div className="bg-brand/10 border border-brand/20 px-3 py-1.5 rounded-full flex items-center gap-2">
            <Signal className="w-3 h-3 text-brand" />
            <span className="text-[8px] font-black text-brand uppercase tracking-widest">{status.toUpperCase()}</span>
          </div>
        </div>

        {(status === 'accepted' || status === 'ongoing' || status === 'delivered') && seller.paymentInfo && (
          <div className="space-y-4 pt-6 border-t border-line relative z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-brand" />
                <p className="text-[9px] sm:text-[11px] font-black text-white uppercase tracking-widest">Financial Payload</p>
              </div>
              {seller.paymentInfo.qrCodeUrl && (
                <button 
                  onClick={() => setShowQR(true)}
                  className="text-[9px] font-black text-brand border-b border-brand/30 hover:border-brand transition-all uppercase tracking-widest"
                >
                  View QR Scan
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3">
              {seller.paymentInfo.upiId && (
                <div className="bg-dark/50 border border-line p-4 rounded-2xl flex items-center justify-between group/pay">
                  <div>
                    <p className="text-[7px] font-black text-neutral-600 uppercase mb-1">VPA / UPI ID</p>
                    <p className="text-xs sm:text-sm font-black text-brand tabular-nums select-all tracking-tight">{seller.paymentInfo.upiId}</p>
                  </div>
                  <button className="w-8 h-8 flex items-center justify-center bg-brand/5 rounded-lg opacity-0 group-hover/pay:opacity-100 transition-opacity">
                    <Play className="w-3 h-3 text-brand fill-current" />
                  </button>
                </div>
              )}
              {seller.paymentInfo.phoneNumber && (
                <div className="bg-dark/50 border border-line p-4 rounded-2xl flex items-center justify-between group/pay">
                  <div>
                    <p className="text-[7px] font-black text-neutral-600 uppercase mb-1">Direct Settlement Num</p>
                    <p className="text-xs sm:text-sm font-black text-white tabular-nums select-all tracking-tight">{seller.paymentInfo.phoneNumber}</p>
                  </div>
                  <button className="w-8 h-8 flex items-center justify-center bg-white/5 rounded-lg opacity-0 group-hover/pay:opacity-100 transition-opacity">
                    <Play className="w-3 h-3 text-white fill-current" />
                  </button>
                </div>
              )}
            </div>

            <div className="p-4 bg-brand/5 border border-brand/10 rounded-2xl">
              <p className="text-[8px] font-bold text-neutral-500 uppercase leading-relaxed tracking-wider">
                <span className="text-brand font-black">SECURITY PROTOCOL:</span> Always verify produce quality before final settlement. Peer-to-peer payments are non-reversible.
              </p>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showQR && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-dark/95 backdrop-blur-3xl"
          >
            <div className="max-w-sm w-full bg-surface border border-brand/20 rounded-[40px] p-8 text-center space-y-6 shadow-2xl relative">
              <button 
                onClick={() => setShowQR(false)}
                className="absolute top-6 right-6 text-neutral-500 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              <div className="space-y-2">
                <h5 className="text-2xl font-black uppercase tracking-tighter">Payment Matrix Scan</h5>
                <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Scan with GPay, PhonePe or any UPI app</p>
              </div>
              <div className="aspect-square bg-white rounded-3xl overflow-hidden flex items-center justify-center relative shadow-inner p-4">
                {seller.paymentInfo?.qrCodeUrl ? (
                  <img src={seller.paymentInfo.qrCodeUrl} alt="Store QR" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <AlertCircle className="w-12 h-12 text-red-500" />
                    <div className="text-neutral-900 font-black uppercase text-xs">QR LINK INVALID</div>
                  </div>
                )}
              </div>
              <button 
                onClick={() => setShowQR(false)}
                className="w-full h-16 bg-brand text-dark rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-[0_10px_30px_rgba(255,184,0,0.2)]"
              >
                Return to Terminal
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default CustomerView;
