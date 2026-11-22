// Curated browsing universes for the Market Explorer. Any other ticker can still be opened via search.

export interface UniverseItem {
  symbol: string;
  name: string;
}

export interface UniverseCategory {
  id: string;
  label: string;
  items: UniverseItem[];
}

export const UNIVERSE: UniverseCategory[] = [
  {
    id: 'us_large',
    label: 'US Large Cap',
    items: [
      { symbol: 'AAPL', name: 'Apple' },
      { symbol: 'MSFT', name: 'Microsoft' },
      { symbol: 'NVDA', name: 'NVIDIA' },
      { symbol: 'GOOGL', name: 'Alphabet' },
      { symbol: 'AMZN', name: 'Amazon' },
      { symbol: 'META', name: 'Meta Platforms' },
      { symbol: 'TSLA', name: 'Tesla' },
      { symbol: 'BRK-B', name: 'Berkshire Hathaway' },
      { symbol: 'JPM', name: 'JPMorgan Chase' },
      { symbol: 'V', name: 'Visa' },
      { symbol: 'UNH', name: 'UnitedHealth' },
      { symbol: 'XOM', name: 'Exxon Mobil' },
      { symbol: 'LLY', name: 'Eli Lilly' },
      { symbol: 'WMT', name: 'Walmart' },
      { symbol: 'AVGO', name: 'Broadcom' },
    ],
  },
  {
    id: 'etf',
    label: 'Broad ETFs',
    items: [
      { symbol: 'SPY', name: 'SPDR S&P 500' },
      { symbol: 'QQQ', name: 'Invesco Nasdaq 100' },
      { symbol: 'DIA', name: 'SPDR Dow Jones' },
      { symbol: 'IWM', name: 'iShares Russell 2000' },
      { symbol: 'VTI', name: 'Vanguard Total Market' },
      { symbol: 'EFA', name: 'iShares MSCI EAFE' },
      { symbol: 'EEM', name: 'iShares MSCI Emerging' },
      { symbol: 'TLT', name: 'iShares 20+ Yr Treasury' },
      { symbol: 'LQD', name: 'iShares IG Corporate Bond' },
      { symbol: 'HYG', name: 'iShares High Yield Bond' },
    ],
  },
  {
    id: 'sectors',
    label: 'Sector ETFs',
    items: [
      { symbol: 'XLK', name: 'Technology' },
      { symbol: 'XLF', name: 'Financials' },
      { symbol: 'XLE', name: 'Energy' },
      { symbol: 'XLV', name: 'Health Care' },
      { symbol: 'XLY', name: 'Consumer Discretionary' },
      { symbol: 'XLP', name: 'Consumer Staples' },
      { symbol: 'XLI', name: 'Industrials' },
      { symbol: 'XLU', name: 'Utilities' },
      { symbol: 'XLB', name: 'Materials' },
      { symbol: 'XLRE', name: 'Real Estate' },
      { symbol: 'XLC', name: 'Communication Services' },
    ],
  },
  {
    id: 'indices',
    label: 'Indices',
    items: [
      { symbol: '^GSPC', name: 'S&P 500' },
      { symbol: '^NDX', name: 'Nasdaq 100' },
      { symbol: '^DJI', name: 'Dow Jones Industrial' },
      { symbol: '^RUT', name: 'Russell 2000' },
      { symbol: '^VIX', name: 'CBOE Volatility' },
      { symbol: '^FTSE', name: 'FTSE 100' },
      { symbol: '^N225', name: 'Nikkei 225' },
      { symbol: '^NSEI', name: 'Nifty 50' },
    ],
  },
  {
    id: 'crypto',
    label: 'Crypto',
    items: [
      { symbol: 'BTC-USD', name: 'Bitcoin' },
      { symbol: 'ETH-USD', name: 'Ethereum' },
      { symbol: 'SOL-USD', name: 'Solana' },
      { symbol: 'XRP-USD', name: 'XRP' },
      { symbol: 'ADA-USD', name: 'Cardano' },
      { symbol: 'DOGE-USD', name: 'Dogecoin' },
    ],
  },
  {
    id: 'commodities',
    label: 'Commodities',
    items: [
      { symbol: 'GC=F', name: 'Gold futures' },
      { symbol: 'SI=F', name: 'Silver futures' },
      { symbol: 'CL=F', name: 'WTI crude oil' },
      { symbol: 'NG=F', name: 'Natural gas' },
      { symbol: 'HG=F', name: 'Copper' },
      { symbol: 'ZC=F', name: 'Corn' },
    ],
  },
  {
    id: 'fx',
    label: 'FX',
    items: [
      { symbol: 'EURUSD=X', name: 'EUR / USD' },
      { symbol: 'GBPUSD=X', name: 'GBP / USD' },
      { symbol: 'USDJPY=X', name: 'USD / JPY' },
      { symbol: 'USDINR=X', name: 'USD / INR' },
      { symbol: 'AUDUSD=X', name: 'AUD / USD' },
    ],
  },
];
