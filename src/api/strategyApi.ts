import type {
  StrategyDefinition,
  MultiAssetBacktestResult,
  RandomWindowBacktestResult,
  BacktestHistoryItem,
} from '../types/strategy';

// ─── CRUD Functions ───────────────────────────────────────────────────────────

export async function getStrategies(filter?: {
  engineType?: string;
  tags?: string[];
}): Promise<StrategyDefinition[]> {
  const params = new URLSearchParams();
  if (filter?.engineType) params.set('engineType', filter.engineType);
  if (filter?.tags && filter.tags.length > 0) params.set('tags', filter.tags.join(','));

  const query = params.toString() ? `?${params}` : '';
  const res = await fetch(`/api/strategies${query}`);
  if (!res.ok) throw new Error(`Failed to fetch strategies: ${res.status}`);
  return res.json();
}

export async function getStrategy(id: string): Promise<StrategyDefinition> {
  const res = await fetch(`/api/strategies/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch strategy: ${res.status}`);
  return res.json();
}

export async function createStrategy(
  data: Omit<StrategyDefinition, 'id' | 'createdAt' | 'updatedAt'>
): Promise<StrategyDefinition> {
  const res = await fetch('/api/strategies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create strategy: ${res.status}`);
  return res.json();
}

export async function updateStrategy(
  id: string,
  data: Partial<Omit<StrategyDefinition, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<StrategyDefinition> {
  const res = await fetch(`/api/strategies/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to update strategy: ${res.status}`);
  return res.json();
}

export async function deleteStrategy(id: string): Promise<{ success: boolean }> {
  const res = await fetch(`/api/strategies/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Failed to delete strategy: ${res.status}`);
  return res.json();
}

// ─── Backtest Functions ───────────────────────────────────────────────────────

export async function runMultiAssetBacktest(
  strategyId: string,
  config: {
    symbols: string[];
    interval: string;
    startDate: string;
    endDate: string;
    params?: Record<string, unknown>;
  }
): Promise<MultiAssetBacktestResult> {
  const res = await fetch(`/api/strategies/${strategyId}/backtest/multi-asset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error(`Failed to run multi-asset backtest: ${res.status}`);
  return res.json();
}

export async function runRandomWindowBacktest(
  strategyId: string,
  config: {
    symbols: string[];
    interval: string;
    windowDays: number;
    lookbackYears: number;
    numWindows: number;
    params?: Record<string, unknown>;
  }
): Promise<RandomWindowBacktestResult> {
  const res = await fetch(`/api/strategies/${strategyId}/backtest/random-window`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error(`Failed to run random window backtest: ${res.status}`);
  return res.json();
}

export async function getBacktestHistory(strategyId: string): Promise<BacktestHistoryItem[]> {
  const res = await fetch(`/api/strategies/${strategyId}/backtest/history`);
  if (!res.ok) throw new Error(`Failed to fetch backtest history: ${res.status}`);
  return res.json();
}

export async function getBacktestDetail(
  strategyId: string,
  backtestId: string
): Promise<MultiAssetBacktestResult | RandomWindowBacktestResult> {
  const res = await fetch(`/api/strategies/${strategyId}/backtest/history/${backtestId}`);
  if (!res.ok) throw new Error(`Failed to fetch backtest detail: ${res.status}`);
  return res.json();
}
