import React from 'react';
import { ArrowRight, Heart } from 'lucide-react';
import { CORE_CAUSES } from '../data/siteData';

const Causes: React.FC = () => {
  return (
    <section className="py-24 bg-white">
      <div className="institutional-container">
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-orange-600 font-bold text-xs uppercase tracking-widest mb-4">
              <Heart size={16} fill="currentColor" /> Our Core Missions
            </div>
            <h2 className="text-4xl md:text-5xl font-serif font-black text-blue-900 leading-tight">
              Causes That Need Your Support
            </h2>
          </div>
          <button className="px-8 py-4 bg-blue-900 text-white font-bold text-xs uppercase tracking-[0.2em] hover:bg-blue-800 transition-all rounded-sm shadow-xl flex items-center gap-3">
            View All Causes <ArrowRight size={16} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {CORE_CAUSES.map((cause, i) => (
            <div key={i} className="group cursor-pointer">
              <div className="relative h-[400px] overflow-hidden rounded-sm shadow-2xl mb-6">
                <img 
                  src={cause.img} 
                  alt={cause.title} 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                <div className={`absolute top-6 left-6 ${cause.color} text-white px-4 py-1 text-[10px] font-black uppercase tracking-widest rounded-sm shadow-lg`}>
                  Priority Mission
                </div>
                <div className="absolute bottom-8 left-8 right-8">
                  <h3 className="text-2xl font-serif font-black text-white mb-2 leading-tight">
                    {cause.title}
                  </h3>
                  <p className="text-[12px] text-gray-300 leading-relaxed line-clamp-2 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    {cause.desc}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div className="text-[11px] font-black text-blue-900 uppercase tracking-widest">Help Us Grow</div>
                <div className="flex items-center gap-2 text-orange-600 font-bold text-xs group-hover:gap-4 transition-all">
                  CONTRIBUTE NOW <ArrowRight size={14} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Causes;
