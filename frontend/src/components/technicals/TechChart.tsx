'use client';

import React, { useEffect, useRef } from 'react';
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  Time,
} from 'lightweight-charts';
import { TechnicalsResult } from '@/lib/api/analysis';

export interface Overlays {
  sma20: boolean;
  sma50: boolean;
  sma200: boolean;
  bollinger: boolean;
  volume: boolean;
}

const pts = (dates: string[], values: (number | null)[]) =>
  dates.flatMap((d, i) => (values[i] === null || values[i] === undefined ? [] : [{ time: d as Time, value: values[i] as number }]));

/** Price chart with overlays plus RSI and MACD panes, all sharing one time axis. */
export const TechChart: React.FC<{ data: TechnicalsResult; overlays: Overlays }> = ({ data, overlays }) => {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!host.current) return;
    const chart = createChart(host.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9a9a9a',
        fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
        fontSize: 11,
        panes: { separatorColor: '#2a2a2a', separatorHoverColor: '#3a3a3a' },
      },
      grid: { vertLines: { color: '#161616' }, horzLines: { color: '#161616' } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#2a2a2a' },
      timeScale: { borderColor: '#2a2a2a' },
    });

    const d = data.dates;
    const candles = chart.addSeries(
      CandlestickSeries,
      { upColor: '#00d26a', downColor: '#ff4d4d', wickUpColor: '#00d26a', wickDownColor: '#ff4d4d', borderVisible: false },
      0
    );
    candles.setData(data.candles.map((c) => ({ time: c.time as Time, open: c.open, high: c.high, low: c.low, close: c.close })));

    const line = (values: (number | null)[], color: string, pane: number, opts: Record<string, unknown> = {}) => {
      const s = chart.addSeries(LineSeries, { color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, ...opts }, pane);
      s.setData(pts(d, values));
      return s;
    };

    if (overlays.sma20) line(data.sma20, '#ffd24a', 0);
    if (overlays.sma50) line(data.sma50, '#4fc3f7', 0);
    if (overlays.sma200) line(data.sma200, '#c792ea', 0, { lineWidth: 2 });
    if (overlays.bollinger) {
      line(data.bb_upper, '#6e6e6e', 0, { lineStyle: LineStyle.Dashed });
      line(data.bb_lower, '#6e6e6e', 0, { lineStyle: LineStyle.Dashed });
    }
    if (overlays.volume) {
      const vol = chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'vol', priceLineVisible: false, lastValueVisible: false }, 0);
      chart.priceScale('vol', 0).applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
      vol.setData(data.candles.map((c) => ({ time: c.time as Time, value: c.volume, color: c.close >= c.open ? 'rgba(0,210,106,0.3)' : 'rgba(255,77,77,0.3)' })));
    }

    // RSI pane
    const rsi = line(data.rsi, '#ff9f1a', 1, { lineWidth: 2, title: 'RSI 14', lastValueVisible: true });
    rsi.createPriceLine({ price: 70, color: '#ff4d4d', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false, title: '' });
    rsi.createPriceLine({ price: 30, color: '#00d26a', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false, title: '' });

    // MACD pane
    const hist = chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false }, 2);
    hist.setData(
      d.flatMap((dt, i) => (data.macd_hist[i] === null ? [] : [{ time: dt as Time, value: data.macd_hist[i] as number, color: (data.macd_hist[i] as number) >= 0 ? 'rgba(0,210,106,0.6)' : 'rgba(255,77,77,0.6)' }]))
    );
    line(data.macd, '#4fc3f7', 2, { title: 'MACD' });
    line(data.macd_signal, '#ff9f1a', 2, { title: 'Signal' });

    const panes = chart.panes();
    if (panes[1]) panes[1].setHeight(130);
    if (panes[2]) panes[2].setHeight(130);

    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [data, overlays]);

  return <div ref={host} className="h-full w-full" />;
};
