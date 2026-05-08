import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { TrendingUp, Users, ShoppingBag, DollarSign, Activity, Zap } from 'lucide-react';
import { formatCurrency } from '../lib/utils';

interface AnalyticsProps {
  orders: any[];
}

const VendorAnalytics: React.FC<AnalyticsProps> = ({ orders }) => {
  const revenueData = useMemo(() => {
    // Basic aggregation for demo purposes
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split('T')[0];
    });

    return last7Days.map(date => {
      const dayOrders = orders.filter(o => o.createdAt.startsWith(date) && o.status === 'delivered');
      const revenue = dayOrders.reduce((sum, o) => sum + o.totalAmount, 0);
      return { date, revenue, orders: dayOrders.length };
    });
  }, [orders]);

  const productPerformance = useMemo(() => {
    const counts: Record<string, number> = {};
    orders.forEach(o => {
      if (o.status === 'delivered') {
        o.items.forEach((item: any) => {
          counts[item.name] = (counts[item.name] || 0) + (item.quantity || 1);
        });
      }
    });

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [orders]);

  const stats = useMemo(() => ({
    totalRevenue: orders.filter(o => o.status === 'delivered').reduce((sum, o) => sum + o.totalAmount, 0),
    activeOrders: orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').length,
    customerCount: new Set(orders.map(o => o.customerId)).size,
    efficiency: 94 // Mock metric
  }), [orders]);

  return (
    <div className="space-y-8 p-1">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Net Revenue', value: formatCurrency(stats.totalRevenue), icon: DollarSign, color: 'text-emerald-500', bg: 'bg-emerald-50' },
          { label: 'Active Jobs', value: stats.activeOrders, icon: ShoppingBag, color: 'text-brand', bg: 'bg-brand/10' },
          { label: 'Unique Users', value: stats.customerCount, icon: Users, color: 'text-blue-500', bg: 'bg-blue-50' },
          { label: 'Route Efficiency', value: `${stats.efficiency}%`, icon: Zap, color: 'text-amber-500', bg: 'bg-amber-50' },
        ].map((stat, i) => (
          <div key={i} className="premium-card !p-6 hover:translate-y-[-4px]">
             <div className={`${stat.bg} w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
             </div>
             <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{stat.label}</p>
             <p className="text-2xl font-display font-black text-slate-900 tracking-tighter italic">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Revenue Area Chart */}
        <div className="premium-card overflow-hidden">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-display font-black text-slate-900 tracking-tight uppercase italic">Revenue Growth</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Daily revenue performance (last 7 days)</p>
            </div>
            <div className="px-3 py-1 bg-brand/10 rounded-full flex items-center gap-2">
              <TrendingUp className="w-3 h-3 text-brand" />
              <span className="text-[9px] font-black text-brand uppercase tracking-widest">+12.4%</span>
            </div>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 9, fontWeight: 700, fill: '#64748B' }}
                  tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { weekday: 'short' })}
                />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 20px 40px -15px rgba(0,0,0,0.1)',
                    fontSize: '11px',
                    fontWeight: 800,
                    textTransform: 'uppercase'
                  }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#10B981" 
                  strokeWidth={4}
                  fillOpacity={1} 
                  fill="url(#colorRevenue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Product Performance Bar Chart */}
        <div className="premium-card">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-display font-black text-slate-900 tracking-tight uppercase italic">Top Harvests</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Most demanded items by quantity</p>
            </div>
            <Activity className="w-5 h-5 text-slate-200" />
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productPerformance} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 800, fill: '#0F172A' }}
                />
                <Tooltip cursor={{ fill: 'transparent' }} />
                <Bar dataKey="value" radius={[0, 12, 12, 0]}>
                  {productPerformance.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#10B981' : '#F1F5F9'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* AI Demand Forecast (Mock Integration) */}
      <div className="glass-premium !bg-dark rounded-[40px] p-8 md:p-10 text-white relative overflow-hidden group">
         <div className="absolute right-[-40px] top-[-40px] w-80 h-80 bg-brand/20 rounded-full blur-[100px] group-hover:bg-brand/30 transition-colors" />
         <div className="relative z-10 space-y-6">
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/10">
                  <Activity className="w-6 h-6 text-brand" />
               </div>
               <div>
                  <h4 className="text-sm font-black uppercase tracking-[0.3em] opacity-80">AI Demand Forecaster</h4>
                  <p className="text-xs font-bold text-slate-400">Powered by Gemini Engine</p>
               </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
               <div className="space-y-4">
                  <p className="text-2xl md:text-3xl font-display font-black tracking-tight leading-tight italic">
                     Expected <span className="text-brand">30% surge</span> in Onion & Potato demand this weekend.
                  </p>
                  <p className="text-sm text-slate-400 font-medium leading-relaxed">
                     Based on hyperlocal trends and upcoming festival data, replenish stock by Friday evening to maximize capture.
                  </p>
                  <button className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest bg-white/10 px-4 py-2 rounded-xl border border-white/10 hover:bg-white/20 transition-all">
                     View Deep Insights
                  </button>
               </div>
               
               <div className="bg-white/5 rounded-3xl border border-white/10 p-6 space-y-6">
                  {[
                    { label: 'Onions', prob: 92, status: 'rising' },
                    { label: 'Tomatoes', prob: 45, status: 'stable' },
                    { label: 'Coriander', prob: 78, status: 'high-velocity' },
                  ].map((item, i) => (
                    <div key={i} className="space-y-2">
                       <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                          <span>{item.label}</span>
                          <span className={`${item.prob > 70 ? 'text-brand' : 'text-slate-400'}`}>{item.prob}% Match</span>
                       </div>
                       <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className={`h-full ${item.prob > 70 ? 'bg-brand' : 'bg-slate-500'} rounded-full transition-all`} style={{ width: `${item.prob}%` }} />
                       </div>
                    </div>
                  ))}
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default VendorAnalytics;
