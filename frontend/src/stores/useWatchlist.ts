import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WatchlistState {
  symbols: string[];
  add: (s: string) => void;
  remove: (s: string) => void;
}

// Stored in the browser only (no backend watchlist API yet).
export const useWatchlist = create<WatchlistState>()(
  persist(
    (set) => ({
      symbols: ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'GOOGL'],
      add: (s) =>
        set((st) => {
          const sym = s.toUpperCase().trim();
          return sym && !st.symbols.includes(sym) ? { symbols: [...st.symbols, sym] } : st;
        }),
      remove: (s) => set((st) => ({ symbols: st.symbols.filter((x) => x !== s) })),
    }),
    { name: 'quantlab-watchlist' }
  )
);
