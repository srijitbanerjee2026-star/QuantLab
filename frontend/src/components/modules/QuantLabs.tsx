import React, { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ComposedChart,
} from 'recharts';
import {
  SeasonalityData,
  MLPredictorData,
  ExperimentItem,
} from '@/types';
import { ChartFrame } from '@/components/charts/ChartFrame';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { Stat } from '@/components/ui/Stat';
import { Card } from '@/components/ui/Card';
import { CardHeader } from '@/components/ui/CardHeader';
import { fmtPct, fmtRatio, fmtPrice } from '@/lib/format';
import { Cpu, Calendar, Database, Play, ChevronDown, ChevronRight, Save } from 'lucide-react';

export interface QuantLabsProps {
  symbol: string;
  subView: 'seasonality' | 'ml_predictor' | 'experiments';
  seasonalityData: SeasonalityData | null;
  seasonalityLoading: boolean;
  mlData: MLPredictorData | null;
  mlLoading: boolean;
  experimentsData: ExperimentItem[] | null;
  experimentsLoading: boolean;
  onRefreshSeasonality: () => void;
  onTrainML: (modelType: string) => void;
  onRefreshExperiments: () => void;
  onLogExperiment?: () => void;
}

export const QuantLabs: React.FC<QuantLabsProps> = ({
  symbol,
  subView,
  seasonalityData,
  seasonalityLoading,
  mlData,
  mlLoading,
  experimentsData,
  experimentsLoading,
  onRefreshSeasonality,
  onTrainML,
  onRefreshExperiments,
  onLogExperiment,
}) => {
  const [selectedModel, setSelectedModel] = useState<string>('Random Forest');
  const [expandedExperimentId, setExpandedExperimentId] = useState<string | null>(null);

  // ---------------- Sub-View 1: Seasonality ----------------
  if (subView === 'seasonality') {
    return (
      <div className="space-y-4">
        {/* KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat
            label="Analyzed Asset"
            value={`$${symbol}`}
            subtext="Monthly Cyclical Profiling"
            valueColor="text-white"
          />
          <Stat
            label="Strongest Seasonal Month"
            value={seasonalityData ? seasonalityData.bestMonth : '—'}
            subtext="Highest Historical Return"
            valueColor="text-emerald-400"
          />
          <Stat
            label="Weakest Seasonal Month"
            value={seasonalityData ? seasonalityData.worstMonth : '—'}
            subtext="Lowest Average Performance"
            valueColor="text-rose-400"
          />
          <Stat
            label="Annual Positive Win Rate"
            value={seasonalityData ? `${seasonalityData.overallWinRate.toFixed(1)}%` : '—'}
            subtext="Positive Months Ratio"
            valueColor="text-cyan-400"
          />
        </div>

        {/* Box/Violin Style Monthly Distribution */}
        <ChartFrame
          title={`${symbol} Monthly Return Dispersion (Jan–Dec)`}
          badge="Median & IQR"
          subtitle="Composed Monthly Median Bar with Interquartile Bounds"
          heightClass="h-[360px]"
          loading={seasonalityLoading}
          onRetry={onRefreshSeasonality}
          exportData={seasonalityData?.monthlyDistribution}
          exportFilename={`${symbol}_monthly_seasonality.csv`}
        >
          {seasonalityData && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={seasonalityData.monthlyDistribution}
                margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(51, 65, 85, 0.35)" vertical={false} />
                <XAxis
                  dataKey="month"
                  stroke="#64748b"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#cbd5e1', fontFamily: 'monospace' }}
                />
                <YAxis
                  stroke="#64748b"
                  axisLine={false}
                  tickLine={false}
                  unit="%"
                  tick={{ fontSize: 10, fill: '#64748b', fontFamily: 'monospace' }}
                />
                <Tooltip
                  content={
                    <ChartTooltip
                      unit="%"
                      formatValue={(v) => fmtPct(v)}
                    />
                  }
                />
                <ReferenceLine y={0} stroke="#475569" />
                <Bar dataKey="median" name="Median Return %" radius={[2, 2, 0, 0]}>
                  {seasonalityData.monthlyDistribution.map((entry, index) => (
                    <Cell
                      key={`month-${index}`}
                      fill={entry.median >= 0 ? '#10b981' : '#ef4444'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartFrame>

        {/* Year × Month Return Heatmap Table */}
        <Card noPadding className="overflow-hidden">
          <CardHeader
            title="Year × Month Return Performance Matrix"
            badge="Historical Heatmap"
            subtitle="Percentage Gain/Loss by Calendar Month"
          />
          <div className="p-3 overflow-x-auto">
            <table className="w-full text-center border-collapse text-xs font-mono">
              <thead>
                <tr>
                  <th className="p-2 border border-slate-800 text-left text-slate-500 uppercase text-[10px]">
                    Year
                  </th>
                  {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(
                    (m) => (
                      <th key={m} className="p-2 border border-slate-800 text-slate-300 font-bold text-[10px]">
                        {m}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {seasonalityData?.years.map((yr) => (
                  <tr key={yr}>
                    <td className="p-2 border border-slate-800 font-bold text-left text-slate-300 bg-slate-900/60">
                      {yr}
                    </td>
                    {Array.from({ length: 12 }).map((_, mIdx) => {
                      const cell = seasonalityData.yearMonthHeatmap.find(
                        (h) => h.year === yr && h.month === mIdx + 1
                      );
                      const ret = cell ? cell.returnPct : 0;
                      const isPos = ret > 0;
                      const isNeg = ret < 0;

                      let bg = 'bg-slate-900/40 text-slate-400';
                      if (ret >= 5.0) bg = 'bg-emerald-600/80 text-emerald-100 font-bold';
                      else if (ret > 0) bg = 'bg-emerald-950/60 text-emerald-300';
                      else if (ret <= -5.0) bg = 'bg-rose-700/80 text-rose-100 font-bold';
                      else if (ret < 0) bg = 'bg-rose-950/60 text-rose-300';

                      return (
                        <td key={mIdx} className={`p-2 border border-slate-800 tabular-nums ${bg}`}>
                          {ret > 0 ? `+${ret.toFixed(1)}` : ret.toFixed(1)}%
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  }

  // ---------------- Sub-View 2: ML Direction Predictor ----------------
  if (subView === 'ml_predictor') {
    return (
      <div className="space-y-4">
        {/* ML Control & KPI Strip */}
        <div className="bg-[#0c111d] border border-slate-800/80 p-3 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <span className="text-[10px] uppercase font-bold text-slate-500">Model Architecture:</span>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="Random Forest">Random Forest Classifier (Ensemble)</option>
              <option value="Gradient Boosted">Gradient Boosted Decision Trees</option>
              <option value="Logistic Regression">L2 Logistic Regression</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => onTrainML(selectedModel)}
            disabled={mlLoading}
            className="flex items-center space-x-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded transition shadow-sm"
          >
            <Play className={`h-3.5 w-3.5 fill-white ${mlLoading ? 'animate-spin' : ''}`} />
            <span>{mlLoading ? 'TRAINING HYPERPARAMETERS...' : 'TRAIN MODEL'}</span>
          </button>
        </div>

        {/* Prediction Banner & Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat
            label="Next-Day Predicted Signal"
            value={mlData ? mlData.prediction : '—'}
            subtext={mlData ? `Confidence: ${(mlData.confidence * 100).toFixed(1)}%` : '—'}
            valueColor={mlData && mlData.prediction === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}
          />
          <Stat
            label="Out-of-Sample Accuracy"
            value={mlData ? `${(mlData.accuracy * 100).toFixed(1)}%` : '—'}
            subtext="Baseline Random: 50.0%"
            valueColor="text-blue-400"
          />
          <Stat
            label="ROC-AUC Score"
            value={mlData ? mlData.aucRoc.toFixed(3) : '—'}
            subtext="Discriminative Capability"
            valueColor="text-purple-400"
          />
          <Stat
            label="Target Instrument"
            value={`$${symbol}`}
            subtext="Daily Binary Directional"
            valueColor="text-white"
          />
        </div>

        {/* Feature Importance & Walk-Forward Accuracy */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Feature Importance */}
          <ChartFrame
            title="Feature Importance Weights (Gini Impurity)"
            badge="Top Predictive Signals"
            subtitle="Relative contribution to tree partition decisions"
            heightClass="h-[340px]"
            loading={mlLoading}
            exportData={mlData?.featureImportance}
            exportFilename={`${symbol}_feature_importance.csv`}
          >
            {mlData && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={mlData.featureImportance}
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 40, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(51, 65, 85, 0.35)" horizontal={false} />
                  <XAxis
                    type="number"
                    stroke="#64748b"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }}
                  />
                  <YAxis
                    type="category"
                    dataKey="feature"
                    stroke="#94a3b8"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#cbd5e1', fontFamily: 'monospace' }}
                  />
                  <Tooltip
                    content={
                      <ChartTooltip
                        formatValue={(v) => v.toFixed(3)}
                      />
                    }
                  />
                  <Bar dataKey="importance" fill="#06b6d4" radius={[0, 2, 2, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartFrame>

          {/* Walk-Forward Accuracy */}
          <ChartFrame
            title="Walk-Forward Validation Accuracy"
            badge="Over Time"
            subtitle="Weekly Rolling Model Test Accuracy vs 50% Baseline"
            heightClass="h-[340px]"
            loading={mlLoading}
            exportData={mlData?.walkForward}
            exportFilename={`${symbol}_walk_forward.csv`}
          >
            {mlData && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mlData.walkForward} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(51, 65, 85, 0.35)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="#64748b"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }}
                  />
                  <YAxis
                    stroke="#64748b"
                    axisLine={false}
                    tickLine={false}
                    domain={[0.4, 0.8]}
                    tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }}
                    tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                  />
                  <Tooltip
                    content={
                      <ChartTooltip
                        unit="%"
                        formatValue={(v) => `${(v * 100).toFixed(1)}%`}
                      />
                    }
                  />
                  <ReferenceLine
                    y={0.5}
                    stroke="#ef4444"
                    strokeDasharray="3 3"
                    label={{ value: 'Random 50%', fill: '#ef4444', fontSize: 9, position: 'insideTopLeft' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="accuracy"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="Test Accuracy"
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </ChartFrame>
        </div>

        {/* Confusion Matrix Card */}
        {mlData && (
          <Card noPadding>
            <CardHeader
              title="Test Set Confusion Matrix"
              badge="Binary Classification"
              subtitle="Model Predicted Signal vs Ground Truth Outcome"
            />
            <div className="p-4 grid grid-cols-2 max-w-sm mx-auto gap-2 text-center text-xs font-mono">
              <div className="bg-emerald-950/40 border border-emerald-800/60 p-3 rounded">
                <span className="text-slate-400 text-[10px] block">True Positive (BUY)</span>
                <span className="text-xl font-bold text-emerald-400 mt-1 block">
                  {mlData.confusionMatrix.truePositive}
                </span>
              </div>
              <div className="bg-rose-950/40 border border-rose-800/60 p-3 rounded">
                <span className="text-slate-400 text-[10px] block">False Positive</span>
                <span className="text-xl font-bold text-rose-400 mt-1 block">
                  {mlData.confusionMatrix.falsePositive}
                </span>
              </div>
              <div className="bg-rose-950/40 border border-rose-800/60 p-3 rounded">
                <span className="text-slate-400 text-[10px] block">False Negative</span>
                <span className="text-xl font-bold text-rose-400 mt-1 block">
                  {mlData.confusionMatrix.falseNegative}
                </span>
              </div>
              <div className="bg-emerald-950/40 border border-emerald-800/60 p-3 rounded">
                <span className="text-slate-400 text-[10px] block">True Negative (SELL)</span>
                <span className="text-xl font-bold text-emerald-400 mt-1 block">
                  {mlData.confusionMatrix.trueNegative}
                </span>
              </div>
            </div>
          </Card>
        )}
      </div>
    );
  }

  // ---------------- Sub-View 3: Logged Experiments ----------------
  const experiments = experimentsData || [];

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="flex items-center justify-between bg-[#0c111d] border border-slate-800/80 p-3 rounded-lg text-xs font-mono">
        <div>
          <h2 className="text-sm font-bold text-white tracking-wide">Institutional Experiment Registry</h2>
          <p className="text-[11px] text-slate-400">Archived parameter configs, metrics, and equity sparklines</p>
        </div>

        {onLogExperiment && (
          <button
            type="button"
            onClick={onLogExperiment}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded transition"
          >
            <Save className="h-3.5 w-3.5" />
            <span>LOG CURRENT RUN</span>
          </button>
        )}
      </div>

      {/* Dense Sortable Table with Expandable Rows */}
      <Card noPadding className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs font-mono text-left">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-[10px] uppercase font-bold text-slate-400">
                <th className="p-3 w-8"></th>
                <th className="p-3">ID</th>
                <th className="p-3">Experiment Name</th>
                <th className="p-3">Model Type</th>
                <th className="p-3">Target</th>
                <th className="p-3 text-right">Sharpe</th>
                <th className="p-3 text-right">Total Return</th>
                <th className="p-3 text-right">Max DD</th>
                <th className="p-3">Status</th>
                <th className="p-3">Equity Sparkline</th>
                <th className="p-3">Logged Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {experiments.map((exp) => {
                const isExpanded = expandedExperimentId === exp.id;
                return (
                  <React.Fragment key={exp.id}>
                    <tr
                      onClick={() => setExpandedExperimentId(isExpanded ? null : exp.id)}
                      className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                    >
                      <td className="p-3 text-slate-500">
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 text-blue-400" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                      </td>
                      <td className="p-3 text-blue-400 font-bold">{exp.id}</td>
                      <td className="p-3 font-semibold text-white truncate max-w-[200px]">{exp.name}</td>
                      <td className="p-3 text-slate-300">{exp.type}</td>
                      <td className="p-3 font-bold text-slate-200">${exp.targetSymbol}</td>
                      <td className="p-3 text-right font-bold text-blue-400">{exp.sharpe.toFixed(2)}</td>
                      <td
                        className={`p-3 text-right font-bold ${
                          exp.returnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {fmtPct(exp.returnPct)}
                      </td>
                      <td className="p-3 text-right text-rose-400 font-semibold">{fmtPct(exp.maxDrawdown)}</td>
                      <td className="p-3">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                          {exp.status}
                        </span>
                      </td>
                      <td className="p-3">
                        {/* Mini SVG Sparkline */}
                        <svg width={64} height={18} className="overflow-visible">
                          <polyline
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            points={exp.sparkline
                              .map(
                                (p, i) =>
                                  `${(i / (exp.sparkline.length - 1)) * 64},${
                                    18 - ((p - 90) / 60) * 16
                                  }`
                              )
                              .join(' ')}
                          />
                        </svg>
                      </td>
                      <td className="p-3 text-slate-500 text-[10px]">{exp.created_at}</td>
                    </tr>

                    {/* Expandable Parameter Inspector Row */}
                    {isExpanded && (
                      <tr className="bg-slate-950/80">
                        <td colSpan={11} className="p-4 border-y border-slate-800">
                          <div className="space-y-2">
                            <span className="text-[10px] uppercase font-bold text-slate-500 font-mono">
                              Execution Parameters & Hyperparameters:
                            </span>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {Object.entries(exp.params).map(([k, v]) => (
                                <div key={k} className="p-2 bg-slate-900 border border-slate-800 rounded">
                                  <span className="text-[9px] uppercase text-slate-500 block truncate">{k}</span>
                                  <span className="text-xs font-bold text-slate-200 mt-0.5 block truncate">
                                    {String(v)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
