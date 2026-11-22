'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  ColorType,
  CrosshairMode,
  IChartApi,
  ISeriesApi,
  Time,
} from 'lightweight-charts';
import { Candle } from '@/lib/api/market';

export type ChartType = 'candles' | 'line';

const COLORS = { up: '#00d26a', down: '#ff4d4d', grid: '#161616', text: '#9a9a9a', line: '#ff9f1a' };

export const PriceChart: React.FC<{ candles: Candle[]; type: ChartType }> = ({ candles, type }) => {
  const host = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const priceRef = useRef<ISeriesApi<'Candlestick'> | ISeriesApi<'Line'> | null>(null);
  const volRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const [hover, setHover] = useState<Candle | null>(null);

  // Create the chart once
  useEffect(() => {
    if (!host.current) return;
    const chart = createChart(host.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: COLORS.text,
        fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
        fontSize: 11,
      },
      grid: { vertLines: { color: COLORS.grid }, horzLines: { color: COLORS.grid } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#2a2a2a' },
      timeScale: { borderColor: '#2a2a2a', timeVisible: true },
    });
    chartRef.current = chart;
    return () => {
      chart.remove();
      chartRef.current = null;
      priceRef.current = null;
      volRef.current = null;
    };
  }, []);

  // (Re)build series when data or type changes
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    if (priceRef.current) chart.removeSeries(priceRef.current);
    if (volRef.current) chart.removeSeries(volRef.current);

    let price: ISeriesApi<'Candlestick'> | ISeriesApi<'Line'>;
    if (type === 'candles') {
      const s = chart.addSeries(CandlestickSeries, {
        upColor: COLORS.up,
        downColor: COLORS.down,
        wickUpColor: COLORS.up,
        wickDownColor: COLORS.down,
        borderVisible: false,
      });
      s.setData(candles.map((c) => ({ time: c.time as Time, open: c.open, high: c.high, low: c.low, close: c.close })));
      price = s;
    } else {
      const s = chart.addSeries(LineSeries, { color: COLORS.line, lineWidth: 2 });
      s.setData(candles.map((c) => ({ time: c.time as Time, value: c.close })));
      price = s;
    }

    const vol = chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'vol' });
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    vol.setData(
      candles.map((c) => ({
        time: c.time as Time,
        value: c.volume,
        color: c.close >= c.open ? 'rgba(0,210,106,0.4)' : 'rgba(255,77,77,0.4)',
      }))
    );

    priceRef.current = price;
    volRef.current = vol;
    chart.timeScale().fitContent();

    const byTime = new Map(candles.map((c) => [String(c.time), c]));
    const handler = (p: { time?: Time }) => setHover(p.time ? byTime.get(String(p.time)) ?? null : null);
    chart.subscribeCrosshairMove(handler);
    return () => chart.unsubscribeCrosshairMove(handler);
  }, [candles, type]);

  const c = hover ?? candles[candles.length - 1];
  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="relative h-full w-full">
      {c && (
        <div className="absolute left-2 top-1 z-10 flex gap-3 text-[11px] font-mono tabular-nums text-slate-400 pointer-events-none">
          <span>O <b className="text-slate-200 font-medium">{fmt(c.open)}</b></span>
          <span>H <b className="text-slate-200 font-medium">{fmt(c.high)}</b></span>
          <span>L <b className="text-slate-200 font-medium">{fmt(c.low)}</b></span>
          <span>C <b className={`font-medium ${c.close >= c.open ? 'text-emerald-400' : 'text-rose-400'}`}>{fmt(c.close)}</b></span>
          <span>Vol <b className="text-slate-200 font-medium">{c.volume.toLocaleString()}</b></span>
        </div>
      )}
      <div ref={host} className="h-full w-full" />
    </div>
  );
};
