'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { CardHeader } from '@/components/ui/CardHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { apiErrorMessage } from '@/lib/api/risk';
import { listExperiments, deleteExperiment, ExperimentRecord } from '@/lib/api/ml';

const TYPES: { id: string; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'backtest', label: 'Backtests' },
  { id: 'ml_model', label: 'ML models' },
  { id: 'portfolio_opt', label: 'Portfolio' },
];

const TYPE_LABEL: Record<string, string> = { backtest: 'Backtest', ml_model: 'ML model', portfolio_opt: 'Portfolio' };

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const fmtVal = (v: unknown): string => {
  if (isNum(v)) return Math.abs(v) >= 1000 ? v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : Number.isInteger(v) ? String(v) : v.toFixed(Math.abs(v) < 1 ? 4 : 2);
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};
const label = (k: string) => k.replace(/_/g, ' ');

function headline(e: ExperimentRecord): [string, string][] {
  const pref = ['total_return_pct', 'sharpe_ratio', 'accuracy', 'auc', 'strategy_return', 'expected_return', 'volatility'];
  const keys = [...pref.filter((k) => isNum(e.metrics[k])), ...Object.keys(e.metrics).filter((k) => isNum(e.metrics[k]) && !pref.includes(k))].slice(0, 2);
  return keys.map((k) => [label(k), fmtVal(e.metrics[k])]);
}

export const Experiments: React.FC = () => {
  const [type, setType] = useState('all');
  const [q, setQ] = useState('');
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<{ nonce: number; rows: ExperimentRecord[] | null; err: string | null } | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    listExperiments()
      .then((rows) => !cancelled && setState({ nonce, rows, err: null }))
      .catch((e) => !cancelled && setState({ nonce, rows: null, err: apiErrorMessage(e).startsWith('Could not reach') ? 'Could not reach the backend.' : 'The experiments database is unavailable. Check that the Supabase project is running.' }));
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const loading = state?.nonce !== nonce;
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (loading ? [] : state?.rows ?? []).filter(
      (e) => (type === 'all' || e.experiment_type === type) && (!s || e.name.toLowerCase().includes(s) || JSON.stringify(e.parameters).toLowerCase().includes(s))
    );
  }, [state, loading, type, q]);

  const remove = async (e: ExperimentRecord) => {
    if (!window.confirm(`Permanently delete "${e.name}"? This cannot be undone.`)) return;
    try {
      await deleteExperiment(e.id);
      setSelected((cur) => cur.filter((x) => x !== e.id));
      setOpen(null);
      setNonce((n) => n + 1);
    } catch {
      window.alert('Could not delete the experiment. Check that the database is available.');
    }
  };

  const toggle = (id: number) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= 4 ? cur : [...cur, id]));
  const chosen = (state?.rows ?? []).filter((e) => selected.includes(e.id));
  const metricKeys = useMemo(() => {
    const keys = new Set<string>();
    chosen.forEach((e) => Object.keys(e.metrics).forEach((k) => isNum(e.metrics[k]) && keys.add(k)));
    return Array.from(keys);
  }, [chosen]);
  const paramKeys = useMemo(() => {
    const keys = new Set<string>();
    chosen.forEach((e) => Object.keys(e.parameters).forEach((k) => keys.add(k)));
    return Array.from(keys);
  }, [chosen]);

  return (
    <div className="space-y-3 max-w-[1600px] mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-100 tracking-tight">Experiments</h1>
          <p className="text-xs text-slate-500">
            A saved record of research runs. Save results from Backtesting or ML Models; select up to 4 here to compare them side by side.
          </p>
        </div>
        <button
          onClick={() => setNonce((n) => n + 1)}
          className="h-8 px-3 flex items-center gap-1.5 border border-slate-700 text-[11px] text-slate-300 hover:bg-white/5"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex border border-slate-700">
          {TYPES.map((t) => (
            <button key={t.id} onClick={() => setType(t.id)} className={`px-3 h-8 text-[11px] ${type === t.id ? 'bg-blue-400/15 text-blue-300' : 'text-slate-400 hover:bg-white/5'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or parameters…"
          className="h-8 w-64 px-2 bg-[#050505] border border-slate-700 text-xs text-slate-200 outline-none focus:border-blue-400/70 select-text"
          aria-label="Search experiments"
        />
        {selected.length > 0 && (
          <button onClick={() => setSelected([])} className="text-[11px] text-slate-500 hover:text-slate-300">Clear selection ({selected.length})</button>
        )}
      </div>

      {chosen.length >= 2 && (
        <Card noPadding>
          <CardHeader title="Comparison" badge={`${chosen.length} runs`} />
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#111]">
                <tr>
                  <th className="text-left font-medium px-3 py-2 text-[10px] uppercase tracking-wider text-slate-500 w-48">&nbsp;</th>
                  {chosen.map((e) => (
                    <th key={e.id} className="text-right font-medium px-3 py-2 text-slate-200">
                      <div className="truncate max-w-[220px] ml-auto">{e.name}</div>
                      <div className="text-[10px] text-slate-500 font-normal">{TYPE_LABEL[e.experiment_type] ?? e.experiment_type} · {e.created_at.slice(0, 10)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr><td colSpan={chosen.length + 1} className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-wider text-blue-400 font-bold">Parameters</td></tr>
                {paramKeys.map((k) => (
                  <tr key={k} className="border-t border-slate-800">
                    <td className="px-3 py-1.5 text-slate-500">{label(k)}</td>
                    {chosen.map((e) => (
                      <td key={e.id} className="px-3 py-1.5 text-right tabular-nums text-slate-300">{fmtVal(e.parameters[k])}</td>
                    ))}
                  </tr>
                ))}
                <tr><td colSpan={chosen.length + 1} className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-wider text-blue-400 font-bold">Metrics</td></tr>
                {metricKeys.map((k) => (
                  <tr key={k} className="border-t border-slate-800">
                    <td className="px-3 py-1.5 text-slate-500">{label(k)}</td>
                    {chosen.map((e) => (
                      <td key={e.id} className="px-3 py-1.5 text-right tabular-nums text-slate-100">{e.metrics[k] === undefined ? '—' : fmtVal(e.metrics[k])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-3 py-2 text-[10px] text-slate-600 border-t border-slate-800">
            Runs of different types or on different tickers and periods are not directly comparable; check the parameters above.
          </p>
        </Card>
      )}

      <Card noPadding>
        <CardHeader title="History" badge={`${rows.length}`} />
        {loading && <div className="p-4 space-y-2"><Skeleton variant="text" /><Skeleton variant="text" /><Skeleton variant="text" /></div>}
        {!loading && state?.err && <p className="p-8 text-center text-sm text-rose-300">{state.err}</p>}
        {!loading && !state?.err && rows.length === 0 && (
          <div className="p-10 text-center">
            <p className="text-sm text-slate-300">{(state?.rows?.length ?? 0) === 0 ? 'No experiments saved yet' : 'No experiments match your filters'}</p>
            {(state?.rows?.length ?? 0) === 0 && (
              <p className="text-xs text-slate-500 mt-1">Run a backtest or an ML evaluation and press Save to experiments. It will show up here.</p>
            )}
          </div>
        )}
        {!loading && rows.length > 0 && (
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#111] text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="w-8 px-3 py-2" />
                  <th className="text-left font-medium px-3 py-2">Name</th>
                  <th className="text-left font-medium px-3 py-2">Type</th>
                  <th className="text-left font-medium px-3 py-2">Symbol</th>
                  <th className="text-left font-medium px-3 py-2">Key metrics</th>
                  <th className="text-right font-medium px-3 py-2">Saved</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <React.Fragment key={e.id}>
                    <tr className={`border-t border-slate-800 hover:bg-white/[0.03] ${selected.includes(e.id) ? 'bg-blue-400/[0.06]' : ''}`}>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selected.includes(e.id)}
                          onChange={() => toggle(e.id)}
                          disabled={!selected.includes(e.id) && selected.length >= 4}
                          aria-label={`Select ${e.name} for comparison`}
                          className="accent-[#ff9f1a]"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <button onClick={() => setOpen(open === e.id ? null : e.id)} className="flex items-center gap-1.5 text-left text-slate-100 hover:text-blue-300">
                          {open === e.id ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
                          {e.name}
                        </button>
                      </td>
                      <td className="px-3 py-2"><span className="px-1.5 py-0.5 border border-slate-600 text-[10px] uppercase text-slate-400">{TYPE_LABEL[e.experiment_type] ?? e.experiment_type}</span></td>
                      <td className="px-3 py-2 font-bold text-slate-200">{String(e.parameters.symbol ?? '—')}</td>
                      <td className="px-3 py-2 text-slate-400 tabular-nums">
                        {headline(e).map(([k, v]) => (
                          <span key={k} className="mr-4">{k} <span className="text-slate-100">{v}</span></span>
                        ))}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-500">{e.created_at.slice(0, 16).replace('T', ' ')}</td>
                    </tr>
                    {open === e.id && (
                      <tr className="bg-[#080808]">
                        <td />
                        <td colSpan={5} className="px-3 py-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[11px]">
                            {([['Parameters', e.parameters], ['Metrics', e.metrics]] as const).map(([title, obj]) => (
                              <div key={title}>
                                <div className="text-[10px] uppercase tracking-wider text-blue-400 font-bold mb-1">{title}</div>
                                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5">
                                  {Object.entries(obj).map(([k, v]) => (
                                    <React.Fragment key={k}>
                                      <dt className="text-slate-500">{label(k)}</dt>
                                      <dd className="tabular-nums text-slate-200 text-right">{fmtVal(v)}</dd>
                                    </React.Fragment>
                                  ))}
                                </dl>
                              </div>
                            ))}
                          </div>
                          <button
                            onClick={() => remove(e)}
                            className="mt-3 inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-rose-400"
                          >
                            <Trash2 className="h-3 w-3" /> Delete experiment
                          </button>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
