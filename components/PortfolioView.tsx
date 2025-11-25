
import React, { useState, useEffect, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid, LineChart, Line, ComposedChart, Legend, Treemap } from 'recharts';
import { usePortfolio } from '../context/PortfolioContext';
import { PieChart as PieIcon, List, Layers, Globe, Download, Map as MapIcon, History, TrendingUp, Scale, AlertCircle, RefreshCcw, LayoutGrid, CheckCircle2, AlertTriangle, ArrowUpRight, ArrowDownRight, Home, Car, Watch, DollarSign, ArrowUp, ArrowDown, ArrowUpDown, Plus, Pencil, Trash2, X, Save } from 'lucide-react';
import SnowflakeChart from './SnowflakeChart';
import { Holding } from '../types';
import { convertToUSD } from '../services/marketData';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

// Moved CustomContent outside to prevent re-creation on render
const CustomizedContent = (props: any) => {
    const { x, y, width, height, index, payload, name, size, totalValue } = props;
    
    // Robust dimension check
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

    const fill = payload?.fill || COLORS[(index || 0) % COLORS.length] || '#8884d8';
    
    // Calculation with finite check
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
        {width > 50 && height > 30 && name && (
          <text
            x={x + width / 2}
            y={y + height / 2}
            textAnchor="middle"
            fill="#fff"
            fontSize={12}
            fontWeight="bold"
            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)', pointerEvents: 'none' }}
          >
            {name}
          </text>
        )}
        {width > 50 && height > 50 && (
           <text
            x={x + width / 2}
            y={y + height / 2 + 14}
            textAnchor="middle"
            fill="#fff"
            fontSize={10}
            fillOpacity={0.9}
            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)', pointerEvents: 'none' }}
          >
            {percentStr}
          </text>
        )}
      </g>
    );
};

const PortfolioView: React.FC = () => {
  const { activePortfolio, viewStock, openAddAssetModal, updateHolding, deleteHolding } = usePortfolio();
  const [viewMode, setViewMode] = useState<'allocation' | 'holdings' | 'transactions' | 'performance' | 'rebalancing'>('allocation');
  const [holdingViewType, setHoldingViewType] = useState<'list' | 'cards'>('cards');
  
  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  // Edit Holding State
  const [editingHolding, setEditingHolding] = useState<Holding | null>(null);
  const [editShares, setEditShares] = useState<string>('');
  const [editAvgPrice, setEditAvgPrice] = useState<string>('');

  // Rebalancing State
  const [localTargets, setLocalTargets] = useState<Record<string, number>>({});
  const [totalTarget, setTotalTarget] = useState(0);

  // Defensive access to portfolio data
  const holdings = activePortfolio?.holdings || [];
  const transactions = activePortfolio?.transactions || [];
  const manualAssets = activePortfolio?.manualAssets || [];

  // Initialize targets from holdings
  useEffect(() => {
      const initialTargets: Record<string, number> = {};
      holdings.forEach(h => {
          initialTargets[h.id] = h.targetAllocation || 0;
      });
      setLocalTargets(initialTargets);
  }, [holdings]);

  // Update Total Target % sum
  useEffect(() => {
      const sum = Object.values(localTargets).reduce((a: number, b: number) => a + b, 0);
      setTotalTarget(sum);
  }, [localTargets]);

  const handleTargetChange = (id: string, val: string) => {
      const num = parseFloat(val);
      setLocalTargets(prev => ({ ...prev, [id]: isNaN(num) ? 0 : num }));
  };

  // Sorting Logic
  const handleSort = (key: string) => {
      let direction: 'asc' | 'desc' = 'asc';
      if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
          direction = 'desc';
      }
      setSortConfig({ key, direction });
  };

  const sortedHoldings = useMemo(() => {
      if (!sortConfig) return holdings;
      
      return [...holdings].sort((a, b) => {
          let aValue: any = a[sortConfig.key as keyof Holding];
          let bValue: any = b[sortConfig.key as keyof Holding];

          // Handle computed fields that aren't direct properties
          if (sortConfig.key === 'value') {
              aValue = (a.shares || 0) * (a.currentPrice || 0);
              bValue = (b.shares || 0) * (b.currentPrice || 0);
          } else if (sortConfig.key === 'return') {
              aValue = ((a.shares || 0) * (a.currentPrice || 0)) - ((a.shares || 0) * (a.avgPrice || 0));
              bValue = ((b.shares || 0) * (b.currentPrice || 0)) - ((b.shares || 0) * (b.avgPrice || 0));
          } else if (sortConfig.key === 'snowflake') {
              aValue = a.snowflake?.total || 0;
              bValue = b.snowflake?.total || 0;
          }

          // Handle undefined/null safely for imported data
          if (aValue === undefined || aValue === null) aValue = 0;
          if (bValue === undefined || bValue === null) bValue = 0;

          // Handle Strings vs Numbers
          if (typeof aValue === 'string' && typeof bValue === 'string') {
              return sortConfig.direction === 'asc' 
                  ? aValue.localeCompare(bValue) 
                  : bValue.localeCompare(aValue);
          }

          if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
          if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
      });
  }, [holdings, sortConfig]);

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
      if (sortConfig?.key !== columnKey) return <ArrowUpDown className="w-3 h-3 text-slate-400" />;
      return sortConfig.direction === 'asc' 
          ? <ArrowUp className="w-3 h-3 text-brand-500" /> 
          : <ArrowDown className="w-3 h-3 text-brand-500" />;
  };

  // --- Calculations ---

  // Portfolio Snowflake (Weighted Average)
  const calculatePortfolioSnowflake = () => {
    if (!activePortfolio || !activePortfolio.holdings || !activePortfolio.totalValue || activePortfolio.totalValue <= 0) {
        return { value: 0, future: 0, past: 0, health: 0, dividend: 0, total: 0 };
    }

    const acc = { value: 0, future: 0, past: 0, health: 0, dividend: 0, total: 0 };
    
    activePortfolio.holdings.forEach(h => {
        const val = (h.shares || 0) * (h.currentPrice || 0);
        // Ensure we don't divide by zero
        const weight = (val > 0 && activePortfolio.totalValue > 0) ? val / activePortfolio.totalValue : 0;
        const sf = h.snowflake || { value: 0, future: 0, past: 0, health: 0, dividend: 0, total: 0 };
        
        acc.value += (sf.value || 0) * weight;
        acc.future += (sf.future || 0) * weight;
        acc.past += (sf.past || 0) * weight;
        acc.health += (sf.health || 0) * weight;
        acc.dividend += (sf.dividend || 0) * weight;
        acc.total += (sf.total || 0) * weight;
    });
    
    return {
        value: Math.round(acc.value) || 0,
        future: Math.round(acc.future) || 0,
        past: Math.round(acc.past) || 0,
        health: Math.round(acc.health) || 0,
        dividend: Math.round(acc.dividend) || 0,
        total: Math.round(acc.total) || 0
    };
  };

  const portfolioSnowflake = calculatePortfolioSnowflake();

  // Calculate Allocation Data
  const sectorDataMap = new Map<string, number>();
  const assetDataMap = new Map<string, number>();
  const countryDataMap = new Map<string, number>();

  holdings.forEach(h => {
      const val = (h.shares || 0) * (h.currentPrice || 0);
      if (isNaN(val) || val <= 0) return;

      const sector = h.sector || 'Unknown';
      const country = h.country || 'Unknown';
      const type = h.assetType || 'Stock';
      
      sectorDataMap.set(sector, (sectorDataMap.get(sector) || 0) + val);
      assetDataMap.set(type, (assetDataMap.get(type) || 0) + val);
      countryDataMap.set(country, (countryDataMap.get(country) || 0) + val);
  });

  // Helper to convert map to filtered array for charts
  const prepareChartData = (map: Map<string, number>) => {
      return Array.from(map.entries())
          .map(([name, value]) => ({ name, value }))
          .filter(item => item.value > 0.01 && Number.isFinite(item.value)) // Robust filter for Recharts
          .sort((a, b) => b.value - a.value);
  };

  const sectorData = prepareChartData(sectorDataMap);
  const assetData = prepareChartData(assetDataMap);
  const countryData = prepareChartData(countryDataMap);

  // Prepare Treemap Data (Sector)
  const treemapData = sectorData
      .map((s, index) => ({
          name: s.name,
          size: s.value,
          fill: COLORS[index % COLORS.length]
      }))
      .sort((a,b) => b.size - a.size);

  // Generate Mock Performance Data with Benchmark (1 Year / 365 Days)
  const generateChartData = () => {
      const data = [];
      // Simulate starting from 1 year ago
      let currentVal = activePortfolio && activePortfolio.totalValue > 0 ? activePortfolio.totalValue * 0.82 : 10000; 
      let currentBench = activePortfolio && activePortfolio.totalValue > 0 ? activePortfolio.totalValue * 0.88 : 10000;
      
      for(let i=0; i<365; i++) {
          const date = new Date();
          date.setDate(date.getDate() - (365 - i));
          const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          
          // Daily movement simulation
          const move = 1 + (Math.random() * 0.03 - 0.014); 
          const benchMove = 1 + (Math.random() * 0.02 - 0.0095); 
          
          currentVal = currentVal * move;
          currentBench = currentBench * benchMove;
          
          if (i > 350 && activePortfolio && activePortfolio.totalValue > 0) {
              currentVal = currentVal + (activePortfolio.totalValue - currentVal) / (365 - i);
          }

          data.push({
              date: dateStr,
              value: Math.round(currentVal),
              benchmark: Math.round(currentBench)
          });
      }
      return data;
  };
  
  const chartData = generateChartData();

  const handleExport = () => {
      const headers = ['Symbol,Name,Shares,AvgPrice,CurrentPrice,Value,Sector,Country'];
      const rows = holdings.map(h => 
        `${h.symbol},"${h.name}",${h.shares},${h.avgPrice},${h.currentPrice},${h.shares * h.currentPrice},${h.sector},${h.country}`
      );
      const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `wealthos_${activePortfolio.name.replace(/\s/g,'_')}_export.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  // Edit Helpers
  const openEditModal = (e: React.MouseEvent, holding: Holding) => {
      e.stopPropagation();
      setEditingHolding(holding);
      setEditShares(holding.shares.toString());
      setEditAvgPrice(holding.avgPrice.toString());
  };

  const closeEditModal = () => {
      setEditingHolding(null);
      setEditShares('');
      setEditAvgPrice('');
  };

  const saveHoldingEdit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (editingHolding) {
          const shares = parseFloat(editShares);
          const avgPrice = parseFloat(editAvgPrice);
          
          if (!isNaN(shares) && !isNaN(avgPrice)) {
              await updateHolding(editingHolding.id, { shares, avgPrice });
              closeEditModal();
          }
      }
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      deleteHolding(id);
  };

  // Helpers
  const getValuationStatus = (h: Holding) => {
      const score = h.snowflake?.value || 3;
      if(score >= 5) return { label: 'Significantly Undervalued', color: 'text-emerald-400', bg: 'bg-emerald-400/10' };
      if(score >= 4) return { label: 'Undervalued', color: 'text-emerald-300', bg: 'bg-emerald-300/10' };
      if(score === 3) return { label: 'Fair Value', color: 'text-slate-400 dark:text-slate-300', bg: 'bg-slate-100 dark:bg-slate-700/50' };
      if(score === 2) return { label: 'Overvalued', color: 'text-amber-400', bg: 'bg-amber-400/10' };
      return { label: 'High Valuation', color: 'text-red-400', bg: 'bg-red-400/10' };
  };

  const getAssetIcon = (type: string) => {
      switch (type) {
          case 'Real Estate': return <Home className="w-4 h-4 text-emerald-500" />;
          case 'Vehicle': return <Car className="w-4 h-4 text-blue-500" />;
          case 'Art/Collectibles': return <Watch className="w-4 h-4 text-amber-500" />;
          default: return <DollarSign className="w-4 h-4 text-slate-500" />;
      }
  };

  if (!activePortfolio) return <div className="p-12 text-center text-slate-500">Loading portfolio data...</div>;

  if (holdings.length === 0 && transactions.length === 0 && manualAssets.length === 0) {
      return (
          <div className="max-w-6xl mx-auto animate-fade-in text-center py-20">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 max-w-lg mx-auto">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                      <List className="w-8 h-8 text-slate-500" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Portfolio is Empty</h2>
                  <p className="text-slate-500 dark:text-slate-400 mb-6">Start by adding your first transaction to track your wealth.</p>
                  <button 
                      onClick={() => openAddAssetModal()}
                      className="bg-brand-600 hover:bg-brand-500 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 mx-auto"
                  >
                      <Plus className="w-5 h-5" /> Add First Asset
                  </button>
              </div>
          </div>
      );
  }

  return (
    <div className="max-w-6xl mx-auto animate-fade-in space-y-6 pb-20">
      {/* Header Controls */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Portfolio</h1>
        <div className="flex flex-wrap items-center gap-3">
            <button 
                onClick={() => openAddAssetModal()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-brand-600 text-white hover:bg-brand-500 transition-colors shadow-lg shadow-brand-600/20"
            >
                <Plus className="w-4 h-4" /> Add Asset
            </button>
            <button 
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors shadow-sm"
            >
                <Download className="w-4 h-4" /> Export
            </button>
            <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto">
                <button 
                    onClick={() => setViewMode('allocation')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${viewMode === 'allocation' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                >
                    <PieIcon className="w-4 h-4" /> Allocation
                </button>
                <button 
                    onClick={() => setViewMode('performance')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${viewMode === 'performance' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                >
                    <History className="w-4 h-4" /> Performance
                </button>
                <button 
                    onClick={() => setViewMode('holdings')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${viewMode === 'holdings' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                >
                    <LayoutGrid className="w-4 h-4" /> Overview
                </button>
                <button 
                    onClick={() => setViewMode('rebalancing')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${viewMode === 'rebalancing' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                >
                    <Scale className="w-4 h-4" /> Rebalancing
                </button>
                 <button 
                    onClick={() => setViewMode('transactions')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${viewMode === 'transactions' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                >
                    <List className="w-4 h-4" /> History
                </button>
            </div>
        </div>
      </div>

      {/* ALLOCATION VIEW (Default) */}
      {viewMode === 'allocation' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in mb-6">
                {/* Sector Allocation */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                        <Layers className="w-5 h-5 text-brand-500" /> Sector Exposure
                    </h3>
                    <div className="h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={sectorData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {sectorData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <RechartsTooltip 
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9', borderRadius: '8px' }}
                                    formatter={(value: number) => [`$${value.toLocaleString()}`, 'Value']}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-4">
                        {sectorData.map((entry, index) => (
                            <div key={entry.name} className="flex items-center gap-2 text-xs">
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                <span className="text-slate-600 dark:text-slate-300 truncate">{entry.name}</span>
                                <span className="text-slate-500 ml-auto">
                                    {activePortfolio.totalValue > 0 && Number.isFinite(entry.value) ? Math.round((entry.value / activePortfolio.totalValue) * 100) : 0}%
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Geographical Allocation */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                        <Globe className="w-5 h-5 text-emerald-500" /> Geography
                    </h3>
                    <div className="h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={countryData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {countryData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                                    ))}
                                </Pie>
                                <RechartsTooltip 
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9', borderRadius: '8px' }}
                                    formatter={(value: number) => [`$${value.toLocaleString()}`, 'Value']}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-4">
                        {countryData.map((entry, index) => (
                            <div key={entry.name} className="flex items-center gap-2 text-xs">
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[(index + 3) % COLORS.length] }}></div>
                                <span className="text-slate-600 dark:text-slate-300 truncate">{entry.name}</span>
                                <span className="text-slate-500 ml-auto">
                                    {activePortfolio.totalValue > 0 && Number.isFinite(entry.value) ? Math.round((entry.value / activePortfolio.totalValue) * 100) : 0}%
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Asset Class */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                        <MapIcon className="w-5 h-5 text-amber-500" /> Asset Class
                    </h3>
                    <div className="h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={assetData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {assetData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[(index + 5) % COLORS.length]} />
                                    ))}
                                </Pie>
                                <RechartsTooltip 
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9', borderRadius: '8px' }}
                                    formatter={(value: number) => [`$${value.toLocaleString()}`, 'Value']}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-4">
                        {assetData.map((entry, index) => (
                            <div key={entry.name} className="flex items-center gap-2 text-xs">
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[(index + 5) % COLORS.length] }}></div>
                                <span className="text-slate-600 dark:text-slate-300 truncate">{entry.name}</span>
                                <span className="text-slate-500 ml-auto">
                                    {activePortfolio.totalValue > 0 && Number.isFinite(entry.value) ? Math.round((entry.value / activePortfolio.totalValue) * 100) : 0}%
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Asset Treemap - Only render if we have valid data */}
            {treemapData.length > 0 ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 animate-fade-in shadow-sm">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                        <LayoutGrid className="w-5 h-5 text-indigo-500" /> Asset Allocation Map
                    </h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <Treemap
                                data={treemapData}
                                dataKey="size"
                                aspectRatio={4 / 3}
                                stroke="#fff"
                                content={<CustomizedContent totalValue={activePortfolio.totalValue} />}
                            >
                                <RechartsTooltip 
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9', borderRadius: '8px' }}
                                    formatter={(value: number) => [`$${value.toLocaleString()}`]}
                                />
                            </Treemap>
                        </ResponsiveContainer>
                    </div>
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 animate-fade-in shadow-sm text-center">
                    <div className="text-slate-400 mb-2">No allocation data available</div>
                    <div className="text-sm text-slate-500">Add assets with value greater than $0 to see the map.</div>
                </div>
            )}
          </>
      )}

      {/* PERFORMANCE VIEW (Composed with Benchmark) */}
      {viewMode === 'performance' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 animate-fade-in shadow-sm">
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-emerald-500" /> Performance History
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Comparison against S&P 500 Benchmark (1 Year)</p>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">${activePortfolio.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                        <div className="text-sm text-emerald-500 font-medium">+24.5% Past Year</div>
                    </div>
               </div>
               <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData}>
                            <defs>
                                <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" strokeDashoffset={2} vertical={false} strokeOpacity={0.1} />
                            <XAxis dataKey="date" hide />
                            <YAxis 
                                domain={['auto', 'auto']} 
                                stroke="#94a3b8" 
                                fontSize={12} 
                                tickFormatter={(val) => `$${val/1000}k`} 
                                tickLine={false} 
                                axisLine={false} 
                            />
                            <RechartsTooltip 
                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9', borderRadius: '8px' }}
                                formatter={(value: number, name: string) => [
                                    `$${value.toLocaleString()}`, 
                                    name === 'value' ? 'My Portfolio' : 'S&P 500 Benchmark'
                                ]}
                                labelFormatter={(label) => label}
                            />
                            <Legend verticalAlign="top" height={36} iconType="circle" />
                            <Area type="monotone" dataKey="value" name="My Portfolio" stroke="#10b981" fillOpacity={1} fill="url(#colorEquity)" strokeWidth={2} />
                            <Line type="monotone" dataKey="benchmark" name="S&P 500 Benchmark" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                        </ComposedChart>
                    </ResponsiveContainer>
               </div>
          </div>
      )}

      {/* REBALANCING VIEW */}
      {viewMode === 'rebalancing' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm animate-fade-in">
              <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Scale className="w-6 h-6 text-brand-500" /> Portfolio Rebalancing
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Define your strategy and see exactly what to trade.</p>
                  </div>
                  
                  <div className="flex items-center gap-4 bg-slate-100 dark:bg-slate-950 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800">
                       <div className="text-sm font-bold text-slate-500">Total Target:</div>
                       <div className={`text-lg font-bold ${Math.abs(totalTarget - 100) < 0.1 ? 'text-emerald-500' : 'text-amber-500'}`}>
                           {totalTarget.toFixed(1)}%
                       </div>
                       {Math.abs(totalTarget - 100) >= 0.1 && (
                           <div className="hidden md:flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-400/10 px-2 py-1 rounded">
                               <AlertCircle className="w-3 h-3" /> Must equal 100%
                           </div>
                       )}
                  </div>
              </div>
              
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 uppercase text-xs font-semibold border-b border-slate-200 dark:border-slate-800">
                          <tr>
                              <th className="px-6 py-4">Asset</th>
                              <th className="px-6 py-4 text-right">Price</th>
                              <th className="px-6 py-4 text-right">Actual %</th>
                              <th className="px-6 py-4 text-right">Target %</th>
                              <th className="px-6 py-4 text-right">Drift</th>
                              <th className="px-6 py-4 text-right">Action Value</th>
                              <th className="px-6 py-4 text-center">Suggested Trade</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                          {holdings.map((h) => {
                              const value = (h.shares || 0) * (h.currentPrice || 0);
                              const actualPct = activePortfolio.totalValue > 0 ? (value / activePortfolio.totalValue) * 100 : 0;
                              const targetPct = localTargets[h.id] || 0;
                              const drift = actualPct - targetPct;
                              const targetValue = activePortfolio.totalValue * (targetPct / 100);
                              const diffValue = targetValue - value;
                              
                              return (
                                  <tr key={h.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                      <td className="px-6 py-4 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                          <div className="w-8 h-8 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500 border border-slate-200 dark:border-slate-700">
                                              {h.symbol[0]}
                                          </div>
                                          <div>
                                              {h.symbol}
                                              <div className="text-xs text-slate-500 font-normal">{h.assetType}</div>
                                          </div>
                                      </td>
                                      <td className="px-6 py-4 text-right text-slate-700 dark:text-slate-300">${h.currentPrice.toLocaleString()}</td>
                                      <td className="px-6 py-4 text-right text-slate-700 dark:text-slate-200 font-medium">{actualPct.toFixed(1)}%</td>
                                      <td className="px-6 py-4 text-right">
                                          <div className="flex items-center justify-end gap-1">
                                              <input 
                                                type="number" 
                                                className="w-16 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-right text-slate-900 dark:text-white focus:border-brand-500 outline-none font-bold"
                                                value={targetPct}
                                                onChange={(e) => handleTargetChange(h.id, e.target.value)}
                                                step="0.1"
                                                min="0"
                                                max="100"
                                              />
                                              <span className="text-slate-500">%</span>
                                          </div>
                                      </td>
                                      <td className="px-6 py-4 text-right">
                                          <span className={`text-xs font-bold px-2 py-1 rounded ${
                                              Math.abs(drift) < 1 ? 'text-slate-500 bg-slate-100 dark:bg-slate-800' : 
                                              drift > 0 ? 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-400/10' : 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-400/10'
                                          }`}>
                                              {drift > 0 ? '+' : ''}{drift.toFixed(1)}%
                                          </span>
                                      </td>
                                      <td className="px-6 py-4 text-right font-mono text-slate-700 dark:text-slate-300">
                                          {diffValue > 0 ? '+' : ''}${diffValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                      </td>
                                      <td className="px-6 py-4 text-center">
                                          {Math.abs(diffValue) < 100 ? (
                                              <span className="text-slate-500 text-xs flex items-center justify-center gap-1"><CheckCircle2 className="w-3 h-3" /> On Target</span>
                                          ) : diffValue > 0 ? (
                                              <button className="bg-emerald-600 dark:bg-emerald-500 hover:bg-emerald-500 dark:hover:bg-emerald-400 text-white text-xs font-bold px-3 py-1.5 rounded flex items-center justify-center gap-1 w-full max-w-[100px] mx-auto transition-colors">
                                                  <RefreshCcw className="w-3 h-3" /> Buy
                                              </button>
                                          ) : (
                                              <button className="bg-red-600 dark:bg-red-500 hover:bg-red-500 dark:hover:bg-red-400 text-white text-xs font-bold px-3 py-1.5 rounded flex items-center justify-center gap-1 w-full max-w-[100px] mx-auto transition-colors">
                                                  <RefreshCcw className="w-3 h-3" /> Sell
                                              </button>
                                          )}
                                      </td>
                                  </tr>
                              );
                          })}
                      </tbody>
                  </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden grid grid-cols-1 gap-4 p-4">
                  {holdings.map((h) => {
                      const value = (h.shares || 0) * (h.currentPrice || 0);
                      const actualPct = activePortfolio.totalValue > 0 ? (value / activePortfolio.totalValue) * 100 : 0;
                      const targetPct = localTargets[h.id] || 0;
                      const drift = actualPct - targetPct;
                      const targetValue = activePortfolio.totalValue * (targetPct / 100);
                      const diffValue = targetValue - value;
                      
                      return (
                          <div key={h.id} className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
                              <div className="flex items-center justify-between mb-4">
                                  <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm font-bold text-slate-500 dark:text-white border border-slate-200 dark:border-slate-600">
                                          {h.symbol[0]}
                                      </div>
                                      <div>
                                          <div className="font-bold text-slate-900 dark:text-white">{h.symbol}</div>
                                          <div className="text-xs text-slate-500">{h.name}</div>
                                      </div>
                                  </div>
                                  <div className="text-right">
                                      <div className="font-bold text-slate-700 dark:text-slate-200">${h.currentPrice}</div>
                                      <div className="text-xs text-slate-500">Current Price</div>
                                  </div>
                              </div>
                              
                              <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                                  <div className="bg-slate-100 dark:bg-slate-900 p-2 rounded-lg">
                                      <div className="text-[10px] text-slate-500 uppercase">Actual</div>
                                      <div className="font-bold text-slate-900 dark:text-white">{actualPct.toFixed(1)}%</div>
                                  </div>
                                  <div className="bg-slate-100 dark:bg-slate-900 p-2 rounded-lg">
                                      <div className="text-[10px] text-slate-500 uppercase">Target</div>
                                      <div className="flex items-center justify-center gap-1">
                                          <input 
                                            type="number" 
                                            className="w-8 bg-transparent text-center text-slate-900 dark:text-white font-bold focus:outline-none border-b border-slate-300 dark:border-slate-700 focus:border-brand-500"
                                            value={targetPct}
                                            onChange={(e) => handleTargetChange(h.id, e.target.value)}
                                          />
                                          <span className="text-xs text-slate-500">%</span>
                                      </div>
                                  </div>
                                  <div className="bg-slate-100 dark:bg-slate-900 p-2 rounded-lg">
                                      <div className="text-[10px] text-slate-500 uppercase">Drift</div>
                                      <div className={`font-bold ${drift > 0 ? 'text-amber-500' : 'text-blue-500'}`}>
                                          {drift > 0 ? '+' : ''}{drift.toFixed(1)}%
                                      </div>
                                  </div>
                              </div>

                              <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                                  <div className="text-xs font-mono text-slate-600 dark:text-slate-300">
                                      Value Diff: <span className={diffValue > 0 ? 'text-emerald-500' : 'text-red-500'}>{diffValue > 0 ? '+' : ''}${Math.round(diffValue).toLocaleString()}</span>
                                  </div>
                                  {Math.abs(diffValue) > 100 && (
                                      <button className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 ${
                                          diffValue > 0 ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
                                      }`}>
                                          <RefreshCcw className="w-3 h-3" /> {diffValue > 0 ? 'Buy' : 'Sell'}
                                      </button>
                                  )}
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      )}

      {/* HOLDINGS & OVERVIEW */}
      {viewMode === 'holdings' && (
          <div className="space-y-8 animate-fade-in">
              
              {/* Portfolio Analysis Header */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Snowflake Summary */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col items-center text-center relative overflow-hidden shadow-sm">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-500 to-indigo-500"></div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                          Portfolio Health
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Aggregate score based on holdings weight</p>
                      <div className="w-[180px] h-[140px] -my-2">
                          <SnowflakeChart data={portfolioSnowflake} height={180} />
                      </div>
                      <div className="mt-2 flex items-center gap-2 bg-slate-100 dark:bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
                          <span className="text-xs text-slate-500 font-bold uppercase">Total Score</span>
                          <span className="text-xl font-bold text-slate-900 dark:text-white">{portfolioSnowflake.total}/25</span>
                      </div>
                  </div>

                  {/* Summary Stats */}
                  <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-xl flex flex-col justify-between shadow-sm">
                           <div className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase mb-1">Market Value</div>
                           <div className="text-2xl font-bold text-slate-900 dark:text-white">${activePortfolio.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                           <div className="text-emerald-500 text-xs flex items-center gap-1 mt-1"><TrendingUp className="w-3 h-3" /> +12.4%</div>
                      </div>
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-xl flex flex-col justify-between shadow-sm">
                           <div className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase mb-1">Cash</div>
                           <div className="text-2xl font-bold text-slate-900 dark:text-white">${activePortfolio.cashBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                           <div className="text-slate-500 text-xs mt-1">Available</div>
                      </div>
                       <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-xl flex flex-col justify-between shadow-sm">
                           <div className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase mb-1">Div Yield</div>
                           <div className="text-2xl font-bold text-slate-900 dark:text-white">
                               {(activePortfolio.totalValue > 0 ? holdings.reduce((a,b) => a + (b.dividendYield * (b.shares * b.currentPrice)), 0) / activePortfolio.totalValue : 0).toFixed(2)}%
                           </div>
                           <div className="text-emerald-500 text-xs mt-1">Income focus</div>
                      </div>
                       <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-xl flex flex-col justify-between shadow-sm">
                           <div className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase mb-1">Holdings</div>
                           <div className="text-2xl font-bold text-slate-900 dark:text-white">{holdings.length}</div>
                           <div className="text-slate-500 text-xs mt-1">Assets</div>
                      </div>
                  </div>
              </div>

              {/* Holdings List Controls */}
              <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Holdings</h2>
                  <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
                        <button 
                            onClick={() => setHoldingViewType('list')}
                            className={`p-2 rounded transition-colors ${holdingViewType === 'list' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                        >
                            <List className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => setHoldingViewType('cards')}
                            className={`p-2 rounded transition-colors ${holdingViewType === 'cards' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                  </div>
              </div>

              {/* CARD VIEW */}
              {holdingViewType === 'cards' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {holdings.map(h => {
                          const valuation = getValuationStatus(h);
                          const value = (h.shares || 0) * (h.currentPrice || 0);
                          const pl = value - ((h.shares || 0) * (h.avgPrice || 0));
                          const plPercent = ((h.shares || 0) * (h.avgPrice || 0)) > 0 ? (pl / ((h.shares || 0) * (h.avgPrice || 0))) * 100 : 0;

                          return (
                              <div key={h.id} onClick={() => viewStock(h.symbol)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden hover:border-brand-500/50 transition-all cursor-pointer group flex flex-col shadow-sm">
                                  {/* Card Header */}
                                  <div className="p-5 flex justify-between items-start border-b border-slate-100 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-950/30">
                                      <div className="flex items-center gap-3 max-w-[70%]">
                                          {h.logoUrl ? (
                                              <img src={h.logoUrl} alt={h.symbol} className="w-10 h-10 rounded-lg bg-white p-1 shrink-0 border border-slate-200 dark:border-slate-700" />
                                          ) : (
                                              <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm font-bold text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shrink-0">
                                                  {h.symbol[0]}
                                              </div>
                                          )}
                                          <div className="overflow-hidden">
                                              <div className="font-bold text-slate-900 dark:text-white text-lg leading-none truncate">{h.symbol}</div>
                                              <div className="text-xs text-slate-500 mt-1 truncate">{h.name}</div>
                                          </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                          <button onClick={(e) => openEditModal(e, h)} className="p-1.5 text-slate-400 hover:text-brand-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors">
                                              <Pencil className="w-4 h-4" />
                                          </button>
                                          <button onClick={(e) => handleDelete(e, h.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors">
                                              <Trash2 className="w-4 h-4" />
                                          </button>
                                      </div>
                                  </div>

                                  {/* Card Body */}
                                  <div className="p-5 grid grid-cols-2 gap-4 flex-1">
                                      <div className="space-y-4">
                                          <div>
                                              <div className="text-xs text-slate-500">Price</div>
                                              <div className="font-bold text-slate-900 dark:text-white">${h.currentPrice.toLocaleString()}</div>
                                          </div>
                                          <div>
                                              <div className="text-xs text-slate-500">Return</div>
                                              <div className={`font-bold flex items-center gap-1 ${pl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                                  {pl >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                                  {plPercent.toFixed(1)}%
                                              </div>
                                          </div>
                                          <div>
                                              <div className="text-xs text-slate-500">Value</div>
                                              <div className="font-bold text-slate-900 dark:text-white">${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                          </div>
                                      </div>
                                      
                                      {/* Snowflake Mini Chart */}
                                      <div className="relative flex flex-col items-center justify-center">
                                          <div className="w-full h-24">
                                              <SnowflakeChart data={h.snowflake || { value: 3, future: 3, past: 3, health: 3, dividend: 3, total: 15 }} height={100} />
                                          </div>
                                          <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mt-1">Health Score: <span className="text-slate-900 dark:text-white font-bold">{h.snowflake?.total || 15}</span></div>
                                      </div>
                                  </div>
                                  
                                  {/* Footer Metrics */}
                                  <div className="px-5 py-3 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-2">
                                      <div className="text-center border-r border-slate-200 dark:border-slate-800/50">
                                          <div className="text-[10px] text-slate-500 uppercase">Yield</div>
                                          <div className="text-xs font-bold text-emerald-500">{h.dividendYield}%</div>
                                      </div>
                                      <div className="text-center border-r border-slate-200 dark:border-slate-800/50">
                                          <div className="text-[10px] text-slate-500 uppercase">P/E</div>
                                          <div className="text-xs font-bold text-slate-700 dark:text-slate-300">24.5x</div>
                                      </div>
                                      <div className="text-center">
                                          <div className="text-[10px] text-slate-500 uppercase">Mkt Cap</div>
                                          <div className="text-xs font-bold text-slate-700 dark:text-slate-300">$2.8T</div>
                                      </div>
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              )}

              {/* LIST VIEW (TABLE with Sort) */}
              {holdingViewType === 'list' && (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 uppercase text-xs font-semibold border-b border-slate-200 dark:border-slate-800">
                                <tr>
                                    <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors group" onClick={() => handleSort('symbol')}>
                                        <div className="flex items-center gap-1">
                                            Stock <SortIcon columnKey="symbol" />
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors group" onClick={() => handleSort('snowflake')}>
                                        <div className="flex items-center justify-center gap-1">
                                            Health <SortIcon columnKey="snowflake" />
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors group" onClick={() => handleSort('currentPrice')}>
                                        <div className="flex items-center justify-end gap-1">
                                            Price <SortIcon columnKey="currentPrice" />
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors group" onClick={() => handleSort('return')}>
                                        <div className="flex items-center justify-end gap-1">
                                            Return <SortIcon columnKey="return" />
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors group" onClick={() => handleSort('value')}>
                                        <div className="flex items-center justify-end gap-1">
                                            Value <SortIcon columnKey="value" />
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 text-center">Valuation</th>
                                    <th className="px-6 py-4 text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors group" onClick={() => handleSort('value')}>
                                        <div className="flex items-center justify-end gap-1">
                                            Alloc. <SortIcon columnKey="value" />
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                {sortedHoldings.map((h) => {
                                    const value = (h.shares || 0) * (h.currentPrice || 0);
                                    const costBasis = (h.shares || 0) * (h.avgPrice || 0);
                                    const pl = value - costBasis;
                                    const plPercent = costBasis > 0 ? (pl / costBasis) * 100 : 0;
                                    const weight = activePortfolio.totalValue > 0 ? (value / activePortfolio.totalValue) * 100 : 0;
                                    const valuation = getValuationStatus(h);
                                    const snowflakeTotal = h.snowflake?.total || 15;

                                    return (
                                        <tr 
                                            key={h.id} 
                                            onClick={() => viewStock(h.symbol)}
                                            className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer"
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    {h.logoUrl ? (
                                                        <img src={h.logoUrl} alt={h.symbol} className="w-8 h-8 rounded-md bg-white p-0.5 border border-slate-200 dark:border-slate-700" />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500 border border-slate-200 dark:border-slate-700">
                                                            {h.symbol[0]}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <div className="font-bold text-slate-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">{h.symbol}</div>
                                                        <div className="text-slate-500 text-xs truncate max-w-[120px]">{h.name}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex flex-col items-center">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border ${snowflakeTotal >= 20 ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30' : snowflakeTotal >= 15 ? 'bg-brand-100 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 border-brand-200 dark:border-brand-500/30' : 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30'}`}>
                                                        {snowflakeTotal}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right font-medium text-slate-700 dark:text-slate-200">
                                                ${h.currentPrice.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className={`font-bold ${pl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                                    {pl >= 0 ? '+' : ''}{plPercent.toFixed(2)}%
                                                </div>
                                                <div className="text-xs text-slate-500">
                                                    ${pl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-slate-900 dark:text-white">
                                                ${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`text-[10px] px-2 py-1 rounded font-bold border ${valuation.bg} ${valuation.color} border-${valuation.color.split('-')[1]}-500/20`}>
                                                    {valuation.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="text-sm text-slate-700 dark:text-slate-300 font-medium">{weight.toFixed(1)}%</div>
                                                <div className="w-16 bg-slate-100 dark:bg-slate-800 rounded-full h-1 ml-auto mt-1">
                                                    <div className="bg-brand-500 h-full rounded-full" style={{ width: `${Math.min(weight, 100)}%` }}></div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button onClick={(e) => openEditModal(e, h)} className="p-1.5 text-slate-400 hover:text-brand-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors">
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={(e) => handleDelete(e, h.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                  </div>
              )}

              {/* MANUAL ASSETS LIST */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm mt-8">
                  <div className="p-4 bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <h3 className="font-bold text-slate-900 dark:text-white text-lg flex items-center gap-2">
                          <Home className="w-5 h-5 text-slate-400" /> Manual & Alternative Assets
                      </h3>
                  </div>
                  <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                          <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 uppercase text-xs font-semibold border-b border-slate-200 dark:border-slate-800">
                              <tr>
                                  <th className="px-6 py-4">Asset</th>
                                  <th className="px-6 py-4 text-right">Original Value</th>
                                  <th className="px-6 py-4 text-right">Converted (USD)</th>
                                  <th className="px-6 py-4 text-right">Performance</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                              {manualAssets.map((asset) => {
                                  const valInUSD = convertToUSD(asset.value, asset.currency || 'USD');
                                  const gain = asset.purchasePrice ? asset.value - asset.purchasePrice : 0;
                                  const gainPct = asset.purchasePrice ? (gain / asset.purchasePrice) * 100 : 0;

                                  return (
                                      <tr key={asset.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                          <td className="px-6 py-4">
                                              <div className="flex items-center gap-3">
                                                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400">
                                                      {getAssetIcon(asset.type)}
                                                  </div>
                                                  <div>
                                                      <div className="font-bold text-slate-900 dark:text-white">{asset.name}</div>
                                                      <div className="text-xs text-slate-500">{asset.type}</div>
                                                  </div>
                                              </div>
                                          </td>
                                          <td className="px-6 py-4 text-right text-slate-700 dark:text-slate-300">
                                              {asset.value.toLocaleString()} {asset.currency}
                                          </td>
                                          <td className="px-6 py-4 text-right font-bold text-slate-900 dark:text-white">
                                              ${valInUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                          </td>
                                          <td className="px-6 py-4 text-right">
                                              {asset.purchasePrice ? (
                                                  <div className={`font-bold ${gain >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                                      {gain >= 0 ? '+' : ''}{gainPct.toFixed(1)}%
                                                  </div>
                                              ) : (
                                                  <span className="text-slate-500">-</span>
                                              )}
                                          </td>
                                      </tr>
                                  );
                              })}
                              {manualAssets.length === 0 && (
                                  <tr>
                                      <td colSpan={4} className="text-center py-8 text-slate-500">No manual assets recorded.</td>
                                  </tr>
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}

      {/* TRANSACTIONS VIEW */}
      {viewMode === 'transactions' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm animate-fade-in">
              <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 uppercase text-xs font-semibold border-b border-slate-200 dark:border-slate-800">
                          <tr>
                              <th className="px-6 py-4">Date</th>
                              <th className="px-6 py-4">Type</th>
                              <th className="px-6 py-4">Asset</th>
                              <th className="px-6 py-4 text-right">Quantity</th>
                              <th className="px-6 py-4 text-right">Price</th>
                              <th className="px-6 py-4 text-right">Total Value</th>
                              <th className="px-6 py-4 text-center">Status</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                          {transactions.map((tx) => (
                              <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                  <td className="px-6 py-4 text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">{tx.date}</td>
                                  <td className="px-6 py-4">
                                      <span className={`px-2 py-1 rounded text-xs font-bold border ${
                                          tx.type === 'BUY' ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20' : 
                                          tx.type === 'SELL' ? 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20' :
                                          'bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20'
                                      }`}>
                                          {tx.type}
                                      </span>
                                  </td>
                                  <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{tx.symbol}</td>
                                  <td className="px-6 py-4 text-right text-slate-700 dark:text-slate-300">{tx.shares}</td>
                                  <td className="px-6 py-4 text-right text-slate-500 dark:text-slate-400">${tx.price.toLocaleString()}</td>
                                  <td className="px-6 py-4 text-right font-bold text-slate-800 dark:text-slate-200">${tx.totalValue.toLocaleString()}</td>
                                  <td className="px-6 py-4 text-center">
                                      <span className="text-xs text-emerald-500 flex items-center justify-center gap-1">
                                          ● Executed
                                      </span>
                                  </td>
                              </tr>
                          ))}
                          {transactions.length === 0 && (
                              <tr>
                                  <td colSpan={7} className="text-center py-12 text-slate-500">
                                      No transactions recorded yet.
                                  </td>
                              </tr>
                          )}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* Edit Holding Modal */}
      {editingHolding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
                  <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-brand-600 flex items-center justify-center font-bold text-white shadow-lg">
                              {editingHolding.symbol[0]}
                          </div>
                          <div>
                              <h3 className="text-xl font-bold text-white">Edit {editingHolding.symbol}</h3>
                              <div className="text-xs text-slate-400">{editingHolding.name}</div>
                          </div>
                      </div>
                      <button onClick={closeEditModal} className="text-slate-400 hover:text-white transition-colors">
                          <X className="w-5 h-5" />
                      </button>
                  </div>
                  <form onSubmit={saveHoldingEdit} className="p-6 space-y-5">
                      <div>
                          <label className="block text-sm font-medium text-slate-400 mb-1.5">Total Shares</label>
                          <input 
                              type="number" 
                              step="any"
                              required
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none"
                              value={editShares}
                              onChange={e => setEditShares(e.target.value)}
                          />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-slate-400 mb-1.5">Average Buy Price ($)</label>
                          <input 
                              type="number" 
                              step="any"
                              required
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none"
                              value={editAvgPrice}
                              onChange={e => setEditAvgPrice(e.target.value)}
                          />
                      </div>
                      
                      <div className="pt-2 flex gap-3">
                          <button 
                              type="button" 
                              onClick={closeEditModal}
                              className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-colors"
                          >
                              Cancel
                          </button>
                          <button 
                              type="submit"
                              className="flex-1 px-4 py-3 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                          >
                              <Save className="w-4 h-4" /> Save Changes
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};

export default PortfolioView;
