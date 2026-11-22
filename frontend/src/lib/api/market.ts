// Symbol-agnostic market data client (any ticker). No mock fallbacks: errors propagate to the UI.
import { apiClient } from '@/lib/api';

export type Freshness = 'live' | 'delayed' | 'historical' | 'demo';

export interface Candle {
  time: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface HistoryResponse {
  symbol: string;
  period: string;
  interval: string;
  source: string;
  freshness: Freshness;
  candles: Candle[];
}

export interface Quote {
  symbol: string;
  price?: number;
  change?: number;
  change_pct?: number;
  volume?: number;
  spark?: number[];
  as_of?: string;
  error?: string;
}

export interface SearchResult {
  symbol: string;
  name: string;
  exchange?: string;
  type?: string;
}

export interface Performance {
  symbol: string;
  source: string;
  last: number;
  returns_pct: Record<string, number | null>;
  high_52w: number;
  low_52w: number;
  pct_from_high_52w: number | null;
  volatility_1y_pct: number | null;
  max_drawdown_1y_pct: number;
  observations: number;
}

export interface Profile {
  symbol: string;
  name: string | null;
  quote_type: string | null;
  exchange: string | null;
  currency: string | null;
  sector: string | null;
  industry: string | null;
  country: string | null;
  market_cap: number | null;
  trailing_pe: number | null;
  forward_pe: number | null;
  dividend_yield_pct: number | null;
  beta: number | null;
  avg_volume: number | null;
  employees: number | null;
  website: string | null;
  summary: string | null;
}

export const MarketAPI = {
  async performance(symbol: string): Promise<Performance> {
    const res = await apiClient.get<Performance>(`/market/performance/${encodeURIComponent(symbol)}`, { timeout: 40000 });
    return res.data;
  },
  async profile(symbol: string): Promise<Profile> {
    const res = await apiClient.get<Profile>(`/market/profile/${encodeURIComponent(symbol)}`, { timeout: 40000 });
    return res.data;
  },
  async history(symbol: string, period: string, interval: string): Promise<HistoryResponse> {
    const res = await apiClient.get<HistoryResponse>(`/market/history/${encodeURIComponent(symbol)}`, {
      params: { period, interval },
      timeout: 30000,
    });
    return res.data;
  },
  async quotes(symbols: string[]): Promise<Quote[]> {
    const res = await apiClient.get<{ quotes: Quote[] }>('/market/quotes', {
      params: { symbols: symbols.join(',') },
      timeout: 40000,
    });
    return res.data.quotes;
  },
  async search(q: string): Promise<SearchResult[]> {
    const res = await apiClient.get<{ results: SearchResult[] }>('/market/search', { params: { q } });
    return res.data.results;
  },
  async health(): Promise<{ api: boolean; db: boolean }> {
    const [api, db] = await Promise.all([
      apiClient.get('/health').then(() => true).catch(() => false),
      apiClient.get('/health/db').then(() => true).catch(() => false),
    ]);
    return { api, db };
  },
};
