import { useState, useEffect, useCallback } from 'react';
import { Brain, Activity, TrendingUp, TrendingDown, AlertTriangle, RefreshCw, Zap, BarChart2, Clock, GitBranch } from 'lucide-react';

const QUANT_URL = 'http://localhost:8002';

interface AgentStatus {
  name: string;
  state: 'idle' | 'running' | 'error' | 'timeout';
  last_run?: string;
  last_error?: string;
}

interface ApprovedStrategy {
  strategy_key: string;
  backtest_metrics: Record<string, number>;
  approved_at: string;
  status: 'active' | 'retired' | 'decayed';
  lineage_id: string;
  mutation_count: number;
  bot_id?: string;
}

interface StrategyAllocation {
  strategy_key: string;
  weight: number;
  capital_usdt: number;
  volatility: number;
}

interface DecayEvent {
  strategy_key: string;
  decay_score: number;
  consecutive_losses: number;
  rolling_sharpe_30d: number;
  max_drawdown_7d: number;
  action: string;
  timestamp: string;
}

interface CycleHistory {
  cycle_id: string;
  started_at: string;
  completed_at: string;
  strategies_generated: number;
  strategies_approved: number;
  strategies_rejected: number;
  errors: unknown[];
}

interface SentimentScore {
  symbol: string;
  score: number;
  funding_rate: number;
  oi_change_pct: number;
  timestamp: string;
  components: Record<string, number>;
}

const STATE_COLOR: Record<string, string> = {
  idle: 'var(--text-muted)',
  running: '#faad14',
  error: 'var(--loss-color)',
  timeout: '#ff7875',
};

const STATUS_COLOR: Record<string, string> = {
  active: 'var(--profit-color)',
  retired: 'var(--text-muted)',
  decayed: 'var(--loss-color)',
};

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 60 ? 'var(--profit-color)' : score <= 40 ? 'var(--loss-color)' : '#faad14';
  const label = score >= 60 ? 'Bullish' : score <= 40 ? 'Bearish' : 'Neutral';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
      <div style={{ fontSize: '1.8rem', fontWeight: 700, color }}>{score.toFixed(1)}</div>
      <div style={{ fontSize: '0.75rem', color, fontWeight: 600 }}>{label}</div>
      <div style={{ width: '80px', height: '6px', background: 'var(--bg-dark)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: '3px', transition: 'width 0.5s' }} />
      </div>
    </div>
  );
}

function AgentCard({ name, status }: { name: string; status: AgentStatus | undefined }) {
  const state = status?.state ?? 'idle';
  const color = STATE_COLOR[state] ?? 'var(--text-muted)';
  const lastRun = status?.last_run ? new Date(status.last_run).toLocaleTimeString() : '—';
  return (
    <div className="glass-panel" style={{ padding: '0.9rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-main)' }}>{name}</span>
        <span style={{ fontSize: '0.75rem', color, fontWeight: 600, textTransform: 'uppercase' }}>● {state}</span>
      </div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Last run: {lastRun}</div>
      {status?.last_error && (
        <div style={{ fontSize: '0.7rem', color: 'var(--loss-color)', background: 'rgba(246,70,93,0.08)', padding: '0.2rem 0.4rem', borderRadius: '3px', wordBreak: 'break-all' }}>
          {status.last_error}
        </div>
      )}
    </div>
  );
}

export default function QuantEngine() {
  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatus>>({});
  const [strategies, setStrategies] = useState<ApprovedStrategy[]>([]);
  const [allocations, setAllocations] = useState<StrategyAllocation[]>([]);
  const [decayEvents, setDecayEvents] = useState<DecayEvent[]>([]);
  const [cycleHistory, setCycleHistory] = useState<CycleHistory[]>([]);
  const [sentimentScores, setSentimentScores] = useState<SentimentScore[]>([]);
  const [isOnline, setIsOnline] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'strategies' | 'sentiment' | 'history'>('overview');

  const SYMBOLS = ['BTCUSDT', 'ETHUSDT'];

  const fetchAll = useCallback(async () => {
    try {
      const healthRes = await fetch(`${QUANT_URL}/health`);
      if (!healthRes.ok) { setIsOnline(false); return; }
      setIsOnline(true);

      const [statusRes, strategiesRes, allocRes, decayRes, historyRes] = await Promise.allSettled([
        fetch(`${QUANT_URL}/status`),
        fetch(`${QUANT_URL}/strategies`),
        fetch(`${QUANT_URL}/strategies/allocations?total_capital=10000`),
        fetch(`${QUANT_URL}/loop/history`),
        fetch(`${QUANT_URL}/loop/history`),
      ]);

      if (statusRes.status === 'fulfilled' && statusRes.value.ok) {
        const d = await statusRes.value.json();
        setAgentStatuses(d.agents ?? {});
      }
      if (strategiesRes.status === 'fulfilled' && strategiesRes.value.ok) {
        setStrategies(await strategiesRes.value.json());
      }
      if (allocRes.status === 'fulfilled' && allocRes.value.ok) {
        setAllocations(await allocRes.value.json());
      }
      if (decayRes.status === 'fulfilled' && decayRes.value.ok) {
        const hist = await decayRes.value.json() as CycleHistory[];
        setCycleHistory(hist);
      }
      if (historyRes.status === 'fulfilled' && historyRes.value.ok) {
        const hist = await historyRes.value.json() as CycleHistory[];
        setCycleHistory(hist);
      }

      // Fetch sentiment for each symbol
      const sentResults = await Promise.allSettled(
        SYMBOLS.map(s => fetch(`${QUANT_URL}/sentiment/${s}`).then(r => r.ok ? r.json() : null))
      );
      const scores = sentResults
        .filter(r => r.status === 'fulfilled' && r.value)
        .map(r => (r as PromiseFulfilledResult<SentimentScore>).value);
      setSentimentScores(scores);

      setLastRefresh(new Date());
    } catch {
      setIsOnline(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 15000);
    return () => clearInterval(id);
  }, [fetchAll]);

  const triggerCycle = async () => {
    setIsTriggering(true);
    try {
      await fetch(`${QUANT_URL}/loop/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: 'momentum and mean-reversion hybrid strategy for crypto futures' }),
      });
      setTimeout(fetchAll, 2000);
    } finally {
      setIsTriggering(false);
    }
  };

  const activeCount = strategies.filter(s => s.status === 'active').length;
  const decayedCount = strategies.filter(s => s.status === 'decayed').length;
  const runningAgents = Object.values(agentStatuses).filter(a => a.state === 'running').length;

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'strategies', label: `Strategies (${strategies.length})` },
    { id: 'sentiment', label: 'Sentiment' },
    { id: 'history', label: 'Cycle History' },
  ] as const;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Header */}
      <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Brain size={28} color="var(--accent-primary)" />
          <div>
            <h2 style={{ margin: 0, fontSize: '1.3rem' }}>Evolutionary Quant Engine</h2>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {isOnline ? '● Online — quant-engine:8002' : '○ Offline — quant-engine:8002 unreachable'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {lastRefresh && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Updated {lastRefresh.toLocaleTimeString()}</span>}
          <button className="btn-outline" onClick={fetchAll} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', padding: '0.4rem 0.8rem' }}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="btn-primary" onClick={triggerCycle} disabled={!isOnline || isTriggering}
            style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', padding: '0.4rem 0.9rem' }}>
            <Zap size={14} /> {isTriggering ? 'Running...' : 'Trigger Cycle'}
          </button>
        </div>
      </div>

      {!isOnline && (
        <div style={{ background: 'rgba(246,70,93,0.1)', border: '1px solid var(--loss-color)', borderRadius: '8px', padding: '1rem', color: 'var(--loss-color)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <AlertTriangle size={16} /> quant-engine service is not reachable. Make sure it's running on port 8002.
        </div>
      )}

      {/* Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
        {[
          { label: 'Active Strategies', value: activeCount, icon: <TrendingUp size={20} />, color: 'var(--profit-color)' },
          { label: 'Decayed', value: decayedCount, icon: <TrendingDown size={20} />, color: decayedCount > 0 ? 'var(--loss-color)' : 'var(--text-muted)' },
          { label: 'Agents Running', value: runningAgents, icon: <Activity size={20} />, color: runningAgents > 0 ? '#faad14' : 'var(--text-muted)' },
          { label: 'Cycles Run', value: cycleHistory.length, icon: <GitBranch size={20} />, color: 'var(--accent-primary)' },
        ].map((s, i) => (
          <div key={i} className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>{s.label}</p>
              <h2 style={{ margin: 0, color: s.color }}>{s.value}</h2>
            </div>
            <div style={{ color: s.color }}>{s.icon}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--border-color)' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.6rem 1.2rem', fontSize: '0.9rem',
              color: activeTab === t.id ? 'var(--accent-primary)' : 'var(--text-muted)',
              borderBottom: activeTab === t.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
              fontWeight: activeTab === t.id ? 600 : 400 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Agent Status Grid */}
          <div className="glass-panel">
            <h3 style={{ margin: '0 0 1rem' }}>Agent Status</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem' }}>
              {['sentiment_agent', 'data_agent', 'alpha_agent', 'backtest_agent', 'strategy_manager'].map(name => (
                <AgentCard key={name} name={name.replace('_', ' ').replace('_', ' ')} status={agentStatuses[name]} />
              ))}
            </div>
          </div>

          {/* Capital Allocations */}
          <div className="glass-panel">
            <h3 style={{ margin: '0 0 1rem' }}>Capital Allocations</h3>
            {allocations.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>No active strategies to allocate capital.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {allocations.map(a => (
                  <div key={a.strategy_key} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-main)', width: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.strategy_key}</span>
                    <div style={{ flex: 1, height: '8px', background: 'var(--bg-dark)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${(a.weight * 100).toFixed(1)}%`, height: '100%', background: 'var(--accent-primary)', borderRadius: '4px' }} />
                    </div>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', width: '50px', textAlign: 'right' }}>{(a.weight * 100).toFixed(1)}%</span>
                    <span style={{ fontSize: '0.82rem', color: 'var(--profit-color)', width: '90px', textAlign: 'right' }}>${a.capital_usdt.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Decay Events */}
          <div className="glass-panel">
            <h3 style={{ margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={16} color="var(--loss-color)" /> Recent Decay Events
            </h3>
            {decayEvents.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>No decay events recorded.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '0.5rem 0', fontWeight: 500, textAlign: 'left' }}>Strategy</th>
                    <th style={{ padding: '0.5rem 0', fontWeight: 500 }}>Decay Score</th>
                    <th style={{ padding: '0.5rem 0', fontWeight: 500 }}>Consec. Losses</th>
                    <th style={{ padding: '0.5rem 0', fontWeight: 500 }}>Action</th>
                    <th style={{ padding: '0.5rem 0', fontWeight: 500, textAlign: 'right' }}>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {decayEvents.slice(0, 10).map((e, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.6rem 0', color: 'var(--text-main)' }}>{e.strategy_key}</td>
                      <td style={{ padding: '0.6rem 0', textAlign: 'center', color: e.decay_score > 70 ? 'var(--loss-color)' : '#faad14', fontWeight: 600 }}>{e.decay_score.toFixed(1)}</td>
                      <td style={{ padding: '0.6rem 0', textAlign: 'center', color: 'var(--text-main)' }}>{e.consecutive_losses}</td>
                      <td style={{ padding: '0.6rem 0', textAlign: 'center' }}>
                        <span style={{ fontSize: '0.75rem', background: 'rgba(246,70,93,0.15)', color: 'var(--loss-color)', padding: '0.15rem 0.5rem', borderRadius: '3px' }}>{e.action}</span>
                      </td>
                      <td style={{ padding: '0.6rem 0', textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.78rem' }}>{new Date(e.timestamp).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Tab: Strategies */}
      {activeTab === 'strategies' && (
        <div className="glass-panel">
          {strategies.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>No strategies registered yet. Trigger a generation cycle to start.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '0.75rem 0', fontWeight: 500, textAlign: 'left' }}>Strategy Key</th>
                  <th style={{ padding: '0.75rem 0', fontWeight: 500 }}>Sharpe</th>
                  <th style={{ padding: '0.75rem 0', fontWeight: 500 }}>Max DD</th>
                  <th style={{ padding: '0.75rem 0', fontWeight: 500 }}>Win Rate</th>
                  <th style={{ padding: '0.75rem 0', fontWeight: 500 }}>Mutations</th>
                  <th style={{ padding: '0.75rem 0', fontWeight: 500 }}>Status</th>
                  <th style={{ padding: '0.75rem 0', fontWeight: 500, textAlign: 'right' }}>Approved</th>
                </tr>
              </thead>
              <tbody>
                {strategies.map((s, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.75rem 0', color: 'var(--text-main)', fontFamily: 'monospace', fontSize: '0.8rem' }}>{s.strategy_key}</td>
                    <td style={{ padding: '0.75rem 0', textAlign: 'center', color: (s.backtest_metrics?.sharpe ?? 0) > 1.5 ? 'var(--profit-color)' : 'var(--loss-color)', fontWeight: 600 }}>
                      {(s.backtest_metrics?.sharpe ?? 0).toFixed(2)}
                    </td>
                    <td style={{ padding: '0.75rem 0', textAlign: 'center', color: 'var(--text-main)' }}>
                      {((s.backtest_metrics?.max_drawdown ?? 0) * 100).toFixed(1)}%
                    </td>
                    <td style={{ padding: '0.75rem 0', textAlign: 'center', color: 'var(--text-main)' }}>
                      {((s.backtest_metrics?.win_rate ?? 0) * 100).toFixed(1)}%
                    </td>
                    <td style={{ padding: '0.75rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>{s.mutation_count}</td>
                    <td style={{ padding: '0.75rem 0', textAlign: 'center' }}>
                      <span style={{ color: STATUS_COLOR[s.status], fontWeight: 600, fontSize: '0.8rem' }}>● {s.status}</span>
                    </td>
                    <td style={{ padding: '0.75rem 0', textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                      {new Date(s.approved_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab: Sentiment */}
      {activeTab === 'sentiment' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {sentimentScores.length === 0 ? (
            <div className="glass-panel">
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>No sentiment data yet. Quant engine computes scores every 15 minutes.</p>
            </div>
          ) : (
            sentimentScores.map(s => (
              <div key={s.symbol} className="glass-panel" style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                <div style={{ minWidth: '100px' }}>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-main)' }}>{s.symbol}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(s.timestamp).toLocaleString()}</div>
                </div>
                <ScoreGauge score={s.score} />
                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Funding Rate</div>
                    <div style={{ fontWeight: 600, color: s.funding_rate > 0 ? 'var(--loss-color)' : 'var(--profit-color)' }}>
                      {(s.funding_rate * 100).toFixed(4)}%
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>OI Change</div>
                    <div style={{ fontWeight: 600, color: s.oi_change_pct > 0 ? 'var(--profit-color)' : 'var(--loss-color)' }}>
                      {s.oi_change_pct.toFixed(2)}%
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Funding Component</div>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{(s.components?.funding_component ?? 0).toFixed(1)}</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab: Cycle History */}
      {activeTab === 'history' && (
        <div className="glass-panel">
          {cycleHistory.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>No cycles run yet.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '0.75rem 0', fontWeight: 500, textAlign: 'left' }}>Cycle ID</th>
                  <th style={{ padding: '0.75rem 0', fontWeight: 500 }}>Generated</th>
                  <th style={{ padding: '0.75rem 0', fontWeight: 500 }}>Approved</th>
                  <th style={{ padding: '0.75rem 0', fontWeight: 500 }}>Rejected</th>
                  <th style={{ padding: '0.75rem 0', fontWeight: 500 }}>Errors</th>
                  <th style={{ padding: '0.75rem 0', fontWeight: 500 }}>Duration</th>
                  <th style={{ padding: '0.75rem 0', fontWeight: 500, textAlign: 'right' }}>Started</th>
                </tr>
              </thead>
              <tbody>
                {cycleHistory.map((c, i) => {
                  const duration = c.completed_at && c.started_at
                    ? ((new Date(c.completed_at).getTime() - new Date(c.started_at).getTime()) / 1000).toFixed(0) + 's'
                    : '—';
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem 0', color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.75rem' }}>{c.cycle_id?.slice(0, 8)}…</td>
                      <td style={{ padding: '0.75rem 0', textAlign: 'center', color: 'var(--text-main)' }}>{c.strategies_generated}</td>
                      <td style={{ padding: '0.75rem 0', textAlign: 'center', color: 'var(--profit-color)', fontWeight: 600 }}>{c.strategies_approved}</td>
                      <td style={{ padding: '0.75rem 0', textAlign: 'center', color: c.strategies_rejected > 0 ? 'var(--loss-color)' : 'var(--text-muted)' }}>{c.strategies_rejected}</td>
                      <td style={{ padding: '0.75rem 0', textAlign: 'center', color: c.errors?.length > 0 ? 'var(--loss-color)' : 'var(--text-muted)' }}>{c.errors?.length ?? 0}</td>
                      <td style={{ padding: '0.75rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>{duration}</td>
                      <td style={{ padding: '0.75rem 0', textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.78rem' }}>{new Date(c.started_at).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
