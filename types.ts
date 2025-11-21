
export enum AssetType {
  STOCK = 'Stock',
  ETF = 'ETF',
  CRYPTO = 'Crypto',
  CASH = 'Cash'
}

export type ManualAssetType = 'Real Estate' | 'Vehicle' | 'Art/Collectibles' | 'Private Equity' | 'Other';

export interface ManualAsset {
  id: string;
  name: string;
  type: ManualAssetType;
  value: number;
  currency: string;
  purchaseDate?: string;
  purchasePrice?: number;
}

export interface Liability {
  id: string;
  name: string;
  type: 'Mortgage' | 'Loan' | 'Credit Card' | 'Other';
  amount: number;
  interestRate: number;
  monthlyPayment?: number;
}

export interface Dividend {
  symbol: string;
  amount: number;
  exDate: string;
  payDate: string;
  frequency: 'Monthly' | 'Quarterly' | 'Annually';
}

export interface SnowflakeScore {
  value: number;
  future: number;
  past: number;
  health: number;
  dividend: number;
  total: number; // 0-25
}

export interface FinancialHealthData {
  year: string;
  assets: number;
  liabilities: number;
  equity: number;
  debt: number;
}

export interface Competitor {
  symbol: string;
  name: string;
  marketCap: string;
  peRatio: number;
  dividendYield: number;
  revenueGrowth: number;
}

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  date: string;
  sentiment: 'Positive' | 'Negative' | 'Neutral';
  url: string;
  relatedSymbols: string[];
}

export interface Holding {
  id: string;
  symbol: string;
  name: string;
  shares: number;
  avgPrice: number;
  currentPrice: number;
  assetType: AssetType;
  sector: string;
  country: string; // New field for Geo Analytics
  dividendYield: number;
  expenseRatio?: number; // New field for Fee Analysis (e.g., 0.03 for VOO)
  safetyScore: number; // 0-100
  snowflake: SnowflakeScore;
  targetAllocation?: number; // 0-100% for rebalancing
  logoUrl?: string;
  // Extended Data for Research
  financials?: FinancialHealthData[];
  competitors?: Competitor[];
}

export interface Transaction {
  id: string;
  date: string;
  type: 'BUY' | 'SELL' | 'ADJUST';
  symbol: string;
  shares: number;
  price: number;
  totalValue: number;
}

export interface Portfolio {
  id: string;
  name: string;
  totalValue: number;
  cashBalance: number;
  holdings: Holding[];
  transactions: Transaction[];
  manualAssets?: ManualAsset[]; // New: Real Estate, Cars
  liabilities?: Liability[]; // New: Mortgages
}

export interface PortfolioSummary {
  id: string;
  name: string;
  type: 'Growth' | 'Income' | 'Speculative' | 'Stock' | 'Crypto' | 'Mixed';
}

export interface Watchlist {
  id: string;
  name: string;
  symbols: string[];
}

export interface SocialPost {
  id: string;
  user: string;
  avatar: string;
  content: string;
  timestamp: string;
  likes: number;
  comments: number;
  tickers: string[];
}

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'danger';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export interface AlertConfig {
  id: string;
  symbol: string;
  targetPrice: number;
  condition: 'ABOVE' | 'BELOW';
  createdAt: string;
  isActive: boolean;
}

export type ViewState = 'dashboard' | 'holdings' | 'dividends' | 'analytics' | 'research' | 'community' | 'settings' | 'admin' | 'networth' | 'knowledge-base';

// --- Auth & System Types ---

export type UserRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN';
export type PlanTier = 'Free' | 'Pro' | 'Ultimate';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  plan: PlanTier;
  avatar?: string;
  joinedDate: string;
}

export interface CryptoWallet {
  id: string;
  coin: string; // BTC, ETH, etc.
  network: string; // Bitcoin, ERC20, TRC20, etc.
  address: string;
  qrCodeUrl?: string; // Optional URL for QR image
  isEnabled: boolean;
}

export interface PlanLimits {
  portfolios: number; // -1 for unlimited
  holdings: number;   // -1 for unlimited
  connections: number; // Broker API connections, -1 for unlimited, 0 for manual only
  watchlists: number; // -1 for unlimited
}

export interface SubscriptionPlan {
  id: PlanTier;
  name: string;
  price: number;
  features: string[];
  limits: PlanLimits;
  description: string;
  isPopular?: boolean;
}

// Admin Managed Provider Template
export interface BrokerProvider {
  id: string;
  name: string;
  type: 'Stock' | 'Crypto' | 'Mixed';
  logo: string;
  isEnabled: boolean;
}

// User Specific Connection
export interface BrokerIntegration {
  id: string;
  providerId: string; // Links to BrokerProvider.id
  name: string;
  type: 'Stock' | 'Crypto' | 'Mixed';
  status: 'Connected' | 'Syncing' | 'Error';
  lastSync: string;
  logo: string;
  apiCredentials?: {
    apiKey: string;
    apiSecret?: string;
  };
}
