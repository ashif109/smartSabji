import React from 'react';
import { Product } from '../types';
import { X, ShoppingBag, Trash2, Plus, Minus, ArrowRight, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatCurrency } from '../lib/utils';

interface CartSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  cart: { product: Product; quantity: number }[];
  onUpdateQuantity: (id: string, delta: number) => void;
  onPlaceOrder: () => void;
  loading?: boolean;
}

const CartSidebar: React.FC<CartSidebarProps> = ({ isOpen, onClose, cart, onUpdateQuantity, onPlaceOrder, loading }) => {
  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);
  const subtotal = cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);
  const deliveryFee = subtotal > 500 ? 0 : 40;
  const totalAmount = subtotal + deliveryFee;

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
                  <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gray-50 border border-gray-100 shrink-0">
                    <img src={item.product.imageUrl} alt={item.product.name} className="w-full h-full object-cover" />
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
            </div>
          )}
        </div>

        {/* Footer */}
        {cart.length > 0 && (
          <div className="p-8 border-t border-gray-100 bg-gray-50/50 space-y-6">
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
              onClick={onPlaceOrder}
              disabled={loading}
              className="w-full btn-brand flex items-center justify-center gap-4 py-6"
            >
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <span className="uppercase tracking-[0.2em] font-black text-sm">Place Delivery Order</span>
                  <ArrowRight className="w-5 h-5" />
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
