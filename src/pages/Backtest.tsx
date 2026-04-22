import { useState, useRef, useEffect } from 'react';
import { Play } from 'lucide-react';
import SymbolSelector from '../components/SymbolSelector';
import CandleChart from '../components/CandleChart';
import type { CandleChartHandle } from '../components/CandleChart';
import type { Trade, BacktestResult, BacktestConfig, BacktestSummary, CompareResult, OverlayData } from '../utils/backtestUtils';
import { buildMarkersFromTrades, sortTradesDescending, buildCompareRequestBody } from '../utils/backtestUtils';
import MetricsPanel from '../components/MetricsPanel';
import { useStrategyList } from '../hooks/useStrategyList';
import StrategyParamsForm from '../components/StrategyParamsForm';
import { getStrategyParams, getDefaultParams } from '../utils/strategyParams';

export default function Backtest() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [interval, setIntervalTime] = useState('1h');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [strategy, setStrategy] = useState('EMA');
  const [strategyParams, setStrategyParams] = useState<Record<string, number | string>>(getDefaultParams('EMA'));

  function handleStrategyChange(key: string) {
    setStrategy(key);
    const strategyEntry = strategyList.find(s => (s.id || s.key) === key);
    const dynamicDefaults = Object.fromEntries((strategyEntry?.parameters || []).map((p: any) => [p.key, p.default]));
    const staticDefaults = getDefaultParams(key);
    setStrategyParams({ ...staticDefaults, ...dynamicDefaults });
  }
  const [tpMultiplier, setTpMultiplier] = useState(2.0);
  const [slMultiplier, setSlMultiplier] = useState(1.0);
  const [trailMult, setTrailMult] = useState(2.5);
  const [trailActivation, setTrailActivation] = useState(1.0);
  const [gridUpper, setGridUpper] = useState(70000);
  const [gridLower, setGridLower] = useState(50000);
  const [gridQuantity, setGridQuantity] = useState(20);
  const [capital, setCapital] = useState(1000);

  useEffect(() => {
    switch (symbol) {
      case 'BTCUSDT': setGridUpper(75000); setGridLower(55000); break;
      case 'ETHUSDT': setGridUpper(4000); setGridLower(2500); break;
      case 'SOLUSDT': setGridUpper(220); setGridLower(120); break;
      case 'BNBUSDT': setGridUpper(700); setGridLower(500); break;
    }
  }, [symbol]);

  const [leverage, setLeverage] = useState(10);
  const [compareMode, setCompareMode] = useState(false);
  const [compareConfigs, setCompareConfigs] = useState<BacktestConfig[]>([]);
  const [compareResults, setCompareResults] = useState<CompareResult[]>([]);
  const [historyList, setHistoryList] = useState<BacktestSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const { strategyList, warning: strategyWarning } = useStrategyList();

  const [isRunning, setIsRunning] = useState(false);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'charts' | 'log' | 'history' | 'compare'>('charts');

  const [overlayData, setOverlayData] = useState<OverlayData>({});

  // CandleChart ref — all chart operations go through this
  const candleChartRef = useRef<CandleChartHandle>(null);

  // Auto-preview on symbol/interval change
  useEffect(() => {
    if (!isRunning) candleChartRef.current?.loadKlines({ symbol, interval });
  }, [symbol, interval, isRunning]);

  const loadHistory = async () => {
    if (historyLoading) return;
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await fetch('/api/backtest/history');
      if (!res.ok) throw new Error('Failed to load history');
      const data = await res.json();
      setHistoryList(data);
    } catch {
      setHistoryError('Failed to load backtest history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadHistoryItem = async (backtestId: string) => {
    try {
      const res = await fetch(`/api/backtest/history/${backtestId}`);
      if (!res.ok) throw new Error('Failed to load history item');
      const result: BacktestResult = await res.json();
      candleChartRef.current?.setEquityCurve(result.equityCurve);
      candleChartRef.current?.setMarkers(buildMarkersFromTrades(result.trades));
      setBacktestResult(result);
      setOverlayData(result.overlayData ?? {});
      candleChartRef.current?.loadKlines({ symbol, interval });
      setActiveTab('charts');
    } catch {
      setErrorMessage('Failed to load history item');
    }
  };

  const addCurrentConfig = () => {
    if (compareConfigs.length >= 10) return;
    const config: BacktestConfig = {
      symbol,
      strategy,
      interval,
      tpMultiplier,
      slMultiplier,
      leverage,
      capital,
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
    };
    setCompareConfigs(prev => [...prev, config]);
  };

  const handleRunCompare = async () => {
    if (compareConfigs.length === 0) return;
    setIsRunning(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/backtest/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildCompareRequestBody(compareConfigs)),
      });
      const body = await res.json();
      if (!res.ok || body.error) {
        setErrorMessage(body.error || 'Compare failed');
        return;
      }
      setCompareResults(body);
      setActiveTab('compare');
    } catch {
      setErrorMessage('Network error — please check your connection');
    } finally {
      setIsRunning(false);
    }
  };

  const runBacktest = async () => {
    const config: BacktestConfig = {
      symbol,
      strategy,
      interval,
      tpMultiplier,
      slMultiplier,
      trailMult,
      trailActivation,
      leverage,
      capital,
      forceEngine: 'python',
      ...strategyParams,
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
    };

    setBacktestResult(null);
    setErrorMessage(null);
    candleChartRef.current?.clearMarkers();
    candleChartRef.current?.clearEquityCurve();
    setOverlayData({});
    setIsRunning(true);
    setActiveTab('charts');

    try {
      const res = await fetch('/api/backtest/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      const body = await res.json();

      if (!res.ok || body.error) {
        const errMsg: string = body.error || 'Unknown error';
        if (errMsg === 'Strategy AI service unavailable') {
          setErrorMessage('Strategy AI service is not available. Please ensure the strategy-ai service is running.');
        } else {
          setErrorMessage(errMsg);
        }
        return;
      }

      const result: BacktestResult = body;
      candleChartRef.current?.setEquityCurve(result.equityCurve);
      candleChartRef.current?.setMarkers(buildMarkersFromTrades(result.trades));
      setBacktestResult(result);
      setOverlayData(result.overlayData ?? {});
      candleChartRef.current?.loadKlines({ symbol, interval, startDate: config.startDate, endDate: config.endDate });
    } catch (e) {
      console.error(e);
      setErrorMessage('Network error — please check your connection');
    } finally {
      setIsRunning(false);
    }
  };

  const hasResult = backtestResult !== null && backtestResult.totalTrades > 0;
  const sign = (n: number) => (n >= 0 ? '+' : '');

  const netPnlDisplay = hasResult
    ? `${sign(backtestResult!.totalPnl)}${backtestResult!.totalPnl.toFixed(2)} (${sign(backtestResult!.netPnlPct)}${backtestResult!.netPnlPct.toFixed(1)}%)`
    : '--';
  const winRateDisplay = hasResult
    ? `${backtestResult!.winRate.toFixed(1)}% (${backtestResult!.totalTrades}T)`
    : '--';
  const maxDdDisplay = hasResult
    ? `${(backtestResult!.maxDrawdown * 100).toFixed(2)}%`
    : '--';
  const avgWlDisplay = hasResult
    ? `+${backtestResult!.avgWin.toFixed(2)} / -${backtestResult!.avgLoss.toFixed(2)}`
    : '--';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1rem', height: 'calc(100vh - 80px)', overflow: 'hidden' }}>
      {/* Parameter Panel */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 0, overflow: 'hidden', borderRight: '1px solid var(--border-color)' }}>
        <div style={{ padding: '0.8rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 className="m-0" style={{ fontSize: '0.95rem', fontWeight: 700 }}>Strategy Tester</h4>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
        <SymbolSelector value={symbol} onSelect={setSymbol} />
        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Timeframe
          <select value={interval} onChange={e => setIntervalTime(e.target.value)} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.4rem', borderRadius: '4px', marginTop: '0.2rem' }}>
            <option value="1m">1m</option><option value="5m">5m</option><option value="15m">15m</option><option value="1h">1h</option><option value="4h">4h</option><option value="1d">1d</option>
          </select>
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Start
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.3rem', borderRadius: '4px', fontSize: '10px' }} />
          </label>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>End
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.3rem', borderRadius: '4px', fontSize: '10px' }} />
          </label>
        </div>
        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Strategy
          <select value={strategy} onChange={e => handleStrategyChange(e.target.value)} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.4rem', borderRadius: '4px', marginTop: '0.2rem' }}>
            {strategyList.map(s => (
              <option key={s.key} value={s.key}>{s.key}{s.engine === 'python' ? ' [py]' : ''}</option>
            ))}
          </select>
          {strategyWarning && (
            <div style={{ fontSize: '0.7rem', color: '#f6a609', marginTop: '0.2rem' }}>⚠ {strategyWarning}</div>
          )}
        </label>

        {/* Strategy-specific params */}
        {(() => {
          const strategyEntry = strategyList.find(s => (s.id || s.key) === strategy);
          const dynamicParams = strategyEntry?.parameters || [];
          const staticParams = getStrategyParams(strategy);
          const allParams = [...staticParams, ...dynamicParams];

          if (allParams.length === 0) return null;

          return (
            <div style={{ border: '1px solid var(--border-color)', borderRadius: '4px', padding: '0.5rem' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 600 }}>Strategy Params</div>
              <StrategyParamsForm
                params={allParams}
                values={strategyParams}
                onChange={(key, val) => setStrategyParams(p => ({ ...p, [key]: val }))}
                disabled={isRunning}
              />
            </div>
          );
        })()}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>TP (ATR×)
            <input type="number" step="0.1" value={tpMultiplier} onChange={e => setTpMultiplier(parseFloat(e.target.value))} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.3rem' }} />
          </label>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SL (ATR×)
            <input type="number" step="0.1" value={slMultiplier} onChange={e => setSlMultiplier(parseFloat(e.target.value))} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.3rem' }} />
          </label>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }} title="Trailing stop distance (ATR×) — larger = wider trail">Trail (ATR×)
            <input type="number" step="0.5" min="0.5" value={trailMult} onChange={e => setTrailMult(parseFloat(e.target.value))} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.3rem' }} />
          </label>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }} title="Profit required before trailing activates (ATR×)">Activate (ATR×)
            <input type="number" step="0.5" min="0" value={trailActivation} onChange={e => setTrailActivation(parseFloat(e.target.value))} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.3rem' }} />
          </label>
        </div>
        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Leverage
          <input type="number" min="1" max="125" value={leverage} onChange={e => setLeverage(parseFloat(e.target.value))} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.4rem', marginTop: '0.2rem' }} />
        </label>
        {/* Compare Mode Toggle */}
        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={compareMode} onChange={e => setCompareMode(e.target.checked)} />
          Compare Mode
        </label>
        {/* Compare Mode Controls */}
        {compareMode && (
          <div style={{ border: '1px solid var(--border-color)', padding: '0.5rem', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <button
              onClick={addCurrentConfig}
              disabled={compareConfigs.length >= 10}
              style={{ background: 'var(--bg-dark)', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '0.4rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
            >
              + Add Current Config ({compareConfigs.length}/10)
            </button>
            {compareConfigs.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', maxHeight: '150px', overflowY: 'auto' }}>
                {compareConfigs.map((cfg, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', padding: '0.2rem 0.4rem', borderRadius: '3px' }}>
                    <span>{cfg.strategy}-{cfg.interval}-{cfg.tpMultiplier}/{cfg.slMultiplier}</span>
                    <button
                      onClick={() => setCompareConfigs(prev => prev.filter((_, i) => i !== idx))}
                      style={{ background: 'transparent', border: 'none', color: 'var(--loss-color)', cursor: 'pointer', fontSize: '0.8rem', padding: '0 0.2rem' }}
                    >✕</button>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={handleRunCompare}
              disabled={isRunning || compareConfigs.length === 0}
              style={{ background: compareConfigs.length > 0 ? 'var(--accent-primary)' : 'var(--bg-dark)', color: '#fff', border: 'none', padding: '0.5rem', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}
            >
              {isRunning ? 'Running...' : '⚡ Run Comparison'}
            </button>
          </div>
        )}
        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Capital
          <input type="number" value={capital} onChange={e => setCapital(parseFloat(e.target.value))} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.4rem', marginTop: '0.2rem', borderRadius: '4px' }} />
        </label>
        </div>

        {/* Footer Action */}
        <div style={{ padding: '0.8rem', borderTop: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)' }}>
          <button 
            onClick={runBacktest} 
            disabled={isRunning} 
            style={{ 
              width: '100%',
              background: 'var(--accent-primary)', 
              color: '#fff', 
              border: 'none', 
              padding: '0.8rem', 
              borderRadius: '6px', 
              fontWeight: 'bold', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 12px rgba(0,122,255,0.3)'
            }}
          >
            {isRunning ? 'Running...' : <><Play size={14} fill="white" /> Start Backtest</>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', paddingRight: '0.25rem' }}>
        {/* Header & Stats bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center' }}>
            {[
              { label: 'Net PnL', value: netPnlDisplay, color: hasResult && backtestResult!.totalPnl >= 0 ? 'var(--profit-color)' : 'var(--loss-color)' },
              { label: 'Win Rate', value: winRateDisplay, color: '#fff' },
              { label: 'Max DD', value: maxDdDisplay, color: 'var(--loss-color)' },
              { label: 'P. Factor', value: hasResult ? backtestResult!.profitFactor.toFixed(2) : '--', color: '#fff' },
              { label: 'Sharpe', value: hasResult ? backtestResult!.sharpeRatio.toFixed(2) : '--', color: '#fff' },
              { label: 'Avg W/L', value: avgWlDisplay, color: '#fff' },
              { label: 'Streak Win/L', value: hasResult ? `${backtestResult!.maxConsecutiveWins}/${backtestResult!.maxConsecutiveLosses}` : '--', color: '#fff' },
            ].map((stat, i) => (
              <div key={i} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', padding: '0.4rem 0.85rem', minWidth: '85px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: stat.color }}>{stat.value}</span>
              </div>
            ))}
          </div>
          <div className="glass-panel" style={{ padding: '0.4rem 0.85rem', border: '1px solid rgba(255,255,255,0.06)' }}>
            <MetricsPanel trades={backtestResult?.trades ?? []} avgWin={backtestResult?.avgWin ?? 0} avgLoss={backtestResult?.avgLoss ?? 0} />
          </div>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div style={{ background: 'rgba(246,70,93,0.15)', border: '1px solid var(--loss-color)', borderRadius: '4px', padding: '0.6rem 1rem', color: 'var(--loss-color)', fontSize: '0.85rem' }}>
            {errorMessage}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '0.25rem' }}>
          {[
            { id: 'charts', label: 'Charts' },
            { id: 'log', label: `Trade Log (${backtestResult?.trades.length ?? 0})` },
            { id: 'history', label: 'History' },
            { id: 'compare', label: 'Compare' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id as any); if (tab.id === 'history') loadHistory(); }}
              style={{
                flex: 1,
                background: activeTab === tab.id ? 'rgba(0,122,255,0.1)' : 'transparent',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: activeTab === tab.id ? 600 : 400,
                padding: '0.5rem 1rem',
                color: activeTab === tab.id ? 'var(--accent-primary)' : 'var(--text-muted)',
                transition: 'all 0.2s',
                fontSize: '0.82rem'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Charts Tab */}
        {activeTab === 'charts' && (
          <div className="glass-panel" style={{ padding: '1rem' }}>
            <CandleChart ref={candleChartRef} symbol={symbol} interval={interval} trades={backtestResult?.trades ?? []} overlayData={overlayData} equityCurve={backtestResult?.equityCurve} height="calc(100vh - 340px)" />
          </div>
        )}

        {/* Trade Log */}
        <div className="glass-panel" style={{ display: activeTab === 'log' ? 'block' : 'none' }}>
          <div style={{ overflow: 'auto', height: 'calc(100vh - 280px)' }}>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 10 }}>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.5rem' }}>Entry Time</th>
                  <th>Exit Time</th>
                  <th>Type</th>
                  <th>Entry $</th>
                  <th>Exit $</th>
                  <th style={{ textAlign: 'right' }}>Size (w/ Lev)</th>
                  <th>Entry Reason</th>
                  <th style={{ textAlign: 'right' }}>Confidence</th>
                  <th style={{ textAlign: 'right' }}>PnL</th>
                  <th style={{ textAlign: 'right' }}>PnL%</th>
                  <th style={{ textAlign: 'right' }}>Exit Reason</th>
                </tr>
              </thead>
              <tbody>
                {backtestResult && backtestResult.trades.length > 0 ? sortTradesDescending(backtestResult.trades).map((trade: Trade, i: number) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.5rem' }}>{trade.entryTime}</td>
                    <td>{trade.exitTime}</td>
                    <td style={{ color: trade.type === 'LONG' ? 'var(--profit-color)' : 'var(--loss-color)', fontWeight: 'bold' }}>{trade.type}</td>
                    <td>${trade.entryPrice.toFixed(2)}</td>
                    <td>${trade.exitPrice.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{trade.positionSize != null ? `${trade.positionSize.toFixed(0)}` : '—'}</td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '200px' }}>{trade.entryReason ?? '—'}</td>
                    <td style={{ textAlign: 'right', fontSize: '0.8rem', color: trade.entryConfidence != null ? (trade.entryConfidence >= 0.7 ? 'var(--profit-color)' : trade.entryConfidence >= 0.5 ? '#f6a609' : 'var(--loss-color)') : 'var(--text-muted)' }}>
                      {trade.entryConfidence != null ? `${(trade.entryConfidence * 100).toFixed(0)}%` : '—'}
                    </td>
                    <td style={{ textAlign: 'right', color: trade.pnl >= 0 ? 'var(--profit-color)' : 'var(--loss-color)', fontWeight: 'bold' }}>
                      {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'right', color: trade.pnlPct >= 0 ? 'var(--profit-color)' : 'var(--loss-color)' }}>
                      {trade.pnlPct >= 0 ? '+' : ''}{trade.pnlPct.toFixed(2)}%
                    </td>
                    <td style={{ textAlign: 'right' }}>{trade.exitReason}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={11} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Run backtest to see trade log.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* History */}
        {activeTab === 'history' && (
          <div className="glass-panel" style={{ overflow: 'auto', height: 'calc(100vh - 280px)' }}>
            {historyLoading && (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Loading history...</div>
            )}
            {historyError && !historyLoading && (
              <div style={{ background: 'rgba(246,70,93,0.15)', border: '1px solid var(--loss-color)', borderRadius: '4px', padding: '0.6rem 1rem', color: 'var(--loss-color)', fontSize: '0.85rem', margin: '1rem' }}>
                {historyError}
              </div>
            )}
            {!historyLoading && !historyError && historyList.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No backtest history yet.</div>
            )}
            {!historyLoading && !historyError && historyList.length > 0 && (
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 10 }}>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.5rem' }}>Symbol</th>
                    <th>Strategy</th>
                    <th>Interval</th>
                    <th style={{ textAlign: 'right' }}>PnL</th>
                    <th style={{ textAlign: 'right' }}>Win Rate</th>
                    <th style={{ textAlign: 'right' }}>Trades</th>
                    <th style={{ textAlign: 'right' }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {historyList.map((item) => (
                    <tr
                      key={item.backtestId}
                      onClick={() => loadHistoryItem(item.backtestId)}
                      style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '0.5rem' }}>{item.symbol}</td>
                      <td>{item.strategy}</td>
                      <td>{item.interval}</td>
                      <td style={{ textAlign: 'right', color: item.totalPnl >= 0 ? 'var(--profit-color)' : 'var(--loss-color)', fontWeight: 'bold' }}>
                        {item.totalPnl >= 0 ? '+' : ''}${item.totalPnl.toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'right' }}>{item.winRate.toFixed(1)}%</td>
                      <td style={{ textAlign: 'right' }}>{item.totalTrades}</td>
                      <td style={{ textAlign: 'right' }}>{item.createdAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Compare */}
        {activeTab === 'compare' && (
          <div className="glass-panel" style={{ overflow: 'auto', height: 'calc(100vh - 280px)' }}>
            {compareResults.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No comparison results yet.</div>
            ) : (
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 10 }}>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.5rem' }}>Rank</th>
                    <th>Config</th>
                    <th style={{ textAlign: 'right' }}>PnL</th>
                    <th style={{ textAlign: 'right' }}>Win Rate</th>
                    <th style={{ textAlign: 'right' }}>Sharpe</th>
                    <th style={{ textAlign: 'right' }}>Max DD</th>
                    <th style={{ textAlign: 'right' }}>P.Factor</th>
                    <th style={{ textAlign: 'right' }}>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {[...compareResults].sort((a, b) => a.rank - b.rank).map((result) => (
                    <tr key={result.rank} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>#{result.rank}</td>
                      <td>{result.configLabel}</td>
                      <td style={{ textAlign: 'right', color: result.error ? 'var(--text-muted)' : result.totalPnl >= 0 ? 'var(--profit-color)' : 'var(--loss-color)', fontWeight: 'bold' }}>
                        {result.error ? '--' : `${result.totalPnl >= 0 ? '+' : ''}${result.totalPnl.toFixed(2)}`}
                      </td>
                      <td style={{ textAlign: 'right' }}>{result.error ? '--' : `${result.winRate.toFixed(1)}%`}</td>
                      <td style={{ textAlign: 'right' }}>{result.error ? '--' : result.sharpeRatio.toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>{result.error ? '--' : `${(result.maxDrawdown * 100).toFixed(2)}%`}</td>
                      <td style={{ textAlign: 'right' }}>{result.error ? '--' : result.profitFactor.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--loss-color)', fontSize: '0.75rem' }}>{result.error ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
