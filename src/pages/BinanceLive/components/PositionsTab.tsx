import { useState } from 'react';
import type { Bot } from '../types';
import { formatPrice } from '../types';

interface Props {
  activePositions: any[];
  bots: Bot[];
  onManualClose: (symbol: string, type: string, qty: number) => void;
  onRefresh: () => void;
  onViewChart: (symbol: string, interval: string, price: number, entryTime: string | number, type: string, reason: string, strategy: string, gridUpper?: number, gridLower?: number) => void;
}

export default function PositionsTab({ activePositions, bots, onManualClose, onRefresh, onViewChart }: Props) {
  const [posSortBy, setPosSortBy] = useState<'symbol' | 'pnl' | 'roe'>('symbol');

  let sorted = [...activePositions];
  if (posSortBy === 'pnl') {
    sorted.sort((a, b) => parseFloat(b.unrealizedProfit || 0) - parseFloat(a.unrealizedProfit || 0));
  } else if (posSortBy === 'roe') {
    sorted.sort((a, b) => {
      const pA = parseFloat(a.unrealizedProfit || 0);
      const pB = parseFloat(b.unrealizedProfit || 0);
      const mA = (Math.abs(parseFloat(a.positionAmt)) * parseFloat(a.markPrice)) / parseFloat(a.leverage);
      const mB = (Math.abs(parseFloat(b.positionAmt)) * parseFloat(b.markPrice)) / parseFloat(b.leverage);
      return (pB / (mB || 1)) - (pA / (mA || 1));
    });
  } else {
    sorted.sort((a, b) => a.symbol.localeCompare(b.symbol));
  }

  return (
    <div className="glass-panel" style={{ padding: '1.5rem', borderLeft: '4px solid #faad14' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#faad14' }}>
          Live Positions <span style={{ fontSize: '0.8rem', color: '#888', fontWeight: 'normal' }}>({activePositions.length})</span>
        </h2>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
            Order:
            <select value={posSortBy} onChange={e => setPosSortBy(e.target.value as any)} style={{ background: '#1e222d', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '0.4rem' }}>
              <option value="symbol">Symbol (A-Z)</option>
              <option value="pnl">Unrealized PnL</option>
              <option value="roe">ROE %</option>
            </select>
          </div>
          <button onClick={onRefresh} style={{ background: 'rgba(250,173,20,0.1)', border: '1px solid #faad14', color: '#faad14', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>🔄 Sync</button>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)', textAlign: 'left', fontSize: '0.85rem' }}>
              <th style={{ padding: '1rem' }}>Symbol</th>
              <th style={{ padding: '1rem' }}>Size</th>
              <th style={{ padding: '1rem' }}>Entry / Mark</th>
              <th style={{ padding: '1rem' }}>Strategy</th>
              <th style={{ padding: '1rem' }}>AI Targets</th>
              <th style={{ padding: '1rem' }}>Entry Reason</th>
              <th style={{ padding: '1rem' }}>ROE %</th>
              <th style={{ padding: '1rem' }}>Unrealized PNL</th>
              <th style={{ padding: '1rem', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: '6rem', textAlign: 'center', color: 'var(--text-muted)' }}>No active positions.</td></tr>
            ) : sorted.map((p: any, i: number) => {
              const amt = parseFloat(p.positionAmt);
              const side = amt > 0 ? 'LONG' : 'SHORT';
              const upnl = parseFloat(p.unrealizedProfit || p.unRealizedProfit || 0);
              const entryPrice = parseFloat(p.entryPrice);
              const markPrice = parseFloat(p.markPrice);
              const leverage = parseFloat(p.leverage);
              const marginValue = (Math.abs(amt) * markPrice) / leverage;
              const roe = (upnl / (marginValue || 1)) * 100;
              
              const linkedBot = bots.find(b => b.config.symbol === p.symbol);
              const tpPct = linkedBot?.config?.tpPercent || 0;
              const slPct = linkedBot?.config?.slPercent || 0;
              const tpPrice = tpPct > 0 ? (side === 'LONG' ? entryPrice * (1 + tpPct/100) : entryPrice * (1 - tpPct/100)) : 0;
              const slPrice = slPct > 0 ? (side === 'LONG' ? entryPrice * (1 - slPct/100) : entryPrice * (1 + slPct/100)) : 0;

              const botPos = linkedBot?.openPositions?.find((op: any) => op.type === side);
              // Prioritize the deep analytical reason (Thai explanation) over the technical function name
              const analyticalReason = linkedBot?.config?.aiReason || linkedBot?.aiReason;
              const technicalReason = botPos?.entryReason || 'Technical Analysis Entry';
              const entryReason = analyticalReason ? analyticalReason : technicalReason;

              return (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-color)22' }}>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                       <div style={{ fontWeight: 'bold' }}>{p.symbol}</div>
                       <button 
                         title="View Chart"
                         onClick={() => onViewChart(
                            p.symbol, 
                            linkedBot?.config?.interval || '1h', 
                            entryPrice, 
                            botPos?.entryTime || linkedBot?.startedAt || Date.now(),
                            side,
                            entryReason,
                            linkedBot?.config?.strategy || 'MANUAL',
                            linkedBot?.config?.gridUpper,
                            linkedBot?.config?.gridLower
                         )}
                         style={{ background: 'rgba(250,173,20,0.1)', border: 'none', color: '#faad14', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.65rem' }}>
                         📈
                       </button>
                    </div>
                    <div style={{ fontSize: '0.65rem' }}>
                      <span style={{ color: side === 'LONG' ? '#0ecb81' : '#f6465d' }}>{side}</span> · {p.leverage}x
                    </div>
                  </td>
                  <td style={{ padding: '1rem', fontWeight: 'bold' }}>{Math.abs(amt)}</td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ fontSize: '0.8rem' }}>E: {formatPrice(entryPrice)}</div>
                    <div style={{ fontSize: '0.8rem', color: '#faad14' }}>M: {formatPrice(markPrice)}</div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 'bold', background: 'rgba(250,173,20,0.1)', color: '#faad14', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                      {linkedBot?.config?.strategy || 'MANUAL'}
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {tpPrice > 0 && <div style={{ fontSize: '0.75rem', color: '#0ecb81', fontWeight: 'bold' }}>TP: {formatPrice(tpPrice)}</div>}
                    {slPrice > 0 && <div style={{ fontSize: '0.75rem', color: '#f6465d', fontWeight: 'bold' }}>SL: {formatPrice(slPrice)}</div>}
                    {!tpPrice && !slPrice && <span style={{ opacity: 0.3 }}>-</span>}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ fontSize: '0.65rem', color: '#faad14', fontStyle: 'italic', maxWidth: '180px', lineHeight: '1.4' }}>
                       {entryReason}
                    </div>
                  </td>
                  <td style={{ padding: '1rem', color: roe >= 0 ? '#0ecb81' : '#f6465d' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '1rem' }}>{roe.toFixed(2)}%</span>
                  </td>
                  <td style={{ padding: '1rem', fontWeight: 'bold', color: upnl >= 0 ? '#0ecb81' : '#f6465d' }}>{upnl.toFixed(4)} USDT</td>
                  <td style={{ padding: '1rem', textAlign: 'right' }}>
                    <button onClick={() => onManualClose(p.symbol, side, Math.abs(amt))} style={{ background: '#f6465d', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>Close</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
