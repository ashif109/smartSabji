import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { Power, User, Leaf, Loader2, ShieldCheck, Zap } from 'lucide-react';
import { UserProfile } from './types';
import { handleFirestoreError, OperationType } from './lib/utils';

import Auth from './components/Auth';
import CustomerView from './components/CustomerView';
import SellerView from './components/SellerView';
import AdminView from './components/AdminView';
import LandingPage from './components/LandingPage';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    let profileUnsub: () => void;

    const authUnsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        setShowAuth(false);
        profileUnsub = onSnapshot(doc(db, 'users', u.uid), (snap) => {
          if (snap.exists()) {
            setProfile({ id: snap.id, ...snap.data() } as UserProfile);
          } else {
            setProfile(null);
          }
          setLoading(false);
        }, (error) => {
          if (auth.currentUser) {
            handleFirestoreError(error, OperationType.GET, `users/${u.uid}`, auth);
          }
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
      <div className="min-h-[100dvh] flex items-center justify-center bg-white">
        <div className="text-center space-y-6">
          <Loader2 className="w-10 h-10 text-brand animate-spin mx-auto" />
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-brand">VegieRoute</p>
        </div>
      </div>
    );
  }

  if (showAuth && !user) {
    return <Auth onSuccess={() => setShowAuth(false)} />;
  }

  if (!user || !profile) {
    return <LandingPage onStart={() => setShowAuth(true)} />;
  }

  return (
    <div className="min-h-[100dvh] bg-[#F4F7F5] text-dark font-sans selection:bg-brand selection:text-white flex flex-col">
      <main className="flex-1 overflow-x-hidden">
        {profile.role === 'customer' && <CustomerView user={profile} />}
        {profile.role === 'seller' && <SellerView seller={profile as any} />}
        {profile.role === 'admin' && <AdminView />}
      </main>
    </div>
  );
}
