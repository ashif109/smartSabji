import React from 'react';
import { Store, ChefHat, Package, UserCircle, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: any) => void;
  cartCount: number;
}

const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange, cartCount }) => {
  const tabs = [
    { id: 'market', icon: Store, label: 'Market' },
    { id: 'inbox', icon: ChefHat, label: 'Kitchen' },
    { id: 'orders', icon: Package, label: 'Orders' },
    { id: 'profile', icon: UserCircle, label: 'Profile' }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] px-6 pb-10 pointer-events-none">
      <div className="max-w-md mx-auto h-[84px] bg-white/80 backdrop-blur-2xl border border-slate-100 rounded-[36px] shadow-2xl shadow-brand/10 flex items-center justify-between pointer-events-auto px-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "relative flex-1 flex flex-col items-center justify-center gap-1.5 transition-all duration-500 py-3 rounded-[28px] overflow-hidden group",
                isActive ? "text-brand" : "text-slate-400 hover:text-slate-600"
              )}
            >
              <AnimatePresence>
                {isActive && (
                  <motion.div
                    layoutId="activeTabBg"
                    className="absolute inset-0 bg-brand/5 border border-brand/10 rounded-[28px]"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
              </AnimatePresence>
              
              <div className="relative">
                <tab.icon className={cn(
                  "w-6 h-6 transition-transform duration-500",
                  isActive ? "scale-110" : "group-hover:scale-105"
                )} />
                {tab.id === 'inbox' && (
                  <Sparkles className="absolute -top-1.5 -right-1.5 w-3 h-3 text-brand animate-pulse" />
                )}
                {tab.id === 'market' && cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-brand rounded-full ring-2 ring-white" />
                )}
              </div>
              
              <span className={cn(
                "text-[9px] font-black uppercase tracking-widest leading-none transition-all duration-500",
                isActive ? "opacity-100 scale-110" : "opacity-40"
              )}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default BottomNav;
