import React from 'react';
import { GraduationCap, Landmark, Map, BookOpen } from 'lucide-react';
import { IMPACT_STATS } from '../data/siteData';

const iconMap: Record<string, any> = {
  graduation: GraduationCap,
  building: Landmark,
  map: Map,
  book: BookOpen
};

const ImpactStats: React.FC = () => {
  return (
    <section className="bg-blue-900 py-20 text-white relative overflow-hidden">
      {/* Decorative background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 left-0 w-64 h-64 border-8 border-white rounded-full -ml-32 -mt-32"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 border-8 border-white rounded-full -mr-48 -mb-48"></div>
      </div>

      <div className="institutional-container relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-serif font-black mb-4">Our Impact in Numbers</h2>
          <div className="w-24 h-1.5 bg-orange-500 mx-auto rounded-full"></div>
          <p className="mt-6 text-blue-100 max-w-2xl mx-auto italic font-medium">
            Over the decades, we have remained steadfast in our commitment to nurturing the intellectual and cultural roots of our society.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-12 md:gap-8">
          {IMPACT_STATS.map((stat, i) => {
            const Icon = iconMap[stat.icon];
            return (
              <div key={i} className="text-center group">
                <div className="bg-blue-800/50 w-20 h-20 mx-auto rounded-2xl flex items-center justify-center mb-6 border border-blue-700/50 group-hover:bg-orange-600 group-hover:border-orange-500 transition-all duration-500 shadow-xl group-hover:-translate-y-2">
                  <Icon size={32} className="text-blue-100 group-hover:text-white" />
                </div>
                <div className="text-4xl md:text-5xl font-black mb-2 tracking-tight">{stat.value}</div>
                <div className="text-[12px] font-bold uppercase tracking-[0.2em] text-blue-300">{stat.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ImpactStats;
