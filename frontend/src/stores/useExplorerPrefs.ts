import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SortKey = 'symbol' | 'price' | 'change_pct' | 'volume';

interface ExplorerPrefs {
  category: string;
  sortKey: SortKey;
  sortDir: 'asc' | 'desc';
  setCategory: (c: string) => void;
  setSort: (k: SortKey) => void;
}

// Filters persist in the browser between visits.
export const useExplorerPrefs = create<ExplorerPrefs>()(
  persist(
    (set) => ({
      category: 'us_large',
      sortKey: 'symbol',
      sortDir: 'asc',
      setCategory: (category) => set({ category }),
      setSort: (k) =>
        set((s) => (s.sortKey === k ? { sortDir: s.sortDir === 'asc' ? 'desc' : 'asc' } : { sortKey: k, sortDir: k === 'symbol' ? 'asc' : 'desc' })),
    }),
    { name: 'quantlab-explorer-prefs' }
  )
);
