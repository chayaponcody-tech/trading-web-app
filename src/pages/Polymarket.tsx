import { useState, useEffect, useRef } from 'react';
import { TrendingUp, Play, Square, Activity, Clock, CheckCircle, XCircle, RefreshCw, Zap, Brain } from 'lucide-react';

// Point to the Python FastAPI service
const POLY_API = 'http://localhost:8080';

function StatCard({ label, value, sub, color = '#fff' }: any) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '1rem', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ fontSize: '0.72rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '0.4rem' }}>{label}</div>
      <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color }}>{value}</div>
      {sub && <div style={{ fontSize: '0.75rem', color: '#555', marginTop: '0.2rem' }}>{sub}</div>}
    </div>
  );
}

function TradeRow({ trade }: { trade: any }) {
  const isOpen = !trade.outcome;
  const isWin = trade.outcome === 'WIN' || (trade.pnl_usdc ?? trade.pnl ?? 0) > 0;
  const pnl = trade.pnl_usdc ?? trade.pnl ?? null;
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr auto auto auto',
      gap: '1rem', alignItems: 'center',
      padding: '0.65rem 0.75rem', borderRadius: '8px',
      background: 'rgba(255,255,255,0.02)',
      border: `1px solid ${isOpen ? 'rgba(250,173,20,0.15)' : isWin ? 'rgba(14,203,129,0.1)' : 'rgba(246,70,93,0.1)'}`,
    }}>
      <div style={{ overflow: 'hidden' }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {trade.market_question ?? trade.question}
        </div>
        <div style={{ fontSize: '0.7rem', color: '#555', marginTop: '0.15rem' }}>
          {trade.side} · conf {((trade.ai_confidence ?? trade.confidence ?? 0) * 100).toFixed(0)}%
          {trade.entered_at && ` · ${new Date(trade.entered_at).toLocaleTimeString()}`}
          {trade.timestamp && ` · ${new Date(trade.timestamp).toLocaleTimeString()}`}
        </div>
      </div>
      <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '20px', whiteSpace: 'nowrap',
        background: isOpen ? 'rgba(250,173,20,0.15)' : isWin ? 'rgba(14,203,129,0.15)' : 'rgba(246,70,93,0.15)',
        color: isOpen ? '#faad14' : isWin ? '#0ecb81' : '#f6465d',
        border: `1px solid ${isOpen ? 'rgba(250,173,20,0.3)' : isWin ? 'rgba(14,203,129,0.3)' : 'rgba(246,70,93,0.3)'}`,
      }}>
        {isOpen ? '⏳ OPEN' : trade.outcome ?? (isWin ? 'WIN' : 'LOSS')}
      </span>
      <span style={{ fontSize: '0.8rem', color: '#666' }}>
        ${(trade.size_usdc ?? trade.stake ?? 0).toFixed(2)}
      </span>
      <span style={{ fontSize: '0.85rem', fontWeight: 'bold', minWidth: '60px', textAlign: 'right',
        color: pnl === null ? '#666' : pnl >= 0 ? '#0ecb81' : '#f6465d' }}>
        {pnl === null ? '—' : `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(3)}`}
      </span>
    </div>
  );
}

export default function Polymarket() {
  const [summary, setSummary] = useState<any>(null);
  const [trades, setTrades] = useState<any[]>([]);
  const [signals, setSignals] = useState<any>(null);
  const [currentMarket, setCurrentMarket] = useState<any>(null);
  const [paper, setPaper] = useState<any>(null);
  const [paperRunning, setPaperRunning] = useState(false);
  const [paperStake, setPaperStake] = useState(10);
  const [useAI, setUseAI] = useState(true);
  const [tab, setTab] = useState<'live' | 'paper' | 'signals' | 'config'>('live');
  const [cfg, setCfg] = useState<any>(null);
  const [cfgSaving, setCfgSaving] = useState(false);
  const [cfgSaved, setCfgSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [serviceOnline, setServiceOnline] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  const fetchAll = async () => {
    try {
      const [sumRes, tradeRes, sigRes, mktRes, cfgRes] = await Promise.all([
        fetch(`${POLY_API}/api/summary`),
        fetch(`${POLY_API}/api/trades?limit=30`),
        fetch(`${POLY_API}/api/signals`),
        fetch(`${POLY_API}/api/markets/btc5m`),
        fetch(`${POLY_API}/api/config`),
      ]);
      if (sumRes.ok) setSummary(await sumRes.json());
      if (tradeRes.ok) setTrades(await tradeRes.json());
      if (sigRes.ok) setSignals(await sigRes.json());
      if (mktRes.ok) setCurrentMarket(await mktRes.json());
      if (cfgRes.ok) setCfg(await cfgRes.json());
      setServiceOnline(true);
    } catch {
      setServiceOnline(false);
    } finally {
      setLoading(false);
    }
  };

  const fetchPaper = async () => {
    try {
      const res = await fetch(`${POLY_API}/api/paper/status`);
      if (res.ok) {
        const data = await res.json();
        setPaper(data);
        setPaperRunning(data.running);
      }
    } catch {}
  };

  useEffect(() => {
    fetchAll();
    fetchPaper();
    const t1 = setInterval(fetchAll, 15000);
    const t2 = setInterval(fetchPaper, 5000);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [paper?.log]);

  const startPaper = async () => {
    await fetch(`${POLY_API}/api/paper/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ use_ai: useAI, stake: paperStake }),
    });
    fetchPaper();
  };

  const stopPaper = async () => {
    await fetch(`${POLY_API}/api/paper/stop`, { method: 'POST' });
    fetchPaper();
  };

  const saveConfig = async () => {
    setCfgSaving(true);
    try {
      await fetch(`${POLY_API}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      });
      setCfgSaved(true);
      setTimeout(() => setCfgSaved(false), 2000);
    } finally {
      setCfgSaving(false);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#555' }}>
      <RefreshCw size={20} style={{ marginRight: '0.5rem', animation: 'spin 1s linear infinite' }} /> Connecting to Polymarket service...
    </div>
  );

  if (!serviceOnline) return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '1rem' }}>
      <TrendingUp size={48} strokeWidth={1.2} color="#ff6b35" />
      <h2 style={{ margin: 0, color: 'var(--text-main)' }}>Polymarket Service Offline</h2>
      <p style={{ margin: 0, color: '#555', fontSize: '0.9rem' }}>Start the Python service first:</p>
      <code style={{ background: 'rgba(255,255,255,0.05)', padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.85rem', color: '#00d1ff' }}>
        cd polymarket/polymarket_agent && uvicorn api_server:app --port 8080
      </code>
      <button className="btn-outline" onClick={fetchAll} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <RefreshCw size={14} /> Retry
      </button>
    </div>
  );

  const winRate = summary?.win_rate ? (summary.win_rate * 100).toFixed(1) : '—';
  const totalPnl = summary?.total_pnl ?? 0;

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1280px', margin: '0 auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <TrendingUp size={24} color="#ff6b35" />
          <div>
            <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Polymarket</h2>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#555' }}>BTC 5-minute prediction markets</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: '20px', background: 'rgba(14,203,129,0.15)', color: '#0ecb81', border: '1px solid rgba(14,203,129,0.3)' }}>
            ● Service Online
          </span>
          <button className="btn-outline" onClick={fetchAll} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
        <StatCard label="Total PnL" value={`${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(3)}`} color={totalPnl >= 0 ? '#0ecb81' : '#f6465d'} sub={`${summary?.total_trades ?? 0} trades`} />
        <StatCard label="Win Rate" value={`${winRate}%`} color={parseFloat(winRate) >= 50 ? '#0ecb81' : '#f6465d'} sub={`${summary?.wins ?? 0}W / ${summary?.losses ?? 0}L`} />
        <StatCard label="Avg Confidence" value={`${((summary?.avg_confidence ?? 0) * 100).toFixed(0)}%`} color="#00d1ff" sub="AI conviction" />
        <StatCard label="Open Positions" value={summary?.open_positions ?? 0} color="#faad14" sub={summary?.circuit_breaker ? '⚠️ Circuit Breaker ON' : 'Normal'} />
      </div>

      {/* Current Market */}
      {currentMarket && (
        <div className="glass-panel" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={16} color="#faad14" />
            <span style={{ fontSize: '0.75rem', color: '#faad14', fontWeight: 600 }}>ACTIVE MARKET</span>
          </div>
          <div style={{ flex: 1, fontSize: '0.9rem', fontWeight: 500 }}>{currentMarket.question}</div>
          <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.82rem' }}>
            <span>UP <strong style={{ color: '#0ecb81' }}>{(currentMarket.yes_price * 100).toFixed(1)}¢</strong></span>
            <span>DOWN <strong style={{ color: '#f6465d' }}>{(currentMarket.no_price * 100).toFixed(1)}¢</strong></span>
            <span style={{ color: '#555' }}>expires {currentMarket.time_to_expiry_min?.toFixed(1)}m</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '4px', width: 'fit-content' }}>
        {(['live', 'paper', 'signals', 'config'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '0.4rem 1rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500,
            background: tab === t ? 'rgba(255,107,53,0.2)' : 'transparent',
            color: tab === t ? '#ff6b35' : '#666',
            transition: 'all 0.15s',
          }}>
            {t === 'live' ? '📊 Live Trades' : t === 'paper' ? '🧪 Paper Sim' : t === 'signals' ? '📡 Signals' : '⚙️ Config'}
          </button>
        ))}
      </div>

      {/* Tab: Live Trades */}
      {tab === 'live' && (
        <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#555', marginBottom: '0.25rem' }}>Recent {trades.length} trades</div>
          {trades.length === 0
            ? <div style={{ textAlign: 'center', padding: '2rem', color: '#444' }}>No trades yet</div>
            : trades.map((t, i) => <TradeRow key={i} trade={t} />)
          }
        </div>
      )}

      {/* Tab: Paper Sim */}
      {tab === 'paper' && (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.5rem' }}>

          {/* Controls */}
          <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ fontWeight: 600, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Zap size={16} color="#ff6b35" /> Paper Trading Sim
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.75rem', color: '#666' }}>Stake per trade (USDC)</label>
              <input type="number" className="styled-input" value={paperStake} onChange={e => setPaperStake(+e.target.value)} disabled={paperRunning} min={1} max={100} />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: paperRunning ? 'not-allowed' : 'pointer', opacity: paperRunning ? 0.5 : 1 }}>
              <div onClick={() => !paperRunning && setUseAI(!useAI)} style={{
                width: '36px', height: '20px', borderRadius: '10px', position: 'relative', cursor: 'pointer',
                background: useAI ? '#ff6b35' : 'rgba(255,255,255,0.1)', transition: 'background 0.2s',
              }}>
                <div style={{ position: 'absolute', top: '2px', left: useAI ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
              </div>
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 500 }}>Use AI Decision</div>
                <div style={{ fontSize: '0.7rem', color: '#555' }}>{useAI ? 'OpenRouter LLM' : 'Rule-based only'}</div>
              </div>
            </label>

            {!paperRunning ? (
              <button className="btn-primary" onClick={startPaper} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: '#ff6b35', borderColor: '#ff6b35' }}>
                <Play size={15} /> Start Simulation
              </button>
            ) : (
              <button className="btn-danger" onClick={stopPaper} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <Square size={15} /> Stop Simulation
              </button>
            )}

            {paper && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: '#555' }}>Total PnL</span>
                  <strong style={{ color: paper.total_pnl >= 0 ? '#0ecb81' : '#f6465d' }}>
                    {paper.total_pnl >= 0 ? '+' : ''}${paper.total_pnl?.toFixed(4)}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: '#555' }}>Win Rate</span>
                  <strong style={{ color: (paper.win_rate ?? 0) >= 0.5 ? '#0ecb81' : '#f6465d' }}>
                    {paper.total > 0 ? `${(paper.win_rate * 100).toFixed(1)}%` : '—'}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: '#555' }}>Trades</span>
                  <span><span style={{ color: '#0ecb81' }}>{paper.wins}W</span> / <span style={{ color: '#f6465d' }}>{paper.losses}L</span></span>
                </div>
                {paper.open_trade && (
                  <div style={{ marginTop: '0.25rem', padding: '0.6rem', borderRadius: '8px', background: 'rgba(250,173,20,0.08)', border: '1px solid rgba(250,173,20,0.2)', fontSize: '0.75rem' }}>
                    <div style={{ color: '#faad14', fontWeight: 600, marginBottom: '0.25rem' }}>⏳ Open Trade</div>
                    <div style={{ color: '#888' }}>{paper.open_trade.side} @ ${paper.open_trade.entry_price?.toFixed(3)}</div>
                    <div style={{ color: '#555', marginTop: '0.15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{paper.open_trade.question?.slice(0, 50)}...</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Log */}
          <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={15} color="#ff6b35" /> Simulation Log
              {paperRunning && <span className="pulse" style={{ fontSize: '0.7rem', color: '#0ecb81', marginLeft: 'auto' }}>● Running</span>}
            </div>
            <div style={{ flex: 1, background: '#050a14', borderRadius: '8px', padding: '1rem', fontFamily: 'monospace', fontSize: '0.78rem', overflowY: 'auto', maxHeight: '420px', border: '1px solid rgba(255,255,255,0.05)' }}>
              {(paper?.log ?? []).length === 0
                ? <span style={{ color: '#333' }}>No logs yet. Start simulation to begin.</span>
                : (paper?.log ?? []).map((line: string, i: number) => {
                    const color = line.includes('✅') || line.includes('WIN') ? '#0ecb81'
                      : line.includes('❌') || line.includes('LOSS') ? '#f6465d'
                      : line.includes('⏳') || line.includes('Waiting') ? '#faad14'
                      : line.includes('📥') || line.includes('Entered') ? '#00d1ff'
                      : '#555';
                    return <div key={i} style={{ color, marginBottom: '0.3rem', lineHeight: 1.5 }}>{line}</div>;
                  })
              }
              <div ref={logEndRef} />
            </div>

            {/* Recent sim trades */}
            {(paper?.trades ?? []).length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '200px', overflowY: 'auto' }}>
                <div style={{ fontSize: '0.72rem', color: '#444', marginBottom: '0.25rem' }}>Recent sim trades</div>
                {[...(paper?.trades ?? [])].reverse().slice(0, 10).map((t: any, i: number) => (
                  <TradeRow key={i} trade={t} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Signals */}
      {tab === 'signals' && signals && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <div style={{ fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Brain size={16} color="#00d1ff" /> BTC Live Signals
              <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#555' }}>
                ${signals.price?.toLocaleString()} · {signals.regime}
              </span>
            </div>
            {Object.entries(signals.signals ?? {}).map(([key, val]: any) => {
              const pct = Math.min(Math.abs(val) * 100, 100);
              const isPos = val >= 0;
              return (
                <div key={key} style={{ marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.25rem' }}>
                    <span style={{ color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{key.replace(/_/g, ' ')}</span>
                    <span style={{ color: isPos ? '#0ecb81' : '#f6465d', fontWeight: 600 }}>{val >= 0 ? '+' : ''}{val?.toFixed(4)}</span>
                  </div>
                  <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: isPos ? '#0ecb81' : '#f6465d', borderRadius: '2px', transition: 'width 0.3s' }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <div style={{ fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={16} color="#a78bfa" /> Technical Indicators
            </div>
            {Object.entries(signals.indicators ?? {}).map(([key, val]: any) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.82rem' }}>
                <span style={{ color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '0.72rem' }}>{key.replace(/_/g, ' ')}</span>
                <span style={{ fontWeight: 600, color: key === 'rsi' ? (val > 65 ? '#f6465d' : val < 35 ? '#0ecb81' : '#fff') : '#fff' }}>
                  {typeof val === 'number' ? val.toFixed(key === 'rsi' || key === 'bb_position' ? 2 : 1) : val}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'signals' && !signals && (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: '#444' }}>
          No signal data available. The service may still be warming up.
        </div>
      )}

      {/* Tab: Config */}
      {tab === 'config' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>

          {/* AI Settings */}
          <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ fontWeight: 600, fontSize: '0.95rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.75rem' }}>
              🤖 AI Settings
            </div>

            <CfgField label="OpenRouter API Key">
              <input className="styled-input" type="password" style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.8rem' }}
                placeholder="sk-or-v1-..."
                value={cfg?.openrouter_api_key ?? ''}
                onChange={e => setCfg((p: any) => ({ ...p, openrouter_api_key: e.target.value }))}
              />
            </CfgField>

            <CfgField label="AI Model">
              <select className="styled-input" style={{ width: '100%' }}
                value={cfg?.ai_model ?? ''}
                onChange={e => setCfg((p: any) => ({ ...p, ai_model: e.target.value }))}
              >
                <option value="">Default (config.py)</option>
                <option value="google/gemini-flash-1.5">⚡ Gemini Flash 1.5 (Fast)</option>
                <option value="google/gemini-pro-1.5">♊ Gemini Pro 1.5</option>
                <option value="google/gemini-3-flash-preview">🔮 Gemini 3 Flash Preview</option>
                <option value="anthropic/claude-3.5-sonnet">🎭 Claude 3.5 Sonnet</option>
                <option value="anthropic/claude-3-haiku">🪶 Claude 3 Haiku (Fast)</option>
                <option value="deepseek/deepseek-chat">🤖 DeepSeek V3</option>
                <option value="meta-llama/llama-3.1-405b">🦙 Llama 3.1 405B</option>
              </select>
            </CfgField>

            <CfgField label="Use RAG Context (Learning from past trades)">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div onClick={() => setCfg((p: any) => ({ ...p, use_rag_context: !p?.use_rag_context }))}
                  style={{ width: '36px', height: '20px', borderRadius: '10px', position: 'relative', cursor: 'pointer',
                    background: cfg?.use_rag_context ? '#ff6b35' : 'rgba(255,255,255,0.1)', transition: 'background 0.2s' }}>
                  <div style={{ position: 'absolute', top: '2px', left: cfg?.use_rag_context ? '18px' : '2px',
                    width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                </div>
                <span style={{ fontSize: '0.82rem', color: cfg?.use_rag_context ? '#0ecb81' : '#555' }}>
                  {cfg?.use_rag_context ? 'Enabled — AI learns from mistakes' : 'Disabled — saves tokens'}
                </span>
              </div>
            </CfgField>
          </div>

          {/* Risk Settings */}
          <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ fontWeight: 600, fontSize: '0.95rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.75rem' }}>
              🛡️ Risk Parameters
            </div>

            <CfgField label={`Confidence Threshold — ${((cfg?.confidence_threshold ?? 0.72) * 100).toFixed(0)}%`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <input type="range" min={0.5} max={0.95} step={0.01} style={{ flex: 1 }}
                  value={cfg?.confidence_threshold ?? 0.72}
                  onChange={e => setCfg((p: any) => ({ ...p, confidence_threshold: parseFloat(e.target.value) }))}
                />
                <span style={{ minWidth: '42px', textAlign: 'right', fontWeight: 'bold',
                  color: (cfg?.confidence_threshold ?? 0.72) >= 0.8 ? '#0ecb81' : (cfg?.confidence_threshold ?? 0.72) >= 0.65 ? '#faad14' : '#f6465d' }}>
                  {((cfg?.confidence_threshold ?? 0.72) * 100).toFixed(0)}%
                </span>
              </div>
              <div style={{ fontSize: '0.7rem', color: '#444' }}>AI ต้องมั่นใจอย่างน้อยเท่านี้ถึงจะเปิด position</div>
            </CfgField>

            <CfgField label="Max Bet per Trade (USDC)">
              <input type="number" className="styled-input" style={{ width: '100%' }} min={0.25} max={100} step={0.25}
                value={cfg?.max_bet ?? 3.0}
                onChange={e => setCfg((p: any) => ({ ...p, max_bet: parseFloat(e.target.value) }))}
              />
            </CfgField>

            {/* Read-only info */}
            <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '8px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.7rem', color: '#444', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Current State</div>
              {[
                { label: 'Daily PnL', value: `$${(cfg?.daily_pnl ?? 0).toFixed(3)}`, color: (cfg?.daily_pnl ?? 0) >= 0 ? '#0ecb81' : '#f6465d' },
                { label: 'Daily Trades', value: cfg?.daily_trade_count ?? 0 },
                { label: 'Circuit Breaker', value: cfg?.circuit_breaker_on ? '🔴 ON' : '🟢 OFF', color: cfg?.circuit_breaker_on ? '#f6465d' : '#0ecb81' },
                { label: 'Total Trades', value: cfg?.total_trades ?? 0 },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span style={{ color: '#555' }}>{row.label}</span>
                  <span style={{ fontWeight: 600, color: (row as any).color ?? '#fff' }}>{row.value}</span>
                </div>
              ))}
            </div>

            <button onClick={saveConfig} className="btn-primary" disabled={cfgSaving || !cfg}
              style={{ marginTop: 'auto', background: cfgSaved ? '#0ecb81' : '#ff6b35', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              {cfgSaved ? '✓ Saved' : cfgSaving ? 'Saving...' : '💾 Save Configuration'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CfgField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <label style={{ fontSize: '0.78rem', color: '#888' }}>{label}</label>
      {children}
    </div>
  );
}
