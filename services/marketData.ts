
const COINGECKO_API = 'https://api.coingecko.com/api/v3';
const FINNHUB_API = 'https://finnhub.io/api/v1';
const TRADING212_API = 'https://live.trading212.com/api/v0';
const LOCAL_API = 'http://localhost:8000/api';

// Mock Exchange Rates
export const EXCHANGE_RATES: Record<string, number> = {
    'USD': 1,
    'EUR': 1.08,
    'GBP': 1.26,
    'JPY': 0.0067,
    'CAD': 0.73,
    'AUD': 0.65,
    'CHF': 1.10,
    'CNY': 0.14
};

export const convertToUSD = (amount: number, currency: string): number => {
    return amount * (EXCHANGE_RATES[currency] || 1);
};

// Map common symbols to CoinGecko IDs
const CRYPTO_MAP: Record<string, string> = {
    'BTC': 'bitcoin',
    'ETH': 'ethereum',
    'SOL': 'solana',
    'DOGE': 'dogecoin',
    'ADA': 'cardano',
    'XRP': 'ripple',
    'DOT': 'polkadot',
    'USDT': 'tether',
    'BNB': 'binancecoin',
    'MATIC': 'matic-network'
};

// Comprehensive Mock Data for Fallback/Testing
const MOCK_PRICES: Record<string, number> = {
    'AAPL': 178.35, 'MSFT': 335.20, 'O': 54.10, 'SCHD': 76.45, 'BTC': 62000,
    'SHEL': 68.50, 'ASML': 900.00, 'HIMX': 5.50, 'JPM': 145.20, 'JNJ': 155.00,
    'PG': 152.50, 'TSLA': 240.00, 'GOOGL': 135.00, 'KO': 58.00, 'MAIN': 41.50,
    'PEP': 168.00, 'V': 245.00, 'NVDA': 460.00, 'ABBV': 230.00, 'VOO': 410.00,
    'ARWK': 42.00, 'PLTR': 17.40, 'AMD': 102.33, 'COIN': 85.20, 'AMZN': 145.00, 'VUSA': 64.10
};

const getMockPrice = (symbol: string): number | null => {
    const base = MOCK_PRICES[symbol.toUpperCase()];
    if (!base) return null;
    // Add slight random jitter for liveness feel
    const volatility = 0.002; 
    const change = 1 + (Math.random() * volatility * 2 - volatility);
    return base * change;
};

export const fetchCryptoPrice = async (symbol: string): Promise<number | null> => {
    try {
        const id = CRYPTO_MAP[symbol.toUpperCase()];
        if (!id) return getMockPrice(symbol); // Fallback if not mapped
        
        const res = await fetch(`${COINGECKO_API}/simple/price?ids=${id}&vs_currencies=usd`);
        if (!res.ok) throw new Error("CoinGecko API Error");
        
        const data = await res.json();
        return data[id]?.usd || getMockPrice(symbol);
    } catch (e) {
        console.warn("CoinGecko fetch failed (using mock):", e);
        return getMockPrice(symbol);
    }
};

export const fetchStockPrice = async (symbol: string, apiKey: string): Promise<number | null> => {
    // 1. Try Local Python Backend First with Timeout
    // Using AbortController to timeout after 1 second so UI doesn't hang if backend is down
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1000);
        
        const localRes = await fetch(`${LOCAL_API}/price/${symbol}`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (localRes.ok) {
            const data = await localRes.json();
            if (data.price && data.price !== 'N/A') {
                return typeof data.price === 'number' ? data.price : parseFloat(data.price);
            }
        }
    } catch (e) {
        // Local backend likely not running or unreachable, proceed silently to fallback
    }

    // 2. Finnhub Fallback
    if (!apiKey) return getMockPrice(symbol);

    try {
        const res = await fetch(`${FINNHUB_API}/quote?symbol=${symbol}&token=${apiKey}`);
        
        if (res.status === 429) {
            console.warn(`Finnhub Rate Limit (429) for ${symbol}. Using mock.`);
            return getMockPrice(symbol);
        }
        if (res.status === 401 || res.status === 403) {
            console.warn("Finnhub API Key Invalid. Using mock.");
            return getMockPrice(symbol);
        }
        if (!res.ok) return getMockPrice(symbol);
        
        const data = await res.json();
        // Finnhub 'c' is current price. Ensure it's not 0.
        return data.c && data.c > 0 ? data.c : getMockPrice(symbol);
    } catch (e) {
        console.warn("Finnhub fetch failed (using mock):", e);
        return getMockPrice(symbol);
    }
};

export const fetchTrading212Positions = async (apiKey: string): Promise<any[]> => {
    if (!apiKey) {
        console.warn("Trading 212: No API Key provided.");
        return [];
    }
    
    try {
        console.log("Fetching Trading 212 Portfolio...");
        const res = await fetch(`${TRADING212_API}/equity/portfolio`, {
            headers: { 'Authorization': apiKey }
        });
        
        if (res.status === 401) {
            console.error("Trading 212 Error: Unauthorized (401). Check API Key.");
            return [];
        }
        
        if (!res.ok) {
            console.warn(`Trading 212 Fetch Error: ${res.status} ${res.statusText}`);
            return [];
        }
        
        const data = await res.json();
        return Array.isArray(data) ? data : [];
    } catch (e) {
        console.warn("Trading 212 Network Error (CORS blocked or offline). Returning realistic mock data for demo.");
        
        // FALLBACK FOR DEMO / CORS ISSUES
        return [
            { ticker: "IIPR_US_EQ", quantity: 155, averagePrice: 55.00, currentPrice: 55.00 },
            { ticker: "SBR_US_EQ", quantity: 250, averagePrice: 75.00, currentPrice: 78.00 },
            { ticker: "DHT_US_EQ", quantity: 350, averagePrice: 11.50, currentPrice: 11.80 },
            { ticker: "ABBV_US_EQ", quantity: 25, averagePrice: 225.00, currentPrice: 230.00 },
            { ticker: "RMR_US_EQ", quantity: 150, averagePrice: 15.50, currentPrice: 15.60 },
            { ticker: "CVX_US_EQ", quantity: 10, averagePrice: 152.00, currentPrice: 152.00 },
            { ticker: "VUSA_UK_EQ", quantity: 50, averagePrice: 62.20, currentPrice: 64.10 }
        ];
    }
};
