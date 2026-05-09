import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, runTransaction, addDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { TrendingUp, Map, CheckCircle, Navigation, DollarSign, QrCode, Package, Users, ShieldCheck, AlertCircle, Play, MoreVertical, Signal, MapPin, Activity, Clock, Loader2, Leaf, Sprout, Upload, X, Star, UserX, LogOut, ShoppingBag, Settings, Store, Bell, Gift, BarChart3, ListChecks, Zap } from 'lucide-react';
import { Order, SellerProfile, MandiRate, Product } from '../types';
import { MANDI_RATES } from '../constants';
import MapContainer from './MapContainer';
import VendorAnalytics from './VendorAnalytics';
import { cn, formatCurrency, handleFirestoreError, OperationType } from '../lib/utils';
import { AIService } from '../services/aiService';
import { getVegetableImage } from '../lib/imageMapping';

interface SellerViewProps {
  seller: SellerProfile;
}

const SellerView: React.FC<SellerViewProps> = ({ seller }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'map' | 'analytics' | 'inventory' | 'subscription'>('dashboard');
  const [mandiRates, setMandiRates] = useState<MandiRate[]>([]);
  const [mandiInsight, setMandiInsight] = useState<string>('');
  const [optimizedRoute, setOptimizedRoute] = useState<Order[]>([]);
  const [isTrialActive, setIsTrialActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showQRModal, setShowQRModal] = useState(false);
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
        const merged = [...prev];
        pendingData.forEach(p => {
          const idx = merged.findIndex(o => o.id === p.id);
          if (idx !== -1) merged[idx] = p;
          else merged.push(p);
        });
        return merged;
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
        const merged = [...prev];
        assignedData.forEach(p => {
          const idx = merged.findIndex(o => o.id === p.id);
          if (idx !== -1) merged[idx] = p;
          else merged.push(p);
        });
        return merged;
      });
    }, (error) => {
      if (error.code === 'permission-denied') {
        console.warn("Assigned logistics stream encrypted/locked.");
      } else {
        handleFirestoreError(error, OperationType.LIST, 'orders/assigned', auth);
      }
    });

    const qMandi = query(collection(db, 'mandi_rates'));
    let isSeedingMandi = false;
    const unsubMandi = onSnapshot(qMandi, async (snap) => {
      const rates = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MandiRate));
      
      if (rates.length === 0 && !isSeedingMandi) {
        isSeedingMandi = true;
        for (const r of MANDI_RATES) {
          try {
            await addDoc(collection(db, 'mandi_rates'), r);
          } catch (e) {
            console.error(e);
          }
        }
        isSeedingMandi = false;
      } else if (rates.length > 0) {
        setMandiRates(rates);
        const insight = await AIService.getMandiInsights(rates);
        setMandiInsight(insight);
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
      return dist <= 12; // Increased to 12km to be safer for testing
    });
  }, [orders, seller.currentLocation, seller.id]);

  const getOptimizedRoute = useMemo(() => {
    const activeOrders = filteredOrders.filter(o => o.status === 'accepted' || o.status === 'ongoing');
    const pendingOrders = filteredOrders.filter(o => o.status === 'pending');
    
    // We prioritize accepted/ongoing orders as they are committed deliveries
    // But we look for high-value signals nearby to pick up along the way
    const targets = [...activeOrders, ...pendingOrders];
    if (targets.length === 0) return [];
    
    let currentPos = seller.currentLocation || { lat: 28.6139, lng: 77.2090 };
    const remaining = [...targets];
    const optimized: Order[] = [];
    
    const now = Date.now();

    while (remaining.length > 0) {
      let nextBestIdx = 0;
      let maxScore = -Infinity;
      
      for (let i = 0; i < remaining.length; i++) {
        const target = remaining[i];
        const dist = getDistance(currentPos.lat, currentPos.lng, target.location.lat, target.location.lng);
        
        // 1. Distance Penalty (Closer is fundamentally better)
        // 1km = -5 points (scaled for impact)
        const distScore = 15 / (dist + 0.5); 

        // 2. Timing Urgency (Age)
        const ageInMin = target.createdAt ? (now - new Date(target.createdAt).getTime()) / 60000 : 0;
        const urgencyScore = Math.min(ageInMin * 0.2, 10); // Max 10 points for being very old

        // 3. Strategic Density (Neighbors)
        const neighbors = remaining.filter((other, idx) => {
          if (idx === i) return false;
          return getDistance(target.location.lat, target.location.lng, other.location.lat, other.location.lng) < 0.6; // 600m
        });
        const clusteringScore = neighbors.length * 1.5;

        // 4. Commitment Status
        let commitmentBonus = 0;
        if (target.status === 'ongoing') commitmentBonus = 12; // Must finish current first
        else if (target.status === 'accepted') commitmentBonus = 6;  // Priority over signals

        const totalScore = distScore + urgencyScore + clusteringScore + commitmentBonus;

        if (totalScore > maxScore) {
          maxScore = totalScore;
          nextBestIdx = i;
        }
      }
      
      const next = remaining.splice(nextBestIdx, 1)[0];
      optimized.push(next);
      currentPos = next.location;
    }
    
    return optimized;
  }, [filteredOrders, seller.currentLocation]);

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
    setLoading(true);
    try {
      await runTransaction(db, async (transaction) => {
        const orderRef = doc(db, 'orders', orderId);
        
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists()) throw new Error("Order not found");
        
        const data = orderSnap.data();
        const customerId = data.customerId;
        if (!customerId) throw new Error("Customer identity lost in transmission");

        const earnedSuperCoins = Math.floor(Math.random() * 5) + 2; 

        // 1. Update order status
        transaction.update(orderRef, { 
          status: 'delivered',
          updatedAt: new Date().toISOString()
        });
        
        // 2. Create Reward document
        const rewardRef = doc(collection(db, 'rewards'));
        transaction.set(rewardRef, {
          userId: customerId,
          amount: earnedSuperCoins,
          status: 'unscratched',
          type: 'coins',
          createdAt: new Date().toISOString()
        });
      });
      alert("Order delivered! Rewards transmitted to customer.");
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `orders/${orderId}`, auth);
    } finally {
      setLoading(false);
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
    membershipExpiry: seller.subscriptionExpiry || '2026-12-31',
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
        membershipExpiry: seller.subscriptionExpiry || '2026-12-31',
      });
    }
  }, [showOnboarding, seller.businessDetails, seller.paymentInfo, seller.membershipPlan, seller.subscriptionExpiry]);

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

  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => {
    const qProducts = query(collection(db, 'products'), where('sellerId', '==', seller.id));
    const unsubProducts = onSnapshot(qProducts, (snap) => {
      setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });
    return () => unsubProducts();
  }, [seller.id]);

  const updateProductStock = async (productId: string, newStock: number) => {
    try {
      await updateDoc(doc(db, 'products', productId), { stock: newStock });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `products/${productId}`, auth);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7F5] text-dark pb-32 overflow-x-hidden relative font-sans">
      <AnimatePresence>
        {showQRModal && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowQRModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-[40px] shadow-2xl overflow-hidden p-10 flex flex-col items-center gap-8 text-center"
            >
              <button 
                onClick={() => setShowQRModal(false)}
                className="absolute top-6 right-6 w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="space-y-2">
                <p className="text-brand text-[10px] font-black uppercase tracking-[0.4em]">Payment Terminal</p>
                <h3 className="text-3xl font-display font-black tracking-tighter uppercase italic text-slate-900">Receive Payment</h3>
              </div>

              <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 shadow-inner group">
                {seller.paymentInfo?.qrCodeUrl ? (
                  <img 
                    src={seller.paymentInfo.qrCodeUrl} 
                    alt="Payment QR" 
                    className="w-48 h-48 object-contain"
                  />
                ) : (
                  <div className="w-48 h-48 flex flex-col items-center justify-center text-slate-300 gap-4">
                    <QrCode className="w-16 h-16 opacity-20" />
                    <p className="text-[10px] font-black uppercase tracking-widest leading-relaxed px-4">QR Code not configured in profile settings</p>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-900">{seller.paymentInfo?.upiId || "UPI ID Not Set"}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">{seller.businessDetails?.shopName || "Merchant Node"}</p>
              </div>

              <p className="text-[10px] font-bold text-slate-400 leading-relaxed max-w-[240px]">
                Ask the customer to scan this QR with any UPI app to complete the transaction securely.
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mandi Ticker */}
      <div className="bg-dark text-white py-3 overflow-hidden border-b border-white/5 relative z-[60]">
        <div className="flex animate-marquee whitespace-nowrap gap-12 items-center">
          {mandiInsight && (
             <div className="flex items-center gap-3">
               <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
               <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">{mandiInsight}</span>
             </div>
          )}
          {mandiRates.map((rate, i) => (
            <div key={i} className="flex items-center gap-3">
               <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{rate.vegetableName}</span>
               <span className="text-[11px] font-display font-black tabular-nums">{formatCurrency(rate.currentPrice)}</span>
               <span className={cn(
                 "text-[9px] font-black px-1.5 py-0.5 rounded",
                 rate.trend === 'rising' ? "bg-red-500/20 text-red-500" : "bg-brand/20 text-brand"
               )}>
                 {rate.trend === 'rising' ? '▲' : '▼'}
               </span>
            </div>
          ))}
          {/* Duplicate for smooth scroll */}
          {mandiRates.map((rate, i) => (
            <div key={`dup-${i}`} className="flex items-center gap-3">
               <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{rate.vegetableName}</span>
               <span className="text-[11px] font-display font-black tabular-nums">{formatCurrency(rate.currentPrice)}</span>
               <span className={cn(
                 "text-[9px] font-black px-1.5 py-0.5 rounded",
                 rate.trend === 'rising' ? "bg-red-500/20 text-red-500" : "bg-brand/20 text-brand"
               )}>
                 {rate.trend === 'rising' ? '▲' : '▼'}
               </span>
            </div>
          ))}
        </div>
      </div>

      {/* Top Header */}
      <header className="glass-premium px-4 md:px-8 py-4 md:py-6 flex justify-between items-center sticky top-0 z-50 border-b border-slate-100">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-dark rounded-xl md:rounded-2xl flex items-center justify-center text-white shadow-xl relative group">
            <Sprout className="w-5 h-5 md:w-6 md:h-6 text-brand" />
            <button 
              onClick={() => setShowQRModal(true)}
              className="absolute -right-2 -bottom-2 w-6 h-6 bg-brand rounded-lg flex items-center justify-center text-white shadow-lg border-2 border-white hover:scale-110 transition-transform active:scale-95"
              title="Show Payment QR"
            >
              <QrCode className="w-3.5 h-3.5" />
            </button>
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-display font-black text-slate-900 tracking-tighter uppercase leading-none italic">
              Seller<span className="text-brand">Hub</span>
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5 md:mt-1">
               <span className={cn("w-1.5 h-1.5 rounded-full", seller.isOnline ? "bg-brand animate-pulse" : "bg-red-500")} />
               <span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">
                 {seller.isOnline ? "OPERATOR ACTIVE" : "OPERATOR OFFLINE"}
               </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 md:gap-4">
           <button 
             onClick={() => {
               updateDoc(doc(db, 'users', seller.id), { isOnline: !seller.isOnline })
                 .catch(err => console.error("Status update failed", err));
             }}
             className={cn(
               "hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm border",
               seller.isOnline 
                 ? "bg-brand/10 text-brand border-brand/20" 
                 : "bg-red-50 text-red-500 border-red-100"
             )}
           >
             {seller.isOnline ? "ONLINE" : "OFFLINE"}
           </button>
           <button 
             onClick={() => auth.signOut()}
             className="w-10 h-10 md:w-12 md:h-12 bg-slate-50 border border-slate-100 rounded-xl md:rounded-2xl flex items-center justify-center text-slate-400 hover:text-red-500 transition-all shadow-sm"
           >
              <LogOut className="w-4 h-4 md:w-5 md:h-5" />
           </button>
        </div>
      </header>

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
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                 <div className="bg-white border border-slate-100 rounded-[24px] md:rounded-[32px] p-6 shadow-sm space-y-2 group hover:shadow-xl transition-all">
                    <TrendingUp className="w-5 h-5 text-brand mb-2" />
                    <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Sales</p>
                    <p className="text-xl md:text-3xl font-display font-black text-slate-800 tabular-nums uppercase italic">{formatCurrency(totalEarnings)}</p>
                 </div>
                 <div className="bg-white border border-slate-100 rounded-[24px] md:rounded-[32px] p-6 shadow-sm space-y-2 group hover:shadow-xl transition-all">
                    <ShoppingBag className="w-5 h-5 text-blue-500 mb-2" />
                    <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Deliveries</p>
                    <p className="text-xl md:text-3xl font-display font-black text-slate-800 tabular-nums uppercase italic">
                      {filteredOrders.filter(o => o.status === 'delivered').length}
                    </p>
                 </div>
                 <div className="bg-white border border-slate-100 rounded-[24px] md:rounded-[32px] p-6 shadow-sm space-y-2 group hover:shadow-xl transition-all">
                    <Star className="w-5 h-5 text-amber-500 mb-2" />
                    <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Market Score</p>
                    <p className="text-xl md:text-3xl font-display font-black text-brand tabular-nums uppercase italic">{seller.averageRating?.toFixed(1) || "5.0"}</p>
                 </div>
                 <button 
                  onClick={() => setShowOnboarding(true)}
                  className="bg-white border border-slate-100 rounded-[24px] md:rounded-[32px] p-6 shadow-sm flex flex-col justify-center items-center gap-2 hover:border-brand text-slate-400 hover:text-brand transition-all shadow-sm"
                 >
                    <Settings className="w-6 h-6" />
                    <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest">Edit Node</p>
                 </button>
              </div>

              {/* Shop Identity Section */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 bg-white border border-gray-100 rounded-[24px] sm:rounded-[32px] p-6 sm:p-8 flex flex-col sm:flex-row gap-6 sm:gap-8 shadow-sm group">
                  <div className="w-20 h-20 sm:w-32 sm:h-32 bg-gray-50 rounded-[20px] sm:rounded-[24px] border border-gray-100 flex-shrink-0 overflow-hidden flex items-center justify-center relative">
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
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-[10px] font-black text-brand uppercase tracking-widest">
                          <Clock className="w-3 h-3" />
                          {seller.businessDetails?.operatingHours || "Set Hours"}
                        </div>
                        <div className="bg-slate-900 border border-white/10 px-2 py-0.5 rounded-md flex items-center gap-1.5">
                           <ShieldCheck className="w-2.5 h-2.5 text-brand" />
                           <span className="text-[8px] font-black uppercase text-white tracking-widest">{seller.membershipPlan || 'Standard'}</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm font-medium text-gray-400 uppercase tracking-wider leading-relaxed line-clamp-2">
                      {seller.businessDetails?.bio || "No business biography provided yet. Update your profile to stand out in the marketplace."}
                    </p>
                  </div>
                </div>
                <div className="bg-brand/5 border border-brand/10 rounded-[24px] sm:rounded-[32px] p-6 sm:p-8 space-y-4 sm:space-y-6 flex flex-col justify-center">
                   <div className="space-y-1">
                      <p className="text-[9px] sm:text-[10px] font-black text-brand uppercase tracking-widest">Trust Index</p>
                      <div className="flex items-center gap-2 sm:gap-3">
                        <h4 className="text-3xl sm:text-4xl font-black text-brand tracking-tighter">{seller.averageRating?.toFixed(1) || "5.0"}</h4>
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
                   className="btn-premium px-12 py-5 text-sm w-full md:w-auto border-brand-dark shadow-xl"
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
                           <div className="flex justify-between items-start">
                              <h4 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter text-gray-800 leading-none">{order.location.address}</h4>
                              {order.deliveryTimePreference && (
                                <div className="bg-brand text-white px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-lg shadow-brand/20">
                                   <Clock className="w-3.5 h-3.5" />
                                   <span className="text-[10px] font-black uppercase italic tracking-tighter">{order.deliveryTimePreference}</span>
                                </div>
                              )}
                           </div>
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
                              disabled={loading}
                              onClick={() => startDeparture(order.id)}
                              className="btn-premium flex-1 py-5 text-xs gap-2 !bg-slate-900 border-black disabled:opacity-50"
                            >
                              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-brand text-brand" />}
                              Start Delivery
                            </button>
                          ) : (
                            <button 
                              disabled={loading}
                              onClick={() => completeOrder(order.id, order.totalAmount)}
                              className="btn-premium flex-1 py-5 text-xs disabled:opacity-50"
                            >
                              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Mark Delivered"}
                            </button>
                          )}
                          <button 
                            onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${order.location.lat},${order.location.lng}`)}
                            className="w-16 bg-white border border-slate-100 rounded-2xl flex items-center justify-center shadow-premium hover:bg-slate-50 transition-all"
                          >
                            <Navigation className="w-6 h-6 text-brand" />
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

          {activeTab === 'analytics' && (
             <motion.div 
               key="analytics"
               initial={{ opacity: 0, x: 20 }}
               animate={{ opacity: 1, x: 0 }}
               exit={{ opacity: 0, x: -20 }}
             >
               <VendorAnalytics orders={orders} />
             </motion.div>
          )}

          {activeTab === 'subscription' && (
             <motion.div 
               key="subscription"
               initial={{ opacity: 0, scale: 0.98 }}
               animate={{ opacity: 1, scale: 1 }}
               className="space-y-8"
             >
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 px-1">
                 <div>
                   <h3 className="text-2xl sm:text-3xl font-display font-black text-slate-900 tracking-tight uppercase italic text-gradient-brand">Membership Hub</h3>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Manage your growth and platform access</p>
                 </div>
                 <div className="flex items-center gap-3 bg-white px-6 py-3 rounded-2xl border border-slate-100 shadow-sm">
                   <div className="w-2 h-2 bg-brand rounded-full animate-pulse" />
                   <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Next Billing: Aug 2026</span>
                 </div>
               </div>

               {/* Current Plan Hero */}
               <div className="glass-premium !bg-dark rounded-[32px] sm:rounded-[40px] p-6 sm:p-8 md:p-12 text-white relative overflow-hidden group border-none">
                 <div className="absolute top-0 right-0 w-96 h-96 bg-brand/10 rounded-full blur-[120px] -mr-48 -mt-48 group-hover:bg-brand/20 transition-colors duration-700" />
                 <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                   <div className="space-y-6">
                     <div className="flex items-center gap-3">
                        <span className="px-3 py-1 bg-brand text-dark text-[9px] font-black uppercase rounded-full">Active Plan</span>
                        <h4 className="text-3xl sm:text-4xl md:text-5xl font-display font-black tracking-tighter italic uppercase">{seller.membershipPlan || 'Standard'}</h4>
                     </div>
                     <p className="text-slate-400 text-sm font-medium leading-relaxed max-w-md">
                       You are currently optimizing your local mandi with our {seller.membershipPlan || 'standard'} toolkit. Upgrade to Premium to unlock AI-powered demand forecasting and priority delivery radar.
                     </p>
                     <div className="flex flex-wrap gap-4">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-300">
                          <CheckCircle className="w-4 h-4 text-brand" />
                          Up to 20 Daily Deliveries
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-300">
                          <CheckCircle className="w-4 h-4 text-brand" />
                          Basic Inventory AI
                        </div>
                     </div>
                   </div>
                   
                   <div className="bg-white/5 backdrop-blur-xl rounded-[32px] p-8 border border-white/10 space-y-8">
                      <div className="flex justify-between items-end border-b border-white/5 pb-6">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Annual Savings Applied</p>
                          <p className="text-3xl font-display font-black italic">₹0 <span className="text-sm font-bold text-slate-500 not-italic uppercase tracking-widest">/ Year</span></p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black text-brand uppercase tracking-widest mb-2">Status</p>
                          <p className="text-xs font-black uppercase tracking-wider">Lifetime Free</p>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Platform Utilization</p>
                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-brand w-[15%] rounded-full" />
                        </div>
                        <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest">15% of Standard Volume used this week</p>
                      </div>
                   </div>
                 </div>
               </div>

               {/* Plan Grid */}
               <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                 {[
                   { 
                     id: 'standard', 
                     name: 'Standard', 
                     price: 'Free', 
                     desc: 'Perfect for new hyperlocal nodes just starting digitization.',
                     features: ['20 Live Orders/Day', 'Basic Analytics', 'Standard Support', 'QR Payments'],
                     color: 'slate'
                   },
                   { 
                     id: 'premium', 
                     name: 'Premium', 
                     price: '₹499/mo', 
                     desc: 'Designed for high-velocity vendors looking to dominate neighborhoods.',
                     features: ['Unlimited Orders', 'AI Demand Radar', 'Priority Delivery SEO', 'WhatsApp Automation'],
                     color: 'brand',
                     highlight: true
                   },
                   { 
                     id: 'enterprise', 
                     name: 'Enterprise', 
                     price: 'Contact Sales', 
                     desc: 'Bespoke logistics solutions for large-scale farm networks.',
                     features: ['Custom API Access', 'Multi-Store Dash', 'Dedicated Account Manager', 'White-label Support'],
                     color: 'dark'
                   }
                 ].map((plan) => (
                   <div 
                     key={plan.id}
                     className={cn(
                       "premium-card flex flex-col p-8 transition-all duration-500 group",
                       plan.highlight ? "border-brand shadow-brand-glow/10 ring-1 ring-brand/50 relative" : "hover:border-slate-200"
                     )}
                   >
                     {plan.highlight && (
                       <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-brand text-dark px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-brand-glow">
                         Most Popular for Scale
                       </div>
                     )}
                     <div className="space-y-6 flex-1">
                        <div>
                          <p className={cn("text-[10px] font-black uppercase tracking-widest mb-1", plan.highlight ? "text-brand" : "text-slate-400")}>{plan.name}</p>
                          <h5 className="text-3xl font-display font-black italic uppercase tracking-tighter">{plan.price}</h5>
                        </div>
                        <p className="text-xs font-medium text-slate-500 leading-relaxed mb-6">
                          {plan.desc}
                        </p>
                        <div className="space-y-3">
                          {plan.features.map((feat, i) => (
                            <div key={i} className="flex items-center gap-3 text-[10px] font-bold text-slate-600 uppercase tracking-tight">
                               <div className={cn("w-1.5 h-1.5 rounded-full", plan.highlight ? "bg-brand" : "bg-slate-300")} />
                               {feat}
                            </div>
                          ))}
                        </div>
                     </div>
                     
                     <button className={cn(
                       "w-full py-4 mt-10 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all",
                       plan.id === (seller.membershipPlan || 'standard') 
                         ? "bg-slate-50 text-slate-400 border border-slate-100 cursor-not-allowed"
                         : plan.highlight 
                           ? "bg-brand text-dark shadow-brand-glow hover:translate-y-[-2px]" 
                           : "bg-dark text-white hover:bg-slate-900"
                     )}>
                       {plan.id === (seller.membershipPlan || 'standard') ? 'Current Plan' : `Upgrade to ${plan.name}`}
                     </button>
                   </div>
                 ))}
               </div>
             </motion.div>
          )}

          {activeTab === 'inventory' && (
             <motion.div 
               key="inventory"
               initial={{ opacity: 0, x: 20 }}
               animate={{ opacity: 1, x: 0 }}
               exit={{ opacity: 0, x: -20 }}
               className="space-y-6"
             >
               <div className="flex justify-between items-center px-1">
                 <div>
                   <h3 className="text-2xl font-display font-black text-slate-900 tracking-tight uppercase italic text-gradient-brand">Fresh Inventory</h3>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Manage stock and freshness levels</p>
                 </div>
                 <button className="btn-premium py-3 px-6 text-[10px] shadow-sm">Add New Harvest</button>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {products.map(product => (
                   <div key={product.id} className="premium-card group overflow-hidden">
                      <div className="relative h-48 -mx-8 -mt-8 mb-6 overflow-hidden">
                        <img 
                          src={getVegetableImage(product.name)} 
                          className="w-full h-full object-cover transition-transform group-hover:scale-110" 
                          alt={product.name} 
                          loading="lazy"
                        />
                        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-sm">
                           <Leaf className="w-3 h-3 text-brand" />
                           <span className="text-[10px] font-black uppercase text-brand">{product.freshnessScore}% Fresh</span>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="text-xl font-display font-black uppercase italic tracking-tighter">{product.name}</h4>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{product.category} • {formatCurrency(product.price)}/{product.unit}</p>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                           <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                             <span className="text-slate-400">Current Stock</span>
                             <span className={cn(product.stock < 5 ? "text-red-500" : "text-slate-900")}>{product.stock} {product.unit}s</span>
                           </div>
                           <div className="h-1.5 bg-slate-50 rounded-full overflow-hidden">
                             <div 
                               className={cn("h-full rounded-full transition-all", product.stock < 5 ? "bg-red-500" : "bg-brand")} 
                               style={{ width: `${Math.min(100, (product.stock / 50) * 100)}%` }} 
                             />
                           </div>
                        </div>

                        <div className="flex gap-2">
                           <button 
                             onClick={() => updateProductStock(product.id, Math.max(0, product.stock - 5))}
                             className="flex-1 py-3 bg-slate-50 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100"
                           >
                             - 5 Units
                           </button>
                           <button 
                             onClick={() => updateProductStock(product.id, product.stock + 5)}
                             className="flex-1 py-3 bg-slate-50 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100"
                           >
                             + 5 Units
                           </button>
                        </div>
                      </div>
                   </div>
                 ))}
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
                       className="btn-premium px-10 py-5 text-xs pointer-events-auto shadow-2xl"
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
              {/* Intelligent Driver Interface */}
              <div className="bg-dark rounded-[40px] p-8 sm:p-12 text-white relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                   <Activity className="w-64 h-64" />
                </div>
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-end gap-8">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 bg-brand rounded-full animate-pulse" />
                      <span className="text-[10px] font-black text-brand uppercase tracking-widest">Mission Protocol Active</span>
                    </div>
                    <h2 className="text-4xl sm:text-5xl font-black uppercase tracking-tighter leading-none italic">Drive<span className="text-brand">Mode</span></h2>
                    <p className="text-white/50 text-sm font-medium max-w-sm uppercase tracking-wider">
                      Optimization active for {getOptimizedRoute.length} sequence points.
                    </p>
                  </div>
                  <div className="text-right flex flex-col items-end">
                     <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Estimated Leg</p>
                     <p className="text-4xl font-black text-white tabular-nums">~{Math.ceil(totalPathDistance * 3)} <span className="text-sm font-bold text-brand italic">MIN</span></p>
                  </div>
                </div>
              </div>

              {/* Sequenced Route List */}
              <div className="space-y-6">
                <div className="flex justify-between items-center px-1">
                   <h3 className="text-xl font-black uppercase tracking-tighter">Optimized Sequence</h3>
                   <div className="flex items-center gap-2">
                      <div className="px-3 py-1 bg-white border border-gray-100 rounded-lg text-[9px] font-black uppercase text-gray-500 tracking-widest">
                        {totalPathDistance.toFixed(1)} KM TOTAL
                      </div>
                   </div>
                </div>

                <div className="space-y-4 relative">
                  {/* Vertical Progress Line */}
                  <div className="absolute left-10 top-0 bottom-0 w-0.5 bg-gray-100 hidden md:block" />

                  {getOptimizedRoute.length === 0 ? (
                    <div className="bg-white border-2 border-dashed border-gray-100 rounded-[40px] p-24 text-center opacity-30">
                      <p className="font-black uppercase tracking-[0.4em]">No Optimized Paths Found</p>
                    </div>
                  ) : (
                    getOptimizedRoute.map((order, index) => (
                      <motion.div 
                        key={order.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className={cn(
                          "relative bg-white border rounded-[40px] p-8 flex flex-col md:flex-row gap-8 items-center transition-all",
                          index === 0 ? "border-brand shadow-xl ring-4 ring-brand/5" : "border-gray-100 shadow-sm opacity-80"
                        )}
                      >
                        {/* Sequence Badge */}
                        <div className="hidden md:flex absolute left-8 top-1/2 -translate-x-full -translate-y-1/2 items-center justify-end pr-8">
                           <div className={cn(
                             "w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-black transition-colors bg-white",
                             index === 0 ? "border-brand text-brand" : "border-gray-100 text-gray-300"
                           )}>
                             {index + 1}
                           </div>
                        </div>

                        <div className="flex-1 space-y-4 w-full">
                           <div className="flex items-center gap-3">
                              <span className={cn(
                                "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest",
                                order.status === 'pending' ? "bg-amber-100 text-amber-600" : "bg-brand/10 text-brand"
                              )}>
                                {order.status === 'pending' ? 'PICKUP SIGNAL' : 'DELIVERY POINT'}
                              </span>
                              {index === 0 && <span className="bg-brand text-white px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter">NEXT STOP</span>}
                           </div>
                           <div>
                              <h4 className="text-2xl font-black uppercase tracking-tighter text-gray-800 leading-none mb-1">{order.location.address}</h4>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest italic">
                                {order.status === 'pending' ? "Demand detection at this node" : "Assigned Payload Delivery"}
                              </p>
                           </div>
                           <div className="flex flex-wrap gap-2">
                             {order.items.map((i, idx) => (
                               <span key={idx} className="bg-gray-50 px-3 py-1.5 rounded-xl text-[10px] font-bold text-gray-400 uppercase">
                                 {i.name} × {i.quantity}
                               </span>
                             ))}
                           </div>
                        </div>

                        <div className="w-full md:w-auto flex flex-col gap-3">
                           {order.status === 'pending' ? (
                             <button 
                               onClick={() => acceptOrder(order.id)}
                               className="w-full md:w-48 bg-gray-50 hover:bg-brand hover:text-white py-5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm"
                             >
                               Accept for Route
                             </button>
                           ) : order.status === 'accepted' ? (
                             <button 
                               onClick={() => startDeparture(order.id)}
                               className="w-full md:w-48 bg-brand text-white py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:scale-105 transition-all shadow-lg shadow-brand/20 flex items-center justify-center gap-2"
                             >
                               <Play className="w-3 h-3 fill-white" />
                               Start Delivery
                             </button>
                           ) : (
                             <button 
                               onClick={() => completeOrder(order.id, order.totalAmount)}
                               className="w-full md:w-48 bg-dark text-white py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-brand transition-all shadow-lg"
                             >
                               Complete Task
                             </button>
                           )}
                           <button 
                             onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${order.location.lat},${order.location.lng}`)}
                             className="w-full py-3 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-center gap-2 text-[8px] font-black uppercase tracking-widest text-gray-400 hover:text-brand transition-colors"
                           >
                             <Navigation className="w-3.5 h-3.5" />
                             External Nav
                           </button>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation Rail */}
      <footer className="fixed bottom-6 left-0 right-0 px-4 sm:px-10 z-[120] pointer-events-none">
        <div className="max-w-lg mx-auto h-20 sm:h-24 bg-dark/95 backdrop-blur-3xl rounded-[32px] sm:rounded-[40px] border border-white/10 flex items-center justify-around px-4 sm:px-8 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] pointer-events-auto">
          {[
            { id: 'dashboard', icon: Store, label: 'HUB' },
            { id: 'analytics', icon: BarChart3, label: 'INSIGHTS' },
            { id: 'subscription', icon: ShieldCheck, label: 'MEMBERSHIP' },
            { id: 'map', icon: Activity, label: 'RADAR' },
            { id: 'inventory', icon: ListChecks, label: 'STOCK' },
          ].map((item) => (
            <button 
              key={item.id}
              onClick={() => setActiveTab(item.id as any)} 
              className={cn(
                "flex flex-col items-center gap-1 sm:gap-1.5 transition-all w-14 sm:w-20 relative group",
                activeTab === item.id ? "text-brand" : "text-white/40 hover:text-white/70"
              )}
            >
              <item.icon className={cn("w-5 h-5 sm:w-7 sm:h-7 transition-transform group-hover:scale-110", activeTab === item.id && "scale-110")} />
              <span className="text-[7px] sm:text-[9px] font-black uppercase tracking-[0.2em] leading-none">{item.label}</span>
              {activeTab === item.id && (
                <motion.div layoutId="nav-indicator" className="absolute -bottom-2 w-1.5 h-1.5 bg-brand rounded-full shadow-[0_0_10px_#10B981]" />
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
                <div className="bg-brand/10 text-brand border border-brand/20 w-fit text-[8px] sm:text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest">Merchant Settings</div>
                <h2 className="text-3xl sm:text-6xl font-black uppercase tracking-tighter leading-none text-gray-800">Shop Profile</h2>
                <p className="text-gray-400 font-bold uppercase tracking-[0.15em] text-[8px] sm:text-[10px] leading-relaxed">Setup your shop details, subscription & payment information</p>
              </div>

              {/* Subscription Plan Summary */}
              <div className="bg-slate-900 rounded-[32px] p-6 sm:p-8 text-white relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                   <ShieldCheck className="w-32 h-32 rotate-12" />
                </div>
                <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                   <div className="space-y-2">
                     <div className="flex items-center gap-2">
                       <span className="bg-brand text-dark text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">Current Plan</span>
                       <h4 className="text-2xl font-black uppercase tracking-tighter italic">{onboardingData.membershipPlan} Edition</h4>
                     </div>
                     <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.2em]">Expires on {new Date(onboardingData.membershipExpiry).toLocaleDateString()}</p>
                   </div>
                   <div className="flex flex-col items-start sm:items-end gap-1">
                      <p className="text-[8px] font-black text-white/40 uppercase tracking-widest">Account Status</p>
                      <div className="flex items-center gap-2 px-3 py-1 bg-brand/10 border border-brand/20 rounded-lg">
                        <div className="w-1.5 h-1.5 bg-brand rounded-full animate-pulse" />
                        <span className="text-[10px] font-black text-brand uppercase tracking-widest">Active & Verified</span>
                      </div>
                   </div>
                </div>
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
                    <label className="text-[8px] sm:text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Subscription & Growth Plans</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {(['standard', 'premium', 'enterprise'] as const).map((plan) => (
                        <button
                          key={plan}
                          onClick={() => setOnboardingData({...onboardingData, membershipPlan: plan})}
                          className={cn(
                            "p-5 rounded-3xl border-2 text-left transition-all relative overflow-hidden group",
                            onboardingData.membershipPlan === plan 
                              ? "border-brand bg-brand/5 shadow-brand-glow/10" 
                              : "border-gray-100 bg-gray-50 hover:border-gray-200"
                          )}
                        >
                          <div className="relative z-10 space-y-2">
                            <div className="flex justify-between items-start">
                              <p className={cn("text-[8px] font-black uppercase tracking-widest", onboardingData.membershipPlan === plan ? "text-brand" : "text-gray-400")}>{plan}</p>
                              {plan === 'premium' && <Gift className="w-3 h-3 text-amber-500 animate-bounce" />}
                            </div>
                            <div>
                               <p className="text-lg font-black text-gray-800 uppercase leading-none">
                                 {plan === 'standard' ? 'Free' : plan === 'premium' ? '₹499/mo' : 'Contact Scale'}
                               </p>
                               <p className="text-[7px] font-bold text-gray-400 uppercase leading-none mt-1.5">
                                 {plan === 'standard' ? 'Basic Listing & Simple Routing' : plan === 'premium' ? 'AI Radar & Multi-point Route' : 'Enterprise Logistics & API'}
                               </p>
                            </div>
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
