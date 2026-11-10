import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// TypeScript interfaces matching backend Pydantic schemas
export interface Instrument {
  symbol: string;
  name: string;
  asset_class: string;
  region: string;
  currency: string;
}

export interface MarketDataRecord {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adj_close: number;
  volume: number;
}

export interface FeatureRecord extends MarketDataRecord {
  simple_return: number;
  log_return: number;
  sma_20: number;
  sma_50: number;
  volatility_20d: number;
  rsi_14: number;
  macd: number;
  macd_signal: number;
}

export interface BacktestRequest {
  symbol: string;
  strategy_type: string;
  initial_capital: number;
  short_window: number;
  long_window: number;
}

export interface RiskAnalysisResponse {
  symbol: string;
  annualized_return: number;
  annualized_volatility: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  max_drawdown: number;
  var_95: number;
}

export interface OptimizationResponse {
  symbols: string[];
  equal_weight: any;
  max_sharpe: any;
  min_volatility: any;
}