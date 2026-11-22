// Typed clients for technicals, seasonality, macro and options. No mock fallbacks: failures reach the UI.
import { apiClient } from '@/lib/api';

export interface TechCandle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TechnicalsResult {
  symbol: string;
  source: string;
  freshness?: string;
  dates: string[];
  candles: TechCandle[];
  sma20: (number | null)[];
  sma50: (number | null)[];
  sma200: (number | null)[];
  bb_upper: (number | null)[];
  bb_lower: (number | null)[];
  rsi: (number | null)[];
  macd: (number | null)[];
  macd_signal: (number | null)[];
  macd_hist: (number | null)[];
  summary: {
    last_close: number;
    trend_vs_sma50: string | null;
    trend_vs_sma200: string | null;
    golden_cross_state: string | null;
    rsi_14: number | null;
    rsi_state: string | null;
    macd_state: string | null;
    last_macd_cross: { date: string; direction: string; bars_ago: number } | null;
    bollinger_pct_b: number | null;
    atr_14: number | null;
    atr_pct: number | null;
    volume_vs_20d_avg: number | null;
    high_52w: number;
    low_52w: number;
  };
}

export interface SeasonMonth {
  month: string;
  month_num: number;
  samples: number;
  avg_return_pct: number;
  median_return_pct: number;
  std_pct: number | null;
  win_rate_pct: number;
  best_pct: number;
  worst_pct: number;
  t_stat: number | null;
  significant_5pct: boolean;
}

export interface SeasonalityResult {
  symbol: string;
  source: string;
  months: SeasonMonth[];
  heatmap: { year: number; months: (number | null)[] }[];
  best_month: string;
  worst_month: string;
  n_months: number;
  first_month: string;
  last_month: string;
  overall_win_rate_pct: number;
  n_significant: number;
}

export interface DatedValue {
  date: string;
  value: number;
}

export interface MacroResult {
  curve: {
    as_of: string | null;
    points: { maturity: string; yield_pct: number; date: string; month_ago_pct: number | null; year_ago_pct: number | null }[];
  };
  spread_2s10s: DatedValue[];
  spread_3m10y: DatedValue[];
  spread_2s10s_now: { value: number; date: string; state: string };
  unemployment: { series: DatedValue[]; latest: DatedValue | null };
  sahm: { series: DatedValue[]; latest: DatedValue | null; threshold: number; triggered: boolean };
  recession_probability: { series: DatedValue[]; latest: DatedValue | null; note: string };
  fed_funds: DatedValue | null;
  inflation_yoy: DatedValue | null;
  sources: string;
}

export interface OptionStrike {
  strike: number;
  call_oi: number;
  put_oi: number;
  call_volume: number;
  put_volume: number;
  call_iv: number | null;
  put_iv: number | null;
  gex: number;
  dex: number;
}

export interface OptionsResult {
  symbol: string;
  expiration: string;
  expirations: { date: string; days: number }[];
  spot: number;
  days_to_expiry: number;
  atm_iv: number | null;
  expected_move_1sd: number | null;
  expected_move_pct: number | null;
  put_call_oi_ratio: number | null;
  put_call_volume_ratio: number | null;
  total_call_oi: number;
  total_put_oi: number;
  net_gex: number;
  net_dex: number;
  gamma_flip: number | null;
  call_wall: number | null;
  put_wall: number | null;
  max_pain: number | null;
  skew_put90_minus_call110: number | null;
  strikes: OptionStrike[];
  term_structure: { expiration: string; days: number; atm_iv: number | null; expected_move_pct: number | null; put_call_oi_ratio: number | null }[];
  risk_free_rate: number;
  risk_free_source: string;
  source: string;
  freshness: string;
  assumptions: string;
}

export const AnalysisAPI = {
  async technicals(symbol: string, years: number): Promise<TechnicalsResult> {
    return (await apiClient.get<TechnicalsResult>(`/analysis/technicals/${encodeURIComponent(symbol)}`, { params: { years }, timeout: 60000 })).data;
  },
  async seasonality(symbol: string): Promise<SeasonalityResult> {
    return (await apiClient.get<SeasonalityResult>(`/analysis/seasonality/${encodeURIComponent(symbol)}`, { timeout: 60000 })).data;
  },
  async macro(): Promise<MacroResult> {
    return (await apiClient.get<MacroResult>('/analysis/macro', { timeout: 90000 })).data;
  },
  async options(symbol: string, expiration?: string): Promise<OptionsResult> {
    return (
      await apiClient.get<OptionsResult>(`/analysis/options/${encodeURIComponent(symbol)}`, { params: expiration ? { expiration } : {}, timeout: 120000 })
    ).data;
  },
};
