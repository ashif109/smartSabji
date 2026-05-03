import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, doc, updateDoc, runTransaction } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingCart, MapPin, Clock, Search, Minus, Plus, CreditCard, Coins, X, Loader2, Navigation, Signal, Zap, Gift, Info, Leaf, Sprout, ShieldCheck, Play, AlertCircle, Star, List, Bell, User, CheckCircle2, UserX } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'market' | 'orders' | 'inbox' | 'profile'>('market');
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

  const [selectedSellerProfile, setSelectedSellerProfile] = useState<SellerProfile | null>(null);

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

  useEffect(() => {
    let watchId: number;
    if ('geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition((pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserCoords(coords);
        if (!selectedLocation) {
          setSelectedLocation({
            ...coords,
            address: `Live Radar Hub (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`
          });
        }
      }, (err) => console.error(err), { 
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000 
      });
    }
    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  const sortedSellers = useMemo(() => {
    return [...nearbySellers]
      .filter(seller => {
        if (!userCoords || !seller.currentLocation) return true; // Show all if location isn't available yet or seller has no location
        const distance = Number(calculateDistance(userCoords.lat, userCoords.lng, seller.currentLocation.lat, seller.currentLocation.lng));
        return distance <= 6;
      })
      .sort((a, b) => {
        const aTier = a.membershipPlan === 'premium' ? 2 : a.membershipPlan === 'enterprise' ? 3 : 1;
        const bTier = b.membershipPlan === 'premium' ? 2 : b.membershipPlan === 'enterprise' ? 3 : 1;
        if (bTier !== aTier) return bTier - aTier;
        
        if (userCoords && a.currentLocation && b.currentLocation) {
          const distA = Number(calculateDistance(userCoords.lat, userCoords.lng, a.currentLocation.lat, a.currentLocation.lng));
          const distB = Number(calculateDistance(userCoords.lat, userCoords.lng, b.currentLocation.lat, b.currentLocation.lng));
          return distA - distB;
        }
        return 0;
      });
  }, [nearbySellers, userCoords]);

  return (
    <div className="min-h-screen bg-[#F4F7F5] text-dark pb-24 overflow-x-hidden relative font-sans">
      {/* Top Header */}
      <div className="bg-white px-6 py-6 border-b border-gray-100 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center text-white">
            <Sprout className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-display font-black text-brand tracking-tighter uppercase leading-none">VegieRoute</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 bg-brand/10 px-3 py-1.5 rounded-full">
            <Zap className="w-3 h-3 text-brand fill-brand" />
            <span className="text-[10px] font-black text-brand tabular-nums">{user.superCoins || 0}</span>
          </div>
          <button 
            onClick={() => auth.signOut()}
            className="w-10 h-10 flex items-center justify-center bg-gray-50 border border-gray-100 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all shadow-sm"
            title="Sign Out"
          >
            <UserX className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setShowCart(true)} 
            className="w-10 h-10 flex items-center justify-center bg-gray-100 border border-gray-200 rounded-xl relative shadow-sm"
          >
            <ShoppingCart className="w-5 h-5 text-gray-400" />
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-brand text-white text-[8px] w-4 h-4 flex items-center justify-center rounded-full font-bold">
                {cart.reduce((a, b) => a + (b.quantity || 0), 0)}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 sm:p-6 mb-8">
        {activeTab === 'market' && (
          <div className="space-y-8">
            {/* Search & Location */}
            <div className="space-y-4">
              <div className="flex items-center justify-between text-[11px] font-bold text-gray-400 px-1">
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-brand" />
                  <span className="line-clamp-1 truncate max-w-[200px]">{selectedLocation?.address || "Locating..."}</span>
                </div>
                <button onClick={() => setShowMapPicker(true)} className="text-brand uppercase tracking-wider">Change</button>
              </div>
              <div className="relative">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-300 w-5 h-5" />
                <input 
                  type="text" 
                  placeholder="Search for retailers or products..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-gray-100 rounded-2xl px-14 py-4 text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all shadow-sm"
                />
              </div>
            </div>

            {/* Loyalty Banner - Enhanced Premium Design (Compact) */}
            <div className="relative overflow-hidden group">
              {/* Background Glows */}
              <div className="absolute -top-12 -left-12 w-48 h-48 bg-brand/10 rounded-full blur-[60px] animate-pulse" />
              <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-brand/5 rounded-full blur-[60px]" />
              
              <div className="relative bg-[#0A0F0B] rounded-[32px] p-6 sm:p-8 border border-white/10 shadow-2xl overflow-hidden">
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 p-4 opacity-[0.05] group-hover:opacity-[0.1] group-hover:scale-110 group-hover:rotate-6 transition-all duration-1000 pointer-events-none">
                  <Gift className="w-48 h-48 text-white rotate-12" />
                </div>
                
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                  <div className="space-y-6 flex-1">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-brand/10 rounded-md border border-brand/20">
                          <Zap className="w-2.5 h-2.5 text-brand fill-brand" />
                          <span className="text-brand text-[8px] font-black uppercase tracking-[0.2em]">Loyalty Node</span>
                        </div>
                        <span className="text-gray-500 text-[8px] font-black uppercase tracking-[0.2em]">Sector Rewards Active</span>
                      </div>
                      <h3 className="text-3xl sm:text-4xl font-display font-black text-white uppercase tracking-tighter leading-none">
                        Super <span className="text-brand">Coin</span> Reward
                      </h3>
                    </div>
                    
                    <p className="text-gray-400 text-[10px] font-medium max-w-sm leading-relaxed uppercase tracking-widest opacity-80">
                      Get a <span className="text-white font-black">FREE VEGETABLE</span> reward every weekend at the 100 coin threshold!
                    </p>

                    <div className="space-y-3 max-w-xs">
                      <div className="flex justify-between items-end px-0.5">
                        <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Progress</span>
                        <span className="text-xl font-black text-white tabular-nums tracking-tighter">
                          {superCoins}<span className="text-gray-600 text-xs ml-1">/ 100</span>
                        </span>
                      </div>
                      <div className="relative h-4 bg-white/5 rounded-full overflow-hidden border border-white/5 p-1">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(superCoins, 100)}%` }}
                          transition={{ duration: 1.5, ease: "circOut" }}
                          className="h-full bg-brand rounded-full relative overflow-hidden"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent w-full h-full animate-[shimmer_2s_infinite]" />
                        </motion.div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 min-w-[200px]">
                    <button 
                      onClick={() => {
                        if (canRedeem) {
                          claimWeekendReward();
                        } else {
                          // Scroll to search or retailers to "Earn More"
                          document.getElementById('nearby-retailers')?.scrollIntoView({ behavior: 'smooth' });
                        }
                      }}
                      disabled={claiming}
                      className={cn(
                        "relative group/btn overflow-hidden px-8 py-4 rounded-2xl font-black uppercase tracking-[0.2em] transition-all text-[10px]",
                        canRedeem 
                          ? "bg-brand text-white shadow-lg shadow-brand/20 hover:scale-[1.02] active:scale-98" 
                          : "bg-white text-dark hover:bg-gray-100 shadow-xl"
                      )}
                    >
                      <div className="absolute inset-0 bg-white/20 transform -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000" />
                      <span className="relative flex items-center justify-center gap-2">
                        {claiming ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : canRedeem ? (
                          <>
                            <Gift className="w-4 h-4 fill-white" />
                            Redeem Reward
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 fill-dark" />
                            Earn More Coins
                          </>
                        )}
                      </span>
                    </button>
                    
                    {!isWeekend && superCoins >= 100 ? (
                      <p className="text-[8px] font-black text-gray-500 text-center uppercase tracking-widest">
                        Unlocks this Weekend
                      </p>
                    ) : superCoins < 100 ? (
                      <p className="text-[8px] font-black text-brand/60 text-center uppercase tracking-widest">
                        {100 - superCoins} coins to protocol unlock
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            {/* Map Preview */}
            <div className="space-y-4" id="nearby-retailers">
              <div className="flex justify-between items-center px-1">
                <h3 className="text-lg font-black uppercase tracking-tighter">Nearby Retailers</h3>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{sortedSellers.length} ONLINE NOW</span>
              </div>
              <div className="premium-card h-48 sm:h-64 relative group">
                <MapContainer 
                  markers={[
                    ...(selectedLocation ? [{ 
                      id: 'me', 
                      ...selectedLocation, 
                      icon: 'green', 
                      label: 'ME',
                      description: selectedLocation.address
                    }] : []),
                    ...sortedSellers.filter(s => s.currentLocation).map(s => ({
                      id: s.id,
                      lat: s.currentLocation!.lat,
                      lng: s.currentLocation!.lng,
                      label: s.businessDetails?.shopName || s.fullName,
                      description: s.businessDetails?.bio || 'Active Retailer',
                      icon: 'brand',
                      logoUrl: s.businessDetails?.logoUrl
                    }))
                  ]}
                  zoom={14}
                  centerPos={userCoords || selectedLocation || undefined}
                />
                <button 
                  onClick={() => setShowMapPicker(true)}
                  className="absolute bottom-4 right-4 bg-white/90 backdrop-blur px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-gray-100 shadow-xl"
                >
                  Full Radar
                </button>
              </div>
            </div>

            {/* Vegetable Retailers */}
            <div className="space-y-4">
               <div className="flex justify-between items-center px-1">
                 <h3 className="text-lg font-black uppercase tracking-tighter">Vegetable Retailers</h3>
                 <button className="text-brand text-[10px] font-bold uppercase">See All</button>
               </div>
                 <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide px-1">
                 {sortedSellers.map(seller => (
                    <div 
                      key={seller.id} 
                      className={cn(
                        "min-w-[200px] premium-card p-4 space-y-3 cursor-pointer hover:border-brand/40 transition-all group relative",
                        seller.membershipPlan === 'premium' && "border-brand/30 bg-brand/5 shadow-brand/5",
                        seller.membershipPlan === 'enterprise' && "border-brand bg-brand shadow-brand/10"
                      )}
                      onClick={() => setSelectedSellerProfile(seller)}
                    >
                      {seller.membershipPlan && seller.membershipPlan !== 'standard' && (
                        <div className="absolute -top-2 -right-2 bg-brand text-white text-[7px] font-black px-2 py-1 rounded-lg shadow-xl shadow-brand/20 z-10 flex items-center gap-1 uppercase tracking-widest border border-white/20">
                          <Zap className="w-2 h-2 fill-white" />
                          {seller.membershipPlan}
                        </div>
                      )}
                      <div className="w-full aspect-video bg-gray-50 rounded-xl flex items-center justify-center border border-gray-100 overflow-hidden relative">
                         {seller.businessDetails?.logoUrl ? (
                           <img src={seller.businessDetails.logoUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform" alt="Store Logo" />
                         ) : (
                           <div className="flex flex-col items-center gap-1">
                             <Sprout className="w-8 h-8 text-brand/20" />
                             <span className="text-[7px] font-black text-gray-300 uppercase">No Logo</span>
                           </div>
                         )}
                         <div className="absolute top-2 right-2 bg-white/90 px-1.5 py-0.5 rounded-lg flex items-center gap-1">
                           <Star className="w-2.5 h-2.5 text-brand fill-brand" />
                           <span className="text-[9px] font-black">{seller.averageRating?.toFixed(1) || "5.0"}</span>
                         </div>
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-gray-800 line-clamp-1">{seller.businessDetails?.shopName || seller.fullName}</h4>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-[9px] font-bold text-gray-500 uppercase flex items-center gap-1">
                            <Clock className="w-2 h-2" />
                            {seller.businessDetails?.operatingHours || "Online"}
                            {seller.currentLocation?.updatedAt && (Date.now() - new Date(seller.currentLocation.updatedAt).getTime() < 30000) && (
                              <span className="flex items-center gap-1 ml-2">
                                <span className="w-1 h-1 bg-brand rounded-full animate-pulse" />
                                <span className="text-brand text-[7px] font-black">TRACKING LIVE</span>
                              </span>
                            )}
                          </p>
                          {userCoords && seller.currentLocation && (
                            <span className="text-[8px] font-black text-brand bg-brand/10 px-1.5 py-0.5 rounded-md">
                              {calculateDistance(userCoords.lat, userCoords.lng, seller.currentLocation.lat, seller.currentLocation.lng)}km
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                 ))}
                 {sortedSellers.length === 0 && (
                   <p className="text-gray-400 text-[10px] font-bold uppercase py-6 px-4">No active retailers found in your sector</p>
                 )}
               </div>
            </div>

            {/* Products Grid */}
            <div className="space-y-4">
               <div className="flex justify-between items-center px-1">
                 <h3 className="text-lg font-black uppercase tracking-tighter">Available Produce</h3>
                 <button className="text-brand text-[10px] font-bold uppercase">Filter</button>
               </div>
               <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 px-1">
                 {filteredVegetables.map(item => (
                   <div key={item.id} className="premium-card p-3 space-y-3 flex flex-col group">
                     {/* Asset Placeholder */}
                     <div className="w-full aspect-square bg-gray-50 rounded-2xl flex items-center justify-center text-5xl border border-gray-100 group-hover:scale-105 transition-transform">
                        {item.name === 'Tomato' && '🍅'}
                        {item.name === 'Potato' && '🥔'}
                        {item.name === 'Onion' && '🧅'}
                        {item.name === 'Spinach' && '🥬'}
                        {item.name === 'Carrot' && '🥕'}
                        {item.name === 'Cauliflower' && '🥦'}
                        {item.name === 'Cabbage' && '🥬'}
                        {item.name === 'Lady Finger' && '🥒'}
                     </div>
                     <div className="flex-1 space-y-1">
                       <h4 className="text-[13px] font-black text-gray-800 uppercase tracking-tighter leading-none">{item.name}</h4>
                       <p className="text-[10px] font-bold text-brand uppercase">₹{item.price}<span className="text-gray-400 font-medium ml-1">/ {item.unit}</span></p>
                     </div>
                     <button 
                       onClick={() => addToCart(item)}
                       className="w-full bg-gray-50 hover:bg-brand hover:text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                     >
                       Add to Bag
                     </button>
                   </div>
                 ))}
               </div>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="space-y-6">
            <h2 className="text-3xl font-black uppercase tracking-tighter px-1">Track Pipeline</h2>
            {myOrders.length === 0 ? (
              <div className="premium-card p-12 text-center space-y-6">
                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto">
                   <Clock className="w-10 h-10 text-gray-300" />
                </div>
                <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">No active orders found</p>
              </div>
            ) : (
              myOrders.map(order => (
                <div key={order.id} className="premium-card p-6 space-y-6">
                   <div className="flex justify-between items-start">
                     <div className="space-y-1">
                        <span className={cn(
                          "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border",
                          order.status === 'delivered' ? "bg-brand text-white border-brand shadow-md" : "bg-gray-100 text-gray-500 border-gray-200"
                        )}>
                          {order.status}
                        </span>
                        <p className="text-[10px] font-bold text-gray-400 uppercase mt-2">ID: {order.id.slice(-6).toUpperCase()}</p>
                     </div>
                     <span className="text-xl font-black tabular-nums">{formatCurrency(order.totalAmount)}</span>
                   </div>
                   <div className="bg-gray-50/50 rounded-2xl p-4 space-y-3">
                      <div className="flex justify-between text-[11px] font-bold">
                        <span className="text-gray-400 uppercase tracking-widest">Items</span>
                        <span className="text-gray-700">{order.items.map(i => `${i.name} (x${i.quantity})`).join(', ')}</span>
                      </div>
                      <div className="flex justify-between text-[11px] font-bold">
                        <span className="text-gray-400 uppercase tracking-widest">Drop Location</span>
                        <span className="text-gray-700 line-clamp-1">{order.location?.address}</span>
                      </div>
                   </div>
                   {order.sellerId && order.status === 'delivered' && !order.rating && (
                     <OrderRatingAction order={order} />
                   )}
                   {order.sellerId && <SellerInfoDisplay  sellerId={order.sellerId} status={order.status} orderLocation={order.location} orderId={order.id} />}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'inbox' && (
          <div className="space-y-6">
            <h2 className="text-3xl font-black uppercase tracking-tighter px-1">Alert Signals</h2>
            <div className="space-y-4">
              {myOrders.filter(o => o.status !== 'delivered').length > 0 ? (
                myOrders.filter(o => o.status !== 'delivered').map(order => (
                  <div key={`alert-${order.id}`} className="premium-card p-6 border-l-4 border-brand flex items-center gap-4">
                    <div className="w-12 h-12 bg-brand/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <Bell className="w-6 h-6 text-brand" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-black text-brand uppercase tracking-widest mb-1">Order Update</p>
                      <h4 className="text-sm font-black text-gray-800 uppercase tracking-tight">
                        Order #{order.id.slice(-6).toUpperCase()} is currently <span className="text-brand">{order.status}</span>
                      </h4>
                      <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase">Track in orders for real-time ETA</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="premium-card p-12 text-center space-y-6">
                  <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto">
                    <Signal className="w-10 h-10 text-gray-200" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-gray-800 font-black uppercase tracking-tight">Quiet Sector</p>
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">No active signals or alerts found</p>
                  </div>
                </div>
              )}
              
              {/* System Alert Placeholder */}
              <div className="premium-card p-6 border-l-4 border-blue-500 bg-blue-50/30 flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <Info className="w-6 h-6 text-blue-500" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">System Notice</p>
                  <h4 className="text-sm font-black text-gray-800 uppercase tracking-tight">Market Protocol v1.4 Active</h4>
                  <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase">Enhanced real-time tracking enabled in your sector.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="space-y-8">
            <h2 className="text-3xl font-black uppercase tracking-tighter px-1">Control Hub</h2>
            
            <div className="premium-card p-8 bg-white flex flex-col items-center gap-6">
              <div className="w-24 h-24 bg-brand/10 rounded-[32px] flex items-center justify-center relative">
                <User className="w-12 h-12 text-brand" />
                <div className="absolute -bottom-2 -right-2 bg-brand text-white p-2 rounded-xl shadow-lg">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="text-center space-y-1">
                <h3 className="text-2xl font-black uppercase tracking-tighter text-gray-800">{user.fullName}</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">{user.email}</p>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <span className="bg-brand/10 text-brand px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">Verified Buyer</span>
                  <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">Sector A-12</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="premium-card p-6 flex flex-col gap-4 bg-brand group hover:scale-[1.02] transition-transform cursor-pointer">
                <Zap className="w-8 h-8 text-white fill-white" />
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-white/60 uppercase tracking-widest">Super Coins</p>
                  <p className="text-3xl font-black text-white tabular-nums">{user.superCoins || 0}</p>
                </div>
              </div>
              <div className="premium-card p-6 flex flex-col gap-4 bg-gray-800 group hover:scale-[1.02] transition-transform cursor-pointer">
                <ShoppingCart className="w-8 h-8 text-white" />
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-white/60 uppercase tracking-widest">Total Orders</p>
                  <p className="text-3xl font-black text-white tabular-nums">{myOrders.length}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
               <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Settings & Security</p>
               <div className="premium-card overflow-hidden bg-white border border-gray-100">
                  <button className="w-full p-5 flex items-center justify-between hover:bg-gray-50 transition-colors border-b border-gray-50">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400"><MapPin className="w-5 h-5" /></div>
                      <span className="text-[11px] font-black uppercase tracking-widest text-gray-700">Saved Logistics Points</span>
                    </div>
                  </button>
                  <button className="w-full p-5 flex items-center justify-between hover:bg-gray-50 transition-colors border-b border-gray-50">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400"><CreditCard className="w-5 h-5" /></div>
                      <span className="text-[11px] font-black uppercase tracking-widest text-gray-700">Payment Methods</span>
                    </div>
                  </button>
                  <button className="w-full p-5 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400"><ShieldCheck className="w-5 h-5" /></div>
                      <span className="text-[11px] font-black uppercase tracking-widest text-gray-700">Privacy Protocols</span>
                    </div>
                  </button>
               </div>
            </div>

            <button 
              onClick={() => auth.signOut()}
              className="w-full py-5 bg-red-50 text-red-500 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 border border-red-100 hover:bg-red-100 transition-all"
            >
              <UserX className="w-5 h-5" />
              Terminate Session
            </button>
          </div>
        )}

      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-[100] px-6 pb-6 pointer-events-none">
        <div className="max-w-md mx-auto h-[72px] bg-white border border-gray-100 rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.1)] flex items-center justify-around pointer-events-auto overflow-hidden relative px-4">
           {[
             { id: 'market', icon: Sprout, label: 'Market' },
             { id: 'orders', icon: List, label: 'Orders' },
             { id: 'inbox', icon: Bell, label: 'Alerts' },
             { id: 'profile', icon: User, label: 'Hub' }
           ].map((tab) => {
             const Icon = tab.icon;
             return (
               <button 
                 key={tab.id}
                 onClick={() => setActiveTab(tab.id as any)}
                 className={cn(
                   "flex flex-col items-center justify-center gap-1 transition-all group",
                   activeTab === tab.id ? "text-brand" : "text-gray-300 hover:text-gray-500"
                 )}
               >
                 <Icon className={cn("w-5 h-5 transition-transform group-active:scale-90", activeTab === tab.id ? "fill-brand/10" : "")} />
                 <span className="text-[8px] font-black uppercase tracking-widest">{tab.label}</span>
                 {activeTab === tab.id && <motion.div layoutId="nav-pill" className="absolute -bottom-1 w-6 h-1 bg-brand rounded-full" />}
               </button>
             );
           })}
        </div>
      </div>

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
                    <button 
                      onClick={(e) => { e.stopPropagation(); setShowCart(false); }} 
                      className="w-10 h-10 sm:w-14 sm:h-14 flex items-center justify-center bg-gray-100 rounded-full hover:bg-brand hover:text-white transition-all z-50 pointer-events-auto"
                    >
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
                  <div className="p-6 sm:p-12 pt-6 sm:pt-8 bg-white border-t border-gray-100 space-y-6 sm:space-y-10 mb-[env(safe-area-inset-bottom)]">
                    <div className="flex justify-between items-end">
                      <div className="space-y-1">
                        <p className="text-gray-400 font-black uppercase tracking-[0.2em] text-[8px] sm:text-[10px] leading-none">Order Total</p>
                        <p className="text-brand font-bold text-[10px] sm:text-sm uppercase leading-none mt-1 sm:mt-2">Safe P2P Payment</p>
                      </div>
                      <span className="text-3xl sm:text-6xl font-black tracking-tighter tabular-nums leading-none text-gray-800">{formatCurrency(totalAmount)}</span>
                    </div>
                    <button 
                      onClick={placeOrder}
                      disabled={loading}
                      className="w-full bg-brand text-white py-5 sm:py-7 rounded-[24px] flex items-center justify-center gap-3 sm:gap-4 text-sm sm:text-base font-black uppercase tracking-widest shadow-xl shadow-brand/20 hover:bg-brand/90 transition-all disabled:opacity-50"
                    >
                      {loading && <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />}
                      {loading ? "Processing..." : "Confirm Order"}
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
                <div className="p-6 sm:p-10 border-b border-gray-100 flex justify-between items-center bg-white">
                  <div className="space-y-1">
                    <h3 className="text-2xl sm:text-3xl font-black tracking-tighter uppercase leading-none">Drop-off Point</h3>
                     <p className="text-[8px] sm:text-[10px] font-black uppercase text-gray-400 tracking-widest leading-none mt-1 sm:mt-2">Pinpoint your exact location</p>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setShowMapPicker(false); }} 
                    className="w-10 h-10 sm:w-14 sm:h-14 flex items-center justify-center bg-gray-50 border border-gray-100 rounded-full z-50 hover:bg-gray-100 transition-all pointer-events-auto"
                  >
                    <X className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                </div>
                <div className="flex-1 relative bg-gray-50 overflow-hidden">
                  <MapContainer 
                    onMapClick={(lat, lng) => setSelectedLocation({ lat, lng, address: `Sector Coordinate (${lat.toFixed(4)}, ${lng.toFixed(4)})` })}
                    markers={[
                      ...(selectedLocation ? [{ 
                        id: 'selected', 
                        ...selectedLocation, 
                        icon: 'green', 
                        label: 'MY DROP POINT',
                        description: 'Vegetable drop location'
                      }] : []),
                      ...sortedSellers.filter(s => s.currentLocation).map(s => ({
                      id: s.id,
                      lat: s.currentLocation!.lat,
                      lng: s.currentLocation!.lng,
                      label: s.businessDetails?.shopName || s.fullName,
                      description: s.businessDetails?.bio || 'Active Retailer',
                      icon: 'brand',
                      logoUrl: s.businessDetails?.logoUrl
                    }))
                  ]}
                    zoom={15}
                  />
                </div>
                <div className="p-6 sm:p-12 bg-white flex flex-col md:flex-row items-center gap-6 sm:gap-10 pb-8 sm:pb-12 border-t border-gray-100">
                  <div className="flex-1 space-y-1 sm:space-y-2 text-center md:text-left">
                    <p className="text-[8px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Confirmed Location</p>
                    <p className="text-xl sm:text-3xl font-black tracking-tight text-gray-800 line-clamp-1 leading-none mt-1 sm:mt-2 uppercase">
                      {selectedLocation?.address || "Please select a point..."}
                    </p>
                  </div>
                  <button 
                    disabled={!selectedLocation}
                    onClick={() => setShowMapPicker(false)}
                    className="w-full md:w-auto bg-brand text-white px-10 py-5 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-brand/20 hover:scale-105 active:scale-95 transition-all"
                  >
                    Confirm Location
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
                className="relative w-full max-w-lg bg-white border border-gray-100 rounded-[48px] p-8 sm:p-12 text-center shadow-2xl overflow-hidden"
              >
                 <div className="absolute top-0 inset-x-0 h-1 bg-brand" />
                 <Gift className="w-16 h-16 sm:w-24 sm:h-24 text-brand mx-auto mb-8 animate-bounce" />
                 <h2 className="text-4xl sm:text-6xl font-black uppercase tracking-tighter mb-4 text-brand">Success!</h2>
                 <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] sm:text-xs mb-10">Delivery complete. Scratch to see your coins!</p>
                 <div className="relative aspect-video w-full bg-gray-50 rounded-[32px] border border-gray-100 overflow-hidden mb-10 group cursor-crosshair">
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                       <p className="text-[10px] font-black text-brand uppercase tracking-[0.3em] mb-2 leading-none">Bonus Reward</p>
                       <p className="text-7xl font-black text-gray-800 leading-none tracking-tighter">+{scratchReward.rewardAmount}</p>
                       <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-2">Coins Earned</p>
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
                      className="absolute inset-0 bg-gray-200 flex flex-col items-center justify-center p-8 select-none z-10"
                    >
                       <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-4">
                          <Zap className="w-6 h-6 text-brand" />
                       </div>
                       <p className="text-gray-400 font-black uppercase tracking-[0.2em] text-[10px]">Scratch here</p>
                    </motion.div>
                 </div>
                 <button 
                   onClick={handleScratch}
                   disabled={scratchProgress < 500 || claiming}
                   className={cn(
                     "w-full py-6 rounded-2xl font-black uppercase tracking-widest text-xs transition-all",
                     scratchProgress > 500 
                       ? "bg-brand text-white shadow-xl shadow-brand/20 hover:scale-105" 
                       : "bg-gray-50 text-gray-400 border border-gray-100 cursor-not-allowed"
                   )}
                 >
                   {claiming ? "Processing..." : scratchProgress > 500 ? "Claim My Coins" : "Keep Scratching..."}
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

        <AnimatePresence>
          {selectedSellerProfile && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
               <motion.div 
                 initial={{ opacity: 0 }} 
                 animate={{ opacity: 1 }} 
                 exit={{ opacity: 0 }}
                 onClick={() => setSelectedSellerProfile(null)}
                 className="absolute inset-0 bg-dark/95 backdrop-blur-2xl"
               />
               <motion.div 
                 initial={{ scale: 0.9, y: 30, opacity: 0 }}
                 animate={{ scale: 1, y: 0, opacity: 1 }}
                 exit={{ scale: 0.9, y: 30, opacity: 0 }}
                 className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white border border-gray-100 rounded-[40px] shadow-2xl flex flex-col scrollbar-hide"
               >
                  {/* Profile Header */}
                  <div className="relative h-48 sm:h-64 bg-gray-100">
                    {selectedSellerProfile.businessDetails?.logoUrl ? (
                      <img src={selectedSellerProfile.businessDetails.logoUrl} className="w-full h-full object-cover" alt="Shop Banner" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                         <Sprout className="w-16 h-16 text-brand/20" />
                      </div>
                    )}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSellerProfile(null);
                      }}
                      className="absolute top-6 right-6 z-50 w-12 h-12 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow-lg hover:bg-white active:scale-90 transition-all pointer-events-auto"
                    >
                      <X className="w-6 h-6 text-gray-600" />
                    </button>
                    <div className="absolute -bottom-10 left-8 sm:left-12 flex items-end gap-5">
                      <div className="w-24 h-24 sm:w-32 sm:h-32 bg-white rounded-3xl p-1 shadow-2xl">
                        <div className="w-full h-full bg-gray-50 rounded-2xl flex items-center justify-center overflow-hidden border border-gray-100">
                          {selectedSellerProfile.businessDetails?.logoUrl ? (
                            <img src={selectedSellerProfile.businessDetails.logoUrl} className="w-full h-full object-cover" alt="Logo" />
                          ) : (
                            <User className="w-10 h-10 text-gray-200" />
                          )}
                        </div>
                      </div>
                      <div className="mb-4 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="bg-brand text-white px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-md">Verified Merchant</span>
                          <div className="flex items-center gap-1 bg-white/90 backdrop-blur px-2 py-1 rounded-full border border-gray-100 font-black text-[10px] text-gray-700 shadow-sm">
                            <Star className="w-3 h-3 text-brand fill-brand" />
                            {selectedSellerProfile.averageRating?.toFixed(1) || "5.0"}
                          </div>
                        </div>
                        <h3 className="text-2xl sm:text-4xl font-black text-gray-800 uppercase tracking-tighter leading-none shadow-white drop-shadow-lg">
                          {selectedSellerProfile.businessDetails?.shopName || selectedSellerProfile.fullName}
                        </h3>
                      </div>
                    </div>
                  </div>

                  {/* Profile Content */}
                  <div className="p-8 sm:p-12 pt-16 sm:pt-20 space-y-10">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Business Bio</p>
                          <p className="text-sm font-medium text-gray-600 leading-relaxed uppercase tracking-wider">
                            {selectedSellerProfile.businessDetails?.bio || "A trusted provider of fresh, organic produce direct from the farm to your sector."}
                          </p>
                        </div>
                        <div className="space-y-6">
                          <div className="space-y-2">
                             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Operating Hours</p>
                             <div className="flex items-center gap-3 text-sm font-black text-gray-800 uppercase tracking-tighter">
                                <Clock className="w-5 h-5 text-brand" />
                                {selectedSellerProfile.businessDetails?.operatingHours || "6:00 AM - 11:30 AM Daily"}
                             </div>
                          </div>
                          <div className="space-y-2">
                             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Base Address</p>
                             <div className="flex items-center gap-3 text-sm font-black text-gray-800 uppercase tracking-tighter">
                                <MapPin className="w-5 h-5 text-brand" />
                                {selectedSellerProfile.businessDetails?.address || "Global Market Sector"}
                             </div>
                          </div>
                        </div>
                     </div>

                     {/* Reviews Section */}
                     <div className="space-y-6">
                        <div className="flex justify-between items-center px-1">
                          <h4 className="text-xl font-black uppercase tracking-tighter">Client Reviews</h4>
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                            {selectedSellerProfile.totalRatings || 0} TOTAL RATINGS
                          </span>
                        </div>

                        <div className="space-y-4">
                           {(selectedSellerProfile.reviews || []).length > 0 ? (
                             selectedSellerProfile.reviews?.map((review) => (
                               <div key={review.id} className="bg-gray-50 rounded-2xl p-6 border border-gray-100 flex gap-4">
                                 <div className="w-10 h-10 bg-brand/10 rounded-full flex items-center justify-center flex-shrink-0">
                                    <User className="w-5 h-5 text-brand" />
                                 </div>
                                 <div className="space-y-1">
                                    <div className="flex items-center gap-3">
                                      <span className="text-[11px] font-black text-gray-800 uppercase">{review.customerName}</span>
                                      <div className="flex gap-0.5">
                                        {[1, 2, 3, 4, 5].map(s => (
                                          <Star key={s} className={cn("w-2.5 h-2.5", s <= review.rating ? "text-brand fill-brand" : "text-gray-200")} />
                                        ))}
                                      </div>
                                    </div>
                                    <p className="text-xs font-medium text-gray-500">{review.comment}</p>
                                    <p className="text-[8px] font-bold text-gray-300 uppercase mt-1">{new Date(review.createdAt).toLocaleDateString()}</p>
                                 </div>
                               </div>
                             ))
                           ) : (
                             <div className="bg-gray-50 border-2 border-dashed border-gray-100 rounded-3xl p-12 text-center">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">No detailed reviews yet</p>
                                <p className="text-[9px] font-bold text-gray-300 uppercase mt-1">Based on {selectedSellerProfile.totalRatings || 0} total ratings</p>
                             </div>
                           )}
                        </div>
                     </div>

                     <button 
                       onClick={() => setSelectedSellerProfile(null)}
                       className="w-full py-5 bg-brand text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-xl shadow-brand/20 hover:bg-brand/90 transition-all mb-4"
                     >
                       Back to Marketplace
                     </button>
                  </div>
               </motion.div>
            </div>
          )}
        </AnimatePresence>
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
          <div className="flex-1 space-y-1 sm:space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-brand rounded-full animate-pulse" />
              <p className="text-[8px] sm:text-[10px] font-black text-brand uppercase tracking-widest leading-none">Verified Merchant Hub</p>
            </div>
            <div className="flex items-start gap-4">
              {seller.businessDetails?.logoUrl && (
                <div className="w-12 h-12 bg-gray-50 rounded-xl overflow-hidden border border-gray-100 flex-shrink-0">
                  <img src={seller.businessDetails.logoUrl} className="w-full h-full object-cover" alt="Logo" />
                </div>
              )}
              <div className="space-y-1">
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
                {seller.businessDetails?.bio && (
                  <p className="text-[9px] font-medium text-neutral-400 line-clamp-2 max-w-sm uppercase tracking-wider">{seller.businessDetails.bio}</p>
                )}
                {seller.businessDetails?.operatingHours && (
                  <div className="flex items-center gap-2 text-[8px] font-black text-brand uppercase tracking-widest mt-1">
                    <Clock className="w-2.5 h-2.5" />
                    Hours: {seller.businessDetails.operatingHours}
                  </div>
                )}
              </div>
            </div>
            
        {status !== 'delivered' && etaInfo && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mt-3">
              <div className="bg-brand/10 border border-brand/20 px-3 py-1.5 rounded-xl flex items-center gap-2">
                <Clock className="w-3 h-3 text-brand" />
                <span className="text-[10px] font-black text-brand uppercase tracking-widest tabular-nums">ETA {etaInfo.minutes} MINS</span>
              </div>
              <p className="text-[8px] font-bold text-neutral-500 uppercase tracking-widest">
                {etaInfo.stops > 0 ? `${etaInfo.stops} STOPS AWAY` : 'NEXT ARRIVAL'}
              </p>
            </div>
            
            {/* Live Tracking Map */}
            {seller.currentLocation && (
              <div className="h-48 rounded-3xl overflow-hidden border border-line shadow-inner relative group/map">
                <MapContainer 
                  centerPos={{ lat: seller.currentLocation.lat, lng: seller.currentLocation.lng }}
                  zoom={15}
                  markers={[
                    {
                      id: 'seller',
                      lat: seller.currentLocation.lat,
                      lng: seller.currentLocation.lng,
                      label: 'COURIER',
                      icon: 'brand'
                    },
                    {
                      id: 'destination',
                      lat: orderLocation.lat,
                      lng: orderLocation.lng,
                      label: 'DROP POINT',
                      icon: 'green'
                    }
                  ]}
                />
                <div className="absolute top-4 left-4 right-4 flex justify-between pointer-events-none">
                  <div className="bg-white/90 backdrop-blur px-2.5 py-1.5 rounded-lg border border-gray-100 shadow-sm flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-brand rounded-full animate-pulse" />
                    <span className="text-[8px] font-black text-brand uppercase tracking-widest">Live Signal Active</span>
                  </div>
                </div>
              </div>
            )}
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
                <div className="bg-gray-50 border border-gray-100 p-4 rounded-2xl flex items-center justify-between group/pay">
                  <div>
                    <p className="text-[7px] font-black text-gray-400 uppercase mb-1">UPI ID</p>
                    <p className="text-xs sm:text-sm font-black text-brand tabular-nums select-all tracking-tight">{seller.paymentInfo.upiId}</p>
                  </div>
                  <button className="w-8 h-8 flex items-center justify-center bg-brand/5 rounded-lg opacity-0 group-hover/pay:opacity-100 transition-opacity">
                    <CheckCircle2 className="w-4 h-4 text-brand" />
                  </button>
                </div>
              )}
              {seller.paymentInfo.phoneNumber && (
                <div className="bg-gray-50 border border-gray-100 p-4 rounded-2xl flex items-center justify-between group/pay">
                  <div>
                    <p className="text-[7px] font-black text-gray-400 uppercase mb-1">Phone Number</p>
                    <p className="text-xs sm:text-sm font-black text-gray-800 tabular-nums select-all tracking-tight">{seller.paymentInfo.phoneNumber}</p>
                  </div>
                  <button className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded-lg opacity-0 group-hover/pay:opacity-100 transition-opacity">
                    <CheckCircle2 className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl">
              <p className="text-[8px] font-bold text-gray-400 uppercase leading-relaxed tracking-wider">
                <span className="text-brand font-black">IMPORTANT:</span> Always check your vegetables before paying. Peer-to-peer payments are non-refundable.
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
            className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-white/95 backdrop-blur-3xl"
          >
            <div className="max-w-sm w-full bg-white border border-gray-100 rounded-[40px] p-8 text-center space-y-6 shadow-2xl relative">
              <button 
                onClick={(e) => { e.stopPropagation(); setShowQR(false); }}
                className="absolute top-8 right-8 text-gray-400 hover:text-brand transition-colors z-50 p-2 pointer-events-auto"
              >
                <X className="w-6 h-6" />
              </button>
              <div className="space-y-2">
                <h5 className="text-2xl font-black uppercase tracking-tighter text-brand">Payment Scan</h5>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Scan with GPay, PhonePe or any UPI app</p>
              </div>
              <div className="aspect-square bg-gray-50 rounded-[32px] overflow-hidden flex items-center justify-center relative shadow-inner p-6 border border-gray-100">
                {seller.paymentInfo?.qrCodeUrl ? (
                  <img src={seller.paymentInfo.qrCodeUrl} alt="Store QR" className="w-full h-full object-contain mix-blend-multiply" referrerPolicy="no-referrer" />
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <AlertCircle className="w-12 h-12 text-red-500" />
                    <div className="text-gray-400 font-black uppercase text-xs">QR NOT FOUND</div>
                  </div>
                )}
              </div>
              <button 
                onClick={() => setShowQR(false)}
                className="w-full h-16 bg-brand text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-brand/20 hover:bg-brand/90 transition-all"
              >
                Close QR Code
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default CustomerView;
