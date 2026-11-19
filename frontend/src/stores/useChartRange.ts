import { create } from 'zustand';

export type RangePreset = '1M' | '3M' | '6M' | '1Y' | '3Y' | 'MAX';

export interface ChartRangeState {
  range: RangePreset;
  startDate: string;
  endDate: string;
  zoomDomain: { startIndex: number; endIndex: number } | null;
  setRange: (r: RangePreset) => void;
  setZoomDomain: (domain: { startIndex: number; endIndex: number } | null) => void;
  resetZoom: () => void;
}

function calculateDates(range: RangePreset): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end);

  switch (range) {
    case '1M':
      start.setMonth(start.getMonth() - 1);
      break;
    case '3M':
      start.setMonth(start.getMonth() - 3);
      break;
    case '6M':
      start.setMonth(start.getMonth() - 6);
      break;
    case '1Y':
      start.setFullYear(start.getFullYear() - 1);
      break;
    case '3Y':
      start.setFullYear(start.getFullYear() - 3);
      break;
    case 'MAX':
      start.setFullYear(start.getFullYear() - 5);
      break;
  }

  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

export const useChartRange = create<ChartRangeState>((set) => {
  const initialDates = calculateDates('3M');
  return {
    range: '3M',
    startDate: initialDates.start,
    endDate: initialDates.end,
    zoomDomain: null,

    setRange: (r) => {
      const dates = calculateDates(r);
      set({
        range: r,
        startDate: dates.start,
        endDate: dates.end,
        zoomDomain: null, // Reset zoom on range switch
      });
    },

    setZoomDomain: (domain) => {
      set({ zoomDomain: domain });
    },

    resetZoom: () => {
      set({ zoomDomain: null });
    },
  };
});
