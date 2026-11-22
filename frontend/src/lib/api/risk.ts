// Typed risk + optimisation clients. No mock fallbacks: failures are surfaced to the UI.
import { apiClient } from '@/lib/api';

export interface SeriesPoint {
  date: string;
  value: number;
}

export interface VarPair {
  historical: number | null;
  parametric: number | null;
}

export interface BenchmarkStats {
  observations: number;
  beta: number | null;
  alpha_annual: number | null;
  correlation: number | null;
  tracking_error: number | null;
  r_squared: number | null;
}

export interface CorrelationData {
  symbols: string[];
  matrix: (number | null)[][];
  observations?: number;
}

export interface HistogramBin {
  lo: number;
  hi: number;
  mid: number;
  count: number;
}

export interface RiskReport {
  symbol: string;
  observations: number;
  start: string;
  end: string;
  annualized_return: number | null;
  annualized_volatility: number | null;
  sharpe_ratio: number | null;
  sortino_ratio: number | null;
  calmar_ratio: number | null;
  max_drawdown: number | null;
  max_drawdown_peak: string;
  max_drawdown_trough: string;
  skewness: number | null;
  excess_kurtosis: number | null;
  best_day: number | null;
  worst_day: number | null;
  var: Record<'90' | '95' | '99', VarPair>;
  cvar_95: number | null;
  drawdown_curve: SeriesPoint[];
  rolling_volatility: SeriesPoint[];
  histogram: HistogramBin[];
  benchmark: BenchmarkStats | null;
  benchmark_symbol: string | null;
  correlation: CorrelationData | null;
  data_source: string;
}

export interface RiskReportRequest {
  symbol: string;
  benchmark?: string;
  years: number;
  risk_free_rate: number;
  peers: string[];
}

export interface PortfolioResult {
  weights: Record<string, number>;
  expected_return: number;
  volatility: number;
  sharpe_ratio: number;
  risk_contribution: Record<string, number>;
}

export interface FrontierPoint {
  return: number;
  volatility: number;
  sharpe: number;
}

export interface FrontierResult {
  symbols: string[];
  observations: number;
  start: string;
  end: string;
  risk_free_rate: number;
  max_weight: number;
  equal_weight: PortfolioResult;
  max_sharpe: PortfolioResult;
  min_volatility: PortfolioResult;
  frontier: FrontierPoint[];
  assets: { symbol: string; expected_return: number; volatility: number }[];
  correlation: CorrelationData;
  data_source: string;
}

export interface FrontierRequest {
  symbols: string[];
  years: number;
  risk_free_rate: number;
  max_weight: number;
}

export async function fetchRiskReport(req: RiskReportRequest): Promise<RiskReport> {
  const res = await apiClient.post<RiskReport>('/risk/report', req, { timeout: 90000 });
  return res.data;
}

export async function fetchFrontier(req: FrontierRequest): Promise<FrontierResult> {
  const res = await apiClient.post<FrontierResult>('/portfolio/frontier', req, { timeout: 120000 });
  return res.data;
}

export function apiErrorMessage(e: unknown): string {
  const err = e as { response?: { status?: number; data?: { detail?: unknown } }; message?: string };
  const detail = err.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join('; ');
  return err.message?.includes('timeout')
    ? 'The request timed out. Try fewer symbols or a shorter lookback.'
    : 'Could not reach the backend. Is the API running on port 8000?';
}
