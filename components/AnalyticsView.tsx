
import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { usePortfolio } from '../context/PortfolioContext';
import { Activity, Layers, Grid, Info, Percent, AlertTriangle, TrendingUp, Target, PieChart as PieChartIcon, ShieldCheck, Zap, Scale, Wallet, Calendar } from 'lucide-react';
import SnowflakeChart from './SnowflakeChart';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const AnalyticsView: React.FC = () => {
  const { activePortfolio } = usePortfolio();
  const { holdings, totalValue } = activePortfolio;
  const [benchmarkTimeframe, setBenchmarkTimeframe] = useState<'1M' | '6M' | '1Y' | 'YTD'>('1Y');

  // --- Aggregations & Calculations ---

  // 1. Portfolio Snowflake (Weighted Average)
  const calculatePortfolioSnowflake = () => {
    if (totalValue === 0) return { value: 0, future: 0, past: 0, health: 0, dividend: 0, total: 0 };
    
    const acc = { value: 0, future: 0, past: 0, health: 0, dividend: 0, total: 0 };
    holdings.forEach(h => {
        const weight = (h.shares * h.currentPrice) / totalValue;
        acc.value += h.snowflake.value * weight;
        acc.future += h.snowflake.future * weight;
        acc.past += h.snowflake.past * weight;
        acc.health += h.snowflake.health * weight;
        acc.dividend += h.snowflake.dividend * weight;
        acc.total += h.snowflake.total * weight;
    });
    
    return {
        value: Number(acc.value.toFixed(1)),
        future: Number(acc.future.toFixed(1)),
        past: Number(acc.past.toFixed(1)),
        health: Number(acc.health.toFixed(1)),
        dividend: Number(acc.dividend.toFixed(1)),
        total: Math.round(acc.total)
    };
  };

  const portfolioSnowflake = calculatePortfolioSnowflake();

  // 2. Valuation (DCF)
  // Simulate Fair Value: Value Score 5 = 40% undervalued, 3 = fair, 1 = 40% overvalued
  const fairValue = holdings.reduce((acc, h) => {
      const val = h.shares * h.currentPrice;
      let multiplier = 1;
      if (h.snowflake.value >= 4) multiplier = 1.3; // Undervalued
      else if (h.snowflake.value <= 2) multiplier = 0.8; // Overvalued
      return acc + (val * multiplier);
  }, 0) + activePortfolio.cashBalance;

  const currentValuation = totalValue + activePortfolio.cashBalance;
  const valuationDiff = ((fairValue - currentValuation) / currentValuation) * 100;
  
  // 3. Growth Forecast
  const growthData = [
      { name: 'Savings', rate: 4.5, fill: '#94a3b8' },
      { name: 'Market', rate: 9.2, fill: '#64748b' },
      { name: 'Portfolio', rate: 14.8, fill: '#6366f1' },
  ];

  // 4. Diversification
  const topHoldings = [...holdings].sort((a, b) => (b.shares * b.currentPrice) - (a.shares * a.currentPrice)).slice(0, 5);
  const topHoldingsData = topHoldings.map(h => ({
      name: h.symbol,
      value: (h.shares * h.currentPrice),
      percent: totalValue > 0 ? ((h.shares * h.currentPrice) / totalValue) * 100 : 0
  }));
  
  // 5. Income Analytics (SWS Style)
  const portfolioYield = totalValue > 0 
    ? (holdings.reduce((acc, h) => acc + (h.shares * h.currentPrice * (h.dividendYield/100)), 0) / totalValue) * 100 
    : 0;

  const yieldComparisonData = [
      { name: 'Portfolio', value: parseFloat(portfolioYield.toFixed(2)), fill: '#10b981' },
      { name: 'Market Avg', value: 1.5, fill: '#64748b' },
      { name: 'High Yielders', value: 4.2, fill: '#f59e0b' },
  ];

  // Mock Payout Ratio (Weighted)
  const weightedPayoutRatio = totalValue > 0 
    ? holdings.reduce((acc, h) => {
        // Infer a reasonable payout ratio based on yield if data missing
        let pr = 45; 
        if(h.dividendYield > 5) pr = 92;
        else if(h.dividendYield > 3) pr = 65;
        else if(h.dividendYield > 1) pr = 25;
        else pr = 0;
        
        return acc + (pr * ((h.shares * h.currentPrice)/totalValue));
    }, 0)
    : 0;

  // 6. Risk / Beta (Mocked)
  const calculateBeta = (sector: string, type: string) => {
      if (type === 'Crypto') return 2.5;
      if (sector === 'Technology') return 1.3;
      if (sector === 'Utilities') return 0.5;
      if (sector === 'Real Estate') return 0.7;
      return 1.0;
  }
  
  const portfolioBeta = totalValue > 0 
    ? holdings.reduce((acc, h) => acc + (calculateBeta(h.sector, h.assetType) * ((h.shares * h.currentPrice)/totalValue)), 0)
    : 1.0;

  // 7. Correlation Matrix (Simulated)
  const generateCorrelationMatrix = () => {
      const assets = holdings.slice(0, 6); // Limit to top 6 for UI
      return assets.map(rowAsset => {
          return {
              symbol: rowAsset.symbol,
              correlations: assets.map(colAsset => {
                  if (rowAsset.symbol === colAsset.symbol) return 1.0;
                  // Logic to simulate correlation
                  let baseCorr = 0.3;
                  if (rowAsset.assetType === colAsset.assetType) baseCorr += 0.3;
                  if (rowAsset.sector === colAsset.sector) baseCorr += 0.2;
                  if (rowAsset.assetType === 'Crypto' || colAsset.assetType === 'Crypto') baseCorr = 0.1;
                  
                  const randomVariance = (Math.random() * 0.1) - 0.05;
                  return Math.max(-1, Math.min(1, parseFloat((baseCorr + randomVariance).toFixed(2))));
              })
          };
      });
  };

  const correlationMatrix = generateCorrelationMatrix();

  const getCorrelationColor = (val: number) => {
      if (val === 1) return 'bg-slate-800 text-slate-500';
      if (val > 0.7) return 'bg-red-500/20 text-red-400';
      if (val > 0.5) return 'bg-orange-500/20 text-orange-400';
      if (val > 0.2) return 'bg-slate-700/30 text-slate-300';
      return 'bg-emerald-500/20 text-emerald-400';
  };

  // Fee Analyzer
  const weightedExpRatio = totalValue > 0 ? (holdings.reduce((acc, h) => {
      const val = h.shares * h.currentPrice;
      return acc + (val * ((h.expenseRatio || 0) / 100));
  }, 0) / totalValue) * 100 : 0;

  // Dynamic Benchmark Data Generator
  const getBenchmarkData = (timeframe: string) => {
      const points = timeframe === '1M' ? 30 : timeframe === '6M' ? 26 : 12;
      const labels = timeframe === '1M' ? Array.from({length: 30}, (_,i) => `Day ${i+1}`) :
                     timeframe === '6M' ? Array.from({length: 26}, (_,i) => `Wk ${i+1}`) :
                     ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      // Seed volatility based on timeframe
      const vol = timeframe === '1M' ? 0.5 : timeframe === '6M' ? 1.5 : 2.5;
      let pVal = 0, sVal = 0, nVal = 0;

      return labels.map((label) => {
          pVal += (Math.random() * vol * 2) - (vol * 0.8) + 0.5; // Slight upward bias
          sVal += (Math.random() * vol * 1.5) - (vol * 0.6) + 0.3;
          nVal += (Math.random() * vol * 2.5) - (vol * 1.0) + 0.4;
          
          return {
              date: label,
              portfolio: parseFloat(pVal.toFixed(2)),
              sp500: parseFloat(sVal.toFixed(2)),
              nasdaq: parseFloat(nVal.toFixed(2))
          };
      });
  };

  const benchmarkData = getBenchmarkData(benchmarkTimeframe);

  return (
    <div className="max-w-6xl mx-auto animate-fade-in space-y-8 pb-20">
      <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white">Portfolio Analytics</h1>
          <div className="text-sm text-slate-400">Deep dive into your asset allocation and risk.</div>
      </div>

      {/* 1. EXECUTIVE SUMMARY (SNOWFLAKE) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-500 to-indigo-500"></div>
              <h3 className="text-lg font-bold text-white mb-2 w-full text-left flex items-center gap-2">
                   <Activity className="w-5 h-5 text-brand-500" /> Portfolio DNA
              </h3>
              <div className="w-full max-w-[250px] h-[250px]">
                  <SnowflakeChart data={portfolioSnowflake} height={250} />
              </div>
              <div className="text-center mt-2">
                  <div className="text-3xl font-bold text-white">{portfolioSnowflake.total}<span className="text-lg text-slate-500">/25</span></div>
                  <div className="text-xs text-slate-400 uppercase tracking-widest">Aggregate Health Score</div>
              </div>
          </div>

          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                   <Info className="w-5 h-5 text-blue-500" /> Analysis Summary
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                      <div>
                          <div className="flex justify-between text-sm mb-1 text-slate-400">
                              <span>Value</span>
                              <span className={portfolioSnowflake.value > 3 ? "text-emerald-400" : "text-amber-400"}>{portfolioSnowflake.value}/5</span>
                          </div>
                          <div className="w-full bg-slate-800 rounded-full h-2">
                              <div className={`h-2 rounded-full ${portfolioSnowflake.value > 3 ? "bg-emerald-500" : "bg-amber-500"}`} style={{width: `${(portfolioSnowflake.value/5)*100}%`}}></div>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                              {portfolioSnowflake.value > 3 ? "Considerably Undervalued" : "Trading near Fair Value"}
                          </p>
                      </div>
                      <div>
                          <div className="flex justify-between text-sm mb-1 text-slate-400">
                              <span>Future Growth</span>
                              <span className="text-brand-400">{portfolioSnowflake.future}/5</span>
                          </div>
                          <div className="w-full bg-slate-800 rounded-full h-2">
                              <div className="bg-brand-500 h-2 rounded-full" style={{width: `${(portfolioSnowflake.future/5)*100}%`}}></div>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">Forecasted annual growth of {growthData[2].rate}%</p>
                      </div>
                      <div>
                          <div className="flex justify-between text-sm mb-1 text-slate-400">
                              <span>Past Performance</span>
                              <span className="text-indigo-400">{portfolioSnowflake.past}/5</span>
                          </div>
                          <div className="w-full bg-slate-800 rounded-full h-2">
                              <div className="bg-indigo-500 h-2 rounded-full" style={{width: `${(portfolioSnowflake.past/5)*100}%`}}></div>
                          </div>
                      </div>
                  </div>
                  
                  <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 flex flex-col justify-center">
                      <h4 className="text-sm font-bold text-white mb-2">Verdict</h4>
                      <p className="text-sm text-slate-400 leading-relaxed">
                          Your portfolio is primarily <strong className="text-white">Growth-oriented</strong> with a moderate valuation. 
                          It has a <strong className={portfolioSnowflake.health > 3 ? "text-emerald-400" : "text-red-400"}>
                              {portfolioSnowflake.health > 3 ? "Healthy" : "Weak"}
                          </strong> balance sheet aggregate. 
                          The dividend coverage is <strong className="text-white">{portfolioSnowflake.dividend > 3 ? "Strong" : "Adequate"}</strong>.
                      </p>
                  </div>
              </div>
          </div>
      </div>

      {/* 6. PAST PERFORMANCE (Enhanced) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-4">
                <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Activity className="w-5 h-5 text-brand-500" /> Benchmark Comparison
                    </h3>
                    <p className="text-sm text-slate-400">Compare your Time-Weighted Return against major indices.</p>
                </div>
                <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
                    {['1M', '6M', 'YTD', '1Y'].map(tf => (
                        <button
                            key={tf}
                            onClick={() => setBenchmarkTimeframe(tf as any)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${benchmarkTimeframe === tf ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-white'}`}
                        >
                            {tf}
                        </button>
                    ))}
                </div>
            </div>
            <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={benchmarkData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#64748b" fontSize={12} tickFormatter={(val) => `${val}%`} tickLine={false} axisLine={false} />
                        <RechartsTooltip 
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9', borderRadius: '8px' }}
                            formatter={(value: number) => [`${value}%`]}
                        />
                        <Legend verticalAlign="top" height={36} iconType="circle" />
                        <Line type="monotone" dataKey="portfolio" name="My Portfolio" stroke="#6366f1" strokeWidth={3} dot={{r: 4}} />
                        <Line type="monotone" dataKey="sp500" name="S&P 500" stroke="#cbd5e1" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                        <Line type="monotone" dataKey="nasdaq" name="NASDAQ-100" stroke="#94a3b8" strokeWidth={2} strokeDasharray="3 3" dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
      </div>

      {/* 2. INCOME & DIVIDEND ANALYSIS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Yield Benchmarking */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                   <Wallet className="w-5 h-5 text-emerald-500" /> Income Analysis
              </h3>
              <div className="h-[180px] mb-4">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={yieldComparisonData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                          <XAxis type="number" stroke="#64748b" fontSize={12} tickFormatter={(val) => `${val}%`} />
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
              <div className="flex items-center gap-2 p-3 bg-slate-950 rounded-lg border border-slate-800">
                   {portfolioYield < 2 ? (
                       <TrendingUp className="w-4 h-4 text-slate-400" />
                   ) : (
                       <ShieldCheck className="w-4 h-4 text-emerald-500" />
                   )}
                   <span className="text-xs text-slate-400">
                       Your yield of <strong className="text-white">{portfolioYield.toFixed(2)}%</strong> is 
                       {portfolioYield > 1.5 ? ' higher ' : ' lower '} than the market average.
                   </span>
              </div>
          </div>

          {/* Payout Coverage */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                   <Scale className="w-5 h-5 text-brand-500" /> Dividend Coverage
              </h3>
              
              <div className="relative pt-8 pb-8 px-4">
                   {/* Gauge Background */}
                   <div className="h-4 bg-slate-800 rounded-full w-full relative overflow-hidden">
                       <div className="absolute top-0 left-0 h-full w-[50%] bg-emerald-500/20"></div>
                       <div className="absolute top-0 left-[50%] h-full w-[25%] bg-yellow-500/20"></div>
                       <div className="absolute top-0 left-[75%] h-full w-[25%] bg-red-500/20"></div>
                   </div>
                   
                   {/* Marker */}
                   <div className="absolute top-0 h-full w-0.5 bg-white z-20 transition-all duration-1000" style={{ left: `${Math.min(weightedPayoutRatio, 100)}%` }}>
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

              <p className="text-sm text-slate-400 mt-2">
                  On average, your holdings pay out <strong className="text-white">{weightedPayoutRatio.toFixed(0)}%</strong> of their earnings as dividends. 
                  {weightedPayoutRatio < 60 ? ' This is a healthy and sustainable level.' : ' This is on the higher side, check for sustainability.'}
              </p>
          </div>
      </div>

      {/* 3. RISK PROFILE (Beta) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" /> Risk Profile (Beta)
            </h3>
            <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="relative w-48 h-24 overflow-hidden shrink-0">
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-40 h-40 rounded-full border-[12px] border-slate-800 border-b-0 border-l-0 border-r-0" style={{ borderTopColor: 'transparent' }}></div>
                    <svg viewBox="0 0 100 50" className="w-full h-full">
                        <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#1e293b" strokeWidth="8" />
                        {/* Gradient Arc */}
                        <defs>
                            <linearGradient id="betaGradient" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#10b981" />
                                <stop offset="50%" stopColor="#eab308" />
                                <stop offset="100%" stopColor="#ef4444" />
                            </linearGradient>
                        </defs>
                        <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="url(#betaGradient)" strokeWidth="8" strokeDasharray="126" strokeDashoffset={Math.max(0, 126 - (126 * (portfolioBeta / 2)))} strokeLinecap="round" />
                    </svg>
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
                        <div className="text-2xl font-bold text-white leading-none">{portfolioBeta.toFixed(2)}</div>
                        <div className="text-[10px] text-slate-500 uppercase">Beta</div>
                    </div>
                </div>
                <div className="flex-1">
                    <h4 className="text-sm font-bold text-white mb-2">Volatility Analysis</h4>
                    <p className="text-sm text-slate-400 mb-3">
                        Your portfolio is <strong className={portfolioBeta > 1.1 ? 'text-amber-400' : 'text-emerald-400'}>
                            {portfolioBeta > 1.1 ? 'more volatile' : portfolioBeta < 0.9 ? 'less volatile' : 'correlated'}
                        </strong> than the general market. 
                    </p>
                    <div className="text-xs text-slate-500 bg-slate-950 p-3 rounded-lg border border-slate-800">
                        Beta measures how much your portfolio moves compared to the market (S&P 500). A Beta of 1.0 means it moves perfectly in sync. 
                        Higher beta implies higher risk but potential for higher returns.
                    </div>
                </div>
            </div>
      </div>

      {/* 4. VALUATION & GROWTH */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* VALUATION (DCF) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                   <Target className="w-5 h-5 text-emerald-500" /> Valuation
              </h3>
              
              <div className="relative pt-10 pb-4 px-4">
                    <div className="h-4 bg-slate-800 rounded-full w-full relative">
                        <div className="absolute top-0 h-full w-1 bg-white z-10 left-[60%] shadow-[0_0_10px_rgba(255,255,255,0.5)]">
                             <div className="absolute bottom-full mb-2 -translate-x-1/2 text-xs font-bold text-white bg-slate-700 px-2 py-1 rounded border border-slate-600 whitespace-nowrap">
                                Fair Value: ${fairValue.toLocaleString(undefined, {maximumFractionDigits: 0})}
                             </div>
                        </div>
                        <div className="absolute top-0 h-full w-1 bg-emerald-500 z-20" style={{ left: valuationDiff < 0 ? '45%' : '75%' }}>
                             <div className="absolute top-full mt-2 -translate-x-1/2 text-xs font-bold text-emerald-400 whitespace-nowrap flex flex-col items-center">
                                <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[6px] border-b-emerald-500 mb-1 rotate-180"></div>
                                Current: ${currentValuation.toLocaleString(undefined, {maximumFractionDigits: 0})}
                             </div>
                        </div>
                         <div className="absolute top-0 left-0 h-full w-[40%] bg-emerald-500/20 rounded-l-full"></div>
                         <div className="absolute top-0 left-[40%] h-full w-[40%] bg-slate-700/20"></div>
                         <div className="absolute top-0 left-[80%] h-full w-[20%] bg-red-500/20 rounded-r-full"></div>
                    </div>
              </div>

              <div className="mt-6 p-4 bg-slate-950/50 rounded-xl border border-slate-800">
                  <div className="flex justify-between items-center">
                      <div>
                          <div className="text-xs text-slate-500 uppercase">Diff to Fair Value</div>
                          <div className={`text-xl font-bold ${valuationDiff < 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {valuationDiff < 0 ? 'Undervalued' : 'Overvalued'} by {Math.abs(valuationDiff).toFixed(1)}%
                          </div>
                      </div>
                  </div>
              </div>
          </div>

          {/* FUTURE GROWTH */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                   <TrendingUp className="w-5 h-5 text-brand-500" /> Annual Earnings Growth
              </h3>
              <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={growthData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                          <XAxis type="number" stroke="#64748b" fontSize={12} tickFormatter={(val) => `${val}%`} />
                          <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={12} width={80} />
                          <RechartsTooltip 
                             contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9', borderRadius: '8px' }}
                             formatter={(value: number) => [`${value}%`, 'Annual Growth']}
                             cursor={{fill: 'transparent'}}
                          />
                          <Bar dataKey="rate" radius={[0, 4, 4, 0]} barSize={30}>
                              {growthData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.fill} />
                              ))}
                          </Bar>
                      </BarChart>
                  </ResponsiveContainer>
              </div>
              <p className="text-sm text-slate-400 mt-2">
                  Forecasted to grow <strong className="text-brand-400">{growthData[2].rate}%</strong> per year, outpacing the market ({growthData[1].rate}%).
              </p>
          </div>
      </div>

      {/* 5. DIVERSIFICATION & HOLDINGS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6">
               <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                   <Layers className="w-5 h-5 text-indigo-500" /> Top Holdings Concentration
               </h3>
               <div className="space-y-4">
                   {topHoldingsData.map((h, i) => (
                       <div key={h.name} className="relative">
                           <div className="flex justify-between text-sm mb-1 z-10 relative">
                               <span className="font-medium text-white">{i+1}. {h.name}</span>
                               <span className="text-slate-300">{h.percent.toFixed(1)}%</span>
                           </div>
                           <div className="w-full bg-slate-800 rounded-full h-8 relative overflow-hidden">
                               <div 
                                   className={`h-full rounded-full flex items-center pl-3 text-xs font-bold text-white/90 ${h.percent > 20 ? 'bg-amber-500' : 'bg-brand-600'}`} 
                                   style={{width: `${h.percent}%`}}
                               >
                               </div>
                           </div>
                           {h.percent > 20 && (
                               <div className="text-[10px] text-amber-400 mt-1 flex items-center gap-1">
                                   <AlertTriangle className="w-3 h-3" /> High concentration risk (>20%)
                               </div>
                           )}
                       </div>
                   ))}
               </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
               <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                   <PieChartIcon className="w-5 h-5 text-emerald-500" /> Allocation
               </h3>
               <div className="h-[200px] flex items-center justify-center">
                    <div className="relative w-40 h-40 flex items-center justify-center">
                       <svg className="w-full h-full transform -rotate-90">
                           <circle cx="80" cy="80" r="70" stroke="#1e293b" strokeWidth="12" fill="none" />
                           <circle cx="80" cy="80" r="70" stroke="#10b981" strokeWidth="12" fill="none" strokeDasharray="440" strokeDashoffset="110" />
                       </svg>
                       <div className="absolute inset-0 flex flex-col items-center justify-center">
                           <span className="text-3xl font-bold text-white">{holdings.length}</span>
                           <span className="text-xs text-slate-500 uppercase tracking-wider">Assets</span>
                       </div>
                   </div>
               </div>
               <div className="text-center text-sm text-slate-400 mt-2">
                   Well diversified across {new Set(holdings.map(h => h.sector)).size} sectors.
               </div>
          </div>
      </div>

      {/* 7. ADVANCED METRICS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Fee Analyzer */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
               <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
                   <Percent className="w-5 h-5 text-red-400" /> Fee Analyzer
               </h3>
               <div className="flex items-center justify-between mb-8 p-4 bg-slate-950 rounded-xl border border-slate-800">
                   <div>
                       <div className="text-xs text-slate-500 uppercase">Weighted Expense Ratio</div>
                       <div className="text-xl font-bold text-white">{weightedExpRatio.toFixed(2)}%</div>
                   </div>
                   <div className="text-right">
                       <div className="text-xs text-slate-500 uppercase">Benchmark (Low Cost)</div>
                       <div className="text-xl font-bold text-emerald-400">0.05%</div>
                   </div>
               </div>
               <p className="text-sm text-slate-400">
                   You are paying approx <span className="text-white font-bold">${Math.round(totalValue * (weightedExpRatio/100))}</span> in fees annually.
               </p>
          </div>

          {/* Correlation Matrix */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 overflow-hidden">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Grid className="w-5 h-5 text-slate-500" /> Correlation Matrix
                    </h3>
                    <span className="text-xs text-slate-500 uppercase border border-slate-700 px-2 py-1 rounded">Advanced</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr>
                                <th className="p-1"></th>
                                {correlationMatrix.slice(0,6).map(col => (
                                    <th key={col.symbol} className="p-1 text-center text-[10px] font-bold text-slate-400">{col.symbol}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {correlationMatrix.slice(0,6).map((row, i) => (
                                <tr key={row.symbol}>
                                    <td className="p-1 text-left text-[10px] font-bold text-slate-400 whitespace-nowrap">{row.symbol}</td>
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
