// Typed ML + experiments clients. No mock fallbacks: failures are surfaced to the UI.
import { apiClient } from '@/lib/api';

export type MlModelType = 'logistic_regression' | 'random_forest' | 'gradient_boosting';

export interface MlMetrics {
  oos_observations: number;
  accuracy: number;
  base_rate_up: number;
  majority_baseline_accuracy: number;
  accuracy_edge: number;
  edge_p_value: number;
  precision_up: number;
  recall_up: number;
  auc: number | null;
  brier: number;
  pct_days_long: number;
  strategy_return: number;
  buy_hold_return: number;
  strategy_sharpe: number | null;
  strategy_max_drawdown: number;
  buy_hold_max_drawdown: number;
}

export interface MlResult {
  symbol: string;
  model_type: MlModelType;
  features: string[];
  n_rows: number;
  n_folds: number;
  first_test_date: string;
  last_test_date: string;
  metrics: MlMetrics;
  feature_importance: Record<string, number>;
  latest: { as_of: string; prob_up: number | null; signal: 'LONG' | 'FLAT' | null };
  equity_curve: { date: string; strategy: number; buy_hold: number }[];
  params: { min_train: number; step: number; cost_bps: number };
  data_source: string;
}

export interface MlRequest {
  symbol: string;
  model_type: MlModelType;
  years: number;
  min_train: number;
  step: number;
  cost_bps: number;
}

export interface ExperimentRecord {
  id: number;
  name: string;
  experiment_type: string;
  parameters: Record<string, unknown>;
  metrics: Record<string, unknown>;
  created_at: string;
}

export interface ExperimentCreate {
  name: string;
  experiment_type: string;
  parameters: Record<string, unknown>;
  metrics: Record<string, unknown>;
}

export async function evaluateModel(req: MlRequest): Promise<MlResult> {
  const res = await apiClient.post<MlResult>('/ml/evaluate', req, { timeout: 240000 });
  return res.data;
}

export async function listExperiments(): Promise<ExperimentRecord[]> {
  const res = await apiClient.get<ExperimentRecord[]>('/experiments/', { timeout: 30000 });
  return res.data;
}

export async function saveExperiment(body: ExperimentCreate): Promise<ExperimentRecord> {
  const res = await apiClient.post<ExperimentRecord>('/experiments/', body, { timeout: 30000 });
  return res.data;
}

export async function deleteExperiment(id: number): Promise<void> {
  await apiClient.delete(`/experiments/${id}`, { timeout: 30000 });
}
