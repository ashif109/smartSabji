import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, where, getDocs } from 'firebase/firestore';
import { Users, ShoppingBag, BarChart3, ShieldAlert, CheckCircle2, UserX, Database, Activity, Globe, Zap, ArrowUpRight, Search, Sprout, RefreshCw, Sparkles, LayoutDashboard, Truck, PieChart, MoreHorizontal, Filter, ShieldCheck, Mail, IndianRupee, UserCircle } from 'lucide-react';
import { UserProfile, Order, Product } from '../types';
import { formatCurrency, cn, handleFirestoreError, OperationType } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import GeminiMarketInsights from './GeminiMarketInsights';
import { PRODUCTS } from '../constants';

const AdminView: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'directory' | 'logistics' | 'analytics'>('directory');
  const [searchQuery, setSearchQuery] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile)));
    }, (error) => {
      if (error.code === 'permission-denied') {
        console.warn("Administrative access restricted by cloud rules.");
      } else {
        handleFirestoreError(error, OperationType.LIST, 'users', auth);
      }
    });

    const unsubOrders = onSnapshot(collection(db, 'orders'), (snap) => {
      setOrders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
    }, (error) => {
      if (error.code === 'permission-denied') {
        console.warn("Administrative logistics restricted by cloud rules.");
      } else {
        handleFirestoreError(error, OperationType.LIST, 'orders', auth);
      }
    });
    return () => { unsubUsers(); unsubOrders(); };
  }, []);

  const totalRevenue = orders.reduce((acc, o) => acc + (o.totalAmount || 0), 0);
  const activeSellers = users.filter(u => u.role === 'seller').length;
  const activeCustomers = users.filter(u => u.role === 'customer').length;

  const syncCatalog = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncStatus("Warming engines...");
    
    try {
      const snap = await getDocs(collection(db, 'products'));
      const dbProducts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      
      let updatedCount = 0;
      for (const p of PRODUCTS) {
        setSyncStatus(`Syncing: ${p.name}`);
        const existing = dbProducts.find(dbP => dbP.name === p.name);
        if (existing) {
          await updateDoc(doc(db, 'products', existing.id), {
            imageUrl: p.imageUrl,
            description: p.description,
            localNames: p.localNames
          });
          updatedCount++;
        }
      }
      setSyncStatus(`Success! Updated ${updatedCount} items.`);
    } catch (error) {
      console.error("Sync failed:", error);
      setSyncStatus("Sync failed. Check console.");
    } finally {
      setTimeout(() => setSyncStatus(null), 3000);
      setIsSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-24 font-sans">
      {/* Premium Header */}
      <header className="glass-premium px-8 py-6 sticky top-0 z-50 transition-all border-b border-slate-100 flex justify-between items-center">
        <div className="flex items-center gap-5">
           <motion.div 
            whileHover={{ rotate: 15 }}
            className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white"
          >
            <Sprout className="w-7 h-7 text-brand" />
          </motion.div>
          <div>
            <h1 className="text-2xl font-display font-black text-slate-900 tracking-tighter uppercase leading-none italic">
              Control <span className="text-brand">Center</span>
            </h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1 italic">V3.4.0 High-Efficiency Node</p>
          </div>
        </div>

        <div className="flex items-center gap-5">
          {syncStatus && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="px-6 py-2.5 bg-brand border border-brand/20 rounded-2xl flex items-center gap-3 shadow-brand-glow"
            >
              <RefreshCw className={cn("w-4 h-4 text-white", isSyncing ? "animate-spin" : "")} />
              <span className="text-[10px] font-black text-white uppercase tracking-[0.1em] italic">{syncStatus}</span>
            </motion.div>
          )}
          
          <div className="flex items-center gap-3">
             <button 
               disabled={isSyncing}
               onClick={syncCatalog}
               className="btn-premium py-3 px-6 text-[10px] shadow-sm hover:shadow-brand-glow"
             >
                <Database className="w-4 h-4" />
                <span>Sync Node Catalog</span>
             </button>
             <button 
               onClick={() => auth.signOut()} 
               className="w-12 h-12 flex items-center justify-center bg-red-50 border border-red-100 rounded-2xl text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm"
             >
                <UserX className="w-5 h-5" />
             </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-10 space-y-12">
        {/* Real-time Ticker / Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { label: 'Revenue Pool', value: formatCurrency(totalRevenue), icon: IndianRupee, change: '+14%', color: 'text-brand' },
            { label: 'Retailer Nodes', value: activeSellers, icon: Truck, change: '+5%', color: 'text-brand' },
            { label: 'User Protocol', value: activeCustomers, icon: Users, change: '+22%', color: 'text-brand' },
            { label: 'Latency Index', value: '14ms', icon: Activity, change: 'Optimal', color: 'text-brand' },
          ].map((stat, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="premium-card p-8 group relative overflow-hidden"
            >
               <div className="absolute -right-4 -top-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                  <stat.icon className="w-24 h-24 stroke-[3px]" />
               </div>
               <div className="flex justify-between items-start mb-4">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{stat.label}</span>
                  <div className="px-2 py-1 bg-brand/5 rounded-lg text-[9px] font-black text-brand italic">{stat.change}</div>
               </div>
               <p className="text-4xl font-display font-black text-slate-900 tabular-nums italic tracking-tighter leading-none">{stat.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Console Tabs */}
        <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
           <div className="flex gap-3 p-2 bg-white border border-slate-100 rounded-[28px] shadow-sm">
             {[
               { id: 'directory', label: 'Identity Directory', icon: Users },
               { id: 'logistics', label: 'Logistics Stream', icon: Truck },
               { id: 'analytics', label: 'Market Metrics', icon: BarChart3 },
             ].map((tab) => (
               <button
                 key={tab.id}
                 onClick={() => setActiveTab(tab.id as any)}
                 className={cn(
                   "px-8 py-4 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-3",
                   activeTab === tab.id 
                     ? "bg-slate-900 text-white shadow-xl shadow-slate-900/20" 
                     : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                 )}
               >
                 <tab.icon className={cn("w-4 h-4", activeTab === tab.id ? "text-brand" : "")} />
                 <span>{tab.label}</span>
               </button>
             ))}
           </div>

           <div className="relative w-full md:w-96 group">
             <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5 group-focus-within:text-brand transition-colors" />
             <input 
               type="text" 
               placeholder="Query Identity Index..." 
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               className="w-full bg-white border border-slate-100 rounded-[24px] pl-16 pr-8 py-4 text-sm font-bold focus:border-brand focus:ring-8 focus:ring-brand/5 outline-none transition-all shadow-sm"
             />
           </div>
        </div>

        {/* Content Modules */}
        <AnimatePresence mode="wait">
          {activeTab === 'directory' && (
            <motion.div 
               key="directory"
               initial={{ opacity: 0, scale: 0.98 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.98 }}
               className="bg-white border border-slate-100 rounded-[40px] shadow-premium overflow-hidden"
            >
               <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50/50 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100">
                        <th className="px-10 py-6">Operational Identity</th>
                        <th className="px-10 py-6">Protocol Type</th>
                        <th className="px-10 py-6">Wallet Node</th>
                        <th className="px-10 py-6">Signal Status</th>
                        <th className="px-10 py-6 text-right">Access</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {users.filter(u => 
                        u.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        u.email.toLowerCase().includes(searchQuery.toLowerCase())
                      ).map(user => (
                        <tr key={user.id} className="hover:bg-slate-50/30 transition-all group">
                          <td className="px-10 py-8">
                            <div className="flex items-center gap-4">
                               <div className="w-12 h-12 bg-slate-100 border border-slate-200 rounded-2xl flex items-center justify-center shrink-0">
                                  {user.photoURL ? (
                                    <img src={user.photoURL} alt="" className="w-full h-full object-cover rounded-2xl" />
                                  ) : (
                                    <UserCircle className="w-6 h-6 text-slate-300" />
                                  )}
                               </div>
                               <div>
                                  <div className="font-display font-black text-xl text-slate-900 tracking-tighter uppercase italic leading-none group-hover:text-brand transition-colors">
                                    {user.fullName || "SYSTEM_GUEST"}
                                  </div>
                                  <div className="flex items-center gap-2 mt-2">
                                     <Mail className="w-3 h-3 text-slate-300" />
                                     <span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">{user.email}</span>
                                  </div>
                               </div>
                            </div>
                          </td>
                          <td className="px-10 py-8">
                             <div className={cn(
                                "px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] border w-fit italic",
                                user.role === 'seller' ? 'bg-brand/10 text-brand border-brand/20' : 'bg-slate-50 text-slate-400 border-slate-100'
                             )}>
                                {user.role === 'seller' ? 'CORE_RETAILER' : 'CONSUMER_NODE'}
                             </div>
                          </td>
                          <td className="px-10 py-8">
                             <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-amber-500" />
                                <span className="font-display font-black text-slate-700 tabular-nums text-lg italic tracking-tighter">
                                   {user.superCoins || 0}
                                </span>
                             </div>
                          </td>
                          <td className="px-10 py-8">
                             <div className="flex items-center gap-2.5">
                                <div className="w-2 h-2 bg-brand rounded-full animate-pulse shadow-brand-glow" />
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Signal Stable</span>
                             </div>
                          </td>
                          <td className="px-10 py-8 text-right">
                             <div className="flex justify-end gap-2">
                                <button className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-slate-300 hover:text-red-500 hover:border-red-100 transition-all">
                                   <UserX className="w-5 h-5" />
                                </button>
                                <button className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-slate-300 hover:text-brand hover:border-brand/20 transition-all">
                                   <ShieldCheck className="w-5 h-5" />
                                </button>
                             </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
               </div>
            </motion.div>
          )}

          {activeTab === 'logistics' && (
            <motion.div 
               key="logistics"
               initial={{ opacity: 0, scale: 0.98 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.98 }}
               className="space-y-8"
            >
               <div className="bg-white border border-slate-100 rounded-[40px] p-10 shadow-premium space-y-10">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                     <div className="space-y-1">
                        <h3 className="text-3xl font-display font-black tracking-tighter uppercase italic text-slate-900 leading-none">Stream Logs</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Real-time logistics monitoring</p>
                     </div>
                     <div className="flex gap-4">
                        <button className="btn-outline-premium py-3 px-6 text-[10px]">
                           <Filter className="w-4 h-4" />
                           <span>Filter Segment</span>
                        </button>
                        <button className="btn-premium py-3 px-8 text-[10px]">
                           <span>Export Node Data</span>
                        </button>
                     </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-50 italic">
                          <th className="pb-6 pl-4">Entry Hash</th>
                          <th className="pb-6">Participating Nodes</th>
                          <th className="pb-6">Value Protocol</th>
                          <th className="pb-6">Status Loop</th>
                          <th className="pb-6 text-right pr-4">Timeline</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {orders.slice(0, 30).map(order => {
                          const customer = users.find(u => u.id === order.customerId);
                          const seller = users.find(u => u.id === order.sellerId);
                          return (
                            <tr key={order.id} className="hover:bg-slate-50/50 transition-all group">
                              <td className="py-10 pl-4">
                                <div className="font-display font-black text-slate-800 uppercase italic tracking-tighter group-hover:text-brand transition-colors text-lg">
                                  #{order.id.slice(-8).toUpperCase()}
                                </div>
                              </td>
                              <td className="py-10">
                                <div className="space-y-3">
                                   <div className="flex items-center gap-2">
                                      <div className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
                                      <span className="text-[11px] font-black text-slate-800 uppercase italic">{customer?.fullName || 'ANON_NODE'}</span>
                                   </div>
                                   <div className="flex items-center gap-2 ml-4">
                                      <ArrowUpRight className="w-3 h-3 text-brand" />
                                      <span className="text-[10px] text-brand font-black uppercase tracking-widest">{seller?.fullName || 'AWAITING_OP'}</span>
                                   </div>
                                </div>
                              </td>
                              <td className="py-10">
                                 <div className="font-display font-black text-slate-900 tabular-nums italic tracking-tighter text-2xl">
                                    {formatCurrency(order.totalAmount || 0)}
                                 </div>
                              </td>
                              <td className="py-10">
                                <div className={cn(
                                  "px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] border w-fit italic",
                                  order.status === 'delivered' ? 'bg-brand/10 text-brand border-brand/20' : 'bg-slate-50 text-slate-400 border-slate-100'
                                )}>
                                  {order.status}
                                </div>
                              </td>
                              <td className="py-10 text-right pr-4">
                                <div className="flex flex-col items-end">
                                   <p className="text-[11px] font-black text-slate-900 tabular-nums uppercase italic">
                                      {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                   </p>
                                   <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mt-1">
                                      {new Date(order.createdAt).toLocaleDateString([], { month: 'short', day: '2-digit' })}
                                   </p>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
               </div>
            </motion.div>
          )}

          {activeTab === 'analytics' && (
            <motion.div 
               key="analytics"
               initial={{ opacity: 0, scale: 0.98 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.98 }}
               className="space-y-10"
            >
               <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                  <div className="lg:col-span-2 space-y-10">
                     <div className="bg-slate-900 rounded-[48px] p-12 text-white relative overflow-hidden group shadow-2xl">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,_rgba(16,185,129,0.2)_0%,_transparent_50%)]" />
                        <div className="relative z-10 space-y-8">
                           <div className="flex justify-between items-center">
                              <div className="space-y-1">
                                 <h4 className="text-4xl font-display font-black tracking-tighter uppercase italic leading-none">Intelligence Hub</h4>
                                 <p className="text-brand text-[10px] font-black uppercase tracking-[0.3em]">AI-Driven Market Synthesis</p>
                              </div>
                              <Sparkles className="w-10 h-10 text-brand animate-pulse" />
                           </div>
                           <GeminiMarketInsights orders={orders} users={users} />
                        </div>
                     </div>
                  </div>

                  <div className="space-y-10">
                     <div className="bg-white border border-slate-100 rounded-[40px] p-10 space-y-10 shadow-premium">
                        <div className="flex justify-between items-center">
                           <h4 className="text-xl font-display font-black tracking-tighter uppercase italic text-slate-900 leading-none">Fresh Momentum</h4>
                           <Activity className="w-5 h-5 text-brand" />
                        </div>
                        <div className="h-64 flex items-end justify-between gap-2.5 px-2">
                           {[40, 70, 45, 90, 65, 80, 100, 85, 95].map((h, i) => (
                              <motion.div 
                                key={i} 
                                initial={{ height: 0 }} 
                                animate={{ height: `${h}%` }}
                                transition={{ delay: i * 0.05, type: 'spring', damping: 20 }}
                                className="flex-1 bg-brand rounded-2xl opacity-70 hover:opacity-100 transition-all cursor-pointer shadow-brand-glow" 
                              />
                           ))}
                        </div>
                        <div className="flex justify-between items-center pt-6 border-t border-slate-50">
                           <div className="space-y-1">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Growth Peak</p>
                              <p className="text-sm font-black text-slate-900 italic">+24.8% WOW</p>
                           </div>
                           <ArrowUpRight className="w-6 h-6 text-brand" />
                        </div>
                     </div>

                     <div className="bg-brand border border-brand/20 rounded-[40px] p-10 text-white relative overflow-hidden group shadow-2xl shadow-brand/20 min-h-[280px] flex flex-col justify-end">
                        <Zap className="absolute -right-8 -top-8 w-48 h-48 opacity-10 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-1000" />
                        <h4 className="text-4xl font-display font-black tracking-tighter uppercase italic leading-none mb-4">Prime Node Mode</h4>
                        <p className="text-white/70 text-[10px] font-black uppercase tracking-[0.2em] leading-relaxed max-w-[200px]">System resources prioritized for 20-min express fulfillment across all nodes.</p>
                     </div>
                  </div>
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default AdminView;
