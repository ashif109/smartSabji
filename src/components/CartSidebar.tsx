import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import { X, ShoppingBag, Trash2, Plus, Minus, ArrowRight, Loader2, Sparkles, Zap, ChevronRight, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatCurrency } from '../lib/utils';
import { AIService } from '../services/aiService';
import { db } from '../firebase';
import { collection, getDocs, limit, query } from 'firebase/firestore';
import { getVegetableImage } from '../lib/imageMapping';

interface CartSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  cart: { product: Product; quantity: number }[];
  onUpdateQuantity: (id: string, delta: number) => void;
  onPlaceOrder: (timePreference: string) => void;
  onAddToCart: (product: Product) => void;
  loading?: boolean;
  preselectedTime?: string | null;
}

const CartSidebar: React.FC<CartSidebarProps> = ({ isOpen, onClose, cart, onUpdateQuantity, onPlaceOrder, onAddToCart, loading, preselectedTime }) => {
  const [suggestions, setSuggestions] = useState<{ productId: string; reason: string }[]>([]);
  const [suggestedProducts, setSuggestedProducts] = useState<Product[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('ASAP (30 min)');
  const [customTime, setCustomTime] = useState<string>('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  useEffect(() => {
    if (preselectedTime) {
      setCustomTime(preselectedTime);
      setShowCustomInput(true);
    }
  }, [preselectedTime]);

  const timeSlots = [
    'ASAP (30 min)',
    '10:00 AM - 12:00 PM',
    '12:00 PM - 2:00 PM',
    '4:00 PM - 6:00 PM',
    '6:00 PM - 8:00 PM'
  ];

  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);
  const subtotal = cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);
  const deliveryFee = subtotal > 500 ? 0 : 40;
  const totalAmount = subtotal + deliveryFee;

  useEffect(() => {
    if (cart.length > 0 && isOpen) {
      const fetchSuggestions = async () => {
        setSuggesting(true);
        try {
          const q = query(collection(db, 'products'), limit(20));
          const snap = await getDocs(q);
          const allProducts = snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
          
          const cartProducts = cart.map(i => i.product);
          const aiSuggestions = await AIService.getSmartBasketSuggestions(cartProducts, allProducts);
          setSuggestions(aiSuggestions);
          
          // Filter suggested product objects
          const suggestedIds = aiSuggestions.map(s => s.productId);
          setSuggestedProducts(allProducts.filter(p => suggestedIds.includes(p.id)));
        } catch (e) {
          console.error("AI Assistant busy/unavailable:", e);
        } finally {
          setSuggesting(false);
        }
      };
      fetchSuggestions();
    }
  }, [cart.length, isOpen]);

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.div 
        initial={{ x: '100%' }}
        animate={{ x: isOpen ? 0 : '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed top-0 right-0 bottom-0 w-full sm:w-[450px] bg-white z-[110] shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm relative">
              <ShoppingBag className="text-brand w-6 h-6" />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 bg-dark text-white text-[8px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
                   {totalItems}
                </span>
              )}
            </div>
            <div>
              <h2 className="text-xl font-black text-dark uppercase tracking-tighter italic">Your Bag</h2>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Sector A-12 Express Delivery</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors group">
            <X className="w-6 h-6 text-gray-400 group-hover:rotate-90 transition-transform duration-300" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-30">
               <ShoppingBag className="w-20 h-20 text-gray-200" />
               <div className="space-y-2">
                 <p className="font-black uppercase tracking-[0.2em] text-xs">Empty Bag</p>
                 <p className="text-[10px] max-w-xs font-bold leading-relaxed px-8">Your bag looks a bit lonely. Let's add some fresh greens!</p>
               </div>
            </div>
          ) : (
            <div className="space-y-6">
              {cart.map(item => (
                <div key={item.product.id} className="flex gap-4 group">
                  <div className="w-20 h-20 rounded-2xl overflow-hidden bg-slate-50 border border-slate-100 shrink-0 relative">
                    <img 
                      src={getVegetableImage(item.product.name)} 
                      alt={item.product.name} 
                      className="w-full h-full object-cover" 
                      loading="lazy"
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <h4 className="text-sm font-black text-dark uppercase tracking-tight line-clamp-1">{item.product.name}</h4>
                    <p className="text-[10px] font-bold text-gray-400">{item.product.unit}</p>
                    
                    <div className="flex items-center gap-4 mt-2">
                       <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-1 px-2 border border-gray-100">
                          <button 
                            onClick={() => onUpdateQuantity(item.product.id, -1)}
                            className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-brand"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs font-black tabular-nums">{item.quantity}</span>
                          <button 
                            onClick={() => onUpdateQuantity(item.product.id, 1)}
                            className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-brand"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                       </div>
                       <button 
                         onClick={() => onUpdateQuantity(item.product.id, -item.quantity)}
                         className="text-gray-300 hover:text-red-500 p-1 transition-colors"
                       >
                         <Trash2 className="w-4 h-4" />
                       </button>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <p className="text-sm font-black text-dark tabular-nums">₹{item.product.price * item.quantity}</p>
                    <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">₹{item.product.price}/qty</p>
                  </div>
                </div>
              ))}

              {/* AI Smart Basket Section */}
              <div className="pt-6 border-t border-gray-100">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-4 h-4 text-brand fill-brand" />
                  <h5 className="text-[10px] font-black uppercase text-brand tracking-widest">AI Smart Recommendations</h5>
                </div>
                
                {suggesting ? (
                  <div className="flex items-center gap-3 py-4 opacity-30">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <p className="text-[10px] font-bold uppercase tracking-widest">Predicting next harvest...</p>
                  </div>
                ) : suggestedProducts.length > 0 ? (
                  <div className="space-y-3">
                    {suggestedProducts.map(product => {
                      const suggestion = suggestions.find(s => s.productId === product.id);
                      return (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          key={product.id}
                          className="group/suggestion bg-brand/5 border border-brand/10 p-4 rounded-3xl flex gap-4 items-center hover:bg-brand/10 transition-colors"
                        >
                          <div className="w-12 h-12 rounded-xl overflow-hidden bg-white border border-brand/10 flex-shrink-0 relative">
                            <img 
                              src={getVegetableImage(product.name)} 
                              className="w-full h-full object-cover" 
                              alt={product.name} 
                              loading="lazy"
                            />
                          </div>
                          <div className="flex-1">
                             <div className="flex justify-between items-center ">
                               <h6 className="text-[11px] font-black text-dark uppercase">{product.name}</h6>
                               <span className="text-[9px] font-bold text-brand tabular-nums">{formatCurrency(product.price)}</span>
                             </div>
                             <p className="text-[9px] font-medium text-slate-500 italic mt-0.5 line-clamp-1">
                               {suggestion?.reason || "Perfect match for your basket"}
                             </p>
                          </div>
                          <button 
                            onClick={() => onAddToCart(product)}
                            className="w-8 h-8 bg-brand text-white rounded-full flex items-center justify-center shadow-brand-glow group-hover/suggestion:scale-110 transition-transform"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {cart.length > 0 && (
          <div className="p-8 border-t border-gray-100 bg-gray-50/50 space-y-6">
            <div className="space-y-4">
               <div className="flex items-center justify-between">
                 <h5 className="text-[10px] font-black uppercase text-dark tracking-widest flex items-center gap-2">
                   <Clock className="w-3 h-3 text-brand" />
                   Delivery Availability
                 </h5>
                 <button 
                  onClick={() => setShowCustomInput(!showCustomInput)}
                  className="text-[9px] font-black uppercase text-brand tracking-widest underline decoration-brand/30"
                 >
                   {showCustomInput ? 'Choose Standard Slot' : 'Set Custom Window'}
                 </button>
               </div>
               
               {showCustomInput ? (
                  <div className="animate-in slide-in-from-top-2 duration-300">
                    <input 
                      type="text"
                      placeholder="e.g. Free between 2PM - 4PM today"
                      value={customTime}
                      onChange={(e) => setCustomTime(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-brand transition-all shadow-sm"
                    />
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 ml-1">Example: "Main iss waqt se iss waqt tak free hu"</p>
                  </div>
               ) : (
                  <div className="flex flex-wrap gap-2">
                    {timeSlots.map(slot => (
                      <button 
                        key={slot}
                        onClick={() => setSelectedTimeSlot(slot)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tight transition-all border",
                          selectedTimeSlot === slot 
                            ? "bg-dark text-white border-dark shadow-lg ring-2 ring-dark/10" 
                            : "bg-white text-slate-400 border-slate-100 hover:border-slate-200"
                        )}
                      >
                         {slot}
                      </button>
                    ))}
                  </div>
               )}
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm font-bold">
                <span className="text-gray-400 uppercase tracking-widest">Subtotal</span>
                <span className="text-dark tabular-nums">₹{subtotal}</span>
              </div>
              <div className="flex justify-between items-center text-sm font-bold">
                <span className="text-gray-400 uppercase tracking-widest">Delivery</span>
                <span className="text-brand tabular-nums">{deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`}</span>
              </div>
              <div className="pt-3 border-t border-gray-100 flex justify-between items-center">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-dark">Total Amount</span>
                <span className="text-xl font-black text-brand tabular-nums">₹{totalAmount}</span>
              </div>
            </div>

            <button 
              onClick={() => onPlaceOrder(showCustomInput ? (customTime || 'ASAP (30 min)') : selectedTimeSlot)}
              disabled={loading}
              className="w-full btn-premium py-7"
            >
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <span className="uppercase tracking-[0.2em] font-black text-sm">Place Delivery Order</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
            <p className="text-[10px] font-bold text-gray-400 text-center uppercase tracking-widest opacity-60 italic">
              *Verification will be required upon arrival
            </p>
          </div>
        )}
      </motion.div>
    </>
  );
};

export default CartSidebar;
