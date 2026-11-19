// 2030 Trading Terminal Design Tokens — "OBSIDIAN AURORA"
// Linear + Bloomberg Launchpad + Vercel inspired aesthetic

export const OBSIDIAN_TOKENS = {
  surfaces: {
    canvas: '#05070d',
    panelBg: 'rgba(15, 20, 33, 0.72)',
    panelElevated: '#0d1322',
    border: 'rgba(255, 255, 255, 0.08)',
    borderHover: 'rgba(255, 255, 255, 0.16)',
    innerGlow: 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',
  },
  semantic: {
    positive: '#34d399',      // Emerald 400
    positiveMuted: 'rgba(52, 211, 153, 0.12)',
    positiveGlow: '0 0 24px rgba(52, 211, 153, 0.25)',

    negative: '#fb7185',      // Rose 400
    negativeMuted: 'rgba(251, 113, 133, 0.12)',
    negativeGlow: '0 0 24px rgba(251, 113, 133, 0.25)',

    primary: '#60a5fa',       // Blue 400
    primaryMuted: 'rgba(96, 165, 250, 0.12)',
    primaryGlow: '0 0 24px rgba(96, 165, 250, 0.25)',

    warn: '#fbbf24',          // Amber 400
    warnMuted: 'rgba(251, 191, 36, 0.12)',
    warnGlow: '0 0 24px rgba(251, 191, 36, 0.25)',

    accent: '#c084fc',        // Purple 400
    accentMuted: 'rgba(192, 132, 252, 0.12)',
    accentGlow: '0 0 24px rgba(192, 132, 252, 0.25)',

    neutral: '#94a3b8',       // Slate 400
    muted: '#64748b',         // Slate 500
    dim: '#334155',           // Slate 700
  },
  // Stable, distinct ticker hue map
  tickerColors: {
    AAPL: '#60a5fa',  // Tech Blue
    MSFT: '#fbbf24',  // Software Gold/Amber
    NVDA: '#c084fc',  // Silicon Purple
    SPY: '#94a3b8',   // Benchmark Slate
    GLD: '#fcd34d',   // Gold Shimmer
    QQQ: '#22d3ee',   // Cyan
    IWM: '#fb7185',   // Rose
    TLT: '#a3e635',   // Lime
    'BTC-USD': '#fb923c', // Orange
    GOOGL: '#34d399', // Emerald
    AMZN: '#f43f5e',  // Crimson
    META: '#38bdf8',  // Sky
    TSLA: '#e879f9',  // Fuchsia
  } as Record<string, string>,
  extraColors: [
    '#22d3ee', // Cyan
    '#fb7185', // Rose
    '#a3e635', // Lime
    '#fb923c', // Orange
    '#38bdf8', // Sky
    '#e879f9', // Fuchsia
    '#2dd4bf', // Teal
    '#f43f5e', // Crimson
  ],
  // True diverging heatmap palette (-1 to +1)
  heatmapScale: {
    negMax: '#fb7185',     // -1.0
    negMid: '#7f1d3a',     // -0.4
    zero: '#0b1020',       // 0.0
    posMid: '#0f766e',     // +0.4
    posMax: '#34d399',     // +1.0
  },
  springs: {
    snappy: { type: 'spring', stiffness: 260, damping: 30 },
    gentle: { type: 'spring', stiffness: 180, damping: 24 },
  },
};

// Returns stable color for any ticker symbol
export function getTickerColor(symbol: string, index = 0): string {
  const sym = symbol.toUpperCase().trim();
  if (OBSIDIAN_TOKENS.tickerColors[sym]) {
    return OBSIDIAN_TOKENS.tickerColors[sym];
  }
  return OBSIDIAN_TOKENS.extraColors[index % OBSIDIAN_TOKENS.extraColors.length];
}

// True 5-stop diverging color interpolator for correlation values in [-1, +1]
export function getCorrelationColor(value: number): { bg: string; text: string; border: string } {
  // Clamp to [-1, 1]
  const val = Math.max(-1, Math.min(1, value));

  if (val >= 0.8) {
    return { bg: 'rgba(52, 211, 153, 0.85)', text: '#05070d', border: 'rgba(52, 211, 153, 0.4)' };
  } else if (val >= 0.4) {
    const ratio = (val - 0.4) / 0.4;
    return {
      bg: `rgba(15, 118, 110, ${0.45 + ratio * 0.35})`,
      text: '#e2e8f0',
      border: 'rgba(52, 211, 153, 0.25)',
    };
  } else if (val > 0.05) {
    const ratio = val / 0.4;
    return {
      bg: `rgba(15, 118, 110, ${0.15 + ratio * 0.25})`,
      text: '#cbd5e1',
      border: 'rgba(15, 118, 110, 0.2)',
    };
  } else if (val >= -0.05) {
    return { bg: '#0b1020', text: '#64748b', border: 'rgba(255, 255, 255, 0.04)' };
  } else if (val > -0.4) {
    const ratio = Math.abs(val) / 0.4;
    return {
      bg: `rgba(127, 29, 58, ${0.2 + ratio * 0.3})`,
      text: '#fecdd3',
      border: 'rgba(251, 113, 133, 0.2)',
    };
  } else if (val > -0.8) {
    const ratio = (Math.abs(val) - 0.4) / 0.4;
    return {
      bg: `rgba(127, 29, 58, ${0.5 + ratio * 0.35})`,
      text: '#ffe4e6',
      border: 'rgba(251, 113, 133, 0.35)',
    };
  } else {
    return { bg: 'rgba(251, 113, 133, 0.85)', text: '#05070d', border: 'rgba(251, 113, 133, 0.5)' };
  }
}
