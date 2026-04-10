import { useState, useRef, useEffect, useCallback } from 'react';
import { createChart, ColorType, LineSeries, CandlestickSeries, createSeriesMarkers } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, Time, SeriesMarker, ISeriesMarkersPluginApi } from 'lightweight-charts';
import SymbolSelector from '../components/SymbolSelector';
import type { Trade, BacktestResult, BacktestConfig, BacktestSummary, CompareResult } from '../utils/backtestUtils';
import { convertEquityCurve, buildMarkersFromTrades, sortTradesDescending, buildCompareRequestBody } from '../utils/backtestUtils';


/**
 * Returns true if the Leverage input should be visible for the given strategy.
 * Leverage is hidden only for GRID strategy.
 */
export function isLeverageVisible(strategy: string): boolean {
  return strategy !== 'GRID';
}

export default function Backtest() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [interval, setIntervalTime] = useState('1h');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [strategy, setStrategy] = useState('EMA');
  const [tpPercent, setTpPercent] = useState(2.0);
  const [slPercent, setSlPercent] = useState(1.0);
  const [gridUpper, setGridUpper] = useState(70000);
  const [gridLower, setGridLower] = useState(50000);
  const [gridQuantity, setGridQuantity] = useState(20);
  const [capital, setCapital] = useState(10000);

  useEffect(() => {
    switch (symbol) {
      case 'BTCUSDT': setGridUpper(75000); setGridLower(55000); break;
      case 'ETHUSDT': setGridUpper(4000); setGridLower(2500); break;
      case 'SOLUSDT': setGridUpper(220); setGridLower(120); break;
      case 'BNBUSDT': setGridUpper(700); setGridLower(500); break;
    }
  }, [symbol]);

  const [leverage, setLeverage] = useState(10);
  const [isPythonMode, setIsPythonMode] = useState(false);
  const [pythonStrategyName, setPythonStrategyName] = useState('');
  const [compareMode, setCompareMode] = useState(false);
  const [compareConfigs, setCompareConfigs] = useState<BacktestConfig[]>([]);
  const [compareResults, setCompareResults] = useState<CompareResult[]>([]);
  const [historyList, setHistoryList] = useState<BacktestSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [isRunning, setIsRunning] = useState(false);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'charts' | 'log' | 'history' | 'compare'>('charts');
  const [showMarkers, setShowMarkers] = useState(true);
  const [storedMarkers, setStoredMarkers] = useState<SeriesMarker<Time>[]>([]);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const equitySeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  const candleChartContainerRef = useRef<HTMLDivElement>(null);
  const candleChartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  // The official markers plugin instance
  const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);

  // Apply or remove markers using the plugin
  const applyMarkers = useCallback((markers: SeriesMarker<Time>[], visible: boolean) => {
    if (!candleSeriesRef.current) return;
    if (markersPluginRef.current) {
      markersPluginRef.current.setMarkers(visible ? markers : []);
    } else if (visible && markers.length > 0) {
      markersPluginRef.current = createSeriesMarkers(candleSeriesRef.current, markers);
    }
  }, []);

  useEffect(() => {
    applyMarkers(storedMarkers, showMarkers);
  }, [showMarkers, storedMarkers, applyMarkers]);

  useEffect(() => {
    if (!chartContainerRef.current) return;
    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#848e9c' },
      grid: { vertLines: { color: '#2b313f' }, horzLines: { color: '#2b313f' } },
      timeScale: { timeVisible: true, secondsVisible: false },
      localization: {
        locale: 'th-TH',
        timeFormatter: (time: number) => {
          return new Date(time * 1000).toLocaleString('th-TH', {
            hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Bangkok'
          });
        },
      },
      rightPriceScale: { autoScale: true },
      autoSize: true,
    });
    chartRef.current = chart;
    equitySeriesRef.current = chart.addSeries(LineSeries, { color: '#0ecb81', lineWidth: 2 });

    if (candleChartContainerRef.current) {
      const cChart = createChart(candleChartContainerRef.current, {
        layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#848e9c' },
        grid: { vertLines: { color: '#2b313f' }, horzLines: { color: '#2b313f' } },
        timeScale: { timeVisible: true, secondsVisible: false },
        localization: {
          locale: 'th-TH',
          timeFormatter: (time: number) => {
            return new Date(time * 1000).toLocaleString('th-TH', {
              hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Bangkok'
            });
          },
        },
        rightPriceScale: { autoScale: true },
        autoSize: true,
      });
      candleChartRef.current = cChart;
      candleSeriesRef.current = cChart.addSeries(CandlestickSeries, {
        upColor: '#0ecb81', downColor: '#f6465d', borderVisible: false, wickUpColor: '#0ecb81', wickDownColor: '#f6465d'
      });

      let isCrossUpdating = false;
      const syncByTime = (chart1: IChartApi, chart2: IChartApi) => {
        chart1.timeScale().subscribeVisibleTimeRangeChange((range) => {
          if (isCrossUpdating || !range) return;
          isCrossUpdating = true;
          try { chart2.timeScale().setVisibleRange(range); } catch { /* ignore if target has no data */ }
          isCrossUpdating = false;
        });
      };
      syncByTime(chart, cChart);
      syncByTime(cChart, chart);
    }

    return () => { chart.remove(); candleChartRef.current?.remove(); markersPluginRef.current = null; };
  }, []);

  // Auto-preview on symbol/interval change
  useEffect(() => {
    const fetchPreview = async () => {
      try {
        const res = await fetch(`/api/backtest?symbol=${symbol}&interval=${interval}&limit=1000`);
        const data = await res.json();
        if (!Array.isArray(data)) return;

        const TZ_OFFSET = 7 * 3600;
        const cdata = data.map((d: any) => ({
          time: (Math.floor(d[0] / 1000) + TZ_OFFSET) as Time,
          open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4])
        }));

        candleSeriesRef.current?.setData(cdata);
        candleChartRef.current?.timeScale().fitContent();
        candleChartRef.current?.priceScale('right').applyOptions({ autoScale: true });
      } catch (err) { console.error('Preview error:', err); }
    };

    if (candleSeriesRef.current && !isRunning) {
      fetchPreview();
    }
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
    } catch (e) {
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
      equitySeriesRef.current?.setData(convertEquityCurve(result.equityCurve));
      const markers = buildMarkersFromTrades(result.trades);
      setStoredMarkers(markers);
      setBacktestResult(result);
      setActiveTab('charts');
    } catch (e) {
      setErrorMessage('Failed to load history item');
    }
  };

  const addCurrentConfig = () => {
    if (compareConfigs.length >= 10) return;
    const config: BacktestConfig = {
      symbol,
      strategy: isPythonMode ? `PYTHON:${pythonStrategyName}` : strategy,
      interval,
      tpPercent,
      slPercent,
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
    } catch (e) {
      setErrorMessage('Network error — please check your connection');
    } finally {
      setIsRunning(false);
    }
  };

  const runBacktest = async () => {
    const config: BacktestConfig = {
      symbol,
      strategy: isPythonMode ? ('PYTHON:' + pythonStrategyName) : strategy,
      interval,
      tpPercent,
      slPercent,
      leverage,
      capital,
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
    };

    // Clear previous state before fetch
    setBacktestResult(null);
    setErrorMessage(null);
    markersPluginRef.current?.setMarkers([]);
    setStoredMarkers([]);
    equitySeriesRef.current?.setData([]);

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
      equitySeriesRef.current?.setData(convertEquityCurve(result.equityCurve));
      const markers = buildMarkersFromTrades(result.trades);
      setStoredMarkers(markers);
      setBacktestResult(result);
    } catch (e) {
      console.error(e);
      setErrorMessage('Network error — please check your connection');
    } finally {
      setIsRunning(false);
    }
  };

  // Metrics display helpers — show '--' when no result or totalTrades === 0
  const hasResult = backtestResult !== null && backtestResult.totalTrades > 0;
  const sign = (n: number) => (n >= 0 ? '+' : '');

  const netPnlDisplay = hasResult
    ? `${sign(backtestResult!.totalPnl)}$${backtestResult!.totalPnl.toFixed(2)} (${sign(backtestResult!.netPnlPct)}${backtestResult!.netPnlPct.toFixed(1)}%)`
    : '--';
  const winRateDisplay = hasResult
    ? `${backtestResult!.winRate.toFixed(1)}% (${backtestResult!.totalTrades}T)`
    : '--';
  const maxDdDisplay = hasResult
    ? `${(backtestResult!.maxDrawdown * 100).toFixed(2)}%`
    : '--';
  const avgWlDisplay = hasResult
    ? `+$${backtestResult!.avgWin.toFixed(2)} / -$${backtestResult!.avgLoss.toFixed(2)}`
    : '--';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1rem', height: 'calc(100vh - 80px)', overflow: 'hidden' }}>
      {/* Parameter Panel */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', overflowY: 'auto', padding: '1rem' }}>
        <h4 className="m-0" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', fontSize: '1rem' }}>Strategy Tester</h4>
        <SymbolSelector value={symbol} onSelect={setSymbol} />
        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Timeframe
          <select value={interval} onChange={e => setIntervalTime(e.target.value)} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.4rem', borderRadius: '4px', marginTop: '0.2rem' }}>
            <option value="5m">5m</option><option value="15m">15m</option><option value="1h">1h</option><option value="4h">4h</option><option value="1d">1d</option>
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
          <select value={strategy} onChange={e => setStrategy(e.target.value)} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.4rem', borderRadius: '4px', marginTop: '0.2rem' }}>
            <option value="EMA">EMA Crossover</option>
            <option value="RSI">RSI Overbought/Oversold</option>
            <option value="BB">BB Mean Reversion</option>
            <option value="EMA_RSI">EMA + RSI</option>
            <option value="BB_RSI">BB + RSI</option>
            <option value="EMA_BB_RSI">EMA + BB + RSI</option>
            <option value="GRID">Grid Bot</option>
            <option value="AI_SCOUTER">AI Scouter</option>
            <option value="EMA_SCALP">EMA Scalp</option>
            <option value="STOCH_RSI">Stochastic RSI</option>
            <option value="VWAP_SCALP">VWAP Scalp</option>
          </select>
        </label>
        {strategy === 'GRID' ? (
          <div style={{ border: '1px solid var(--border-color)', padding: '0.5rem', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Upper
              <input type="number" value={gridUpper} onChange={e => setGridUpper(parseFloat(e.target.value))} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.3rem' }} />
            </label>
            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Lower
              <input type="number" value={gridLower} onChange={e => setGridLower(parseFloat(e.target.value))} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.3rem' }} />
            </label>
            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Grids
              <input type="number" value={gridQuantity} onChange={e => setGridQuantity(parseInt(e.target.value))} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.3rem' }} />
            </label>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>TP%
                <input type="number" step="0.5" value={tpPercent} onChange={e => setTpPercent(parseFloat(e.target.value))} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.3rem' }} />
              </label>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SL%
                <input type="number" step="0.5" value={slPercent} onChange={e => setSlPercent(parseFloat(e.target.value))} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.3rem' }} />
              </label>
            </div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Leverage
              <input type="number" min="1" max="125" value={leverage} onChange={e => setLeverage(parseFloat(e.target.value))} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.4rem', marginTop: '0.2rem' }} />
            </label>
          </>
        )}
        {/* Python Strategy Section */}
        <div style={{ border: '1px solid var(--border-color)', padding: '0.5rem', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={isPythonMode} onChange={e => setIsPythonMode(e.target.checked)} />
            Enable Python Strategy
          </label>
          {isPythonMode && (
            <>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Strategy Name
                <select value={pythonStrategyName} onChange={e => setPythonStrategyName(e.target.value)} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.3rem', marginTop: '0.2rem', borderRadius: '4px' }}>
                  <option value="">-- select --</option>
                  <option value="bb_breakout">bollinger_breakout</option>
                </select>
              </label>
              <div style={{ fontSize: '0.7rem', color: '#f6a609' }}>⚠ Requires strategy-ai service</div>
            </>
          )}
        </div>
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
                    <span>{cfg.strategy}-{cfg.interval}-{cfg.tpPercent}/{cfg.slPercent}</span>
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
          <input type="number" value={capital} onChange={e => setCapital(parseFloat(e.target.value))} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.4rem', marginTop: '0.2rem' }} />
        </label>
        <button onClick={runBacktest} disabled={isRunning} style={{ background: 'var(--accent-primary)', color: '#fff', border: 'none', padding: '0.7rem', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', marginTop: '0.5rem' }}>
          {isRunning ? 'Running...' : '▶ Start Backtest'}
        </button>
      </div>

      {/* Main Content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', paddingRight: '0.25rem' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.6rem' }}>
          {[
            { label: 'Net PnL', value: netPnlDisplay, color: hasResult && backtestResult!.totalPnl >= 0 ? 'var(--profit-color)' : 'var(--loss-color)' },
            { label: 'Win Rate', value: winRateDisplay, color: '#fff' },
            { label: 'Max DD', value: maxDdDisplay, color: 'var(--loss-color)' },
            { label: 'P. Factor', value: hasResult ? backtestResult!.profitFactor.toFixed(2) : '--', color: '#fff' },
            { label: 'Sharpe', value: hasResult ? backtestResult!.sharpeRatio.toFixed(2) : '--', color: '#fff' },
            { label: 'Avg W/L', value: avgWlDisplay, color: '#fff' },
            { label: 'Max Cons. Loss', value: hasResult ? String(backtestResult!.maxConsecutiveLosses) : '--', color: '#fff' },
          ].map((stat, i) => (
            <div key={i} className="glass-panel" style={{ padding: '0.6rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>{stat.label}</div>
              <div style={{ fontSize: '1rem', fontWeight: 'bold', color: stat.color }}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Error message */}
        {errorMessage && (
          <div style={{ background: 'rgba(246,70,93,0.15)', border: '1px solid var(--loss-color)', borderRadius: '4px', padding: '0.6rem 1rem', color: 'var(--loss-color)', fontSize: '0.85rem' }}>
            {errorMessage}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
          <button onClick={() => setActiveTab('charts')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 'bold', padding: '0.5rem', color: activeTab === 'charts' ? 'var(--text-main)' : 'var(--text-muted)', borderBottom: activeTab === 'charts' ? '2px solid var(--accent-primary)' : 'none' }}>Charts</button>
          <button onClick={() => setActiveTab('log')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 'bold', padding: '0.5rem', color: activeTab === 'log' ? 'var(--text-main)' : 'var(--text-muted)', borderBottom: activeTab === 'log' ? '2px solid var(--accent-primary)' : 'none' }}>
            Trade Log ({backtestResult?.trades.length ?? 0})
          </button>
          <button onClick={() => { setActiveTab('history'); loadHistory(); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 'bold', padding: '0.5rem', color: activeTab === 'history' ? 'var(--text-main)' : 'var(--text-muted)', borderBottom: activeTab === 'history' ? '2px solid var(--accent-primary)' : 'none' }}>History</button>
          <button onClick={() => setActiveTab('compare')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 'bold', padding: '0.5rem', color: activeTab === 'compare' ? 'var(--text-main)' : 'var(--text-muted)', borderBottom: activeTab === 'compare' ? '2px solid var(--accent-primary)' : 'none' }}>Compare</button>
        </div>

        {/* Charts */}
        <div style={{ display: activeTab === 'charts' ? 'flex' : 'none', flexDirection: 'column', gap: '1rem', position: 'relative' }}>
          <div className="glass-panel" style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h5 className="m-0">Market</h5>
              <button onClick={() => setShowMarkers(v => !v)} style={{ background: showMarkers ? 'var(--accent-primary)' : 'transparent', color: showMarkers ? '#fff' : 'var(--text-main)', border: '1px solid #444', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer' }}>
                {showMarkers ? 'Hide Markers' : 'Show Markers'}
              </button>
            </div>
            <div style={{ height: '320px', border: '1px solid var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
              <div ref={candleChartContainerRef} style={{ width: '100%', height: '100%' }} />
            </div>
          </div>
          <div className="glass-panel" style={{ padding: '1rem' }}>
            <h5 className="m-0" style={{ marginBottom: '0.5rem' }}>Portfolio Equity Curve</h5>
            <div style={{ height: '180px', border: '1px solid var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
              <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />
            </div>
          </div>
        </div>

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
                  <tr><td colSpan={10} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Run backtest to see trade log.</td></tr>
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
                        {result.error ? '--' : `${result.totalPnl >= 0 ? '+' : ''}$${result.totalPnl.toFixed(2)}`}
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
