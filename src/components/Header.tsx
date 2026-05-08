import React from 'react';
import { Facebook, Globe } from 'lucide-react';
import logo from '../assets/logo.png';

const Header: React.FC = () => {
  return (
    <header className="bg-white">
      {/* Top Utility Nav */}
      <div className="bg-[#f8f8f8] border-b border-gray-200 py-1 hidden lg:block">
        <div className="institutional-container flex justify-between items-center text-[10px] font-bold text-gray-700">
          <div className="flex gap-4">
            {["GURUKULAM MAIL", "ALUMNI PORTAL", "QR code", "e-Office", "Library", "Scholarship", "FMS/MIS", "UNESCO"].map((item, i) => (
              <span key={i} className={`cursor-pointer hover:text-blue-600 transition-colors ${item === 'UNESCO' ? 'text-orange-600' : ''}`}>{item}</span>
            ))}
          </div>
          <div className="flex items-center gap-3">
             <Facebook size={12} className="text-blue-700 cursor-pointer hover:opacity-80 transition-opacity" />
             <span className="text-gray-400">X</span>
             <div className="flex items-center gap-2 bg-white border border-gray-300 rounded px-2 py-0.5 shadow-sm">
               <Globe size={10} className="text-gray-500" />
               <select className="bg-transparent outline-none text-[10px] font-bold text-gray-700 cursor-pointer">
                 <option value="en">ENGLISH</option>
                 <option value="hi">हिन्दी (HINDI)</option>
               </select>
             </div>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <div className="py-6 shadow-sm">
        <div className="institutional-container flex items-center justify-between">
          <div className="flex items-center gap-6">
            <img src={logo} alt="Triyambakam Logo" className="h-20 w-auto hover:scale-105 transition-transform duration-300" />
            <div className="border-l-2 border-gray-200 pl-6 py-1">
              <h1 className="text-2xl font-serif font-bold text-[#006400] leading-tight tracking-wide">त्र्यंबकम गुरुकुलम एसोसिएशन</h1>
              <h2 className="text-lg font-serif font-bold text-[#006400] tracking-tight">Triyambakam Gurukulam Association</h2>
              <p className="text-[11px] text-gray-500 font-semibold mt-1 uppercase tracking-widest">(A Premier Educational Research & Cultural Academy)</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-8">
             <button className="bg-orange-600 text-white px-8 py-3 rounded-sm font-black text-xs uppercase tracking-[0.2em] hover:bg-orange-700 transition-all shadow-xl hover:-translate-y-1">
               Donate Now
             </button>
             <img src={logo} alt="Secondary Logo" className="h-16 w-auto opacity-40 grayscale hover:grayscale-0 transition-all cursor-pointer" />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
