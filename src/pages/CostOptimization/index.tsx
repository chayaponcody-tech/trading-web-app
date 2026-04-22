import React, { useEffect, useState } from 'react';
import { DollarSign, BarChart2, Activity, Zap, Server, Clock, RefreshCw, TrendingUp } from 'lucide-react';
import '../../App.css';

interface TokenSummary {
  feature: string;
  total_calls: number;
  total_tokens: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
}

interface TokenLog {
  id: number;
  feature: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  timestamp: string;
}

// Color palette for different features
const FEATURE_COLORS: Record<string, string> = {
  recommendBot:    '#00d1ff',
  proposeFleet:    '#a78bfa',
  reviewBot:       '#0ecb81',
  huntBestSymbols: '#faad14',
  analyzeFleet:    '#f6465d',
  analyzeMistakes: '#ff6b35',
  reflect:         '#60a5fa',
  unknown:         '#6b7280',
};

const getFeatureColor = (feature: string) =>
  FEATURE_COLORS[feature] ?? FEATURE_COLORS.unknown;

const formatTime = (ts: string) => {
  // SQLite CURRENT_TIMESTAMP is UTC. Append Z to ensure browser treats it as UTC.
  const utcStr = ts.includes('Z') || ts.includes('+') ? ts : ts.replace(' ', 'T') + 'Z';
  const d = new Date(utcStr);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  return d.toLocaleTimeString('en-GB', { 
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: false,
    timeZone: 'Asia/Bangkok'
  });
};

const shortModel = (model: string) => model.split('/').pop()?.replace(':free', '') ?? model;

export default function CostOptimization() {
  const [summary, setSummary] = useState<TokenSummary[]>([]);
  const [logs, setLogs] = useState<TokenLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async (manual = false) => {
    if (manual) setSyncing(true); else setLoading(true);
    try {
      const [sumRes, logsRes] = await Promise.all([
        fetch('/api/cost/token-summary'),
        fetch('/api/cost/token-logs?limit=50')
      ]);
      setSummary(await sumRes.json());
      setLogs(await logsRes.json());
    } catch (e) {
      console.error('Failed to fetch cost data', e);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  const calculateCost = (tokens: number, model: string) => {
    const rate = model.includes('pro') ? 0.005 : 0.00015;
    return (tokens / 1000) * rate;
  };

  const totalTokens = summary.reduce((acc, s) => acc + s.total_tokens, 0);
  const totalCost = logs.reduce((acc, l) => acc + calculateCost(l.total_tokens, l.model), 0);
  const totalCalls = summary.reduce((acc, s) => acc + s.total_calls, 0);

  // Timeline — group by hour
  const timelineData = [...logs].reverse().reduce((acc, log) => {
    const utcStr = log.timestamp.includes('Z') || log.timestamp.includes('+') ? log.timestamp : log.timestamp.replace(' ', 'T') + 'Z';
    const hour = new Date(utcStr).toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      hour12: false,
      timeZone: 'Asia/Bangkok'
    }) + ':00';
    const entry = acc.find(x => x.label === hour);
    if (entry) entry.tokens += log.total_tokens;
    else acc.push({ label: hour, tokens: log.total_tokens });
    return acc;
  }, [] as { label: string; tokens: number }[]);
  const maxBar = Math.max(...timelineData.map(d => d.tokens), 1);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: '1rem' }}>
        <RefreshCw size={32} color="#faad14" style={{ animation: 'spin 1s linear infinite' }} />
        <p className="text-muted">Loading cost data...</p>
      </div>
    );
  }

  return (
    <div style={{
      padding: '1rem 1.25rem',
      background: 'radial-gradient(ellipse at top left, rgba(18,18,28,1) 0%, rgba(8,10,16,1) 100%)',
      display: 'flex', flexDirection: 'column',
      height: 'calc(100vh - 60px)', overflow: 'hidden', gap: '0.75rem'
    }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <h3 style={{ margin: 0, background: 'linear-gradient(90deg, #faad14, #fde68a)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontSize: '1.25rem', fontWeight: 700 }}>
            💸 AI Cost Dashboard
          </h3>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '0.78rem' }}>Realtime token spend tracker — Last 50 requests</p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={syncing}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(250,173,20,0.08)', color: '#faad14', border: '1px solid rgba(250,173,20,0.25)', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', fontSize: '0.8rem', transition: 'all 0.2s' }}
        >
          <RefreshCw size={13} style={syncing ? { animation: 'spin 0.8s linear infinite' } : {}} />
          {syncing ? 'Syncing…' : 'Refresh'}
        </button>
      </div>

      {/* ── KPI Row ── */}
      <div style={{ display: 'flex', gap: '0.75rem', flexShrink: 0 }}>
        {[
          { icon: <Server size={16} />, label: 'Total Tokens', value: totalTokens.toLocaleString(), color: '#00d1ff', sub: `${totalCalls} calls` },
          { icon: <DollarSign size={16} />, label: 'Est. Cost', value: `$${totalCost.toFixed(4)}`, color: '#f6465d', sub: 'OpenRouter rates' },
          { icon: <Zap size={16} />, label: 'Features', value: summary.length, color: '#faad14', sub: 'using AI' },
          { icon: <TrendingUp size={16} />, label: 'Avg / Call', value: totalCalls > 0 ? Math.round(totalTokens / totalCalls) : 0, color: '#0ecb81', sub: 'tokens' },
        ].map((kpi, i) => (
          <div key={i} style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', borderTop: `2px solid ${kpi.color}`, padding: '0.6rem 1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#9ca3af', marginBottom: '4px', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <span style={{ color: kpi.color }}>{kpi.icon}</span>
              {kpi.label}
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#f1f5f9', lineHeight: 1.1 }}>{kpi.value}</div>
            <div style={{ fontSize: '0.68rem', color: '#6b7280', marginTop: '2px' }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Timeline Chart ── */}
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '0.75rem 1rem', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={13} color="#00d1ff" /> Token Consumption Timeline
          </span>
          <span style={{ fontSize: '0.68rem', color: '#6b7280' }}>by hour</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '52px' }}>
          {timelineData.length === 0
            ? <div style={{ color: '#6b7280', fontSize: '0.75rem', margin: 'auto' }}>No data yet — use an AI feature to start tracking</div>
            : timelineData.map((d, i) => (
              <div key={i} title={`${d.label}: ${d.tokens.toLocaleString()} tokens`}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', cursor: 'default' }}>
                <div style={{
                  width: '100%', maxWidth: '48px',
                  height: `${(d.tokens / maxBar) * 100}%`,
                  background: 'linear-gradient(180deg, rgba(0,209,255,0.9) 0%, rgba(0,209,255,0.2) 100%)',
                  borderRadius: '3px 3px 0 0', minHeight: '3px', transition: 'height 0.6s ease'
                }} />
                <span style={{ fontSize: '0.55rem', color: '#6b7280', marginTop: '3px' }}>{d.label}</span>
              </div>
            ))
          }
        </div>
      </div>

      {/* ── Tables Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '0.75rem', flexGrow: 1, minHeight: 0 }}>

        {/* Usage by Feature */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <BarChart2 size={14} color="#faad14" />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#e2e8f0' }}>Usage by Feature</span>
          </div>
          <div style={{ overflowY: 'auto', padding: '0.5rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {summary.length === 0
              ? <p style={{ color: '#6b7280', fontSize: '0.8rem', textAlign: 'center', marginTop: '1rem' }}>No data yet</p>
              : summary.map((s, i) => {
                  const pct = totalTokens > 0 ? (s.total_tokens / totalTokens) * 100 : 0;
                  const color = getFeatureColor(s.feature);
                  return (
                    <div key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color, display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }}></span>
                          {s.feature}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                          {s.total_tokens.toLocaleString()} tok · {s.total_calls} calls
                        </span>
                      </div>
                      <div style={{ height: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '99px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '99px', transition: 'width 0.8s ease', opacity: 0.85 }} />
                      </div>
                    </div>
                  );
                })
            }
          </div>
        </div>

        {/* Recent Requests */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <Activity size={14} color="#0ecb81" />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#e2e8f0' }}>Recent AI Requests</span>
            <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: '#6b7280' }}>{logs.length} logged</span>
          </div>
          <div style={{ overflowY: 'auto', flexGrow: 1 }}>
            {logs.length === 0
              ? <p style={{ color: '#6b7280', fontSize: '0.8rem', textAlign: 'center', marginTop: '1rem' }}>No requests logged yet</p>
              : logs.slice(0, 30).map(log => {
                  const color = getFeatureColor(log.feature);
                  const cost = calculateCost(log.total_tokens, log.model);
                  return (
                    <div key={log.id} style={{ display: 'grid', gridTemplateColumns: '90px 1fr auto auto', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      {/* Time */}
                      <span style={{ fontSize: '0.68rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>{formatTime(log.timestamp)}</span>
                      {/* Feature + Model */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0 }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color, display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }}></span>
                          {log.feature}
                        </span>
                        <span style={{ fontSize: '0.62rem', color: '#a78bfa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shortModel(log.model)}</span>
                      </div>
                      {/* Tokens */}
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#00d1ff' }}>{log.total_tokens.toLocaleString()}</div>
                        <div style={{ fontSize: '0.6rem', color: '#6b7280' }}>{log.prompt_tokens}p+{log.completion_tokens}c</div>
                      </div>
                      {/* Cost */}
                      <div style={{ textAlign: 'right', minWidth: '58px' }}>
                        <span style={{ fontSize: '0.7rem', color: cost > 0.001 ? '#f6465d' : '#9ca3af', fontWeight: 600 }}>
                          ${cost.toFixed(5)}
                        </span>
                      </div>
                    </div>
                  );
                })
            }
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }
      `}</style>
    </div>
  );
}
