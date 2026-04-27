import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, runTransaction } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { TrendingUp, Map, CheckCircle, Navigation, DollarSign, Package, Users, ShieldCheck, AlertCircle, Play, MoreVertical, Signal, MapPin, Activity, Clock, Loader2, Leaf, Sprout, Upload, X } from 'lucide-react';
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
    if (seller.isOnline) {
      if ('geolocation' in navigator) {
        watchId = navigator.geolocation.watchPosition((pos) => {
          updateDoc(doc(db, 'users', seller.id), {
            currentLocation: {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              updatedAt: new Date().toISOString()
            }
          }).catch(err => console.error("Location update failed", err));
        }, (err) => console.error("Geolocation error", err), {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      }
    }

    return () => {
      unsubPending();
      unsubAssigned();
      if (watchId) navigator.geolocation.clearWatch(watchId);
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

  const getOptimizedRoute = useMemo(() => {
    const activeOrders = orders.filter(o => o.status === 'accepted' || o.status === 'ongoing');
    const pendingOrders = orders.filter(o => o.status === 'pending');
    
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
        sellerId: seller.id || auth.currentUser?.uid
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `orders/${orderId}`, auth);
    }
  };

  const completeOrder = async (orderId: string, amount: number) => {
    try {
      await runTransaction(db, async (transaction) => {
        const orderRef = doc(db, 'orders', orderId);
        const sellerRef = doc(db, 'users', seller.id);
        
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists()) throw new Error("Order not found");
        
        const customerId = orderSnap.data().customerId;
        const customerRef = doc(db, 'users', customerId);
        
        const [sellerSnap, customerSnap] = await Promise.all([
          transaction.get(sellerRef),
          transaction.get(customerRef)
        ]);

        if (!sellerSnap.exists()) throw new Error("Operator profile not found");
        
        const earnedSuperCoins = Math.floor(Math.random() * 3) + 1; // 1, 2, or 3 coins

        transaction.update(orderRef, { 
          status: 'delivered',
          rewardAvailable: true,
          rewardAmount: earnedSuperCoins
        });
        
        // We no longer track seller 'coins' as per request to remove credits system
        // But we could track order completion counts if needed later
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
  });

  useEffect(() => {
    if (showOnboarding) {
      setOnboardingData({
        shopName: seller.businessDetails?.shopName || '',
        address: seller.businessDetails?.address || '',
        upiId: seller.paymentInfo?.upiId || '',
        phoneNumber: seller.paymentInfo?.phoneNumber || '',
        qrCodeUrl: seller.paymentInfo?.qrCodeUrl || '',
      });
    }
  }, [showOnboarding, seller.businessDetails, seller.paymentInfo]);

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
        businessDetails: {
          shopName: onboardingData.shopName,
          address: onboardingData.address,
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
    return orders.filter(o => o.status === 'pending').map(o => ({ 
      lat: o.location.lat, 
      lng: o.location.lng, 
      weight: 1.5 // Increased sensitivity
    }));
  }, [orders]);

  const highDemandZones = useMemo(() => {
    const pending = orders.filter(o => o.status === 'pending');
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
    <div className="min-h-screen bg-dark text-white pb-40 overflow-x-hidden relative">
      {/* Organic Background Accents */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-5 z-0">
         <Leaf className="absolute h-64 w-64 -top-20 right-1/4 text-brand -rotate-12" />
         <Sprout className="absolute h-48 w-48 bottom-1/4 -left-10 text-brand rotate-45" />
      </div>

      <div className="max-w-7xl mx-auto p-4 sm:p-6 relative z-10">
        {/* Dynamic Operator Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-16 sm:mb-24 px-2 sm:px-4 gap-8 sm:gap-12 mt-8 sm:mt-12">
        <div className="space-y-4 sm:space-y-6">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <div className="glass-pill text-brand border-brand/20 bg-brand/5 text-[10px] sm:text-xs">Operator Control Units</div>
            <button 
              onClick={() => {
                updateDoc(doc(db, 'users', seller.id), { isOnline: !seller.isOnline })
                  .catch(err => console.error("Status update failed", err));
              }}
              className={cn(
                "flex items-center gap-2 px-3 py-1 sm:px-4 sm:py-1.5 rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 cursor-pointer",
                seller.isOnline 
                  ? "bg-green-500/10 text-green-500 border border-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.1)]" 
                  : "bg-red-500/10 text-red-500 border border-red-500/20"
              )}
            >
              <span className={cn("w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full", seller.isOnline ? "bg-green-500 animate-pulse" : "bg-red-500")} /> 
              {seller.isOnline ? "System Verified" : "Offline Mode"}
              <span className="ml-1 text-[7px] opacity-40">(Click to Toggle)</span>
            </button>
          </div>
          <h1 className="text-5xl sm:text-7xl lg:text-9xl font-black tracking-tighter uppercase leading-[0.8] transition-all group">
            Logistics<br /><span className="text-neutral-800 hover:text-brand transition-colors">Commander</span>
          </h1>
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 pt-2 sm:pt-4">
            <button 
              onClick={() => {
                if (!seller.currentLocation) return;
                
                // Find next target in optimized route
                const nextTarget = getOptimizedRoute[0];
                let newLat = seller.currentLocation.lat;
                let newLng = seller.currentLocation.lng;

                if (nextTarget) {
                  // Move towards target
                  const step = 0.001;
                  const dLat = nextTarget.location.lat - newLat;
                  const dLng = nextTarget.location.lng - newLng;
                  const dist = Math.sqrt(dLat*dLat + dLng*dLng);
                  
                  if (dist > step) {
                    newLat += (dLat / dist) * step;
                    newLng += (dLng / dist) * step;
                  } else {
                    newLat = nextTarget.location.lat;
                    newLng = nextTarget.location.lng;
                  }
                } else {
                  // Random jitter if no targets
                  newLat += (Math.random() - 0.5) * 0.002;
                  newLng += (Math.random() - 0.5) * 0.002;
                }

                updateDoc(doc(db, 'users', seller.id), {
                  currentLocation: {
                    lat: newLat,
                    lng: newLng,
                    updatedAt: new Date().toISOString()
                  }
                }).catch(e => handleFirestoreError(e, OperationType.UPDATE, `users/${seller.id}`, auth));
              }}
              className="px-4 py-1.5 bg-white/5 hover:bg-white/10 rounded-full text-[8px] font-bold text-neutral-600 uppercase tracking-tighter transition-all"
            >
              Simulate Fleet Advance
            </button>
            <p className="text-neutral-500 font-bold uppercase tracking-[0.2em] sm:tracking-[0.3em] flex items-center gap-3 text-[9px] sm:text-[10px]">
              <Signal className="w-4 h-4 sm:w-5 sm:h-5 text-brand" /> 
              Neural Hash: {seller.id.split('-')[0].toUpperCase()}
            </p>
            <div className="hidden xs:block h-3 sm:h-4 w-px bg-line" />
            <p className="text-neutral-500 font-bold uppercase tracking-[0.2em] sm:tracking-[0.3em] text-[8px] sm:text-[10px]">
              Region: Indiranagar - Area 04
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6 sm:gap-8">
           <div className="bg-surface border border-line px-8 py-6 sm:px-10 sm:py-8 rounded-[32px] sm:rounded-[40px] flex flex-col justify-center shadow-2xl min-w-[160px] sm:min-w-[200px] relative overflow-hidden group flex-1">
            <div className="absolute inset-0 bg-brand/3 translate-y-full group-hover:translate-y-0 transition-transform duration-700" />
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-brand/10 flex items-center justify-center rounded-xl sm:rounded-2xl mb-3 sm:mb-4">
              <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-brand" />
            </div>
            <div>
              <p className="text-[8px] sm:text-[10px] font-black uppercase text-neutral-600 tracking-[0.2em] mb-1 sm:mb-2 leading-none">Inbound Yield</p>
              <p className="text-2xl sm:text-4xl font-black tabular-nums leading-none tracking-tighter">{formatCurrency(totalEarnings)}</p>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'dashboard' && (
          <motion.div 
            key="dashboard"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-12 sm:space-y-16 px-2 sm:px-4"
          >
            {/* Real-time Telemetry Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              <div className="premium-card p-8 sm:p-10 bg-gradient-to-br from-surface to-dark group overflow-hidden relative border-brand/5">
                 <div className="absolute -right-10 -bottom-10 opacity-5 group-hover:opacity-10 transition-all duration-1000 rotate-12">
                    <TrendingUp className="w-48 h-48 sm:w-64 sm:h-64 text-brand" />
                 </div>
                 <div className="relative z-10 space-y-8 sm:space-y-10">
                    <div className="space-y-3 sm:space-y-4">
                       <h3 className="text-2xl sm:text-3xl font-black tracking-tighter uppercase leading-none">Market Sync</h3>
                       <p className="text-neutral-500 font-bold text-[10px] sm:text-xs uppercase tracking-widest leading-relaxed">Active Demand Overlay: 12 Nodes</p>
                    </div>
                    <button onClick={handleOptimize} className="btn-brand flex items-center gap-3 sm:gap-4 px-8 sm:px-10 w-fit text-[10px] sm:text-xs">
                       <Play className="fill-current w-4 h-4 sm:w-5 sm:h-5" /> Sync Route
                    </button>
                 </div>
              </div>

              <div className="premium-card p-8 sm:p-10 flex flex-col justify-between border-line">
                <div className="space-y-3 sm:space-y-4">
                   <div className="flex justify-between items-start">
                     <h3 className="text-2xl sm:text-3xl font-black tracking-tighter uppercase leading-none">Traffic Flux</h3>
                     <Activity className="text-brand w-5 h-5 sm:w-6 sm:h-6 animate-pulse" />
                   </div>
                   <p className="text-neutral-500 font-bold text-[10px] sm:text-xs uppercase tracking-widest">Neighborhood Saturation</p>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-8 sm:mt-12">
                   <div className="p-4 sm:p-6 bg-dark/50 rounded-[20px] sm:rounded-[24px] border border-line">
                      <p className="text-[8px] sm:text-[9px] font-black uppercase text-neutral-600 tracking-[0.2em] mb-1 sm:mb-2">Flow Rate</p>
                      <p className="text-2xl sm:text-3xl font-black tabular-nums">98%</p>
                   </div>
                   <div className="p-4 sm:p-6 bg-dark/50 rounded-[20px] sm:rounded-[24px] border border-line">
                      <p className="text-[8px] sm:text-[9px] font-black uppercase text-neutral-600 tracking-[0.2em] mb-1 sm:mb-2">Latency</p>
                      <p className="text-2xl sm:text-3xl font-black tabular-nums text-brand">4ms</p>
                   </div>
                </div>
              </div>

              <div className="premium-card p-8 sm:p-10 md:col-span-2 lg:col-span-1 flex flex-col justify-between bg-surface relative group">
                <div className="absolute top-0 left-0 w-full h-1 bg-brand/20">
                  <motion.div 
                    initial={{ width: 0 }} 
                    animate={{ width: '100%' }} 
                    transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                    className="h-full bg-brand shadow-[0_0_10px_#FFB800]" 
                  />
                </div>
                <div className="space-y-4 pt-4">
                   <h3 className="text-3xl font-black tracking-tighter uppercase leading-none">System Pulse</h3>
                   <p className="text-neutral-500 font-bold text-xs uppercase tracking-widest">Link Verification Status</p>
                </div>
                <div className="space-y-6 mt-12">
                   <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                      <span className="text-neutral-600">Global Uptime</span>
                      <span className="text-white">99.999%</span>
                   </div>
                   <div className="h-1.5 bg-line rounded-full overflow-hidden">
                      <div className="h-full bg-brand w-[85%]" />
                   </div>
                </div>

                {/* Merchant Payment Specs */}
                {(seller.paymentInfo?.upiId || seller.paymentInfo?.phoneNumber || seller.paymentInfo?.qrCodeUrl) && (
                   <div className="mt-8 pt-8 border-t border-line space-y-4">
                      <div className="flex justify-between items-center">
                        <p className="text-[8px] font-black text-neutral-600 uppercase tracking-widest leading-none">Payment Payload Verified</p>
                        <button 
                          onClick={() => setShowOnboarding(true)}
                          className="text-[7px] font-black text-brand uppercase tracking-widest hover:underline"
                        >
                          Edit Profile
                        </button>
                      </div>
                      
                      <div className="flex gap-4">
                        <div className="flex-1 space-y-2">
                          {seller.paymentInfo?.upiId && (
                             <div className="flex items-center justify-between">
                                <span className="text-[9px] font-bold text-neutral-400 uppercase">UPI ID</span>
                                <span className="text-[11px] font-black text-brand tabular-nums">{seller.paymentInfo.upiId}</span>
                             </div>
                          )}
                          {seller.paymentInfo?.phoneNumber && (
                             <div className="flex items-center justify-between">
                                <span className="text-[9px] font-bold text-neutral-400 uppercase">Settlement Num</span>
                                <span className="text-[11px] font-black text-white tabular-nums">{seller.paymentInfo.phoneNumber}</span>
                             </div>
                          )}
                        </div>
                        
                        {seller.paymentInfo?.qrCodeUrl && (
                          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white p-1 rounded-xl shadow-lg border border-line">
                            <img 
                              src={seller.paymentInfo.qrCodeUrl} 
                              alt="Payment QR" 
                              className="w-full h-full object-contain"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        )}
                      </div>
                   </div>
                )}
              </div>
            </div>

            {/* Active Requests Monitor */}
            <div className="space-y-8 sm:space-y-10">
               <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end px-2 sm:px-4 border-b border-line pb-8 sm:pb-10 gap-6">
                  <div className="space-y-2">
                    <h3 className="text-3xl sm:text-4xl font-black tracking-tighter uppercase leading-none">Inbound Payloads</h3>
                    <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-neutral-600">Scanning Satellite Network for Active Requests</p>
                  </div>
                  <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
                     <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-brand rounded-full animate-ping" />
                        <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-brand">Indiranagar Active</span>
                     </div>
                     <button className="w-10 h-10 sm:w-12 sm:h-12 bg-line rounded-full flex items-center justify-center hover:bg-brand hover:text-dark transition-all">
                        <Signal className="w-4 h-4 sm:w-5 sm:h-5" />
                     </button>
                  </div>
               </div>

               {/* Sections for different order types */}
               <div className="space-y-12">
                 {/* Active/Ongoing Section */}
                 {orders.filter(o => o.status === 'accepted' || o.status === 'ongoing').length > 0 && (
                   <div className="space-y-6">
                     <div className="px-4 flex items-center gap-4">
                       <div className="h-px bg-brand/30 flex-1" />
                       <span className="text-[10px] font-black text-brand uppercase tracking-[0.4em] whitespace-nowrap">Active Logistics Path</span>
                       <div className="h-px bg-brand/30 flex-1" />
                     </div>
                     <div className="grid grid-cols-1 gap-6">
                        {orders.filter(o => o.status === 'accepted' || o.status === 'ongoing').map((order, idx) => (
                          <motion.div 
                            key={order.id} 
                            initial={{ opacity: 0, x: -20 }} 
                            animate={{ opacity: 1, x: 0 }}
                            className="premium-card p-6 sm:p-10 border-brand/40 bg-brand/5 relative overflow-hidden group"
                          >
                            <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                               <div className="flex-1 space-y-4">
                                  <div className="flex items-center gap-4">
                                     <span className="px-3 py-1 bg-brand text-dark text-[8px] font-black uppercase tracking-widest rounded-full">In Progress</span>
                                     <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Protocol: {order.id.split('-')[0]}</span>
                                  </div>
                                  <h4 className="text-2xl sm:text-4xl font-black uppercase tracking-tighter">{order.location.address}</h4>
                               </div>
                               <div className="flex gap-4">
                                  <button 
                                    onClick={() => updateDoc(doc(db, 'orders', order.id), { status: 'delivered' }).catch(e => handleFirestoreError(e, OperationType.UPDATE, `orders/${order.id}`, auth))}
                                    className="px-8 py-4 bg-brand text-dark rounded-2xl font-black uppercase tracking-widest text-[10px] hover:scale-105 transition-all shadow-lg"
                                  >
                                    Execute Delivery
                                  </button>
                               </div>
                            </div>
                          </motion.div>
                        ))}
                     </div>
                   </div>
                 )}

                 {/* Pending Requests */}
                 {orders.filter(o => o.status === 'pending').length === 0 && orders.filter(o => o.status === 'accepted' || o.status === 'ongoing').length === 0 ? (
                   <motion.div 
                     initial={{ opacity: 0 }} 
                     animate={{ opacity: 1 }}
                     className="premium-card py-24 sm:py-40 border-dashed border-2 flex flex-col items-center justify-center gap-8 sm:gap-10 bg-transparent"
                   >
                      <div className="relative">
                         <Signal className="w-16 h-16 sm:w-24 sm:h-24 text-neutral-900 group-hover:text-brand/20 transition-colors" />
                         <motion.div 
                           animate={{ scale: [1, 1.5, 2], opacity: [0.5, 0.2, 0] }}
                           transition={{ duration: 2, repeat: Infinity }}
                           className="absolute inset-0 bg-brand/10 rounded-full"
                         />
                      </div>
                      <div className="text-center space-y-3 sm:space-y-4 px-4">
                        <p className="text-neutral-500 font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-base sm:text-lg">No Active Signal Detected</p>
                        <p className="text-neutral-700 font-bold uppercase tracking-widest text-[8px] sm:text-[10px] max-w-sm mx-auto leading-relaxed">
                          The neural network is currently clear. <br/>All regional supply units have been satisfied.
                        </p>
                      </div>
                   </motion.div>
                 ) : (
                   <div className="grid grid-cols-1 gap-6 sm:gap-8">
                      {orders.filter(o => o.status === 'pending').map((order, idx) => (
                        <motion.div 
                          key={order.id} 
                          initial={{ opacity: 0, x: -20 }} 
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          className="premium-card p-6 sm:p-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-8 sm:gap-10 group hover:border-brand/40 shadow-2xl relative overflow-hidden border-line bg-surface"
                        >
                          <div className="absolute top-0 left-0 w-1.5 sm:w-2 h-full bg-brand/10 group-hover:bg-brand transition-all" />
                          
                          <div className="flex-1 space-y-6 sm:space-y-8 w-full">
                             <div className="flex flex-wrap items-center gap-3 sm:gap-6">
                                <span className={cn(
                                   "px-3 py-1 sm:px-6 sm:py-2 border text-[8px] sm:text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg",
                                   order.type === 'signal' ? "bg-brand text-dark border-brand" : "bg-brand/5 border-brand/20 text-brand"
                                )}>
                                   {order.type === 'signal' ? 'MARKET SIGNAL' : 'INBOUND PAYLOAD'}
                                </span>
                                <div className="h-4 sm:h-6 w-px bg-line" />
                                <span className="text-[10px] text-neutral-600 font-black tracking-[0.2em] sm:tracking-[0.3em] uppercase">UID: {order.id.split('-')[0].toUpperCase()}</span>
                             </div>

                             <div className="space-y-3 sm:space-y-4">
                                <p className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tighter uppercase leading-[0.9] sm:leading-[0.8] group-hover:text-brand transition-colors duration-500">
                                   {order.location.address}
                                </p>
                                <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-neutral-500 font-bold uppercase tracking-widest text-[8px] sm:text-[10px]">
                                   {order.type === 'signal' ? (
                                      <div className="flex items-center gap-2 text-brand">
                                         <Signal className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> POTENTIAL DEMAND ZONE
                                      </div>
                                   ) : (
                                      <>
                                         <div className="flex items-center gap-2">
                                            <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand" /> {order.items.length} Items
                                         </div>
                                         <div className="hidden xs:block w-1 h-1 sm:w-1.5 sm:h-1.5 bg-neutral-800 rounded-full" />
                                         <div className="flex items-center gap-2">
                                            <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand" /> 1.2 KM
                                         </div>
                                      </>
                                   )}
                                </div>
                             </div>

                             {order.type !== 'signal' && (
                                <div className="flex flex-wrap gap-2">
                                   {order.items.slice(0, 3).map((item, i) => (
                                     <div key={i} className="px-3 py-1.5 sm:px-4 sm:py-2 bg-dark rounded-lg sm:rounded-xl border border-line text-[8px] sm:text-[10px] font-black uppercase tracking-widest group-hover:border-neutral-700 transition-colors">
                                        {item.name} <span className="text-neutral-700 ml-1">x{item.quantity}</span>
                                     </div>
                                   ))}
                                   {order.items.length > 3 && (
                                     <div className="px-3 py-1.5 sm:px-4 sm:py-2 bg-dark rounded-lg sm:rounded-xl border border-line text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-neutral-600">
                                        +{order.items.length - 3}
                                     </div>
                                   )}
                                </div>
                             )}
                          </div>

                          <div className="flex flex-col items-center md:items-end gap-6 w-full md:w-auto border-t md:border-t-0 border-line pt-6 md:pt-0">
                             <div className="text-center md:text-right">
                                <p className="text-[8px] sm:text-[10px] font-black text-neutral-600 uppercase tracking-widest mb-1">Valuation</p>
                                <p className="text-4xl sm:text-6xl font-black tracking-tighter tabular-nums leading-none text-white">{formatCurrency(order.totalAmount)}</p>
                             </div>
                             <button 
                               onClick={() => acceptOrder(order.id)}
                               className="w-full md:w-80 h-16 sm:h-24 bg-brand text-dark rounded-2xl sm:rounded-[32px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-xs sm:text-sm shadow-[0_15px_30px_-5px_rgba(255,184,0,0.4)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 sm:gap-4"
                             >
                               Establish Protocol
                             </button>
                          </div>
                        </motion.div>
                      ))}
                   </div>
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
            className="px-4 h-[75vh]"
          >
            <div className="w-full h-full rounded-[48px] overflow-hidden border border-line shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8)] relative">
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
                    label: 'FIELD OPERATOR (YOU)',
                    description: 'System Verified & Online',
                    icon: 'brand'
                  }] : []),
                  ...orders.filter(o => ['pending', 'accepted', 'ongoing'].includes(o.status)).map(o => ({
                    id: o.id,
                    lat: o.location.lat,
                    lng: o.location.lng,
                    label: o.status === 'pending' ? 'DEMAND SIGNAL' : `PAYLOAD: ${o.id.split('-')[0]}`,
                    description: o.status === 'pending' ? 'Unassigned Market Demand' : `Status: ${o.status.toUpperCase()}`,
                    icon: o.status === 'pending' ? 'yellow' : 'green',
                    details: (
                      <div className="space-y-1">
                        <div className="text-[8px] text-neutral-500 font-bold uppercase">Destination</div>
                        <div className="text-[10px] text-white font-black truncate max-w-[150px]">{o.location.address}</div>
                        {o.items.length > 0 && (
                          <div className="text-[8px] text-brand font-bold mt-1">
                            {o.items.length} Units to Transport
                          </div>
                        )}
                      </div>
                    )
                  }))
                ]}
                zoom={14}
                onMapClick={(lat, lng) => {
                  console.log(`Waypoint marked at ${lat}, ${lng}`);
                  // Optionally could handle local waypoint marking
                }}
              />
              
              {/* Organized Overlays */}
              <div className="absolute inset-0 pointer-events-none p-4 sm:p-6 flex flex-col justify-between">
                 {/* Top section: Status and Telemetry */}
                 <div className="flex flex-col gap-4 items-start">
                    <div className="glass-pill bg-brand text-dark border-none font-black text-[9px] shadow-2xl flex items-center gap-2">
                       <div className="w-1.5 h-1.5 bg-dark rounded-full animate-pulse" />
                       MISSION LOGISTICS LIVE
                    </div>
                    
                    <motion.div 
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      className="premium-card p-4 sm:p-5 border-line bg-dark/80 backdrop-blur-xl w-fit shadow-2xl space-y-4"
                    >
                       <div>
                          <p className="text-[8px] font-black text-neutral-500 uppercase tracking-[0.2em] mb-2 leading-none">Telemetry Engine</p>
                          <div className="flex gap-8">
                             <div className="flex flex-col">
                                <span className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest mb-1 leading-none">Targets</span>
                                <span className="text-xl font-black text-white leading-none">{getOptimizedRoute.length}</span>
                             </div>
                             <div className="flex flex-col">
                                <span className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest mb-1 leading-none">Range</span>
                                <span className="text-xl font-black text-brand leading-none">
                                   {totalPathDistance.toFixed(1)}<span className="text-[8px] ml-0.5">KM</span>
                                </span>
                             </div>
                          </div>
                       </div>

                       {highDemandZones.length > 0 && (
                         <div className="pt-4 border-t border-white/10">
                            <p className="text-[8px] font-black text-red-500 uppercase tracking-[0.2em] mb-2 leading-none animate-pulse flex items-center gap-2">
                               <AlertCircle className="w-3 h-3" /> {highDemandZones.length} RED ZONES DETECTED
                            </p>
                            <p className="text-[9px] text-neutral-400 font-bold leading-tight">Proceed to clusters for max efficiency.</p>
                         </div>
                       )}

                       {getOptimizedRoute.length > 0 && (
                         <div className="pt-4 border-t border-white/10 space-y-2">
                            <p className="text-[8px] font-black text-brand uppercase tracking-[0.2em] mb-1 leading-none">Next Stop</p>
                            <p className="text-[10px] text-white font-black truncate max-w-[150px]">{getOptimizedRoute[0].location.address}</p>
                         </div>
                       )}
                    </motion.div>
                 </div>

                 {/* Bottom: Re-center */}
                 <div className="flex justify-end">
                    <button 
                      onClick={() => {
                        // Recenter via reactive centerPos logic in MapContainer
                      }}
                      className="w-12 h-12 bg-white text-dark rounded-xl flex items-center justify-center shadow-2xl pointer-events-auto hover:bg-brand transition-all"
                    >
                       <MapPin className="w-5 h-5" />
                    </button>
                 </div>
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
             className="space-y-8 px-4"
           >
              {/* Drive Mode - Visual Pipeline of Accepted Orders */}
              <div className="premium-card p-12 text-center space-y-8">
                 <div className="w-24 h-24 bg-brand/10 mx-auto rounded-[32px] flex items-center justify-center">
                    <Package className="w-12 h-12 text-brand" />
                 </div>
                 <div className="space-y-2">
                    <h2 className="text-4xl font-black tracking-tighter uppercase leading-none">Logistics Pipeline</h2>
                    <p className="text-neutral-500 font-bold uppercase tracking-widest text-xs">Active Transport Channels</p>
                 </div>
              </div>

              <div className="space-y-6">
                 {orders.filter(o => o.status === 'accepted' && o.sellerId === seller.id).length === 0 ? (
                    <div className="py-20 text-center opacity-20 border-2 border-dashed border-line rounded-[48px]">
                       <p className="font-black uppercase tracking-[0.4em]">No Active Pipelines</p>
                    </div>
                 ) : (
                    orders.filter(o => o.status === 'accepted' && o.sellerId === seller.id).map(order => (
                      <div key={order.id} className="premium-card p-10 flex border-l-8 border-l-brand">
                        <div className="flex-1 space-y-6">
                           <div className="flex items-center gap-4">
                              <span className="px-4 py-1.5 bg-brand text-dark text-[10px] font-black uppercase tracking-widest rounded-full">Active Drive</span>
                              <p className="text-xs text-neutral-600 font-bold uppercase tracking-widest">Target: {order.location.address}</p>
                           </div>
                           <div className="grid grid-cols-2 gap-8">
                              <div className="space-y-1">
                                 <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest leading-none">Payload</p>
                                 <p className="text-xl font-bold text-neutral-300 leading-tight">{order.items.map(i => i.name).join(', ')}</p>
                              </div>
                              <div className="space-y-1 text-right">
                                 <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest leading-none">Est. Yield</p>
                                 <p className="text-3xl font-black text-brand leading-none">{formatCurrency(order.totalAmount)}</p>
                              </div>
                           </div>
                           <button 
                             onClick={() => completeOrder(order.id, order.totalAmount)}
                             className="w-full py-6 bg-surface hover:bg-white/10 text-white border border-line rounded-[24px] font-black uppercase tracking-[0.3em] text-[10px] transition-all"
                           >
                             Finalize Logistics Channel
                           </button>
                        </div>
                      </div>
                    ))
                 )}
              </div>
           </motion.div>
        )}
      </AnimatePresence>

      {/* Global Navigation Rail */}
      <footer className="fixed bottom-0 left-0 right-0 p-4 sm:p-10 z-[100] pointer-events-none">
        <div className="max-w-md mx-auto h-16 sm:h-24 bg-dark/80 backdrop-blur-2xl rounded-2xl sm:rounded-[40px] border border-line flex items-center justify-around px-4 sm:px-8 shadow-[0_20px_50px_rgba(0,0,0,0.8)] pointer-events-auto">
          {[
            { id: 'dashboard', icon: TrendingUp, label: 'Stats' },
            { id: 'map', icon: Map, label: 'Map' },
            { id: 'drive', icon: Navigation, label: 'Drive' },
          ].map((item) => (
            <button 
              key={item.id}
              onClick={() => setActiveTab(item.id as any)} 
              className={cn(
                "flex flex-col items-center gap-1 sm:gap-1.5 transition-all w-16 sm:w-20 relative",
                activeTab === item.id ? "text-brand" : "text-neutral-600 hover:text-neutral-400"
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
              className="absolute inset-0 bg-dark/95 backdrop-blur-3xl"
            />
            <motion.div 
              initial={{ scale: 0.9, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 30, opacity: 0 }}
              className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-surface border border-brand/20 rounded-[32px] sm:rounded-[40px] p-6 sm:p-12 shadow-[0_50px_100px_-20px_rgba(0,0,0,1)] flex flex-col gap-6 sm:gap-8 custom-scrollbar scrollbar-hide"
            >
              {seller.onboardingComplete && (
                <button 
                  onClick={() => setShowOnboarding(false)}
                  className="absolute top-6 right-6 sm:top-10 sm:right-10 w-10 h-10 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center transition-all group"
                >
                  <X className="w-5 h-5 text-neutral-500 group-hover:text-white" />
                </button>
              )}
              <div className="space-y-3 sm:space-y-4">
                <div className="glass-pill bg-brand/20 text-brand border-brand/30 w-fit text-[8px] sm:text-[10px] px-3 py-1">Logistics Registration</div>
                <h2 className="text-3xl sm:text-6xl font-black uppercase tracking-tighter leading-none text-white">Merchant Profile</h2>
                <p className="text-neutral-500 font-bold uppercase tracking-[0.15em] text-[8px] sm:text-[10px] leading-relaxed">Setup your digital storefront & payout gateway</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
                 <div className="space-y-1.5 sm:space-y-2">
                   <div className="flex justify-between items-center px-1">
                     <label className="text-[8px] sm:text-[10px] font-black uppercase text-neutral-600 tracking-widest">Shop/Unit Name</label>
                     {errors.shopName && <span className="text-red-500 text-[7px] sm:text-[8px] font-bold uppercase animate-pulse">{errors.shopName}</span>}
                   </div>
                   <input 
                     type="text" 
                     placeholder="e.g. ORGANIC HARVEST"
                     value={onboardingData.shopName}
                     onChange={e => {
                       setOnboardingData({...onboardingData, shopName: e.target.value});
                       if (errors.shopName) setErrors(prev => { const n = {...prev}; delete n.shopName; return n; });
                     }}
                     className={cn(
                       "w-full bg-dark border rounded-xl sm:rounded-2xl px-4 sm:px-6 py-3.5 sm:py-4 text-sm font-bold focus:border-brand focus:outline-none transition-colors text-white placeholder:text-neutral-700",
                       errors.shopName ? "border-red-500/50 bg-red-500/5" : "border-line"
                     )}
                   />
                 </div>
                 <div className="space-y-1.5 sm:space-y-2">
                   <div className="flex justify-between items-center px-1">
                     <label className="text-[8px] sm:text-[10px] font-black uppercase text-neutral-600 tracking-widest">UPI ID (Payments)</label>
                     {errors.upiId && <span className="text-red-500 text-[7px] sm:text-[8px] font-bold uppercase animate-pulse">{errors.upiId}</span>}
                   </div>
                   <input 
                     type="text" 
                     placeholder="merchant@upi"
                     value={onboardingData.upiId}
                     onChange={e => {
                       setOnboardingData({...onboardingData, upiId: e.target.value});
                       if (errors.upiId) setErrors(prev => { const n = {...prev}; delete n.upiId; return n; });
                     }}
                     className={cn(
                       "w-full bg-dark border rounded-xl sm:rounded-2xl px-4 sm:px-6 py-3.5 sm:py-4 text-sm font-bold focus:border-brand focus:outline-none transition-colors text-white placeholder:text-neutral-700",
                       errors.upiId ? "border-red-500/50 bg-red-500/5" : "border-line"
                     )}
                   />
                 </div>
                 <div className="space-y-1.5 sm:space-y-2">
                   <label className="text-[8px] sm:text-[10px] font-black uppercase text-neutral-600 tracking-widest ml-1">Payment Number</label>
                   <input 
                     type="text" 
                     placeholder="+91 99999 00000"
                     value={onboardingData.phoneNumber}
                     onChange={e => setOnboardingData({...onboardingData, phoneNumber: e.target.value})}
                     className="w-full bg-dark border border-line rounded-xl sm:rounded-2xl px-4 sm:px-6 py-3.5 sm:py-4 text-sm font-bold focus:border-brand focus:outline-none transition-colors text-white placeholder:text-neutral-700"
                   />
                 </div>
                 <div className="space-y-1.5 sm:space-y-2">
                   <div className="flex justify-between items-center px-1">
                     <label className="text-[8px] sm:text-[10px] font-black uppercase text-neutral-600 tracking-widest">QR Payload (URL or File)</label>
                     {errors.qrCodeUrl && <span className="text-red-500 text-[7px] sm:text-[8px] font-bold uppercase animate-pulse">{errors.qrCodeUrl}</span>}
                   </div>
                   <div className="flex gap-2">
                     <input 
                       type="text" 
                       placeholder="URL or Upload File ->"
                       value={onboardingData.qrCodeUrl?.startsWith('data:') ? 'IMAGE FILE SELECTED' : (onboardingData.qrCodeUrl || '')}
                       onChange={e => setOnboardingData({...onboardingData, qrCodeUrl: e.target.value})}
                       className="flex-1 bg-dark border border-line rounded-xl sm:rounded-2xl px-4 sm:px-6 py-3.5 sm:py-4 text-sm font-bold focus:border-brand focus:outline-none transition-colors text-white placeholder:text-neutral-700"
                     />
                     <button 
                       type="button"
                       onClick={() => fileInputRef.current?.click()}
                       className="w-14 sm:w-16 bg-line hover:bg-neutral-800 rounded-xl sm:rounded-2xl flex items-center justify-center transition-colors border border-white/5"
                     >
                       <Upload className="w-5 h-5 text-neutral-400" />
                     </button>
                     <input 
                       type="file" 
                       ref={fileInputRef} 
                       className="hidden" 
                       accept="image/*" 
                       onChange={handleFileChange} 
                     />
                   </div>
                   {onboardingData.qrCodeUrl?.startsWith('data:') && (
                     <div className="mt-2 flex items-center gap-3 bg-brand/5 border border-brand/10 p-2 rounded-xl">
                        <img src={onboardingData.qrCodeUrl} className="w-10 h-10 object-cover rounded-lg" alt="Preview" />
                        <div className="flex-1">
                           <p className="text-[7px] font-black text-brand uppercase leading-none">File Encrypted into Payload</p>
                           <button 
                             type="button"
                             onClick={() => setOnboardingData({...onboardingData, qrCodeUrl: ''})}
                             className="text-[7px] text-red-500 font-bold uppercase hover:underline mt-1"
                           >
                             Remove & Switch to URL
                           </button>
                        </div>
                     </div>
                   )}
                 </div>
                 <div className="space-y-1.5 sm:space-y-2 sm:col-span-2">
                   <div className="flex justify-between items-center px-1">
                     <label className="text-[8px] sm:text-[10px] font-black uppercase text-neutral-600 tracking-widest">Base Logistics Hub (Address)</label>
                     {errors.address && <span className="text-red-500 text-[7px] sm:text-[8px] font-bold uppercase animate-pulse">{errors.address}</span>}
                   </div>
                   <input 
                     type="text" 
                     placeholder="Sector 12, Fresh Market Road..."
                     value={onboardingData.address}
                     onChange={e => {
                       setOnboardingData({...onboardingData, address: e.target.value});
                       if (errors.address) setErrors(prev => { const n = {...prev}; delete n.address; return n; });
                     }}
                     className={cn(
                       "w-full bg-dark border rounded-xl sm:rounded-2xl px-4 sm:px-6 py-3.5 sm:py-4 text-sm font-bold focus:border-brand focus:outline-none transition-colors text-white placeholder:text-neutral-700",
                       errors.address ? "border-red-500/50 bg-red-500/5" : "border-line"
                     )}
                   />
                 </div>
              </div>

              <div className="bg-brand/5 border border-brand/10 p-5 sm:p-6 rounded-2xl sm:rounded-3xl space-y-2 sm:space-y-3">
                 <div className="flex items-center gap-2 sm:gap-3">
                    <ShieldCheck className="text-brand w-4 h-4 sm:w-5 sm:h-5" />
                    <p className="text-[8px] sm:text-[10px] font-black text-white uppercase tracking-widest">Protocol Guard Active</p>
                 </div>
                 <p className="text-[7px] sm:text-[9px] font-bold text-neutral-500 uppercase leading-relaxed tracking-wider">
                   Payments are peer-to-peer. Fresh Routes only facilitates logistics routing. Ensure your UPI ID is correct for successful settlements.
                 </p>
              </div>

              <button 
                onClick={completeOnboarding}
                disabled={loading}
                className="w-full h-16 sm:h-20 bg-brand text-dark rounded-2xl sm:rounded-[24px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-[10px] sm:text-xs shadow-[0_20px_40px_rgba(255,184,0,0.2)] hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2 sm:gap-3 shrink-0 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />}
                {loading ? "INITIALIZING PROFILE..." : "ACTIVATE MERCHANT SIGNAL"}
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
                onClick={() => setIsTrialActive(false)}
                className="bg-dark text-brand px-4 py-2 sm:px-6 sm:py-3 rounded-xl sm:rounded-2xl font-black uppercase tracking-widest text-[8px] sm:text-[10px] hover:scale-105 active:scale-95 transition-all"
              >
                Upgrade
              </button>
           </div>
        </div>
      )}
    </div>
    </div>
  );
};

export default SellerView;
