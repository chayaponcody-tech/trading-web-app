import React, { useState } from 'react';
import type { Bot } from '../types';
import { formatPrice, normalizeSymbol } from '../types';

interface Props {
  activePositions: any[];
  bots: any[];
  fleets: any[];
  onManualClose: (symbol: string, type: string, qty: number) => void;
  onAdopt: (symbol: string) => void;
  onRefresh: () => void;
  onViewChart: (symbol: string, interval: string, price: number, entryTime: string | number, type: string, reason: string, strategy: string, gridUpper?: number, gridLower?: number, tp?: number, sl?: number) => void;
}

export default function PositionsTab({ activePositions, bots, fleets, onManualClose, onAdopt, onRefresh, onViewChart }: Props) {
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


  // --- Grouping Logic ---
  const groupedPositions: { [fleetId: string]: { fleetName: string, list: any[] } } = {};
  
  sorted.forEach(p => {
    const linkedBot = bots.find(b => normalizeSymbol(b.config.symbol) === normalizeSymbol(p.symbol));
    const fleetId = linkedBot?.config?.managedBy || 'manual';
    const fleetName = fleetId === 'manual' ? 'Manual / External' : (fleets.find(f => f.id === fleetId)?.name || 'Unknown Fleet');
    
    if (!groupedPositions[fleetId]) {
      groupedPositions[fleetId] = { fleetName, list: [] };
    }
    groupedPositions[fleetId].list.push(p);
  });

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
            {activePositions.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: '6rem', textAlign: 'center', color: 'var(--text-muted)' }}>No active positions.</td></tr>
            ) : Object.entries(groupedPositions).map(([fleetId, group], groupIdx) => (
               <React.Fragment key={fleetId}>
                 {/* Fleet Header Row */}
                 <tr style={{ background: 'rgba(250,173,20,0.05)' }}>
                    <td colSpan={9} style={{ padding: '0.6rem 1rem', fontSize: '0.75rem', fontWeight: 'bold', color: '#faad14', borderLeft: '3px solid #faad14' }}>
                       🏠 {group.fleetName} <span style={{ opacity: 0.5, fontWeight: 'normal' }}>({group.list.length} positions)</span>
                    </td>
                 </tr>

                 {group.list.map((p: any, i: number) => {
                  const amt = parseFloat(p.positionAmt);
                  const side = amt > 0 ? 'LONG' : 'SHORT';
                  const upnl = parseFloat(p.unrealizedProfit || p.unRealizedProfit || 0);
                  const entryPrice = parseFloat(p.entryPrice);
                  const markPrice = parseFloat(p.markPrice);
                  const leverage = parseFloat(p.leverage);
                  const marginValue = (Math.abs(amt) * entryPrice) / leverage;
                  const roe = (upnl / (marginValue || 1)) * 100;
                  const rawRoe = ((markPrice - entryPrice) / entryPrice) * 100 * (side === 'LONG' ? 1 : -1);
                  
                  const linkedBot = bots.find(b => normalizeSymbol(b.config.symbol) === normalizeSymbol(p.symbol));
                  const fleetNameTag = fleetId === 'manual' ? 'External' : (fleets.find(f => f.id === fleetId)?.name || 'Managed');
                  
                  const tpPct = linkedBot?.config?.tpPercent || 0;
                  const slPct = linkedBot?.config?.slPercent || 0;
                  const tpPrice = tpPct > 0 ? (side === 'LONG' ? entryPrice * (1 + tpPct/100) : entryPrice * (1 - tpPct/100)) : 0;
                  const slPrice = slPct > 0 ? (side === 'LONG' ? entryPrice * (1 - slPct/100) : entryPrice * (1 + slPct/100)) : 0;

                  const botPos = linkedBot?.openPositions?.find((op: any) => op.type === side);
                  const analyticalReason = linkedBot?.config?.aiReason || linkedBot?.aiReason;
                  const technicalReason = botPos?.entryReason || 'Technical Analysis Entry';
                  const entryReason = analyticalReason ? analyticalReason : technicalReason;

                  const finalTp = botPos?.dynamicTp || tpPrice;
                  const finalSl = botPos?.dynamicSl || slPrice;

                  return (
                    <tr key={`${fleetId}-${p.symbol}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
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
                                linkedBot?.config?.gridLower,
                                finalTp,
                                finalSl
                            )}
                            style={{ background: 'rgba(250,173,20,0.1)', border: 'none', color: '#faad14', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.65rem' }}>
                            📈
                          </button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                          <span style={{ fontSize: '0.65rem', color: side === 'LONG' ? '#0ecb81' : '#f6465d', fontWeight: 'bold' }}>{side} {p.leverage}x</span>
                          <span style={{ fontSize: '0.6rem', padding: '1px 5px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', color: '#888', border: '1px solid rgba(255,255,255,0.1)' }}>
                            {fleetNameTag}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '1rem', fontWeight: 'bold' }}>{Math.abs(amt)}</td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ fontSize: '0.8rem' }}>E: {formatPrice(entryPrice)}</div>
                        <div style={{ fontSize: '0.8rem', color: '#faad14' }}>M: {formatPrice(markPrice)}</div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ 
                          fontSize: '0.7rem', 
                          fontWeight: 'bold', 
                          background: linkedBot?.config?.isGuardian ? 'rgba(0,209,255,0.1)' : 'rgba(250,173,20,0.1)', 
                          color: linkedBot?.config?.isGuardian ? '#00d1ff' : '#faad14', 
                          padding: '0.2rem 0.5rem', 
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          width: 'fit-content'
                        }}>
                          {linkedBot?.config?.isGuardian && <span style={{ fontSize: '0.9rem' }}>🛡️</span>}
                          {linkedBot?.config?.isGuardian ? 'GUARDIAN' : (linkedBot?.config?.strategy || 'MANUAL')}
                        </span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        {(() => {
                           const isAiAdjusted = !!(botPos?.dynamicTp || botPos?.dynamicSl);
                           
                           if (!finalTp && !finalSl) return <span style={{ opacity: 0.3 }}>-</span>;

                           return (
                             <>
                               {finalTp > 0 && <div style={{ fontSize: '0.75rem', color: isAiAdjusted ? '#faad14' : '#0ecb81', fontWeight: 'bold' }}>
                                 {isAiAdjusted ? '✨ TP: ' : 'TP: '}{formatPrice(finalTp)} <span style={{ fontSize: '0.6rem', opacity: 0.7, fontWeight: 'normal' }}>(Raw: {((Math.abs(finalTp - entryPrice)/entryPrice)*100).toFixed(1)}%)</span>
                               </div>}
                               {finalSl > 0 && <div style={{ fontSize: '0.75rem', color: isAiAdjusted ? '#faad14' : '#f6465d', fontWeight: 'bold' }}>
                                 {isAiAdjusted ? '✨ SL: ' : 'SL: '}{formatPrice(finalSl)} <span style={{ fontSize: '0.6rem', opacity: 0.7, fontWeight: 'normal' }}>(Raw: {((Math.abs(finalSl - entryPrice)/entryPrice)*100).toFixed(1)}%)</span>
                               </div>}
                               
                               {linkedBot?.lastAiCheck && (
                                 <div style={{ fontSize: '0.6rem', color: '#666', marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '2px' }}>
                                   ⏱️ AI: {new Date(linkedBot.lastAiCheck).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' })}
                                 </div>
                               )}
                             </>
                           );
                        })()}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ fontSize: '0.65rem', color: '#faad14', fontStyle: 'italic', maxWidth: '180px', lineHeight: '1.4' }}>
                          {entryReason}
                        </div>
                      </td>
                      <td style={{ padding: '1rem', color: roe >= 0 ? '#0ecb81' : '#f6465d' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>{roe.toFixed(2)}%</div>
                        <div style={{ fontSize: '0.65rem', opacity: 0.7 }}>Raw: {rawRoe.toFixed(2)}%</div>
                      </td>
                      <td style={{ padding: '1rem', fontWeight: 'bold', color: upnl >= 0 ? '#0ecb81' : '#f6465d' }}>{upnl.toFixed(4)} USDT</td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>
                        {fleetId === 'manual' && (
                          <button 
                            onClick={() => onAdopt(p.symbol)} 
                            style={{ background: 'rgba(0,209,255,0.1)', color: '#00d1ff', border: '1px solid #00d1ff', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold', marginRight: '0.5rem' }}>
                            🛡️ Adopt with AI
                          </button>
                        )}
                        <button onClick={() => onManualClose(p.symbol, side, Math.abs(amt))} style={{ background: '#f6465d', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>Close</button>
                      </td>
                    </tr>
                  );
                })}
               </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
