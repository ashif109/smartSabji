import React from 'react';
import { Globe, ChevronDown } from 'lucide-react';
import { NAV_MAIN, NAV_SECONDARY } from '../data/siteData';

const Navbar: React.FC = () => {
  return (
    <nav className="sticky top-0 z-50 shadow-lg">
      {/* Primary Navigation */}
      <div className="bg-[#0055a5] text-white">
        <div className="institutional-container">
          <div className="flex items-center flex-wrap overflow-x-auto no-scrollbar">
            <div className="p-4 border-r border-white/10 hover:bg-[#003366] transition-colors cursor-pointer group">
              <Globe size={16} className="group-hover:rotate-12 transition-transform" />
            </div>
            {NAV_MAIN.map((item, i) => (
              <div key={i} className="px-5 py-4 text-[11px] font-bold border-r border-white/10 hover:bg-[#003366] transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap group">
                {item} 
                <ChevronDown size={10} className="group-hover:translate-y-0.5 transition-transform opacity-70" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Secondary Navigation */}
      <div className="bg-[#003366] py-2 border-t border-white/5">
        <div className="institutional-container flex gap-6 text-[10px] font-bold text-white/80">
          {NAV_SECONDARY.map((item, i) => (
            <span key={i} className="hover:text-white transition-colors cursor-pointer uppercase tracking-wider relative group">
              {item}
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-orange-400 transition-all group-hover:w-full"></span>
            </span>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
