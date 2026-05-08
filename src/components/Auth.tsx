import React, { useState } from 'react';
import { auth, signInWithGoogle, db } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { motion } from 'motion/react';
import { Leaf, AlertCircle, Loader2 } from 'lucide-react';
import { UserRole } from '../types';
import { cn, handleFirestoreError, OperationType } from '../lib/utils';

interface AuthProps {
  onSuccess: (user: any) => void;
}

const Auth: React.FC<AuthProps> = ({ onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<UserRole>('customer');
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithGoogle();
      const userRef = doc(db, 'users', result.user.uid);
      let userSnap;
      try {
        userSnap = await getDoc(userRef);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `users/${result.user.uid}`, auth);
      }

      if (userSnap && !userSnap.exists()) {
        try {
          await setDoc(userRef, {
            id: result.user.uid,
            email: result.user.email,
            fullName: result.user.displayName,
            role: role,
            superCoins: 0,
            createdAt: new Date().toISOString()
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `users/${result.user.uid}`, auth);
        }
      }
      onSuccess(result.user);
    } catch (err: any) {
      console.error("Auth error", err);
      if (err.code === 'auth/popup-blocked') {
        setError("Popup blocked. Please enable popups.");
      } else {
        setError("Identification failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#F4F7F5] flex flex-col md:flex-row h-screen md:overflow-hidden overflow-y-auto">
      {/* Left Pane - Branding */}
      <div className="hidden md:flex flex-1 bg-brand p-20 flex-col justify-between relative overflow-hidden">
        <div className="absolute top-0 right-0 p-20 opacity-10 rotate-12">
           <Leaf className="w-96 h-96 text-white" />
        </div>
        <div className="relative z-10">
          <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mb-12 shadow-xl">
             <Leaf className="w-12 h-12 text-brand" />
          </div>
          <h1 className="text-[8vw] text-white leading-[0.85] tracking-tighter font-black uppercase italic">Vegie<br/><span className="text-white/40">Route</span></h1>
          <p className="text-white/80 font-black text-xl uppercase tracking-tighter mt-8">Nourishing Neighbors in 30 Mins.</p>
        </div>
        <div className="space-y-6 relative z-10">
          <p className="text-white font-black text-2xl uppercase tracking-tighter italic">Freshness Protocol Active</p>
          <div className="h-2 w-32 bg-white rounded-full"></div>
        </div>
      </div>

      {/* Right Pane - Form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 bg-white uppercase">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full pt-8 pb-16 sm:py-0"
        >
          <div className="md:hidden mb-8 text-center">
             <div className="w-14 h-14 bg-brand rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-brand/20">
                <Leaf className="w-8 h-8 text-white" />
             </div>
             <h1 className="text-3xl text-gray-800 tracking-tighter uppercase font-black italic">Vegie <span className="text-brand">Route</span></h1>
          </div>

          <p className="text-brand font-black text-[10px] sm:text-xs uppercase tracking-[0.4em] mb-4">Hyperlocal Harvest</p>
          <h2 className="text-4xl sm:text-7xl text-slate-900 mb-6 tracking-tighter uppercase font-black italic italic leading-[0.85]">Freshness<br />Unlocked</h2>
          <p className="text-slate-500 mb-10 sm:mb-14 font-bold text-base sm:text-lg leading-tight uppercase tracking-tight">Direct from local nodes to your doorstep. Join the movement.</p>

          <div className="flex bg-slate-50 p-2 rounded-[32px] mb-10 border border-slate-100">
            <button 
              onClick={() => setRole('customer')}
              className={cn(
                "flex-1 py-5 rounded-[26px] font-black uppercase text-xs tracking-widest transition-all",
                role === 'customer' ? "bg-brand text-white shadow-xl shadow-brand/20" : "bg-transparent text-slate-400"
              )}
            >
              Customer
            </button>
            <button 
              onClick={() => setRole('seller')}
              className={cn(
                "flex-1 py-5 rounded-[26px] font-black uppercase text-xs tracking-widest transition-all",
                role === 'seller' ? "bg-brand text-white shadow-xl shadow-brand/20" : "bg-transparent text-slate-400"
              )}
            >
              Vendor
            </button>
          </div>

          {error && (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="mb-8 p-6 bg-red-50 border border-red-100 text-red-500 rounded-[28px] text-xs font-black flex items-center gap-4 uppercase tracking-wider"
            >
              <AlertCircle className="w-6 h-6 flex-shrink-0" /> {error}
            </motion.div>
          )}

          <button 
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-5 py-6 sm:py-8 bg-slate-900 text-white rounded-[32px] font-black text-xl sm:text-2xl uppercase tracking-tighter hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-50 shadow-2xl shadow-slate-200 border-b-8 border-slate-950"
          >
            {loading ? (
              <Loader2 className="w-8 h-8 animate-spin" />
            ) : (
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-lg">
                <svg className="w-7 h-7" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.12V7.04H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.96l3.66-2.86z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.66 2.86c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
              </div>
            )}
            {loading ? "AUTHENTICATING..." : "Google Sync"}
          </button>

          <p className="mt-16 text-[10px] text-gray-400 font-black uppercase tracking-[0.2em] text-center leading-relaxed max-w-[280px] mx-auto">
            Secure Farm Access <br/>
            <span className="text-gray-300">P2P Encryption Active</span>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Auth;
