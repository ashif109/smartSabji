import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Gift, Award, Coins, ChevronLeft, Sparkles, Trophy, Star, History, Info, X } from 'lucide-react';
import { Reward, UserProfile } from '../types';
import { cn, handleFirestoreError, OperationType } from '../lib/utils';

interface RewardsViewProps {
  user: UserProfile;
  onBack: () => void;
}

const ScratchCard: React.FC<{ reward: Reward; onScratchComplete: (amount: number) => void }> = ({ reward, onScratchComplete }) => {
  const [isScratched, setIsScratched] = useState(reward.status === 'scratched');
  const [isScratching, setIsScratching] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reward.status === 'scratched' || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Fill with pattern or solid color
    ctx.fillStyle = '#10B981'; // brand color
    ctx.fillRect(0, 0, width, height);

    // Add some texture/pattern to the scratch surface
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    for (let i = 0; i < 50; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * width, Math.random() * height, Math.random() * 20, 0, Math.PI * 2);
      ctx.fill();
    }

    // Add Logo or text
    ctx.font = 'bold 24px Inter';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.fillText('SCRATCH ME', width / 2, height / 2);
    ctx.font = 'bold 10px Inter';
    ctx.fillText('VEGIEROUTE REWARDS', width / 2, height / 2 + 30);

    const handleScratch = (e: MouseEvent | TouchEvent) => {
      if (isScratched) return;
      setIsScratching(true);

      const rect = canvas.getBoundingClientRect();
      let x, y;

      if (e instanceof MouseEvent) {
        x = e.clientX - rect.left;
        y = e.clientY - rect.top;
      } else {
        x = e.touches[0].clientX - rect.left;
        y = e.touches[0].clientY - rect.top;
      }

      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(x, y, 25, 0, Math.PI * 2);
      ctx.fill();

      // Check percentage scratched
      const imageData = ctx.getImageData(0, 0, width, height);
      let transparentPixels = 0;
      for (let i = 0; i < imageData.data.length; i += 4) {
        if (imageData.data[i + 3] === 0) transparentPixels++;
      }

      const percentage = (transparentPixels / (width * height)) * 100;
      if (percentage > 45) {
        setIsScratched(true);
        onScratchComplete(reward.amount);
      }
    };

    canvas.addEventListener('mousemove', handleScratch);
    canvas.addEventListener('touchmove', handleScratch);

    return () => {
      canvas.removeEventListener('mousemove', handleScratch);
      canvas.removeEventListener('touchmove', handleScratch);
    };
  }, [reward, isScratched]);

  return (
    <div 
      ref={containerRef}
      className="relative w-full aspect-square md:w-64 md:h-64 rounded-3xl overflow-hidden bg-white border border-slate-100 shadow-xl group transition-all"
    >
      {/* Target Content (The Reward) */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white p-6 text-center">
        <div className="w-20 h-20 bg-brand/10 rounded-full flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
          <Coins className="w-10 h-10 text-brand" />
        </div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">You won</p>
        <h3 className="text-4xl font-display font-black text-slate-900 italic tracking-tighter">
          {reward.amount} <span className="text-brand text-lg">SUPERCOINS</span>
        </h3>
        <p className="mt-4 text-[9px] font-bold text-slate-300 uppercase tracking-widest leading-relaxed">
          Added to your wallet <br /> on {new Date().toLocaleDateString()}
        </p>
      </div>

      {/* Scratch Layer */}
      {!isScratched && (
        <canvas 
          ref={canvasRef}
          width={400}
          height={400}
          className="absolute inset-0 w-full h-full cursor-crosshair z-10 touch-none"
        />
      )}

      {/* Scratched Overlay with confetti-like effect if just finished */}
      <AnimatePresence>
        {isScratched && reward.status === 'unscratched' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center"
          >
             <Sparkles className="w-full h-full text-brand opacity-20 animate-pulse" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const RewardsView: React.FC<RewardsViewProps> = ({ user, onBack }) => {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');

  useEffect(() => {
    const q = query(
      collection(db, 'rewards'),
      where('userId', '==', user.id)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const rewardsData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reward));
      setRewards(rewardsData.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'rewards', auth);
      setLoading(false);
    });

    return unsubscribe;
  }, [user.id]);

  const handleScratchComplete = async (reward: Reward) => {
    if (reward.status === 'scratched') return;

    try {
      // 1. Update reward status
      await updateDoc(doc(db, 'rewards', reward.id), {
        status: 'scratched',
        scratchedAt: new Date().toISOString()
      });

      // 2. Update user coins balance
      const userRef = doc(db, 'users', user.id);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const currentCoins = userSnap.data().superCoins || 0;
        await updateDoc(userRef, {
          superCoins: currentCoins + reward.amount
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `rewards/${reward.id}`, auth);
    }
  };

  const pendingRewards = rewards.filter(r => r.status === 'unscratched');
  const scratchedRewards = rewards.filter(r => r.status === 'scratched');

  return (
    <div className="flex flex-col h-full bg-[#f8fafc]">
      {/* Header */}
      <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="w-12 h-12 rounded-2xl flex items-center justify-center bg-slate-50 border border-slate-100 text-slate-400 hover:text-brand transition-all"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h2 className="text-3xl font-display font-black text-slate-900 tracking-tighter uppercase italic leading-none">
              Control <span className="text-brand">Rewards</span>
            </h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mt-1">GPay Style Fidelity Engine</p>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-2 bg-brand/10 text-brand px-4 py-2 rounded-2xl border border-brand/20">
            <Coins className="w-5 h-5" />
            <span className="text-xl font-display font-black tracking-tighter italic">{user.superCoins || 0}</span>
          </div>
          <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest mt-1">AVAILABLE BALANCE</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 max-w-5xl mx-auto w-full space-y-12">
        {/* Navigation Tabs */}
        <div className="flex gap-4 p-2 bg-white border border-slate-100 rounded-[28px] shadow-sm w-fit mx-auto">
          <button 
            onClick={() => setActiveTab('pending')}
            className={cn(
              "px-8 py-4 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all",
              activeTab === 'pending' ? "bg-slate-900 text-white shadow-xl" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Unscratched ({pendingRewards.length})
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={cn(
              "px-8 py-4 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all",
              activeTab === 'history' ? "bg-slate-900 text-white shadow-xl" : "text-slate-400 hover:text-slate-600"
            )}
          >
            History ({scratchedRewards.length})
          </button>
        </div>

        <div className="min-h-[400px]">
          {activeTab === 'pending' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {pendingRewards.length === 0 ? (
                <div className="col-span-full h-80 flex flex-col items-center justify-center text-center space-y-6 opacity-30">
                  <Gift className="w-20 h-20 text-slate-300" />
                  <div className="space-y-2">
                    <p className="font-black uppercase tracking-[0.2em] text-xs text-slate-400">Empty Reward Vault</p>
                    <p className="text-[10px] max-w-xs font-bold leading-relaxed">
                      Shop more to unlock exclusive scratch cards. Every order over ₹500 is eligible.
                    </p>
                  </div>
                </div>
              ) : (
                pendingRewards.map(reward => (
                  <motion.div 
                    key={reward.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex justify-center"
                  >
                    <ScratchCard 
                      reward={reward} 
                      onScratchComplete={() => handleScratchComplete(reward)} 
                    />
                  </motion.div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-4">
               {scratchedRewards.length === 0 ? (
                 <div className="h-80 flex flex-col items-center justify-center text-center space-y-6 opacity-30">
                    <History className="w-20 h-20 text-slate-300" />
                    <p className="font-black uppercase tracking-[0.2em] text-xs text-slate-400">No History recorded</p>
                 </div>
               ) : (
                 scratchedRewards.map(reward => (
                   <div key={reward.id} className="bg-white border border-slate-100 rounded-[32px] p-6 flex items-center justify-between group hover:shadow-xl transition-all">
                      <div className="flex items-center gap-6">
                        <div className="w-16 h-16 bg-brand/10 rounded-[20px] flex items-center justify-center">
                          <Coins className="w-8 h-8 text-brand" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-xl font-display font-black text-slate-900 tracking-tighter uppercase italic leading-none">
                            {reward.amount} Coins
                          </h4>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">
                            Redeemed on {new Date(reward.scratchedAt || reward.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                         <div className="px-3 py-1 rounded-lg bg-slate-50 border border-slate-100 text-[8px] font-black uppercase tracking-widest text-slate-400">
                            TRANSACTION_LOG_SUCCESS
                         </div>
                         <Sparkles className="w-5 h-5 text-brand" />
                      </div>
                   </div>
                 ))
               )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RewardsView;
