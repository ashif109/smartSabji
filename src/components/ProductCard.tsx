import React from 'react';
import { Product } from '../types';
import { Star, Plus, Minus, Leaf, Zap, ImageOff } from 'lucide-react';
import { motion } from 'motion/react';
import { getVegetableImage } from '../lib/imageMapping';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
  quantity?: number;
  onUpdateQuantity?: (id: string, delta: number) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart, quantity = 0, onUpdateQuantity }) => {
  const displayImage = getVegetableImage(product.name);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="bg-white border border-slate-100 rounded-[32px] md:rounded-[40px] p-4 md:p-5 flex flex-col gap-4 md:gap-5 group hover:shadow-premium hover:border-brand/20 transition-all duration-500 relative overflow-hidden h-full"
    >
      <div className="relative aspect-square rounded-[24px] md:rounded-[32px] overflow-hidden bg-slate-100 flex items-center justify-center shrink-0 group/img">
         <img 
           src={displayImage} 
           alt={product.name} 
           loading="lazy"
           className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" 
           referrerPolicy="no-referrer"
           onError={(e) => {
             const target = e.target as HTMLImageElement;
             target.src = '/vegetables/default.webp';
           }}
         />
         
         {/* Freshness Badge */}
         <div className="absolute top-3 left-3 md:top-4 md:left-4 flex flex-col gap-2">
            <div className="bg-white/95 backdrop-blur-md px-2 py-1 rounded-xl flex items-center gap-1.5 shadow-sm border border-white/40">
               <Star className="w-3 h-3 text-brand fill-brand" />
               <span className="text-[10px] font-black text-slate-800 tracking-tighter">{product.rating}</span>
            </div>
            <motion.div 
               initial={{ x: -20, opacity: 0 }}
               whileInView={{ x: 0, opacity: 1 }}
               className="bg-brand/90 backdrop-blur-md px-2 py-1 rounded-xl flex items-center gap-1.5 shadow-sm text-white"
            >
               <Leaf className="w-3 h-3" />
               <span className="text-[9px] font-black uppercase tracking-tighter">{product.freshnessScore}% Fresh</span>
            </motion.div>
         </div>

         {/* Today's Arrival Ribbon */}
         {product.isFreshArrivedToday && (
            <div className="absolute -right-12 top-4 rotate-45 bg-amber-500 text-white px-12 py-1 text-[8px] font-black uppercase tracking-widest shadow-lg">
               Fresh Today
            </div>
         )}
         
         <div className="absolute bottom-3 right-3 md:bottom-4 md:right-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="bg-dark/80 backdrop-blur-md px-3 py-1.5 rounded-full text-white text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-2 whitespace-nowrap">
              <Zap className="w-2 h-2 text-brand fill-brand" />
              Nutrient Pick
            </div>
         </div>
      </div>

      <div className="flex-1 flex flex-col gap-2 px-1">
        <div className="flex justify-between items-start gap-2">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-300 group-hover:text-brand transition-colors truncate">{product.category}</p>
          {product.localNames && product.localNames[0] && (
            <span className="text-[9px] font-black text-slate-200 uppercase italic truncate">
              {product.localNames[0]}
            </span>
          )}
        </div>
        <h3 className="text-base md:text-xl font-display font-black text-slate-900 tracking-tighter uppercase line-clamp-1 leading-tight group-hover:text-brand transition-colors">{product.name}</h3>
        <p className="line-clamp-2 text-[11px] font-medium text-slate-400 leading-relaxed md:min-h-[3rem]">{product.description}</p>
      </div>

      <div className="flex items-center justify-between mt-auto pt-5 border-t border-slate-50 transition-colors group-hover:border-brand/10">
        <div className="flex flex-col">
          <span className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">Measures</span>
          <span className="text-sm font-display font-black text-slate-900 tabular-nums tracking-tighter italic">PER {product.unit?.toUpperCase() || 'KG'}</span>
        </div>

        {quantity > 0 && onUpdateQuantity ? (
          <div className="flex items-center gap-2 bg-brand text-white rounded-[20px] p-1.5 px-3 shadow-brand-glow">
             <button 
               onClick={() => onUpdateQuantity(product.id, -1)}
               className="w-8 h-8 flex items-center justify-center hover:scale-125 transition-transform"
             >
               <Minus className="w-4 h-4" />
             </button>
             <span className="text-sm font-black tabular-nums min-w-[20px] text-center">{quantity}</span>
             <button 
               onClick={() => onUpdateQuantity(product.id, 1)}
               className="w-8 h-8 flex items-center justify-center hover:scale-125 transition-transform"
             >
               <Plus className="w-4 h-4" />
             </button>
          </div>
        ) : (
          <button 
            onClick={() => onAddToCart(product)}
            className="btn-premium px-6 py-4 shadow-none translate-y-0 group-hover:-translate-y-1 transition-transform"
          >
            <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
            <span>Add</span>
          </button>
        )}
      </div>
    </motion.div>
  );
};

export default ProductCard;
