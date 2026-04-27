import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { Power, User, Leaf, Loader2, ShieldCheck, Zap } from 'lucide-react';
import { UserProfile } from './types';

import Auth from './components/Auth';
import CustomerView from './components/CustomerView';
import SellerView from './components/SellerView';
import AdminView from './components/AdminView';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let profileUnsub: () => void;

    const authUnsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        profileUnsub = onSnapshot(doc(db, 'users', u.uid), (snap) => {
          if (snap.exists()) {
            setProfile({ id: snap.id, ...snap.data() } as UserProfile);
          } else {
            setProfile(null);
          }
          setLoading(false);
        }, (error) => {
          console.warn("Profile sync restricted or awaiting permissions:", error);
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      authUnsub();
      if (profileUnsub) profileUnsub();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-dark">
        <div className="text-center space-y-6">
          <Loader2 className="w-10 h-10 text-brand animate-spin mx-auto opacity-40" />
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-neutral-600">Initializing Core...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return <Auth onSuccess={() => {}} />;
  }

  return (
    <div className="min-h-[100dvh] bg-dark text-white font-sans selection:bg-brand selection:text-dark flex flex-col">
      {/* Prime Header - High Contrast */}
      <header className="bg-dark/80 backdrop-blur-2xl border-b border-line sticky top-0 z-[100] h-20 md:h-24 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto h-full flex justify-between items-center">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-brand rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg shadow-brand/20">
               <Zap className="text-dark w-5 h-5 sm:w-6 sm:h-6 fill-current" />
            </div>
            <div>
               <p className="font-display font-black text-lg sm:text-2xl tracking-tighter uppercase leading-none">Fresh Routes</p>
               <p className="text-[8px] sm:text-[9px] font-black uppercase text-brand tracking-[0.2em] mt-1 leading-none">Global Logistics</p>
            </div>
          </div>

          <div className="flex items-center gap-4 sm:gap-10">
            <div className="flex items-center gap-3 sm:gap-4 text-right">
              <div className="hidden xs:block">
                <p className="text-[10px] sm:text-sm font-black uppercase tracking-widest">{profile.fullName?.split(' ')[0] || 'User'}</p>
                <div className="flex items-center gap-2 justify-end mt-1">
                   <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-brand rounded-full animate-pulse" />
                   <p className="text-[8px] sm:text-[9px] text-neutral-500 font-bold uppercase tracking-[0.2em]">{profile.role}</p>
                </div>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-[20px] bg-surface-hover border border-line flex items-center justify-center overflow-hidden">
                 {profile.photoURL ? (
                    <img src={profile.photoURL} alt="" className="w-full h-full object-cover grayscale" />
                 ) : (
                    <User className="text-neutral-700 w-5 h-5 sm:w-6 sm:h-6" />
                 )}
              </div>
            </div>
            <button 
              onClick={() => signOut(auth)}
              className="w-10 h-10 sm:w-14 sm:h-14 flex items-center justify-center bg-surface border border-line rounded-lg sm:rounded-2xl text-neutral-500 hover:text-brand hover:border-brand/40 transition-all active:scale-95 group"
              title="Terminate Session"
            >
              <Power className="w-4 h-4 sm:w-5 sm:h-5 group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-x-hidden">
        {profile.role === 'customer' && <CustomerView user={profile} />}
        {profile.role === 'seller' && <SellerView seller={profile as any} />}
        {profile.role === 'admin' && <AdminView />}
      </main>

      {/* Global Status Rail */}
      <footer className="fixed bottom-4 left-8 pointer-events-none hidden lg:block">
         <div className="flex items-center gap-12 text-[9px] font-black uppercase tracking-[0.3em] text-neutral-700 border-l border-line pl-8">
            <div className="flex items-center gap-3">
               <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
               <span>Nodes Verified</span>
            </div>
            <div className="flex items-center gap-3">
               <div className="w-1.5 h-1.5 bg-brand rounded-full" />
               <span>Logistics Sync Active</span>
            </div>
         </div>
      </footer>
    </div>
  );
}
