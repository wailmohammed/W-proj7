
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { Portfolio, Holding, PortfolioSummary, Transaction, Notification, ViewState, Watchlist, ManualAsset, Liability, AssetType } from '../types';
import { MOCK_MARKET_ASSETS, MOCK_PORTFOLIO, MOCK_PORTFOLIOS_LIST } from '../constants';
import { useAuth } from './AuthContext';

interface PortfolioContextType {
  portfolios: PortfolioSummary[];
  activePortfolio: Portfolio;
  activePortfolioId: string;
  switchPortfolio: (id: string) => void;
  addNewPortfolio: (name: string, type: 'Stock' | 'Crypto' | 'Mixed') => void;
  
  addTransaction: (assetId: string, type: 'BUY' | 'SELL', shares: number, price: number, date: string) => void;
  addManualAsset: (asset: Omit<ManualAsset, 'id'>) => void;
  addLiability: (liability: Omit<Liability, 'id'>) => void;
  
  watchlists: Watchlist[];
  activeWatchlistId: string;
  toggleWatchlist: (symbol: string) => void;
  createWatchlist: (name: string) => void;
  switchWatchlist: (id: string) => void;

  activeView: ViewState;
  switchView: (view: ViewState) => void;
  selectedResearchSymbol: string;
  viewStock: (symbol: string) => void;
  
  notifications: Notification[];
  markAsRead: (id: string) => void;
  clearNotifications: () => void;
  
  isAddAssetModalOpen: boolean;
  preSelectedAssetTicker: string | null;
  openAddAssetModal: (ticker?: string) => void;
  closeAddAssetModal: () => void;

  // Market Simulation
  isMarketOpen: boolean;
  toggleMarketOpen: () => void;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

// Default empty state to avoid null checks everywhere
const EMPTY_PORTFOLIO: Portfolio = {
  id: 'loading',
  name: 'Loading...',
  totalValue: 0,
  cashBalance: 0,
  holdings: [],
  transactions: [],
  manualAssets: [],
  liabilities: []
};

export const PortfolioProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  
  // Navigation State
  const [activeView, setActiveView] = useState<ViewState>('dashboard');
  const [selectedResearchSymbol, setSelectedResearchSymbol] = useState<string>('AAPL');

  // Data State
  const [portfolios, setPortfolios] = useState<PortfolioSummary[]>([]);
  const [activePortfolioId, setActivePortfolioId] = useState<string>('');
  const [activePortfolio, setActivePortfolio] = useState<Portfolio>(EMPTY_PORTFOLIO);
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [activeWatchlistId, setActiveWatchlistId] = useState<string>('');
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Modal State
  const [isAddAssetModalOpen, setIsAddAssetModalOpen] = useState(false);
  const [preSelectedAssetTicker, setPreSelectedAssetTicker] = useState<string | null>(null);

  // Market Simulation State
  const [isMarketOpen, setIsMarketOpen] = useState(true);

  // --- 1. Fetch Portfolios List ---
  const fetchPortfoliosList = useCallback(async () => {
    if (!user) return;

    if (!isSupabaseConfigured) {
        setPortfolios(MOCK_PORTFOLIOS_LIST);
        if (!activePortfolioId) setActivePortfolioId(MOCK_PORTFOLIOS_LIST[0].id);
        return;
    }

    try {
        const { data, error } = await supabase
          .from('portfolios')
          .select('id, name, type')
          .eq('user_id', user.id);

        if (error) {
          console.error('Error fetching portfolios:', error.message || JSON.stringify(error));
          // If table missing (42P01), don't crash, just show empty state
          if (error.code === '42P01') {
              console.warn("Database tables missing. Please run supabase_schema.sql");
          }
          return;
        }

        if (data && data.length > 0) {
          const summaries: PortfolioSummary[] = data.map(p => ({ id: p.id, name: p.name, type: p.type as any }));
          setPortfolios(summaries);
          // Only set default if none selected
          if (!activePortfolioId) {
              setActivePortfolioId(data[0].id); 
          }
        } else if (data && data.length === 0) {
          // Create a default portfolio if none exists
          addNewPortfolio('My First Portfolio', 'Mixed');
        }
    } catch (err) {
        console.error("Unexpected error in fetchPortfoliosList", err);
    }
  }, [user, activePortfolioId]);

  useEffect(() => {
    fetchPortfoliosList();
    fetchWatchlists();
  }, [user, fetchPortfoliosList]);

  // --- 2. Fetch Active Portfolio Data ---
  const fetchPortfolioData = useCallback(async () => {
      if (!activePortfolioId || !user) return;

      if (!isSupabaseConfigured) {
          if (activePortfolioId === MOCK_PORTFOLIO.id || activePortfolioId === 'p1') {
              setActivePortfolio(prev => ({ ...MOCK_PORTFOLIO, holdings: prev.holdings.length > 0 ? prev.holdings : MOCK_PORTFOLIO.holdings }));
          } else {
              setActivePortfolio({ ...EMPTY_PORTFOLIO, id: activePortfolioId, name: 'Mock Portfolio' });
          }
          return;
      }

      try {
          // Parallel fetching for performance
          const [
              { data: portData, error: portError },
              { data: holdingsData },
              { data: txData },
              { data: assetsData },
              { data: liabData }
          ] = await Promise.all([
              supabase.from('portfolios').select('*').eq('id', activePortfolioId).single(),
              supabase.from('holdings').select('*').eq('portfolio_id', activePortfolioId),
              supabase.from('transactions').select('*').eq('portfolio_id', activePortfolioId).order('date', { ascending: false }),
              supabase.from('manual_assets').select('*').eq('portfolio_id', activePortfolioId),
              supabase.from('liabilities').select('*').eq('portfolio_id', activePortfolioId)
          ]);

          if (portError) {
              console.error("Error fetching active portfolio details:", portError.message);
              return;
          }

          if (portData) {
            const mappedHoldings: Holding[] = (holdingsData || []).map(h => ({
                id: h.id,
                symbol: h.symbol,
                name: h.name,
                shares: parseFloat(h.shares),
                avgPrice: parseFloat(h.avg_price),
                currentPrice: MOCK_MARKET_ASSETS.find(m => m.symbol === h.symbol)?.currentPrice || parseFloat(h.avg_price),
                assetType: h.asset_type as AssetType,
                sector: h.sector || 'Diversified',
                country: h.country || 'Global',
                dividendYield: parseFloat(h.dividend_yield) || 0,
                safetyScore: h.safety_score || 50,
                snowflake: h.snowflake_data || { value: 3, future: 3, past: 3, health: 3, dividend: 3, total: 15 },
                targetAllocation: parseFloat(h.target_allocation) || 0,
                logoUrl: `https://logo.clearbit.com/${h.name ? h.name.split(' ')[0] : 'google'}.com`
            }));

            const mappedTx: Transaction[] = (txData || []).map(t => ({
                id: t.id,
                date: t.date,
                type: t.type,
                symbol: t.symbol,
                shares: parseFloat(t.shares),
                price: parseFloat(t.price),
                totalValue: parseFloat(t.total_value) || (parseFloat(t.shares) * parseFloat(t.price))
            }));

            const mappedAssets: ManualAsset[] = (assetsData || []).map(a => ({
                id: a.id,
                name: a.name,
                type: a.type,
                value: parseFloat(a.value),
                currency: a.currency,
                purchaseDate: a.purchase_date,
                purchasePrice: parseFloat(a.purchase_price)
            }));

            const mappedLiabilities: Liability[] = (liabData || []).map(l => ({
                id: l.id,
                name: l.name,
                type: l.type,
                amount: parseFloat(l.amount),
                interestRate: parseFloat(l.interest_rate),
                monthlyPayment: parseFloat(l.monthly_payment)
            }));

            const calculatedTotalValue = mappedHoldings.reduce((sum, h) => sum + (h.shares * h.currentPrice), 0);

            setActivePortfolio({
                id: portData.id,
                name: portData.name,
                totalValue: calculatedTotalValue,
                cashBalance: parseFloat(portData.cash_balance) || 0,
                holdings: mappedHoldings,
                transactions: mappedTx,
                manualAssets: mappedAssets,
                liabilities: mappedLiabilities
            });
          }
      } catch (e) {
          console.error("Exception fetching portfolio data:", e);
      }
  }, [activePortfolioId, user]);

  useEffect(() => {
    fetchPortfolioData();
  }, [fetchPortfolioData]);

  // --- 3. Real-time Subscription ---
  useEffect(() => {
    if (!activePortfolioId || !user || !isSupabaseConfigured) return;
    const channel = supabase.channel(`portfolio-${activePortfolioId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'holdings', filter: `portfolio_id=eq.${activePortfolioId}` }, () => fetchPortfolioData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `portfolio_id=eq.${activePortfolioId}` }, () => fetchPortfolioData())
      .subscribe();
    return () => { supabase.removeChannel(channel); }
  }, [activePortfolioId, user, fetchPortfolioData]);

  // --- 4. Market Simulation Engine ---
  useEffect(() => {
    if (!isMarketOpen || !activePortfolio.holdings.length) return;

    const interval = setInterval(() => {
        setActivePortfolio(prev => {
            if (!prev || !prev.holdings) return prev;

            const updatedHoldings = prev.holdings.map(h => {
                // Simulate price movement: -0.5% to +0.5% volatility
                const volatility = h.assetType === 'Crypto' ? 0.015 : 0.005; // Higher volatility for crypto
                const changePercent = (Math.random() * (volatility * 2)) - volatility;
                const newPrice = Math.max(0.01, h.currentPrice * (1 + changePercent)); // Ensure price doesn't go negative
                
                return {
                    ...h,
                    currentPrice: Number(newPrice.toFixed(2))
                };
            });

            const newTotal = updatedHoldings.reduce((acc, h) => acc + (h.shares * h.currentPrice), 0);

            return {
                ...prev,
                holdings: updatedHoldings,
                totalValue: newTotal
            };
        });
    }, 3000); // Update every 3 seconds

    return () => clearInterval(interval);
  }, [isMarketOpen, activePortfolio.holdings.length]);

  const fetchWatchlists = async () => {
      if (!user) return;
      if (!isSupabaseConfigured) {
          setWatchlists([{ id: 'w1', name: 'My First Watchlist', symbols: ['AAPL', 'TSLA', 'BTC'] }]);
          setActiveWatchlistId('w1');
          return;
      }
      const { data, error } = await supabase.from('watchlists').select('*').eq('user_id', user.id);
      if (!error && data && data.length > 0) {
          setWatchlists(data.map(w => ({ id: w.id, name: w.name, symbols: w.symbols || [] })));
          setActiveWatchlistId(data[0].id);
      } else if (!error) {
          createWatchlist('My First Watchlist');
      }
  };

  const addNewPortfolio = async (name: string, type: 'Stock' | 'Crypto' | 'Mixed') => {
      if (!user) return;
      if (!isSupabaseConfigured) {
          const newId = `mock-p-${Date.now()}`;
          setPortfolios(prev => [...prev, { id: newId, name, type }]);
          setActivePortfolioId(newId);
          return;
      }
      const { data, error } = await supabase.from('portfolios').insert({ user_id: user.id, name, type, cash_balance: 0 }).select().single();
      if (error) {
          console.error("Error creating portfolio:", error.message);
          return;
      }
      if (data) {
          setPortfolios(prev => [...prev, { id: data.id, name: data.name, type: data.type }]);
          setActivePortfolioId(data.id);
      }
  };

  const addTransaction = async (assetId: string, type: 'BUY' | 'SELL', shares: number, price: number, date: string) => {
      if (!activePortfolioId || !user) return;
      const marketAsset = MOCK_MARKET_ASSETS.find(a => a.id === assetId);
      if (!marketAsset) return;

      if (!isSupabaseConfigured) {
          const newTx: Transaction = { id: `tx-${Date.now()}`, date, type, symbol: marketAsset.symbol, shares, price, totalValue: shares * price };
          const newHolding: Holding = { ...marketAsset, shares, avgPrice: price, currentPrice: price };
          
          setActivePortfolio(prev => {
              // Check if holding exists
              const existingIdx = prev.holdings.findIndex(h => h.symbol === marketAsset.symbol);
              let newHoldings = [...prev.holdings];
              
              if (existingIdx >= 0) {
                  const h = newHoldings[existingIdx];
                  const newShares = type === 'BUY' ? h.shares + shares : h.shares - shares;
                  // Simple weighted avg for mock
                  const newAvg = type === 'BUY' ? ((h.shares * h.avgPrice) + (shares * price)) / newShares : h.avgPrice; 
                  newHoldings[existingIdx] = { ...h, shares: newShares, avgPrice: newAvg };
              } else if (type === 'BUY') {
                  newHoldings.push(newHolding);
              }
              
              return {
                  ...prev,
                  holdings: newHoldings,
                  transactions: [newTx, ...prev.transactions],
                  totalValue: prev.totalValue + (type === 'BUY' ? shares * price : -(shares * price))
              };
          });

          const newNotif: Notification = { id: Date.now().toString(), type: 'success', title: 'Transaction Saved', message: `Saved ${type} ${shares} ${marketAsset.symbol}`, timestamp: 'Just now', read: false };
          setNotifications(prev => [newNotif, ...prev]);
          return;
      }
      
      // Supabase Logic
      try {
          // 1. Insert Transaction
          const { error: txError } = await supabase.from('transactions').insert({
              portfolio_id: activePortfolioId,
              date,
              type,
              symbol: marketAsset.symbol,
              shares,
              price,
              total_value: shares * price
          });
          if (txError) throw txError;

          // 2. Check if holding exists
          const { data: existingHolding } = await supabase.from('holdings').select('*').eq('portfolio_id', activePortfolioId).eq('symbol', marketAsset.symbol).single();

          if (existingHolding) {
              let newShares = parseFloat(existingHolding.shares);
              let currentAvg = parseFloat(existingHolding.avg_price);
              
              if (type === 'BUY') {
                  const totalCost = (newShares * currentAvg) + (shares * price);
                  newShares += shares;
                  currentAvg = totalCost / newShares;
              } else {
                  newShares -= shares;
              }

              if (newShares <= 0) {
                  await supabase.from('holdings').delete().eq('id', existingHolding.id);
              } else {
                  await supabase.from('holdings').update({ shares: newShares, avg_price: currentAvg }).eq('id', existingHolding.id);
              }
          } else if (type === 'BUY') {
              await supabase.from('holdings').insert({
                  portfolio_id: activePortfolioId,
                  symbol: marketAsset.symbol,
                  name: marketAsset.name,
                  shares,
                  avg_price: price,
                  asset_type: marketAsset.assetType,
                  sector: marketAsset.sector,
                  country: marketAsset.country,
                  dividend_yield: marketAsset.dividendYield,
                  safety_score: marketAsset.safetyScore,
                  snowflake_data: marketAsset.snowflake,
                  target_allocation: 0
              });
          }
          
          fetchPortfolioData();
          
          const newNotif: Notification = { id: Date.now().toString(), type: 'success', title: 'Transaction Saved', message: `Saved ${type} ${shares} ${marketAsset.symbol}`, timestamp: 'Just now', read: false };
          setNotifications(prev => [newNotif, ...prev]);

      } catch (error: any) {
          console.error("Error adding transaction:", error);
          const newNotif: Notification = { id: Date.now().toString(), type: 'error', title: 'Error', message: error.message || 'Failed to save transaction', timestamp: 'Just now', read: false };
          setNotifications(prev => [newNotif, ...prev]);
      }
  };

  const addManualAsset = async (asset: Omit<ManualAsset, 'id'>) => {
      if (!activePortfolioId || !isSupabaseConfigured) return;
      await supabase.from('manual_assets').insert({
          portfolio_id: activePortfolioId,
          name: asset.name,
          type: asset.type,
          value: asset.value,
          currency: asset.currency,
          purchase_date: asset.purchaseDate,
          purchase_price: asset.purchasePrice
      });
      fetchPortfolioData();
  };

  const addLiability = async (liability: Omit<Liability, 'id'>) => {
      if (!activePortfolioId || !isSupabaseConfigured) return;
      await supabase.from('liabilities').insert({
          portfolio_id: activePortfolioId,
          name: liability.name,
          type: liability.type,
          amount: liability.amount,
          interest_rate: liability.interestRate,
          monthly_payment: liability.monthlyPayment
      });
      fetchPortfolioData();
  };

  const createWatchlist = async (name: string) => {
      if (!user || !isSupabaseConfigured) return;
      const { data } = await supabase.from('watchlists').insert({ user_id: user.id, name, symbols: [] }).select().single();
      if (data) {
          setWatchlists(prev => [...prev, { id: data.id, name: data.name, symbols: [] }]);
          setActiveWatchlistId(data.id);
      }
  };

  const toggleWatchlist = async (symbol: string) => {
      if (!activeWatchlistId || !isSupabaseConfigured) return;
      const watchlist = watchlists.find(w => w.id === activeWatchlistId);
      if (!watchlist) return;

      const newSymbols = watchlist.symbols.includes(symbol) 
        ? watchlist.symbols.filter(s => s !== symbol)
        : [...watchlist.symbols, symbol];

      const { error } = await supabase.from('watchlists').update({ symbols: newSymbols }).eq('id', activeWatchlistId);
      if (!error) {
          setWatchlists(prev => prev.map(w => w.id === activeWatchlistId ? { ...w, symbols: newSymbols } : w));
      }
  };

  // Helpers
  const switchPortfolio = (id: string) => setActivePortfolioId(id);
  const switchView = (view: ViewState) => setActiveView(view);
  const viewStock = (symbol: string) => { setSelectedResearchSymbol(symbol); setActiveView('research'); };
  const markAsRead = (id: string) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  const clearNotifications = () => setNotifications([]);
  const openAddAssetModal = (ticker?: string) => { setPreSelectedAssetTicker(ticker || null); setIsAddAssetModalOpen(true); };
  const closeAddAssetModal = () => { setIsAddAssetModalOpen(false); setPreSelectedAssetTicker(null); };
  const switchWatchlist = (id: string) => setActiveWatchlistId(id);
  
  const toggleMarketOpen = () => setIsMarketOpen(prev => !prev);

  return (
    <PortfolioContext.Provider value={{
      portfolios,
      activePortfolio,
      activePortfolioId,
      switchPortfolio,
      addNewPortfolio,
      addTransaction,
      addManualAsset,
      addLiability,
      activeView,
      switchView,
      selectedResearchSymbol,
      viewStock,
      notifications,
      markAsRead,
      clearNotifications,
      isAddAssetModalOpen,
      preSelectedAssetTicker,
      openAddAssetModal,
      closeAddAssetModal,
      watchlists,
      activeWatchlistId,
      toggleWatchlist,
      createWatchlist,
      switchWatchlist,
      isMarketOpen,
      toggleMarketOpen
    }}>
      {children}
    </PortfolioContext.Provider>
  );
};

export const usePortfolio = () => {
  const context = useContext(PortfolioContext);
  if (context === undefined) {
    throw new Error('usePortfolio must be used within a PortfolioProvider');
  }
  return context;
};
