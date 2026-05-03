import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, where } from 'firebase/firestore';
import { Users, ShoppingBag, BarChart3, ShieldAlert, CheckCircle2, UserX, Database, Activity, Globe, Zap, ArrowUpRight, Search, Sprout } from 'lucide-react';
import { UserProfile, Order } from '../types';
import { formatCurrency, cn, handleFirestoreError, OperationType } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import GeminiMarketInsights from './GeminiMarketInsights';

const AdminView: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'directory' | 'logistics' | 'analytics'>('directory');
  const [searchQuery, setSearchQuery] = useState("");

  // Advanced Filters for Logistics
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCustomer, setFilterCustomer] = useState<string>('all');
  const [filterSeller, setFilterSeller] = useState<string>('all');
  const [filterMinAmount, setFilterMinAmount] = useState<number | "">("");
  const [filterMaxAmount, setFilterMaxAmount] = useState<number | "">("");
  const [filterDateStart, setFilterDateStart] = useState<string>("");
  const [filterDateEnd, setFilterDateEnd] = useState<string>("");
  const [sortField, setSortField] = useState<keyof Order>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    // Only fetch if session is active and potentially admin
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

  const totalRevenue = orders.reduce((acc, o) => acc + o.totalAmount, 0);
  const activeSellers = users.filter(u => u.role === 'seller').length;
  const activeCustomers = users.filter(u => u.role === 'customer').length;

  return (
    <div className="min-h-screen bg-[#F4F7F5] text-dark pb-24 font-sans">
      {/* Top Header */}
      <div className="bg-white px-6 py-6 border-b border-gray-100 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center text-white">
            <Sprout className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-display font-black text-brand tracking-tighter uppercase leading-none">Console</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-brand/10 px-3 py-1.5 rounded-full flex items-center gap-2">
            <Activity className="w-3 h-3 text-brand" />
            <span className="text-[10px] font-black text-brand uppercase tracking-wider">MARKET OPTIMAL</span>
          </div>
          <button onClick={() => auth.signOut()} className="bg-gray-50 p-2 rounded-full text-gray-400 hover:text-red-500 transition-colors">
            <UserX className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 sm:p-6 mb-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Market Cap', value: formatCurrency(totalRevenue), icon: Zap, color: 'text-brand' },
            { label: 'Retailers', value: activeSellers, icon: Globe, color: 'text-brand' },
            { label: 'Customers', value: activeCustomers, icon: Users, color: 'text-brand' },
            { label: 'Efficiency', value: '99.9%', icon: Activity, color: 'text-brand' },
          ].map((stat, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-2">
              <div className="flex justify-between items-start">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">{stat.label}</p>
                <stat.icon className={cn("w-4 h-4", stat.color)} />
              </div>
              <p className="text-2xl font-black text-gray-800 tabular-nums leading-none">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Tab Selection */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
          {[
            { id: 'directory', label: 'Directory' },
            { id: 'logistics', label: 'Orders Feed' },
            { id: 'analytics', label: 'Market Insights' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border",
                activeTab === tab.id 
                  ? "bg-brand text-white border-brand shadow-xl shadow-brand/20" 
                  : "bg-white text-gray-400 hover:text-gray-600 border-gray-100 hover:bg-gray-50"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <AnimatePresence mode="wait">
          {activeTab === 'directory' && (
            <motion.div 
              key="directory"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="relative">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-300 w-5 h-5" />
                <input 
                  type="text" 
                  placeholder="Seach users by name or id..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-gray-100 rounded-[24px] px-14 py-5 text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all shadow-sm"
                />
              </div>

              <div className="bg-white border border-gray-100 rounded-[32px] overflow-hidden shadow-sm">
                 <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[700px]">
                      <thead>
                        <tr className="bg-gray-50/50 text-[10px] uppercase text-gray-400 border-b border-gray-100 font-black tracking-widest">
                          <th className="px-8 py-5">Participant</th>
                          <th className="px-8 py-5">Role</th>
                          <th className="px-8 py-5">Wallet</th>
                          <th className="px-8 py-5">Status</th>
                          <th className="px-8 py-5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {users.filter(u => u.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase())).map(user => (
                          <tr key={user.id} className="hover:bg-gray-50/30 transition-colors group">
                            <td className="px-8 py-6">
                              <div className="font-black text-lg text-gray-800 tracking-tighter uppercase leading-none group-hover:text-brand transition-colors">{user.fullName || "ANONYMOUS"}</div>
                              <p className="text-[10px] text-gray-300 font-bold mt-2 uppercase tracking-tighter">ID: {user.id.slice(0, 12)}</p>
                            </td>
                            <td className="px-8 py-6">
                              <div className="flex flex-col gap-1.5 align-middle">
                                <span className={cn(
                                  "px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border w-fit",
                                  user.role === 'seller' ? 'bg-brand/10 text-brand border-brand/20' : 'bg-gray-100 text-gray-500 border-gray-200'
                                )}>
                                  {user.role?.toUpperCase()}
                                </span>
                                {user.role === 'seller' && user.membershipPlan && (
                                  <span className="text-[7px] font-black uppercase text-brand/60 tracking-[0.2em] ml-1">
                                    Plan: {user.membershipPlan}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-8 py-6 font-black text-gray-700 tabular-nums">
                               {user.superCoins || 0} 
                               <span className="text-[8px] text-gray-300 tracking-widest ml-1 uppercase">Coins</span>
                            </td>
                            <td className="px-8 py-6">
                               <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-brand rounded-full animate-pulse" />
                                  <span className="text-[10px] font-bold text-gray-400">ONLINE</span>
                                </div>
                            </td>
                            <td className="px-8 py-6 text-right">
                               <button className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-xl text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all">
                                 <UserX className="w-4 h-4" />
                               </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                 </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'logistics' && (
            <motion.div 
               key="logistics"
               initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
               className="space-y-6"
            >
               <div className="bg-white border border-gray-100 rounded-[32px] p-8 shadow-sm space-y-8">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-gray-400 px-2">
                    <p>Processed Transactions: {orders.length}</p>
                    <div className="flex gap-4">
                      <button className="text-brand flex items-center gap-2 border-b border-brand/20 hover:border-brand transition-all">Export Log</button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[800px]">
                      <thead>
                        <tr className="text-[10px] uppercase text-gray-400 border-b border-gray-100 font-black tracking-widest">
                          <th className="pb-5 pl-2">Order ID</th>
                          <th className="pb-5">Accounts</th>
                          <th className="pb-5">Value</th>
                          <th className="pb-5">Status</th>
                          <th className="pb-5 text-right pr-2">Timeline</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {orders.slice(0, 20).map(order => {
                          const customer = users.find(u => u.id === order.customerId);
                          const seller = users.find(u => u.id === order.sellerId);
                          return (
                            <tr key={order.id} className="hover:bg-gray-50/30 transition-all group">
                              <td className="py-7 pl-2">
                                <p className="font-black text-gray-800 uppercase tracking-tighter group-hover:text-brand transition-colors">#{order.id.slice(-8)}</p>
                              </td>
                              <td className="py-7">
                                <p className="text-[11px] font-black text-gray-700 uppercase leading-none">{customer?.fullName || 'GUEST'}</p>
                                <p className="text-[10px] text-brand font-bold mt-2 uppercase flex items-center gap-2">
                                  <ArrowUpRight className="w-2.5 h-2.5" />
                                  {seller?.fullName || 'NO OPERATOR'}
                                </p>
                              </td>
                              <td className="py-7 font-black text-gray-800 tabular-nums">{formatCurrency(order.totalAmount)}</td>
                              <td className="py-7">
                                <span className={cn(
                                  "px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border",
                                  order.status === 'delivered' ? 'bg-brand/10 text-brand border-brand/20' : 'bg-gray-50 text-gray-400 border-gray-100'
                                )}>
                                  {order.status}
                                </span>
                              </td>
                              <td className="py-7 text-right pr-2">
                                <p className="text-[10px] font-bold text-gray-400 tabular-nums">
                                  {new Date(order.createdAt).toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                </p>
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
               initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
               className="space-y-8"
            >
               {/* Pulse Summary Cards */}
               <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 <div className="lg:col-span-2">
                   <GeminiMarketInsights orders={orders} users={users} />
                 </div>
                 
                 <div className="space-y-6">
                    <div className="bg-white border border-gray-100 rounded-[40px] p-10 space-y-8 shadow-sm">
                       <div className="flex justify-between items-center">
                          <h4 className="text-xl font-black uppercase tracking-tighter text-gray-800">Fresh Momentum</h4>
                          <div className="bg-brand/5 text-brand px-3 py-1 rounded-full text-[10px] font-black">+24% GROWTH</div>
                       </div>
                       <div className="h-64 flex items-end justify-between px-4 gap-2">
                          {[40, 70, 45, 90, 65, 80, 100, 85, 95].map((h, i) => (
                             <motion.div 
                               key={i} 
                               initial={{ height: 0 }} 
                               animate={{ height: `${h}%` }}
                               transition={{ delay: i * 0.05, type: 'spring', damping: 20 }}
                               className="flex-1 bg-brand rounded-xl opacity-80 hover:opacity-100 transition-opacity cursor-pointer shadow-sm shadow-brand/10" 
                             />
                          ))}
                       </div>
                    </div>

                    <div className="bg-brand border border-brand rounded-[40px] p-10 text-white flex flex-col justify-center items-center gap-6 text-center relative overflow-hidden shadow-2xl shadow-brand/20">
                       <div className="absolute top-0 right-0 p-10 opacity-10">
                          <Zap className="w-48 h-48 fill-white" />
                       </div>
                       <div className="w-16 h-16 bg-white/20 rounded-[28px] flex items-center justify-center">
                          <Zap className="w-8 h-8 fill-white" />
                       </div>
                       <div className="space-y-2 relative z-10">
                         <h4 className="text-2xl font-black uppercase tracking-tighter leading-tight">Harvest Peak</h4>
                         <p className="text-white/80 text-[8px] font-black uppercase tracking-[0.2em] max-w-xs mx-auto">Market logistics are currently operating at maximum capacity.</p>
                       </div>
                    </div>
                 </div>
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AdminView;
