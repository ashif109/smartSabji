import React from 'react';
import { Globe, ArrowRight, BookOpen } from 'lucide-react';
import { CAPACITY_PROGRAMS, EDUCATION_ITEMS } from '../data/siteData';

const MainContent: React.FC = () => {
  return (
    <div className="lg:col-span-3 grid grid-cols-1 lg:grid-cols-3 gap-10">
      {/* Capacity Building */}
      <section className="lg:col-span-1 space-y-8">
        <div>
          <div className="border-l-4 border-green-700 h-8 mb-6"></div>
          <div className="mt-6 space-y-6">
            <h4 className="text-[11px] font-bold text-blue-900 uppercase tracking-wider flex items-center gap-2">
              <BookOpen size={14} className="text-orange-500" />
              Forthcoming Programmes
            </h4>
            <div className="space-y-4">
              {CAPACITY_PROGRAMS.map((prog, i) => (
                <div key={i} className="group cursor-pointer">
                  <div className="text-[11px] text-green-900 leading-snug border-b border-dashed border-gray-200 pb-3 group-hover:text-blue-700 transition-colors flex items-start gap-2">
                    <span className="text-orange-400 mt-1">●</span>
                    {prog}
                  </div>
                </div>
              ))}
              <button className="w-full py-2 bg-gray-50 border border-gray-200 text-[10px] font-bold text-gray-500 hover:bg-blue-900 hover:text-white transition-all uppercase tracking-widest rounded-sm">
                View All Programs
              </button>
            </div>
          </div>
        </div>
        
        <div className="bg-blue-50 p-6 rounded-sm border-l-4 border-blue-900">
           <h3 className="font-serif font-black text-lg text-blue-900 mb-4">Foundation Message</h3>
           <p className="text-[12px] text-blue-800 leading-relaxed mb-4 italic">
              "Our mission is to resurrect the profound wisdom of the Gurukulam system and integrate it with the precision of modern inquiry."
           </p>
           <button className="text-[10px] font-black text-blue-900 flex items-center gap-2 hover:translate-x-1 transition-transform uppercase tracking-wider">
             Learn Our History <ArrowRight size={12} />
           </button>
        </div>
      </section>

      {/* Education */}
      <section className="lg:col-span-2 space-y-8">
        <h3 className="section-title text-[#0055a5] text-[13px] font-black border-l-4 border-blue-900 pl-3 uppercase">
          Education & Innovation
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {EDUCATION_ITEMS.map((edu, i) => (
            <div key={i} className="institutional-card group hover:border-blue-900 transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50 -mr-8 -mt-8 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
              
              <div className="relative z-10">
                <div className="bg-[#0055a5] text-white p-3 rounded-sm w-fit mb-4 group-hover:scale-110 transition-transform">
                  <Globe size={20} />
                </div>
                <h4 className="text-[13px] font-serif font-black text-blue-900 leading-tight group-hover:text-blue-700 mb-2">
                  {edu.title.split('\n').map((line, idx) => <span key={idx} className="block">{line}</span>)}
                </h4>
                <p className="text-[11px] text-gray-500 mb-4 font-medium italic">{edu.subtitle}</p>
              </div>

              <div className="relative z-10 pt-4 border-t border-gray-100 flex items-center justify-between">
                {edu.new ? (
                  <div className="flex items-center gap-2">
                    <span className="bg-red-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-sm uppercase animate-pulse">New Admission</span>
                    <p className="text-[9px] text-green-700 font-bold max-w-[120px] truncate">{edu.tag}</p>
                  </div>
                ) : <div />}
                <ArrowRight size={16} className="text-blue-300 group-hover:text-blue-900 group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          ))}
        </div>

        <div className="bg-orange-50 p-8 rounded-sm border border-orange-100 mt-10">
           <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="flex-1">
                 <h3 className="text-xl font-serif font-black text-orange-900 mb-2">Join the Vedic Digital Revolution</h3>
                 <p className="text-[13px] text-orange-800/80 leading-relaxed">
                    Explore our upcoming MOOC on 'Vedic AI Ethics' and be part of the future of intelligent tradition.
                 </p>
              </div>
              <button className="px-8 py-3 bg-orange-600 text-white font-bold text-xs uppercase tracking-widest hover:bg-orange-700 transition-all shadow-lg rounded-sm whitespace-nowrap">
                Register Now
              </button>
           </div>
        </div>
      </section>
    </div>
  );
};

export default MainContent;
