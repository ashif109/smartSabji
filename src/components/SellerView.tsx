import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, runTransaction } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { TrendingUp, Map, CheckCircle, Navigation, DollarSign, Package, Users, ShieldCheck, AlertCircle, Play, MoreVertical, Signal, MapPin, Activity, Clock, Loader2, Leaf, Sprout, Upload, X, Star, UserX } from 'lucide-react';
import { Order, SellerProfile } from '../types';
import MapContainer from './MapContainer';
import { cn, formatCurrency, handleFirestoreError, OperationType } from '../lib/utils';

interface SellerViewProps {
  seller: SellerProfile;
}

const SellerView: React.FC<SellerViewProps> = ({ seller }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'map' | 'drive'>('dashboard');
  const [optimizedRoute, setOptimizedRoute] = useState<Order[]>([]);
  const [isTrialActive, setIsTrialActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) { // 1MB limit for Base64 in Firestore (general safety)
        setErrors(prev => ({ ...prev, qrCodeUrl: "Image must be under 1MB" }));
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setOnboardingData(prev => ({ ...prev, qrCodeUrl: reader.result as string }));
        setErrors(prev => { const n = {...prev}; delete n.qrCodeUrl; return n; });
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    // We need to fetch both pending orders and orders assigned to this seller
    const qPending = query(collection(db, 'orders'), where('status', '==', 'pending'));
    const qAssigned = query(collection(db, 'orders'), where('sellerId', '==', seller.id));

    const unsubPending = onSnapshot(qPending, (snap) => {
      const pendingData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setOrders(prev => {
        const otherThanPending = prev.filter(o => o.status !== 'pending');
        return [...otherThanPending, ...pendingData].filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
      });
    }, (error) => {
      if (error.code === 'permission-denied') {
        console.warn("Pending payload stream encrypted/locked.");
      } else {
        handleFirestoreError(error, OperationType.LIST, 'orders/pending', auth);
      }
    });

    const unsubAssigned = onSnapshot(qAssigned, (snap) => {
      const assignedData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setOrders(prev => {
        const otherThanAssigned = prev.filter(o => o.sellerId !== seller.id);
        return [...otherThanAssigned, ...assignedData].filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
      });
    }, (error) => {
      if (error.code === 'permission-denied') {
        console.warn("Assigned logistics stream encrypted/locked.");
      } else {
        handleFirestoreError(error, OperationType.LIST, 'orders/assigned', auth);
      }
    });

    let watchId: number;
    let heartbeatInterval: number;

    if (seller.isOnline) {
      const performUpdate = (lat: number, lng: number) => {
        // Debounce: Only update if moved significantly or enough time passed
        const lastLat = (window as any)._lastLat || 0;
        const lastLng = (window as any)._lastLng || 0;
        const lastUpdateTime = (window as any)._lastLocationUpdate || 0;
        
        const distMoved = getDistance(lat, lng, lastLat, lastLng);
        const now = Date.now();

        if (distMoved < 0.01 && (now - lastUpdateTime < 60000)) {
          return; // Skip if less than 10m and less than 1 min
        }

        updateDoc(doc(db, 'users', seller.id), {
          currentLocation: {
            lat,
            lng,
            updatedAt: new Date().toISOString()
          }
        }).then(() => {
          (window as any)._lastLat = lat;
          (window as any)._lastLng = lng;
          (window as any)._lastLocationUpdate = Date.now();
        }).catch(err => {
          if (err.code !== 'permission-denied') {
            console.error("Location sync interrupted", err);
          }
        });
      };

      if ('geolocation' in navigator) {
        watchId = navigator.geolocation.watchPosition((pos) => {
          const { latitude: lat, longitude: lng } = pos.coords;
          const lastUpdate = (window as any)._lastLocationUpdate || 0;
          const now = Date.now();
          
          if (now - lastUpdate > 2000) {
            performUpdate(lat, lng);
          }
        }, (err) => {
          if (err.code === 1) console.warn("Location transmission blocked.");
        }, {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        });

        // Heartbeat every 30 seconds if stationary to maintain "Live" status
        heartbeatInterval = window.setInterval(() => {
          navigator.geolocation.getCurrentPosition((pos) => {
            performUpdate(pos.coords.latitude, pos.coords.longitude);
          }, undefined, { enableHighAccuracy: true });
        }, 30000);
      }
    }

    return () => {
      unsubPending();
      unsubAssigned();
      if (watchId) navigator.geolocation.clearWatch(watchId);
      if (heartbeatInterval) clearInterval(heartbeatInterval);
    };
  }, [seller.isOnline, seller.id]);

  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      if (!seller.currentLocation || order.sellerId === seller.id) return true; // Keep orders already assigned to this seller
      const dist = getDistance(seller.currentLocation.lat, seller.currentLocation.lng, order.location.lat, order.location.lng);
      return dist <= 6;
    });
  }, [orders, seller.currentLocation, seller.id]);

  const getOptimizedRoute = useMemo(() => {
    const activeOrders = filteredOrders.filter(o => o.status === 'accepted' || o.status === 'ongoing');
    const pendingOrders = filteredOrders.filter(o => o.status === 'pending');
    
    const targets = [...activeOrders, ...pendingOrders];
    if (targets.length === 0) return [];
    
    let currentPos = seller.currentLocation || { lat: 28.6139, lng: 77.2090 };
    const remaining = [...targets];
    const optimized: (Order)[] = [];
    
    const now = Date.now();

    while (remaining.length > 0) {
      let nextBestIdx = 0;
      let maxScore = -Infinity; // Higher is better
      
      for (let i = 0; i < remaining.length; i++) {
        const target = remaining[i];
        const dist = getDistance(currentPos.lat, currentPos.lng, target.location.lat, target.location.lng);
        
        // Timing weight: Older orders get priority
        const ageInMs = target.createdAt ? (now - new Date(target.createdAt).getTime()) : 0;
        const ageWeight = (ageInMs / 60000) * 0.1; // +0.1 score per minute old

        // Density weight: How many other targets are near this one?
        const neighbors = remaining.filter((other, idx) => {
          if (idx === i) return false;
          return getDistance(target.location.lat, target.location.lng, other.location.lat, other.location.lng) < 0.5; // within 500m
        });
        const densityWeight = neighbors.length * 0.5; // +0.5 score per neighbor

        // Status weight: Active deliveries should probably be prioritized if they are close
        const statusWeight = (target.status === 'accepted' || target.status === 'ongoing') ? 1.0 : 0;

        // Score: Inverting distance (closer is better) + weights
        // Scale distance to a comparable range. dist in km. 1km = -2 points roughly.
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
    
    return optimized;
  }, [orders, seller.currentLocation]);

  const mapPath = useMemo((): Array<[number, number]> => {
    if (!seller.currentLocation) return [];
    // Start at current location
    const path: Array<[number, number]> = [[seller.currentLocation.lat, seller.currentLocation.lng]];
    
    // Add optimized waypoints
    getOptimizedRoute.forEach(o => {
      path.push([o.location.lat, o.location.lng]);
    });
    
    return path;
  }, [seller.currentLocation, getOptimizedRoute]);

  const acceptOrder = async (orderId: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: 'accepted',
        sellerId: seller.id || auth.currentUser?.uid,
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `orders/${orderId}`, auth);
    }
  };

  const startDeparture = async (orderId: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: 'ongoing',
        departureTime: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `orders/${orderId}`, auth);
    }
  };

  const completeOrder = async (orderId: string, _amount: number) => {
    try {
      await runTransaction(db, async (transaction) => {
        const orderRef = doc(db, 'orders', orderId);
        
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists()) throw new Error("Order not found");
        
        const customerId = orderSnap.data().customerId;
        const customerRef = doc(db, 'users', customerId);
        
        // Skip fetching sellerRef in transaction to avoid write-write conflicts with location updates
        // The security rules will still verify the seller's role via get() but it's more stable
        const customerSnap = await transaction.get(customerRef);

        const earnedSuperCoins = Math.floor(Math.random() * 3) + 5; 

        transaction.update(orderRef, { 
          status: 'delivered',
          rewardAvailable: true,
          rewardAmount: earnedSuperCoins,
          updatedAt: new Date().toISOString()
        });
        
        transaction.update(customerRef, {
          superCoins: (customerSnap.data()?.superCoins || 0) + earnedSuperCoins
        });
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `orders/${orderId}`, auth);
    }
  };

  const [showOnboarding, setShowOnboarding] = useState(!seller.onboardingComplete);
  const [onboardingData, setOnboardingData] = useState({
    shopName: seller.businessDetails?.shopName || '',
    address: seller.businessDetails?.address || '',
    upiId: seller.paymentInfo?.upiId || '',
    phoneNumber: seller.paymentInfo?.phoneNumber || '',
    qrCodeUrl: seller.paymentInfo?.qrCodeUrl || '',
    operatingHours: seller.businessDetails?.operatingHours || '',
    bio: seller.businessDetails?.bio || '',
    logoUrl: seller.businessDetails?.logoUrl || '',
    membershipPlan: seller.membershipPlan || 'standard',
  });

  useEffect(() => {
    if (showOnboarding) {
      setOnboardingData({
        shopName: seller.businessDetails?.shopName || '',
        address: seller.businessDetails?.address || '',
        upiId: seller.paymentInfo?.upiId || '',
        phoneNumber: seller.paymentInfo?.phoneNumber || '',
        qrCodeUrl: seller.paymentInfo?.qrCodeUrl || '',
        operatingHours: seller.businessDetails?.operatingHours || '',
        bio: seller.businessDetails?.bio || '',
        logoUrl: seller.businessDetails?.logoUrl || '',
        membershipPlan: seller.membershipPlan || 'standard',
      });
    }
  }, [showOnboarding, seller.businessDetails, seller.paymentInfo, seller.membershipPlan]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500 * 1024) { // 500KB limit for logo
        setErrors(prev => ({ ...prev, logoUrl: "Logo must be under 500KB" }));
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setOnboardingData(prev => ({ ...prev, logoUrl: reader.result as string }));
        setErrors(prev => { const n = {...prev}; delete n.logoUrl; return n; });
      };
      reader.readAsDataURL(file);
    }
  };

  const completeOnboarding = async () => {
    const newErrors: Record<string, string> = {};
    if (!onboardingData.shopName.trim()) newErrors.shopName = "Shop Name is Required";
    if (!onboardingData.upiId.trim()) newErrors.upiId = "UPI ID is Required";
    if (!onboardingData.address.trim()) newErrors.address = "Address is Required";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', seller.id), {
        onboardingComplete: true,
        membershipPlan: onboardingData.membershipPlan,
        businessDetails: {
          shopName: onboardingData.shopName,
          address: onboardingData.address,
          operatingHours: onboardingData.operatingHours,
          bio: onboardingData.bio,
          logoUrl: onboardingData.logoUrl,
        },
        paymentInfo: {
          upiId: onboardingData.upiId,
          phoneNumber: onboardingData.phoneNumber,
          qrCodeUrl: onboardingData.qrCodeUrl || null,
        }
      });
      setShowOnboarding(false);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${seller.id}`, auth);
    } finally {
      setLoading(false);
    }
  };

  const getHeatmapPoints = useMemo(() => {
    return filteredOrders.filter(o => o.status === 'pending').map(o => ({ 
      lat: o.location.lat, 
      lng: o.location.lng, 
      weight: 1.5 // Increased sensitivity
    }));
  }, [filteredOrders]);

  const highDemandZones = useMemo(() => {
    const pending = filteredOrders.filter(o => o.status === 'pending');
    const zones: Array<{ lat: number, lng: number, count: number }> = [];
    
    pending.forEach(o => {
      const existingZone = zones.find(z => getDistance(z.lat, z.lng, o.location.lat, o.location.lng) < 0.3); // 300m radius
      if (existingZone) {
        existingZone.count++;
      } else {
        zones.push({ lat: o.location.lat, lng: o.location.lng, count: 1 });
      }
    });

    return zones.filter(z => z.count >= 2); // Only zones with 2+ orders are "Red"
  }, [orders]);

  const totalEarnings = useMemo(() => {
    return orders.filter(o => o.status === 'delivered').reduce((acc, o) => acc + o.totalAmount, 0);
  }, [orders]);

  const handleOptimize = async () => {
    setActiveTab('map');
  };

  const totalPathDistance = useMemo(() => {
    let dist = 0;
    for (let i = 0; i < mapPath.length - 1; i++) {
      dist += getDistance(mapPath[i][0], mapPath[i][1], mapPath[i+1][0], mapPath[i+1][1]);
    }
    return dist;
  }, [mapPath]);

  return (
    <div className="min-h-screen bg-[#F4F7F5] text-dark pb-32 overflow-x-hidden relative font-sans">
      {/* Top Header */}
      <div className="bg-white px-6 py-6 border-b border-gray-100 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center text-white">
            <Sprout className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-display font-black text-brand tracking-tighter uppercase leading-none">VegieRoute</h1>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => auth.signOut()}
            className="w-10 h-10 flex items-center justify-center bg-gray-50 border border-gray-100 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all shadow-sm"
            title="Sign Out"
          >
            <UserX className="w-5 h-5" />
          </button>
          <button 
            onClick={() => {
              updateDoc(doc(db, 'users', seller.id), { isOnline: !seller.isOnline })
                .catch(err => console.error("Status update failed", err));
            }}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-sm border",
              seller.isOnline 
                ? "bg-brand/10 text-brand border-brand/20" 
                : "bg-red-50 text-red-500 border-red-100"
            )}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full", seller.isOnline ? "bg-brand animate-pulse" : "bg-red-500")} /> 
            {seller.isOnline ? "ONLINE" : "OFFLINE"}
          </button>
          <div className="bg-gray-50 p-2 rounded-full">
            <Users className="w-5 h-5 text-gray-400" />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 sm:p-6 mb-8">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Sales</p>
                    <p className="text-2xl font-black text-gray-800 tabular-nums">{formatCurrency(totalEarnings)}</p>
                 </div>
                 <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Deliveries</p>
                    <p className="text-2xl font-black text-gray-800 tabular-nums">
                      {filteredOrders.filter(o => o.status === 'delivered').length}
                    </p>
                 </div>
                 <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Market Score</p>
                    <p className="text-2xl font-black text-brand tabular-nums">{seller.averageRating?.toFixed(1) || "5.0"}</p>
                 </div>
                 <button 
                  onClick={() => setShowOnboarding(true)}
                  className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm flex flex-col justify-center items-center gap-1 hover:border-brand transition-colors text-gray-400 hover:text-brand transition-all"
                 >
                    <MoreVertical className="w-5 h-5" />
                    <p className="text-[9px] font-black uppercase">Edit Shop</p>
                 </button>
              </div>

              {/* Shop Identity Section */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 bg-white border border-gray-100 rounded-[32px] p-8 flex flex-col sm:flex-row gap-8 shadow-sm group">
                  <div className="w-24 h-24 sm:w-32 sm:h-32 bg-gray-50 rounded-[24px] border border-gray-100 flex-shrink-0 overflow-hidden flex items-center justify-center relative">
                    {seller.businessDetails?.logoUrl ? (
                      <img src={seller.businessDetails.logoUrl} className="w-full h-full object-cover" alt="Shop Logo" />
                    ) : (
                      <Sprout className="w-12 h-12 text-brand/20" />
                    )}
                    <div className="absolute inset-0 bg-brand/0 group-hover:bg-brand/10 transition-colors flex items-center justify-center">
                       <Upload className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }} />
                    </div>
                  </div>
                  <div className="space-y-4 flex-1">
                    <div className="space-y-1">
                      <h3 className="text-2xl font-black uppercase tracking-tighter text-gray-800 leading-none">
                        {seller.businessDetails?.shopName || seller.fullName}
                      </h3>
                      <div className="flex items-center gap-2 text-[10px] font-black text-brand uppercase tracking-widest">
                        <Clock className="w-3 h-3" />
                        {seller.businessDetails?.operatingHours || "Set Hours in Profile"}
                      </div>
                    </div>
                    <p className="text-sm font-medium text-gray-400 uppercase tracking-wider leading-relaxed line-clamp-2">
                      {seller.businessDetails?.bio || "No business biography provided yet. Update your profile to stand out in the marketplace."}
                    </p>
                  </div>
                </div>
                <div className="bg-brand/5 border border-brand/10 rounded-[32px] p-8 space-y-6 flex flex-col justify-center">
                   <div className="space-y-1">
                      <p className="text-[10px] font-black text-brand uppercase tracking-widest">Trust Index</p>
                      <div className="flex items-center gap-3">
                        <h4 className="text-4xl font-black text-brand tracking-tighter">{seller.averageRating?.toFixed(1) || "5.0"}</h4>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map(s => (
                            <Star key={s} className={cn("w-3 h-3", s <= (seller.averageRating || 5) ? "text-brand fill-brand" : "text-brand/20")} />
                          ))}
                        </div>
                      </div>
                   </div>
                   <p className="text-[10px] font-bold text-brand/60 uppercase tracking-widest leading-tight">
                     Based on {seller.totalRatings || 0} customer interactions in your sector.
                   </p>
                </div>
              </div>

              {/* Action Banner */}
              <div className="bg-brand rounded-[40px] p-8 sm:p-12 text-white flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden shadow-2xl shadow-brand/20">
                 <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-8 -translate-y-8">
                   <Navigation className="w-64 h-64 rotate-12" />
                 </div>
                 <div className="relative z-10 space-y-4 text-center md:text-left">
                   <div className="bg-white/20 w-fit px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mx-auto md:mx-0">Optimization Active</div>
                   <h3 className="text-3xl sm:text-5xl font-black uppercase tracking-tighter leading-tight">Route Intelligence</h3>
                   <p className="text-white/80 text-sm font-medium max-w-sm">
                     Maximize your morning harvest sales by following the high-demand signal zones.
                   </p>
                 </div>
                 <button 
                   onClick={handleOptimize}
                   className="relative z-10 bg-white text-brand px-12 py-5 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl hover:scale-105 active:scale-95 transition-all w-full md:w-auto"
                 >
                   Open Radar
                 </button>
              </div>

              {/* Orders Management */}
              <div className="space-y-6">
                <div className="flex justify-between items-center px-1">
                   <h3 className="text-xl font-black uppercase tracking-tighter">Inbound Logistics</h3>
                   <span className="bg-brand/10 text-brand px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider">
                     {filteredOrders.filter(o => o.status === 'pending').length} SIGNALS
                   </span>
                </div>

                <div className="grid grid-cols-1 gap-4">
                   {/* Active Order Card */}
                   {filteredOrders.filter(o => o.status === 'accepted' || o.status === 'ongoing').map(order => (
                     <div key={order.id} className="bg-white border-2 border-brand/20 rounded-[32px] p-8 space-y-6 shadow-xl shadow-brand/5">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <div className="w-2.5 h-2.5 bg-brand rounded-full animate-pulse" />
                            <span className="text-[10px] font-black text-brand uppercase tracking-widest">Active Market Link</span>
                          </div>
                          <span className="text-2xl font-black tabular-nums">{formatCurrency(order.totalAmount)}</span>
                        </div>
                        <div className="space-y-4">
                           <h4 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter text-gray-800 leading-none">{order.location.address}</h4>
                           <div className="flex flex-wrap gap-2">
                             {order.items.map((i, idx) => (
                               <span key={idx} className="bg-gray-50 px-3 py-1.5 rounded-xl text-[11px] font-bold text-gray-500 uppercase">
                                 {i.name} × {i.quantity}
                               </span>
                             ))}
                           </div>
                        </div>
                        <div className="flex gap-4">
                          {order.status === 'accepted' ? (
                            <button 
                              onClick={() => startDeparture(order.id)}
                              className="flex-1 bg-dark text-white py-5 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-dark/20 hover:bg-black transition-all flex items-center justify-center gap-2"
                            >
                              <Play className="w-4 h-4 fill-white" />
                              Start Delivery
                            </button>
                          ) : (
                            <button 
                              onClick={() => completeOrder(order.id, order.totalAmount)}
                              className="flex-1 bg-brand text-white py-5 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-brand/20 hover:bg-brand/90 transition-all"
                            >
                              Mark Delivered
                            </button>
                          )}
                          <button 
                            onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${order.location.lat},${order.location.lng}`)}
                            className="w-16 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-center shadow-sm hover:bg-gray-100 transition-all"
                          >
                            <Navigation className="w-6 h-6 text-gray-400" />
                          </button>
                        </div>
                     </div>
                   ))}

                   {/* Pending Order Cards */}
                   {filteredOrders.filter(o => o.status === 'pending').length === 0 && filteredOrders.filter(o => o.status === 'accepted' || o.status === 'ongoing').length === 0 ? (
                     <div className="bg-white border-2 border-dashed border-gray-100 rounded-[40px] p-20 text-center space-y-6">
                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto">
                          <TrendingUp className="w-8 h-8 text-gray-200" />
                        </div>
                        <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.4em]">Scanning market signals...</p>
                     </div>
                   ) : (
                     filteredOrders.filter(o => o.status === 'pending').map(order => (
                       <div key={order.id} className="bg-white border border-gray-100 rounded-[32px] p-8 flex flex-col md:flex-row justify-between items-center gap-8 group hover:border-brand/30 transition-all hover:shadow-lg">
                          <div className="flex-1 space-y-4 w-full">
                             <div className="flex items-center gap-3">
                                <span className={cn(
                                   "px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest",
                                   order.type === 'signal' ? "bg-amber-100 text-amber-600" : "bg-brand/10 text-brand"
                                )}>
                                  {order.type === 'signal' ? 'DEMAND ALERT' : 'HARVEST ORDER'}
                                </span>
                                <span className="text-[10px] font-bold text-gray-300">#{order.id.slice(-6).toUpperCase()}</span>
                             </div>
                             <h4 className="text-2xl font-black uppercase tracking-tighter text-gray-800 leading-none group-hover:text-brand transition-colors">{order.location.address}</h4>
                             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                               {order.type === 'signal' ? "Broadcasting pickup signal" : `${order.items.length} Units • ${formatCurrency(order.totalAmount)}`}
                             </p>
                          </div>
                          <button 
                            onClick={() => acceptOrder(order.id)}
                            className="w-full md:w-40 bg-gray-50 hover:bg-brand hover:text-white py-5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-sm"
                          >
                            Accept Order
                          </button>
                       </div>
                     ))
                   )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'map' && (
            <motion.div 
               key="map"
               initial={{ opacity: 0, scale: 0.98 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.98 }}
               className="h-[75vh]"
            >
               <div className="bg-white border border-gray-100 rounded-[48px] h-full relative overflow-hidden shadow-2xl">
                  <MapContainer 
                    heatmapPoints={getHeatmapPoints}
                    highDemandZones={highDemandZones}
                    centerPos={seller.currentLocation ? { lat: seller.currentLocation.lat, lng: seller.currentLocation.lng } : undefined}
                    path={mapPath}
                    markers={[
                      ...(seller.currentLocation ? [{
                        id: 'seller',
                        lat: seller.currentLocation.lat,
                        lng: seller.currentLocation.lng,
                        label: 'MY UNIT',
                        icon: 'brand'
                      }] : []),
                      ...filteredOrders.filter(o => ['pending', 'accepted', 'ongoing'].includes(o.status)).map(o => ({
                        id: o.id,
                        lat: o.location.lat,
                        lng: o.location.lng,
                        label: o.status === 'pending' ? 'SIGNAL' : 'PAYLOAD',
                        icon: o.status === 'pending' ? 'yellow' : 'green',
                      }))
                    ]}
                    zoom={14}
                  />
                  <div className="absolute top-6 left-6 flex flex-col gap-3">
                    <div className="bg-white/95 backdrop-blur-xl p-4 rounded-2xl border border-gray-100 shadow-xl pointer-events-none">
                       <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Route Range</p>
                       <p className="text-xl font-black text-brand tabular-nums leading-none">{totalPathDistance.toFixed(1)} <span className="text-[10px]">KM</span></p>
                    </div>
                    {highDemandZones.length > 0 && (
                      <div className="bg-red-500 text-white p-4 rounded-2xl shadow-xl animate-pulse">
                        <p className="text-[10px] font-black uppercase tracking-widest leading-none">High Demand Cluster</p>
                        <p className="text-[10px] font-bold opacity-80 mt-1">Navigate to red zones</p>
                      </div>
                    )}
                  </div>

                  <div className="absolute bottom-6 left-6 right-6 flex justify-center items-center pointer-events-none">
                     <button 
                       onClick={() => setActiveTab('dashboard')}
                       className="bg-brand text-white px-10 py-5 rounded-2xl font-black uppercase tracking-widest text-xs pointer-events-auto shadow-2xl hover:scale-105 active:scale-95 transition-all"
                     >
                       Exit Radar
                     </button>
                  </div>
               </div>
            </motion.div>
          )}

          {activeTab === 'drive' && (
            <motion.div 
               key="drive"
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -20 }}
               className="space-y-8"
            >
              <div className="bg-white border border-gray-100 rounded-[48px] p-12 text-center space-y-6">
                <div className="w-24 h-24 bg-brand/10 mx-auto rounded-[32px] flex items-center justify-center">
                  <Navigation className="w-12 h-12 text-brand" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-4xl font-black uppercase tracking-tighter leading-none">Drive Logic</h2>
                  <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Manage active transport channels</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {filteredOrders.filter(o => o.status === 'accepted' || o.status === 'ongoing').length === 0 ? (
                  <div className="bg-white border-2 border-dashed border-gray-100 rounded-[40px] p-24 text-center opacity-30">
                    <p className="font-black uppercase tracking-[0.4em]">No Active Channels</p>
                  </div>
                ) : (
                  filteredOrders.filter(o => o.status === 'accepted' || o.status === 'ongoing').map(order => (
                    <div key={order.id} className="bg-white border border-gray-100 rounded-[40px] p-10 flex flex-col md:flex-row gap-10 items-center hover:shadow-xl transition-all">
                      <div className="flex-1 space-y-6 text-center md:text-left">
                        <div className="flex flex-col md:flex-row items-center gap-4">
                           <span className="bg-brand text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">Active Drive</span>
                           <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">{order.id.toUpperCase()}</p>
                        </div>
                        <div>
                          <h4 className="text-3xl font-black uppercase tracking-tighter text-gray-800 leading-tight mb-2">{order.location.address}</h4>
                          <p className="text-gray-500 font-bold text-sm uppercase tracking-wider">Payload: {order.items.map(i => i.name).join(', ')}</p>
                        </div>
                      </div>
                      <div className="w-full md:w-auto flex flex-col gap-4">
                         <div className="text-center md:text-right">
                            <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Expected Yield</p>
                            <p className="text-4xl font-black text-brand tabular-nums">{formatCurrency(order.totalAmount)}</p>
                         </div>
                         {order.status === 'accepted' ? (
                           <button 
                             onClick={() => startDeparture(order.id)}
                             className="w-full md:w-56 bg-brand text-white py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-brand/90 transition-all shadow-lg flex items-center justify-center gap-2"
                           >
                             <Play className="w-3 h-3 fill-white" />
                             Activate Transport
                           </button>
                         ) : (
                           <button 
                             onClick={() => completeOrder(order.id, order.totalAmount)}
                             className="w-full md:w-56 bg-dark text-white py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-brand hover:text-white transition-all shadow-lg"
                           >
                             Finalize Payload
                           </button>
                         )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation Rail */}
      <footer className="fixed bottom-0 left-0 right-0 p-4 sm:p-10 z-[100] pointer-events-none">
        <div className="max-w-md mx-auto h-16 sm:h-24 bg-white/90 backdrop-blur-2xl rounded-2xl sm:rounded-[40px] border border-gray-100 flex items-center justify-around px-4 sm:px-8 shadow-2xl pointer-events-auto">
          {[
            { id: 'dashboard', icon: TrendingUp, label: 'Stats' },
            { id: 'map', icon: Map, label: 'Radar' },
            { id: 'drive', icon: Navigation, label: 'Drive' },
          ].map((item) => (
            <button 
              key={item.id}
              onClick={() => setActiveTab(item.id as any)} 
              className={cn(
                "flex flex-col items-center gap-1 sm:gap-1.5 transition-all w-16 sm:w-20 relative",
                activeTab === item.id ? "text-brand" : "text-gray-400 hover:text-gray-600"
              )}
            >
              <item.icon className={cn("w-5 h-5 sm:w-7 sm:h-7 transition-transform", activeTab === item.id && "scale-110")} />
              <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest leading-none">{item.label}</span>
              {activeTab === item.id && (
                <motion.div layoutId="nav-indicator" className="absolute -bottom-1 w-1 h-1 bg-brand rounded-full" />
              )}
            </button>
          ))}
        </div>
      </footer>

      {/* Seller Onboarding Modal */}
      <AnimatePresence>
        {showOnboarding && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-white/95 backdrop-blur-3xl"
            />
            <motion.div 
              initial={{ scale: 0.9, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 30, opacity: 0 }}
              className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white border border-gray-100 rounded-[32px] sm:rounded-[40px] p-6 sm:p-12 shadow-2xl flex flex-col gap-6 sm:gap-8 custom-scrollbar scrollbar-hide"
            >
              {seller.onboardingComplete && (
                <button 
                  onClick={(e) => { e.stopPropagation(); setShowOnboarding(false); }}
                  className="absolute top-6 right-6 sm:top-10 sm:right-10 w-12 h-12 bg-gray-50 border border-gray-100 hover:bg-gray-100 rounded-full flex items-center justify-center transition-all group z-50 pointer-events-auto"
                >
                  <X className="w-6 h-6 text-gray-400 group-hover:text-gray-600" />
                </button>
              )}
              <div className="space-y-3 sm:space-y-4">
                <div className="bg-brand/10 text-brand border border-brand/20 w-fit text-[8px] sm:text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest">Merchant Registration</div>
                <h2 className="text-3xl sm:text-6xl font-black uppercase tracking-tighter leading-none text-gray-800">Business Profile</h2>
                <p className="text-gray-400 font-bold uppercase tracking-[0.15em] text-[8px] sm:text-[10px] leading-relaxed">Setup your shop details & payment information</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
                 <div className="space-y-1.5 sm:space-y-2">
                   <div className="flex justify-between items-center px-1">
                     <label className="text-[8px] sm:text-[10px] font-black uppercase text-gray-400 tracking-widest">Shop Name</label>
                     {errors.shopName && <span className="text-red-500 text-[7px] sm:text-[8px] font-bold uppercase animate-pulse">{errors.shopName}</span>}
                   </div>
                   <input 
                     type="text" 
                     placeholder="e.g. Fresh Valley Farms"
                     value={onboardingData.shopName}
                     onChange={e => {
                       setOnboardingData({...onboardingData, shopName: e.target.value});
                       if (errors.shopName) setErrors(prev => { const n = {...prev}; delete n.shopName; return n; });
                     }}
                     className={cn(
                       "w-full bg-gray-50 border rounded-xl sm:rounded-2xl px-4 sm:px-6 py-3.5 sm:py-4 text-sm font-bold focus:border-brand focus:outline-none transition-colors text-gray-800 placeholder:text-gray-300",
                       errors.shopName ? "border-red-500/50 bg-red-50/50" : "border-gray-100"
                     )}
                   />
                 </div>
                 <div className="space-y-1.5 sm:space-y-2">
                   <div className="flex justify-between items-center px-1">
                     <label className="text-[8px] sm:text-[10px] font-black uppercase text-gray-400 tracking-widest">UPI ID (For Payments)</label>
                     {errors.upiId && <span className="text-red-500 text-[7px] sm:text-[8px] font-bold uppercase animate-pulse">{errors.upiId}</span>}
                   </div>
                   <input 
                     type="text" 
                     placeholder="yourname@upi"
                     value={onboardingData.upiId}
                     onChange={e => {
                       setOnboardingData({...onboardingData, upiId: e.target.value});
                       if (errors.upiId) setErrors(prev => { const n = {...prev}; delete n.upiId; return n; });
                     }}
                     className={cn(
                       "w-full bg-gray-50 border rounded-xl sm:rounded-2xl px-4 sm:px-6 py-3.5 sm:py-4 text-sm font-bold focus:border-brand focus:outline-none transition-colors text-gray-800 placeholder:text-gray-300",
                       errors.upiId ? "border-red-500/50 bg-red-50/50" : "border-gray-100"
                     )}
                   />
                 </div>
                 <div className="space-y-1.5 sm:space-y-2">
                   <label className="text-[8px] sm:text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Phone Number</label>
                   <input 
                     type="text" 
                     placeholder="+63 XXX XXX XXXX"
                     value={onboardingData.phoneNumber}
                     onChange={e => setOnboardingData({...onboardingData, phoneNumber: e.target.value})}
                     className="w-full bg-gray-50 border border-gray-100 rounded-xl sm:rounded-2xl px-4 sm:px-6 py-3.5 sm:py-4 text-sm font-bold focus:border-brand focus:outline-none transition-colors text-gray-800 placeholder:text-gray-300"
                   />
                 </div>
                 <div className="space-y-1.5 sm:space-y-2">
                   <div className="flex justify-between items-center px-1">
                     <label className="text-[8px] sm:text-[10px] font-black uppercase text-gray-400 tracking-widest">Payment QR Code</label>
                     {errors.qrCodeUrl && <span className="text-red-500 text-[7px] sm:text-[8px] font-bold uppercase animate-pulse">{errors.qrCodeUrl}</span>}
                   </div>
                   <div className="flex gap-2">
                     <input 
                       type="text" 
                       placeholder="URL or Upload ->"
                       value={onboardingData.qrCodeUrl?.startsWith('data:') ? 'IMAGE SELECTED' : (onboardingData.qrCodeUrl || '')}
                       onChange={e => setOnboardingData({...onboardingData, qrCodeUrl: e.target.value})}
                       className="flex-1 bg-gray-50 border border-gray-100 rounded-xl sm:rounded-2xl px-4 sm:px-6 py-3.5 sm:py-4 text-sm font-bold focus:border-brand focus:outline-none transition-colors text-gray-800 placeholder:text-gray-300"
                     />
                     <button 
                       type="button"
                       onClick={() => fileInputRef.current?.click()}
                       className="w-14 sm:w-16 bg-gray-100 hover:bg-gray-200 rounded-xl sm:rounded-2xl flex items-center justify-center transition-colors border border-gray-100"
                     >
                       <Upload className="w-5 h-5 text-gray-400" />
                     </button>
                     <input 
                       type="file" 
                       ref={fileInputRef} 
                       className="hidden" 
                       accept="image/*" 
                       onChange={handleFileChange} 
                     />
                   </div>
                 </div>
                  <div className="space-y-1.5 sm:space-y-4 sm:col-span-2">
                    <label className="text-[8px] sm:text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Select Growth Plan</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {(['standard', 'premium', 'enterprise'] as const).map((plan) => (
                        <button
                          key={plan}
                          onClick={() => setOnboardingData({...onboardingData, membershipPlan: plan})}
                          className={cn(
                            "p-4 rounded-2xl border-2 text-left transition-all relative overflow-hidden group",
                            onboardingData.membershipPlan === plan 
                              ? "border-brand bg-brand/5" 
                              : "border-gray-100 bg-gray-50 hover:border-gray-200"
                          )}
                        >
                          <div className="relative z-10 space-y-1">
                            <p className="text-[8px] font-black uppercase tracking-widest text-brand">{plan}</p>
                            <p className="text-xs font-black text-gray-800 uppercase">
                              {plan === 'standard' ? 'Free' : plan === 'premium' ? '₹499/mo' : 'Custom'}
                            </p>
                            <p className="text-[7px] font-bold text-gray-400 uppercase leading-none mt-1">
                              {plan === 'standard' ? 'Basic Listing' : plan === 'premium' ? 'Priority Radar' : 'Full Sector dominance'}
                            </p>
                          </div>
                          {onboardingData.membershipPlan === plan && (
                            <CheckCircle className="absolute top-3 right-3 w-4 h-4 text-brand" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5 sm:space-y-2 sm:col-span-2">
                    <div className="flex justify-between items-center px-1">
                      <label className="text-[8px] sm:text-[10px] font-black uppercase text-gray-400 tracking-widest">Shop Logo / Photo</label>
                      {errors.logoUrl && <span className="text-red-500 text-[7px] sm:text-[8px] font-bold uppercase animate-pulse">{errors.logoUrl}</span>}
                    </div>
                    <div className="flex items-center gap-4">
                      {onboardingData.logoUrl ? (
                        <div className="relative w-20 h-20 rounded-2xl overflow-hidden border border-gray-100 group">
                          <img src={onboardingData.logoUrl} className="w-full h-full object-cover" alt="Logo" />
                          <button 
                            onClick={() => setOnboardingData(prev => ({...prev, logoUrl: ''}))}
                            className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                          >
                            <X className="w-5 h-5 text-white" />
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.onchange = (e) => handleLogoUpload(e as any);
                            input.click();
                          }}
                          className="w-20 h-20 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-1 hover:border-brand/40 group transition-all"
                        >
                          <Upload className="w-5 h-5 text-gray-300 group-hover:text-brand" />
                          <span className="text-[8px] font-black text-gray-400">UPLOAD</span>
                        </button>
                      )}
                      <div className="flex-1 text-[10px] text-gray-400 font-medium italic">
                        Recommended: Square image, max 500KB. This will represent your shop to customers.
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 sm:space-y-2">
                   <div className="flex justify-between items-center px-1">
                     <label className="text-[8px] sm:text-[10px] font-black uppercase text-gray-400 tracking-widest">Operating Hours</label>
                   </div>
                   <input 
                     type="text" 
                     placeholder="e.g. 6AM - 11AM Daily"
                     value={onboardingData.operatingHours}
                     onChange={e => setOnboardingData({...onboardingData, operatingHours: e.target.value})}
                     className="w-full bg-gray-50 border border-gray-100 rounded-xl sm:rounded-2xl px-4 sm:px-6 py-3.5 sm:py-4 text-sm font-bold focus:border-brand focus:outline-none transition-colors text-gray-800 placeholder:text-gray-300"
                   />
                 </div>

                 <div className="space-y-1.5 sm:space-y-2 sm:col-span-2">
                   <div className="flex justify-between items-center px-1">
                     <label className="text-[8px] sm:text-[10px] font-black uppercase text-gray-400 tracking-widest">Short Bio / Description</label>
                   </div>
                   <textarea 
                     placeholder="Tell customers about your fresh produce..."
                     value={onboardingData.bio}
                     onChange={e => setOnboardingData({...onboardingData, bio: e.target.value})}
                     rows={3}
                     className="w-full bg-gray-50 border border-gray-100 rounded-xl sm:rounded-2xl px-4 sm:px-6 py-3.5 sm:py-4 text-sm font-bold focus:border-brand focus:outline-none transition-colors text-gray-800 placeholder:text-gray-300 resize-none"
                   />
                 </div>

                 <div className="space-y-1.5 sm:space-y-2 sm:col-span-2">
                   <div className="flex justify-between items-center px-1">
                     <label className="text-[8px] sm:text-[10px] font-black uppercase text-gray-400 tracking-widest">Pickup Address</label>
                     {errors.address && <span className="text-red-500 text-[7px] sm:text-[8px] font-bold uppercase animate-pulse">{errors.address}</span>}
                   </div>
                   <input 
                     type="text" 
                     placeholder="Where should customers find you?"
                     value={onboardingData.address}
                     onChange={e => {
                       setOnboardingData({...onboardingData, address: e.target.value});
                       if (errors.address) setErrors(prev => { const n = {...prev}; delete n.address; return n; });
                     }}
                     className={cn(
                       "w-full bg-gray-50 border rounded-xl sm:rounded-2xl px-4 sm:px-6 py-3.5 sm:py-4 text-sm font-bold focus:border-brand focus:outline-none transition-colors text-gray-800 placeholder:text-gray-300",
                       errors.address ? "border-red-500/50 bg-red-50/50" : "border-gray-100"
                     )}
                   />
                 </div>
              </div>

              <div className="bg-brand/5 border border-brand/10 p-5 sm:p-6 rounded-2xl sm:rounded-3xl space-y-2 sm:space-y-3">
                 <div className="flex items-center gap-2 sm:gap-3">
                    <ShieldCheck className="text-brand w-4 h-4 sm:w-5 sm:h-5" />
                    <p className="text-[8px] sm:text-[10px] font-black text-brand uppercase tracking-widest">Safe Payment Protocol</p>
                 </div>
                 <p className="text-[7px] sm:text-[10px] font-bold text-gray-400 uppercase leading-relaxed tracking-wider">
                   Payments are peer-to-peer. VegieRoute facilitates logistics routing only. Ensure your UPI details are accurate for receiving payments.
                 </p>
              </div>

              <button 
                onClick={completeOnboarding}
                disabled={loading}
                className="w-full h-16 sm:h-20 bg-brand text-white rounded-2xl sm:rounded-[24px] font-black uppercase tracking-widest text-[10px] sm:text-xs shadow-xl shadow-brand/20 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2 sm:gap-3 shrink-0 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />}
                {loading ? "SAVING..." : "Save Business Profile"}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Experimental Trial Overlay */}
      {isTrialActive && (
        <div className="fixed top-2 sm:top-8 left-1/2 -translate-x-1/2 z-[110] w-full max-w-lg px-2 sm:px-4">
           <div className="bg-brand rounded-2xl sm:rounded-[32px] p-4 sm:p-6 flex items-center justify-between shadow-[0_20px_50px_rgba(255,184,0,0.3)]">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-dark rounded-xl sm:rounded-2xl flex items-center justify-center">
                   <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 text-brand" />
                </div>
                <div>
                   <p className="text-dark font-black uppercase text-[8px] sm:text-[10px] tracking-widest leading-none">Operational Trial</p>
                   <p className="text-dark font-bold text-xs sm:text-sm tracking-tight mt-1">Experimental License Active</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsTrialActive(false);
                  setShowOnboarding(true);
                }}
                className="bg-dark text-brand px-4 py-2 sm:px-6 sm:py-3 rounded-xl sm:rounded-2xl font-black uppercase tracking-widest text-[8px] sm:text-[10px] hover:scale-105 active:scale-95 transition-all"
              >
                Upgrade
              </button>
           </div>
        </div>
      )}
    </div>
  );
};

export default SellerView;
