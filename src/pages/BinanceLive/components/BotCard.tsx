import { useState } from 'react';
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
  viewMode?: 'grid' | 'list' | 'mini';
}

export default function BotCard({ bot, onStop, onDelete, onResume, expanded, onToggle, onReview, onOptimize, viewMode }: Props) {

  const [editingInterval, setEditingInterval] = useState<number>(bot.config.aiCheckInterval || 0);
  const [isUpdating, setIsUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState<'trades' | 'positions' | 'ai' | 'reflect'>('trades');

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


  if (viewMode === 'mini') {
    return (
      <div className="glass-panel" style={{ padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', gap: '1.25rem', borderLeft: `3px solid ${bot.config.strategy.includes('SCALP') ? '#faad14' : '#1890ff'}`, background: bot.isRunning ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', width: '120px' }}>
          <span style={{ color: bot.isRunning ? '#0ecb81' : '#555', fontSize: '0.5rem', animation: bot.isRunning ? 'pulse 2s infinite' : 'none' }}>●</span>
          <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#fff' }}>{bot.config.symbol}</span>
          <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>{bot.config.strategy === 'AI_GRID_SCALP' ? '⚡' : bot.config.strategy === 'AI_GRID_SWING' ? '🏛️' : '🤖'}</span>
        </div>

        <div style={{ width: '80px', textAlign: 'right' }}>
           <div style={{ color: bot.netPnl >= 0 ? '#0ecb81' : '#f6465d', fontWeight: 'bold', fontSize: '0.9rem' }}>{bot.netPnl >= 0 ? '+' : ''}{bot.netPnl?.toFixed(2)}</div>
           <div style={{ fontSize: '0.55rem', color: '#888' }}>NET PNL</div>
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.6rem', overflow: 'hidden' }}>
           <span style={{ fontSize: '0.9rem', opacity: bot.isRunning ? 1 : 0.3 }}>🧠</span>
           <span style={{ fontSize: '0.75rem', color: bot.isRunning ? '#faad14' : '#555', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontStyle: 'italic' }}>
             {bot.isRunning ? (bot.currentThought || 'Scanning...') : 'Idle...'}
           </span>
        </div>

        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {bot.isRunning ? (
            <button onClick={() => onStop(bot.id)} style={{ background: 'rgba(246, 70, 93, 0.1)', color: '#f6465d', border: 'none', padding: '0.25rem 0.6rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 'bold' }}>STOP</button>
          ) : (
            <button onClick={() => onResume(bot.id)} style={{ background: '#faad1422', color: '#faad14', border: 'none', padding: '0.25rem 0.6rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 'bold' }}>START</button>
          )}
          {!bot.isRunning && (
            <button onClick={() => onDelete(bot.id)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#888', padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.6rem' }}>✕</button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{ 
      padding: '1rem', 
      borderTop: `4px solid ${
        bot.config.strategy === 'AI_GRID_SCALP' ? '#faad14' : 
        bot.config.strategy === 'AI_GRID_SWING' ? '#1890ff' : 
        '#faad14'
      }`, 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '1rem' 
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ color: bot.isRunning ? '#0ecb81' : '#888', fontSize: '0.6rem' }}>●</span>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{bot.config.symbol}</div>
          </div>
          <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.1rem' }}>
            <span style={{ 
              background: bot.config.strategy === 'AI_GRID_SCALP' ? 'rgba(250,173,20,0.1)' : 
                         bot.config.strategy === 'AI_GRID_SWING' ? 'rgba(24,144,255,0.1)' : 
                         '#faad1415', 
              color: bot.config.strategy === 'AI_GRID_SCALP' ? '#faad14' : 
                     bot.config.strategy === 'AI_GRID_SWING' ? '#1890ff' : 
                     '#faad14', 
              padding: '0.1rem 0.4rem', 
              borderRadius: '4px', 
              fontSize: '0.65rem',
              fontWeight: 'bold'
            }}>
              {bot.config.strategy === 'AI_GRID_SCALP' ? '⚡ ' : 
               bot.config.strategy === 'AI_GRID_SWING' ? '🏛️ ' : '🤖 '}
              {bot.config.strategy} | {bot.config.interval}
            </span>
            <span style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.65rem' }}>{bot.config.leverage}x</span>
            {bot.isRunning && bot.startedAt && (
              <span style={{ 
                background: 'rgba(14,203,129,0.05)', color: '#0ecb81', padding: '0.1rem 0.4rem', 
                borderRadius: '4px', fontSize: '0.65rem', border: '1px solid rgba(14,203,129,0.1)',
                display: 'inline-flex', alignItems: 'center', gap: '2px'
              }}>
                ⏱️ {(() => {
                  const elapsedMins = (Date.now() - new Date(bot.startedAt).getTime()) / 60000;
                  const totalMins = bot.durationMinutes || 0;
                  const remainMins = Math.max(0, totalMins - elapsedMins);
                  
                  const format = (m: number) => m < 60 ? `${m.toFixed(0)}m` : `${(m/60).toFixed(1)}h`;
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

      {/* Current Diagnostic Thought (Live Brain) */}
      <div style={{ 
        background: 'rgba(255, 255, 255, 0.02)', 
        padding: '0.75rem 1rem', 
        borderRadius: '8px', 
        border: '1px solid rgba(255, 255, 255, 0.05)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.8rem',
        position: 'relative'
      }}>
        <div style={{ 
          fontSize: '1.2rem', 
          animation: bot.isRunning ? 'brain-pulse 2s infinite' : 'none',
          filter: bot.isRunning ? 'drop-shadow(0 0 5px rgba(250, 173, 20, 0.4))' : 'grayscale(1)',
          display: 'flex',
          alignItems: 'center'
        }}>🧠</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.64rem', color: '#888', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '0.1rem', letterSpacing: '0.5px', display: 'flex', justifyContent: 'space-between' }}>
            <span>{bot.isRunning ? `Bot Real-time Analysis ${bot.lastThoughtAt ? `(${new Date(bot.lastThoughtAt).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' })})` : ''}` : 'Engine Idle'}</span>
            {bot.isRunning && <span style={{ color: '#faad14', fontSize: '0.55rem', opacity: 0.6 }}>● SCANNING</span>}
          </div>
          <div style={{ 
            fontSize: '0.85rem', 
            color: bot.isRunning ? '#faad14' : '#555', 
            fontWeight: '600',
            lineHeight: '1.4'
          }}>
            {bot.isRunning ? (bot.currentThought || 'เครื่องยนต์กำลังเตรียมข้อมูล...') : 'บอทหยุดทำงาน'}
          </div>
        </div>
      </div>

      {bot.aiReason && (
        <div style={{ background: 'rgba(250, 173, 20, 0.05)', padding: '0.8rem', borderRadius: '6px', fontSize: '0.75rem', color: '#ddd', fontStyle: 'italic', borderLeft: '3px solid #faad14', lineHeight: '1.4' }}>
          <div style={{ fontSize: '0.64rem', color: '#faad14', marginBottom: '0.3rem', fontWeight: 'bold', textTransform: 'uppercase' }}>🧠 STARTUP REASON</div>
          {bot.aiReason.slice(0, 200)}{bot.aiReason.length > 200 ? '...' : ''}
        </div>
      )}

      {/* NEW Strategy Plan / Layering Info */}
      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.8rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
             <span style={{ fontSize: '0.65rem', color: '#faad14', fontWeight: 'bold', textTransform: 'uppercase' }}>🎯 Strategy Real-time Plan</span>
             {bot.config.entry_steps && <span style={{ background: '#faad1422', color: '#faad14', fontSize: '0.6rem', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>ซอยไม้ {bot.config.entry_steps.length} ชั้น</span>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.5rem' }}>
              <div>
                 <div style={{ fontSize: '0.55rem', color: '#888' }}>TAKE PROFIT AT</div>
                 <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#0ecb81' }}>
                    {bot.openPositions?.[0] ? `$${((bot.openPositions[0].entryPrice || 0) * (1 + (bot.config.tpPercent || 0)/100)).toFixed(4)}` : '-'}
                 </div>
              </div>
              <div>
                 <div style={{ fontSize: '0.55rem', color: '#888' }}>STOP LOSS AT</div>
                 <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#f6465d' }}>
                    {bot.openPositions?.[0] ? `$${((bot.openPositions[0].entryPrice || 0) * (1 - (bot.config.slPercent || 0)/100)).toFixed(4)}` : '-'}
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
        
        <button 
          onClick={() => onReview(bot.id)} 
          disabled={(bot.trades || []).filter((t: any) => t.pnl < 0).length === 0}
          style={{ background: 'rgba(246, 70, 93, 0.1)', border: '1px solid rgba(246, 70, 93, 0.3)', color: '#f6465d', padding: '0.6rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold', opacity: (bot.trades || []).filter((t: any) => t.pnl < 0).length === 0 ? 0.4 : 1 }}>
          🔍 Review
        </button>

        <button 
          onClick={() => onOptimize(bot.id)} 
          style={{ background: 'rgba(14, 203, 129, 0.1)', border: '1px solid rgba(14, 203, 129, 0.3)', color: '#0ecb81', padding: '0.6rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>
          ✨ Optimize
        </button>

        {bot.isRunning ? (
          <button onClick={() => onStop(bot.id)} style={{ background: '#f6465d22', color: '#f6465d', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>Stop</button>
        ) : (
          <button onClick={() => onResume(bot.id)} style={{ background: '#faad14', color: '#000', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>Start</button>
        )}

        {!bot.isRunning && (
          <button onClick={() => onDelete(bot.id)} style={{ padding: '0.6rem', background: 'rgba(255,255,255,0.05)', border: 'none', color: '#888', borderRadius: '4px', cursor: 'pointer' }}>✕</button>
        )}
      </div>

      {expanded && (
        <div style={{ marginTop: '0.2rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.8rem' }}>
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

          {activeTab === 'positions' && (
            <BotPositionList positions={bot.openPositions || []} currentPrice={bot.currentPrice || 0} />
          )}

          {activeTab === 'ai' && <AiLogList logs={bot.aiHistory || []} />}
          {activeTab === 'reflect' && <AiLogList logs={bot.reflectionHistory || []} isReflection />}
        </div>
      )}
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

function BotPositionList({ positions, currentPrice }: { positions: any[], currentPrice: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
       {positions.length === 0 ? (
         <div style={{ fontSize: '0.75rem', color: '#555', textAlign: 'center', padding: '1rem' }}>No active layers found.</div>
       ) : (
         positions.map((p, i) => {
           const pnlPct = (p.type === 'LONG' || p.type === 'BUY'
              ? (currentPrice - p.entryPrice) / p.entryPrice
              : (p.entryPrice - currentPrice) / p.entryPrice) * 100;
           
           return (
             <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', padding: '0.7rem', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', borderLeft: `3px solid ${pnlPct >= 0 ? '#0ecb81' : '#f6465d'}` }}>
                <div>
                   <div style={{ fontWeight: 'bold' }}>
                     <span style={{ color: p.type === 'LONG' || p.type === 'BUY' ? '#0ecb81' : '#f6465d' }}>{p.type}</span> · Size: {p.quantity}
                   </div>
                   <div style={{ fontSize: '0.65rem', color: '#888', marginTop: '0.2rem' }}>Entry: ${p.entryPrice?.toFixed(4)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                   <div style={{ color: pnlPct >= 0 ? '#0ecb81' : '#f6465d', fontWeight: 'bold', fontSize: '0.8rem' }}>
                     {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                   </div>
                   <div style={{ fontSize: '0.6rem', color: '#666' }}>Active Layer</div>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: '#faad14', fontWeight: 'bold' }}>🗓️ {log.time || 'RECENT'}</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#ccc', lineHeight: '1.4' }}>{log.message || log.insight || log.content}</div>
            {log.decision && (
               <div style={{ fontSize: '0.65rem', color: '#faad14', background: 'rgba(250,173,20,0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px', alignSelf: 'flex-start' }}>
                 DECISION: {log.decision}
               </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
