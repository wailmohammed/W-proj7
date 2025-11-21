
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { User, UserRole, PlanTier, CryptoWallet, SubscriptionPlan, BrokerIntegration, BrokerProvider } from '../types';
import { DEFAULT_BROKER_PROVIDERS } from '../constants';

// --- Mock Data for Fallbacks/UI ---
const DEFAULT_WALLETS: CryptoWallet[] = [
  { id: '1', coin: 'Bitcoin', network: 'Bitcoin', address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', isEnabled: true },
  { id: '2', coin: 'Ethereum', network: 'ERC20', address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F', isEnabled: true },
];

const DEFAULT_PLANS: SubscriptionPlan[] = [
  { 
    id: 'Free', 
    name: 'Starter', 
    price: 0, 
    description: 'Essential tracking for beginners.',
    limits: { portfolios: 1, holdings: 15, connections: 0, watchlists: 1 },
    features: ['1 Portfolio', 'Up to 15 Holdings', '1 Watchlist', 'Basic Dividend Tracking'] 
  },
  { 
    id: 'Pro', 
    name: 'Investor', 
    price: 15, 
    isPopular: true,
    description: 'Automated analytics for growing portfolios.',
    limits: { portfolios: 3, holdings: -1, connections: 5, watchlists: 3 },
    features: ['3 Portfolios', 'Unlimited Holdings', '5 Broker Connections', '3 Watchlists', 'Dividend Calendar', 'Future Wealth Projection'] 
  },
  { 
    id: 'Ultimate', 
    name: 'Wealth Master', 
    price: 30, 
    description: 'Complete ecosystem for serious investors.',
    limits: { portfolios: -1, holdings: -1, connections: -1, watchlists: -1 },
    features: ['Unlimited Portfolios', 'Unlimited Broker Connections', 'Unlimited Watchlists', 'AI Insights', 'VIP Support'] 
  }
];

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, pass: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>;
  register: (name: string, email: string, pass: string) => Promise<boolean>;
  logout: () => void;
  updateUserPlan: (plan: PlanTier) => void;
  
  brokerProviders: BrokerProvider[];
  addBrokerProvider: (provider: BrokerProvider) => void;
  removeBrokerProvider: (id: string) => void;
  updateBrokerProvider: (id: string, updates: Partial<BrokerProvider>) => void;

  integrations: BrokerIntegration[];
  connectBroker: (providerId: string, name: string, type: 'Stock' | 'Crypto' | 'Mixed', logo: string, credentials: any) => Promise<boolean>;
  disconnectBroker: (id: string) => void;

  wallets: CryptoWallet[];
  addWallet: (wallet: Omit<CryptoWallet, 'id'>) => void;
  removeWallet: (id: string) => void;
  toggleWallet: (id: string) => void;
  updateWallet: (id: string, updates: Partial<CryptoWallet>) => void;
  plans: SubscriptionPlan[];
  updatePlanPrice: (id: PlanTier, price: number) => void;
  
  allUsers: User[];
  deleteUser: (id: string) => void;
  updateUserRole: (id: string, role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Admin/Settings State
  const [wallets, setWallets] = useState<CryptoWallet[]>(DEFAULT_WALLETS);
  const [plans, setPlans] = useState<SubscriptionPlan[]>(DEFAULT_PLANS);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [integrations, setIntegrations] = useState<BrokerIntegration[]>([]);
  const [brokerProviders, setBrokerProviders] = useState<BrokerProvider[]>(DEFAULT_BROKER_PROVIDERS);

  // --- Supabase Auth Listener ---
  useEffect(() => {
    const initializeAuth = async () => {
      if (!isSupabaseConfigured) {
        console.warn("Supabase not configured. Using Mock Auth state.");
        setLoading(false);
        return;
      }

      try {
        // Check active session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
            console.error("Session check error:", error);
            setLoading(false);
            return;
        }

        if (session?.user) {
          await fetchUserProfile(session.user.id, session.user.email || '');
        } else {
          setLoading(false);
        }

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (event === 'SIGNED_IN' && session?.user) {
            await fetchUserProfile(session.user.id, session.user.email || '');
          } else if (event === 'SIGNED_OUT') {
            setUser(null);
            setAllUsers([]);
            setIntegrations([]);
          }
        });

        return () => subscription.unsubscribe();
      } catch (err) {
        console.error("Auth init failed", err);
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const fetchUserProfile = async (userId: string, email: string) => {
    try {
      // Fetch profile from Supabase
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      // Default values
      let role: UserRole = 'USER';
      let plan: PlanTier = 'Free';
      let name = 'User';
      let avatar = undefined;
      let joinedDate = new Date().toISOString().split('T')[0];

      if (error) {
          if (error.code === 'PGRST116' || error.message.includes('0 rows')) {
              // Missing Row: Logic to auto-fix if triggers failed
              console.log("Profile missing for user, attempting to create default profile...");
              const { error: insertError } = await supabase.from('profiles').insert({
                  id: userId,
                  email: email,
                  full_name: 'User',
                  role: 'USER',
                  plan: 'Free'
              });
              
              if (!insertError) {
                  // Retry fetch after insertion
                  return fetchUserProfile(userId, email);
              } else {
                  if (insertError.code === '42P01') {
                      console.error("CRITICAL: Database tables missing. Please run supabase_schema.sql");
                  } else {
                      console.error("Failed to auto-create profile:", insertError);
                  }
              }
          } else if (error.code === '42P01') {
              // 42P01 is 'undefined_table' in Postgres
              console.error("CRITICAL: Database tables missing (profiles table not found).");
          } else {
              console.error('Error fetching profile data:', error);
          }
      } else if (data) {
          role = (data.role as UserRole) || 'USER';
          plan = (data.plan as PlanTier) || 'Free';
          name = data.full_name || 'User';
          avatar = data.avatar_url;
          if (data.created_at) {
              joinedDate = new Date(data.created_at).toISOString().split('T')[0];
          }
      }

      // --- CRITICAL: ROLE OVERRIDE FOR DEMO CREDENTIALS ---
      if (email.toLowerCase() === 'wailafmohammed@gmail.com' || email.toLowerCase() === 'wailafbdallad@gmail.com') {
          role = 'SUPER_ADMIN';
          plan = 'Ultimate';
          name = 'Wail (Super Admin)';
      } else if (email.toLowerCase() === 'admin@wealthos.com') {
          role = 'ADMIN';
          plan = 'Ultimate';
          name = 'Admin User';
      }
      // ----------------------------------------------------

      const appUser: User = {
        id: userId,
        email: email,
        name: name,
        role: role,
        plan: plan,
        joinedDate: joinedDate,
        avatar: avatar
      };
      
      setUser(appUser);
      
      // If Admin, fetch all users for dashboard
      if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
          fetchAllUsers();
      }
      
      // Fetch Integrations
      fetchIntegrations(userId);

    } catch (error) {
      console.error('Error in profile flow:', error);
      // Fallback to basic user state on error to prevent lock-out
      setUser({
        id: userId,
        email: email,
        name: 'User',
        role: 'USER',
        plan: 'Free',
        joinedDate: new Date().toISOString().split('T')[0]
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAllUsers = async () => {
      if (!isSupabaseConfigured) return;
      const { data, error } = await supabase.from('profiles').select('*');
      if (error && error.code === '42P01') return; // Tables missing
      
      if (data) {
          const users: User[] = data.map(p => ({
              id: p.id,
              email: p.email || '',
              name: p.full_name || 'Unknown',
              role: (p.role as UserRole) || 'USER',
              plan: (p.plan as PlanTier) || 'Free',
              joinedDate: new Date(p.created_at).toLocaleDateString(),
              avatar: p.avatar_url
          }));
          setAllUsers(users);
      }
  };

  const fetchIntegrations = async (userId: string) => {
      if (!isSupabaseConfigured) return;
      const { data, error } = await supabase.from('broker_integrations').select('*').eq('user_id', userId);
      if (error && error.code === '42P01') return; // Tables missing

      if (data) {
          const ints: BrokerIntegration[] = data.map(i => ({
              id: i.id,
              providerId: i.provider_id,
              name: i.name,
              type: i.type as any,
              status: i.status as any,
              lastSync: new Date(i.last_sync).toLocaleString(),
              logo: i.logo,
              apiCredentials: i.api_credentials
          }));
          setIntegrations(ints);
      }
  };

  const login = async (email: string, pass: string) => {
    // 1. Try Real Supabase Login First
    if (isSupabaseConfigured) {
        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
            if (!error) return true;
            console.warn("Supabase login failed:", error.message);
        } catch (error) {
            console.error('Supabase Login exception:', error);
        }
    }

    // 2. Fallback for Demo Accounts
    const demoAccounts: Record<string, User> = {
        'wailafmohammed@gmail.com': {
            id: 'super-admin-wail',
            email: 'wailafmohammed@gmail.com',
            name: 'Wail (Super Admin)',
            role: 'SUPER_ADMIN',
            plan: 'Ultimate',
            joinedDate: new Date().toISOString().split('T')[0],
            avatar: 'https://ui-avatars.com/api/?name=Wail+Mohammed&background=6366f1&color=fff'
        },
        'wailafbdallad@gmail.com': {
            id: 'super-admin-wail-alt',
            email: 'wailafbdallad@gmail.com',
            name: 'Wail (Super Admin)',
            role: 'SUPER_ADMIN',
            plan: 'Ultimate',
            joinedDate: new Date().toISOString().split('T')[0],
            avatar: 'https://ui-avatars.com/api/?name=Wail+Mohammed&background=6366f1&color=fff'
        },
        'admin@wealthos.com': {
            id: 'admin-demo',
            email: 'admin@wealthos.com',
            name: 'Admin User',
            role: 'ADMIN',
            plan: 'Ultimate',
            joinedDate: new Date().toISOString().split('T')[0],
            avatar: 'https://ui-avatars.com/api/?name=Admin+User&background=10b981&color=fff'
        },
        'user@example.com': {
            id: 'user-demo',
            email: 'user@example.com',
            name: 'Demo User',
            role: 'USER',
            plan: 'Pro',
            joinedDate: new Date().toISOString().split('T')[0],
            avatar: 'https://ui-avatars.com/api/?name=Demo+User&background=f59e0b&color=fff'
        }
    };

    if (demoAccounts[email]) {
        console.log("Using Demo Account Fallback for:", email);
        setUser(demoAccounts[email]);
        if (demoAccounts[email].role !== 'USER') {
            setAllUsers(Object.values(demoAccounts));
        }
        return true;
    }

    return false;
  };

  const loginWithGoogle = async () => {
    if (!isSupabaseConfigured) {
        setUser({
            id: 'mock-user-google',
            email: 'google@example.com',
            name: 'Google User',
            role: 'USER',
            plan: 'Free',
            joinedDate: new Date().toISOString().split('T')[0]
        });
        return true;
    }
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Google login failed:', error);
      return false;
    }
  };

  const register = async (name: string, email: string, pass: string) => {
    if (!isSupabaseConfigured) {
        setUser({
            id: 'mock-user-new',
            email: email,
            name: name,
            role: 'USER',
            plan: 'Free',
            joinedDate: new Date().toISOString().split('T')[0]
        });
        return true;
    }
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: pass,
        options: {
          data: { full_name: name } // Passed to handle_new_user trigger
        }
      });
      
      if (error) throw error;
      
      // If auto-confirm is on, log them in immediately if a session is returned
      if (data.session) {
          await fetchUserProfile(data.user!.id, email);
          return true;
      }
      
      return true; // Registration successful, check email
    } catch (error) {
      console.error('Registration failed:', error);
      return false;
    }
  };

  const logout = async () => {
    if (isSupabaseConfigured) {
        supabase.auth.signOut().catch(console.error);
    }
    setUser(null);
  };

  const updateUserPlan = async (plan: PlanTier) => {
    if (user) {
      if (isSupabaseConfigured && !user.id.startsWith('super-admin') && !user.id.startsWith('admin-demo') && !user.id.startsWith('user-demo')) {
          const { error } = await supabase.from('profiles').update({ plan }).eq('id', user.id);
          if (!error) {
            setUser({ ...user, plan });
          }
      } else {
          setUser({ ...user, plan });
      }
    }
  };

  // --- Admin & Functionality Wrappers ---
  const addBrokerProvider = (provider: BrokerProvider) => setBrokerProviders(prev => [...prev, provider]);
  const removeBrokerProvider = (id: string) => setBrokerProviders(prev => prev.filter(p => p.id !== id));
  const updateBrokerProvider = (id: string, updates: Partial<BrokerProvider>) => setBrokerProviders(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));

  const connectBroker = async (providerId: string, name: string, type: 'Stock' | 'Crypto' | 'Mixed', logo: string, credentials: any) => {
    // Optimistic update
    const newIntegration: BrokerIntegration = {
        id: Math.random().toString(36).substr(2, 9),
        providerId,
        name,
        type,
        status: 'Connected',
        lastSync: 'Just now',
        logo,
        apiCredentials: credentials
    };
    setIntegrations(prev => [...prev, newIntegration]);

    if (isSupabaseConfigured && user && !user.id.startsWith('mock') && !user.id.startsWith('super-admin') && !user.id.startsWith('admin-demo')) {
        const { error } = await supabase.from('broker_integrations').insert({
            user_id: user.id,
            provider_id: providerId,
            name,
            type,
            logo,
            api_credentials: credentials,
            status: 'Connected'
        });
        if (error) console.error("Failed to save integration", error);
    }
    return true;
  };

  const disconnectBroker = async (id: string) => {
      setIntegrations(prev => prev.filter(i => i.id !== id));
      if (isSupabaseConfigured && user && !user.id.startsWith('mock') && !user.id.startsWith('super-admin')) {
          await supabase.from('broker_integrations').delete().eq('id', id);
      }
  };

  const addWallet = (wallet: Omit<CryptoWallet, 'id'>) => setWallets(prev => [...prev, { ...wallet, id: Math.random().toString() }]);
  const removeWallet = (id: string) => setWallets(prev => prev.filter(w => w.id !== id));
  const toggleWallet = (id: string) => setWallets(prev => prev.map(w => w.id === id ? { ...w, isEnabled: !w.isEnabled } : w));
  const updateWallet = (id: string, updates: Partial<CryptoWallet>) => setWallets(prev => prev.map(w => w.id === id ? { ...w, ...updates } : w));
  
  const updatePlanPrice = (id: PlanTier, price: number) => setPlans(prev => prev.map(p => p.id === id ? { ...p, price } : p));
  
  const deleteUser = async (id: string) => {
      setAllUsers(prev => prev.filter(u => u.id !== id));
      if (isSupabaseConfigured) {
          // Attempt to delete from profiles (RLS must allow this for Super Admin)
          await supabase.from('profiles').delete().eq('id', id);
      }
  };
  
  const updateUserRole = async (id: string, role: UserRole) => {
      setAllUsers(prev => prev.map(u => u.id === id ? { ...u, role } : u));
      if (isSupabaseConfigured) {
          await supabase.from('profiles').update({ role }).eq('id', id);
      }
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      loading,
      login,
      loginWithGoogle,
      register,
      logout,
      updateUserPlan,
      brokerProviders,
      addBrokerProvider,
      removeBrokerProvider,
      updateBrokerProvider,
      integrations,
      connectBroker,
      disconnectBroker,
      wallets,
      addWallet,
      removeWallet,
      toggleWallet,
      updateWallet,
      plans,
      updatePlanPrice,
      allUsers,
      deleteUser,
      updateUserRole
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
