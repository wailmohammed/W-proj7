
import React, { useState, useEffect } from 'react';
import { TrendingUp, Wallet, ArrowUpRight, Activity, Loader2, Sparkles, BarChart3, Layers, Bell, Gauge, AlertCircle, Newspaper, ExternalLink, Power, ArrowDownRight, Plus, BellRing, Trash2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { generatePortfolioInsight } from '../services/geminiService';
import { usePortfolio } from '../context/PortfolioContext';
import { useTheme } from '../context/ThemeContext';
import { MOCK_NEWS } from '../constants';

// New Ticker Component
const StockTicker: React.FC<{ holdings: any[] }> = ({ holdings }) => {
    return (
        <div className="w-full bg-slate-950 border-b border-slate-800 overflow-hidden py-2 flex items-center relative z-0">
            <div className="flex animate-scroll whitespace-nowrap">
                {/* Duplicate list for seamless loop */}
                {[...holdings, ...holdings, ...holdings].map((h, i) => {
                    // Simulate a daily change based on deviation from avg price for demo
                    const change = ((h.currentPrice - h.avgPrice) / h.avgPrice) * 100;
                    // Or just random daily move for visual flair if avgPrice is too far off
                    const dailyMove = (Math.random() * 2 - 1); 
                    
                    return (
                        <div key={`${h.id}-${i}`} className="flex items-center gap-2 px-6 border-r border-slate-800/50">
                            <span className="font-bold text-slate-300 text-xs">{h.symbol}</span>
                            <span className="text-white text-xs font-mono">${h.currentPrice.toFixed(2)}</span>
                            <span className={`text-[10px] flex items-center ${dailyMove >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {dailyMove >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                {Math.abs(dailyMove).toFixed(2)}%
                            </span>
                        </div>
                    );
                })}
                {holdings.length === 0 && (
                    <span className="text-slate-500 text-xs px-6">Add assets to see live ticker updates...</span>
                )}
            </div>
            <style>{`
                @keyframes scroll {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-33%); }
                }
                .animate-scroll {
                    animation: scroll 30s linear infinite;
                }
                .animate-scroll:hover {
                    animation-play-state: paused;
                }
            `}</style>
        </div>
    );
};

const DashboardView: React.FC = () => {
  const { activePortfolio, isMarketOpen, toggleMarketOpen, alerts, addAlert, removeAlert } = usePortfolio();
  const { theme } = useTheme();
  const [insight, setInsight] = useState<string | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [isAddingAlert, setIsAddingAlert] = useState(false);
  const [newAlertSymbol, setNewAlertSymbol] = useState('');
  const [newAlertPrice, setNewAlertPrice] = useState('');
  const [newAlertCondition, setNewAlertCondition] = useState<'ABOVE' | 'BELOW'>('ABOVE');

  // Auto-generate insight on mount/update
  useEffect(() => {
    const initInsight = async () => {
        setLoadingInsight(true);
        const text = await generatePortfolioInsight(activePortfolio);
        setInsight(text);
        setLoadingInsight(false);
    };
    if (activePortfolio.holdings.length > 0) {
        initInsight();
    } else {
        setInsight("Add assets to your portfolio to see AI insights.");
    }
  }, [activePortfolio.id, activePortfolio.holdings.length]);

  // Calculate total dividend income dynamically
  const annualDividendIncome = activePortfolio.holdings.reduce((acc, h) => {
      return acc + (h.shares * h.currentPrice * (h.dividendYield / 100));
  }, 0);

  // Snowball Analytics Style: Compound Projection Data
  const projectionData = Array.from({ length: 15 }, (_, i) => {
      const year = new Date().getFullYear() + i;
      const initialVal = activePortfolio.totalValue;
      const contributions = initialVal + (12000 * i); // Mock $1k/mo
      const growthRate = 0.08;
      const value = contributions * Math.pow(1 + growthRate, i);
      const dividendReinvest = value * 0.03; 
      return {
          year,
          contributions,
          value: Math.round(value + (dividendReinvest * i)),
          benchmark: Math.round(contributions * Math.pow(1.09, i)) // S&P 500 comparison
      };
  });

  // Market Mood Data (Mock)
  const marketMood = 65; // 0-100 Greed

  const handleCreateAlert = (e: React.FormEvent) => {
      e.preventDefault();
      if (newAlertSymbol && newAlertPrice) {
          addAlert(newAlertSymbol.toUpperCase(), parseFloat(newAlertPrice), newAlertCondition);
          setIsAddingAlert(false);
          setNewAlertSymbol('');
          setNewAlertPrice('');
      }
  };

  return (
    <div className="max-w-6xl mx-auto animate-fade-in pb-10">
      
      {/* Ticker Tape Area */}
      <div className="-mx-4 md:-mx-8 mb-6 border-b border-slate-200 dark:border-slate-800">
          <StockTicker holdings={activePortfolio.holdings} />
      </div>

      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
        <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Your holistic financial operating system.</p>
        </div>
        <div className="flex items-center gap-4">
             <button 
                onClick={toggleMarketOpen}
                className={`flex items-center gap-2 text-xs border px-3 py-1.5 rounded-lg shadow-sm transition-all ${
                    isMarketOpen 
                    ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-brand-500' 
                    : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-500 opacity-70'
                }`}
            >
                <span className={`flex h-2 w-2 rounded-full ${isMarketOpen ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
                {isMarketOpen ? 'Market Open' : 'Market Closed'}
                <Power className="w-3 h-3 ml-1" />
            </button>
            <div className="flex items-center gap-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 shadow-sm">
                S&P 500: <span className="text-emerald-500 font-bold">+0.42%</span>
            </div>
        </div>
      </div>

      {/* Top Row: Mood & Briefing */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Market Mood Widget */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col shadow-sm relative overflow-hidden">
              <div className="flex justify-between items-center mb-2 relative z-10">
                  <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      <Gauge className="w-4 h-4" /> Market Mood
                  </h3>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${marketMood > 50 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                      {marketMood > 75 ? 'Extreme Greed' : marketMood > 50 ? 'Greed' : marketMood > 25 ? 'Fear' : 'Extreme Fear'}
                  </span>
              </div>
              <div className="flex-1 flex items-center justify-center relative z-10">
                   <div className="relative w-48 h-24 overflow-hidden">
                       <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-40 h-40 rounded-full border-[12px] border-slate-100 dark:border-slate-800 border-b-0 border-l-0 border-r-0" style={{ borderTopColor: 'transparent' }}></div>
                       {/* Gradient Arch using simple SVG */}
                       <svg viewBox="0 0 100 50" className="w-full h-full">
                           <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke={theme === 'dark' ? '#1e293b' : '#e2e8f0'} strokeWidth="8" />
                           <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="url(#moodGradient)" strokeWidth="8" strokeDasharray="126" strokeDashoffset={126 - (126 * (marketMood / 100))} strokeLinecap="round" />
                           <defs>
                               <linearGradient id="moodGradient" x1="0" y1="0" x2="1" y2="0">
                                   <stop offset="0%" stopColor="#ef4444" />
                                   <stop offset="50%" stopColor="#eab308" />
                                   <stop offset="100%" stopColor="#10b981" />
                               </linearGradient>
                           </defs>
                       </svg>
                       <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
                           <div className="text-3xl font-bold text-slate-900 dark:text-white leading-none">{marketMood}</div>
                       </div>
                   </div>
              </div>
          </div>

          {/* AI Analyst / Daily Briefing */}
          <div className="lg:col-span-2 bg-gradient-to-br from-brand-600 to-indigo-700 rounded-2xl p-6 text-white relative overflow-hidden shadow-lg">
              <div className="absolute top-0 right-0 p-0 opacity-10">
                  <Sparkles className="w-48 h-48 text-white rotate-12 translate-x-10 -translate-y-10" />
              </div>
              <div className="relative z-10 flex flex-col h-full justify-between">
                  <div>
                      <div className="flex items-center gap-2 mb-3">
                          <div className="bg-white/20 backdrop-blur-sm p-1.5 rounded-lg">
                              <Activity className="w-4 h-4 text-white" />
                          </div>
                          <span className="text-xs font-bold bg-white/10 px-2 py-1 rounded-full border border-white/10">DAILY BRIEFING</span>
                      </div>
                      <h3 className="text-2xl font-bold mb-2">Portfolio Health Check</h3>
                  </div>
                  
                  {loadingInsight ? (
                    <div className="flex items-center gap-3 text-indigo-100">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-sm font-medium">Analyzing market correlation...</span>
                    </div>
                  ) : (
                    <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10 text-indigo-50 text-sm leading-relaxed">
                         {insight || "Your portfolio shows strong resilience today. Tech sector volatility is affecting your growth holdings, but high-yield assets are providing stability."}
                    </div>
                  )}
              </div>
          </div>
      </div>
      
      {/* Key Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
             <Wallet className="w-24 h-24 text-brand-500" />
          </div>
          <div className="text-slate-500 dark:text-slate-400 text-sm mb-1 font-medium">Net Worth</div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight transition-all duration-500">
              ${(activePortfolio.totalValue + activePortfolio.cashBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-emerald-500 dark:text-emerald-400 text-xs font-bold flex items-center gap-1 mt-3 bg-emerald-50 dark:bg-emerald-400/10 w-fit px-2 py-1 rounded-full">
            <TrendingUp className="w-3 h-3" /> +$2,430.50 (2.4%)
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all relative overflow-hidden">
          <div className="text-slate-500 dark:text-slate-400 text-sm mb-1 font-medium">Cash Balance</div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">${activePortfolio.cashBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          <div className="text-slate-500 text-xs mt-3 flex items-center gap-1">
             <AlertCircle className="w-3 h-3" /> Available to deploy
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all relative overflow-hidden">
           <div className="text-slate-500 dark:text-slate-400 text-sm mb-1 font-medium">Annual Income</div>
           <div className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight transition-all duration-500">
               ${annualDividendIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}
           </div>
           <div className="text-brand-600 dark:text-brand-400 text-xs font-bold flex items-center gap-1 mt-3 bg-brand-50 dark:bg-brand-400/10 w-fit px-2 py-1 rounded-full">
            <ArrowUpRight className="w-3 h-3" /> +12% YoY
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        
        {/* Wealth Projection */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-brand-500" /> Future Wealth Projection
                </h3>
                <div className="flex gap-2 text-xs">
                     <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400"><div className="w-3 h-3 bg-brand-500 rounded"></div> Portfolio</span>
                     <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400"><div className="w-3 h-3 bg-slate-400 dark:bg-slate-600 rounded"></div> Contributions</span>
                </div>
            </div>
            <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={projectionData}>
                        <defs>
                            <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? "#1e293b" : "#e2e8f0"} vertical={false} />
                        <XAxis dataKey="year" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis 
                            stroke="#64748b" 
                            fontSize={12} 
                            tickFormatter={(val) => `$${val/1000}k`} 
                            tickLine={false} 
                            axisLine={false} 
                        />
                        <Tooltip 
                            contentStyle={{ 
                                backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff', 
                                borderColor: theme === 'dark' ? '#334155' : '#cbd5e1', 
                                color: theme === 'dark' ? '#f1f5f9' : '#0f172a', 
                                borderRadius: '12px',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                            }}
                            formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                        />
                        <Area type="monotone" dataKey="value" name="Projected Value" stroke="#6366f1" fillOpacity={1} fill="url(#colorVal)" strokeWidth={2} />
                        <Area type="monotone" dataKey="contributions" name="Total Invested" stroke={theme === 'dark' ? "#475569" : "#94a3b8"} fill="transparent" strokeDasharray="5 5" strokeWidth={2} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* Active Alerts Widget */}
        <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm h-full flex flex-col">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <BellRing className="w-4 h-4" /> Active Alerts
                    </h3>
                    <button 
                        onClick={() => setIsAddingAlert(true)}
                        className="text-xs bg-brand-600 text-white px-2 py-1 rounded-md hover:bg-brand-500 transition-colors flex items-center gap-1"
                    >
                        <Plus className="w-3 h-3" /> Add
                    </button>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto max-h-[300px] pr-1">
                    {alerts.length === 0 ? (
                        <div className="text-center text-slate-500 text-xs py-8">No active alerts</div>
                    ) : (
                        alerts.map(alert => (
                            <div key={alert.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-200 dark:border-slate-800 group">
                                <div>
                                    <div className="font-bold text-slate-900 dark:text-white text-sm">{alert.symbol}</div>
                                    <div className="text-xs text-slate-500">
                                        Notify if {alert.condition.toLowerCase()} <span className="font-bold text-slate-700 dark:text-slate-300">${alert.targetPrice}</span>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => removeAlert(alert.id)}
                                    className="text-slate-400 hover:text-red-500 transition-colors p-1"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))
                    )}
                </div>

                {isAddingAlert && (
                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <form onSubmit={handleCreateAlert} className="space-y-2">
                            <input 
                                type="text" 
                                placeholder="Symbol (e.g. AAPL)" 
                                className="w-full bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-brand-500 rounded px-2 py-1.5 text-xs text-slate-900 dark:text-white outline-none"
                                value={newAlertSymbol}
                                onChange={e => setNewAlertSymbol(e.target.value.toUpperCase())}
                                required
                            />
                            <div className="flex gap-2">
                                <select 
                                    className="bg-slate-100 dark:bg-slate-800 border border-transparent rounded px-2 py-1.5 text-xs text-slate-900 dark:text-white outline-none"
                                    value={newAlertCondition}
                                    onChange={e => setNewAlertCondition(e.target.value as any)}
                                >
                                    <option value="ABOVE">Above</option>
                                    <option value="BELOW">Below</option>
                                </select>
                                <input 
                                    type="number" 
                                    placeholder="Price" 
                                    className="flex-1 bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-brand-500 rounded px-2 py-1.5 text-xs text-slate-900 dark:text-white outline-none"
                                    value={newAlertPrice}
                                    onChange={e => setNewAlertPrice(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="flex gap-2 mt-2">
                                <button type="submit" className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold py-1.5 rounded transition-colors">Save</button>
                                <button type="button" onClick={() => setIsAddingAlert(false)} className="flex-1 bg-slate-200 dark:bg-slate-800 text-slate-500 hover:text-white text-xs font-bold py-1.5 rounded transition-colors">Cancel</button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* News Feed Section */}
      <div className="mt-8">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-brand-500" /> Latest Market News
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {MOCK_NEWS.map(news => (
                <div key={news.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm hover:border-brand-500/50 transition-colors group">
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{news.source}</span>
                            <span className="w-1 h-1 rounded-full bg-slate-400"></span>
                            <span className="text-xs text-slate-400">{news.date}</span>
                        </div>
                        <a href={news.url} className="text-slate-400 hover:text-brand-500 transition-colors">
                            <ExternalLink className="w-4 h-4" />
                        </a>
                    </div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-3 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors line-clamp-2">
                        {news.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-auto">
                        {news.relatedSymbols.map(sym => (
                            <span key={sym} className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                {sym}
                            </span>
                        ))}
                        <div className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded ${
                            news.sentiment === 'Positive' ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 
                            news.sentiment === 'Negative' ? 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400' : 
                            'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}>
                            {news.sentiment}
                        </div>
                    </div>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
