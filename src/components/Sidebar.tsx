import React from 'react';
import { Mail, Download, ChevronRight } from 'lucide-react';
import { PUBLICATIONS, POLICY_BRIEFS, NEWSLETTERS, KEY_RESOURCES } from '../data/siteData';

const Sidebar: React.FC = () => {
  return (
    <aside className="lg:col-span-1 space-y-10 bg-[#fffdfa] p-5 border border-[#eee6d8] shadow-sm rounded-sm">
      {/* Gurukulam Greetings */}
      <div>
        <h3 className="section-title text-[#006400] text-[13px] font-black bg-[#f2fcf2] p-2 rounded-sm border-l-4 border-green-700">
          GURUKULAM GREETINGS
        </h3>
        <div className="mt-6">
          <h4 className="text-[11px] font-bold text-green-800 border-b border-gray-200 pb-1 mb-4 uppercase tracking-tighter">Latest News</h4>
          <div className="space-y-4">
            <div className="group cursor-pointer">
              <p className="text-[11px] text-green-900 italic leading-snug group-hover:text-blue-700 transition-colors">
                "International Conference on 'Vedic Science in Modern World' successfully concludes at the main campus."
              </p>
              <span className="text-blue-600 font-bold text-[10px] mt-1 inline-block">read more...</span>
            </div>
            <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-100 rounded-sm">
              <p className="text-[10px] text-red-900 font-bold leading-tight">
                Capacity Building Programmes 2026-27
              </p>
              <span className="text-[8px] bg-red-600 text-white px-1 py-0.5 rounded italic font-bold animate-pulse">NEW</span>
            </div>
          </div>
        </div>
      </div>

      {/* Publications */}
      <div>
        <h4 className="text-[11px] font-bold text-red-900 border-b border-gray-200 pb-1 mb-4 uppercase tracking-tighter">Latest Publications</h4>
        <div className="grid grid-cols-3 gap-3">
          {PUBLICATIONS.map((pub, i) => (
            <div key={i} className="text-center group cursor-pointer">
              <div className="relative overflow-hidden border border-gray-200 rounded-sm shadow-sm group-hover:border-blue-600 transition-all">
                <img src={pub.img} alt={pub.title} className="w-full aspect-[3/4] object-cover group-hover:scale-110 transition-transform duration-500" />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </div>
              <p className="text-[9px] font-bold mt-2 text-gray-700 leading-tight line-clamp-2">{pub.title}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Policy Briefs */}
      <div>
        <h4 className="text-[11px] font-bold text-blue-900 border-b border-gray-200 pb-1 mb-4 uppercase tracking-tighter">Policy Briefs</h4>
        <div className="grid grid-cols-3 gap-3">
          {POLICY_BRIEFS.map((pub, i) => (
            <div key={i} className="text-center group cursor-pointer">
              <div className="relative overflow-hidden border border-gray-200 rounded-sm shadow-sm group-hover:border-blue-600 transition-all">
                <img src={pub.img} alt={pub.title} className="w-full aspect-[3/4] object-cover group-hover:scale-110 transition-transform duration-500" />
              </div>
              <p className="text-[9px] font-bold mt-2 text-gray-700 leading-tight line-clamp-2">{pub.title}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Newsletter */}
      <div>
        <h4 className="text-[11px] font-bold text-orange-800 border-b border-gray-200 pb-1 mb-4 uppercase tracking-tighter">Newsletters</h4>
        <div className="space-y-4">
          {NEWSLETTERS.map((item, i) => (
            <div key={i} className="flex gap-3 items-center group cursor-pointer p-1 hover:bg-orange-50 rounded-sm transition-colors">
              <div className="bg-orange-100 p-2 rounded-full text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-all">
                <Mail size={14} />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-bold text-blue-800 group-hover:underline">{item.title}</p>
                <p className="text-[9px] text-gray-400 font-semibold">{item.date}</p>
              </div>
              <ChevronRight size={12} className="text-gray-300 group-hover:text-orange-600" />
            </div>
          ))}
        </div>
      </div>

      {/* Key Resources */}
      <div>
        <h4 className="text-[11px] font-bold text-slate-800 border-b border-gray-200 pb-1 mb-4 uppercase tracking-tighter">Key Resources</h4>
        <div className="grid grid-cols-3 gap-3">
          {KEY_RESOURCES.map((pub, i) => (
            <div key={i} className="text-center group cursor-pointer">
              <div className="w-full aspect-square bg-gray-50 border border-gray-200 rounded-sm group-hover:bg-blue-600 group-hover:border-blue-600 flex items-center justify-center transition-all shadow-sm">
                <Download size={20} className="text-gray-400 group-hover:text-white transition-colors" />
              </div>
              <p className="text-[9px] font-bold mt-2 text-gray-700 leading-tight">{pub.title}</p>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
