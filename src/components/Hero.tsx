import React from 'react';
import { motion } from 'motion/react';

const Hero: React.FC = () => {
  return (
    <div className="relative w-full h-[450px] overflow-hidden bg-gray-900 border-b-8 border-[#0055a5]">
      {/* Background with Overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-60 scale-105"
        style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1542810634-71277d95dcbb?w=1600&q=80")' }}
      ></div>
      <div className="absolute inset-0 bg-gradient-to-t from-[#003366] via-transparent to-transparent"></div>

      {/* Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-4xl"
        >
          <div className="inline-block px-4 py-1 bg-orange-600 text-white text-[12px] font-bold uppercase tracking-widest mb-6 rounded-sm shadow-xl">
            National Initiative 2026
          </div>
          
          <h2 className="text-4xl md:text-6xl font-serif font-black text-white leading-tight drop-shadow-2xl mb-8 uppercase tracking-tight">
            Preserving Wisdom, <br />
            <span className="text-orange-400">Empowering</span> the Future
          </h2>

          <div className="flex flex-wrap justify-center gap-4">
            <button className="bg-orange-600 text-white px-8 py-3 rounded-sm font-black text-sm uppercase tracking-wider hover:bg-orange-700 transition-all shadow-xl hover:-translate-y-1">
              Donate to the Mission
            </button>
            <button className="bg-transparent border-2 border-white text-white px-8 py-3 rounded-sm font-bold text-sm uppercase tracking-wider hover:bg-white/10 transition-all shadow-xl hover:-translate-y-1">
              Become a Volunteer
            </button>
          </div>
        </motion.div>
      </div>

      {/* Decorative Elements */}
      <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 via-white to-green-600"></div>
    </div>
  );
};

export default Hero;
