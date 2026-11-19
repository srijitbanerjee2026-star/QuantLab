import { create } from 'zustand';

export interface FocusTickerState {
  hoveredTicker: string | null;
  pinnedTicker: string | null;
  cursorPos: { x: number; y: number } | null;
  setHoveredTicker: (ticker: string | null, pos?: { x: number; y: number }) => void;
  setPinnedTicker: (ticker: string | null) => void;
  togglePin: (ticker: string) => void;
  clearFocus: () => void;
  getActiveTicker: () => string | null;
  isDimmed: (ticker: string) => boolean;
}

export const useFocusTicker = create<FocusTickerState>((set, get) => ({
  hoveredTicker: null,
  pinnedTicker: null,
  cursorPos: null,

  setHoveredTicker: (ticker, pos) => {
    set({
      hoveredTicker: ticker ? ticker.toUpperCase() : null,
      cursorPos: pos || null,
    });
  },

  setPinnedTicker: (ticker) => {
    set({
      pinnedTicker: ticker ? ticker.toUpperCase() : null,
    });
  },

  togglePin: (ticker) => {
    const sym = ticker.toUpperCase();
    const current = get().pinnedTicker;
    set({
      pinnedTicker: current === sym ? null : sym,
    });
  },

  clearFocus: () => {
    set({
      hoveredTicker: null,
      pinnedTicker: null,
      cursorPos: null,
    });
  },

  getActiveTicker: () => {
    const state = get();
    return state.pinnedTicker || state.hoveredTicker;
  },

  isDimmed: (ticker: string) => {
    const active = get().getActiveTicker();
    if (!active) return false;
    return active !== ticker.toUpperCase();
  },
}));
