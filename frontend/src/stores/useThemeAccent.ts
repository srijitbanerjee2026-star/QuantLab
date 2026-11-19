import { create } from 'zustand';

export type AccentTheme = 'aurora' | 'matrix' | 'amber' | 'ice';

export interface ThemeAccentState {
  accent: AccentTheme;
  setAccent: (accent: AccentTheme) => void;
}

const ACCENT_STORAGE_KEY = 'quantlab_accent_theme';

export const useThemeAccent = create<ThemeAccentState>((set) => ({
  accent: 'aurora',

  setAccent: (accent) => {
    set({ accent });
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(ACCENT_STORAGE_KEY, accent);
        document.documentElement.setAttribute('data-theme', accent);
      } catch {}
    }
  },
}));
