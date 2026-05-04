import React from 'react';
import { Sprout, ShoppingBag, List, User, Signal, MessageSquare } from 'lucide-react';
import { cn } from '../lib/utils';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: any) => void;
  cartCount: number;
}

const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange, cartCount }) => {
  const tabs = [
    { id: 'market', icon: Sprout, label: 'Market' },
    { id: 'orders', icon: List, label: 'Orders' },
    { id: 'inbox', icon: Signal, label: 'Alerts' },
    { id: 'profile', icon: User, label: 'Hub' }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] px-6 pb-6 pointer-events-none">
      <div className="max-w-md mx-auto h-[72px] bg-white border border-gray-100 rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.1)] flex items-center justify-around pointer-events-auto overflow-hidden relative px-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex flex-col items-center gap-1.5 transition-all duration-300 px-4 py-2 rounded-2xl relative",
              activeTab === tab.id ? "text-brand" : "text-gray-400 opacity-60 hover:opacity-100"
            )}
          >
            {activeTab === tab.id && (
              <div className="absolute inset-x-0 -bottom-1 h-1 bg-brand rounded-full mx-auto w-4" />
            )}
            <tab.icon className={cn("w-6 h-6", activeTab === tab.id ? "animate-bounce-short" : "")} />
            <span className="text-[9px] font-black uppercase tracking-widest leading-none">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default BottomNav;
