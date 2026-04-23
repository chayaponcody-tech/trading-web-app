import { useState, useEffect } from 'react';
import { API, type Bot } from '../types';

interface Props {
  bot: Bot;
  onStop: (id: string) => void;
  onDelete: (id: string) => void;
  onResume: (id: string) => void;
  expanded: boolean;
  onToggle: () => void;
  onReview: (id: string) => void;
  onOptimize: (id: string) => void;
  isGrid?: boolean;
  viewMode?: 'grid' | 'list' | 'mini' | 'compact' | 'table';
  exchangePositions?: any[];
  onViewChart?: (symbol: string, interval: string, price: number, entryTime: string | number, type: string, reason: string, strategy: string, gridUpper?: number, gridLower?: number) => void;
}

export default function BotCard({ bot, onStop, onDelete, onResume, expanded, onToggle, onReview, onOptimize, viewMode, onViewChart, exchangePositions }: Props) {
  const thoughtText = bot.currentThought || bot.lastEntryReason || 'Scanning...';
  const [editingInterval, setEditingInterval] = useState<number>(bot.config.aiCheckInterval || 0);
  const [isUpdating, setIsUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState<'trades' | 'positions' | 'ai' | 'reflect'>('trades');
  const [marketDepth, setMarketDepth] = useState<{ openInterest: number; fundingRate: number; nextFundingTime: number } | null>(null);
  const [showSignal, setShowSignal] = useState(true);

  useEffect(() => {
    if (bot.config.symbol) {
      const fetchDepth = async () => {
        try {
          const cleanSymbol = bot.config.symbol.includes(':') ? bot.config.symbol : bot.config.symbol;
          const res = await fetch(`${API}/api/binance/market-depth?symbol=${encodeURIComponent(cleanSymbol)}`);
          if (!res.ok) throw new Error('Status ' + res.status);
          const data = await res.json();
          setMarketDepth(data);
        } catch (e) {
          console.error('[BotCard] Market Depth Fetch Failed:', e);
        }
      };
      fetchDepth();
      const timer = setInterval(fetchDepth, 60000);
      return () => clearInterval(timer);
    }
  }, [bot.config.symbol]);

  const handleUpdateInterval = async () => {
    setIsUpdating(true);
    try {
      await fetch(`${API}/api/forward-test/update`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botId: bot.id, config: { aiCheckInterval: editingInterval } }),
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const netPnl = bot.netPnl || 0;
  const netPnlColor = netPnl >= 0 ? '#0ecb81' : '#f6465d';
  const winRate = bot.totalTrades > 0 ? ((bot.winCount / bot.totalTrades) * 100).toFixed(1) : '0.0';
  const stratColor = bot.config.strategy === 'AI_GRID_SWING' ? '#1890ff' : '#faad14';

  // Match this bot's positions from Binance exchange data
  const normalizeSymbol = (s: string) => s.replace('/', '').replace(':USDT', '').replace(':USD', '').toUpperCase();
  const matchedExchangePositions = (exchangePositions || []).filter(
    p => normalizeSymbol(p.symbol) === normalizeSymbol(bot.config.symbol) && parseFloat(p.positionAmt) !== 0
  );

  // ─── Shared expanded detail panel ────────────────────────────────────────────
  const ExpandedPanel = () => (
    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.8rem', marginTop: '0.4rem' }}>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        <TabBtn active={activeTab === 'trades'} onClick={() => setActiveTab('trades')} label="Trades" count={(bot.trades || []).length} />
        <TabBtn active={activeTab === 'positions'} onClick={() => setActiveTab('positions')} label="Positions" count={(bot.openPositions || []).length} />
        <TabBtn active={activeTab === 'ai'} onClick={() => setActiveTab('ai')} label="AI Logs" count={(bot.aiHistory || []).length} />
        <TabBtn active={activeTab === 'reflect'} onClick={() => setActiveTab('reflect')} label="Reflections" count={(bot.reflectionHistory || []).length} />
      </div>
      {activeTab === 'trades' && (
        <>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem', background: 'rgba(250,173,20,0.05)', padding: '0.5rem', borderRadius: '6px' }}>
            <span style={{ fontSize: '0.7rem', color: '#faad14' }}>Auto Review (min):</span>
            <input type="number" value={editingInterval} onChange={e => setEditingInterval(parseInt(e.target.value))} style={{ width: '45px', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: '#fff', padding: '0.1rem', borderRadius: '4px', fontSize: '0.7rem' }} />
            <button onClick={handleUpdateInterval} disabled={isUpdating} style={{ background: '#faad14', color: '#000', border: 'none', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.65rem' }}>Save</button>
          </div>
          <TradeList trades={bot.trades || []} />
        </>
      )}
      {activeTab === 'positions' && <BotPositionList positions={matchedExchangePositions.length > 0 ? matchedExchangePositions : bot.openPositions || []} currentPrice={bot.currentPrice || 0} leverage={bot.config.leverage || 1} botUnrealizedPnl={bot.unrealizedPnl} positionSizeUSDT={bot.config.positionSizeUSDT || bot.capital} useExchange={matchedExchangePositions.length > 0} />}
      {activeTab === 'ai' && <AiLogList logs={bot.aiHistory || []} />}
      {activeTab === 'reflect' && <AiLogList logs={bot.reflectionHistory || []} isReflection />}
    </div>
  );

  // ─── Action buttons ───────────────────────────────────────────────────────────
  const ActionButtons = ({ compact = false }: { compact?: boolean }) => (
    <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
      <button
        onClick={() => onReview(bot.id)}
        disabled={(bot.trades || []).filter((t: any) => t.pnl < 0).length === 0}
        style={{ background: 'rgba(246,70,93,0.1)', border: '1px solid rgba(246,70,93,0.3)', color: '#f6465d', padding: compact ? '0.3rem 0.5rem' : '0.5rem 0.7rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold', opacity: (bot.trades || []).filter((t: any) => t.pnl < 0).length === 0 ? 0.35 : 1 }}>
        🔍
      </button>
      <button
        onClick={() => onOptimize(bot.id)}
        style={{ background: 'rgba(14,203,129,0.1)', border: '1px solid rgba(14,203,129,0.3)', color: '#0ecb81', padding: compact ? '0.3rem 0.5rem' : '0.5rem 0.7rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold' }}>
        ✨
      </button>
      {bot.isRunning ? (
        <button onClick={() => onStop(bot.id)} style={{ background: '#f6465d22', color: '#f6465d', border: 'none', padding: compact ? '0.3rem 0.6rem' : '0.5rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>Stop</button>
      ) : (
        <button onClick={() => onResume(bot.id)} style={{ background: '#faad14', color: '#000', border: 'none', padding: compact ? '0.3rem 0.6rem' : '0.5rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>Start</button>
      )}
      {!bot.isRunning && (
        <button onClick={() => onDelete(bot.id)} style={{ padding: compact ? '0.3rem 0.4rem' : '0.5rem 0.5rem', background: 'rgba(255,255,255,0.05)', border: 'none', color: '#555', borderRadius: '4px', cursor: 'pointer', fontSize: '0.65rem' }}>✕</button>
      )}
    </div>
  );

  // ─── MINI view ────────────────────────────────────────────────────────────────
  if (viewMode === 'mini') {
    return (
      <div className="glass-panel" style={{ padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', gap: '1.25rem', borderLeft: `3px solid ${stratColor}`, background: bot.isRunning ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', width: '120px' }}>
          <span style={{ color: bot.isRunning ? '#0ecb81' : '#555', fontSize: '0.5rem', animation: bot.isRunning ? 'pulse 2s infinite' : 'none' }}>●</span>
          <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#fff' }}>{bot.config.symbol}</span>
          {onViewChart && (
            <button onClick={() => onViewChart(bot.config.symbol, bot.config.interval, bot.openPositions?.[0]?.entryPrice || bot.currentPrice, bot.openPositions?.[0]?.entryTime || 0, bot.openPositions?.[0]?.type || 'LONG', bot.openPositions?.[0]?.entryReason || bot.aiReason || 'Manual', bot.config.strategy, bot.config.gridUpper, bot.config.gridLower)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.7rem' }}>📈</button>
          )}
        </div>
        <div style={{ width: '80px', textAlign: 'right' }}>
          <div style={{ color: netPnlColor, fontWeight: 'bold', fontSize: '0.9rem' }}>{netPnl >= 0 ? '+' : ''}{netPnl.toFixed(2)}</div>
          <div style={{ fontSize: '0.55rem', color: '#888' }}>NET PNL</div>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.6rem', overflow: 'hidden' }}>
          <span style={{ fontSize: '0.9rem', opacity: bot.isRunning ? 1 : 0.3 }}>🧠</span>
          <span style={{ fontSize: '0.75rem', color: bot.isRunning ? '#faad14' : '#555', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontStyle: 'italic' }}>
            {bot.isRunning ? thoughtText : 'Idle...'}
          </span>
        </div>
        <ActionButtons compact />
      </div>
    );
  }

  // ─── COMPACT view (แบบที่ 1: collapsed card + expand) ────────────────────────
  if (viewMode === 'compact') {
    return (
      <div className="glass-panel" style={{ borderLeft: `3px solid ${stratColor}`, overflow: 'hidden', background: bot.isRunning ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.15)' }}>
        {/* Header row — always visible */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.7rem 1rem' }}>
          {/* Status + Symbol */}
          <span style={{ color: bot.isRunning ? '#0ecb81' : '#555', fontSize: '0.45rem', flexShrink: 0 }}>●</span>
          <div style={{ minWidth: 0, flex: '0 0 auto' }}>
            <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#fff', whiteSpace: 'nowrap' }}>{bot.config.symbol}</div>
            <div style={{ fontSize: '0.6rem', color: stratColor, opacity: 0.8 }}>{bot.config.strategy} · {bot.config.interval} · {bot.config.leverage}x</div>
          </div>

          {/* Price */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#faad14' }}>${bot.currentPrice?.toFixed(4)}</div>
            <div style={{ fontSize: '0.55rem', color: '#666' }}>price</div>
          </div>

          {/* PNL strip */}
          <div style={{ display: 'flex', gap: '0.75rem', flex: 1, justifyContent: 'center' }}>
            <PnlChip label="Net" value={netPnl} />
            <PnlChip label="Real" value={bot.realizedPnl || 0} />
            <PnlChip label="Open" value={bot.unrealizedPnl || 0} amber />
          </div>

          {/* Win rate */}
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: parseFloat(winRate) >= 50 ? '#0ecb81' : '#f6465d' }}>{winRate}%</div>
            <div style={{ fontSize: '0.55rem', color: '#666' }}>win</div>
          </div>

          {/* Signal pill */}
          <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
            <div style={{ fontSize: '0.65rem', color: bot.isRunning ? '#faad14' : '#444', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontStyle: 'italic' }}>
              🧠 {bot.isRunning ? thoughtText : 'Idle'}
            </div>
          </div>

          {/* Actions + expand toggle */}
          <ActionButtons compact />
          <button onClick={onToggle} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: '0.8rem', padding: '0.2rem 0.3rem', flexShrink: 0 }}>
            {expanded ? '▲' : '▼'}
          </button>
        </div>

        {/* Expanded detail */}
        {expanded && (
          <div style={{ padding: '0 1rem 1rem' }}>
            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '0.7rem', borderRadius: '8px', marginBottom: '0.75rem' }}>
              <MiniStat label="Smart Budget" value={`$${(bot.config.positionSizeUSDT || bot.capital || 0).toFixed(2)}`} color="#faad14" />
              <MiniStat label="Risk Shield" value={`$${(bot.config.maxLossUSDT || (bot.config.positionSizeUSDT || bot.capital || 0) * 0.05).toFixed(2)}`} color="#f6465d" />
              <MiniStat label="OI / Funding" value={marketDepth ? `${(marketDepth.fundingRate * 100).toFixed(4)}%` : '...'} color={(marketDepth?.fundingRate || 0) > 0 ? '#faad14' : '#0ecb81'} />
            </div>

            {/* AI Reason */}
            {bot.aiReason && (
              <div style={{ background: 'rgba(250,173,20,0.06)', border: '1px solid rgba(250,173,20,0.15)', borderRadius: '6px', padding: '0.6rem 0.8rem', marginBottom: '0.75rem', fontSize: '0.78rem', color: '#ddd', lineHeight: '1.5' }}>
                <span style={{ fontSize: '0.6rem', color: '#faad14', fontWeight: 'bold', textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}>🧠 Deep Market Logic · {bot.lastAiModel || 'Smart Core'}</span>
                {bot.aiReason}
              </div>
            )}

            {/* TP/SL */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <div style={{ background: 'rgba(14,203,129,0.05)', border: '1px solid rgba(14,203,129,0.1)', borderRadius: '6px', padding: '0.5rem 0.7rem' }}>
                <div style={{ fontSize: '0.55rem', color: '#888' }}>TAKE PROFIT AT</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#0ecb81' }}>
                  {bot.openPositions?.[0] ? `$${((bot.openPositions[0].entryPrice || 0) * (1 + (bot.config.tpPercent || 0) / 100)).toFixed(4)}` : '—'}
                </div>
              </div>
              <div style={{ background: 'rgba(246,70,93,0.05)', border: '1px solid rgba(246,70,93,0.1)', borderRadius: '6px', padding: '0.5rem 0.7rem' }}>
                <div style={{ fontSize: '0.55rem', color: '#888' }}>STOP LOSS AT</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#f6465d' }}>
                  {bot.openPositions?.[0] ? `$${((bot.openPositions[0].entryPrice || 0) * (1 - (bot.config.slPercent || 0) / 100)).toFixed(4)}` : '—'}
                </div>
              </div>
            </div>

            <ExpandedPanel />
          </div>
        )}
      </div>
    );
  }

  // ─── TABLE ROW view (แบบที่ 3) ────────────────────────────────────────────────
  if (viewMode === 'table') {
    return (
      <>
        <div style={{ display: 'grid', gridTemplateColumns: '18px 160px 90px 90px 90px 70px 70px auto', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', borderBottom: showSignal || expanded ? 'none' : '1px solid rgba(255,255,255,0.04)', background: expanded ? 'rgba(250,173,20,0.04)' : 'transparent', transition: 'background 0.15s' }}>
          {/* Status dot */}
          <span style={{ color: bot.isRunning ? '#0ecb81' : '#444', fontSize: '0.5rem', textAlign: 'center' }}>●</span>

          {/* Pair + strategy */}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 'bold', fontSize: '0.88rem', color: '#fff' }}>{bot.config.symbol}</div>
            <div style={{ fontSize: '0.58rem', color: stratColor, opacity: 0.8 }}>{bot.config.strategy} · {bot.config.interval} · {bot.config.leverage}x</div>
          </div>

          {/* Price */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#faad14' }}>${bot.currentPrice?.toFixed(4)}</div>
          </div>

          {/* Net PNL */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: netPnlColor }}>{netPnl >= 0 ? '+' : ''}{netPnl.toFixed(2)}</div>
            <div style={{ fontSize: '0.55rem', color: '#555' }}>net pnl</div>
          </div>

          {/* Realized */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: (bot.realizedPnl || 0) >= 0 ? '#0ecb81' : '#f6465d' }}>{(bot.realizedPnl || 0) >= 0 ? '+' : ''}{(bot.realizedPnl || 0).toFixed(2)}</div>
            <div style={{ fontSize: '0.55rem', color: '#555' }}>realized</div>
          </div>

          {/* Win rate */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: parseFloat(winRate) >= 50 ? '#0ecb81' : '#f6465d' }}>{winRate}%</div>
            <div style={{ fontSize: '0.55rem', color: '#555' }}>win</div>
          </div>

          {/* Funding */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: (marketDepth?.fundingRate || 0) > 0 ? '#faad14' : '#0ecb81' }}>
              {marketDepth ? `${(marketDepth.fundingRate * 100).toFixed(3)}%` : '...'}
            </div>
            <div style={{ fontSize: '0.55rem', color: '#555' }}>funding</div>
          </div>

          {/* Actions + expand */}
          <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
            {onViewChart && (
              <button
                onClick={() => onViewChart(bot.config.symbol, bot.config.interval, bot.openPositions?.[0]?.entryPrice || bot.currentPrice, bot.openPositions?.[0]?.entryTime || 0, bot.openPositions?.[0]?.type || 'LONG', bot.openPositions?.[0]?.entryReason || bot.aiReason || 'Manual', bot.config.strategy, bot.config.gridUpper, bot.config.gridLower)}
                title="View Chart"
                style={{ background: 'rgba(250,173,20,0.1)', border: '1px solid rgba(250,173,20,0.3)', color: '#faad14', padding: '0.3rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold' }}>
                📈
              </button>
            )}
            <button
              onClick={() => setShowSignal(s => !s)}
              title="Toggle Signal"
              style={{ background: showSignal ? 'rgba(250,173,20,0.15)' : 'transparent', border: `1px solid ${showSignal ? '#faad14' : 'rgba(255,255,255,0.1)'}`, color: showSignal ? '#faad14' : '#555', padding: '0.3rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem' }}>
              🧠
            </button>
            <ActionButtons compact />
            <button onClick={onToggle} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: '0.75rem', padding: '0.2rem 0.3rem' }}>
              {expanded ? '▲' : '▼'}
            </button>
          </div>
        </div>

        {/* Signal bar — collapsible */}
        {showSignal && (
          <div style={{ padding: '0.4rem 1rem 0.5rem', background: 'rgba(250,173,20,0.03)', borderBottom: expanded ? 'none' : '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '0.9rem', opacity: bot.isRunning ? 1 : 0.3, flexShrink: 0 }}>🧠</span>
            <span style={{ fontSize: '0.72rem', color: bot.isRunning ? '#faad14' : '#555', fontStyle: 'italic', lineHeight: '1.4' }}>
              {bot.isRunning ? thoughtText : 'Idle'}
            </span>
            {bot.lastThoughtAt && (
              <span style={{ fontSize: '0.6rem', color: '#444', flexShrink: 0, marginLeft: 'auto' }}>
                {new Date(bot.lastThoughtAt).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' })}
              </span>
            )}
          </div>
        )}

        {/* Expanded inline detail */}
        {expanded && (
          <div style={{ padding: '0.75rem 1rem 1rem', background: 'rgba(0,0,0,0.15)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {/* Left: AI + Market */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {bot.aiReason && (
                  <div style={{ background: 'rgba(250,173,20,0.06)', border: '1px solid rgba(250,173,20,0.15)', borderRadius: '6px', padding: '0.6rem 0.8rem', fontSize: '0.78rem', color: '#ddd', lineHeight: '1.5' }}>
                    <span style={{ fontSize: '0.6rem', color: '#faad14', fontWeight: 'bold', textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}>🧠 Deep Market Logic · {bot.lastAiModel || 'Smart Core'}</span>
                    {bot.aiReason}
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div style={{ background: 'rgba(14,203,129,0.05)', border: '1px solid rgba(14,203,129,0.1)', borderRadius: '6px', padding: '0.5rem 0.7rem' }}>
                    <div style={{ fontSize: '0.55rem', color: '#888' }}>TAKE PROFIT AT</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#0ecb81' }}>
                      {bot.openPositions?.[0] ? `$${((bot.openPositions[0].entryPrice || 0) * (1 + (bot.config.tpPercent || 0) / 100)).toFixed(4)}` : '—'}
                    </div>
                  </div>
                  <div style={{ background: 'rgba(246,70,93,0.05)', border: '1px solid rgba(246,70,93,0.1)', borderRadius: '6px', padding: '0.5rem 0.7rem' }}>
                    <div style={{ fontSize: '0.55rem', color: '#888' }}>STOP LOSS AT</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#f6465d' }}>
                      {bot.openPositions?.[0] ? `$${((bot.openPositions[0].entryPrice || 0) * (1 - (bot.config.slPercent || 0) / 100)).toFixed(4)}` : '—'}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '0.6rem', borderRadius: '6px' }}>
                  <MiniStat label="Budget" value={`$${(bot.config.positionSizeUSDT || bot.capital || 0).toFixed(2)}`} color="#faad14" />
                  <MiniStat label="Risk Shield" value={`$${(bot.config.maxLossUSDT || (bot.config.positionSizeUSDT || bot.capital || 0) * 0.05).toFixed(2)}`} color="#f6465d" />
                  <MiniStat label="OI" value={marketDepth ? marketDepth.openInterest.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '...'} color="#1890ff" />
                </div>
              </div>
              {/* Right: Tabs */}
              <div>
                <ExpandedPanel />
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // ─── DEFAULT (grid / list) view ───────────────────────────────────────────────
  return (
    <div className="glass-panel" style={{ padding: '1rem', borderTop: `4px solid ${stratColor}`, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ color: bot.isRunning ? '#0ecb81' : '#888', fontSize: '0.6rem' }}>●</span>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{bot.config.symbol}</div>
            {onViewChart && (
              <button onClick={() => onViewChart(bot.config.symbol, bot.config.interval, bot.openPositions?.[0]?.entryPrice || bot.currentPrice, bot.openPositions?.[0]?.entryTime || 0, bot.openPositions?.[0]?.type || 'LONG', bot.openPositions?.[0]?.entryReason || bot.aiReason || 'Manual', bot.config.strategy, bot.config.gridUpper, bot.config.gridLower)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1rem' }} title="View Chart">📈</button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.1rem' }}>
            <span style={{ background: `${stratColor}18`, color: stratColor, padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 'bold' }}>
              {bot.config.strategy === 'AI_GRID_SCALP' ? '⚡ ' : bot.config.strategy === 'AI_GRID_SWING' ? '🏛️ ' : '🤖 '}
              {bot.config.strategy} | {bot.config.interval}
            </span>
            <span style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.65rem' }}>{bot.config.leverage}x</span>
            {bot.isRunning && bot.startedAt && (
              <span style={{ background: 'rgba(14,203,129,0.05)', color: '#0ecb81', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.65rem', border: '1px solid rgba(14,203,129,0.1)' }}>
                ⏱️ {(() => {
                  const elapsedMins = (Date.now() - new Date(bot.startedAt).getTime()) / 60000;
                  const totalMins = bot.durationMinutes || 0;
                  const remainMins = Math.max(0, totalMins - elapsedMins);
                  const format = (m: number) => m < 60 ? `${m.toFixed(0)}m` : `${(m / 60).toFixed(1)}h`;
                  return `${format(elapsedMins)} (Left: ${format(remainMins)})`;
                })()}
              </span>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Market Price</div>
          <div style={{ fontSize: '1.15rem', fontWeight: 'bold', color: '#faad14' }}>${bot.currentPrice?.toFixed(2)}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', background: 'rgba(0,0,0,0.2)', padding: '0.8rem', borderRadius: '8px' }}>
        <MiniStat label="Realized (Closed)" value={`${(bot.realizedPnl || 0) >= 0 ? '+' : ''}${(bot.realizedPnl || 0).toFixed(2)}`} color={(bot.realizedPnl || 0) >= 0 ? '#0ecb81' : '#f6465d'} />
        <MiniStat label="Unrealized (Open)" value={`${(bot.unrealizedPnl || 0) >= 0 ? '+' : ''}${(bot.unrealizedPnl || 0).toFixed(2)}`} color={(bot.unrealizedPnl || 0) >= 0 ? '#faad14' : '#f6465d'} />
        <MiniStat label="Bot Net PnL" value={`${netPnl >= 0 ? '+' : ''}${netPnl.toFixed(2)}`} color={netPnlColor} />
        <MiniStat label="Smart Budget" value={`$${(bot.config.positionSizeUSDT || bot.capital || 0).toFixed(2)}`} color="#faad14" />
        <MiniStat label="Win Rate" value={`${winRate}%`} color={parseFloat(winRate) >= 50 ? '#0ecb81' : '#f6465d'} />
        <MiniStat label="Risk Shield" value={`$${(bot.config.maxLossUSDT || (bot.config.positionSizeUSDT || bot.capital || 0) * 0.05).toFixed(2)}`} color="#f6465d" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', padding: '0.8rem', borderRadius: '8px', background: 'linear-gradient(135deg, rgba(24,144,255,0.05) 0%, rgba(24,144,255,0.02) 100%)', border: '1px solid rgba(24,144,255,0.1)' }}>
        <div>
          <div style={{ fontSize: '0.64rem', color: '#1890ff', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '0.2rem' }}>📊 Open Interest (Delta)</div>
          <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#fff' }}>
            {marketDepth ? marketDepth.openInterest.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '...'}
            <span style={{ fontSize: '0.6rem', color: '#888', marginLeft: '0.3rem', fontWeight: 'normal' }}>Contracts</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.64rem', color: '#0ecb81', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '0.2rem' }}>💰 Funding Rate</div>
          <div style={{ fontSize: '1rem', fontWeight: 'bold', color: (marketDepth?.fundingRate || 0) > 0 ? '#faad14' : '#0ecb81' }}>
            {marketDepth ? (marketDepth.fundingRate * 100).toFixed(4) : '...'}%
            <span style={{ fontSize: '0.6rem', color: '#888', marginLeft: '0.3rem', fontWeight: 'normal' }}>{(marketDepth?.fundingRate || 0) > 0 ? 'Long Pays Short' : 'Short Pays Long'}</span>
          </div>
        </div>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
        <div style={{ fontSize: '1.2rem', animation: bot.isRunning ? 'brain-pulse 2s infinite' : 'none', filter: bot.isRunning ? 'drop-shadow(0 0 5px rgba(250,173,20,0.4))' : 'grayscale(1)' }}>🧠</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.64rem', color: '#888', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '0.1rem', display: 'flex', justifyContent: 'space-between' }}>
            <span>{bot.isRunning ? `Bot Real-time Analysis ${bot.lastThoughtAt ? `(${new Date(bot.lastThoughtAt).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' })})` : ''}` : 'Engine Idle'}</span>
            {bot.isRunning && <span style={{ color: '#faad14', fontSize: '0.55rem', opacity: 0.6 }}>● SCANNING</span>}
          </div>
          <div style={{ fontSize: '0.85rem', color: bot.isRunning ? '#faad14' : '#555', fontWeight: '600', lineHeight: '1.4' }}>
            {bot.isRunning ? thoughtText : 'บอทหยุดทำงาน'}
          </div>
        </div>
      </div>

      {bot.aiReason && (
        <div style={{ background: 'linear-gradient(135deg, rgba(250,173,20,0.08) 0%, rgba(250,173,20,0.02) 100%)', padding: '1rem', borderRadius: '8px', fontSize: '0.8rem', color: '#eee', border: '1px solid rgba(250,173,20,0.2)', lineHeight: '1.5' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', borderBottom: '1px solid rgba(250,173,20,0.1)', paddingBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.65rem', color: '#faad14', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>🧠 Deep Market Selection Logic</span>
            <span style={{ fontSize: '0.6rem', color: '#888', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>{bot.lastAiModel || bot.config.aiModel || 'Smart Core'}</span>
          </div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{bot.aiReason}</div>
        </div>
      )}

      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.8rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.65rem', color: '#faad14', fontWeight: 'bold', textTransform: 'uppercase' }}>🎯 Strategy Real-time Plan</span>
          {bot.config.entry_steps && <span style={{ background: '#faad1422', color: '#faad14', fontSize: '0.6rem', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>ซอยไม้ {bot.config.entry_steps.length} ชั้น</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.5rem' }}>
          <div>
            <div style={{ fontSize: '0.55rem', color: '#888' }}>TAKE PROFIT AT</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#0ecb81' }}>
              {bot.openPositions?.[0] ? `$${((bot.openPositions[0].entryPrice || 0) * (1 + (bot.config.tpPercent || 0) / 100)).toFixed(4)}` : '-'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.55rem', color: '#888' }}>STOP LOSS AT</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#f6465d' }}>
              {bot.openPositions?.[0] ? `$${((bot.openPositions[0].entryPrice || 0) * (1 - (bot.config.slPercent || 0) / 100)).toFixed(4)}` : '-'}
            </div>
          </div>
        </div>
        {bot.config.gridUpper && bot.config.gridLower && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.4rem', marginTop: '0.4rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem' }}>
              <span style={{ color: '#888' }}>GRID RANGE:</span>
              <span style={{ color: '#fff', fontWeight: 'bold' }}>${bot.config.gridLower.toFixed(4)} - ${bot.config.gridUpper.toFixed(4)}</span>
            </div>
          </div>
        )}
      </div>

      {bot.reflectionStatus && (
        <div style={{ background: 'rgba(14,203,129,0.1)', border: '1px solid #0ecb8144', color: '#0ecb81', padding: '0.5rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ border: '2px solid rgba(14,203,129,0.2)', borderTop: '2px solid #0ecb81', borderRadius: '50%', width: '12px', height: '12px', animation: 'spin 1s linear infinite' }}></div>
          {bot.reflectionStatus}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button onClick={onToggle} style={{ flex: 1, background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: '#888', padding: '0.6rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>
          {expanded ? 'Hide History' : 'View History'}
        </button>
        <button onClick={() => onReview(bot.id)} disabled={(bot.trades || []).filter((t: any) => t.pnl < 0).length === 0}
          style={{ background: 'rgba(246,70,93,0.1)', border: '1px solid rgba(246,70,93,0.3)', color: '#f6465d', padding: '0.6rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold', opacity: (bot.trades || []).filter((t: any) => t.pnl < 0).length === 0 ? 0.4 : 1 }}>
          🔍 Review
        </button>
        <button onClick={() => onOptimize(bot.id)} style={{ background: 'rgba(14,203,129,0.1)', border: '1px solid rgba(14,203,129,0.3)', color: '#0ecb81', padding: '0.6rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>✨ Optimize</button>
        {bot.isRunning ? (
          <button onClick={() => onStop(bot.id)} style={{ background: '#f6465d22', color: '#f6465d', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>Stop</button>
        ) : (
          <button onClick={() => onResume(bot.id)} style={{ background: '#faad14', color: '#000', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>Start</button>
        )}
        {!bot.isRunning && (
          <button onClick={() => onDelete(bot.id)} style={{ padding: '0.6rem', background: 'rgba(255,255,255,0.05)', border: 'none', color: '#888', borderRadius: '4px', cursor: 'pointer' }}>✕</button>
        )}
      </div>

      {expanded && <ExpandedPanel />}
    </div>
  );
}

// ─── Helper components ────────────────────────────────────────────────────────

function PnlChip({ label, value, amber = false }: { label: string; value: number; amber?: boolean }) {
  const color = amber ? (value >= 0 ? '#faad14' : '#f6465d') : (value >= 0 ? '#0ecb81' : '#f6465d');
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '0.78rem', fontWeight: 'bold', color }}>{value >= 0 ? '+' : ''}{value.toFixed(2)}</div>
      <div style={{ fontSize: '0.52rem', color: '#555', textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}

function TabBtn({ active, onClick, label, count }: any) {
  return (
    <button onClick={onClick} style={{ background: 'transparent', border: 'none', borderBottom: active ? '2px solid #faad14' : '2px solid transparent', color: active ? '#faad14' : '#666', padding: '0.4rem 0', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>
      {label} {count > 0 && <span style={{ fontSize: '0.65rem', opacity: 0.6 }}>({count})</span>}
    </button>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '0.2rem' }}>{label}</div>
      <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: color || '#fff' }}>{value}</div>
    </div>
  );
}

function TradeList({ trades }: { trades: any[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {trades.length === 0 ? (
        <div style={{ fontSize: '0.75rem', color: '#555', textAlign: 'center', padding: '1rem' }}>No trades yet.</div>
      ) : (
        trades.slice().reverse().map((t, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', padding: '0.7rem', background: 'rgba(0,0,0,0.15)', borderRadius: '6px', borderLeft: `3px solid ${t.pnl >= 0 ? '#0ecb81' : '#f6465d'}` }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <div style={{ fontWeight: 'bold' }}><span style={{ color: t.pnl >= 0 ? '#0ecb81' : '#f6465d' }}>{t.type}</span> | ${t.exitPrice?.toFixed(2)}</div>
              <div style={{ fontSize: '0.6rem', color: '#666' }}>{new Date(t.exitTime).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: t.pnl >= 0 ? '#0ecb81' : '#f6465d', fontWeight: 'bold' }}>{t.pnl >= 0 ? '+' : ''}{parseFloat(t.pnl).toFixed(2)}</div>
              <div style={{ fontSize: '0.6rem', color: '#faad14' }}>{t.reason}</div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function BotPositionList({ positions, currentPrice, leverage = 1, botUnrealizedPnl, positionSizeUSDT, useExchange = false }: { positions: any[], currentPrice: number, leverage?: number, botUnrealizedPnl?: number, positionSizeUSDT?: number, useExchange?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {positions.length === 0 ? (
        <div style={{ fontSize: '0.75rem', color: '#555', textAlign: 'center', padding: '1rem' }}>No active layers found.</div>
      ) : (
        positions.map((p, i) => {
          let roePct: number;
          let upnl: number;
          let entryPrice: number;
          let posType: string;
          let size: string;

          if (useExchange) {
            // Use Binance exchange data directly (same calc as PositionsTab)
            upnl = parseFloat(p.unrealizedProfit ?? p.unRealizedProfit ?? 0);
            entryPrice = parseFloat(p.entryPrice) || 0;
            const amt = Math.abs(parseFloat(p.positionAmt) || 0);
            const lev = parseFloat(p.leverage) || leverage;
            const marginValue = (amt * entryPrice) / (lev || 1);
            roePct = (upnl / (marginValue || 1)) * 100;
            posType = parseFloat(p.positionAmt) > 0 ? 'LONG' : 'SHORT';
            size = amt.toFixed(3);
          } else {
            // Fallback: internal bot state
            entryPrice = p.entryPrice || 0;
            const lev = leverage;
            const initialMargin = positionSizeUSDT ? positionSizeUSDT / (lev || 1) : (p.initialMargin || 0);
            upnl = botUnrealizedPnl ?? 0;
            roePct = initialMargin > 0
              ? (upnl / initialMargin) * 100
              : (p.type === 'LONG' || p.type === 'BUY'
                  ? (currentPrice - entryPrice) / (entryPrice || 1)
                  : (entryPrice - currentPrice) / (entryPrice || 1)) * lev * 100;
            posType = p.type;
            size = String(p.quantity ?? '');
          }

          return (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', padding: '0.7rem', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', borderLeft: `3px solid ${roePct >= 0 ? '#0ecb81' : '#f6465d'}` }}>
              <div>
                <div style={{ fontWeight: 'bold' }}>
                  <span style={{ color: posType === 'LONG' || posType === 'BUY' ? '#0ecb81' : '#f6465d' }}>{posType}</span> · Size: {size}
                </div>
                <div style={{ fontSize: '0.65rem', color: '#888', marginTop: '0.2rem' }}>Entry: ${entryPrice?.toFixed(4)}</div>
                {useExchange && p.markPrice && (
                  <div style={{ fontSize: '0.65rem', color: '#faad14', marginTop: '0.1rem' }}>Mark: ${parseFloat(p.markPrice).toFixed(4)}</div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: roePct >= 0 ? '#0ecb81' : '#f6465d', fontWeight: 'bold', fontSize: '0.8rem' }}>{roePct >= 0 ? '+' : ''}{roePct.toFixed(2)}%</div>
                <div style={{ fontSize: '0.6rem', color: roePct >= 0 ? '#0ecb81' : '#f6465d', fontWeight: 'bold' }}>ROE %</div>
                <div style={{ fontSize: '0.65rem', color: upnl >= 0 ? '#0ecb81' : '#f6465d', marginTop: '0.2rem' }}>
                  {upnl >= 0 ? '+' : ''}{upnl.toFixed(4)} USDT
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function AiLogList({ logs, isReflection = false }: { logs: any[], isReflection?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto' }}>
      {logs.length === 0 ? (
        <div style={{ fontSize: '0.75rem', color: '#555', textAlign: 'center', padding: '1rem' }}>No {isReflection ? 'reflections' : 'logs'} recorded yet.</div>
      ) : (
        logs.slice().reverse().map((log, i) => (
          <div key={i} style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.7rem', color: '#faad14', fontWeight: 'bold' }}>🗓️ {log.time || 'RECENT'}</span>
            <div style={{ fontSize: '0.75rem', color: '#ccc', lineHeight: '1.4' }}>{log.message || log.insight || log.content}</div>
            {log.decision && (
              <div style={{ fontSize: '0.65rem', color: '#faad14', background: 'rgba(250,173,20,0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px', alignSelf: 'flex-start' }}>DECISION: {log.decision}</div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

