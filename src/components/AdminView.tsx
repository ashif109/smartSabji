import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, where } from 'firebase/firestore';
import { Users, ShoppingBag, BarChart3, ShieldAlert, CheckCircle2, UserX, Database, Activity, Globe, Zap, ArrowUpRight, Search } from 'lucide-react';
import { UserProfile, Order } from '../types';
import { formatCurrency, cn, handleFirestoreError, OperationType } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

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
    <div className="max-w-7xl mx-auto p-4 py-8 sm:py-20 pb-40">
      {/* Console Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-16 sm:mb-20 px-2 sm:px-4 gap-8">
        <div className="space-y-4 sm:space-y-6">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <div className="glass-pill text-brand border-brand/20 bg-brand/5 text-[10px] sm:text-xs">Root Administration</div>
            <div className="flex items-center gap-2 px-3 py-1 sm:px-4 sm:py-1.5 bg-brand/10 text-brand border border-brand/20 rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-widest">
              <Zap className="w-3 h-3 fill-current" /> Quantum Cloud Link
            </div>
          </div>
          <h1 className="text-5xl sm:text-7xl lg:text-9xl tracking-tighter uppercase font-black leading-[0.8] sm:leading-[0.8]">Console</h1>
          <p className="text-neutral-500 font-bold uppercase tracking-[0.2em] flex items-center gap-2 sm:gap-3 text-[9px] sm:text-xs">
            <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-brand" /> GLOBAL SYSTEM THROUGHPUT: OPTIMAL
          </p>
        </div>

        <div className="flex items-center gap-6">
           <div className="bg-surface border border-line px-8 py-6 sm:px-10 sm:py-8 rounded-[32px] sm:rounded-[40px] flex flex-col justify-center shadow-2xl min-w-[160px] sm:min-w-[240px] flex-1 lg:flex-none">
              <p className="text-neutral-600 font-black uppercase text-[8px] sm:text-[10px] tracking-[0.3em] mb-1 sm:mb-2 leading-none text-center">System Revenue</p>
              <p className="text-3xl sm:text-5xl font-black tabular-nums leading-none mt-2 text-brand text-center">{formatCurrency(totalRevenue)}</p>
           </div>
        </div>
      </div>

      {/* Real-time Telemetry Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-8 mb-16 sm:mb-20 px-2 sm:px-4">
        {[
          { label: 'Active Fleet', value: activeSellers, icon: Globe, color: 'text-brand' },
          { label: 'Verified Nodes', value: activeCustomers, icon: Users, color: 'text-white' },
          { label: 'Gross Payloads', value: orders.length, icon: Database, color: 'text-white' },
          { label: 'Uptime', value: '99.98%', icon: ShieldAlert, color: 'text-green-500' },
        ].map((stat, i) => (
          <div key={i} className="premium-card p-8 sm:p-10 group relative overflow-hidden">
             <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <stat.icon className="w-24 h-24 sm:w-32 sm:h-32" />
             </div>
             <div className="relative z-10 space-y-4 sm:space-y-6">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-dark rounded-xl sm:rounded-2xl flex items-center justify-center border border-line group-hover:border-brand/40 transition-colors">
                   <stat.icon className={cn("w-5 h-5 sm:w-6 sm:h-6", stat.color)} />
                </div>
                <div>
                   <p className="text-[8px] sm:text-[10px] font-black text-neutral-600 uppercase tracking-[0.2em] mb-1">{stat.label}</p>
                   <p className="text-3xl sm:text-4xl font-black tracking-tighter tabular-nums">{stat.value}</p>
                </div>
             </div>
          </div>
        ))}
      </div>

      {/* Main Control Interface */}
      <div className="bg-surface border border-line rounded-[32px] sm:rounded-[48px] overflow-hidden shadow-2xl mx-2 sm:mx-4">
        <div className="flex bg-dark/40 border-b border-line overflow-x-auto custom-scrollbar scrollbar-hide">
          {[
            { id: 'directory', label: 'Entity Directory' },
            { id: 'logistics', label: 'Logistics Monitor' },
            { id: 'analytics', label: 'Neural Insights' },
          ].map((tab) => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)} 
              className={cn(
                "px-8 sm:px-12 py-6 sm:py-10 font-black text-[10px] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.3em] transition-all relative border-r border-line whitespace-nowrap",
                activeTab === tab.id ? "text-brand bg-brand/5" : "text-neutral-600 hover:text-neutral-400 hover:bg-white/[0.02]"
              )}
            >
              {tab.label}
              {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-1 bg-brand" />}
            </button>
          ))}
        </div>

        <div className="p-6 sm:p-12">
           <AnimatePresence mode="wait">
             {activeTab === 'directory' && (
               <motion.div 
                 key="directory"
                 initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                 className="space-y-8 sm:space-y-10"
               >
                 <div className="relative">
                    <Search className="absolute left-6 sm:left-8 top-1/2 -translate-y-1/2 text-neutral-600 w-5 h-5 sm:w-6 sm:h-6" />
                    <input 
                      type="text"
                      placeholder="Filter entities..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="input-premium pl-16 sm:pl-20 py-4 sm:py-6"
                    />
                 </div>

                 <div className="overflow-x-auto custom-scrollbar scrollbar-hide -mx-6 sm:mx-0">
                    <table className="w-full text-left min-w-[700px] sm:min-w-[800px]">
                      <thead>
                        <tr className="text-[9px] sm:text-[10px] uppercase text-neutral-600 border-b border-line font-black tracking-[0.2em]">
                          <th className="pb-6 sm:pb-8 pl-6 sm:pl-4">Signature / Identifier</th>
                          <th className="pb-6 sm:pb-8">Tier / Protocol</th>
                          <th className="pb-6 sm:pb-8">Net Volume</th>
                          <th className="pb-6 sm:pb-8">Operational Latency</th>
                          <th className="pb-6 sm:pb-8 text-right pr-6 sm:pr-4">Matrix Ops</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {users.filter(u => u.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase())).map(user => (
                          <tr key={user.id} className="text-sm hover:bg-white/[0.02] transition-all group">
                            <td className="py-6 sm:py-8 pl-6 sm:pl-4">
                              <div className="font-black text-xl sm:text-2xl text-white tracking-tighter uppercase group-hover:text-brand transition-colors leading-none">{user.fullName || "GHOST_NODE"}</div>
                              <div className="text-[8px] sm:text-[10px] text-neutral-600 font-bold tracking-widest mt-1 sm:mt-2 uppercase">UUID_{user.id.split('-')[0]}</div>
                            </td>
                            <td className="py-6 sm:py-8">
                              <span className={cn(
                                "px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-widest border",
                                user.role === 'seller' ? 'bg-brand/10 text-brand border-brand/20' : 'bg-white/10 text-white border-white/20'
                              )}>
                                {user.role?.toUpperCase()}
                              </span>
                            </td>
                            <td className="py-6 sm:py-8 font-black text-lg sm:text-xl text-neutral-400 tabular-nums">
                               {user.superCoins || 0} 
                               <span className="text-[8px] sm:text-[10px] text-neutral-600 tracking-widest ml-1 uppercase">SCoins</span>
                            </td>
                            <td className="py-6 sm:py-8">
                               <div className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full" />
                                  <span className="text-[10px] sm:text-xs font-bold text-neutral-500">12ms - Optimal</span>
                                </div>
                            </td>
                            <td className="py-6 sm:py-8 text-right pr-6 sm:pr-4">
                               <div className="flex justify-end gap-2 sm:gap-3 opacity-20 group-hover:opacity-100 transition-opacity">
                                 <button className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center bg-dark hover:bg-brand hover:text-dark rounded-full border border-line transition-all">
                                   <BarChart3 className="w-3 h-3 sm:w-4 sm:h-4" />
                                 </button>
                                 <button className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center bg-dark hover:bg-red-500 text-white rounded-full border border-line transition-all">
                                   <UserX className="w-3 h-3 sm:w-4 sm:h-4" />
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
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="space-y-8 sm:space-y-10"
                >
                  {/* Advanced Filter Panel */}
                  <div className="premium-card p-6 sm:p-8 space-y-6 sm:space-y-8 bg-neutral-900/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <ShieldAlert className="w-5 h-5 text-brand" />
                        <h3 className="text-sm font-black uppercase tracking-widest text-white">Advanced Filter Protocol</h3>
                      </div>
                      <button 
                        onClick={() => {
                          setFilterStatus('all');
                          setFilterCustomer('all');
                          setFilterSeller('all');
                          setFilterMinAmount("");
                          setFilterMaxAmount("");
                          setFilterDateStart("");
                          setFilterDateEnd("");
                        }}
                        className="text-[9px] font-black uppercase text-neutral-500 hover:text-brand transition-colors"
                      >
                        Reset Matrix
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                      <div className="space-y-2">
                        <label className="text-[8px] font-black uppercase text-neutral-600 tracking-widest pl-1">Status Protocol</label>
                        <select 
                          value={filterStatus}
                          onChange={(e) => setFilterStatus(e.target.value)}
                          className="w-full bg-dark border border-line rounded-xl px-4 py-3 text-[10px] font-bold text-white uppercase outline-none focus:border-brand transition-colors"
                        >
                          <option value="all">ALL STATES</option>
                          <option value="pending">PENDING</option>
                          <option value="accepted">ACCEPTED</option>
                          <option value="ongoing">ONGOING</option>
                          <option value="delivered">DELIVERED</option>
                          <option value="cancelled">CANCELLED</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[8px] font-black uppercase text-neutral-600 tracking-widest pl-1">Originator (Customer)</label>
                        <select 
                          value={filterCustomer}
                          onChange={(e) => setFilterCustomer(e.target.value)}
                          className="w-full bg-dark border border-line rounded-xl px-4 py-3 text-[10px] font-bold text-white uppercase outline-none focus:border-brand transition-colors"
                        >
                          <option value="all">ALL NODES</option>
                          {users.filter(u => u.role === 'customer').map(u => (
                            <option key={u.id} value={u.id}>{u.fullName.toUpperCase()}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[8px] font-black uppercase text-neutral-600 tracking-widest pl-1">Transporter (Seller)</label>
                        <select 
                          value={filterSeller}
                          onChange={(e) => setFilterSeller(e.target.value)}
                          className="w-full bg-dark border border-line rounded-xl px-4 py-3 text-[10px] font-bold text-white uppercase outline-none focus:border-brand transition-colors"
                        >
                          <option value="all">ALL UNITS</option>
                          {users.filter(u => u.role === 'seller').map(u => (
                            <option key={u.id} value={u.id}>{u.fullName.toUpperCase()}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[8px] font-black uppercase text-neutral-600 tracking-widest pl-1">Amount Range (SMC)</label>
                        <div className="flex gap-2">
                          <input 
                            type="number"
                            placeholder="MIN"
                            value={filterMinAmount}
                            onChange={(e) => setFilterMinAmount(e.target.value ? Number(e.target.value) : "")}
                            className="w-full bg-dark border border-line rounded-xl px-4 py-3 text-[10px] font-bold text-white outline-none focus:border-brand transition-colors"
                          />
                          <input 
                            type="number"
                            placeholder="MAX"
                            value={filterMaxAmount}
                            onChange={(e) => setFilterMaxAmount(e.target.value ? Number(e.target.value) : "")}
                            className="w-full bg-dark border border-line rounded-xl px-4 py-3 text-[10px] font-bold text-white outline-none focus:border-brand transition-colors"
                          />
                        </div>
                      </div>

                      <div className="space-y-2 sm:col-span-2">
                        <label className="text-[8px] font-black uppercase text-neutral-600 tracking-widest pl-1">Temporal Window (Date Range)</label>
                        <div className="flex gap-2">
                          <input 
                            type="date"
                            value={filterDateStart}
                            onChange={(e) => setFilterDateStart(e.target.value)}
                            className="w-full bg-dark border border-line rounded-xl px-4 py-3 text-[10px] font-bold text-white outline-none focus:border-brand transition-colors"
                          />
                          <div className="flex items-center text-neutral-600 px-1">→</div>
                          <input 
                            type="date"
                            value={filterDateEnd}
                            onChange={(e) => setFilterDateEnd(e.target.value)}
                            className="w-full bg-dark border border-line rounded-xl px-4 py-3 text-[10px] font-bold text-white outline-none focus:border-brand transition-colors"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto custom-scrollbar scrollbar-hide -mx-6 sm:mx-0">
                    <table className="w-full text-left min-w-[900px]">
                      <thead>
                        <tr className="text-[9px] sm:text-[10px] uppercase text-neutral-600 border-b border-line font-black tracking-[0.2em]">
                          <th className="pb-6 sm:pb-8 pl-6 sm:pl-4 cursor-pointer hover:text-white" onClick={() => { setSortField('id'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>
                            Payload ID {sortField === 'id' && (sortOrder === 'asc' ? '↑' : '↓')}
                          </th>
                          <th className="pb-6 sm:pb-8">Principal Origin</th>
                          <th className="pb-6 sm:pb-8">Unit Assigned</th>
                          <th className="pb-6 sm:pb-8 cursor-pointer hover:text-white" onClick={() => { setSortField('totalAmount'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>
                            Valuation {sortField === 'totalAmount' && (sortOrder === 'asc' ? '↑' : '↓')}
                          </th>
                          <th className="pb-6 sm:pb-8 cursor-pointer hover:text-white" onClick={() => { setSortField('status'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>
                            Status Flag {sortField === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
                          </th>
                          <th className="pb-6 sm:pb-8 cursor-pointer hover:text-white text-right pr-6 sm:pr-4" onClick={() => { setSortField('createdAt'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>
                            Temporal Log {sortField === 'createdAt' && (sortOrder === 'asc' ? '↑' : '↓')}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {orders
                          .filter(o => {
                            if (filterStatus !== 'all' && o.status !== filterStatus) return false;
                            if (filterCustomer !== 'all' && o.customerId !== filterCustomer) return false;
                            if (filterSeller !== 'all' && o.sellerId !== filterSeller) return false;
                            if (filterMinAmount !== "" && o.totalAmount < filterMinAmount) return false;
                            if (filterMaxAmount !== "" && o.totalAmount > filterMaxAmount) return false;
                            if (filterDateStart !== "") {
                              const start = new Date(filterDateStart);
                              const orderDate = new Date(o.createdAt);
                              if (orderDate < start) return false;
                            }
                            if (filterDateEnd !== "") {
                              const end = new Date(filterDateEnd);
                              // Set to end of day
                              end.setHours(23, 59, 59, 999);
                              const orderDate = new Date(o.createdAt);
                              if (orderDate > end) return false;
                            }
                            return true;
                          })
                          .sort((a, b) => {
                            const valA = a[sortField];
                            const valB = b[sortField];
                            if (valA === undefined) return 1;
                            if (valB === undefined) return -1;
                            // Check if numeric for better sorting
                            if (typeof valA === 'number' && typeof valB === 'number') {
                               return sortOrder === 'asc' ? valA - valB : valB - valA;
                            }
                            if (String(valA) < String(valB)) return sortOrder === 'asc' ? -1 : 1;
                            if (String(valA) > String(valB)) return sortOrder === 'asc' ? 1 : -1;
                            return 0;
                          })
                          .map(order => {
                            const customer = users.find(u => u.id === order.customerId);
                            const seller = users.find(u => u.id === order.sellerId);
                            return (
                              <tr key={order.id} className="text-sm hover:bg-white/[0.02] transition-all group">
                                <td className="py-6 sm:py-8 pl-6 sm:pl-4">
                                  <div className="font-black text-white tracking-tighter uppercase leading-none">ORDER_{order.id.split('-')[0]}</div>
                                  <div className="text-[8px] text-neutral-600 font-bold uppercase tracking-widest mt-1">Sector 4-A Matrix</div>
                                </td>
                                <td className="py-6 sm:py-8">
                                  <div className="text-neutral-400 font-bold text-[11px] uppercase tracking-tight">{customer?.fullName || 'UNK_NODE'}</div>
                                  <div className="text-[9px] text-neutral-600 font-black mt-0.5 truncate max-w-[150px]">{order.location.address}</div>
                                </td>
                                <td className="py-6 sm:py-8 text-neutral-500 italic">
                                  {seller ? (
                                    <span className="text-brand font-black not-italic text-[10px] bg-brand/5 px-2 py-0.5 rounded border border-brand/10">{seller.fullName.toUpperCase()}</span>
                                  ) : (
                                    <span className="text-neutral-700 font-bold text-[9px] uppercase tracking-widest pl-1">Awaiting Unit</span>
                                  )}
                                </td>
                                <td className="py-6 sm:py-8 font-black text-white tabular-nums">{order.totalAmount} <span className="text-[8px] text-neutral-600 tracking-widest ml-1 uppercase">SMC</span></td>
                                <td className="py-6 sm:py-8">
                                  <span className={cn(
                                    "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border",
                                    order.status === 'delivered' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                                    order.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                                    order.status === 'cancelled' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                    'bg-brand/10 text-brand border-brand/20'
                                  )}>
                                    {order.status.toUpperCase()}
                                  </span>
                                </td>
                                <td className="py-6 sm:py-8 text-right pr-6 sm:pr-4">
                                  <div className="text-xs font-bold text-neutral-400">{new Date(order.createdAt).toLocaleDateString()}</div>
                                  <div className="text-[9px] text-neutral-600 font-black uppercase tracking-widest">{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}

              {activeTab === 'analytics' && (
                <motion.div 
                   key="analytics"
                   initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                   className="space-y-12"
                >
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="premium-card p-10 space-y-10">
                         <div className="flex justify-between items-center">
                            <h4 className="text-2xl font-black tracking-tighter uppercase">Market Velocity</h4>
                            <Zap className="text-brand w-6 h-6" />
                         </div>
                         <div className="h-64 flex items-end gap-4 px-2">
                            {[40, 70, 45, 90, 65, 80, 100].map((h, i) => (
                               <div key={i} className="flex-1 space-y-2">
                                  <motion.div 
                                    initial={{ height: 0 }} animate={{ height: `${h}%` }}
                                    className="bg-brand/20 border-t-4 border-brand w-full rounded-t-lg shadow-[0_0_20px_rgba(255,184,0,0.1)]" 
                                  />
                               </div>
                            ))}
                         </div>
                         <div className="flex justify-between text-[10px] font-black text-neutral-600 uppercase tracking-widest">
                            <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
                         </div>
                      </div>

                      <div className="space-y-8">
                         <div className="premium-card p-8 flex items-center justify-between">
                            <div className="space-y-1">
                               <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest">Growth Rate</p>
                               <p className="text-3xl font-black">+12.4%</p>
                            </div>
                            <ArrowUpRight className="text-green-500 w-10 h-10" />
                         </div>
                         <div className="premium-card p-8 flex items-center justify-between">
                            <div className="space-y-1">
                               <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest">Cancellation Flux</p>
                               <p className="text-3xl font-black">0.42%</p>
                            </div>
                            <Activity className="text-brand w-10 h-10" />
                         </div>
                         <div className="premium-card p-10 bg-brand text-dark flex items-center justify-between">
                            <div className="space-y-1">
                               <p className="font-black uppercase tracking-widest text-[10px] leading-none opacity-60">Neural Projection</p>
                               <p className="text-3xl font-black tracking-tighter leading-none mt-2">Peak Demand at 17:00</p>
                            </div>
                            <Zap className="w-12 h-12 fill-current" />
                         </div>
                      </div>
                   </div>
                </motion.div>
              )}
           </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default AdminView;
