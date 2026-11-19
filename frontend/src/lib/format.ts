// Institutional Number & Data Formatting Utility (Bloomberg / Koyfin Standards)

export const TRUE_MINUS = '\u2212'; // '−' Unicode minus for tabular typography

export interface FormatOptions {
  decimals?: number;
  showSign?: boolean;
  prefix?: string;
  suffix?: string;
  emptyFallback?: string;
}

/**
 * Formats a percentage value with true minus sign and explicit positive sign when requested.
 * Example: fmtPct(1.24) -> "+1.24%", fmtPct(-0.87) -> "−0.87%"
 */
export function fmtPct(val: number | null | undefined, options: FormatOptions = {}): string {
  if (val === null || val === undefined || isNaN(val)) {
    return options.emptyFallback ?? '—';
  }
  const decimals = options.decimals ?? 2;
  const showSign = options.showSign ?? true;
  const abs = Math.abs(val).toFixed(decimals);

  if (val > 0) {
    return `${showSign ? '+' : ''}${abs}%`;
  } else if (val < 0) {
    return `${TRUE_MINUS}${abs}%`;
  }
  return `0.${'0'.repeat(decimals)}%`;
}

/**
 * Formats currency/price figures with strict thousand separators and decimals.
 * Example: fmtPrice(182.4) -> "$182.40", fmtPrice(-12.5) -> "−$12.50"
 */
export function fmtPrice(val: number | null | undefined, options: FormatOptions = {}): string {
  if (val === null || val === undefined || isNaN(val)) {
    return options.emptyFallback ?? '—';
  }
  const decimals = options.decimals ?? 2;
  const prefix = options.prefix ?? '$';
  const isNeg = val < 0;
  const absFormatted = Math.abs(val).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return `${isNeg ? TRUE_MINUS : ''}${prefix}${absFormatted}`;
}

/**
 * Compact unit format for market capitalization, open interest, and Greek dollar exposures.
 * Example: 1,420,000 -> "$1.42M", 85,000 -> "85.0K"
 */
export function fmtCompact(val: number | null | undefined, options: FormatOptions = {}): string {
  if (val === null || val === undefined || isNaN(val)) {
    return options.emptyFallback ?? '—';
  }
  const prefix = options.prefix ?? '';
  const isNeg = val < 0;
  const abs = Math.abs(val);

  let formatted = '';
  if (abs >= 1e12) {
    formatted = `${(abs / 1e12).toFixed(2)}T`;
  } else if (abs >= 1e9) {
    formatted = `${(abs / 1e9).toFixed(2)}B`;
  } else if (abs >= 1e6) {
    formatted = `${(abs / 1e6).toFixed(2)}M`;
  } else if (abs >= 1e3) {
    formatted = `${(abs / 1e3).toFixed(1)}K`;
  } else {
    formatted = abs.toFixed(options.decimals ?? 0);
  }

  return `${isNeg ? TRUE_MINUS : ''}${prefix}${formatted}`;
}

/**
 * Formats ratios like Sharpe, Sortino, P/C.
 * Example: fmtRatio(1.84, 2) -> "1.84", fmtRatio(1.84, 2, true) -> "1.84x"
 */
export function fmtRatio(val: number | null | undefined, decimals = 2, withX = false): string {
  if (val === null || val === undefined || isNaN(val)) return '—';
  const isNeg = val < 0;
  const abs = Math.abs(val).toFixed(decimals);
  return `${isNeg ? TRUE_MINUS : ''}${abs}${withX ? 'x' : ''}`;
}

/**
 * Formats standard integers or floats with comma groupings.
 */
export function fmtNumber(val: number | null | undefined, decimals = 0): string {
  if (val === null || val === undefined || isNaN(val)) return '—';
  const isNeg = val < 0;
  const absFormatted = Math.abs(val).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${isNeg ? TRUE_MINUS : ''}${absFormatted}`;
}

/**
 * Returns a directional sign glyph: ▲ for positive, ▼ for negative, — for neutral.
 */
export function signGlyph(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val) || val === 0) return '—';
  return val > 0 ? '▲' : '▼';
}

/**
 * Formats date strings to clean quant desk presentation.
 */
export function fmtDate(dateStr: string, style: 'short' | 'medium' | 'full' = 'short'): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    if (style === 'short') {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else if (style === 'medium') {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}
