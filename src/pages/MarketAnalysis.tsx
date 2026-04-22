import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, 
  Settings, 
  Maximize2, 
  Clock, 
  Zap,
  ChevronDown,
  LayoutGrid,
  Info,
  RefreshCw
} from 'lucide-react';
import CandleChart from '../components/CandleChart';
import type { CandleChartHandle } from '../components/CandleChart';
import type { OverlayData } from '../utils/backtestUtils';
import { detectStrategySetup, calculateTradeMetrics } from '../utils/indicatorUtils';
import SymbolSelector from '../components/SymbolSelector';

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'];

export default function MarketAnalysis() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [interval, setChartInterval] = useState('5m');
  const [showSearch, setShowSearch] = useState(false);
  const [indicatorConfigs, setIndicatorConfigs] = useState<any[]>([]);
  
  const [overlayData, setOverlayData] = useState<OverlayData>({
    zones: []
  });
  const [manualSetup, setManualSetup] = useState<any>(null);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [rrRatio, setRrRatio] = useState<number>(1.5);
  const [strategies, setStrategies] = useState<any[]>([]);
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>('default-smc');
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [marketMetrics, setMarketMetrics] = useState<any>(null);
  const [marketFeatures, setMarketFeatures] = useState<any>(null);
  const [activeToggles, setActiveToggles] = useState<Record<string, boolean>>({
    zones: false,
    levels: true,
    draw: false
  });

  const API_BASE = 'http://localhost:4000/api';
  const API_FEATURES = 'http://localhost:4001/api/market';

  useEffect(() => {
    const fetchStrategies = async () => {
      try {
        // Fix: Use plural 'strategies' to match backend router mounting
        const res = await fetch(`${API_BASE}/strategies`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setStrategies(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to fetch strategies:', err);
      }
    };
    fetchStrategies();
  }, []);

  const chartRef = useRef<CandleChartHandle>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${API_BASE}/indicators`)
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) setIndicatorConfigs(data);
      })
      .catch(err => console.error('Failed to fetch indicators', err));

    function handleClickOutside(event: MouseEvent) {
      const isInsideTrigger = searchContainerRef.current && searchContainerRef.current.contains(event.target as Node);
      const isInsideDropdown = dropdownRef.current && dropdownRef.current.contains(event.target as Node);
      
      if (!isInsideTrigger && !isInsideDropdown) {
        setShowSearch(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDataLoaded = React.useCallback((candles: any[]) => {
    if (!candles || candles.length === 0) return;
    const allZones = detectStrategySetup(selectedStrategyId, candles, indicatorConfigs);
    setOverlayData({ zones: allZones });

    // Calculate quantitative metrics
    const metrics = calculateTradeMetrics(candles);
    setMarketMetrics(metrics);

    const liveCandle = candles[candles.length - 1];
    const closedCandle = candles[candles.length - 2] || liveCandle;
    
    if (liveCandle) {
        setCurrentPrice(liveCandle.close);
        
        // Stabilize setup generation by using the last CLOSED price as reference
        const refPrice = closedCandle.close;
        
        if (allZones.length > 0) {
            // 1. Sort zones by proximity to the last CLOSED price
            const sortedZones = [...allZones].sort((a, b) => {
                const distA = Math.min(Math.abs(refPrice - a.top), Math.abs(refPrice - a.bottom));
                const distB = Math.min(Math.abs(refPrice - b.top), Math.abs(refPrice - b.bottom));
                return distA - distB;
            });

            const z = sortedZones[0];
            const isLongVal = z.type.includes('UP');
            
            // 2. Determine Entry/SL based on zone edges Relative to CLOSED price
            let entry, sl;
            if (isLongVal) {
                // Bullish zone: Entry at top, SL at bottom
                entry = Math.max(z.top, z.bottom);
                sl = Math.min(z.top, z.bottom);
            } else {
                // Bearish zone: Entry at bottom, SL at top
                entry = Math.min(z.top, z.bottom);
                sl = Math.max(z.top, z.bottom);
            }
            
            const risk = Math.abs(entry - sl);
            if (risk > 0) {
                // Determine standard Ratios: TP1 (1:1), TP2 (1:2), TP3 (1:Final RR)
                setManualSetup({
                    type: isLongVal ? 'LONG' : 'SHORT',
                    entryPrice: entry,
                    slPrice: sl,
                    tp1Price: isLongVal ? entry + risk * 1.0 : entry - risk * 1.0,
                    tp2Price: isLongVal ? entry + risk * 2.0 : entry - risk * 2.0,
                    tp3Price: isLongVal ? entry + risk * Math.max(3.0, rrRatio) : entry - risk * Math.max(3.0, rrRatio),
                    symbol: symbol,
                    riskPerTrade: 2500,
                });
            }
        }
    }
  }, [indicatorConfigs, rrRatio, symbol, selectedStrategyId]);

  const handleManualRefresh = async () => {
    if (!chartRef.current || isRefreshing) return;
    setIsRefreshing(true);
    await chartRef.current.loadKlines({ symbol, interval, strategyId: selectedStrategyId });
    await fetchMarketFeatures(symbol, interval);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(() => {
      if (chartRef.current) {
        chartRef.current.loadKlines({ symbol, interval, strategyId: selectedStrategyId });
        fetchMarketFeatures(symbol, interval);
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [autoRefresh, symbol, interval, selectedStrategyId]);

  const fetchMarketFeatures = async (currentSymbol: string, currentInterval: string) => {
    try {
      const res = await fetch(`${API_FEATURES}/features?symbol=${currentSymbol}&interval=${currentInterval}`);
      const data = await res.json();
      setMarketFeatures(data);
    } catch (e) {
      console.error('Fetch market features error:', e);
    }
  };

  useEffect(() => {
    if (chartRef.current) {
       chartRef.current.loadKlines({ symbol, interval, strategyId: selectedStrategyId });
       fetchMarketFeatures(symbol, interval);
    }
  }, [symbol, interval, selectedStrategyId]);

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh', 
      width: '100%', 
      background: '#131722', 
      color: '#d1d4dc', 
      overflow: 'hidden',
      position: 'fixed',
      inset: 0
    }}>
      {/* 1. TOP TOOLBAR */}
      <div style={{ display: 'flex', alignItems: 'center', height: '48px', background: '#131722', borderBottom: '1px solid #2a2e39', position: 'relative', zIndex: 1000 }}>
        <div ref={searchContainerRef} style={{ height: '100%', display: 'flex', alignItems: 'center', position: 'relative' }}>
          <div onClick={() => setShowSearch(!showSearch)} className="hover:bg-[#2a2e39] cursor-pointer px-4 h-full flex items-center transition-all gap-2" style={{ borderRight: '1px solid #2a2e39', background: showSearch ? '#2a2e39' : 'transparent', color: showSearch ? '#fff' : 'inherit' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '800', letterSpacing: '0.5px' }}>{symbol}</span>
            <ChevronDown size={14} opacity={0.5} style={{ transform: showSearch ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </div>
        </div>

        <div style={{ display: 'flex', height: '100%', alignItems: 'center', borderRight: '1px solid #2a2e39' }}>
          {TIMEFRAMES.map(tf => (
            <div key={tf} onClick={() => setChartInterval(tf)} style={{ padding: '0 0.85rem', height: '100%', display: 'flex', alignItems: 'center', fontSize: '0.75rem', cursor: 'pointer', fontWeight: interval === tf ? 'bold' : 'normal', color: interval === tf ? '#2962ff' : '#848e9c', background: interval === tf ? 'rgba(41, 98, 255, 0.08)' : 'transparent' }} className="hover:bg-[#2a2e39] transition-all">
              {tf.toUpperCase()}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', paddingLeft: '1rem', borderRight: '1px solid #2a2e39', height: '100%', paddingRight: '1rem' }}>
          <span style={{ fontSize: '0.65rem', color: '#848e9c', fontWeight: 800 }}>STRATEGY:</span>
          <select value={selectedStrategyId} onChange={(e) => setSelectedStrategyId(e.target.value)} style={{ background: '#1e222d', color: '#d1d4dc', border: '1px solid #363c4e', borderRadius: '4px', padding: '2px 8px', fontSize: '0.75rem', outline: 'none', cursor: 'pointer', fontWeight: 600 }}>
            <option value="default-smc">Default SMC (OB/FVG)</option>
            {strategies.map(s => (
              <option key={s.id} value={s.id}>{s.name || s.id}</option>
            ))}
          </select>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', height: '100%', alignItems: 'center', paddingRight: '0.5rem', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', background: '#1e222d', borderRadius: '6px', border: '1px solid #363c4e', height: '28px', padding: '0 4px' }}>
            <button 
              onClick={handleManualRefresh}
              className="hover:bg-[#2a2e39] transition-all"
              style={{ padding: '4px 8px', border: 'none', background: 'transparent', color: isRefreshing ? '#2962ff' : '#848e9c', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
              title="Refresh Manual"
            >
              <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
            </button>
            <div style={{ width: '1px', height: '14px', background: '#363c4e' }} />
            <button 
              onClick={() => setAutoRefresh(!autoRefresh)}
              className="hover:bg-[#2a2e39] transition-all"
              style={{ padding: '0 8px', border: 'none', background: 'transparent', color: autoRefresh ? '#22c55e' : '#848e9c', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer' }}
              title="Auto Refresh (5s)"
            >
              <Clock size={12} /> {autoRefresh ? 'AUTO ON' : 'AUTO OFF'}
            </button>
          </div>
        </div>
      </div>

      {/* 🔮 2. CHART CONTEXT & STATUS BAR (Visible, Full-width) */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center',
        background: '#131722', 
        borderBottom: '1px solid #2a2e39', 
        padding: '0 1rem', 
        height: '42px',
        gap: '1rem',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        flexShrink: 0
      }}>
        {/* Left: Symbol Identifier */}
        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff', letterSpacing: '0.5px', paddingRight: '1.5rem', borderRight: '1px solid #2a2e39', minWidth: '100px' }}>
           {symbol}
        </div>

        {/* Middle: Chart Tools */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
           <button 
             onClick={() => chartRef.current?.getChart()?.timeScale().fitContent()}
             title="Fit all candles to screen"
             style={{ border: '1px solid #363c4e', background: 'rgba(255,255,255,0.03)', color: '#0ecb81', fontSize: '0.65rem', padding: '4px 10px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontWeight: 700 }}
           >
              <Maximize2 size={12} /> Fit View
           </button>

           <button 
             onClick={() => chartRef.current?.getChart() && window.dispatchEvent(new CustomEvent('chart-replay-toggle'))}
             style={{ border: '1px solid #363c4e', background: 'rgba(255,255,255,0.03)', color: '#848e9c', fontSize: '0.65rem', padding: '4px 10px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
           >
              <RefreshCw size={12} /> Replay
           </button>
           <div style={{ width: '1px', height: '16px', background: '#2a2e39', margin: '0 4px' }} />
           <div style={{ display: 'flex', gap: '4px' }}>
              {['Draw', 'Zones', 'Levels'].map(tool => {
                 const key = tool.toLowerCase();
                 const isActive = activeToggles[key];
                 return (
                   <button 
                     key={tool}
                     onClick={() => {
                        setActiveToggles(prev => ({ ...prev, [key]: !prev[key] }));
                        if (key === 'draw') {
                          // Handle draw toggle specifically if needed, or use overlay logic
                          chartRef.current?.toggleOverlay('draw' as any);
                        } else {
                          chartRef.current?.toggleOverlay(key as any);
                        }
                     }}
                     style={{ 
                        border: isActive ? '1px solid #10b981' : '1px solid #363c4e', 
                        background: isActive ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.03)', 
                        color: isActive ? '#10b981' : '#848e9c', 
                        fontSize: '0.65rem', 
                        padding: '4px 10px', 
                        borderRadius: '4px', 
                        cursor: 'pointer',
                        fontWeight: isActive ? 700 : 400,
                        transition: 'all 0.2s'
                     }}
                   >
                     {tool}
                   </button>
                 );
              })}
           </div>
        </div>

        {/* Right: Metrics Cluster */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '1.25rem', flexShrink: 0 }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <DashboardItem label="FUNDING" value={marketFeatures?.features?.microstructure?.fundingRate ? `${(marketFeatures.features.microstructure.fundingRate * 100).toFixed(4)}%` : '--'} color="#a78bfa" />
              <DashboardItem label="LIQ.VOL" value={marketFeatures?.features?.microstructure?.liquidationVolume ? '$' + (marketFeatures.features.microstructure.liquidationVolume/1000).toFixed(1) + 'K' : '--'} />
              <DashboardItem label="ORDER FLOW" value={marketFeatures?.features?.microstructure?.orderFlowDelta} color={(marketFeatures?.features?.microstructure?.orderFlowDelta || 0) > 0 ? '#0ecb81' : '#f6465d'} />
           </div>
           <div style={{ width: '1px', height: '20px', background: '#2a2e39' }} />
           <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                 <span style={{ fontSize: '0.5rem', color: '#5a5e67', fontWeight: 800 }}>TQI SCORE</span>
                 <span style={{ fontSize: '0.85rem', fontWeight: 900, color: (marketFeatures?.features?.quant?.tqi || 50) > 60 ? '#0ecb81' : '#f0b90b' }}>{marketFeatures?.features?.quant?.tqi || '--'}</span>
              </div>
              <DashboardItem label="WHALE" value={marketFeatures?.features?.onchain?.whaleActivity} color={marketFeatures?.features?.onchain?.whaleActivity === 'High' ? '#fb923c' : '#fff'} />
           </div>
           <div title="Real-time Status" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(34,197,94,0.05)', padding: '4px 10px', borderRadius: '20px', border: '1px solid rgba(34,197,94,0.1)' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: autoRefresh ? '#22c55e' : '#555', boxShadow: autoRefresh ? '0 0 8px #22c55e' : 'none' }} />
              <span style={{ fontSize: '0.55rem', fontWeight: 900, color: autoRefresh ? '#22c55e' : '#848e9c' }}>LIVE</span>
           </div>
        </div>
      </div>

      {/* 3. MAIN DATA AREA */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden', width: '100%' }}>
        {/* Left: Chart Area */}
        <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* 🔄 Premium Loading Overlay */}
          {isRefreshing && (
            <div style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(10, 11, 14, 0.45)',
              backdropFilter: 'blur(6px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000,
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
            }}>
              <div style={{
                background: 'rgba(30, 32, 38, 0.9)',
                padding: '2rem 3rem',
                borderRadius: '24px',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1.25rem',
                animation: 'scaleIn 0.3s ease-out'
              }}>
                <div style={{ position: 'relative' }}>
                  <RefreshCw 
                    size={42} 
                    color="#00d1ff" 
                    style={{ animation: 'spin 1.2s linear infinite' }} 
                  />
                  <div style={{ 
                    position: 'absolute', 
                    top: '-4px', right: '-4px', 
                    width: '12px', height: '12px', 
                    background: '#0ecb81', borderRadius: '50%',
                    boxShadow: '0 0 10px #0ecb81',
                    animation: 'pulse 1.5s infinite' 
                  }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <span style={{ 
                    color: '#fff', 
                    fontSize: '1rem', 
                    fontWeight: 800,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase'
                  }}>Syncing Quantum Data</span>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem', fontWeight: 600 }}>CALIBRATING ANALYSIS ENGINE</span>
                </div>
              </div>
            </div>
          )}

          {showSearch && (
            <div ref={dropdownRef} className="absolute top-0 left-0 w-[420px] h-full z-[9999]" style={{ padding: '12px', background: 'rgba(19, 23, 34, 0.95)', backdropFilter: 'blur(10px)', borderRight: '1px solid #363c4e', boxShadow: '20px 0 50px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
               <div style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px', border: '1px solid #363c4e', display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <Activity size={28} color="#0ecb81" />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                     <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{symbol}</span>
                     <span style={{ fontSize: '0.7rem', color: '#848e9c' }}>Binance Futures • Perps</span>
                  </div>
               </div>
               <div style={{ flex: 1, overflowY: 'auto', padding: '12px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px', border: '1px solid #2a2e39' }}>
                  <SymbolSelector value={symbol} onSelect={(s) => { setSymbol(s); setShowSearch(false); }} searchTop={true} />
               </div>
            </div>
          )}
          <div style={{ flex: 1 }}>
            <CandleChart 
              ref={chartRef}
              symbol={symbol}
              interval={interval}
              onDataLoaded={handleDataLoaded}
              overlayData={overlayData}
              manualTrade={manualSetup}
              strategyId={selectedStrategyId}
              height="100%"
            />
          </div>
        </div>

        {/* Right: Sidebar */}
        <div style={{ width: '280px', background: '#131722', borderLeft: '1px solid #2a2e39', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.2rem', overflowY: 'auto' }}>
           <h3 style={{ fontSize: '0.65rem', fontWeight: 800, color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: '0.5rem', letterSpacing: '1px' }}><Zap size={14} color="#faad14" /> TRADE PLANNER</h3>
           
           <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ padding: '0.85rem', background: 'rgba(255,122,0,0.03)', borderRadius: '10px', border: '1px solid rgba(255,122,0,0.1)' }}>
                 <div style={{ fontSize: '9px', color: '#848e9c', marginBottom: '0.6rem', letterSpacing: '0.05em', fontWeight: 700 }}>AI SIGNAL CONTEXT</div>
                 {overlayData.zones?.[0] ? (
                   <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '3px', height: '24px', background: overlayData.zones[0].type.includes('UP') ? '#0ecb81' : '#f43f5e', borderRadius: '2px' }} />
                      <div>
                        <div style={{ color: overlayData.zones[0].type.includes('UP') ? '#0ecb81' : '#f43f5e', fontWeight: 800, fontSize: '0.85rem' }}>{overlayData.zones[0].type.replace('_', ' ')}</div>
                        <div style={{ fontSize: '0.65rem', color: '#848e9c' }}>High probability zone active</div>
                      </div>
                   </div>
                 ) : (
                   <div style={{ color: '#555', fontSize: '0.7rem' }}>Scanning for valid setups...</div>
                 )}
              </div>

              {manualSetup && (
                <div style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.02)', borderRadius: '14px', border: '1px solid #2a2e39', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
                      <div style={{ fontSize: '11px', color: '#848e9c', fontWeight: 800, letterSpacing: '0.5px' }}>LIVE TRADE PLAN</div>
                      <span style={{ fontSize: '0.7rem', color: manualSetup.type === 'LONG' ? '#22c55e' : '#f43f5e', fontWeight: 'bold' }}>{manualSetup.type}</span>
                   </div>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: '0.75rem', color: '#848e9c' }}>Entry</span><span style={{ fontSize: '0.85rem', fontWeight: 700 }}>${manualSetup.entryPrice.toLocaleString()}</span></div>
                      <div style={{ padding: '0.75rem', background: 'rgba(244,63,94,0.06)', borderRadius: '10px', border: '1px solid rgba(244,63,94,0.1)', textAlign: 'center' }}>
                         <div style={{ fontSize: '0.6rem', color: '#f43f5e', fontWeight: 700 }}>STOP LOSS</div>
                         <div style={{ fontSize: '1rem', fontWeight: 800 }}>${manualSetup.slPrice.toLocaleString()}</div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                        {[manualSetup.tp1Price, manualSetup.tp2Price, manualSetup.tp3Price].map((tp, idx) => (
                           <div key={idx} style={{ padding: '6px', background: 'rgba(14,203,129,0.04)', borderRadius: '8px', border: '1px solid rgba(14,203,129,0.1)', textAlign: 'center' }}>
                              <div style={{ fontSize: '0.5rem', color: '#0ecb81', fontWeight: 800 }}>TP{idx+1}</div>
                              <div style={{ fontSize: '0.7rem', fontWeight: 700 }}>${tp.toLocaleString()}</div>
                           </div>
                        ))}
                      </div>
                      <button onClick={() => setManualSetup(null)} style={{ border: 'none', background: 'none', color: '#5a5e67', fontSize: '0.6rem', cursor: 'pointer', marginTop: '0.5rem' }}>✕ Clear Setup</button>
                   </div>
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
}

function DashboardGroup({ label, children }: { label: string; children: React.ReactNode }) {
   return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderLeft: '1px solid rgba(255,255,255,0.03)', paddingLeft: '1rem' }}>
         <div style={{ fontSize: '0.5rem', color: '#5a5e67', fontWeight: 900, letterSpacing: '1.2px', textTransform: 'uppercase' }}>{label}</div>
         <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            {children}
         </div>
      </div>
   );
}

function DashboardItem({ label, value, color = '#fff', subLabel, description }: { label: string; value: any, color?: string, subLabel?: string, description?: string }) {
   const displayValue = (typeof value === 'number') ? value.toFixed(3) : (value || '--');
   return (
      <div 
        title={description}
        style={{ display: 'flex', flexDirection: 'column', gap: '2px', cursor: description ? 'help' : 'default' }}
      >
         <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 900, color: color, fontFamily: 'monospace' }}>{displayValue}</span>
            <span style={{ fontSize: '0.55rem', color: '#5a5e67', fontWeight: 800 }}>{label}</span>
         </div>
         {subLabel && <div style={{ fontSize: '0.45rem', color: '#3d424d', fontWeight: 700, letterSpacing: '0.5px' }}>{subLabel}</div>}
      </div>
   );
}

function StatBox({ label, value }: { label: string; value: any }) {
  const displayValue = (typeof value === 'number') ? value.toFixed(2) : (value || '--');
  
  // Dynamic color for certain values
  let valueColor = '#fff';
  if (label === 'Trend') {
    if (value === 'Bullish' || value === 'UP') valueColor = '#0ecb81';
    if (value === 'Bearish' || value === 'DOWN') valueColor = '#f6465d';
  } else if (label === 'Whale Act.') {
    if (value === 'High') valueColor = '#fb923c';
  } else if (label === 'RSI') {
    if (value > 70) valueColor = '#f6465d';
    if (value < 30) valueColor = '#0ecb81';
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
      <span style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: '0.6rem', fontWeight: 700, color: valueColor }}>{displayValue}</span>
    </div>
  );
}
