
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { Portfolio, Holding, PortfolioSummary, Transaction, Notification, ViewState, Watchlist, ManualAsset, Liability, AssetType, AlertConfig } from '../types';
import { MOCK_MARKET_ASSETS, MOCK_PORTFOLIO, MOCK_PORTFOLIOS_LIST } from '../constants';
import { useAuth } from './AuthContext';
import { fetchCryptoPrice, fetchStockPrice, fetchTrading212Positions } from '../services/marketData';

interface PortfolioContextType {
  portfolios: PortfolioSummary[];
  activePortfolio: Portfolio;
  activePortfolioId: string;
  defaultPortfolioId: string;
  switchPortfolio: (id: string) => void;
  setDefaultPortfolio: (id: string) => void;
  addNewPortfolio: (name: string, type: 'Stock' | 'Crypto' | 'Mixed') => Promise<string | null>;
  importPortfolio: (name: string, transactions: any[], targetPortfolioId?: string) => Promise<void>;
  
  addTransaction: (assetId: string, type: 'BUY' | 'SELL', shares: number, price: number, date: string, targetPortfolioId?: string) => Promise<void>;
  updateHolding: (holdingId: string, updates: Partial<Holding>) => Promise<void>;
  deleteHolding: (holdingId: string) => Promise<void>;
  
  addManualAsset: (asset: Omit<ManualAsset, 'id'>, targetPortfolioId?: string) => void;
  addLiability: (liability: Omit<Liability, 'id'>, targetPortfolioId?: string) => void;
  
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

  alerts: AlertConfig[];
  addAlert: (symbol: string, targetPrice: number, condition: 'ABOVE' | 'BELOW') => void;
  removeAlert: (id: string) => void;

  isMarketOpen: boolean;
  toggleMarketOpen: () => void;
  
  marketDataApiKey: string;
  setMarketDataApiKey: (key: string) => void;
  
  syncBroker: (brokerId: string) => Promise<boolean>;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

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

// Helper to prevent NaN propagation and handle string inputs robustly
const safeFloat = (val: any): number => {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return (Number.isFinite(val) && !Number.isNaN(val)) ? val : 0;
    if (typeof val === 'string') {
        // Remove currency symbols, commas, spaces, etc. but keep decimal point and negative sign
        const cleaned = val.replace(/[^0-9.-]/g, '');
        // Ensure we don't have multiple decimals
        const parsed = parseFloat(cleaned);
        return (Number.isFinite(parsed) && !Number.isNaN(parsed)) ? parsed : 0;
    }
    return 0;
};

export const PortfolioProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, integrations } = useAuth();
  
  const [activeView, setActiveView] = useState<ViewState>('dashboard');
  const [selectedResearchSymbol, setSelectedResearchSymbol] = useState<string>('AAPL');

  const [portfolios, setPortfolios] = useState<PortfolioSummary[]>([]);
  const [activePortfolioId, setActivePortfolioId] = useState<string>('');
  const [defaultPortfolioId, setDefaultPortfolioId] = useState<string>('');
  const [activePortfolio, setActivePortfolio] = useState<Portfolio>(EMPTY_PORTFOLIO);
  
  // Initial Watchlist State with Default
  const [watchlists, setWatchlists] = useState<Watchlist[]>([
      { id: 'default', name: 'Main Watchlist', symbols: ['AAPL', 'MSFT', 'NVDA', 'BTC'] }
  ]);
  const [activeWatchlistId, setActiveWatchlistId] = useState<string>('default');
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [alerts, setAlerts] = useState<AlertConfig[]>([]);

  const [isAddAssetModalOpen, setIsAddAssetModalOpen] = useState(false);
  const [preSelectedAssetTicker, setPreSelectedAssetTicker] = useState<string | null>(null);

  const [isMarketOpen, setIsMarketOpen] = useState(true);
  const [marketDataApiKey, setMarketDataApiKey] = useState(() => localStorage.getItem('wealthos_market_key') || '');
  
  // Internal state to prevent DB overwrites during sync
  const [isSyncing, setIsSyncing] = useState(false);

  const updateMarketDataKey = (key: string) => {
      setMarketDataApiKey(key);
      localStorage.setItem('wealthos_market_key', key);
  };

  // Load default portfolio preference
  useEffect(() => {
      const savedDefault = localStorage.getItem('wealthos_default_portfolio');
      if (savedDefault) setDefaultPortfolioId(savedDefault);
  }, []);

  const setDefaultPortfolio = (id: string) => {
      setDefaultPortfolioId(id);
      localStorage.setItem('wealthos_default_portfolio', id);
  };

  // Fetch Portfolios with Local Cache Fallback
  const fetchPortfoliosList = useCallback(async () => {
    if (!user) return;

    const cacheKey = `wealthos_portfolios_list_${user.id}`;

    // Helper to load from cache
    const loadFromCache = () => {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (parsed.length > 0) {
                    setPortfolios(parsed);
                    // If no active portfolio, set based on default or first
                    if (!activePortfolioId) {
                        const savedDefault = localStorage.getItem('wealthos_default_portfolio');
                        if (savedDefault && parsed.find((p: any) => p.id === savedDefault)) {
                            setActivePortfolioId(savedDefault);
                        } else {
                            setActivePortfolioId(parsed[0].id);
                        }
                    }
                    return true;
                }
            } catch(e) {
                console.warn("Failed to parse cached portfolios");
            }
        }
        return false;
    };

    if (!isSupabaseConfigured) {
        if (!loadFromCache()) {
            setPortfolios(MOCK_PORTFOLIOS_LIST);
            if (!activePortfolioId) setActivePortfolioId(MOCK_PORTFOLIOS_LIST[0].id);
        }
        return;
    }

    try {
        const { data, error } = await supabase
          .from('portfolios')
          .select('id, name, type')
          .eq('user_id', user.id);

        if (error) {
          console.warn('DB Fetch Error (Portfolios):', error.message);
          if (!loadFromCache()) {
              if (portfolios.length === 0) {
                  setPortfolios(MOCK_PORTFOLIOS_LIST);
                  if (!activePortfolioId) setActivePortfolioId(MOCK_PORTFOLIOS_LIST[0].id);
              }
          }
          return;
        }

        if (data && data.length > 0) {
          const summaries: PortfolioSummary[] = data.map(p => ({ id: p.id, name: p.name, type: p.type as any }));
          setPortfolios(summaries);
          localStorage.setItem(cacheKey, JSON.stringify(summaries)); // Update cache
          
          if (!activePortfolioId) {
              const savedDefault = localStorage.getItem('wealthos_default_portfolio');
              if (savedDefault && summaries.find(p => p.id === savedDefault)) {
                  setActivePortfolioId(savedDefault);
              } else {
                  setActivePortfolioId(summaries[0].id); 
              }
          }
        } else {
          // No portfolios found in DB, but maybe we are just initializing
          if (portfolios.length === 0 && !loadFromCache()) {
              // If nothing in DB and nothing in cache, create default via addNewPortfolio logic or show empty
              // setPortfolios(MOCK_PORTFOLIOS_LIST); // Don't force mock if connected to real DB
          }
        }
    } catch (err) {
        console.error("Unexpected exception in fetchPortfoliosList:", err);
        if (!loadFromCache()) {
            setPortfolios(MOCK_PORTFOLIOS_LIST);
            if (!activePortfolioId) setActivePortfolioId(MOCK_PORTFOLIOS_LIST[0].id);
        }
    }
  }, [user, activePortfolioId]);

  // Fetch Alerts
  const fetchAlerts = useCallback(async () => {
      if (!user || !isSupabaseConfigured) return;
      try {
          const { data, error } = await supabase.from('alerts').select('*').eq('user_id', user.id);
          if (!error && data) {
              setAlerts(data.map(a => ({
                  id: a.id,
                  symbol: a.symbol,
                  targetPrice: safeFloat(a.target_price),
                  condition: a.condition,
                  isActive: a.is_active,
                  createdAt: a.created_at
              })));
          }
      } catch (e) { console.error("Error fetching alerts:", e); }
  }, [user]);

  useEffect(() => {
    fetchPortfoliosList();
    fetchAlerts();
  }, [user, fetchPortfoliosList, fetchAlerts]);

  const fetchPortfolioData = useCallback(async () => {
      if (!activePortfolioId || !user) return;
      if (isSyncing) return; // Don't fetch if we are in the middle of a massive write op

      const cacheKey = `wealthos_portfolio_data_${activePortfolioId}`;

      // Handle Mock/Local/Fallback
      if (!isSupabaseConfigured || activePortfolioId.startsWith('mock-') || activePortfolioId.startsWith('import-') || activePortfolioId.startsWith('local-') || activePortfolioId === 'p1') {
          if (activePortfolioId === MOCK_PORTFOLIO.id || activePortfolioId === 'p1') {
              if (activePortfolio.id !== 'p1') setActivePortfolio({ ...MOCK_PORTFOLIO });
          } else {
              // Try to load custom mock from cache if available
              const cached = localStorage.getItem(cacheKey);
              if (cached) {
                  setActivePortfolio(JSON.parse(cached));
              } else if (activePortfolio.id !== activePortfolioId) {
                  // If it's a newly created local portfolio not in cache yet
                  const summary = portfolios.find(p => p.id === activePortfolioId);
                  setActivePortfolio({ 
                      ...EMPTY_PORTFOLIO, 
                      id: activePortfolioId, 
                      name: summary?.name || 'Portfolio',
                  });
              }
          }
          return;
      }

      try {
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
              console.warn("DB Fetch Error (Portfolio Detail):", portError.message);
              // Try Cache
              const cached = localStorage.getItem(cacheKey);
              if (cached) {
                  console.log("Using cached portfolio data due to DB error");
                  setActivePortfolio(JSON.parse(cached));
                  return;
              }
              return;
          }

          if (portData) {
            const mappedHoldings: Holding[] = (holdingsData || []).map(h => {
                const shares = safeFloat(h.shares);
                const avgPrice = safeFloat(h.avg_price);
                const mockPrice = MOCK_MARKET_ASSETS.find(m => m.symbol === h.symbol)?.currentPrice || 100;
                
                // Prioritize live fetching simulation later, but ensure valid float here
                const currentPrice = mockPrice > 0 ? mockPrice : (avgPrice > 0 ? avgPrice : 100);
                
                return {
                    id: h.id,
                    symbol: h.symbol,
                    name: h.name || h.symbol,
                    shares: shares,
                    avgPrice: avgPrice,
                    currentPrice: safeFloat(currentPrice),
                    assetType: (h.asset_type as AssetType) || AssetType.STOCK,
                    sector: h.sector || 'Diversified',
                    country: h.country || 'Global',
                    dividendYield: safeFloat(h.dividend_yield),
                    safetyScore: safeFloat(h.safety_score) || 50,
                    snowflake: h.snowflake_data || { value: 3, future: 3, past: 3, health: 3, dividend: 3, total: 15 },
                    targetAllocation: safeFloat(h.target_allocation),
                    expenseRatio: safeFloat(h.expense_ratio),
                    logoUrl: `https://logo.clearbit.com/${h.name ? h.name.split(' ')[0] : 'google'}.com`
                };
            });

            const mappedTx: Transaction[] = (txData || []).map(t => {
                const shares = safeFloat(t.shares);
                const price = safeFloat(t.price);
                return {
                    id: t.id,
                    date: t.date,
                    type: t.type,
                    symbol: t.symbol,
                    shares: shares,
                    price: price,
                    totalValue: safeFloat(t.total_value) || (shares * price)
                };
            });

            const mappedAssets: ManualAsset[] = (assetsData || []).map(a => ({
                id: a.id,
                name: a.name,
                type: a.type,
                value: safeFloat(a.value),
                currency: a.currency,
                purchaseDate: a.purchase_date,
                purchasePrice: safeFloat(a.purchase_price)
            }));

            const mappedLiabilities: Liability[] = (liabData || []).map(l => ({
                id: l.id,
                name: l.name,
                type: l.type,
                amount: safeFloat(l.amount),
                interestRate: safeFloat(l.interest_rate),
                monthlyPayment: safeFloat(l.monthly_payment)
            }));

            const calculatedTotalValue = mappedHoldings.reduce((sum, h) => {
                const val = h.shares * h.currentPrice;
                // Ensure we only add valid finite numbers
                const safeVal = (Number.isFinite(val) && !Number.isNaN(val)) ? val : 0;
                return sum + safeVal;
            }, 0);

            // Double check total value is not NaN/Infinity
            const safeTotalValue = (Number.isFinite(calculatedTotalValue) && !Number.isNaN(calculatedTotalValue)) ? calculatedTotalValue : 0;

            const fullPortfolio: Portfolio = {
                id: portData.id,
                name: portData.name,
                totalValue: safeTotalValue, 
                cashBalance: safeFloat(portData.cash_balance),
                holdings: mappedHoldings,
                transactions: mappedTx,
                manualAssets: mappedAssets,
                liabilities: mappedLiabilities
            };

            setActivePortfolio(fullPortfolio);
            localStorage.setItem(cacheKey, JSON.stringify(fullPortfolio)); // Cache successful fetch
          }
      } catch (e) {
          console.error("Exception fetching portfolio data:", e);
          // Don't break the UI if fetch fails
      }
  }, [activePortfolioId, user, portfolios, isSyncing]);

  useEffect(() => {
    fetchPortfolioData();
  }, [fetchPortfolioData]);

  useEffect(() => {
    if (!activePortfolioId || !user || !isSupabaseConfigured) return;
    if (activePortfolioId.startsWith('p') && activePortfolioId.length < 5) return;
    if (activePortfolioId.startsWith('mock-') || activePortfolioId.startsWith('import-') || activePortfolioId.startsWith('local-')) return;

    const channel = supabase.channel(`portfolio-${activePortfolioId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'holdings', filter: `portfolio_id=eq.${activePortfolioId}` }, () => !isSyncing && fetchPortfolioData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `portfolio_id=eq.${activePortfolioId}` }, () => !isSyncing && fetchPortfolioData())
      .subscribe();
    return () => { supabase.removeChannel(channel); }
  }, [activePortfolioId, user, fetchPortfolioData, isSyncing]);

  // --- Market Simulation & Real Data Fetching ---
  useEffect(() => {
    if (!isMarketOpen || !activePortfolio.holdings.length) return;

    const interval = setInterval(async () => {
        const currentHoldings = [...activePortfolio.holdings];
        
        const updates = await Promise.all(currentHoldings.map(async (h) => {
            let newPrice = h.currentPrice > 0 ? h.currentPrice : (h.avgPrice > 0 ? h.avgPrice : 100);
            let updated = false;

            // 1. Crypto check (Free, CoinGecko)
            if (h.assetType === 'Crypto') {
                const realPrice = await fetchCryptoPrice(h.symbol);
                if (realPrice) {
                    newPrice = realPrice;
                    updated = true;
                }
            } 
            // 2. Stock/ETF check
            else if (h.assetType === 'Stock' || h.assetType === 'ETF') {
                // Finnhub (Fallback)
                if (!updated && marketDataApiKey) {
                    const realPrice = await fetchStockPrice(h.symbol, marketDataApiKey);
                    if (realPrice) {
                        newPrice = realPrice;
                        updated = true;
                    }
                }
            }

            // 3. Simulation Fallback (Guaranteed Data Visibility)
            if (!updated) {
                const volatility = h.assetType === 'Crypto' ? 0.015 : 0.005;
                const changePercent = (Math.random() * (volatility * 2)) - volatility;
                newPrice = Math.max(0.01, newPrice * (1 + changePercent));
            }

            return { ...h, currentPrice: safeFloat(newPrice.toFixed(2)) }; // Sanitise price
        }));

        const newTotal = updates.reduce((acc, h) => {
            const val = h.shares * h.currentPrice;
            return acc + (Number.isFinite(val) ? val : 0);
        }, 0);
        
        const safeNewTotal = Number.isFinite(newTotal) ? newTotal : 0;

        // Update State but NO DB Write on ticks to prevent spam
        setActivePortfolio(prev => ({
            ...prev,
            holdings: updates,
            totalValue: safeNewTotal
        }));

    }, 5000);

    return () => clearInterval(interval);
  }, [isMarketOpen, activePortfolio.holdings.length, alerts, marketDataApiKey]);

  // --- Function to Add New Portfolio ---
  const addNewPortfolio = async (name: string, type: 'Stock' | 'Crypto' | 'Mixed'): Promise<string | null> => {
    let finalId = `local-${Date.now()}`;
    
    // 1. DB Creation with Graceful Timeout Handling
    if (isSupabaseConfigured && user && !user.id.startsWith('mock')) {
        try {
            // Use Promise.race to timeout if DB is unresponsive, but don't fail the whole operation
            const dbPromise = supabase.from('portfolios').insert({
                user_id: user.id,
                name,
                type,
                cash_balance: 0
            }).select('id').single();

            // Extended timeout to 5s - if longer, we fallback to local ID for immediate UX
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("DB Timeout")), 5000));

            try {
                const { data, error }: any = await Promise.race([dbPromise, timeoutPromise]);
                if (data && data.id) {
                    finalId = data.id;
                } else if (error) {
                    console.warn("DB Create Portfolio Warning (Proceeding locally):", error.message || error);
                }
            } catch (e) {
                console.warn("DB Timeout/Error during portfolio creation (Proceeding locally):", e);
                // We proceed with finalId remaining as `local-...`
            }
        } catch (e) {
            console.warn("Failed to create portfolio in DB (Continuing locally)", e);
        }
    }

    // 2. Update Context State (Optimistic)
    const optimisticSummary: PortfolioSummary = { id: finalId, name, type };
    setPortfolios(prev => {
        if (prev.find(p => p.id === finalId)) return prev;
        const updated = [...prev, optimisticSummary];
        if (user) {
            localStorage.setItem(`wealthos_portfolios_list_${user.id}`, JSON.stringify(updated));
        }
        return updated;
    });

    // Initialize empty data structure
    const emptyPortfolio: Portfolio = {
        id: finalId,
        name,
        totalValue: 0,
        cashBalance: 0,
        holdings: [],
        transactions: [],
        manualAssets: [],
        liabilities: []
    };
    localStorage.setItem(`wealthos_portfolio_data_${finalId}`, JSON.stringify(emptyPortfolio));
    
    // Switch to it immediately
    setActivePortfolioId(finalId);
    
    return finalId;
  };

  // BATCHED IMPORT FUNCTION TO PREVENT TIMEOUTS
  const importPortfolio = async (name: string, transactions: any[], targetPortfolioId?: string) => {
      const targetId = targetPortfolioId || activePortfolioId;
      console.log(`Importing ${transactions.length} transactions to ${targetId}`);
      
      // Lock automatic fetches to prevent overwriting
      setIsSyncing(true);

      // --- Local Optimistic Update (Always Runs first/concurrently for speed) ---
      let currentHoldings: Holding[] = [];
      if (targetId === activePortfolioId) {
          currentHoldings = [...activePortfolio.holdings];
      }

      const newTransactions = transactions.map((t: any) => ({
          id: `imported-${Date.now()}-${Math.random()}`,
          date: t.date,
          type: t.type,
          symbol: t.symbol.toUpperCase(),
          shares: safeFloat(t.shares),
          price: safeFloat(t.price),
          totalValue: safeFloat(t.shares * t.price)
      }));

      // Process in-memory for local state
      const holdingsMap = new Map(currentHoldings.map(h => [h.symbol.toUpperCase(), h]));

      transactions.forEach((tx: any) => {
          const sym = tx.symbol.toUpperCase();
          const existing = holdingsMap.get(sym);
          
          // Normalize type for local calc
          const txType = tx.type.toUpperCase();
          const txShares = safeFloat(tx.shares);
          const txPrice = safeFloat(tx.price);

          if (existing) {
              if (txType === 'BUY' || txType === 'MARKET BUY') {
                  const totalCost = (existing.shares * existing.avgPrice) + (txShares * txPrice);
                  existing.shares += txShares;
                  existing.avgPrice = totalCost / existing.shares;
              } else if (txType === 'SELL' || txType === 'MARKET SELL') {
                  existing.shares -= txShares;
              }
          } else if (txType === 'BUY' || txType === 'MARKET BUY') {
              // Enriched defaults
              const mockData = MOCK_MARKET_ASSETS.find(m => m.symbol === sym);
              holdingsMap.set(sym, {
                  id: `new-${sym}`,
                  symbol: sym,
                  // USE NAME FROM CSV IF AVAILABLE, ELSE MOCK, ELSE SYMBOL
                  name: tx.name || mockData?.name || sym,
                  shares: txShares,
                  avgPrice: txPrice,
                  currentPrice: txPrice,
                  assetType: AssetType.STOCK,
                  sector: mockData?.sector || 'Diversified',
                  country: mockData?.country || 'Global',
                  dividendYield: mockData?.dividendYield || 0,
                  safetyScore: mockData?.safetyScore || 50,
                  snowflake: mockData?.snowflake || { value: 3, future: 3, past: 3, health: 3, dividend: 3, total: 15 },
                  targetAllocation: 0,
                  expenseRatio: 0
              });
          }
      });

      const updatedHoldings = Array.from(holdingsMap.values()).filter(h => h.shares > 0.000001);
      const newTotalValue = updatedHoldings.reduce((sum, h) => sum + (h.shares * h.currentPrice), 0);
      
      if (targetId === activePortfolioId) {
          const updated = {
              ...activePortfolio,
              holdings: updatedHoldings,
              transactions: [...newTransactions, ...activePortfolio.transactions],
              totalValue: safeFloat(newTotalValue)
          };
          setActivePortfolio(updated);
          localStorage.setItem(`wealthos_portfolio_data_${activePortfolioId}`, JSON.stringify(updated));
      }

      // --- DB Sync (Batched and Robust) ---
      if (isSupabaseConfigured && user && !targetId.startsWith('local')) {
          // Run in background so UI doesn't freeze
          (async () => {
              try {
                  // 1. BATCH TRANSACTION INSERT
                  const chunkArray = (arr: any[], size: number) => {
                      return Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
                          arr.slice(i * size, i * size + size)
                      );
                  };

                  const mappedTx = transactions.map((t: any) => ({
                      portfolio_id: targetId,
                      user_id: user.id, 
                      date: t.date,
                      type: t.type,
                      symbol: t.symbol.toUpperCase(),
                      shares: safeFloat(t.shares),
                      price: safeFloat(t.price),
                      total_value: safeFloat(t.shares * t.price)
                  }));
                  
                  const txChunks = chunkArray(mappedTx, 50); 
                  
                  for (const chunk of txChunks) {
                      const { error: txError } = await supabase.from('transactions').insert(chunk);
                      if (txError) console.error("DB TX Batch Insert Error", txError);
                      await new Promise(r => setTimeout(r, 50));
                  }
                  
                  // 2. BULK HOLDINGS UPSERT
                  const dbHoldingsPayload = updatedHoldings.map(h => ({
                      portfolio_id: targetId,
                      symbol: h.symbol,
                      name: h.name,
                      shares: h.shares,
                      avg_price: h.avgPrice,
                      asset_type: h.assetType,
                      sector: h.sector,
                      country: h.country,
                      dividend_yield: h.dividendYield,
                      safety_score: h.safetyScore,
                      snowflake_data: h.snowflake,
                      target_allocation: h.targetAllocation
                  }));

                  // Smart Upsert based on symbol match
                  const { data: existingDbHoldings } = await supabase
                      .from('holdings')
                      .select('id, symbol')
                      .eq('portfolio_id', targetId);
                  
                  const dbMap = new Map(existingDbHoldings?.map((h: any) => [h.symbol, h.id]));
                  
                  const upsertPayload = dbHoldingsPayload.map(h => {
                      const id = dbMap.get(h.symbol);
                      return id ? { ...h, id } : h;
                  });

                  const holdingsChunks = chunkArray(upsertPayload, 50);
                  for (const chunk of holdingsChunks) {
                      const { error } = await supabase.from('holdings').upsert(chunk);
                      if (error) console.error("Holdings Upsert Error", error);
                      await new Promise(r => setTimeout(r, 50));
                  }

                  // Delete holdings that no longer exist (shares <= 0)
                  const activeSymbols = new Set(updatedHoldings.map(h => h.symbol));
                  const idsToDelete = existingDbHoldings?.filter((h: any) => !activeSymbols.has(h.symbol)).map((h: any) => h.id) || [];
                  
                  if (idsToDelete.length > 0) {
                      await supabase.from('holdings').delete().in('id', idsToDelete);
                  }

                  console.log("DB Sync Completed for Import");
              } catch (e) {
                  console.error("Import Background Sync Failed", e);
              } finally {
                  setIsSyncing(false);
              }
          })();
      } else {
          setIsSyncing(false);
      }
      
      alert(`Successfully imported ${transactions.length} transactions!`);
  };

  const addTransaction = async (assetId: string, type: 'BUY' | 'SELL', shares: number, price: number, date: string, targetPortfolioId?: string) => {
      const targetId = targetPortfolioId || activePortfolioId;
      const safeShares = safeFloat(shares);
      const safePrice = safeFloat(price);
      
      const asset = MOCK_MARKET_ASSETS.find(a => a.id === assetId);
      if (!asset) return;
      
      // 1. Optimistic Local Update
      if (targetId === activePortfolioId) {
          const newTx: Transaction = {
              id: `tx-${Date.now()}`,
              date,
              type,
              symbol: asset.symbol,
              shares: safeShares,
              price: safePrice,
              totalValue: safeShares * safePrice
          };
          
          const existingHolding = activePortfolio.holdings.find(h => h.symbol === asset.symbol);
          let updatedHoldings = [...activePortfolio.holdings];
          
          if (existingHolding) {
              if (type === 'BUY') {
                  existingHolding.shares += safeShares;
                  const totalVal = (existingHolding.shares - safeShares) * existingHolding.avgPrice + (safeShares * safePrice);
                  existingHolding.avgPrice = totalVal / existingHolding.shares;
              } else {
                  existingHolding.shares -= safeShares;
              }
              if (existingHolding.shares <= 0) {
                  updatedHoldings = updatedHoldings.filter(h => h.symbol !== asset.symbol);
              }
          } else if (type === 'BUY') {
              updatedHoldings.push({
                  ...asset,
                  shares: safeShares,
                  avgPrice: safePrice,
                  currentPrice: safePrice
              } as any);
          }
          
          // Recalculate total value locally
          const newTotalValue = updatedHoldings.reduce((sum, h) => sum + (h.shares * h.currentPrice), 0);

          const updatedPortfolio = {
              ...activePortfolio,
              transactions: [newTx, ...activePortfolio.transactions],
              holdings: updatedHoldings,
              totalValue: safeFloat(newTotalValue)
          };

          setActivePortfolio(updatedPortfolio);
          localStorage.setItem(`wealthos_portfolio_data_${activePortfolioId}`, JSON.stringify(updatedPortfolio));
      }

      // 2. DB Persistance
      if (isSupabaseConfigured && user && !targetId.startsWith('local')) {
          try {
              await supabase.from('transactions').insert({
                  portfolio_id: targetId,
                  user_id: user.id,
                  date,
                  type,
                  symbol: asset.symbol,
                  shares: safeShares,
                  price: safePrice,
                  total_value: safeShares * safePrice
              });

              const { data: existingHoldings } = await supabase
                  .from('holdings')
                  .select('*')
                  .eq('portfolio_id', targetId)
                  .ilike('symbol', asset.symbol);

              const existingDbHolding = existingHoldings && existingHoldings.length > 0 ? existingHoldings[0] : null;

              if (existingDbHolding) {
                  let newShares = safeFloat(existingDbHolding.shares);
                  let newAvg = safeFloat(existingDbHolding.avg_price);

                  if (type === 'BUY') {
                      const oldTotal = newShares * newAvg;
                      const buyTotal = safeShares * safePrice;
                      newShares += safeShares;
                      newAvg = (oldTotal + buyTotal) / newShares;
                  } else {
                      newShares -= safeShares;
                  }

                  if (newShares <= 0.000001) {
                      await supabase.from('holdings').delete().eq('id', existingDbHolding.id);
                  } else {
                      await supabase.from('holdings').update({
                          shares: newShares,
                          avg_price: newAvg
                      }).eq('id', existingDbHolding.id);
                  }
              } else if (type === 'BUY') {
                  await supabase.from('holdings').insert({
                      portfolio_id: targetId,
                      symbol: asset.symbol,
                      name: asset.name,
                      shares: safeShares,
                      avg_price: safePrice,
                      asset_type: asset.assetType,
                      sector: asset.sector || 'Diversified',
                      country: asset.country || 'Global',
                      dividend_yield: asset.dividendYield || 0,
                      safety_score: asset.safetyScore || 50,
                      snowflake_data: asset.snowflake || { value: 3, future: 3, past: 3, health: 3, dividend: 3, total: 15 },
                      target_allocation: 0
                  });
              }
          } catch (e) {
              console.error("DB Transaction Write Error:", e);
          }
      }
  };

  const updateHolding = async (holdingId: string, updates: Partial<Holding>) => {
      // 1. Local Optimistic Update
      const updatedHoldings = activePortfolio.holdings.map(h => 
          h.id === holdingId ? { ...h, ...updates } : h
      );
      
      // Recalculate totals
      const newTotal = updatedHoldings.reduce((sum, h) => sum + (h.shares * h.currentPrice), 0);
      
      const updatedPortfolio = {
          ...activePortfolio,
          holdings: updatedHoldings,
          totalValue: safeFloat(newTotal)
      };
      
      setActivePortfolio(updatedPortfolio);
      localStorage.setItem(`wealthos_portfolio_data_${activePortfolioId}`, JSON.stringify(updatedPortfolio));

      // 2. DB Update
      if (isSupabaseConfigured && user && !activePortfolioId.startsWith('local') && !activePortfolioId.startsWith('mock')) {
          const dbPayload: any = {};
          if (updates.shares !== undefined) dbPayload.shares = updates.shares;
          if (updates.avgPrice !== undefined) dbPayload.avg_price = updates.avgPrice;
          
          if (Object.keys(dbPayload).length > 0) {
              const { error } = await supabase.from('holdings').update(dbPayload).eq('id', holdingId);
              if (error) console.error("Failed to update holding in DB", error);
          }
      }
  };

  const deleteHolding = async (holdingId: string) => {
      if (!window.confirm("Are you sure you want to remove this holding? This action cannot be undone.")) return;

      // 1. Local Optimistic Update
      const updatedHoldings = activePortfolio.holdings.filter(h => h.id !== holdingId);
      const newTotal = updatedHoldings.reduce((sum, h) => sum + (h.shares * h.currentPrice), 0);

      const updatedPortfolio = {
          ...activePortfolio,
          holdings: updatedHoldings,
          totalValue: safeFloat(newTotal)
      };

      setActivePortfolio(updatedPortfolio);
      localStorage.setItem(`wealthos_portfolio_data_${activePortfolioId}`, JSON.stringify(updatedPortfolio));

      // 2. DB Update
      if (isSupabaseConfigured && user && !activePortfolioId.startsWith('local') && !activePortfolioId.startsWith('mock')) {
          const { error } = await supabase.from('holdings').delete().eq('id', holdingId);
          if (error) console.error("Failed to delete holding from DB", error);
      }
  };

  const addManualAsset = async (asset: Omit<ManualAsset, 'id'>, targetPortfolioId?: string) => {
      const targetId = targetPortfolioId || activePortfolioId;
      
      // 1. Local Update
      if (targetId === activePortfolioId) {
          const newAsset = { ...asset, id: `ma-${Date.now()}` };
          const updated = {
              ...activePortfolio,
              manualAssets: [...(activePortfolio.manualAssets || []), newAsset]
          };
          setActivePortfolio(updated);
          localStorage.setItem(`wealthos_portfolio_data_${activePortfolioId}`, JSON.stringify(updated));
      }

      // 2. DB Persistence
      if (isSupabaseConfigured && user && !targetId.startsWith('local')) {
          try {
              await supabase.from('manual_assets').insert({
                  portfolio_id: targetId,
                  name: asset.name,
                  type: asset.type,
                  value: safeFloat(asset.value),
                  currency: asset.currency,
                  purchase_date: asset.purchaseDate,
                  purchase_price: safeFloat(asset.purchasePrice)
              });
          } catch (e) {
              console.error("Manual Asset DB Error", e);
          }
      }
  };

  const addLiability = async (liability: Omit<Liability, 'id'>, targetPortfolioId?: string) => {
      const targetId = targetPortfolioId || activePortfolioId;
      
      // 1. Local Update
      if (targetId === activePortfolioId) {
          const newLiab = { ...liability, id: `li-${Date.now()}` };
          const updated = {
              ...activePortfolio,
              liabilities: [...(activePortfolio.liabilities || []), newLiab]
          };
          setActivePortfolio(updated);
          localStorage.setItem(`wealthos_portfolio_data_${activePortfolioId}`, JSON.stringify(updated));
      }

      // 2. DB Persistence
      if (isSupabaseConfigured && user && !targetId.startsWith('local')) {
          try {
              await supabase.from('liabilities').insert({
                  portfolio_id: targetId,
                  name: liability.name,
                  type: liability.type,
                  amount: safeFloat(liability.amount),
                  interest_rate: safeFloat(liability.interestRate),
                  monthly_payment: safeFloat(liability.monthlyPayment)
              });
          } catch (e) {
              console.error("Liability DB Error", e);
          }
      }
  };

  const syncBroker = async (brokerId: string) => {
      console.log(`Syncing broker ${brokerId}...`);
      if (!user) return false;
      
      try {
          const integration = integrations.find(i => i.id === brokerId);
          if (!integration || !integration.apiCredentials) return false;

          if (integration.name === 'Trading 212') {
              const positions = await fetchTrading212Positions(integration.apiCredentials.apiKey);
              
              // Auto-map to transactions for importPortfolio
              if (positions.length > 0) {
                  const transactions = positions.map(p => ({
                      date: new Date().toISOString().split('T')[0],
                      type: 'BUY', // Assuming current positions are long
                      symbol: p.ticker.split('_')[0],
                      shares: p.quantity,
                      price: p.averagePrice
                  }));
                  
                  await importPortfolio('T212 Auto Sync', transactions);
                  return true;
              }
          }
      } catch (e) {
          console.error("Sync failed", e);
      }
      
      return false;
  };

  // Other Context Methods
  const switchPortfolio = (id: string) => setActivePortfolioId(id);
  const switchView = (view: ViewState) => setActiveView(view);
  
  const viewStock = (symbol: string) => {
      setSelectedResearchSymbol(symbol);
      setActiveView('research');
  };

  const toggleWatchlist = (symbol: string) => {
      setWatchlists(prev => prev.map(w => {
          if (w.id === activeWatchlistId) {
              if (w.symbols.includes(symbol)) {
                  return { ...w, symbols: w.symbols.filter(s => s !== symbol) };
              } else {
                  return { ...w, symbols: [...w.symbols, symbol] };
              }
          }
          return w;
      }));
  };

  const createWatchlist = (name: string) => {
      const newId = `wl-${Date.now()}`;
      setWatchlists(prev => [...prev, { id: newId, name, symbols: [] }]);
      setActiveWatchlistId(newId);
  };

  const switchWatchlist = (id: string) => setActiveWatchlistId(id);

  const openAddAssetModal = (ticker?: string) => {
      setPreSelectedAssetTicker(ticker || null);
      setIsAddAssetModalOpen(true);
  };
  
  const closeAddAssetModal = () => {
      setIsAddAssetModalOpen(false);
      setPreSelectedAssetTicker(null);
  };

  const markAsRead = (id: string) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  const clearNotifications = () => setNotifications([]);

  const addAlert = async (symbol: string, targetPrice: number, condition: 'ABOVE' | 'BELOW') => {
      const newAlert: AlertConfig = {
          id: `alert-${Date.now()}`,
          symbol,
          targetPrice,
          condition,
          createdAt: new Date().toISOString(),
          isActive: true
      };
      setAlerts(prev => [...prev, newAlert]);

      if (isSupabaseConfigured && user) {
          await supabase.from('alerts').insert({
              user_id: user.id,
              symbol,
              target_price: targetPrice,
              condition
          });
      }
  };

  const removeAlert = async (id: string) => {
      setAlerts(prev => prev.filter(a => a.id !== id));
      if (isSupabaseConfigured && user) {
          await supabase.from('alerts').delete().eq('id', id);
      }
  };

  const toggleMarketOpen = () => setIsMarketOpen(!isMarketOpen);

  return (
    <PortfolioContext.Provider value={{
      portfolios,
      activePortfolio,
      activePortfolioId,
      defaultPortfolioId,
      switchPortfolio,
      setDefaultPortfolio,
      addNewPortfolio,
      importPortfolio,
      addTransaction,
      updateHolding,
      deleteHolding,
      addManualAsset,
      addLiability,
      watchlists,
      activeWatchlistId,
      toggleWatchlist,
      createWatchlist,
      switchWatchlist,
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
      alerts,
      addAlert,
      removeAlert,
      isMarketOpen,
      toggleMarketOpen,
      marketDataApiKey,
      setMarketDataApiKey: updateMarketDataKey,
      syncBroker
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
