import { useState, useEffect, useCallback } from 'react';
import { Brain, RefreshCw } from 'lucide-react';

const QUANT_URL = 'http://localhost:8002';
const SYMBOLS = ['BTCUSDT', 'ETHUSDT'];

interface SentimentScore {
  symbol: string;
  score: number;
  funding_rate: number;
  oi_change_pct: number;
  timestamp: string;
  components: Record<string, number>;
}

interface HistoryEntry {
  symbol: string;
  score: number;
  timestamp: string;
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 60 ? 'var(--profit-color)' : score <= 40 ? 'var(--loss-color)' : '#faad14';
  const label = score >= 60 ? 'Bullish' : score <= 40 ? 'Bearish' : 'Neutral';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <div style={{ flex: 1, height: '10px', background: 'var(--bg-dark)', borderRadius: '5px', overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: '5px', transition: 'width 0.5s' }} />
      </div>
      <span style={{ fontWeight: 700, fontSize: '1.1rem', color, minWidth: '45px' }}>{score.toFixed(1)}</span>
      <span style={{ fontSize: '0.8rem', color, minWidth: '55px' }}>{label}</span>
    </div>
  );
}

export default function Sentiment() {
  const [scores, setScores] = useState<SentimentScore[]>([]);
  const [history, setHistory] = useState<Record<string, HistoryEntry[]>>({});
  const [isOnline, setIsOnline] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchScores = useCallback(async () => {
    try {
      const results = await Promise.allSettled(
        SYMBOLS.map(s => fetch(`${QUANT_URL}/sentiment/${s}`).then(r => r.ok ? r.json() : null))
      );
      const valid = results
        .filter(r => r.status === 'fulfilled' && r.value)
        .map(r => (r as PromiseFulfilledResult<SentimentScore>).value);
      setScores(valid);
      setIsOnline(valid.length > 0);
      setLastRefresh(new Date());
    } catch {
      setIsOnline(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    const now = new Date();
    const from = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const to = now.toISOString();
    const hist: Record<string, HistoryEntry[]> = {};
    await Promise.allSettled(
      SYMBOLS.map(async s => {
        try {
          const res = await fetch(`${QUANT_URL}/sentiment/${s}/history?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
          if (res.ok) hist[s] = await res.json();
        } catch { /* silent */ }
      })
    );
    setHistory(hist);
  }, []);

  useEffect(() => {
    fetchScores();
    fetchHistory();
    const id = setInterval(() => { fetchScores(); fetchHistory(); }, 60000);
    return () => clearInterval(id);
  }, [fetchScores, fetchHistory]);

  if (!isOnline) {
    return (
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '1rem', color: 'var(--text-muted)' }}>
        <Brain size={48} strokeWidth={1.2} color="var(--accent-primary)" />
        <h2 style={{ margin: 0, color: 'var(--text-main)' }}>Sentiment Analysis</h2>
        <p style={{ margin: 0, fontSize: '0.95rem' }}>Quant Engine offline — scores computed every 15 min when running.</p>
        <button className="btn-outline" onClick={fetchScores} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Brain size={24} color="var(--accent-primary)" />
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Sentiment Analysis</h2>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>Funding Rate + Open Interest · Updated every 15 min</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {lastRefresh && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{lastRefresh.toLocaleTimeString()}</span>}
          <button className="btn-outline" onClick={() => { fetchScores(); fetchHistory(); }} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', padding: '0.4rem 0.8rem' }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Score Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${SYMBOLS.length}, 1fr)`, gap: '1rem' }}>
        {scores.map(s => (
          <div key={s.symbol} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{s.symbol}</h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{new Date(s.timestamp).toLocaleString()}</span>
              </div>
            </div>
            <ScoreBar score={s.score} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem' }}>
              <div className="glass-panel" style={{ padding: '0.6rem 0.8rem' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: '0.2rem' }}>Funding Rate</div>
                <div style={{ fontWeight: 700, color: s.funding_rate > 0 ? 'var(--loss-color)' : 'var(--profit-color)' }}>
                  {(s.funding_rate * 100).toFixed(4)}%
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {s.funding_rate > 0.001 ? 'Overbought (contrarian bearish)' : s.funding_rate < -0.001 ? 'Oversold (contrarian bullish)' : 'Neutral'}
                </div>
              </div>
              <div className="glass-panel" style={{ padding: '0.6rem 0.8rem' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: '0.2rem' }}>OI Change</div>
                <div style={{ fontWeight: 700, color: s.oi_change_pct > 0 ? 'var(--profit-color)' : 'var(--loss-color)' }}>
                  {s.oi_change_pct.toFixed(2)}%
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Open Interest</div>
              </div>
              <div className="glass-panel" style={{ padding: '0.6rem 0.8rem' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: '0.2rem' }}>Funding Component</div>
                <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{(s.components?.funding_component ?? 0).toFixed(1)}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>weight 60%</div>
              </div>
              <div className="glass-panel" style={{ padding: '0.6rem 0.8rem' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: '0.2rem' }}>OI Component</div>
                <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{(s.components?.oi_component ?? 0).toFixed(1)}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>weight 40%</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 24h History */}
      {Object.keys(history).length > 0 && (
        <div className="glass-panel">
          <h3 style={{ margin: '0 0 1rem' }}>24h Score History</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {SYMBOLS.map(sym => {
              const entries = history[sym] ?? [];
              if (entries.length === 0) return null;
              return (
                <div key={sym}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>{sym}</div>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', height: '60px' }}>
                    {entries.slice(-48).map((e, i) => {
                      const color = e.score >= 60 ? 'var(--profit-color)' : e.score <= 40 ? 'var(--loss-color)' : '#faad14';
                      return (
                        <div key={i} title={`${new Date(e.timestamp).toLocaleTimeString()} — ${e.score.toFixed(1)}`}
                          style={{ flex: 1, height: `${e.score}%`, background: color, borderRadius: '2px 2px 0 0', opacity: 0.8, minWidth: '4px' }} />
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    <span>24h ago</span><span>now</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
