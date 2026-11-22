// Typed backtest client. No mock fallback: failures are surfaced to the UI.
import { apiClient } from '@/lib/api';

export type StrategyType = 'sma_crossover' | 'rsi_mean_reversion';

export interface BacktestRequest {
  symbol: string;
  strategy_type: StrategyType;
  initial_capital: number;
  short_window: number;
  long_window: number;
  start_date?: string;
  end_date?: string;
  cost_bps: number;
  benchmark?: string;
  rsi_low: number;
  rsi_high: number;
}

export interface BacktestMetrics {
  total_return_pct: number | null;
  cagr_pct: number | null;
  annual_volatility_pct: number | null;
  sharpe_ratio: number | null;
  sortino_ratio: number | null;
  max_drawdown_pct: number | null;
  calmar_ratio: number | null;
  total_trades: number;
  win_rate_pct: number | null;
  profit_factor: number | null;
  exposure_pct: number | null;
  buy_hold_return_pct: number | null;
  trading_days: number;
}

export interface BacktestPoint {
  date: string;
  price: number;
  signal: number;
  portfolio_value: number;
  strategy_return: number;
  drawdown: number;
  buy_hold_value: number | null;
  benchmark_value: number | null;
}

export interface BacktestTrade {
  entry_date: string;
  exit_date: string;
  entry_price: number;
  exit_price: number;
  return_pct: number;
  holding_days: number;
  open: boolean;
}

export interface BacktestResult {
  symbol: string;
  strategy_type: StrategyType;
  initial_capital: number;
  final_portfolio_value: number;
  total_return_pct: number;
  equity_curve: BacktestPoint[];
  metrics: BacktestMetrics;
  trades: BacktestTrade[];
  benchmark_symbol: string | null;
  benchmark_return_pct: number | null;
  params: Record<string, string | number | null>;
  data_source: string;
}

export async function runBacktest(req: BacktestRequest): Promise<BacktestResult> {
  const res = await apiClient.post<BacktestResult>('/strategies/backtest', req, { timeout: 90000 });
  return res.data;
}

export function backtestErrorMessage(e: unknown): string {
  const err = e as { response?: { status?: number; data?: { detail?: unknown } }; message?: string };
  const detail = err.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join('; ');
  if (err.response?.status === 404) return 'No market data found for this symbol.';
  return err.message?.includes('timeout')
    ? 'The backtest timed out. Try a shorter date range.'
    : 'Could not reach the backend. Is the API running on port 8000?';
}
