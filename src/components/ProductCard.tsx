import React from 'react';
import { Product } from '../types';
import { Star, Plus, Minus } from 'lucide-react';
import { motion } from 'motion/react';

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
      className="bg-white border border-slate-100 rounded-[28px] md:rounded-[32px] p-3 md:p-4 flex flex-col gap-3 md:gap-4 group hover:shadow-2xl hover:shadow-brand/5 hover:border-brand/20 transition-all relative overflow-hidden h-full"
    >
      <div className="relative aspect-square rounded-[20px] md:rounded-[24px] overflow-hidden bg-slate-100 flex items-center justify-center shrink-0">
         <img 
           src={product.imageUrl} 
           alt={product.name} 
           className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" 
           referrerPolicy="no-referrer"
           onError={(e) => {
             const target = e.target as HTMLImageElement;
             target.src = 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?q=80&w=400&auto=format&fit=crop';
           }}
         />
         <div className="absolute top-2 left-2 md:top-3 md:left-3 flex flex-wrap gap-1 md:gap-2">
            <div className="bg-white/90 backdrop-blur-md px-1.5 py-0.5 md:px-2 md:py-1 rounded-lg flex items-center gap-1 shadow-sm border border-slate-100">
               <Star className="w-2.5 h-2.5 md:w-3 md:h-3 text-brand fill-brand" />
               <span className="text-[9px] md:text-[10px] font-bold text-dark tracking-tighter">{product.rating}</span>
            </div>
            {product.category === 'Daily' && (
              <div className="bg-brand text-white px-1.5 py-0.5 md:px-2 md:py-1 rounded-lg text-[7px] md:text-[8px] font-black uppercase tracking-widest shadow-lg shadow-brand/20 whitespace-nowrap">
                Essential
              </div>
            )}
         </div>
         
         <div className="absolute bottom-2 right-2 md:bottom-3 md:right-3">
            <div className="bg-dark/80 backdrop-blur-md px-2 py-1 md:px-3 md:py-1.5 rounded-full text-white text-[7px] md:text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5 md:gap-2 whitespace-nowrap">
              <div className="w-1 h-1 md:w-1.5 md:h-1.5 bg-brand rounded-full animate-pulse" />
              Node
            </div>
         </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col gap-1 md:gap-2 px-0.5 md:px-1">
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-1">
          <p className="text-[8px] md:text-[9px] font-bold uppercase tracking-widest text-slate-400 group-hover:text-brand transition-colors truncate">{product.category}</p>
          {product.localNames && product.localNames[0] && (
            <span className="text-[8px] md:text-[9px] font-bold text-slate-300 uppercase italic truncate">
              aka {product.localNames[0]}
            </span>
          )}
        </div>
        <h3 className="text-sm md:text-base font-display font-bold text-dark tracking-tight uppercase line-clamp-2 md:line-clamp-1 leading-tight md:leading-normal">{product.name}</h3>
        <p className="hidden md:line-clamp-2 text-[10px] font-medium text-slate-400 leading-relaxed">{product.description}</p>
      </div>

      <div className="flex items-center justify-between mt-auto pt-3 md:pt-4 border-t border-slate-50 transition-colors group-hover:border-brand/10">
        <div className="flex flex-col">
          <span className="text-[8px] md:text-[10px] font-bold text-slate-300 uppercase tracking-widest">Pricing</span>
          <span className="text-xs md:text-sm font-display font-bold text-dark tabular-nums tracking-tight">{product.unit || 'kg'} Measure</span>
        </div>

        {quantity > 0 && onUpdateQuantity ? (
          <div className="flex items-center gap-1.5 md:gap-4 bg-brand text-white rounded-xl md:rounded-2xl p-1 px-2 md:px-3 shadow-lg shadow-brand/20">
             <button 
               onClick={() => onUpdateQuantity(product.id, -1)}
               className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center hover:scale-125 transition-transform"
             >
               <Minus className="w-3.5 h-3.5 md:w-4 md:h-4" />
             </button>
             <span className="text-xs md:text-sm font-bold tabular-nums min-w-[15px] md:min-w-[20px] text-center">{quantity}</span>
             <button 
               onClick={() => onUpdateQuantity(product.id, 1)}
               className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center hover:scale-125 transition-transform"
             >
               <Plus className="w-3.5 h-3.5 md:w-4 md:h-4" />
             </button>
          </div>
        ) : (
          <button 
            onClick={() => onAddToCart(product)}
            className="h-10 md:h-12 px-4 md:px-6 bg-slate-900 text-white rounded-xl md:rounded-2xl flex items-center justify-center gap-1.5 md:gap-2 shadow-xl hover:bg-brand hover:scale-105 transition-all active:scale-95 group/btn"
          >
            <Plus className="w-3.5 h-3.5 md:w-4 md:h-4 group-hover/btn:rotate-90 transition-transform" />
            <span className="text-[9px] md:text-[11px] font-bold uppercase tracking-widest">Add</span>
          </button>
        )}
      </div>
    </motion.div>
  );
};

export default ProductCard;
