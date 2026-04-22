import { useState } from 'react';
import { type BinanceKeys, API } from '../types';
import SymbolSelector from '../../../components/SymbolSelector';

interface Props {
  binanceKeys: BinanceKeys;
  onStart: (config: any) => Promise<void>;
  onAIRecommend: (mode: 'confident' | 'grid' | 'scout', currentSymbol: string, currentStrategy: string, currentInterval: string) => Promise<void>;
  loading: boolean;
  positionSizeUSDT: number;
  setPositionSizeUSDT: (val: number) => void;
  isMini?: boolean;
  isMobile?: boolean;
}

// ─── Strategy definitions ─────────────────────────────────────────────────────
const STRATEGIES = [
  { mode: 'confident' as const, strategy: 'EMA_RSI',       interval: '15m', emoji: '💎', label: 'AI Precision',  sub: 'Trend following · 15m',   color: '#faad14' },
  { mode: 'grid'      as const, strategy: 'AI_GRID_SCALP',  interval: '15m', emoji: '⚡', label: 'Grid Scalp',    sub: 'Fast micro-ranges · 15m', color: '#faad14' },
  { mode: 'grid'      as const, strategy: 'AI_GRID_SWING',  interval: '1h',  emoji: '🏛️', label: 'Grid Swing',    sub: 'Mid-term ranges · 1h',    color: '#1890ff' },
  { mode: 'scout'     as const, strategy: 'AI_SCOUTER',     interval: '5m',  emoji: '🏹', label: 'Trend Scout',   sub: 'SMA momentum · 5m',       color: '#f6465d' },
  { mode: 'scout'     as const, strategy: 'EMA_SCALP',      interval: '5m',  emoji: '⚡', label: 'EMA Scalp',     sub: 'EMA 3/8 cross · 5m',      color: '#00ffb4' },
  { mode: 'scout'     as const, strategy: 'STOCH_RSI',      interval: '5m',  emoji: '🎯', label: 'Stoch RSI',     sub: 'Micro-cycle · 5m',        color: '#a064ff' },
  { mode: 'scout'     as const, strategy: 'VWAP_SCALP',     interval: '5m',  emoji: '📊', label: 'VWAP Scalp',    sub: 'Retest + momentum · 5m',  color: '#14b4ff' },
];

// Hunt goal → strategyType for AI scanner
const HUNT_TYPE: Record<string, string> = {
  'EMA_RSI': 'trend', 'AI_GRID_SCALP': 'grid', 'AI_GRID_SWING': 'grid',
  'AI_SCOUTER': 'scalp', 'EMA_SCALP': 'scalp', 'STOCH_RSI': 'scalp', 'VWAP_SCALP': 'scalp',
};

export default function BotSidebar({ binanceKeys, onStart, onAIRecommend, loading, positionSizeUSDT, setPositionSizeUSDT, isMini, isMobile }: Props) {
  const [mode, setMode] = useState<'pick' | 'scan'>('pick');
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [selectedStrategy, setSelectedStrategy] = useState(STRATEGIES[0]);
  const [scanResults, setScanResults] = useState<any[]>([]);
  const [scanning, setScanning] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [tpPercent, setTpPercent]     = useState(1.5);
  const [slPercent, setSlPercent]     = useState(1.0);
  const [leverage, setLeverage]       = useState(10);
  const [trailingStopPct, setTrailingStopPct] = useState(0);
  const [maxDrawdownPct, setMaxDrawdownPct]   = useState(10);
  const [gridUpper, setGridUpper] = useState(0);
  const [gridLower, setGridLower] = useState(0);
  const [gridLayers, setGridLayers] = useState(10);

  const scanEntry = scanResults.find(r => r.symbol === symbol);

  const handleLaunch = () => {
    onStart({
      symbol,
      interval: selectedStrategy.interval,
      strategy: selectedStrategy.strategy,
      tpPercent, slPercent, leverage, positionSizeUSDT,
      durationMinutes: 480, aiCheckInterval: 30,
      syncAiWithInterval: true, useReflection: false,
      trailingStopPct, maxDrawdownPct,
      aiModel: binanceKeys.openRouterModel,
      aiReason: scanEntry?.reason || null,
      gridUpper: gridUpper > 0 ? gridUpper : null,
      gridLower: gridLower > 0 ? gridLower : null,
      gridLayers,
    });
  };

  const handleScan = async () => {
    setScanning(true);
    setScanResults([]);
    try {
      const res = await fetch(`${API}/api/binance/ai-hunt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: selectedStrategy.label,
          strategyType: HUNT_TYPE[selectedStrategy.strategy] || 'scalp',
        }),
      });
      
      if (!res.ok) {
        if (res.status === 502) throw new Error('AI Analysis took too long (Timeout). Please try again.');
        const errText = await res.text();
        throw new Error(`Server Error (${res.status}): ${errText.slice(0, 100)}`);
      }

      const data = await res.json();
      setScanResults(data || []);
      if (data?.length > 0) setSymbol(data[0].symbol);
    } catch (e: any) {
      console.error('Scan error:', e);
      alert(e.message || 'Failed to scan market with AI');
    } finally {
      setScanning(false);
    }
  };

  // ── Mini mode ──────────────────────────────────────────────────────────────
  if (isMini) {
    return (
      <div className="glass-panel" style={{ width: '56px', flexShrink: 0, padding: '0.75rem 0', display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center', height: '100%', borderLeft: '3px solid #faad14' }}>        {STRATEGIES.map(s => (
          <button key={s.strategy} title={s.label}
            onClick={() => { setSelectedStrategy(s); onAIRecommend(s.mode, symbol, s.strategy, s.interval); }}
            disabled={loading}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.1rem', opacity: loading ? 0.4 : 0.7, padding: '0.2rem' }}>
            {s.emoji}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '0.5rem', color: '#faad14', fontWeight: 'bold', letterSpacing: '1px', writingMode: 'vertical-rl' }}>PILOT</span>
      </div>
    );
  }

  // ── Full sidebar ───────────────────────────────────────────────────────────
  return (
    <div className="glass-panel" style={{
      width: isMobile ? '100%' : '240px',
      flexShrink: 0, display: 'flex', flexDirection: 'column',
      height: isMobile ? 'auto' : '100%',
      borderLeft: isMobile ? 'none' : '3px solid #faad14',
      borderTop: isMobile ? '3px solid #faad14' : 'none',
      overflow: 'hidden',
      boxSizing: 'border-box',
    }}>

      {/* ── Header ── */}
      <div style={{ padding: '0.75rem 0.9rem 0', display: 'flex', flexDirection: 'column', gap: '0.6rem', boxSizing: 'border-box' }}>
        <div style={{ fontSize: '0.7rem', color: '#faad14', fontWeight: '900', letterSpacing: '1px' }}>🎯 MANUAL ENTRY</div>

        {/* Mode tabs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem' }}>
          {(['pick', 'scan'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              padding: '0.45rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer',
              background: mode === m ? '#faad14' : 'rgba(255,255,255,0.04)',
              color: mode === m ? '#000' : '#666',
              border: `1px solid ${mode === m ? '#faad14' : 'rgba(255,255,255,0.08)'}`,
            }}>
              {m === 'pick' ? '🎯 Pick Coin' : '🔍 AI Scan'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '0.75rem 0.9rem', display: 'flex', flexDirection: 'column', gap: '0.9rem', boxSizing: 'border-box' }}>

        {/* ════ MODE A: Pick Coin ════ */}
        {mode === 'pick' && (
          <>
            {/* Step 1 — Choose coin */}
            <Section label="1 · เลือกเหรียญ">
              <SymbolSelector value={symbol} onSelect={setSymbol} compact />
            </Section>

            {/* Step 2 — Choose strategy */}
            <Section label="2 · เลือกกลยุทธ์">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {STRATEGIES.map(s => (
                  <button key={s.strategy} onClick={() => setSelectedStrategy(s)}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                      padding: '0.55rem 0.65rem', borderRadius: '8px', cursor: 'pointer', textAlign: 'left',
                      background: selectedStrategy.strategy === s.strategy ? `${s.color}18` : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${selectedStrategy.strategy === s.strategy ? s.color : 'rgba(255,255,255,0.07)'}`,
                      transition: 'all 0.12s',
                    }}>
                    <span style={{ fontSize: '1rem', flexShrink: 0 }}>{s.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 'bold', color: selectedStrategy.strategy === s.strategy ? s.color : '#ccc' }}>{s.label}</div>
                      <div style={{ fontSize: '0.58rem', color: '#555', marginTop: '1px' }}>{s.sub}</div>
                    </div>
                    {selectedStrategy.strategy === s.strategy && (
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                    )}
                  </button>
                ))}
              </div>
            </Section>

            {/* Step 3 — Capital */}
            <Section label="3 · ทุน">
              <CapitalInput value={positionSizeUSDT} onChange={setPositionSizeUSDT} />
            </Section>
          </>
        )}

        {/* ════ MODE B: AI Scan ════ */}
        {mode === 'scan' && (
          <>
            {/* Step 1 — Choose strategy first */}
            <Section label="1 · เลือกกลยุทธ์ที่ต้องการสแกน">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {STRATEGIES.map(s => (
                  <button key={s.strategy} onClick={() => { setSelectedStrategy(s); setScanResults([]); }}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                      padding: '0.55rem 0.65rem', borderRadius: '8px', cursor: 'pointer', textAlign: 'left',
                      background: selectedStrategy.strategy === s.strategy ? `${s.color}18` : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${selectedStrategy.strategy === s.strategy ? s.color : 'rgba(255,255,255,0.07)'}`,
                    }}>
                    <span style={{ fontSize: '1rem', flexShrink: 0 }}>{s.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 'bold', color: selectedStrategy.strategy === s.strategy ? s.color : '#ccc' }}>{s.label}</div>
                      <div style={{ fontSize: '0.58rem', color: '#555', marginTop: '1px' }}>{s.sub}</div>
                    </div>
                    {selectedStrategy.strategy === s.strategy && (
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                    )}
                  </button>
                ))}
              </div>
            </Section>

            {/* Step 2 — Scan */}
            <Section label="2 · สแกนหาเหรียญ">
              <button onClick={handleScan} disabled={scanning}
                style={{
                  width: '100%', padding: '0.65rem', borderRadius: '8px', fontWeight: 'bold',
                  fontSize: '0.78rem', cursor: scanning ? 'not-allowed' : 'pointer',
                  background: scanning ? 'rgba(250,173,20,0.1)' : 'rgba(250,173,20,0.15)',
                  border: '1px solid rgba(250,173,20,0.4)', color: '#faad14',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                }}>
                {scanning
                  ? <><Spinner /> กำลังสแกน...</>
                  : <>🔍 สแกนด้วย {selectedStrategy.label}</>}
              </button>

              {/* Results */}
              {scanResults.length > 0 && (
                <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {scanResults.map((r, i) => (
                    <button key={r.symbol} onClick={() => setSymbol(r.symbol)}
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        padding: '0.5rem 0.65rem', borderRadius: '8px', cursor: 'pointer', textAlign: 'left',
                        background: symbol === r.symbol ? 'rgba(250,173,20,0.12)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${symbol === r.symbol ? '#faad14' : 'rgba(255,255,255,0.07)'}`,
                      }}>
                      <span style={{ fontSize: '0.65rem', color: '#555', fontWeight: 'bold', width: '14px' }}>#{i + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: symbol === r.symbol ? '#faad14' : '#ddd' }}>
                          {r.symbol.replace(':USDT', '').replace('USDT', '')}
                        </div>
                        {r.reason && (
                          <div style={{ fontSize: '0.58rem', color: '#555', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.reason}
                          </div>
                        )}
                      </div>
                      {symbol === r.symbol && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#faad14', flexShrink: 0 }} />}
                    </button>
                  ))}
                </div>
              )}

              {/* AI reason for selected */}
              {scanEntry?.reason && (
                <div style={{ marginTop: '0.4rem', padding: '0.55rem', borderRadius: '8px', background: 'rgba(250,173,20,0.07)', borderLeft: '2px solid #faad14', fontSize: '0.68rem', color: '#faad14', lineHeight: 1.5, fontStyle: 'italic' }}>
                  {scanEntry.reason}
                </div>
              )}
            </Section>

            {/* Step 3 — Capital */}
            <Section label="3 · ทุน">
              <CapitalInput value={positionSizeUSDT} onChange={setPositionSizeUSDT} />
            </Section>
          </>
        )}

        {/* ── Advanced (both modes) ── */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.5rem' }}>
          <button onClick={() => setShowAdvanced(!showAdvanced)}
            style={{ width: '100%', background: 'transparent', border: 'none', color: '#444', fontSize: '0.65rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>
            <span>⚙️ Advanced</span>
            <span>{showAdvanced ? '▲' : '▼'}</span>
          </button>
          {showAdvanced && (
            <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.45rem', background: 'rgba(0,0,0,0.2)', padding: '0.6rem', borderRadius: '8px' }}>
              <Row label="Leverage">
                <select value={leverage} onChange={e => setLeverage(+e.target.value)}
                  style={{ background: 'transparent', border: 'none', color: '#faad14', fontSize: '0.7rem', fontWeight: 'bold' }}>
                  {[1, 2, 5, 10, 20, 50, 100].map(l => <option key={l} value={l}>{l}x</option>)}
                </select>
              </Row>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem' }}>
                <NumField label="TP %" color="#0ecb81" value={tpPercent} onChange={setTpPercent} />
                <NumField label="SL %" color="#f6465d" value={slPercent} onChange={setSlPercent} />
              </div>
              <Row label="Trailing SL %">
                <input type="number" step="0.1" value={trailingStopPct} onChange={e => setTrailingStopPct(+e.target.value)}
                  style={{ width: '40px', background: 'transparent', border: 'none', color: '#fff', textAlign: 'right', fontSize: '0.7rem' }} />
              </Row>
              <Row label="Max Drawdown %">
                <input type="number" step="1" value={maxDrawdownPct} onChange={e => setMaxDrawdownPct(+e.target.value)}
                  style={{ width: '40px', background: 'transparent', border: 'none', color: '#fff', textAlign: 'right', fontSize: '0.7rem' }} />
              </Row>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.4rem' }}>
                <div style={{ fontSize: '0.55rem', color: '#faad14', fontWeight: 'bold', marginBottom: '0.35rem' }}>GRID LAYERING</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem', marginBottom: '0.35rem' }}>
                  <PriceField label="Upper" value={gridUpper} onChange={setGridUpper} />
                  <PriceField label="Lower" value={gridLower} onChange={setGridLower} />
                </div>
                <Row label={`Layers: ${gridLayers}`}>
                  <input type="range" min="2" max="50" value={gridLayers} onChange={e => setGridLayers(+e.target.value)}
                    style={{ width: '60px', accentColor: '#faad14' }} />
                </Row>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Launch button (sticky bottom) ── */}
      <div style={{ padding: '0.75rem 0.9rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        {/* Summary strip */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: '#555', marginBottom: '0.5rem' }}>
          <span>{symbol.replace(':USDT', '').replace('USDT', '')} · {selectedStrategy.interval}</span>
          <span style={{ color: selectedStrategy.color, fontWeight: 'bold' }}>{selectedStrategy.emoji} {selectedStrategy.label}</span>
        </div>
        <button onClick={handleLaunch} disabled={loading} style={{
          width: '100%', padding: '0.8rem', borderRadius: '10px', fontWeight: '900',
          fontSize: '0.82rem', cursor: loading ? 'not-allowed' : 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px',
          background: loading ? 'rgba(250,173,20,0.2)' : 'linear-gradient(135deg, #faad14, #ffc53d)',
          color: loading ? '#666' : '#000', border: 'none',
          boxShadow: loading ? 'none' : '0 4px 16px rgba(250,173,20,0.25)',
        }}>
          {loading ? '⏳ Analyzing...' : '🚀 Launch Bot'}
        </button>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <div style={{ fontSize: '0.6rem', color: '#555', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      {children}
    </div>
  );
}

function CapitalInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '0.5rem 0.75rem', border: '1px solid rgba(255,255,255,0.08)' }}>
      <span style={{ fontSize: '0.65rem', color: '#666' }}>USDT</span>
      <input type="number" value={value} onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: '80px', background: 'transparent', border: 'none', color: '#faad14', textAlign: 'right', fontSize: '1.1rem', fontWeight: 'bold' }} />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '0.6rem', color: '#666' }}>{label}</span>
      {children}
    </div>
  );
}

function NumField({ label, color, value, onChange }: { label: string; color: string; value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '0.3rem' }}>
      <span style={{ fontSize: '0.5rem', color, display: 'block', marginBottom: '2px' }}>{label}</span>
      <input type="number" step="0.1" value={value} onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', background: 'transparent', border: 'none', color, textAlign: 'center', fontSize: '0.85rem', fontWeight: 'bold' }} />
    </div>
  );
}

function PriceField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ background: 'rgba(250,173,20,0.05)', padding: '0.35rem', borderRadius: '4px' }}>
      <span style={{ fontSize: '0.5rem', color: '#faad14', display: 'block' }}>{label}</span>
      <input type="number" value={value} onChange={e => onChange(parseFloat(e.target.value))} placeholder="0.00"
        style={{ width: '100%', background: 'transparent', border: 'none', color: '#fff', fontSize: '0.75rem', fontWeight: 'bold' }} />
    </div>
  );
}

function Spinner() {
  return (
    <span style={{
      display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%',
      border: '2px solid rgba(250,173,20,0.3)', borderTopColor: '#faad14',
      animation: 'spin 0.7s linear infinite',
    }} />
  );
}
