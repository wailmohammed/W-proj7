
import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, BarChart, Bar, PieChart, Pie, Cell, Treemap } from 'recharts';
import { usePortfolio } from '../context/PortfolioContext';
import { Activity, Layers, Grid, Info, Percent, AlertTriangle, TrendingUp, Target, PieChart as PieChartIcon, ShieldCheck, Zap, Scale, Wallet, Calendar, ChevronDown, Plus, X, LayoutGrid } from 'lucide-react';
import SnowflakeChart from './SnowflakeChart';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

// Moved outside component to prevent re-render loop
const CustomizedTreemapContent = (props: any) => {
    const { x, y, width, height, payload, index, totalValue } = props;
    
    // Defensive check for invalid dimensions and payload
    if (
        !payload ||
        typeof x !== 'number' || 
        typeof y !== 'number' || 
        typeof width !== 'number' || 
        typeof height !== 'number' ||
        isNaN(x) || isNaN(y) || isNaN(width) || isNaN(height) ||
        width <= 0 || height <= 0
    ) {
        return <g />; 
    }

    const name = payload?.name;
    const size = payload?.size;
    const fill = payload?.fill || COLORS[(index || 0) % COLORS.length] || '#333'; // Safe fill
    
    // Safe Percentage Calc
    const percent = (totalValue > 0 && Number.isFinite(size)) ? (size / totalValue) * 100 : 0;
    const percentStr = Number.isFinite(percent) ? `${percent.toFixed(1)}%` : '0%';

    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          style={{
            fill: fill,
            stroke: '#fff',
            strokeWidth: 2,
            strokeOpacity: 0.3,
          }}
        />
        {width > 60 && height > 30 && (
          <text
            x={x + width / 2}
            y={y + height / 2 - 6}
            textAnchor="middle"
            fill="#fff"
            fontSize={12}
            fontWeight="bold"
            style={{ pointerEvents: 'none', textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
          >
            {name}
          </text>
        )}
        {width > 60 && height > 50 && (
           <text
            x={x + width / 2}
            y={y + height / 2 + 12}
            textAnchor="middle"
            fill="#fff"
            fontSize={10}
            fillOpacity={0.9}
            style={{ pointerEvents: 'none', textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
          >
            {percentStr}
          </text>
        )}
      </g>
    );
};

const AnalyticsView: React.FC = () => {
  const { activePortfolio } = usePortfolio();
  const { holdings, totalValue } = activePortfolio;
  const [benchmarkTimeframe, setBenchmarkTimeframe] = useState<'1M' | '6M' | '1Y' | 'YTD' | 'ALL'>('1Y');
  const [selectedBenchmark, setSelectedBenchmark] = useState<'sp500' | 'nasdaq' | 'btc'>('sp500');
  
  // Stock Comparison State
  const [selectedComparisonAssets, setSelectedComparisonAssets] = useState<string[]>(
      holdings.slice(0, 3).map(h => h.symbol) // Default to top 3 holdings
  );

  // --- Aggregations & Calculations ---

  // 1. Portfolio Snowflake (Weighted Average)
  const portfolioSnowflake = useMemo(() => {
    if (!totalValue || totalValue <= 0) return { value: 0, future: 0, past: 0, health: 0, dividend: 0, total: 0 };
    
    const acc = { value: 0, future: 0, past: 0, health: 0, dividend: 0, total: 0 };
    holdings.forEach(h => {
        const val = h.shares * h.currentPrice;
        if (val > 0) {
            const weight = val / totalValue;
            acc.value += (h.snowflake?.value || 0) * weight;
            acc.future += (h.snowflake?.future || 0) * weight;
            acc.past += (h.snowflake?.past || 0) * weight;
            acc.health += (h.snowflake?.health || 0) * weight;
            acc.dividend += (h.snowflake?.dividend || 0) * weight;
            acc.total += (h.snowflake?.total || 0) * weight;
        }
    });
    
    return {
        value: Number(acc.value.toFixed(1)),
        future: Number(acc.future.toFixed(1)),
        past: Number(acc.past.toFixed(1)),
        health: Number(acc.health.toFixed(1)),
        dividend: Number(acc.dividend.toFixed(1)),
        total: Math.round(acc.total)
    };
  }, [totalValue, holdings]);

  // 2. Treemap Data (Sector Allocation)
  const treemapData = useMemo(() => {
      const sectorMap = new Map<string, number>();
      holdings.forEach(h => {
          const val = h.shares * h.currentPrice;
          if (Number.isFinite(val) && val > 0) {
             sectorMap.set(h.sector, (sectorMap.get(h.sector) || 0) + val);
          }
      });
      
      return Array.from(sectorMap.entries())
          .map(([name, value], index) => ({
              name,
              size: value,
              fill: COLORS[index % COLORS.length]
          }))
          .filter(item => item.size > 0)
          .sort((a, b) => b.size - a.size);
  }, [holdings]);

  // 5. Income Analytics (SWS Style)
  const portfolioYield = useMemo(() => {
      if (!totalValue || totalValue <= 0) return 0;
      const weightedYield = holdings.reduce((acc, h) => acc + (h.shares * h.currentPrice * (h.dividendYield/100)), 0) / totalValue * 100;
      return Number.isFinite(weightedYield) ? weightedYield : 0;
  }, [totalValue, holdings]);

  const yieldComparisonData = [
      { name: 'Portfolio', value: parseFloat(portfolioYield.toFixed(2)), fill: '#10b981' },
      { name: 'Market Avg', value: 1.5, fill: '#64748b' },
      { name: 'High Yielders', value: 4.2, fill: '#f59e0b' },
  ];

  // Mock Payout Ratio (Weighted)
  const weightedPayoutRatio = useMemo(() => {
      if (!totalValue || totalValue <= 0) return 0;
      const ratio = holdings.reduce((acc, h) => {
            let pr = 45; 
            if(h.dividendYield > 5) pr = 92;
            else if(h.dividendYield > 3) pr = 65;
            else if(h.dividendYield > 1) pr = 25;
            else pr = 0;
            
            const val = h.shares * h.currentPrice;
            return acc + (pr * (val/totalValue));
        }, 0);
      return Number.isFinite(ratio) ? ratio : 0;
  }, [totalValue, holdings]);

  // 7. Correlation Matrix (Simulated)
  const correlationMatrix = useMemo(() => {
      const assets = holdings.slice(0, 6); // Limit to top 6 for UI
      return assets.map(rowAsset => {
          return {
              symbol: rowAsset.symbol,
              correlations: assets.map(colAsset => {
                  if (rowAsset.symbol === colAsset.symbol) return 1.0;
                  let baseCorr = 0.3;
                  if (rowAsset.assetType === colAsset.assetType) baseCorr += 0.3;
                  if (rowAsset.sector === colAsset.sector) baseCorr += 0.2;
                  if (rowAsset.assetType === 'Crypto' || colAsset.assetType === 'Crypto') baseCorr = 0.1;
                  
                  const randomVariance = (Math.random() * 0.1) - 0.05;
                  return Math.max(-1, Math.min(1, parseFloat((baseCorr + randomVariance).toFixed(2))));
              })
          };
      });
  }, [holdings]);

  const getCorrelationColor = (val: number) => {
      if (val === 1) return 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500';
      if (val > 0.7) return 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400';
      if (val > 0.5) return 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400';
      if (val > 0.2) return 'bg-slate-200 dark:bg-slate-700/30 text-slate-500 dark:text-slate-300';
      return 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400';
  };

  // Memoized Benchmark Data to prevent jitter on hover
  const benchmarkData = useMemo(() => {
      let labels: string[] = [];
      
      if (benchmarkTimeframe === '1M') labels = Array.from({length: 30}, (_,i) => `Day ${i+1}`);
      else if (benchmarkTimeframe === '6M') labels = Array.from({length: 26}, (_,i) => `Wk ${i+1}`);
      else if (benchmarkTimeframe === 'YTD') labels = Array.from({length: 20}, (_,i) => `Wk ${i+1}`);
      else if (benchmarkTimeframe === '1Y') labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      else labels = Array.from({length: 60}, (_,i) => `M${i+1}`); // ALL = 5 years
      
      const vol = benchmarkTimeframe === '1M' ? 0.5 : benchmarkTimeframe === '6M' ? 1.5 : 2.5;
      let pVal = 0, sVal = 0, nVal = 0, bVal = 0;

      return labels.map((label) => {
          // Seeded random-like walk for stability across renders if we had a seed, 
          // but here useMemo protects us from re-execution unless timeframe changes.
          pVal += (Math.random() * vol * 2) - (vol * 0.8) + 0.5; // Slight upward bias
          sVal += (Math.random() * vol * 1.5) - (vol * 0.6) + 0.3;
          nVal += (Math.random() * vol * 2.5) - (vol * 1.0) + 0.4;
          bVal += (Math.random() * vol * 4.0) - (vol * 1.5) + 0.5; // High vol for BTC
          
          return {
              date: label,
              portfolio: parseFloat(pVal.toFixed(2)),
              sp500: parseFloat(sVal.toFixed(2)),
              nasdaq: parseFloat(nVal.toFixed(2)),
              btc: parseFloat(bVal.toFixed(2))
          };
      });
  }, [benchmarkTimeframe]);

  // Stock Comparison Data Generation
  const comparisonData = useMemo(() => {
      return selectedComparisonAssets.map(symbol => {
          const h = holdings.find(h => h.symbol === symbol) || { 
              symbol, 
              dividendYield: 0, 
              competitors: [{ peRatio: 20 }],
              snowflake: { value: 0, future: 3, past: 0, health: 0, dividend: 0, total: 0 }
          };
          
          // Mock Data generation based on asset characteristics if real data is sparse
          const pe = h.competitors && h.competitors[0] ? h.competitors[0].peRatio : (20 + Math.random() * 10);
          const growth = (h.snowflake?.future || 3) * 4.2; // Mock CAGR based on Snowflake future score
          
          return {
              name: symbol,
              yield: h.dividendYield || 0,
              peRatio: pe,
              cagr: growth
          };
      });
  }, [selectedComparisonAssets, holdings]);

  const toggleComparisonAsset = (symbol: string) => {
      if (selectedComparisonAssets.includes(symbol)) {
          setSelectedComparisonAssets(prev => prev.filter(s => s !== symbol));
      } else {
          if (selectedComparisonAssets.length < 5) {
              setSelectedComparisonAssets(prev => [...prev, symbol]);
          }
      }
  };

  // --- Dynamic Sector Performance Chart ---
  const sectorPerfData = useMemo(() => {
      // 1. Identify Top 3 Sectors
      const sectorWeights = holdings.reduce((acc, h) => {
          const val = h.shares * h.currentPrice;
          acc[h.sector] = (acc[h.sector] || 0) + val;
          return acc;
      }, {} as Record<string, number>);

      const topSectors = Object.entries(sectorWeights)
          .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
          .slice(0, 3)
          .map(([name]) => name);

      if (topSectors.length === 0) return [];

      // 2. Generate Mock Growth Data for these sectors
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
      return months.map((month, idx) => {
          const dataPoint: any = { month };
          topSectors.forEach((sector, sIdx) => {
              // Differentiate growth curves based on sector index hash or name
              const volatility = (sector.length % 3) + 1; // 1, 2, or 3
              const trend = (sector.charCodeAt(0) % 2 === 0) ? 1 : 0.5;
              // Simulated cumulative growth
              const value = (idx * trend * 2.5) + (Math.sin(idx * volatility) * 3); 
              dataPoint[sector] = parseFloat(value.toFixed(1));
          });
          return dataPoint;
      });
  }, [holdings]);

  const topSectorKeys = sectorPerfData.length > 0 
      ? Object.keys(sectorPerfData[0]).filter(k => k !== 'month')
      : [];

  const getBenchmarkLabel = (key: string) => {
      switch(key) {
          case 'sp500': return 'S&P 500';
          case 'nasdaq': return 'NASDAQ';
          case 'btc': return 'Bitcoin';
          default: return 'Benchmark';
      }
  }

  return (
    <div className="max-w-6xl mx-auto animate-fade-in space-y-8 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Portfolio Analytics</h1>
          <div className="text-sm text-slate-500 dark:text-slate-400 hidden sm:block">Deep dive into your asset allocation and risk.</div>
      </div>

      {/* 1. EXECUTIVE SUMMARY (SNOWFLAKE) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center relative overflow-hidden shadow-sm">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-500 to-indigo-500"></div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 w-full text-left flex items-center gap-2">
                   <Activity className="w-5 h-5 text-brand-500" /> Portfolio DNA
              </h3>
              <div className="w-full max-w-[250px] h-[250px]">
                  <SnowflakeChart data={portfolioSnowflake} height={250} />
              </div>
              <div className="text-center mt-2">
                  <div className="text-3xl font-bold text-slate-900 dark:text-white">{portfolioSnowflake.total}<span className="text-lg text-slate-500">/25</span></div>
                  <div className="text-xs text-slate-500 uppercase tracking-widest">Aggregate Health Score</div>
              </div>
          </div>

          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                   <Info className="w-5 h-5 text-blue-500" /> Analysis Summary
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                      <div>
                          <div className="flex justify-between text-sm mb-1 text-slate-500 dark:text-slate-400">
                              <span>Value</span>
                              <span className={portfolioSnowflake.value > 3 ? "text-emerald-500" : "text-amber-500"}>{portfolioSnowflake.value}/5</span>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                              <div className={`h-2 rounded-full ${portfolioSnowflake.value > 3 ? "bg-emerald-500" : "bg-amber-500"}`} style={{width: `${(portfolioSnowflake.value/5)*100}%`}}></div>
                          </div>
                      </div>
                      <div>
                          <div className="flex justify-between text-sm mb-1 text-slate-500 dark:text-slate-400">
                              <span>Future Growth</span>
                              <span className="text-brand-500 dark:text-brand-400">{portfolioSnowflake.future}/5</span>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                              <div className="bg-brand-500 h-2 rounded-full" style={{width: `${(portfolioSnowflake.future/5)*100}%`}}></div>
                          </div>
                      </div>
                      <div>
                          <div className="flex justify-between text-sm mb-1 text-slate-500 dark:text-slate-400">
                              <span>Past Performance</span>
                              <span className="text-indigo-500 dark:text-indigo-400">{portfolioSnowflake.past}/5</span>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                              <div className="bg-indigo-500 h-2 rounded-full" style={{width: `${(portfolioSnowflake.past/5)*100}%`}}></div>
                          </div>
                      </div>
                  </div>
                  
                  <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-4 border border-slate-200 dark:border-slate-800 flex flex-col justify-center">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Verdict</h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                          Your portfolio is primarily <strong className="text-slate-900 dark:text-white">Growth-oriented</strong> with a moderate valuation. 
                          It has a <strong className={portfolioSnowflake.health > 3 ? "text-emerald-500" : "text-red-500"}>
                              {portfolioSnowflake.health > 3 ? "Healthy" : "Weak"}
                          </strong> balance sheet aggregate.
                      </p>
                  </div>
              </div>
          </div>
      </div>

      {/* 2. STOCK COMPARISON TOOL (NEW) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <Scale className="w-5 h-5 text-brand-500" /> Stock Comparison
          </h3>
          
          <div className="flex flex-wrap gap-2 mb-6">
              {holdings.map(h => (
                  <button
                      key={h.symbol}
                      onClick={() => toggleComparisonAsset(h.symbol)}
                      disabled={!selectedComparisonAssets.includes(h.symbol) && selectedComparisonAssets.length >= 5}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors border ${
                          selectedComparisonAssets.includes(h.symbol) 
                          ? 'bg-brand-600 text-white border-brand-600' 
                          : 'bg-white dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-400'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                      {h.symbol}
                      {selectedComparisonAssets.includes(h.symbol) && <X className="w-3 h-3 inline-block ml-1 -mt-0.5" />}
                  </button>
              ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Yield Comparison */}
              <div className="bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                  <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-4 text-center">Dividend Yield (%)</h4>
                  <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={comparisonData}>
                              <CartesianGrid strokeDasharray="3 3" strokeDashoffset={2} vertical={false} strokeOpacity={0.1} />
                              <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                              <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                              <RechartsTooltip cursor={{fill: 'transparent'}} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9', borderRadius: '8px' }} />
                              <Bar dataKey="yield" fill="#10b981" radius={[4, 4, 0, 0]} name="Yield %" />
                          </BarChart>
                      </ResponsiveContainer>
                  </div>
              </div>

              {/* P/E Ratio Comparison */}
              <div className="bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                  <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-4 text-center">P/E Ratio</h4>
                  <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={comparisonData}>
                              <CartesianGrid strokeDasharray="3 3" strokeDashoffset={2} vertical={false} strokeOpacity={0.1} />
                              <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                              <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                              <RechartsTooltip cursor={{fill: 'transparent'}} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9', borderRadius: '8px' }} />
                              <Bar dataKey="peRatio" fill="#6366f1" radius={[4, 4, 0, 0]} name="P/E Ratio" />
                          </BarChart>
                      </ResponsiveContainer>
                  </div>
              </div>

              {/* Growth CAGR Comparison */}
              <div className="bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                  <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-4 text-center">Est. Growth (CAGR %)</h4>
                  <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={comparisonData}>
                              <CartesianGrid strokeDasharray="3 3" strokeDashoffset={2} vertical={false} strokeOpacity={0.1} />
                              <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                              <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                              <RechartsTooltip cursor={{fill: 'transparent'}} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9', borderRadius: '8px' }} />
                              <Bar dataKey="cagr" fill="#f59e0b" radius={[4, 4, 0, 0]} name="CAGR %" />
                          </BarChart>
                      </ResponsiveContainer>
                  </div>
              </div>
          </div>
      </div>

      {/* NEW: SECTOR TREEMAP */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 animate-fade-in shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <LayoutGrid className="w-5 h-5 text-indigo-500" /> Sector Allocation Map
          </h3>
          <div className="h-[350px]">
              {treemapData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                      <Treemap
                          data={treemapData}
                          dataKey="size"
                          aspectRatio={4 / 3}
                          stroke="#fff"
                          content={<CustomizedTreemapContent totalValue={activePortfolio.totalValue} />}
                      >
                          <RechartsTooltip 
                              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9', borderRadius: '8px' }}
                              formatter={(value: number) => [`$${value.toLocaleString()}`, 'Value']}
                          />
                      </Treemap>
                  </ResponsiveContainer>
              ) : (
                  <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                      Add assets with value to see allocation.
                  </div>
              )}
          </div>
      </div>

      {/* 3. BENCHMARK & SECTORS */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-6 gap-4">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Activity className="w-5 h-5 text-brand-500" /> Benchmark Comparison
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Compare your Time-Weighted Return against major indices.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                        {/* Benchmark Selector */}
                        <div className="relative w-full sm:w-auto min-w-[140px]">
                            <select 
                                value={selectedBenchmark}
                                onChange={(e) => setSelectedBenchmark(e.target.value as any)}
                                className="w-full appearance-none bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-3 pr-8 py-2 text-xs font-bold text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none cursor-pointer transition-colors hover:border-slate-400"
                            >
                                <option value="sp500">S&P 500</option>
                                <option value="nasdaq">NASDAQ</option>
                                <option value="btc">Bitcoin</option>
                            </select>
                            <ChevronDown className="absolute right-2 top-2.5 w-3 h-3 text-slate-500 pointer-events-none" />
                        </div>

                        <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
                            {['1M', '6M', 'YTD', '1Y', 'ALL'].map(tf => (
                                <button
                                    key={tf}
                                    onClick={() => setBenchmarkTimeframe(tf as any)}
                                    className={`flex-1 min-w-[40px] px-3 py-1.5 text-xs font-bold rounded-md transition-colors whitespace-nowrap ${benchmarkTimeframe === tf ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                                >
                                    {tf}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="h-[250px] sm:h-[300px] w-full -ml-2">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={benchmarkData}>
                            <CartesianGrid strokeDasharray="3 3" strokeDashoffset={2} vertical={false} strokeOpacity={0.1} />
                            <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(val) => `${val}%`} tickLine={false} axisLine={false} />
                            <RechartsTooltip 
                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9', borderRadius: '8px' }}
                                formatter={(value: number) => [`${value}%`]}
                            />
                            <Legend verticalAlign="top" height={36} iconType="circle" />
                            <Line type="monotone" dataKey="portfolio" name="My Portfolio" stroke="#6366f1" strokeWidth={3} dot={{r: 4}} />
                            <Line type="monotone" dataKey={selectedBenchmark} name={getBenchmarkLabel(selectedBenchmark)} stroke="#cbd5e1" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
        </div>

        {/* Dynamic Sector Performance Chart */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-500" /> Top Sectors (YTD)
            </h3>
            <div className="h-[250px] sm:h-[300px] w-full -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sectorPerfData}>
                        <CartesianGrid strokeDasharray="3 3" strokeDashoffset={2} vertical={false} strokeOpacity={0.1} />
                        <XAxis dataKey="month" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                        <YAxis stroke="#94a3b8" fontSize={10} tickFormatter={(val) => `${val}%`} tickLine={false} axisLine={false} width={30} />
                        <RechartsTooltip 
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9', borderRadius: '8px' }}
                            formatter={(value: number) => [`${value}%`]}
                        />
                        <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{fontSize: '10px'}} />
                        {topSectorKeys.map((key, idx) => (
                            <Line 
                                key={key}
                                type="monotone" 
                                dataKey={key} 
                                stroke={COLORS[idx % COLORS.length]} 
                                strokeWidth={2} 
                                dot={false} 
                            />
                        ))}
                        {topSectorKeys.length === 0 && (
                            <text x="50%" y="50%" textAnchor="middle" fill="#94a3b8" fontSize="12">No data available</text>
                        )}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
      </div>

      {/* 4. INCOME & DIVIDEND ANALYSIS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Yield Benchmarking */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                   <Wallet className="w-5 h-5 text-emerald-500" /> Income Analysis
              </h3>
              <div className="h-[180px] mb-4">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={yieldComparisonData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" strokeDashoffset={2} horizontal={false} strokeOpacity={0.1} />
                          <XAxis type="number" stroke="#94a3b8" fontSize={12} tickFormatter={(val) => `${val}%`} />
                          <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} width={90} />
                          <RechartsTooltip 
                             contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9', borderRadius: '8px' }}
                             formatter={(value: number) => [`${value}%`, 'Yield']}
                             cursor={{fill: 'transparent'}}
                          />
                          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                              {yieldComparisonData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.fill} />
                              ))}
                          </Bar>
                      </BarChart>
                  </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
                   {portfolioYield < 2 ? (
                       <TrendingUp className="w-4 h-4 text-slate-400" />
                   ) : (
                       <ShieldCheck className="w-4 h-4 text-emerald-500" />
                   )}
                   <span className="text-xs text-slate-500 dark:text-slate-400">
                       Your yield of <strong className="text-slate-900 dark:text-white">{portfolioYield.toFixed(2)}%</strong> is 
                       {portfolioYield > 1.5 ? ' higher ' : ' lower '} than the market average.
                   </span>
              </div>
          </div>

          {/* Payout Coverage */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                   <Scale className="w-5 h-5 text-brand-500" /> Dividend Coverage
              </h3>
              
              <div className="relative pt-8 pb-8 px-4">
                   {/* Gauge Background */}
                   <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-full w-full relative overflow-hidden">
                       <div className="absolute top-0 left-0 h-full w-[50%] bg-emerald-500/20"></div>
                       <div className="absolute top-0 left-[50%] h-full w-[25%] bg-yellow-500/20"></div>
                       <div className="absolute top-0 left-[75%] h-full w-[25%] bg-red-500/20"></div>
                   </div>
                   
                   {/* Marker */}
                   <div className="absolute top-0 h-full w-0.5 bg-slate-800 dark:bg-white z-20 transition-all duration-1000" style={{ left: `${Math.min(weightedPayoutRatio, 100)}%` }}>
                       <div className="absolute bottom-full mb-2 -translate-x-1/2 flex flex-col items-center">
                           <span className="text-xs font-bold text-white bg-slate-800 px-2 py-1 rounded border border-slate-700 whitespace-nowrap">
                               {weightedPayoutRatio.toFixed(0)}% Payout
                           </span>
                           <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-slate-700"></div>
                       </div>
                   </div>

                   <div className="flex justify-between text-[10px] text-slate-500 mt-2 font-bold uppercase tracking-wider">
                       <span>Safe</span>
                       <span className="pr-12">Sustainable</span>
                       <span>Risky</span>
                   </div>
              </div>

              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                  On average, your holdings pay out <strong className="text-slate-900 dark:text-white">{weightedPayoutRatio.toFixed(0)}%</strong> of their earnings as dividends.
              </p>
          </div>
      </div>

      {/* 5. ADVANCED METRICS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Correlation Matrix */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 overflow-hidden shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Grid className="w-5 h-5 text-slate-500" /> Correlation Matrix
                    </h3>
                    <span className="text-xs text-slate-500 uppercase border border-slate-200 dark:border-slate-700 px-2 py-1 rounded">Advanced</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr>
                                <th className="p-1"></th>
                                {correlationMatrix.slice(0,6).map(col => (
                                    <th key={col.symbol} className="p-1 text-center text-[10px] font-bold text-slate-500 dark:text-slate-400">{col.symbol}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {correlationMatrix.slice(0,6).map((row, i) => (
                                <tr key={row.symbol}>
                                    <td className="p-1 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">{row.symbol}</td>
                                    {row.correlations.slice(0,6).map((val, j) => (
                                        <td key={j} className="p-0.5">
                                            <div className={`w-full h-8 flex items-center justify-center rounded text-[10px] font-medium ${getCorrelationColor(val)}`}>
                                                {val === 1 ? '' : val}
                                            </div>
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
          </div>
      </div>
    </div>
  );
};

export default AnalyticsView;
