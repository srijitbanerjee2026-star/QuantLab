// Institutional Quantitative Research Workstation - Core Type Definitions

export type ModuleId =
  | 'explorer'
  | 'dashboard'
  | 'multi_asset'
  | 'technicals'
  | 'options_greeks'
  | 'macro'
  | 'seasonality'
  | 'ml_predictor'
  | 'experiments'
  | 'backtest'
  | 'risk_var'
  | 'optimizer';

export type DomainGroupId =
  | 'overview'
  | 'markets'
  | 'research'
  | 'portfolio'
  | 'strategies'
  | 'core_research'
  | 'portfolio_risk'
  | 'options_vol'
  | 'macroeconomics'
  | 'quant_labs';

export interface NavModule {
  id: ModuleId;
  label: string;
  shortLabel?: string;
  icon: string;
  badge?: string;
  description: string;
}

export interface NavDomainGroup {
  id: DomainGroupId;
  label: string;
  modules: NavModule[];
}

export type CacheState = 'hit' | 'fetching' | 'offline';

export interface CacheMetadata {
  state: CacheState;
  latencyMs: number;
  lastSync: string;
  rowCount?: number;
  source: string;
}

// ---------------- Market Data & Features ----------------

export interface FeaturePoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adj_close: number;
  volume: number;
  simple_return: number;
  log_return: number;
  sma_20: number;
  sma_50: number;
  volatility_20d: number;
  rsi_14: number;
  macd: number;
  macd_signal: number;
}

// ---------------- Multi-Asset Explorer ----------------

export interface CorrelationCell {
  x: string;
  y: string;
  value: number;
}

export interface CumulativeReturnPoint {
  date: string;
  [ticker: string]: number | string;
}

export interface PerformanceRankItem {
  symbol: string;
  return_pct: number;
  annualized_return: number;
  volatility: number;
}

export interface RollingSharpePoint {
  date: string;
  [ticker: string]: number | string;
}

export interface MultiAssetData {
  symbols: string[];
  correlationMatrix: CorrelationCell[];
  cumulativeReturns: CumulativeReturnPoint[];
  performanceRanking: PerformanceRankItem[];
  rollingSharpe: RollingSharpePoint[];
}

// ---------------- Options & Greeks ----------------

export interface StrikeDetail {
  strike: number;
  call_oi: number;
  put_oi: number;
  call_vol: number;
  put_vol: number;
  call_iv: number;
  put_iv: number;
  gex: number; // in $M (calls positive, puts negative)
  dex: number; // in $M
}

export interface OptionsData {
  symbol: string;
  spotPrice: number;
  gammaFlip: number;
  callWall: number;
  putWall: number;
  netGex: number;
  netDex: number;
  putCallRatio: number;
  atmIv: number;
  expirations: string[];
  selectedExpiration: string;
  strikes: StrikeDetail[];
  sparklines: {
    gex: number[];
    iv: number[];
    oi: number[];
  };
}

// ---------------- Macroeconomics ----------------

export interface YieldCurveMaturity {
  maturity: string;
  current: number;
  monthAgo: number;
  yearAgo: number;
}

export interface SpreadPoint {
  date: string;
  spread10y2y: number;
  spread10y3m: number;
  isRecession: boolean;
}

export interface SahmPoint {
  date: string;
  value: number;
  threshold: number;
}

export interface RecessionProbPoint {
  date: string;
  probability: number;
}

export interface MacroData {
  yieldCurve: YieldCurveMaturity[];
  spreadHistory: SpreadPoint[];
  sahmSeries: SahmPoint[];
  currentSahm: number;
  sahmTriggered: boolean;
  recessionSeries: RecessionProbPoint[];
  currentRecessionProb: number;
  tenYearYield: number;
  twoYearYield: number;
  currentSpread: number;
}

// ---------------- Quant Labs: Seasonality ----------------

export interface MonthDistribution {
  month: string;
  monthNum: number;
  median: number;
  q1: number;
  q3: number;
  min: number;
  max: number;
  winRate: number;
  avgReturn: number;
}

export interface YearMonthHeatmapCell {
  year: number;
  month: number;
  returnPct: number;
}

export interface SeasonalityData {
  symbol: string;
  monthlyDistribution: MonthDistribution[];
  yearMonthHeatmap: YearMonthHeatmapCell[];
  years: number[];
  bestMonth: string;
  worstMonth: string;
  overallWinRate: number;
}

// ---------------- Quant Labs: ML Predictor ----------------

export interface FeatureImportance {
  feature: string;
  importance: number;
}

export interface WalkForwardPoint {
  date: string;
  accuracy: number;
  baseline: number;
}

export interface MLPredictorData {
  symbol: string;
  modelType: 'Random Forest' | 'Logistic Regression' | 'Gradient Boosted';
  prediction: 'BUY' | 'SELL';
  confidence: number;
  accuracy: number;
  aucRoc: number;
  confusionMatrix: {
    truePositive: number;
    falsePositive: number;
    trueNegative: number;
    falseNegative: number;
  };
  featureImportance: FeatureImportance[];
  walkForward: WalkForwardPoint[];
}

// ---------------- Quant Labs: Experiments ----------------

export interface ExperimentItem {
  id: string;
  name: string;
  type: 'Backtest' | 'ML Classifier' | 'SLSQP Portfolio' | 'Risk Model';
  targetSymbol: string;
  sharpe: number;
  returnPct: number;
  maxDrawdown: number;
  status: 'COMPLETED' | 'ARCHIVED' | 'QUEUED';
  created_at: string;
  params: Record<string, string | number>;
  sparkline: number[];
}

// ---------------- Portfolio & Risk ----------------

export interface BacktestMetrics {
  totalReturnPct: number;
  cagr: number;
  annualizedVol: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  calmarRatio: number;
  winRate: number;
  totalTrades: number;
  profitFactor: number;
}

export interface EquityCurvePoint {
  date: string;
  portfolio: number;
  benchmark: number;
}

export interface DrawdownPoint {
  date: string;
  drawdown: number;
}

export interface BacktestData {
  symbol: string;
  metrics: BacktestMetrics;
  equityCurve: EquityCurvePoint[];
  drawdownCurve: DrawdownPoint[];
  monthlyReturns: { year: number; month: number; returnPct: number }[];
}

export interface HistogramBin {
  bin: string;
  count: number;
  returnVal: number;
  isVaR95: boolean;
  isVaR99: boolean;
}

export interface RiskAnalysisData {
  symbol: string;
  annualizedReturn: number;
  annualizedVolatility: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  var90: number;
  var95: number;
  var99: number;
  cvar95: number;
  histogram: HistogramBin[];
}

export interface FrontierPoint {
  volatility: number;
  returnPct: number;
  sharpe: number;
  isOptimal?: boolean;
  isMinVol?: boolean;
}

export interface PortfolioWeight {
  symbol: string;
  weight: number;
}

export interface PortfolioOptimizerData {
  symbols: string[];
  frontier: FrontierPoint[];
  maxSharpe: {
    expectedReturn: number;
    volatility: number;
    sharpe: number;
    weights: PortfolioWeight[];
  };
  minVol: {
    expectedReturn: number;
    volatility: number;
    sharpe: number;
    weights: PortfolioWeight[];
  };
}
