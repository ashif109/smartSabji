import React from 'react';
import { Product } from '../types';
import { ShoppingCart, Star, Plus, Minus } from 'lucide-react';
import { motion } from 'motion/react';
import { cn, formatCurrency } from '../lib/utils';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
  quantity?: number;
  onUpdateQuantity?: (id: string, delta: number) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart, quantity = 0, onUpdateQuantity }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-gray-100 rounded-[32px] p-4 flex flex-col gap-4 group hover:shadow-xl hover:shadow-brand/5 hover:border-brand/20 transition-all relative"
    >
      <div className="relative aspect-square rounded-[24px] overflow-hidden bg-gray-50 border border-gray-50 flex items-center justify-center">
         <img 
           src={product.imageUrl} 
           alt={product.name} 
           className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
           referrerPolicy="no-referrer"
           onError={(e) => {
             const img = e.currentTarget;
             img.src = 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?q=80&w=400&auto=format&fit=crop';
             img.className = 'w-1/2 h-1/2 object-contain opacity-20';
           }}
         />
         <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md px-2 py-1 rounded-lg flex items-center gap-1 shadow-sm">
            <Star className="w-3 h-3 text-brand fill-brand" />
            <span className="text-[10px] font-black">{product.rating}</span>
         </div>
         {product.stock < 10 && (
           <div className="absolute bottom-3 left-3 bg-red-500 text-white px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest">
              Only {product.stock} left
           </div>
         )}
      </div>

      <div className="flex-1 space-y-1">
        <div className="flex justify-between items-start">
          <p className="text-[10px] font-black uppercase tracking-widest text-brand">{product.category}</p>
          {product.localNames && product.localNames[0] && product.localNames[0].toLowerCase() !== product.name.toLowerCase() && (
            <span className="text-[9px] font-black bg-brand/5 text-brand px-2 py-0.5 rounded-md uppercase tracking-tighter">
              {product.localNames[0]}
            </span>
          )}
        </div>
        <h3 className="text-sm font-black text-dark tracking-tight uppercase line-clamp-1">{product.name}</h3>
        <p className="text-[10px] font-medium text-gray-400 line-clamp-2 leading-relaxed">{product.description}</p>
      </div>

      <div className="flex items-center justify-between mt-2">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Quantity</span>
          <span className="text-xs font-black text-dark tabular-nums">{product.unit || 'kg'} container</span>
        </div>

        {quantity > 0 && onUpdateQuantity ? (
          <div className="flex items-center gap-3 bg-brand/10 rounded-xl p-1 px-2 border border-brand/20">
             <button 
               onClick={() => onUpdateQuantity(product.id, -1)}
               className="w-6 h-6 flex items-center justify-center text-brand hover:scale-110 transition-transform"
             >
               <Minus className="w-4 h-4" />
             </button>
             <span className="text-sm font-black text-brand tabular-nums">{quantity}</span>
             <button 
               onClick={() => onUpdateQuantity(product.id, 1)}
               className="w-6 h-6 flex items-center justify-center text-brand hover:scale-110 transition-transform"
             >
               <Plus className="w-4 h-4" />
             </button>
          </div>
        ) : (
          <button 
            onClick={() => onAddToCart(product)}
            className="w-10 h-10 bg-brand text-white rounded-xl flex items-center justify-center shadow-lg shadow-brand/20 hover:scale-110 transition-transform active:scale-95"
          >
            <Plus className="w-5 h-5" />
          </button>
        )}
      </div>
    </motion.div>
  );
};

export default ProductCard;
