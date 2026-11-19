// Institutional-Grade Deterministic Mock Data Generators
// Seeded mathematical generators producing realistic, correlated financial series.

import {
  MultiAssetData,
  FeaturePoint,
  OptionsData,
  MacroData,
  SeasonalityData,
  MLPredictorData,
  ExperimentItem,
  BacktestData,
  RiskAnalysisData,
  PortfolioOptimizerData,
  StrikeDetail,
  CumulativeReturnPoint,
  RollingSharpePoint,
} from '@/types';

// Simple deterministic pseudo-random generator
function seededRandom(seed: number) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

// ---------------- 1. Multi-Asset Explorer Mock ----------------
export function getMockMultiAsset(symbols: string[]): MultiAssetData {
  const clean = symbols.map((s) => s.trim().toUpperCase()).filter(Boolean);
  const activeSymbols = clean.length > 0 ? clean : ['AAPL', 'MSFT', 'NVDA', 'SPY', 'GLD'];

  // Correlation Matrix
  const correlationMatrix = [];
  for (let i = 0; i < activeSymbols.length; i++) {
    for (let j = 0; j < activeSymbols.length; j++) {
      const s1 = activeSymbols[i];
      const s2 = activeSymbols[j];
      let val = 1.0;
      if (s1 !== s2) {
        const seed = s1.charCodeAt(0) * 17 + s2.charCodeAt(0) * 31;
        const raw = seededRandom(seed) * 1.4 - 0.4; // -0.4 to 1.0
        val = Math.round(raw * 100) / 100;
      }
      correlationMatrix.push({ x: s1, y: s2, value: val });
    }
  }

  // Cumulative Returns (last 90 trading days) starting at 0%
  const cumulativeReturns: CumulativeReturnPoint[] = [];
  const now = new Date();
  const days = 90;
  const prices: Record<string, number> = {};
  activeSymbols.forEach((s, idx) => {
    prices[s] = 100;
  });

  // Base cumulative point
  const firstDate = new Date(now.getTime() - days * 86400000).toISOString().slice(0, 10);
  const basePoint: CumulativeReturnPoint = { date: firstDate };
  activeSymbols.forEach((s) => (basePoint[s] = 0.0));
  cumulativeReturns.push(basePoint);

  const cumReturns: Record<string, number> = {};
  activeSymbols.forEach((s) => (cumReturns[s] = 0.0));

  for (let d = days - 1; d >= 0; d--) {
    const dateObj = new Date(now.getTime() - d * 86400000);
    // skip weekends
    if (dateObj.getDay() === 0 || dateObj.getDay() === 6) continue;
    const dateStr = dateObj.toISOString().slice(0, 10);

    const point: CumulativeReturnPoint = { date: dateStr };
    activeSymbols.forEach((s, idx) => {
      const seed = d * 13 + s.charCodeAt(0) * 29 + idx * 7;
      const dailyReturn = (seededRandom(seed) - 0.48) * 0.024;
      cumReturns[s] = Math.round((cumReturns[s] + dailyReturn * 100) * 100) / 100;
      point[s] = cumReturns[s];
    });
    cumulativeReturns.push(point);
  }

  // Performance Ranking
  const performanceRanking = activeSymbols
    .map((s, idx) => {
      const lastPoint = cumulativeReturns[cumulativeReturns.length - 1];
      const ret = typeof lastPoint[s] === 'number'
        ? (lastPoint[s] as number)
        : 12.4;
      return {
        symbol: s,
        return_pct: ret,
        annualized_return: Math.round(ret * 2.5 * 10) / 10,
        volatility: Math.round((14 + seededRandom(idx * 43) * 18) * 10) / 10,
      };
    })
    .sort((a, b) => b.return_pct - a.return_pct);

  // 90-day Rolling Sharpe
  const rollingSharpe: RollingSharpePoint[] = [];
  for (let i = 20; i < cumulativeReturns.length; i++) {
    const pt: RollingSharpePoint = { date: cumulativeReturns[i].date };
    activeSymbols.forEach((s, idx) => {
      const seed = i * 7 + s.charCodeAt(0) * 11;
      const baseSharpe = 0.85 + seededRandom(seed) * 1.1; // 0.85 - 1.95
      pt[s] = Math.round(baseSharpe * 100) / 100;
    });
    rollingSharpe.push(pt);
  }

  return {
    symbols: activeSymbols,
    correlationMatrix,
    cumulativeReturns,
    performanceRanking,
    rollingSharpe,
  };
}

// ---------------- 2. Single-Asset Technicals Mock ----------------
export function getMockSingleAsset(symbol: string): FeaturePoint[] {
  const sym = symbol.toUpperCase();
  const points: FeaturePoint[] = [];
  const now = new Date();
  let price = sym === 'NVDA' ? 128.5 : sym === 'MSFT' ? 425.0 : sym === 'SPY' ? 570.0 : 225.0;

  for (let d = 120; d >= 0; d--) {
    const dateObj = new Date(now.getTime() - d * 86400000);
    if (dateObj.getDay() === 0 || dateObj.getDay() === 6) continue;
    const dateStr = dateObj.toISOString().slice(0, 10);

    const seed = d * 19 + sym.charCodeAt(0) * 37;
    const change = (seededRandom(seed) - 0.485) * (price * 0.02);
    price = Math.max(10, price + change);

    const open = Math.round((price - change * 0.5) * 100) / 100;
    const high = Math.round((Math.max(open, price) + Math.abs(change) * 0.4) * 100) / 100;
    const low = Math.round((Math.min(open, price) - Math.abs(change) * 0.4) * 100) / 100;
    const close = Math.round(price * 100) / 100;
    const volume = Math.floor(15000000 + seededRandom(seed * 3) * 45000000);

    points.push({
      date: dateStr,
      open,
      high,
      low,
      close,
      adj_close: close,
      volume,
      simple_return: Math.round((change / open) * 10000) / 10000,
      log_return: Math.round(Math.log(close / open) * 10000) / 10000,
      sma_20: Math.round((close * (0.97 + seededRandom(seed + 1) * 0.05)) * 100) / 100,
      sma_50: Math.round((close * (0.94 + seededRandom(seed + 2) * 0.08)) * 100) / 100,
      volatility_20d: Math.round((0.18 + seededRandom(seed + 3) * 0.12) * 100) / 100,
      rsi_14: Math.round((42 + seededRandom(seed + 4) * 26) * 10) / 10,
      macd: Math.round((seededRandom(seed + 5) * 4 - 1.8) * 100) / 100,
      macd_signal: Math.round((seededRandom(seed + 6) * 3 - 1.4) * 100) / 100,
    });
  }

  return points;
}

// ---------------- 3. Options & Greeks Mock ----------------
export function getMockOptions(symbol: string): OptionsData {
  const sym = symbol.toUpperCase();
  const spotPrice = sym === 'NVDA' ? 132.5 : sym === 'MSFT' ? 428.0 : sym === 'SPY' ? 575.0 : 228.4;
  const step = spotPrice < 100 ? 2.5 : spotPrice < 250 ? 5.0 : 10.0;
  const atm = Math.round(spotPrice / step) * step;

  const strikes: StrikeDetail[] = [];
  const expirations = ['2026-11-21', '2026-11-28', '2026-12-19', '2027-01-16'];

  let totalCallOi = 0;
  let totalPutOi = 0;
  let totalGex = 0;
  let totalDex = 0;

  for (let i = -10; i <= 10; i++) {
    const strike = atm + i * step;
    const moneyness = (strike - spotPrice) / spotPrice;
    const weight = Math.exp(-0.5 * Math.pow(moneyness / 0.08, 2));

    const call_oi = Math.floor(3500 * weight + seededRandom(strike * 17) * 2200 + 400);
    const put_oi = Math.floor(3200 * weight + seededRandom(strike * 31) * 2000 + 350);
    const call_vol = Math.floor(call_oi * (0.15 + seededRandom(strike * 7) * 0.35));
    const put_vol = Math.floor(put_oi * (0.12 + seededRandom(strike * 13) * 0.30));

    // Volatility smile: IV higher OTM
    const call_iv = Math.round((24.5 + Math.pow(moneyness, 2) * 140 - moneyness * 12) * 10) / 10;
    const put_iv = Math.round((26.0 + Math.pow(moneyness, 2) * 160 - moneyness * 18) * 10) / 10;

    // GEX ($M)
    const gamma = Math.max(0.005, 0.045 * weight);
    const callGex = gamma * call_oi * 100 * Math.pow(spotPrice, 2) * 0.01 / 1e6;
    const putGex = -gamma * put_oi * 100 * Math.pow(spotPrice, 2) * 0.01 / 1e6;
    const gex = Math.round((callGex + putGex) * 100) / 100;

    // DEX ($M)
    const callDelta = Math.min(0.99, Math.max(0.01, 0.5 + moneyness * -3));
    const putDelta = callDelta - 1.0;
    const dex = Math.round(((callDelta * call_oi + putDelta * put_oi) * 100 * spotPrice / 1e6) * 10) / 10;

    totalCallOi += call_oi;
    totalPutOi += put_oi;
    totalGex += gex;
    totalDex += dex;

    strikes.push({
      strike,
      call_oi,
      put_oi,
      call_vol,
      put_vol,
      call_iv,
      put_iv,
      gex,
      dex,
    });
  }

  // Find Call Wall & Put Wall
  const callWall = [...strikes].sort((a, b) => b.call_oi - a.call_oi)[0]?.strike ?? atm + step * 2;
  const putWall = [...strikes].sort((a, b) => b.put_oi - a.put_oi)[0]?.strike ?? atm - step * 2;
  const gammaFlip = Math.round((atm - step * 0.8) * 10) / 10;

  return {
    symbol: sym,
    spotPrice,
    gammaFlip,
    callWall,
    putWall,
    netGex: Math.round(totalGex * 10) / 10,
    netDex: Math.round(totalDex * 10) / 10,
    putCallRatio: Math.round((totalPutOi / Math.max(1, totalCallOi)) * 100) / 100,
    atmIv: strikes.find((s) => s.strike === atm)?.call_iv ?? 26.4,
    expirations,
    selectedExpiration: expirations[0],
    strikes,
    sparklines: {
      gex: strikes.slice(3, 18).map((s) => s.gex),
      iv: strikes.slice(3, 18).map((s) => s.call_iv),
      oi: strikes.slice(3, 18).map((s) => s.call_oi),
    },
  };
}

// ---------------- 4. Macroeconomics Mock ----------------
export function getMockMacro(): MacroData {
  const yieldCurve = [
    { maturity: '3M', current: 4.85, monthAgo: 5.12, yearAgo: 5.45 },
    { maturity: '2Y', current: 4.28, monthAgo: 4.35, yearAgo: 4.88 },
    { maturity: '5Y', current: 4.15, monthAgo: 4.22, yearAgo: 4.45 },
    { maturity: '10Y', current: 4.42, monthAgo: 4.38, yearAgo: 4.52 },
    { maturity: '30Y', current: 4.64, monthAgo: 4.58, yearAgo: 4.70 },
  ];

  const spreadHistory = [];
  const sahmSeries = [];
  const recessionSeries = [];
  const now = new Date();
  let spread = -0.42; // un-inverting trajectory
  let sahm = 0.28;

  for (let d = 120; d >= 0; d--) {
    const dateObj = new Date(now.getTime() - d * 86400000);
    if (dateObj.getDay() === 0 || dateObj.getDay() === 6) continue;
    const dateStr = dateObj.toISOString().slice(0, 10);

    spread = Math.min(0.35, spread + 0.005 + (seededRandom(d * 11) - 0.48) * 0.03);
    sahm = Math.min(0.65, Math.max(0.18, sahm + (seededRandom(d * 17) - 0.47) * 0.02));

    const prob = Math.min(85, Math.max(8, 22 + (0.4 - spread) * 25 + (sahm - 0.25) * 45));

    spreadHistory.push({
      date: dateStr,
      spread10y2y: Math.round(spread * 100) / 100,
      spread10y3m: Math.round((spread - 0.35) * 100) / 100,
      isRecession: d > 90 && d < 105,
    });

    sahmSeries.push({
      date: dateStr,
      value: Math.round(sahm * 100) / 100,
      threshold: 0.50,
    });

    recessionSeries.push({
      date: dateStr,
      probability: Math.round(prob * 10) / 10,
    });
  }

  const currentSahm = sahmSeries[sahmSeries.length - 1]?.value ?? 0.43;
  const currentSpread = spreadHistory[spreadHistory.length - 1]?.spread10y2y ?? 0.14;
  const currentRecessionProb = recessionSeries[recessionSeries.length - 1]?.probability ?? 26.5;

  return {
    yieldCurve,
    spreadHistory,
    sahmSeries,
    currentSahm,
    sahmTriggered: currentSahm >= 0.50,
    recessionSeries,
    currentRecessionProb,
    tenYearYield: 4.42,
    twoYearYield: 4.28,
    currentSpread,
  };
}

// ---------------- 5. Quant Labs: Seasonality Mock ----------------
export function getMockSeasonality(symbol: string): SeasonalityData {
  const sym = symbol.toUpperCase();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const baseAvg = [1.8, -0.6, 2.1, 2.8, 0.4, 0.9, 2.6, -1.2, -1.9, 1.4, 3.8, 2.2];

  const monthlyDistribution = months.map((month, idx) => {
    const base = baseAvg[idx];
    const med = Math.round((base + seededRandom(idx * 19 + sym.charCodeAt(0)) * 0.8) * 10) / 10;
    return {
      month,
      monthNum: idx + 1,
      median: med,
      q1: Math.round((med - 1.8) * 10) / 10,
      q3: Math.round((med + 2.2) * 10) / 10,
      min: Math.round((med - 5.4) * 10) / 10,
      max: Math.round((med + 6.8) * 10) / 10,
      winRate: Math.round((52 + base * 4.5 + seededRandom(idx) * 6) * 10) / 10,
      avgReturn: med,
    };
  });

  const years = [2021, 2022, 2023, 2024, 2025, 2026];
  const yearMonthHeatmap = [];
  for (const yr of years) {
    for (let m = 1; m <= 12; m++) {
      const seed = yr * 31 + m * 17 + sym.charCodeAt(0);
      const ret = (seededRandom(seed) - 0.44) * 11.0;
      yearMonthHeatmap.push({
        year: yr,
        month: m,
        returnPct: Math.round(ret * 10) / 10,
      });
    }
  }

  return {
    symbol: sym,
    monthlyDistribution,
    yearMonthHeatmap,
    years,
    bestMonth: 'Nov',
    worstMonth: 'Sep',
    overallWinRate: 61.4,
  };
}

// ---------------- 6. Quant Labs: ML Predictor Mock ----------------
export function getMockMLPredictor(symbol: string): MLPredictorData {
  return {
    symbol: symbol.toUpperCase(),
    modelType: 'Random Forest',
    prediction: 'BUY',
    confidence: 0.684,
    accuracy: 0.582,
    aucRoc: 0.635,
    confusionMatrix: {
      truePositive: 142,
      falsePositive: 78,
      trueNegative: 124,
      falseNegative: 86,
    },
    featureImportance: [
      { feature: 'RSI_14', importance: 0.245 },
      { feature: 'SMA_20_50_Ratio', importance: 0.188 },
      { feature: 'Volatility_20D', importance: 0.154 },
      { feature: 'MACD_Histogram', importance: 0.138 },
      { feature: 'Log_Return_5D', importance: 0.112 },
      { feature: 'Volume_Surge_Z', importance: 0.089 },
      { feature: 'Treasury_Spread_10Y2Y', importance: 0.074 },
    ],
    walkForward: [
      { date: 'Wk 1', accuracy: 0.54, baseline: 0.50 },
      { date: 'Wk 2', accuracy: 0.58, baseline: 0.50 },
      { date: 'Wk 3', accuracy: 0.52, baseline: 0.50 },
      { date: 'Wk 4', accuracy: 0.61, baseline: 0.50 },
      { date: 'Wk 5', accuracy: 0.64, baseline: 0.50 },
      { date: 'Wk 6', accuracy: 0.59, baseline: 0.50 },
      { date: 'Wk 7', accuracy: 0.62, baseline: 0.50 },
      { date: 'Wk 8', accuracy: 0.67, baseline: 0.50 },
    ],
  };
}

// ---------------- 7. Quant Labs: Experiments Mock ----------------
export function getMockExperiments(): ExperimentItem[] {
  return [
    {
      id: 'EXP-1092',
      name: 'NVDA GEX Mean Reversion',
      type: 'Backtest',
      targetSymbol: 'NVDA',
      sharpe: 2.14,
      returnPct: 48.2,
      maxDrawdown: -11.4,
      status: 'COMPLETED',
      created_at: '2026-11-18 09:34',
      params: { shortWindow: 15, longWindow: 45, stopLoss: '2.5%', gammaThreshold: '+1.5M' },
      sparkline: [100, 104, 102, 109, 115, 122, 119, 131, 148],
    },
    {
      id: 'EXP-1091',
      name: 'SPY Dual Moving Average Crossover',
      type: 'Backtest',
      targetSymbol: 'SPY',
      sharpe: 1.62,
      returnPct: 22.8,
      maxDrawdown: -8.1,
      status: 'COMPLETED',
      created_at: '2026-11-17 18:12',
      params: { shortWindow: 20, longWindow: 50, initialCapital: 50000 },
      sparkline: [100, 102, 105, 104, 110, 113, 118, 122],
    },
    {
      id: 'EXP-1090',
      name: 'Tech Universe SLSQP Sharpe Maximizer',
      type: 'SLSQP Portfolio',
      targetSymbol: 'PORTFOLIO',
      sharpe: 2.38,
      returnPct: 34.6,
      maxDrawdown: -9.5,
      status: 'COMPLETED',
      created_at: '2026-11-17 14:05',
      params: { assets: 'AAPL,MSFT,NVDA,GOOGL', riskFreeRate: '4.2%' },
      sparkline: [100, 106, 109, 114, 121, 128, 134],
    },
    {
      id: 'EXP-1089',
      name: 'Directional Random Forest Classifier v3',
      type: 'ML Classifier',
      targetSymbol: 'AAPL',
      sharpe: 1.45,
      returnPct: 18.9,
      maxDrawdown: -14.2,
      status: 'ARCHIVED',
      created_at: '2026-11-16 11:20',
      params: { n_estimators: 200, max_depth: 8, test_size: 0.2 },
      sparkline: [100, 98, 103, 107, 105, 112, 118],
    },
  ];
}

// ---------------- 8. Portfolio & Risk: Backtest Mock ----------------
export function getMockBacktest(symbol: string): BacktestData {
  const sym = symbol.toUpperCase();
  const equityCurve = [];
  const drawdownCurve = [];
  const now = new Date();
  let portVal = 10000;
  let benchVal = 10000;
  let peak = 10000;

  for (let d = 90; d >= 0; d--) {
    const dateObj = new Date(now.getTime() - d * 86400000);
    if (dateObj.getDay() === 0 || dateObj.getDay() === 6) continue;
    const dateStr = dateObj.toISOString().slice(0, 10);

    const seed = d * 13 + sym.charCodeAt(0);
    const pRet = (seededRandom(seed) - 0.46) * 0.022;
    const bRet = (seededRandom(seed + 1) - 0.49) * 0.016;

    portVal = Math.round(portVal * (1 + pRet));
    benchVal = Math.round(benchVal * (1 + bRet));
    if (portVal > peak) peak = portVal;

    const dd = Math.round(((portVal - peak) / peak) * 10000) / 100;

    equityCurve.push({
      date: dateStr,
      portfolio: portVal,
      benchmark: benchVal,
    });

    drawdownCurve.push({
      date: dateStr,
      drawdown: dd,
    });
  }

  const totalReturnPct = Math.round(((portVal - 10000) / 10000) * 1000) / 10;
  const maxDrawdown = Math.min(...drawdownCurve.map((d) => d.drawdown));

  return {
    symbol: sym,
    metrics: {
      totalReturnPct,
      cagr: Math.round(totalReturnPct * 2.8 * 10) / 10,
      annualizedVol: 16.4,
      sharpeRatio: 1.84,
      sortinoRatio: 2.32,
      maxDrawdown,
      calmarRatio: Math.round((Math.abs(totalReturnPct / (maxDrawdown || 1))) * 10) / 10,
      winRate: 59.2,
      totalTrades: 46,
      profitFactor: 1.94,
    },
    equityCurve,
    drawdownCurve,
    monthlyReturns: [
      { year: 2026, month: 1, returnPct: 3.2 },
      { year: 2026, month: 2, returnPct: -1.1 },
      { year: 2026, month: 3, returnPct: 4.8 },
      { year: 2026, month: 4, returnPct: 2.4 },
      { year: 2026, month: 5, returnPct: -0.8 },
      { year: 2026, month: 6, returnPct: 5.1 },
    ],
  };
}

// ---------------- 9. Portfolio & Risk: Risk & VaR Mock ----------------
export function getMockRiskAnalysis(symbol: string): RiskAnalysisData {
  const sym = symbol.toUpperCase();
  const bins = [
    { bin: '< -3.0%', count: 4, returnVal: -3.2, isVaR95: true, isVaR99: true },
    { bin: '-2.5%', count: 8, returnVal: -2.5, isVaR95: true, isVaR99: false },
    { bin: '-2.0%', count: 14, returnVal: -2.0, isVaR95: true, isVaR99: false },
    { bin: '-1.5%', count: 24, returnVal: -1.5, isVaR95: false, isVaR99: false },
    { bin: '-1.0%', count: 48, returnVal: -1.0, isVaR95: false, isVaR99: false },
    { bin: '-0.5%', count: 86, returnVal: -0.5, isVaR95: false, isVaR99: false },
    { bin: '0.0%', count: 124, returnVal: 0.0, isVaR95: false, isVaR99: false },
    { bin: '+0.5%', count: 110, returnVal: 0.5, isVaR95: false, isVaR99: false },
    { bin: '+1.0%', count: 68, returnVal: 1.0, isVaR95: false, isVaR99: false },
    { bin: '+1.5%', count: 32, returnVal: 1.5, isVaR95: false, isVaR99: false },
    { bin: '+2.0%', count: 16, returnVal: 2.0, isVaR95: false, isVaR99: false },
    { bin: '> +2.5%', count: 7, returnVal: 2.8, isVaR95: false, isVaR99: false },
  ];

  return {
    symbol: sym,
    annualizedReturn: 24.8,
    annualizedVolatility: 18.2,
    sharpeRatio: 1.76,
    sortinoRatio: 2.24,
    maxDrawdown: -12.4,
    var90: -1.35,
    var95: -1.92,
    var99: -2.84,
    cvar95: -2.48,
    histogram: bins,
  };
}

// ---------------- 10. Portfolio & Risk: Markowitz Optimizer Mock ----------------
export function getMockPortfolioOptimizer(symbols: string[]): PortfolioOptimizerData {
  const clean = symbols.map((s) => s.trim().toUpperCase()).filter(Boolean);
  const activeSymbols = clean.length > 0 ? clean : ['AAPL', 'MSFT', 'NVDA', 'SPY', 'GLD'];

  const frontier = [];
  for (let i = 0; i < 75; i++) {
    const vol = 12 + seededRandom(i * 17) * 22; // 12% to 34%
    const maxRet = 8 + (vol - 12) * 1.35;
    const ret = maxRet * (0.65 + seededRandom(i * 31) * 0.35);
    const sharpe = Math.round(((ret - 4.2) / vol) * 100) / 100;
    frontier.push({
      volatility: Math.round(vol * 10) / 10,
      returnPct: Math.round(ret * 10) / 10,
      sharpe,
    });
  }

  // Add optimal markers
  frontier.push({ volatility: 18.4, returnPct: 32.8, sharpe: 2.15, isOptimal: true });
  frontier.push({ volatility: 13.2, returnPct: 18.4, sharpe: 1.48, isMinVol: true });

  const num = activeSymbols.length;
  const maxSharpeWeights = activeSymbols.map((s, idx) => ({
    symbol: s,
    weight: idx === 0 ? 0.35 : idx === 1 ? 0.25 : idx === 2 ? 0.20 : idx === 3 ? 0.12 : 0.08,
  }));

  const minVolWeights = activeSymbols.map((s) => ({
    symbol: s,
    weight: Math.round((1.0 / num) * 100) / 100,
  }));

  return {
    symbols: activeSymbols,
    frontier: frontier.sort((a, b) => a.volatility - b.volatility),
    maxSharpe: {
      expectedReturn: 32.8,
      volatility: 18.4,
      sharpe: 2.15,
      weights: maxSharpeWeights,
    },
    minVol: {
      expectedReturn: 18.4,
      volatility: 13.2,
      sharpe: 1.48,
      weights: minVolWeights,
    },
  };
}
