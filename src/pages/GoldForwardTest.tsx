import { useState, useEffect, useRef } from 'react';

const API = '';

const LOT_SIZES = [0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.0, 5.0];
const INTERVALS = ['5m', '15m', '1h', '4h', '1d'];
const STRATEGIES = [
  { value: 'EMA', label: 'EMA Cross (20/50)' },
  { value: 'BB', label: 'BB Mean Reversion' },
  { value: 'RSI', label: 'RSI Oversold/Overbought' },
  { value: 'EMA_RSI', label: '⚡ EMA + RSI' },
  { value: 'BB_RSI', label: '⚡ BB + RSI' },
  { value: 'GRID', label: '🌐 Grid (Mean Reversion)' },
  { value: 'EMA_SCALP', label: '⚡ EMA Scalp (3/8 Fast)' },
  { value: 'STOCH_RSI', label: '🎯 Stochastic RSI Scalp' },
  { value: 'VWAP_SCALP', label: '📊 VWAP Scalp + Momentum' },
];

const ozPerStdLot = 100;
const fmtPrice = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPnl  = (n: number) => `${n >= 0 ? '+' : ''}$${fmtPrice(n)}`;

interface OpenPosition {
  id: string; type: string; entryPrice: number; entryTime: string;
  liqId?: number; initialMargin?: number; lots: number;
}
interface GoldTrade {
  posId: string; entryTime: string; exitTime: string;
  type: string; entryPrice: number; exitPrice: number;
  pnl: number; reason: string; lots: number; isLiquidated?: boolean;
}
interface GoldBot {
  id: string; isRunning: boolean;
  config: { interval: string; strategy: string; tpUSD: number; slUSD: number; lots: number; leverage: number; maxPositions: number };
  openPositions: OpenPosition[];
  walletBalance: number; startBalance: number;
  grossProfit: number; grossLoss: number;
  winCount: number; lossCount: number;
  lastSignal: string; lastChecked: string; startedAt: string;
  currentPrice: number; unrealizedPnl: number;
  trades: GoldTrade[];
}

const posColor = (p: string) => p === 'LONG' ? 'var(--profit-color)' : p === 'SHORT' ? 'var(--loss-color)' : 'var(--text-muted)';

export default function GoldForwardTest() {
  // Form
  const [interval, setIntervalVal] = useState('1h');
  const [strategy, setStrategy] = useState('EMA');
  const [lots, setLots] = useState(0.1);
  const [leverage, setLeverage] = useState(100);
  const [tpUSD, setTpUSD] = useState(50);
  const [slUSD, setSlUSD] = useState(25);
  const [maxPositions, setMaxPositions] = useState(3);
  const [wallet, setWallet] = useState<{ balance: number; allTimePnL: number; allTimeTrades: number } | null>(null);
  const [bots, setBots] = useState<GoldBot[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedBot, setExpandedBot] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  const fetchAll = async () => {
    try {
      const [wb, bb] = await Promise.all([
        fetch(`${API}/api/wallet/gold`).then(r => r.json()),
        fetch(`${API}/api/gold-forward/status`).then(r => r.json()),
      ]);
      setWallet(wb);
      setBots(Array.isArray(bb) ? bb : []);
    } catch {}
  };

  useEffect(() => {
    fetchAll();
    pollRef.current = window.setInterval(fetchAll, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleStart = async () => {
    setLoading(true);
    await fetch(`${API}/api/gold-forward/start`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interval, strategy, lots, leverage, tpUSD, slUSD, maxPositions }),
    });
    await fetchAll();
    setLoading(false);
  };
  const handleStop = async (id: string) => {
    await fetch(`${API}/api/gold-forward/stop`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ botId: id }) });
    fetchAll();
  };
  const handleDelete = async (id: string) => {
    await fetch(`${API}/api/gold-forward/delete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ botId: id }) });
    fetchAll();
  };

  const running = bots.filter(b => b.isRunning);
  const stopped = bots.filter(b => !b.isRunning);
  const totalUnrealized = bots.reduce((s, b) => s + (b.unrealizedPnl || 0), 0);

  return (
    <div style={{ display: 'flex', gap: '1rem', height: '100%', overflow: 'hidden' }}>

      {/* ── Sidebar ── */}
      <div style={{ width: '240px', flexShrink: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div className="glass-panel" style={{ borderLeft: '4px solid #faad14' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>🪙 Gold Forward Test</h3>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>XAUUSD · Forex-style Lot Bots</p>
        </div>

        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {/* Instrument */}
          <div style={{ background: 'rgba(250,173,20,0.08)', border: '1px solid rgba(250,173,20,0.2)', borderRadius: '6px', padding: '0.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Instrument</div>
            <div style={{ fontWeight: 'bold', color: '#faad14' }}>GOLD / XAU</div>
          </div>

          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Timeframe
            <select value={interval} onChange={e => setIntervalVal(e.target.value)} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.35rem', marginTop: '0.2rem' }}>
              {INTERVALS.map(i => <option key={i}>{i}</option>)}
            </select>
          </label>

          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Strategy
            <select value={strategy} onChange={e => setStrategy(e.target.value)} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.35rem', marginTop: '0.2rem' }}>
              {STRATEGIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Lot Size
              <select value={lots} onChange={e => setLots(parseFloat(e.target.value))} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: '#faad14', fontWeight: 'bold', padding: '0.3rem' }}>
                {LOT_SIZES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </label>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Leverage
              <select value={leverage} onChange={e => setLeverage(parseInt(e.target.value))} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.3rem' }}>
                {[10, 20, 50, 100, 200, 500].map(x => <option key={x} value={x}>{x}x</option>)}
              </select>
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>TP ($)
              <input type="number" value={tpUSD} onChange={e => setTpUSD(parseFloat(e.target.value))} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--profit-color)', padding: '0.3rem' }} />
            </label>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SL ($)
              <input type="number" value={slUSD} onChange={e => setSlUSD(parseFloat(e.target.value))} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--loss-color)', padding: '0.3rem' }} />
            </label>
          </div>

          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Max Positions
            <input type="number" min="1" max="10" value={maxPositions} onChange={e => setMaxPositions(parseInt(e.target.value))} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.3rem' }} />
          </label>

          {/* Lot info */}
          <div style={{ background: 'var(--bg-dark)', borderRadius: '4px', padding: '0.5rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            <div>Contract: <strong style={{ color: '#fff' }}>{(lots * ozPerStdLot)} oz gold</strong></div>
            <div>$1 move = <strong style={{ color: '#0ecb81' }}>${(lots * ozPerStdLot).toFixed(2)} P&L</strong></div>
            <div>Margin ≈ <strong style={{ color: '#faad14' }}>~$3,000 × {lots} / {leverage}x</strong></div>
          </div>

          {/* Portfolio balance display */}
          <div style={{ padding: '0.6rem', background: 'rgba(59,130,246,0.05)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>💰 Portfolio Balance</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>
              ${(wallet?.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} USDT
            </div>
          </div>

          <button onClick={handleStart} disabled={loading} style={{ background: '#faad14', color: '#000', border: 'none', padding: '0.7rem', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
            {loading ? 'Starting...' : '▶ Launch Gold Bot'}
          </button>

          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem' }}>
            <div>🟢 Running: <strong style={{ color: '#0ecb81' }}>{running.length}</strong></div>
            <div>⬛ Stopped: <strong>{stopped.length}</strong></div>
          </div>
        </div>
      </div>

      {/* ── Main ── */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingRight: '0.25rem' }}>

        {/* Portfolio banner */}
        <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '4px solid #faad14' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Portfolio Equity (Wallet + Unrealized)</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
              ${((wallet?.balance || 0) + totalUnrealized).toLocaleString(undefined, { minimumFractionDigits: 2 })} USDT
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '2rem' }}>
            {[
              { label: 'Realized PnL (All-Time)', value: fmtPnl(wallet?.allTimePnL || 0), color: (wallet?.allTimePnL || 0) >= 0 ? 'var(--profit-color)' : 'var(--loss-color)' },
              { label: 'Wallet (Cash)', value: `$${(wallet?.balance || 0).toFixed(2)}` },
              { label: 'Total Trades', value: wallet?.allTimeTrades || 0 },
            ].map((s, i) => (
              <div key={i}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{s.label}</div>
                <div style={{ fontSize: '1rem', fontWeight: 'bold', color: s.color || '#fff' }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        {bots.length === 0 && (
          <div className="glass-panel" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ fontSize: '2rem' }}>🪙</div>
            <div style={{ color: 'var(--text-muted)' }}>ยังไม่มี Gold Bot — กด <strong>Launch Gold Bot</strong> เพื่อเริ่มต้น</div>
          </div>
        )}

        {running.length > 0 && <div style={{ fontSize: '0.72rem', color: '#0ecb81', fontWeight: 'bold' }}>🟢 RUNNING ({running.length})</div>}
        {running.map(bot => <GoldBotCard key={bot.id} bot={bot} onStop={handleStop} onDelete={handleDelete} expanded={expandedBot === bot.id} onToggle={() => setExpandedBot(expandedBot === bot.id ? null : bot.id)} />)}

        {stopped.length > 0 && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 'bold', marginTop: '0.5rem' }}>⬛ STOPPED ({stopped.length})</div>}
        {stopped.map(bot => <GoldBotCard key={bot.id} bot={bot} onStop={handleStop} onDelete={handleDelete} expanded={expandedBot === bot.id} onToggle={() => setExpandedBot(expandedBot === bot.id ? null : bot.id)} />)}
      </div>
    </div>
  );
}

function GoldBotCard({ bot, onStop, onDelete, expanded, onToggle }: {
  bot: GoldBot; onStop: (id: string) => void; onDelete: (id: string) => void;
  expanded: boolean; onToggle: () => void;
}) {
  const stratLabel = STRATEGIES.find(s => s.value === bot.config.strategy)?.label ?? bot.config.strategy;
  const contractOz = (bot.config.lots || 0.1) * ozPerStdLot;
  const netPnl = (bot.walletBalance || 0) - (bot.startBalance || 0);
  const totalTrades = (bot.trades || []).length;
  const winRate = totalTrades > 0 ? ((bot.winCount || 0) / totalTrades) * 100 : 0;
  const pnlColor = netPnl >= 0 ? 'var(--profit-color)' : 'var(--loss-color)';

  return (
    <div className="glass-panel" style={{ padding: '0.75rem 1rem', opacity: bot.isRunning ? 1 : 0.65 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        {/* Identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: bot.isRunning ? '#0ecb81' : '#555', display: 'inline-block' }} />
          <span style={{ fontWeight: 'bold', color: '#faad14' }}>🪙 GOLD (XAU)</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{bot.config.interval}</span>
          <span style={{ background: 'rgba(250,173,20,0.1)', color: '#faad14', border: '1px solid rgba(250,173,20,0.3)', borderRadius: '4px', padding: '0.1rem 0.4rem', fontSize: '0.7rem', fontWeight: 'bold' }}>{bot.config.leverage}x</span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '0.1rem 0.4rem' }}>{stratLabel}</span>
          {bot.currentPrice > 0 && <span style={{ fontWeight: 'bold' }}>${fmtPrice(bot.currentPrice)}</span>}
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '1.2rem', alignItems: 'center', fontSize: '0.82rem', flexWrap: 'wrap' }}>
          {[
            { label: 'Net PnL', value: fmtPnl(netPnl), color: pnlColor },
            { label: 'Unrealized', value: fmtPnl(bot.unrealizedPnl || 0), color: (bot.unrealizedPnl || 0) >= 0 ? 'var(--profit-color)' : 'var(--loss-color)' },
            { label: 'Wallet', value: `$${(bot.walletBalance || 0).toFixed(2)}` },
            { label: 'Win Rate', value: `${winRate.toFixed(1)}%`, sub: `${bot.winCount || 0}W/${bot.lossCount || 0}L` },
            { label: 'Signal', value: bot.lastSignal, color: posColor(bot.lastSignal) },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{s.label}</div>
              <div style={{ fontWeight: 'bold', color: s.color || '#fff' }}>{s.value}</div>
              {s.sub && <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{s.sub}</div>}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button onClick={onToggle} style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', padding: '0.3rem 0.6rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>
            {expanded ? '▲' : '▼ Detail'}
          </button>
          {bot.isRunning
            ? <button onClick={() => onStop(bot.id)} style={{ background: '#f6465d22', color: '#f6465d', border: '1px solid #f6465d55', padding: '0.3rem 0.7rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>■ Stop</button>
            : <button onClick={() => onDelete(bot.id)} style={{ background: '#55555522', color: '#aaa', border: '1px solid #55555555', padding: '0.3rem 0.7rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>🗑 Delete</button>
          }
        </div>
      </div>

      {/* Meta row */}
      <div style={{ marginTop: '0.35rem', fontSize: '0.68rem', color: 'var(--text-muted)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <span>Lots: <strong style={{ color: '#faad14' }}>{bot.config.lots}</strong></span>
        <span>Contract: {contractOz} oz</span>
        <span>TP: ${bot.config.tpUSD} · SL: ${bot.config.slUSD}</span>
        <span>$1 move = ${contractOz.toFixed(2)} P&L</span>
        <span>Started: {bot.startedAt}</span>
        {bot.lastChecked && <span>Checked: {bot.lastChecked}</span>}
      </div>

      {/* Expanded section */}
      {expanded && (
        <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

          {/* Open Positions */}
          {(bot.openPositions || []).length > 0 && (
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'bold', marginBottom: '0.4rem' }}>📌 OPEN POSITIONS ({bot.openPositions.length})</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead>
                  <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ textAlign: 'left', padding: '0.3rem 0.4rem' }}>Side</th>
                    <th>Entry $</th><th>Current $</th><th>Liq. Price $</th>
                    <th style={{ textAlign: 'right' }}>Unrealized PnL</th>
                    <th style={{ textAlign: 'right' }}>ROE %</th>
                  </tr>
                </thead>
                <tbody>
                  {bot.openPositions.map(pos => {
                    const pnlPct = bot.currentPrice > 0
                      ? (bot.currentPrice - pos.entryPrice) / pos.entryPrice * (pos.type === 'LONG' ? 1 : -1)
                      : 0;
                    const unrealPnl = pnlPct * contractOz * pos.entryPrice;
                    return (
                      <tr key={pos.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.3rem 0.4rem', color: posColor(pos.type), fontWeight: 'bold' }}>{pos.type}</td>
                        <td>${fmtPrice(pos.entryPrice)}</td>
                        <td style={{ fontWeight: 'bold' }}>${fmtPrice(bot.currentPrice)}</td>
                        <td style={{ color: '#f6465d' }}>{pos.liqId ? `$${fmtPrice(pos.liqId)}` : '–'}</td>
                        <td style={{ textAlign: 'right', color: unrealPnl >= 0 ? 'var(--profit-color)' : 'var(--loss-color)', fontWeight: 'bold' }}>{fmtPnl(unrealPnl)}</td>
                        <td style={{ textAlign: 'right', color: pnlPct >= 0 ? 'var(--profit-color)' : 'var(--loss-color)' }}>{(pnlPct * bot.config.leverage * 100).toFixed(2)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {(bot.openPositions || []).length === 0 && totalTrades === 0 && (
            <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              {bot.isRunning ? '⏳ Waiting for signal...' : 'No trades recorded.'}
            </div>
          )}

          {/* Trade History */}
          {totalTrades > 0 && (
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'bold', marginBottom: '0.4rem' }}>📋 TRADE HISTORY ({totalTrades})</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead>
                  <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ textAlign: 'left', padding: '0.3rem 0.4rem' }}>Side</th>
                    <th>Entry Time</th><th>Exit Time</th>
                    <th>Entry $</th><th>Exit $</th>
                    <th style={{ textAlign: 'right' }}>PnL ($)</th>
                    <th style={{ textAlign: 'right' }}>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {[...bot.trades].reverse().map((t, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.3rem 0.4rem', color: posColor(t.type), fontWeight: 'bold' }}>{t.type}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>{t.entryTime}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>{t.exitTime}</td>
                      <td>${fmtPrice(t.entryPrice)}</td>
                      <td>${fmtPrice(t.exitPrice)}</td>
                      <td style={{ textAlign: 'right', color: t.pnl >= 0 ? 'var(--profit-color)' : 'var(--loss-color)', fontWeight: 'bold' }}>{fmtPnl(t.pnl)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.7rem' }}>{t.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
