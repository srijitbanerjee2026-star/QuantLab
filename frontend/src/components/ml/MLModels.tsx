'use client';

import React, { useMemo, useState } from 'react';
import { Play, Loader2, AlertTriangle, Save, Check } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { CardHeader } from '@/components/ui/CardHeader';
import { SymbolSearch } from '@/components/dashboard/SymbolSearch';
import { SeriesChart, ChartSeries } from '@/components/backtest/SeriesChart';
import { apiErrorMessage } from '@/lib/api/risk';
import { evaluateModel, saveExperiment, MlModelType, MlResult } from '@/lib/api/ml';

const MODELS: { id: MlModelType; label: string; blurb: string }[] = [
  { id: 'logistic_regression', label: 'Logistic Regression', blurb: 'Linear, fast, hard to overfit. A sensible baseline.' },
  { id: 'random_forest', label: 'Random Forest', blurb: 'Shallow trees, 200 estimators. Captures non-linear interactions.' },
  { id: 'gradient_boosting', label: 'Gradient Boosting', blurb: 'Small boosted trees. Most flexible, most prone to overfit.' },
];
const YEARS = [3, 5, 6, 10];
const STEPS = [21, 42, 63];

const pct = (v: number | null | undefined, d = 1) => (v === null || v === undefined ? '—' : `${(v * 100).toFixed(d)}%`);
const spct = (v: number | null | undefined, d = 1) => (v === null || v === undefined ? '—' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(d)}%`);
const tone = (v: number | null | undefined) => (v === null || v === undefined ? 'text-slate-200' : v >= 0 ? 'text-emerald-400' : 'text-rose-400');
const inputCls = 'w-full h-8 px-2 bg-[#050505] border border-slate-700 text-xs text-slate-100 tabular-nums outline-none focus:border-blue-400/70 select-text';

const Metric: React.FC<{ label: string; value: string; tone?: string; sub?: string; hint?: string }> = ({ label, value, tone: t, sub, hint }) => (
  <div className="px-3 py-2.5 border-r border-b border-slate-800" title={hint}>
    <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
    <div className={`text-base font-semibold tabular-nums mt-0.5 ${t ?? 'text-slate-100'}`}>{value}</div>
    {sub && <div className="text-[10px] text-slate-600 mt-0.5">{sub}</div>}
  </div>
);

/** Plain-language read-out. Deliberately conservative: a significant edge needs several things to line up. */
function verdict(r: MlResult): { good: boolean; title: string; body: string } {
  const m = r.metrics;
  const auc = m.auc ?? 0.5;
  if (m.edge_p_value < 0.05 && m.accuracy_edge > 0 && auc > 0.52) {
    return {
      good: true,
      title: 'Statistically better than the baseline in this sample',
      body: `Out-of-sample accuracy beat the majority-class baseline by ${(m.accuracy_edge * 100).toFixed(1)} pts (p = ${m.edge_p_value.toFixed(3)}, AUC ${auc.toFixed(2)}). That is encouraging, but one sample is not proof: re-test on other periods and tickers before trusting it.`,
    };
  }
  return {
    good: false,
    title: 'No reliable edge over the baseline',
    body: `Out-of-sample accuracy ${pct(m.accuracy)} versus ${pct(m.majority_baseline_accuracy)} for always guessing the more common direction (p = ${m.edge_p_value.toFixed(2)}, AUC ${auc.toFixed(2)}). This is the usual result for next-day direction: daily moves are very close to random.`,
  };
}

export const MLModels: React.FC<{ initialSymbol: string }> = ({ initialSymbol }) => {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [model, setModel] = useState<MlModelType>('logistic_regression');
  const [years, setYears] = useState(6);
  const [step, setStep] = useState(21);
  const [minTrain, setMinTrain] = useState(252);
  const [cost, setCost] = useState(5);

  const [result, setResult] = useState<MlResult | null>(null);
  const [runs, setRuns] = useState<MlResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<'idle' | 'saving' | 'ok' | 'err'>('idle');
  const [saveMsg, setSaveMsg] = useState('');

  const run = async () => {
    setLoading(true);
    setError(null);
    setSaved('idle');
    try {
      const r = await evaluateModel({ symbol, model_type: model, years, min_train: minTrain, step, cost_bps: cost });
      setResult(r);
      setRuns((prev) => [r, ...prev].slice(0, 12));
    } catch (e) {
      setResult(null);
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!result) return;
    setSaved('saving');
    try {
      await saveExperiment({
        name: `${result.symbol} ${MODELS.find((m) => m.id === result.model_type)?.label} walk-forward`,
        experiment_type: 'ml_model',
        parameters: { symbol: result.symbol, model_type: result.model_type, ...result.params, years, features: result.features.length },
        metrics: { ...result.metrics, as_of: result.latest.as_of, prob_up: result.latest.prob_up },
      });
      setSaved('ok');
      setSaveMsg('Saved to Experiments');
    } catch (e) {
      setSaved('err');
      setSaveMsg(apiErrorMessage(e).includes('Database') ? 'Database unavailable: could not save.' : 'Could not save the experiment.');
    }
  };

  const curve = useMemo<ChartSeries[]>(
    () =>
      result
        ? [
            { name: 'Model (long when P(up) > 50%)', color: '#ff9f1a', data: result.equity_curve.map((p) => ({ time: p.date, value: p.strategy })) },
            { name: `Buy & hold ${result.symbol}`, color: '#9a9a9a', dashed: true, data: result.equity_curve.map((p) => ({ time: p.date, value: p.buy_hold })) },
          ]
        : [],
    [result]
  );

  const v = result ? verdict(result) : null;
  const m = result?.metrics;
  const maxImp = result ? Math.max(...Object.values(result.feature_importance), 0.0001) : 1;

  return (
    <div className="space-y-3 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-lg font-semibold text-slate-100 tracking-tight">ML Models</h1>
        <p className="text-xs text-slate-500">
          Walk-forward test of a next-day direction model on any ticker. The model is retrained as time advances and only judged on days it
          never saw, then compared with a naive baseline. This is research tooling, not a trading signal.
        </p>
      </div>

      <div className="grid grid-cols-12 gap-3">
        <Card noPadding className="col-span-12 lg:col-span-3 self-start">
          <CardHeader title="Configuration" />
          <div className="p-3 space-y-3">
            <div>
              <span className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Instrument</span>
              <div className="flex items-center gap-2">
                <span className="h-8 px-2 flex items-center border border-slate-700 bg-[#111] text-blue-400 font-bold text-xs min-w-[64px] justify-center">{symbol}</span>
                <SymbolSearch onPick={setSymbol} placeholder="Change symbol…" className="flex-1" />
              </div>
            </div>

            <label className="block">
              <span className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Model</span>
              <select value={model} onChange={(e) => setModel(e.target.value as MlModelType)} className={inputCls}>
                {MODELS.map((x) => (
                  <option key={x.id} value={x.id}>{x.label}</option>
                ))}
              </select>
              <span className="block text-[10px] text-slate-600 mt-1">{MODELS.find((x) => x.id === model)?.blurb}</span>
            </label>

            <div>
              <span className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">History (years)</span>
              <div className="flex border border-slate-700">
                {YEARS.map((y) => (
                  <button key={y} onClick={() => setYears(y)} className={`flex-1 h-7 text-[11px] ${years === y ? 'bg-blue-400/15 text-blue-300' : 'text-slate-400 hover:bg-white/5'}`}>{y}Y</button>
                ))}
              </div>
            </div>

            <div>
              <span className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Retrain every (days)</span>
              <div className="flex border border-slate-700">
                {STEPS.map((s) => (
                  <button key={s} onClick={() => setStep(s)} className={`flex-1 h-7 text-[11px] ${step === s ? 'bg-blue-400/15 text-blue-300' : 'text-slate-400 hover:bg-white/5'}`}>{s}</button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Min train days</span>
                <input type="number" min={60} step={21} value={minTrain} onChange={(e) => setMinTrain(Number(e.target.value))} className={inputCls} />
              </label>
              <label className="block">
                <span className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Costs (bps)</span>
                <input type="number" min={0} value={cost} onChange={(e) => setCost(Number(e.target.value))} className={inputCls} />
              </label>
            </div>

            <button
              onClick={run}
              disabled={loading || minTrain < 60}
              className="w-full h-9 flex items-center justify-center gap-2 bg-blue-400 text-black font-bold text-xs tracking-wider uppercase disabled:opacity-40 hover:bg-blue-300"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-black" />}
              {loading ? 'Evaluating…' : 'Run walk-forward'}
            </button>
            <p className="text-[10px] text-slate-600 leading-relaxed">
              Features are stationary ratios available at each close (momentum, volatility, RSI, MACD, distance to averages, volume). Each
              fold trains only on the past, with the boundary label purged. Tree models can take 10–40 s.
            </p>
          </div>
        </Card>

        <div className="col-span-12 lg:col-span-9 space-y-3 min-w-0">
          {!result && !loading && !error && (
            <Card className="!p-10 text-center">
              <p className="text-sm text-slate-300">No evaluation yet</p>
              <p className="text-xs text-slate-500 mt-1">Pick a ticker and model, then run the walk-forward test.</p>
            </Card>
          )}
          {loading && (
            <Card className="!p-10 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-400" /> Retraining {MODELS.find((x) => x.id === model)?.label} every {step} days on {symbol}…
            </Card>
          )}
          {error && (
            <Card className="!p-4 border-rose-500/40">
              <div className="flex items-start gap-2 text-sm text-rose-300">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold">Evaluation failed</div>
                  <div className="text-xs text-slate-400 mt-0.5">{error}</div>
                </div>
              </div>
            </Card>
          )}

          {result && m && v && (
            <>
              <Card className={`!p-3 ${v.good ? 'border-emerald-500/40' : 'border-amber-400/40'}`}>
                <div className={`text-sm font-semibold ${v.good ? 'text-emerald-400' : 'text-amber-400'}`}>{v.title}</div>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{v.body}</p>
              </Card>

              <Card noPadding>
                <CardHeader
                  title={`${result.symbol} · ${MODELS.find((x) => x.id === result.model_type)?.label}`}
                  badge="Out-of-sample"
                  subtitle={`${result.first_test_date} → ${result.last_test_date} · ${m.oos_observations} days · ${result.n_folds} folds`}
                  actions={
                    <button
                      onClick={save}
                      disabled={saved === 'saving' || saved === 'ok'}
                      className="flex items-center gap-1 text-[11px] text-slate-300 hover:text-blue-300 disabled:opacity-60"
                    >
                      {saved === 'ok' ? <Check className="h-3 w-3 text-emerald-400" /> : saved === 'saving' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                      {saved === 'ok' ? 'Saved' : 'Save to experiments'}
                    </button>
                  }
                />
                {saved !== 'idle' && saved !== 'saving' && (
                  <div className={`px-3 py-1 text-[11px] border-b border-slate-800 ${saved === 'ok' ? 'text-emerald-400' : 'text-rose-300'}`}>{saveMsg}</div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-6">
                  <Metric label="Accuracy" value={pct(m.accuracy)} sub={`baseline ${pct(m.majority_baseline_accuracy)}`} hint="Share of days the direction was right, out-of-sample" />
                  <Metric label="Edge vs baseline" value={`${m.accuracy_edge >= 0 ? '+' : ''}${(m.accuracy_edge * 100).toFixed(1)} pts`} tone={tone(m.accuracy_edge)} sub={`p = ${m.edge_p_value.toFixed(3)}`} hint="One-sided binomial test against the majority-class rate" />
                  <Metric label="AUC" value={m.auc === null ? '—' : m.auc.toFixed(3)} sub="0.50 = coin flip" />
                  <Metric label="Precision (up)" value={pct(m.precision_up)} />
                  <Metric label="Recall (up)" value={pct(m.recall_up)} />
                  <Metric label="Brier score" value={m.brier.toFixed(3)} sub="0.25 = coin flip" />
                  <Metric label="Model return" value={spct(m.strategy_return)} tone={tone(m.strategy_return)} sub={`${pct(m.pct_days_long, 0)} of days long`} />
                  <Metric label="Buy & hold" value={spct(m.buy_hold_return)} tone={tone(m.buy_hold_return)} />
                  <Metric label="Model Sharpe" value={m.strategy_sharpe === null ? '—' : m.strategy_sharpe.toFixed(2)} />
                  <Metric label="Model max DD" value={spct(m.strategy_max_drawdown)} tone="text-rose-400" />
                  <Metric label="Buy & hold max DD" value={spct(m.buy_hold_max_drawdown)} tone="text-rose-400" />
                  <Metric label="Up-day base rate" value={pct(m.base_rate_up)} />
                </div>
              </Card>

              <Card noPadding>
                <CardHeader title="Out-of-sample growth of 1.00" subtitle={`Long when P(up) > 50% · costs ${result.params.cost_bps} bps`} />
                <div className="h-[300px] p-2"><SeriesChart series={curve} /></div>
                <div className="px-3 pb-2 flex flex-wrap gap-4 text-[11px] text-slate-400">
                  {curve.map((s) => (
                    <span key={s.name} className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5" style={{ background: s.color }} />{s.name}</span>
                  ))}
                </div>
              </Card>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                <Card noPadding>
                  <CardHeader title="Feature importance" subtitle="Final model, all data" />
                  <div className="p-3 space-y-1.5">
                    {Object.entries(result.feature_importance).map(([k, val]) => (
                      <div key={k} className="flex items-center gap-2 text-[11px]">
                        <span className="w-28 text-slate-400 truncate">{k}</span>
                        <div className="flex-1 h-2 bg-slate-800"><div className="h-2 bg-blue-400" style={{ width: `${(val / maxImp) * 100}%` }} /></div>
                        <span className="w-12 text-right tabular-nums text-slate-300">{pct(val)}</span>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card noPadding>
                  <CardHeader title="Latest model output" badge={`as of ${result.latest.as_of}`} />
                  <div className="p-4">
                    {result.latest.prob_up === null ? (
                      <p className="text-xs text-slate-500">Latest features are incomplete, so no output is shown.</p>
                    ) : (
                      <>
                        <div className="flex items-end gap-3">
                          <div>
                            <div className="text-[10px] uppercase tracking-wider text-slate-500">P(next day up)</div>
                            <div className="text-3xl font-semibold tabular-nums text-slate-100">{pct(result.latest.prob_up)}</div>
                          </div>
                          <span className={`mb-1 px-2 py-0.5 text-[10px] font-bold border ${result.latest.signal === 'LONG' ? 'border-emerald-500/50 text-emerald-400' : 'border-slate-600 text-slate-400'}`}>
                            {result.latest.signal}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
                          A probability near 50% means the model has no view. {v.good ? '' : 'Given the evaluation above, treat this output as noise. '}It is not investment advice.
                        </p>
                      </>
                    )}
                  </div>
                </Card>
              </div>
            </>
          )}

          {runs.length > 1 && (
            <Card noPadding>
              <CardHeader title="Model comparison" badge="This session" subtitle="Every run since you opened this page" />
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-[#111] text-[10px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="text-left font-medium px-3 py-2">Symbol</th>
                      <th className="text-left font-medium px-3 py-2">Model</th>
                      <th className="text-right font-medium px-3 py-2">Accuracy</th>
                      <th className="text-right font-medium px-3 py-2">Baseline</th>
                      <th className="text-right font-medium px-3 py-2">AUC</th>
                      <th className="text-right font-medium px-3 py-2">p-value</th>
                      <th className="text-right font-medium px-3 py-2">Model ret.</th>
                      <th className="text-right font-medium px-3 py-2">B&amp;H ret.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((r, i) => (
                      <tr key={i} className={`border-t border-slate-800 ${r === result ? 'bg-blue-400/[0.07]' : ''}`}>
                        <td className="px-3 py-1.5 font-bold text-slate-100">{r.symbol}</td>
                        <td className="px-3 py-1.5 text-slate-300">{MODELS.find((x) => x.id === r.model_type)?.label}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{pct(r.metrics.accuracy)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">{pct(r.metrics.majority_baseline_accuracy)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{r.metrics.auc?.toFixed(3) ?? '—'}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{r.metrics.edge_p_value.toFixed(3)}</td>
                        <td className={`px-3 py-1.5 text-right tabular-nums ${tone(r.metrics.strategy_return)}`}>{spct(r.metrics.strategy_return)}</td>
                        <td className={`px-3 py-1.5 text-right tabular-nums ${tone(r.metrics.buy_hold_return)}`}>{spct(r.metrics.buy_hold_return)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {result && (
            <p className="text-[10px] text-slate-600">
              Data: {result.data_source}. Walk-forward with an expanding window, retrained every {result.params.step} days from a minimum of{' '}
              {result.params.min_train} days. Metrics use only predictions on days the model had not seen. Past results do not predict the future.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
