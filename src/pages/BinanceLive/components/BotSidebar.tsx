import { useState } from 'react';
import { INTERVALS, type BinanceKeys, API } from '../types';
import SymbolSelector from '../../../components/SymbolSelector';

interface Props {
  binanceKeys: BinanceKeys;
  onStart: (config: any) => Promise<void>;
  onAIRecommend: (mode: 'confident' | 'grid' | 'scout', currentSymbol: string, currentStrategy: string, currentInterval: string) => Promise<void>;
  loading: boolean;
  positionSizeUSDT: number;
  setPositionSizeUSDT: (val: number) => void;
  isMini?: boolean;
}

export default function BotSidebar({ binanceKeys, onStart, onAIRecommend, loading, positionSizeUSDT, setPositionSizeUSDT, isMini }: Props) {
  // Single Bot States
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [intervalTime, setIntervalTime] = useState('1h');
  const strategy = 'EMA_RSI';
  const [tpPercent, setTpPercent] = useState(1.5);
  const [slPercent, setSlPercent] = useState(1.0);
  const [leverage, setLeverage] = useState(10);
  const [trailingStopPct, setTrailingStopPct] = useState(0);
  const [maxDrawdownPct, setMaxDrawdownPct] = useState(10);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [huntGoal, setHuntGoal] = useState('Scalping (Volatility)');
  const [scanning, setScanning] = useState(false);
  const [scanResults, setScanResults] = useState<any[]>([]);

  // Grid / Layering States
  const [gridUpper, setGridUpper] = useState<number>(0);
  const [gridLower, setGridLower] = useState<number>(0);
  const [gridLayers, setGridLayers] = useState<number>(10);

  const handleLaunchSingle = () => {
    onStart({
      symbol,
      interval: intervalTime,
      strategy,
      tpPercent,
      slPercent,
      leverage,
      positionSizeUSDT,
      durationMinutes: 480,
      aiCheckInterval: 30,
      syncAiWithInterval: true,
      useReflection: false,
      trailingStopPct,
      maxDrawdownPct,
      aiModel: binanceKeys.openRouterModel,
      gridUpper: gridUpper > 0 ? gridUpper : null,
      gridLower: gridLower > 0 ? gridLower : null,
      gridLayers: gridLayers
    });
  };

  const handleMarketScan = async () => {
    setScanning(true);
    try {
      const res = await fetch(`${API}/api/binance/ai-hunt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: huntGoal })
      });
      const data = await res.json();
      setScanResults(data || []);
      if (data && data.length > 0) {
        setSymbol(data[0].symbol);
      }
    } catch (e) {
      console.error('Hunt Error:', e);
    } finally {
      setScanning(false);
    }
  };

  if (isMini) {
    return (
      <div className="glass-panel" style={{ width: '70px', flexShrink: 0, padding: '1rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', height: '100%', borderLeft: '4px solid #faad14', overflowX: 'hidden' }}>
        <div title="AI Target Hunt" onClick={handleMarketScan} style={{ cursor: 'pointer', fontSize: '1.2rem', opacity: scanning ? 0.5 : 1 }}>🔍</div>
        <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.1)' }} />
        <button onClick={() => onAIRecommend('confident', symbol, strategy, intervalTime)} disabled={loading} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.5rem' }} title="AI Precision">💎</button>
        <button onClick={() => onAIRecommend('grid', symbol, 'AI_GRID_SCALP', '15m')} disabled={loading} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.5rem' }} title="Grid Scalp">⚡</button>
        <button onClick={() => onAIRecommend('grid', symbol, 'AI_GRID_SWING', '1h')} disabled={loading} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.5rem' }} title="Grid Swing">🏛️</button>
        <button onClick={() => onAIRecommend('scout', symbol, strategy, intervalTime)} disabled={loading} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.5rem' }} title="Trend Scout">🏹</button>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: '0.6rem', color: '#faad14', fontWeight: 'bold' }}>PILOT</div>
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{ width: '220px', flexShrink: 0, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto', height: '100%', borderLeft: '4px solid #faad14' }}>
      <div style={{ marginBottom: '0.5rem' }}>
        <h4 className="m-0" style={{ fontSize: '1rem', color: '#faad14' }}>🎯 SINGLE BOT SETUP</h4>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Target & Size Section */}
        <div style={{ padding: '0.8rem', background: 'rgba(255,173,20,0.03)', borderRadius: '12px', border: '1px solid rgba(250,173,20,0.1)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.8rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.6rem', color: '#faad14', fontWeight: '900', textTransform: 'uppercase' }}>AI Target Hunt</span>
              <button onClick={handleMarketScan} disabled={scanning} style={{ background: 'transparent', border: 'none', color: '#faad14', fontSize: '0.65rem', cursor: 'pointer', opacity: scanning ? 0.3 : 0.8, fontWeight: 'bold' }}>
                {scanning ? 'HUNTING...' : '🔍 AI SCAN'}
              </button>
            </div>
            <select
              value={huntGoal}
              onChange={e => setHuntGoal(e.target.value)}
              style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px', padding: '0.3rem', fontSize: '0.7rem' }}
            >
              <option value="Grid (Sideways)">Grid (Sideways)</option>
              <option value="Scalping (Volatility)">Scalping (Volatility)</option>
              <option value="Trend Flow (Momentum)">Trend Flow (Momentum)</option>
            </select>
          </div>

          <div style={{ fontSize: '0.6rem', color: '#888', fontWeight: '900', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Target Asset</div>
          <SymbolSelector value={symbol} onSelect={setSymbol} compact />

          {scanResults.length > 0 && (
            <div style={{ marginTop: '0.8rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              <div style={{ width: '100%', fontSize: '0.55rem', color: '#888', marginBottom: '0.1rem', textTransform: 'uppercase' }}>Top Hunt Results:</div>
              {scanResults.map(r => (
                <button
                  key={r.symbol}
                  onClick={() => setSymbol(r.symbol)}
                  style={{
                    background: r.symbol === symbol ? '#faad1422' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${r.symbol === symbol ? '#faad14' : 'rgba(255,255,255,0.1)'}`,
                    color: r.symbol === symbol ? '#faad14' : '#ccc',
                    borderRadius: '4px', padding: '0.2rem 0.4rem', fontSize: '0.6rem', cursor: 'pointer', display: 'flex', gap: '0.3rem', alignItems: 'center'
                  }}
                >
                  <span>{r.tag === '穩定' ? '' : r.tag} {r.symbol.replace('USDT', '')}</span>
                  <span style={{ opacity: 0.6, fontSize: '0.5rem' }}>{r.change !== undefined && r.change !== null ? `${r.change > 0 ? '+' : ''}${r.change.toFixed(1)}%` : ''}</span>
                </button>
              ))}
            </div>
          )}

          <div style={{ marginTop: '0.8rem', background: 'rgba(0,0,0,0.4)', borderRadius: '6px', padding: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.6rem', color: '#888' }}>CAPITAL ($)</span>
            <input
              type="number"
              value={positionSizeUSDT}
              onChange={e => setPositionSizeUSDT(parseFloat(e.target.value))}
              style={{ width: '60px', background: 'transparent', border: 'none', color: '#faad14', textAlign: 'right', fontSize: '0.9rem', fontWeight: 'bold' }}
            />
          </div>
        </div>

        {/* AI Intelligence Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ fontSize: '0.6rem', color: '#888', fontWeight: '900', marginBottom: '0.2rem' }}>STRATEGIC COGNITION</div>

          <button
            onClick={() => onAIRecommend('confident', symbol, strategy, intervalTime)}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.75rem',
              background: 'rgba(250,173,20,0.05)', border: '1px solid #faad1444',
              color: '#faad14', borderRadius: '10px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s'
            }}
          >
            <span style={{ fontSize: '1.2rem' }}>💎</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>AI Precision</div>
              <div style={{ fontSize: '0.55rem', opacity: 0.6 }}>Confidence-driven signals</div>
            </div>
          </button>

          <button
            onClick={() => onAIRecommend('grid', symbol, 'AI_GRID_SCALP', '15m')}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.75rem',
              background: 'rgba(250,173,20,0.05)', border: '1px solid #faad1444',
              color: '#faad14', borderRadius: '10px', cursor: 'pointer', textAlign: 'left'
            }}
          >
            <span style={{ fontSize: '1.2rem' }}>⚡</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>Grid Scalp</div>
              <div style={{ fontSize: '0.55rem', opacity: 0.6 }}>Fast micro-ranges (15m)</div>
            </div>
          </button>

          <button
            onClick={() => onAIRecommend('grid', symbol, 'AI_GRID_SWING', '1h')}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.75rem',
              background: 'rgba(24,144,255,0.05)', border: '1px solid #1890ff44',
              color: '#1890ff', borderRadius: '10px', cursor: 'pointer', textAlign: 'left'
            }}
          >
            <span style={{ fontSize: '1.2rem' }}>🏛️</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>Grid Swing</div>
              <div style={{ fontSize: '0.55rem', opacity: 0.6 }}>Solid mid-term ranges (1h)</div>
            </div>
          </button>

          <button
            onClick={() => onAIRecommend('scout', symbol, strategy, intervalTime)}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.75rem',
              background: 'rgba(246,70,93,0.05)', border: '1px solid #f6465d44',
              color: '#f6465d', borderRadius: '10px', cursor: 'pointer', textAlign: 'left'
            }}
          >
            <span style={{ fontSize: '1.2rem' }}>🏹</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>Trend Scout</div>
              <div style={{ fontSize: '0.55rem', opacity: 0.6 }}>Rapid trend detection</div>
            </div>
          </button>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem' }}>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{ width: '100%', background: 'transparent', border: 'none', color: '#888', fontSize: '0.65rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
          >
            {showAdvanced ? '🔽 Hide Overrides' : '▶️ Advanced Safeguards'}
          </button>

          {showAdvanced && (
            <div style={{ marginTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', background: 'rgba(0,0,0,0.2)', padding: '0.6rem', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.6rem', color: '#888' }}>LEVERAGE</span>
                <select value={leverage} onChange={e => setLeverage(parseInt(e.target.value))} style={{ background: 'transparent', border: 'none', color: '#faad14', fontSize: '0.7rem', fontWeight: 'bold' }}>
                  {[1, 2, 5, 10, 20, 50, 100].map(l => <option key={l} value={l}>{l}x</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.6rem', color: '#888' }}>TIMEFRAME</span>
                <select value={intervalTime} onChange={e => setIntervalTime(e.target.value)} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.7rem' }}>
                  {INTERVALS.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.6rem' }}>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '0.5rem', color: '#0ecb81', display: 'block' }}>TP %</span>
                  <input type="number" step="0.1" value={tpPercent} onChange={e => setTpPercent(parseFloat(e.target.value))} style={{ width: '100%', background: 'transparent', border: 'none', color: '#0ecb81', textAlign: 'center', fontSize: '0.8rem', fontWeight: 'bold' }} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '0.5rem', color: '#f6465d', display: 'block' }}>SL %</span>
                  <input type="number" step="0.1" value={slPercent} onChange={e => setSlPercent(parseFloat(e.target.value))} style={{ width: '100%', background: 'transparent', border: 'none', color: '#f6465d', textAlign: 'center', fontSize: '0.8rem', fontWeight: 'bold' }} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: '#faad14' }}>
                <span>Trailing SL:</span>
                <input type="number" step="0.1" value={trailingStopPct} onChange={e => setTrailingStopPct(parseFloat(e.target.value))} style={{ width: '40px', background: 'transparent', border: 'none', color: '#fff', textAlign: 'right' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: '#f6465d' }}>
                <span>Max Drawdown:</span>
                <input type="number" step="1" value={maxDrawdownPct} onChange={e => setMaxDrawdownPct(parseFloat(e.target.value))} style={{ width: '40px', background: 'transparent', border: 'none', color: '#fff', textAlign: 'right' }} />
              </div>

              <div style={{ marginTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.6rem' }}>
                <div style={{ fontSize: '0.55rem', color: '#faad14', fontWeight: 'bold', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Grid Layering (ซอยไม้)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginBottom: '0.4rem' }}>
                  <div style={{ background: 'rgba(250,173,20,0.05)', padding: '0.4rem', borderRadius: '4px' }}>
                    <span style={{ fontSize: '0.5rem', color: '#faad14', display: 'block' }}>Upper Price</span>
                    <input type="number" value={gridUpper} onChange={e => setGridUpper(parseFloat(e.target.value))} placeholder="0.00" style={{ width: '100%', background: 'transparent', border: 'none', color: '#fff', fontSize: '0.75rem', fontWeight: 'bold' }} />
                  </div>
                  <div style={{ background: 'rgba(250,173,20,0.05)', padding: '0.4rem', borderRadius: '4px' }}>
                    <span style={{ fontSize: '0.5rem', color: '#faad14', display: 'block' }}>Lower Price</span>
                    <input type="number" value={gridLower} onChange={e => setGridLower(parseFloat(e.target.value))} placeholder="0.00" style={{ width: '100%', background: 'transparent', border: 'none', color: '#fff', fontSize: '0.75rem', fontWeight: 'bold' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.55rem', color: '#888' }}>GRID LAYERS: {gridLayers}</span>
                  <input type="range" min="2" max="50" value={gridLayers} onChange={e => setGridLayers(parseInt(e.target.value))} style={{ width: '60px', accentColor: '#faad14' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleLaunchSingle}
          disabled={loading}
          style={{
            background: 'linear-gradient(to right, #faad14, #ffc53d)', color: '#000', border: 'none',
            padding: '0.85rem', borderRadius: '12px', fontWeight: '900', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.8rem',
            boxShadow: '0 4px 12px rgba(250,173,20,0.2)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '0.5rem'
          }}
        >
          {loading ? 'ANALYZING...' : '🚀 LAUNCH CO-PILOT'}
        </button>
      </div>
    </div>
  );
}
