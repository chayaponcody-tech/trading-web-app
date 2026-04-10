import { useState, useEffect, useRef } from 'react';
import SymbolSelector from '../components/SymbolSelector';

const API = '';

const STRATEGIES = [
  { value: 'EMA', label: 'EMA Crossover' },
  { value: 'BB', label: 'BB Mean Reversion' },
  { value: 'RSI', label: 'RSI Oversold/Overbought' },
  { value: 'EMA_RSI', label: '⚡ EMA + RSI' },
  { value: 'BB_RSI', label: '⚡ BB + RSI' },
  { value: 'EMA_BB_RSI', label: '⚡ EMA + BB + RSI' },
  { value: 'GRID', label: '🌐 Grid Trading (Mean Reversion)' },
  { value: 'AI_SCOUTER', label: '🏹 AI Scouting (5m Scalp)' },
  { value: 'EMA_SCALP', label: '⚡ EMA Scalp (3/8 Fast)' },
  { value: 'STOCH_RSI', label: '🎯 Stochastic RSI Scalp' },
  { value: 'VWAP_SCALP', label: '📊 VWAP Scalp + Momentum' },
];


const INTERVALS = ['5m', '15m', '1h', '4h', '1d'];

interface OpenPosition {
  id: string;
  type: string;
  entryPrice: number;
  entryTime: string;
  liqId?: number;
  initialMargin?: number;
}

interface Trade {
  entryTime: string;
  exitTime: string;
  type: string;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  reason: string;
}

interface Bot {
  id: string;
  isRunning: boolean;
  config: { 
    symbol: string; 
    interval: string; 
    strategy: string; 
    tpPercent: number; 
    slPercent: number; 
    capital: number; 
    maxPositions?: number;
    leverage?: number;
    positionSizeUSDT?: number;
  };
  openPositions: OpenPosition[];
  capital: number;
  equity: number;
  currentCash: number;
  netPnl: number;
  netPnlPct: number;
  winRate: number;
  winCount: number;
  lossCount: number;
  totalTrades: number;
  lastSignal: string;
  lastChecked: string;
  startedAt: string;
  currentPrice: number;
  unrealizedPnl: number;
  trades: Trade[];
}

const statusColor = (pos: string) =>
  pos === 'LONG' ? 'var(--profit-color)' : pos === 'SHORT' ? 'var(--loss-color)' : 'var(--text-muted)';

export default function ForwardTest() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [intervalTime, setIntervalTime] = useState('1h');
  const [strategy, setStrategy] = useState('EMA');
  const [tpPercent, setTpPercent] = useState(2);
  const [slPercent, setSlPercent] = useState(1);
  const [maxPositions, setMaxPositions] = useState(3);
  const [leverage, setLeverage] = useState(10);
  const [positionSizeUSDT, setPositionSizeUSDT] = useState(100);
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedBot, setExpandedBot] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  // Filter state
  const [filterSymbol, setFilterSymbol] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'running' | 'stopped'>('all');
  const [filterStrategy, setFilterStrategy] = useState('');
  const [sortBy, setSortBy] = useState<'time' | 'pnl'>('time');

  // Global Wallet State
  const [wallet, setWallet] = useState<{ balance: number, allTimePnL: number, allTimeTrades: number } | null>(null);

  const fetchWallet = async () => {
    try {
      const res = await fetch(`${API}/api/wallet`);
      setWallet(await res.json());
    } catch {}
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API}/api/forward-test/status`);
      const data = await res.json();
      // Filter to show only Paper bots
      setBots(Array.isArray(data) ? data.filter(b => b.config.exchange !== 'binance_testnet') : []);
      fetchWallet();
    } catch { /* server not ready */ }
  };

  useEffect(() => {
    fetchStatus();
    pollRef.current = window.setInterval(fetchStatus, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleStart = async () => {
    setLoading(true);
    await fetch(`${API}/api/forward-test/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        symbol, interval: intervalTime, strategy, capital: wallet?.balance || 10000, 
        tpPercent, slPercent, maxPositions, leverage, positionSizeUSDT,
        exchange: 'paper'
      }),
    });
    await fetchStatus();
    setLoading(false);
  };

  const handleStop = async (botId: string) => {
    await fetch(`${API}/api/forward-test/stop`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ botId }),
    });
    await fetchStatus();
  };

  const handleDelete = async (botId: string) => {
    await fetch(`${API}/api/forward-test/delete`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ botId }),
    });
    await fetchStatus();
  };

  const runningBots = bots.filter(b => b.isRunning);
  const stoppedBots = bots.filter(b => !b.isRunning);

  // Apply filters
  const filteredBots = bots
    .filter(b => filterStatus === 'all' ? true : filterStatus === 'running' ? b.isRunning : !b.isRunning)
    .filter(b => !filterSymbol || b.config.symbol.toLowerCase().includes(filterSymbol.toLowerCase()))
    .filter(b => !filterStrategy || b.config.strategy === filterStrategy)
    .sort((a, b) => sortBy === 'pnl' ? b.netPnl - a.netPnl : new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

  const filteredRunning = filteredBots.filter(b => b.isRunning);
  const filteredStopped = filteredBots.filter(b => !b.isRunning);

  return (
    <div style={{ display: 'flex', gap: '1rem', height: '100%', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div className="glass-panel" style={{ width: '220px', flexShrink: 0, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto' }}>
        <h4 className="m-0" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', fontSize: '1rem' }}>+ New Bot</h4>

        <SymbolSelector value={symbol} onSelect={setSymbol} compact />

        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Timeframe
          <select value={intervalTime} onChange={e => setIntervalTime(e.target.value)} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.4rem', borderRadius: '4px', marginTop: '0.2rem' }}>
            {INTERVALS.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </label>

        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Strategy
          <select value={strategy} onChange={e => setStrategy(e.target.value)} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.4rem', borderRadius: '4px', marginTop: '0.2rem' }}>
            {STRATEGIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>TP%
            <input type="number" step="0.5" value={tpPercent} onChange={e => setTpPercent(parseFloat(e.target.value))} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.3rem' }} />
          </label>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SL%
            <input type="number" step="0.5" value={slPercent} onChange={e => setSlPercent(parseFloat(e.target.value))} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.3rem' }} />
          </label>
        </div>

        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Max Positions
          <input type="number" min="1" max="10" value={maxPositions} onChange={e => setMaxPositions(parseInt(e.target.value))} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.3rem' }} />
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Leverage
            <select value={leverage} onChange={e => setLeverage(parseInt(e.target.value))} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: '#faad14', padding: '0.3rem', fontWeight: 'bold' }}>
              {[1, 2, 3, 5, 10, 20, 50, 75, 100].map(x => <option key={x} value={x}>{x}x</option>)}
            </select>
          </label>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Size/Pos ($)
            <input type="number" step="10" value={positionSizeUSDT} onChange={e => setPositionSizeUSDT(parseFloat(e.target.value))} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.3rem' }} />
          </label>
        </div>

        <div style={{ padding: '0.8rem', background: 'rgba(59,130,246,0.05)', borderRadius: '6px', border: '1px solid var(--border-color)', marginBottom: '0.5rem' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>💰 Portfolio Balance (Available)</div>
          <div style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>
             ${(wallet?.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} USDT
          </div>
        </div>

        <button onClick={handleStart} disabled={loading} style={{ background: 'var(--accent-primary)', color: '#fff', border: 'none', padding: '0.7rem', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
          {loading ? 'Starting...' : '▶ Launch Bot'}
        </button>

        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem' }}>
          <div>🟢 Running: <strong style={{ color: '#0ecb81' }}>{runningBots.length}</strong></div>
          <div>⬛ Stopped: <strong>{stoppedBots.length}</strong></div>
          <div style={{ marginTop: '0.3rem', fontSize: '0.65rem' }}>Auto-refresh every 5s</div>
        </div>
      </div>

      {/* Bot Cards */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto', paddingRight: '0.25rem' }}>
        
        {/* Portfolio Wallet Dashboard */}
        <div className="glass-panel" style={{ 
          background: 'linear-gradient(135deg, rgba(23, 27, 34, 0.95), rgba(40, 48, 62, 0.9))',
          padding: '1.25rem', borderLeft: '4px solid var(--accent-primary)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Total Portfolio Equity (Wallet + Unrealized)</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              ${((wallet?.balance || 0) + bots.reduce((s, b) => s + (b.unrealizedPnl || 0), 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>USDT</span>
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '2rem' }}>
             <StatLarge label="Total Realized PnL" value={`${(wallet?.allTimePnL || 0) >= 0 ? '+' : ''}$${(wallet?.allTimePnL || 0).toFixed(2)}`} color={(wallet?.allTimePnL || 0) >= 0 ? 'var(--profit-color)' : 'var(--loss-color)'} />
             <StatLarge label="Wallet (Cash)" value={`$${(wallet?.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
             <StatLarge label="Total Trades" value={wallet?.allTimeTrades || 0} sub="All Bots" />
          </div>
        </div>

        {/* Filter Bar */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.6rem 0.75rem' }}>
          {/* Symbol search */}
          <input
            type="text"
            placeholder="🔍 กรองเหรียญ เช่น BTC"
            value={filterSymbol}
            onChange={e => setFilterSymbol(e.target.value)}
            style={{ background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', width: '140px' }}
          />
          {/* Status tabs */}
          {(['all', 'running', 'stopped'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} style={{
              padding: '0.3rem 0.7rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer',
              border: filterStatus === s ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
              background: filterStatus === s ? 'rgba(59,130,246,0.15)' : 'var(--bg-dark)',
              color: filterStatus === s ? 'var(--accent-primary)' : 'var(--text-muted)',
            }}>
              {s === 'all' ? `ทั้งหมด (${bots.length})` : s === 'running' ? `🟢 Running (${runningBots.length})` : `⬛ Stopped (${stoppedBots.length})`}
            </button>
          ))}
          {/* Strategy filter */}
          <select value={filterStrategy} onChange={e => setFilterStrategy(e.target.value)} style={{ background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', padding: '0.3rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}>
            <option value="">🎯 กลยุทธ์ทั้งหมด</option>
            {STRATEGIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          {/* Sort */}
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} style={{ background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', padding: '0.3rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', marginLeft: 'auto' }}>
            <option value="time">⏱ เรียงตามเวลา</option>
            <option value="pnl">📈 เรียงตาม PnL</option>
          </select>
          {/* Clear */}
          {(filterSymbol || filterStatus !== 'all' || filterStrategy) && (
            <button onClick={() => { setFilterSymbol(''); setFilterStatus('all'); setFilterStrategy(''); }} style={{ background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}>✕ ล้าง</button>
          )}
        </div>

        {filteredBots.length === 0 && bots.length > 0 && (
          <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            ไม่พบ Bot ที่ตรงกับ Filter ที่เลือก
          </div>
        )}
        {bots.length === 0 && (
          <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No bots yet. Configure and click <strong>▶ Launch Bot</strong>.
          </div>
        )}

        {filteredRunning.length > 0 && <div style={{ fontSize: '0.72rem', color: '#0ecb81', fontWeight: 'bold' }}>🟢 RUNNING ({filteredRunning.length})</div>}
        {filteredRunning.map(bot => (
          <BotCard key={bot.id} bot={bot} onStop={handleStop} onDelete={handleDelete}
            expanded={expandedBot === bot.id} onToggle={() => setExpandedBot(expandedBot === bot.id ? null : bot.id)} />
        ))}

        {filteredStopped.length > 0 && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 'bold', marginTop: '0.5rem' }}>⬛ STOPPED ({filteredStopped.length})</div>}
        {filteredStopped.map(bot => (
          <BotCard key={bot.id} bot={bot} onStop={handleStop} onDelete={handleDelete}
            expanded={expandedBot === bot.id} onToggle={() => setExpandedBot(expandedBot === bot.id ? null : bot.id)} />
        ))}
      </div>
    </div>
  );
}

function BotCard({ bot, onStop, onDelete, expanded, onToggle }: {
  bot: Bot; onStop: (id: string) => void; onDelete: (id: string) => void;
  expanded: boolean; onToggle: () => void;
}) {
  const stratLabel = STRATEGIES.find(s => s.value === bot.config.strategy)?.label ?? bot.config.strategy;
  const pnlColor = (bot.netPnl || 0) >= 0 ? 'var(--profit-color)' : 'var(--loss-color)';
  const posValue = bot.config.positionSizeUSDT || 100;
  const leverage = bot.config.leverage || 10;
  const openCount = bot.openPositions?.length ?? 0;

  return (
    <div className="glass-panel" style={{ padding: '0.75rem 1rem', opacity: bot.isRunning ? 1 : 0.65 }}>
      {/* Header Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        {/* Identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, background: bot.isRunning ? '#0ecb81' : '#555', display: 'inline-block', animation: bot.isRunning ? 'pulse 1.5s ease-in-out infinite' : 'none' }} />
          <span style={{ fontWeight: 'bold' }}>{bot.config.symbol.replace('USDT', '/USDT')}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{bot.config.interval}</span>
          <span style={{ background: 'rgba(250, 173, 20, 0.1)', border: '1px solid #faad1444', color: '#faad14', borderRadius: '4px', padding: '0.1rem 0.4rem', fontSize: '0.7rem', fontWeight: 'bold' }}>{leverage}x</span>
          <span style={{ background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '0.1rem 0.4rem', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>{stratLabel}</span>
          {/* Current Price */}
          {bot.currentPrice > 0 && (
            <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#fff' }}>
              ${bot.currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          )}
        </div>

        {/* Mini Stats */}
        <div style={{ display: 'flex', gap: '1.2rem', alignItems: 'center', fontSize: '0.82rem', flexWrap: 'wrap' }}>
          <Stat label="Net PnL" value={`${(bot.netPnl || 0) >= 0 ? '+' : ''}$${(bot.netPnl || 0).toFixed(2)}`} color={pnlColor} />
          <Stat label="Unrealized" value={`${(bot.unrealizedPnl || 0) >= 0 ? '+' : ''}$${(bot.unrealizedPnl || 0).toFixed(2)}`} color={(bot.unrealizedPnl || 0) >= 0 ? 'var(--profit-color)' : 'var(--loss-color)'} />
          <Stat label="Wallet" value={`$${(bot.equity || 0).toFixed(2)}`} />
          <Stat label="Win Rate" value={`${(bot.winRate || 0).toFixed(1)}%`} sub={`${bot.winCount || 0}W/${bot.lossCount || 0}L`} />
          <Stat label="Pos." value={`${openCount}/${bot.config.maxPositions || 5}`} color={openCount > 0 ? '#fff' : 'var(--text-muted)'} />
          <Stat label="Signal" value={bot.lastSignal} color={statusColor(bot.lastSignal)} />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
          <button onClick={onToggle} style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', padding: '0.3rem 0.6rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>
            {expanded ? '▲' : '▼ Detail'}
          </button>
          {bot.isRunning ? (
            <button onClick={() => onStop(bot.id)} style={{ background: '#f6465d22', color: '#f6465d', border: '1px solid #f6465d55', padding: '0.3rem 0.7rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>
              ■ Stop
            </button>
          ) : (
            <button onClick={() => onDelete(bot.id)} style={{ background: '#55555522', color: '#aaa', border: '1px solid #55555555', padding: '0.3rem 0.7rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>
              🗑 Delete
            </button>
          )}
        </div>
      </div>

      {/* Meta row */}
      <div style={{ marginTop: '0.35rem', fontSize: '0.68rem', color: 'var(--text-muted)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <span>TP (Raw): {bot.config.tpPercent}% · SL (Raw): {bot.config.slPercent}%</span>
        <span>Size/Pos: ${posValue.toLocaleString()}</span>
        <span>Start Capital: ${bot.capital.toLocaleString()}</span>
        <span>Wallet Balance: ${(bot.currentCash || 0).toFixed(2)} USDT</span>
        <span>Started: {bot.startedAt}</span>
        {bot.lastChecked && <span>Checked: {bot.lastChecked}</span>}
      </div>

      {/* Expanded Detail */}
      {expanded && (
        <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

          {/* Open Positions Table */}
          {openCount > 0 && (
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'bold', marginBottom: '0.4rem' }}>📌 OPEN POSITIONS ({openCount})</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '0.3rem 0.5rem', textAlign: 'left' }}>Side</th>
                    <th style={{ textAlign: 'left' }}>Entry $</th>
                    <th style={{ textAlign: 'left' }}>Liq. Price $</th>
                    <th style={{ textAlign: 'left' }}>Margin (Isolated)</th>
                    <th style={{ textAlign: 'right' }}>Unrealized PnL ($)</th>
                    <th style={{ textAlign: 'right' }}>Net PnL % (ROE / Raw)</th>
                    <th style={{ textAlign: 'right' }}>Since</th>
                  </tr>
                </thead>
                <tbody>
                  {bot.openPositions.map((pos) => {
                    const pnlPct = bot.currentPrice > 0 && pos.entryPrice > 0
                      ? ((bot.currentPrice - pos.entryPrice) / pos.entryPrice) * (pos.type === 'LONG' ? 1 : -1)
                      : 0;
                    const unrealPnl = pnlPct * posValue;
                    const isClosingLiq = pos.liqId && (
                      pos.type === 'LONG' 
                        ? (bot.currentPrice <= pos.liqId * 1.02) 
                        : (bot.currentPrice >= pos.liqId * 0.98)
                    );

                    return (
                      <tr key={pos.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.4rem 0.5rem', color: statusColor(pos.type), fontWeight: 'bold' }}>{pos.type}</td>
                        <td style={{ padding: '0.4rem 0.5rem' }}>${pos.entryPrice.toLocaleString()}</td>
                        <td style={{ padding: '0.4rem 0.5rem', color: isClosingLiq ? '#f6465d' : 'inherit', fontWeight: isClosingLiq ? 'bold' : 'normal' }}>
                          ${pos.liqId?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          {isClosingLiq && <span title="Close to Liquidation" style={{ marginLeft: '4px' }}>⚠️</span>}
                        </td>
                        <td style={{ padding: '0.4rem 0.5rem' }}>${(pos.initialMargin || 0).toFixed(2)}</td>
                        <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', color: unrealPnl >= 0 ? 'var(--profit-color)' : 'var(--loss-color)', fontWeight: 'bold' }}>
                          {unrealPnl >= 0 ? '+' : ''}${unrealPnl.toFixed(2)}
                        </td>
                        <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', color: pnlPct >= 0 ? 'var(--profit-color)' : 'var(--loss-color)' }}>
                           <span style={{ fontWeight: 'bold', fontSize: '1rem' }}>{(pnlPct * leverage * 100).toFixed(2)}%</span>
                           <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Raw: {(pnlPct * 100).toFixed(2)}%</div>
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.7rem' }}>{pos.entryTime}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* No position, waiting */}
          {openCount === 0 && bot.trades.length === 0 && (
            <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              {bot.isRunning ? '⏳ No position yet — waiting for signal...' : 'No trades recorded.'}
            </div>
          )}

          {/* Closed Trades */}
          {bot.trades.length > 0 && (
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'bold', marginBottom: '0.4rem' }}>📋 TRADE HISTORY ({bot.trades.length})</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '0.3rem 0.5rem', textAlign: 'left' }}>Entry</th>
                    <th>Exit</th><th>Type</th><th>Entry $</th><th>Exit $</th>
                    <th style={{ textAlign: 'right' }}>PnL</th>
                    <th style={{ textAlign: 'right' }}>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {[...bot.trades].reverse().map((t, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.3rem 0.5rem' }}>{t.entryTime}</td>
                      <td>{t.exitTime}</td>
                      <td style={{ color: t.type === 'LONG' ? 'var(--profit-color)' : 'var(--loss-color)', fontWeight: 'bold' }}>{t.type}</td>
                      <td>${t.entryPrice.toFixed(2)}</td>
                      <td>${t.exitPrice.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', color: t.pnl >= 0 ? 'var(--profit-color)' : 'var(--loss-color)', fontWeight: 'bold' }}>
                        {t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}
                      </td>
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

function StatLarge({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.1rem' }}>{label}</div>
      <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: color || '#fff' }}>
        {value}
        {sub && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'normal', marginLeft: '0.3rem' }}>{sub}</span>}
      </div>
    </div>
  );
}

function Stat({ label, value, sub, color = '#fff' }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ fontWeight: 'bold', color }}>{value}</div>
      {sub && <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  );
}
