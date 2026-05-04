import React from 'react';
import { Leaf, Truck, ShieldCheck, Star, ArrowRight, MapPin, ShoppingBag, Zap, Clock } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface LandingPageProps {
  onStart: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onStart }) => {
  return (
    <div className="bg-white min-h-screen font-sans selection:bg-brand selection:text-white">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center shadow-lg shadow-brand/20">
              <Leaf className="text-white w-6 h-6" />
            </div>
            <span className="text-2xl font-black tracking-tighter text-dark uppercase">Smart <span className="text-brand">Sabji</span></span>
          </div>
          
          <div className="hidden md:flex items-center gap-8">
            <a href="#how-it-works" className="text-sm font-bold uppercase tracking-widest text-gray-400 hover:text-brand transition-colors">How it works</a>
            <a href="#benefits" className="text-sm font-bold uppercase tracking-widest text-gray-400 hover:text-brand transition-colors">Benefits</a>
            <button 
              onClick={onStart}
              className="px-8 py-3 bg-brand text-white rounded-full font-bold uppercase tracking-widest text-xs hover:shadow-xl hover:shadow-brand/20 transition-all active:scale-95"
            >
              Sign In
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-10">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand/10 border border-brand/20 rounded-full text-brand text-xs font-black uppercase tracking-[0.2em]"
            >
              <Zap className="w-4 h-4" />
              <span>Express Delivery in 30 Mins</span>
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-6xl md:text-8xl font-black text-dark tracking-tighter leading-[0.9]"
            >
              Fresh <span className="text-brand">Sabji</span> <br />
              Direct to <br />
              Your Door.
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-gray-400 text-lg md:text-xl font-medium max-w-lg leading-relaxed"
            >
              Connect with local farmers and premium vendors. Hyperlocal delivery of the freshest vegetables curated for your health.
            </motion.p>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <button 
                onClick={onStart}
                className="btn-brand flex items-center justify-center gap-3 overflow-hidden group"
              >
                <span>🚀 Order Now</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button 
                onClick={onStart}
                className="btn-outline flex items-center justify-center gap-3"
              >
                <MapPin className="w-5 h-5" />
                <span>Check Nearby Vendors</span>
              </button>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="pt-8 flex items-center gap-8 border-t border-gray-100"
            >
              <div>
                <p className="text-2xl font-black text-dark italic">10k+</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Happy Cooks</p>
              </div>
              <div className="h-10 w-px bg-gray-100" />
              <div>
                <p className="text-2xl font-black text-brand italic">500+</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Local Sellers</p>
              </div>
              <div className="h-10 w-px bg-gray-100" />
              <div className="flex items-center gap-2">
                <div className="flex -space-x-3">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-gray-100 overflow-hidden">
                      <img src={`https://i.pravatar.cc/100?img=${i+10}`} alt="user" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-0.5 ml-2">
                  <Star className="w-3 h-3 text-brand fill-brand" />
                  <span className="text-[10px] font-bold text-gray-800">4.9/5</span>
                </div>
              </div>
            </motion.div>
          </div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="relative"
          >
            <div className="absolute inset-0 bg-brand/20 blur-[130px] rounded-full translate-x-10 translate-y-10" />
            <div className="relative aspect-square rounded-[60px] overflow-hidden shadow-2xl shadow-brand/20 border-8 border-white">
               <img 
                 src="https://images.unsplash.com/photo-1597362868479-35442177a630?q=80&w=1000&auto=format&fit=crop" 
                 alt="Fresh Vegetables" 
                 className="w-full h-full object-cover hover:scale-105 transition-transform duration-[2s]"
               />
               <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-12">
                  <div className="bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-[32px] space-y-4">
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 bg-brand rounded-2xl flex items-center justify-center">
                          <Truck className="text-white w-6 h-6" />
                       </div>
                       <div>
                          <p className="text-white font-black text-xl italic tracking-tighter">On Its Way!</p>
                          <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest">Driver: Rajesh M.</p>
                       </div>
                    </div>
                    <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                       <motion.div 
                         initial={{ width: 0 }}
                         animate={{ width: '70%' }}
                         transition={{ duration: 4, repeat: Infinity }}
                         className="h-full bg-brand" 
                       />
                    </div>
                  </div>
               </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 bg-gray-50/50 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center space-y-4 mb-20">
            <p className="text-brand text-xs font-black uppercase tracking-[0.4em]">The Protocol</p>
            <h2 className="text-5xl font-black text-dark tracking-tighter">Harvest to Doorstep</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: MapPin, title: "Pick Location", desc: "Select your sector or let our GPS find the nearest market node." },
              { icon: ShoppingBag, title: "Curate Basket", desc: "Boutique selection of organic and daily-harvest vegetables." },
              { icon: Clock, title: "30 Min Delivery", desc: "Our network of local riders ensures field-freshness preservation." }
            ].map((step, i) => (
              <div key={i} className="bg-white p-12 rounded-[48px] border border-gray-100 shadow-sm hover:shadow-xl transition-all group">
                <div className="w-20 h-20 bg-brand/5 rounded-[32px] flex items-center justify-center mb-8 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
                  <step.icon className="w-10 h-10 text-brand" />
                </div>
                <h3 className="text-2xl font-black text-dark mb-4 tracking-tight uppercase italic">{step.title}</h3>
                <p className="text-gray-400 font-medium leading-relaxed">{step.desc}</p>
                <div className="mt-8 text-6xl font-black text-gray-50 group-hover:text-brand/10 transition-colors">0{i+1}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Section */}
      <section id="benefits" className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
            <div className="relative order-2 lg:order-1">
               <div className="aspect-[4/5] rounded-[60px] overflow-hidden bg-gray-100 relative group shadow-2xl">
                  <img 
                    src="https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=1000&auto=format&fit=crop" 
                    alt="Process" 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
                  />
                  <div className="absolute top-10 left-10 p-8 glass-dark rounded-[40px] border border-white/20 text-white space-y-4 max-w-[240px]">
                    <ShieldCheck className="w-12 h-12 text-brand" />
                    <p className="text-2xl font-black tracking-tighter leading-none italic">100% Quality Guaranteed</p>
                    <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest leading-relaxed">Every item is scanned for freshness before dispatch.</p>
                  </div>
               </div>
            </div>

            <div className="space-y-12 order-1 lg:order-2">
              <div className="space-y-4">
                <p className="text-brand text-xs font-black uppercase tracking-[0.4em]">Why Us?</p>
                <h2 className="text-6xl font-black text-dark tracking-tighter leading-tight italic">Revolutionizing the <br /> <span className="text-brand">Fresh Economy</span></h2>
              </div>
              
              <div className="space-y-8">
                {[
                  { icon: Leaf, title: "Farmer First", desc: "Higher margins for growers, lower prices for you." },
                  { icon: ShieldCheck, title: "Zero Plastic", desc: "Environmentally conscious packaging protocols." },
                  { icon: Zap, title: "AI Guided", desc: "Predictive demand ensures zero wastage of produce." }
                ].map((item, i) => (
                  <div key={i} className="flex gap-6 items-start group">
                    <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center shrink-0 border border-gray-100 group-hover:bg-brand group-hover:border-brand transition-all duration-300">
                      <item.icon className="w-6 h-6 text-brand group-hover:text-white transition-colors" />
                    </div>
                    <div>
                      <h4 className="text-xl font-black text-dark tracking-tighter uppercase italic">{item.title}</h4>
                      <p className="text-gray-400 font-medium">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              
              <button 
                onClick={onStart}
                className="btn-brand"
              >
                Join the Network
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-dark py-20 text-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="border-b border-white/10 pb-20 grid grid-cols-1 md:grid-cols-4 gap-16">
            <div className="space-y-8 col-span-1 md:col-span-2">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center">
                  <Leaf className="text-white w-6 h-6" />
                </div>
                <span className="text-2xl font-black tracking-tighter uppercase">Smart <span className="text-brand">Sabji</span></span>
              </div>
              <p className="text-white/40 max-w-sm text-lg font-medium">Building a more resilient, localized, and transparent food system for everyone.</p>
            </div>
            
            <div className="space-y-6">
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-brand">Explore</p>
              <ul className="space-y-4 font-bold text-white/60">
                <li><a href="#" className="hover:text-white transition-colors">Our Story</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Farmer Network</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Sustainability</a></li>
              </ul>
            </div>
            
            <div className="space-y-6">
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-brand">Connect</p>
              <ul className="space-y-4 font-bold text-white/60">
                <li><a href="#" className="hover:text-white transition-colors">Twitter</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Instagram</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Linktree</a></li>
              </ul>
            </div>
          </div>
          
          <div className="pt-10 flex flex-col md:flex-row justify-between items-center gap-6">
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20">© 2026 SMART SABJI TECHNOLOGIES</p>
            <div className="flex gap-8 text-[10px] font-black uppercase tracking-[0.4em] text-white/20">
              <a href="#" className="hover:text-brand transition-colors">Privacy</a>
              <a href="#" className="hover:text-brand transition-colors">Terms</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
