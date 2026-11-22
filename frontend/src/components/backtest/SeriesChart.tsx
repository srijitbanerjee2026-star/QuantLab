'use client';

import React, { useEffect, useRef } from 'react';
import {
  createChart,
  AreaSeries,
  LineSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  IChartApi,
  Time,
} from 'lightweight-charts';

export interface ChartSeries {
  name: string;
  color: string;
  data: { time: string; value: number }[];
  kind?: 'line' | 'area';
  dashed?: boolean;
}

/** Generic multi-series time chart (equity curves, drawdowns) with crosshair and zoom/pan. */
export const SeriesChart: React.FC<{
  series: ChartSeries[];
  percent?: boolean;
  onCrosshair?: (time: string | null, values: Record<string, number>) => void;
}> = ({ series, percent = false, onCrosshair }) => {
  const host = useRef<HTMLDivElement>(null);
  const cb = useRef(onCrosshair);
  useEffect(() => {
    cb.current = onCrosshair;
  });

  useEffect(() => {
    if (!host.current) return;
    const chart: IChartApi = createChart(host.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9a9a9a',
        fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
        fontSize: 11,
      },
      grid: { vertLines: { color: '#161616' }, horzLines: { color: '#161616' } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#2a2a2a' },
      timeScale: { borderColor: '#2a2a2a' },
      localization: percent ? { priceFormatter: (p: number) => `${(p * 100).toFixed(1)}%` } : undefined,
    });

    const handles = series.map((s) => {
      const api =
        s.kind === 'area'
          ? chart.addSeries(AreaSeries, {
              lineColor: s.color,
              topColor: `${s.color}55`,
              bottomColor: `${s.color}05`,
              lineWidth: 1,
              title: s.name,
            })
          : chart.addSeries(LineSeries, {
              color: s.color,
              lineWidth: 2,
              lineStyle: s.dashed ? LineStyle.Dashed : LineStyle.Solid,
              title: s.name,
            });
      api.setData(s.data.map((d) => ({ time: d.time as Time, value: d.value })));
      return { s, api };
    });
    chart.timeScale().fitContent();

    chart.subscribeCrosshairMove((p) => {
      if (!cb.current) return;
      if (!p.time) return cb.current(null, {});
      const vals: Record<string, number> = {};
      handles.forEach(({ s, api }) => {
        const d = p.seriesData.get(api) as { value?: number } | undefined;
        if (d?.value !== undefined) vals[s.name] = d.value;
      });
      cb.current(String(p.time), vals);
    });

    return () => chart.remove();
  }, [series, percent]);

  return <div ref={host} className="h-full w-full" />;
};
