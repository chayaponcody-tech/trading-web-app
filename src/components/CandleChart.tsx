/**
 * CandleChart — shared candle chart component used by both
 * /backtest and /strategy-management pages.
 *
 * Features: markers, TP/SL/Entry lines, trade info panel,
 * click-to-select trade, auto-scroll, overlay indicators,
 * RSI sub-panel, equity curve, replay controls, drawing tools.
 */
import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
  createChart, ColorType, LineSeries, CandlestickSeries, createSeriesMarkers, HistogramSeries,
} from 'lightweight-charts';
import type {
  IChartApi, ISeriesApi, Time, SeriesMarker, ISeriesMarkersPluginApi,
} from 'lightweight-charts';
import { CANDLE_CHART_OPTIONS, CANDLESTICK_SERIES_OPTIONS } from '../utils/chartConfig';
import OverlayRenderer, { OverlayToggleControls } from './OverlayRenderer';
import ReplayControls from './ReplayControls';
import DrawingTools from './DrawingTools';
import IndicatorPanel from './IndicatorPanel';
import type { Trade, OverlayData, OverlayToggleState, EquityCurvePoint } from '../utils/backtestUtils';
import { convertEquityCurve } from '../utils/backtestUtils';

const TZ_OFFSET = 7 * 3600;

const INTERVAL_MS: Record<string, number> = {
  '1m': 60000, '3m': 180000, '5m': 300000, '15m': 900000,
  '30m': 1800000, '1h': 3600000, '2h': 7200000, '4h': 14400000,
  '6h': 21600000, '8h': 28800000, '12h': 43200000, '1d': 86400000,
};

export interface CandleChartHandle {
  /** Load kline data from API and render */
  loadKlines(params: { symbol: string; interval: string; startDate?: string; endDate?: string }): Promise<void>;
  /** Set candle data directly (already fetched) */
  setCandles(cdata: { time: Time; open: number; high: number; low: number; close: number }[]): void;
  /** Set trade markers */
  setMarkers(markers: SeriesMarker<Time>[], visible?: boolean): void;
  /** Clear all markers */
  clearMarkers(): void;
  /** Set equity curve data */
  setEquityCurve(curve: EquityCurvePoint[]): void;
  /** Clear equity curve */
  clearEquityCurve(): void;
  /** Expose chart instance for external sync */
  getChart(): IChartApi | null;
  getCandleSeries(): ISeriesApi<'Candlestick'> | null;
  /** Toggle visibility of specific overlay layers */
  toggleOverlay(key: keyof OverlayToggleState): void;
}

export interface CandleChartProps {
  symbol?: string;
  interval?: string;
  /** Fetch klines automatically on mount/change when true */
  autoFetch?: boolean;
  startDate?: string;
  endDate?: string;
  trades?: Trade[];
  overlayData?: OverlayData;
  equityCurve?: EquityCurvePoint[];
  showMarkers?: boolean;
  height?: number | string;
  /** Derive kline range from trade times instead of startDate/endDate */
  autoRangeFromTrades?: boolean;
  onTradeSelect?: (trade: Trade | null) => void;
  onDataLoaded?: (data: any[]) => void;
  /** Manually provided trade setup to draw levels on chart (useful for live analysis) */
  manualTrade?: Trade | null;
  strategyId?: string;
  initialToggles?: Partial<OverlayToggleState>;
}

function toChartTime(iso: string): Time {
  return (Math.floor(new Date(iso).getTime() / 1000) + TZ_OFFSET) as Time;
}

function snapToBarArr(barTimesArr: number[], t: number): number {
  if (!barTimesArr.length) return t;
  let lo = 0, hi = barTimesArr.length - 1;
  if (barTimesArr[lo] === t) return t;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (barTimesArr[mid] <= t) lo = mid; else hi = mid;
  }
  return Math.abs(barTimesArr[lo] - t) <= Math.abs(barTimesArr[hi] - t)
    ? barTimesArr[lo] : barTimesArr[hi];
}

// ── Equity mini chart (self-contained, mounts fresh each time) ────────────────
function EquityMiniChart({ data }: { data: EquityCurvePoint[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || data.length === 0) return;
    const chart = createChart(ref.current, {
      ...CANDLE_CHART_OPTIONS,
      height: 180,
    });
    const series = chart.addSeries(LineSeries, { color: '#0ecb81', lineWidth: 2 });
    series.setData(convertEquityCurve(data));
    chart.timeScale().fitContent();
    chart.timeScale().applyOptions({ rightOffset: 12 });
    return () => { chart.remove(); };
  }, [data]);
  return <div ref={ref} style={{ width: '100%', height: '100%' }} />;
}

const CandleChart = forwardRef<CandleChartHandle, CandleChartProps>(function CandleChart(
  {
    symbol = 'BTCUSDT',
    interval = '1h',
    autoFetch = false,
    startDate,
    endDate,
    trades = [],
    overlayData = {},
    equityCurve,
    showMarkers = true,
    height = '100%',
    autoRangeFromTrades = false,
    onTradeSelect,
    onDataLoaded,
    manualTrade,
    strategyId,
    initialToggles,
  },
  ref,
) {
  // ── Refs ────────────────────────────────────────────────────────────────────
  const candleContainerRef  = useRef<HTMLDivElement>(null);
  const rsiContainerRef     = useRef<HTMLDivElement>(null);

  const candleChartRef  = useRef<IChartApi | null>(null);
  const rsiChartRef     = useRef<IChartApi | null>(null);

  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastParamsRef = useRef({ symbol: '', interval: '' });

  const [allCandles, setAllCandles] = useState<{ time: Time; open: number; high: number; low: number; close: number; volume?: number }[]>([]);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [hoveredCandle, setHoveredCandle] = useState<{ time: Time; open: number; high: number; low: number; close: number; volume?: number } | null>(null);

  // Always show last trade by default
  useEffect(() => {
    if (trades.length > 0) setSelectedTrade(trades[trades.length - 1]);
    else setSelectedTrade(null);
  }, [trades]);

  const [toggleStates, setToggleStates] = useState<OverlayToggleState>({ 
    ema20: true, ema50: true, bb: true, rsi: true, levels: true, zones: false,
    ...initialToggles
  });
  const [showMarkersState, setShowMarkersState] = useState(showMarkers);
  const [storedMarkers, setStoredMarkers] = useState<SeriesMarker<Time>[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // ── Init charts ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!candleContainerRef.current) return;

    // Candle chart
    const cChart = createChart(candleContainerRef.current, CANDLE_CHART_OPTIONS);
    candleChartRef.current = cChart;
    candleSeriesRef.current = cChart.addSeries(CandlestickSeries, CANDLESTICK_SERIES_OPTIONS);

    // Volume overlay — separate price scale, scaled to bottom 20% of chart
    volumeSeriesRef.current = cChart.addSeries(HistogramSeries, {
      priceScaleId: 'volume',
      color: 'rgba(14,203,129,0.4)',
    });
    cChart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
      visible: false,
    });

    // RSI chart
    let rChart: IChartApi | null = null;
    if (rsiContainerRef.current) {
      rChart = createChart(rsiContainerRef.current, {
        layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#848e9c' },
        grid: { vertLines: { color: '#2b313f' }, horzLines: { color: '#2b313f' } },
        timeScale: { timeVisible: true, secondsVisible: false, rightOffset: 12 },
        rightPriceScale: { autoScale: true },
        autoSize: true,
        handleScroll: CANDLE_CHART_OPTIONS.handleScroll,
        handleScale: CANDLE_CHART_OPTIONS.handleScale,
      });
      rsiChartRef.current = rChart;
    }

    // Sync time scales
    let syncing = false;
    const syncCharts = [cChart, rChart].filter(Boolean) as IChartApi[];
    syncCharts.forEach(src => {
      src.timeScale().subscribeVisibleTimeRangeChange(range => {
        if (syncing || !range) return;
        syncing = true;
        syncCharts.forEach(dst => {
          if (dst !== src) { try { dst.timeScale().setVisibleRange(range); } catch { /* ignore */ } }
        });
        syncing = false;
      });
    });

    return () => {
      cChart.remove(); candleChartRef.current = null; candleSeriesRef.current = null; volumeSeriesRef.current = null;
      rChart?.remove(); rsiChartRef.current = null;
      markersPluginRef.current = null;
    };
  }, []);

  // ── INIT RESIZE OBSERVER ──────────────────────────────────────────────────
  useEffect(() => {
    if (!candleContainerRef.current || !candleChartRef.current) return;
    const container = candleContainerRef.current;
    
    const observer = new ResizeObserver(entries => {
      if (!entries || entries.length === 0 || !candleChartRef.current) return;
      const { width, height } = entries[0].contentRect;
      candleChartRef.current.applyOptions({ width, height });
    });
    
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // ── Markers ─────────────────────────────────────────────────────────────────
  const applyMarkers = useCallback((markers: SeriesMarker<Time>[], visible: boolean) => {
    if (!candleSeriesRef.current) return;
    if (markersPluginRef.current) {
      markersPluginRef.current.setMarkers(visible ? markers : []);
    } else if (visible && markers.length > 0) {
      markersPluginRef.current = createSeriesMarkers(candleSeriesRef.current, markers);
    }
  }, []);

  useEffect(() => {
    applyMarkers(storedMarkers, showMarkersState);
  }, [showMarkersState, storedMarkers, applyMarkers]);

  // ── Crosshair hover → show nearest trade info ────────────────────────────────
  useEffect(() => {
    const chart = candleChartRef.current;
    if (!chart || !trades.length) return;

    const findNearest = (hoverTime: number): Trade | null => {
      const intervalSec = (INTERVAL_MS[interval] ?? 3600000) / 1000;
      let nearest: Trade | null = null;
      let minDiff = Infinity;
      for (const t of trades) {
        const entryTs = Math.floor(new Date(t.entryTime).getTime() / 1000) + TZ_OFFSET;
        const exitTs  = Math.floor(new Date(t.exitTime).getTime() / 1000) + TZ_OFFSET;
        const pad = intervalSec * 5;
        if (hoverTime >= entryTs - pad && hoverTime <= exitTs + pad) {
          const diff = Math.abs(entryTs - hoverTime);
          if (diff < minDiff) { minDiff = diff; nearest = t; }
        }
      }
      return nearest;
    };

    const moveHandler = (param: { time?: unknown }) => {
      if (!param.time) { setHoveredCandle(null); return; }
      const hoverTime = param.time as number;
      const candle = allCandles.find(c => (c.time as number) === hoverTime) ?? null;
      setHoveredCandle(candle);
    };

    const clickHandler = (param: { time?: unknown }) => {
      if (!param.time) return;
      const hoverTime = param.time as number;
      const t = findNearest(hoverTime);
      if (t) { setSelectedTrade(t); onTradeSelect?.(t); }
    };

    chart.subscribeCrosshairMove(moveHandler);
    chart.subscribeClick(clickHandler);
    return () => {
      chart.unsubscribeCrosshairMove(moveHandler);
      chart.unsubscribeClick(clickHandler);
    };
  }, [trades, interval, onTradeSelect, allCandles]);

  // ── Auto-fetch klines ────────────────────────────────────────────────────────
  const loadKlines = useCallback(async (params: {
    symbol: string; interval: string; startDate?: string; endDate?: string; strategyId?: string;
  }) => {
    if (!candleSeriesRef.current || !candleChartRef.current) return;
    setLoading(true);
    setFetchError(null);

    let resolvedStart = params.startDate ?? '';
    let resolvedEnd   = params.endDate ?? new Date().toISOString();

    if (autoRangeFromTrades && trades.length > 0) {
      const times = trades.flatMap(t => [new Date(t.entryTime).getTime(), new Date(t.exitTime).getTime()]);
      const pad = (INTERVAL_MS[params.interval] ?? 3600000) * 50;
      resolvedStart = new Date(Math.min(...times) - pad).toISOString();
      resolvedEnd   = new Date().toISOString();
    }

    const urlParams = new URLSearchParams({ 
      symbol: params.symbol, 
      interval: params.interval, 
      limit: '1500',
      strategyId: params.strategyId || strategyId || 'default-smc'
    });
    if (resolvedStart) urlParams.set('startTime', String(new Date(resolvedStart).getTime()));
    if (resolvedEnd) {
      const intervalMs2 = INTERVAL_MS[params.interval] ?? 3600000;
      const endMs = new Date(resolvedEnd).getTime();
      const nowMs = Date.now();
      if (nowMs - endMs > intervalMs2 * 2) {
        urlParams.set('endTime', String(endMs));
      }
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const res  = await fetch(`/api/backtest?${urlParams}`, {
        signal: abortControllerRef.current.signal
      });
      const data = await res.json() as unknown[];
      if (!Array.isArray(data) || data.length === 0) { setFetchError('ไม่มีข้อมูล kline'); setLoading(false); return; }

      const cdata = data.map(d => {
        const k = d as [number, string, string, string, string, string];
        return {
          time: (Math.floor(k[0] / 1000) + TZ_OFFSET) as Time,
          open: parseFloat(k[1]), high: parseFloat(k[2]),
          low: parseFloat(k[3]),  close: parseFloat(k[4]),
          volume: parseFloat(k[5]),
        };
      }).sort((a, b) => (a.time as number) - (b.time as number));

      const isRefresh = allCandles.length > 0 && 
                        lastParamsRef.current.symbol === params.symbol && 
                        lastParamsRef.current.interval === params.interval;

      // ── VIEWPORT SNAPSHOT ──
      const timeScale = candleChartRef.current?.timeScale();
      const previousLogicalRange = isRefresh ? timeScale?.getVisibleLogicalRange() : null;

      candleSeriesRef.current?.setData(cdata);

      if (volumeSeriesRef.current) {
        volumeSeriesRef.current.setData(cdata.map(c => ({
          time: c.time,
          value: c.volume,
          color: c.close >= c.open ? 'rgba(14,203,129,0.4)' : 'rgba(246,70,93,0.4)',
        })));
      }

      // ── VIEW RESTORE LOGIC ──
      if (isRefresh && previousLogicalRange) {
        try {
          // Wait a frame for the chart to index new data
          setTimeout(() => {
            timeScale?.setVisibleLogicalRange(previousLogicalRange);
          }, 10);
        } catch (e) { /* fallback */ }
      } else {
        // 🎯 AUTO-FOCUS (ONLY ON NEW LOAD): Show last ~100 candles for better clarity
        try {
          setTimeout(() => {
            const lastIndex = cdata.length - 1;
            timeScale?.setVisibleLogicalRange({
              from: (lastIndex - 100) as any,
              to: (lastIndex + 10) as any, 
            });
            timeScale?.applyOptions({ rightOffset: 12 });
          }, 50);
        } catch (e) {
          timeScale?.fitContent(); // Fallback
        }
      }

      lastParamsRef.current = { symbol: params.symbol, interval: params.interval };
      setAllCandles(cdata);
      if (onDataLoaded) onDataLoaded(cdata);

      if (trades.length > 0 && candleSeriesRef.current) {
        const barTimesArr = cdata.map(c => c.time as number).sort((a, b) => a - b);
        const minT = barTimesArr[0], maxT = barTimesArr[barTimesArr.length - 1];
        const markers: SeriesMarker<Time>[] = [];
        trades.forEach((t, i) => {
          const n = i + 1;
          markers.push({
            time: snapToBarArr(barTimesArr, toChartTime(t.entryTime) as number) as Time,
            position: t.type === 'LONG' ? 'belowBar' : 'aboveBar',
            color: t.type === 'LONG' ? '#0ecb81' : '#f6465d',
            shape: 'arrowUp',
            text: `${t.type === 'LONG' ? 'BUY' : 'SELL'} ${n}`,
          });
          markers.push({
            time: snapToBarArr(barTimesArr, toChartTime(t.exitTime) as number) as Time,
            position: t.type === 'LONG' ? 'aboveBar' : 'belowBar',
            color: '#f6465d', shape: 'arrowDown', text: t.exitReason,
          });
        });
        const inRange = markers
          .sort((a, b) => (a.time as number) - (b.time as number))
          .filter(m => (m.time as number) >= minT && (m.time as number) <= maxT);
        setStoredMarkers(inRange);
      }
    } catch (err: any) { 
      if (err.name === 'AbortError') return;
      setFetchError('โหลด kline ไม่สำเร็จ'); 
    }
    setLoading(false);
  }, [trades, autoRangeFromTrades]);

  useEffect(() => {
    if (!autoFetch) return;
    if (autoRangeFromTrades && trades.length === 0) return;
    loadKlines({ symbol, interval, startDate, endDate, strategyId });
  }, [autoFetch, symbol, interval, startDate, endDate, trades.length, autoRangeFromTrades, strategyId]);

  // ── Imperative handle ────────────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    loadKlines,
    setCandles(cdata) {
      candleSeriesRef.current?.setData(cdata);
      candleChartRef.current?.timeScale().fitContent();
      candleChartRef.current?.timeScale().applyOptions({ rightOffset: 12 });
      setAllCandles(cdata);
    },
    setMarkers(markers, visible = true) {
      setStoredMarkers(markers);
      applyMarkers(markers, visible);
    },
    clearMarkers() {
      markersPluginRef.current?.setMarkers([]);
      setStoredMarkers([]);
    },
    setEquityCurve(_curve) { },
    clearEquityCurve() { },
    getChart() { return candleChartRef.current; },
    getCandleSeries() { return candleSeriesRef.current; },
    toggleOverlay(key: keyof OverlayToggleState) {
      setToggleStates(prev => ({ ...prev, [key]: !prev[key] }));
    }
  }), [loadKlines, applyMarkers]);

  const tradeIdx = selectedTrade ? trades.indexOf(selectedTrade) + 1 : 0;
  const infoPanel = selectedTrade ? (() => {
    const t = selectedTrade;
    const isLong = t.type === 'LONG';
    const rows: [string, string, string?][] = [
      ['Trade', `#${tradeIdx} ${t.type}`, isLong ? '#0ecb81' : '#f6465d'],
      ['Entry', `$${t.entryPrice.toFixed(2)}`],
      ['Exit', `$${t.exitPrice.toFixed(2)}`],
      ['PnL', `${t.pnl >= 0 ? '+' : ''}$${t.pnl.toFixed(2)} (${t.pnlPct.toFixed(2)}%)`, t.pnl >= 0 ? '#0ecb81' : '#f6465d'],
      ['Reason', t.exitReason],
    ];
    return (
      <div style={{
        position: 'absolute',
        top: '1rem',
        right: '1rem',
        width: '180px',
        zIndex: 100,
        background: 'rgba(10,14,23,0.92)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px', 
        padding: '0.75rem',
        fontSize: '0.72rem', 
        fontFamily: 'monospace',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
      }}>
        <div style={{ fontWeight: 700, fontSize: '0.78rem', marginBottom: '0.5rem', color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.35rem' }}>
          Trade Info
        </div>
        {rows.map(([label, value, color], i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.4rem', marginBottom: '0.2rem' }}>
              <span style={{ color: '#888' }}>{label}</span>
              <span style={{ color: color ?? '#ccc', textAlign: 'right' }}>{value}</span>
            </div>
        ))}
        <button onClick={() => { setSelectedTrade(null); onTradeSelect?.(null); }} style={{ marginTop: '0.5rem', width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa', borderRadius: '4px', padding: '0.2rem', cursor: 'pointer', fontSize: '0.7rem', transition: 'all 0.2s' }}>
          ✕ Clear
        </button>
      </div>
    );
  })() : null;

  const hasEquity = !!(equityCurve && equityCurve.length > 0);
  const hasRsi    = !!(overlayData.rsi && overlayData.rsi.length > 0);
  const [showEquity, setShowEquity] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', height, width: '100%' }}>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', flex: 1, minHeight: 0, position: 'relative' }}>
        <div style={{ flex: 1, minWidth: 0, height: '100%', position: 'relative' }}>
          {loading && (
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(19, 23, 34, 0.7)', backdropFilter: 'blur(2px)',
              zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem'
            }}>
               <div className="animate-spin" style={{ width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.1)', borderTop: '3px solid #00d1ff', borderRadius: '50%' }} />
               <span style={{ fontSize: '0.8rem', color: '#fff', fontWeight: 600 }}>SYNCING {symbol}...</span>
            </div>
          )}
          {fetchError && !loading && (
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(19, 23, 34, 0.9)', zIndex: 9998,
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f6465d', fontWeight: 'bold'
            }}>
               ⚠️ {fetchError}
            </div>
          )}
          <div ref={candleContainerRef} style={{ height: '100%', width: '100%' }} />
        </div>
        {infoPanel}
      </div>

      <OverlayRenderer
        chart={candleChartRef.current}
        candleSeries={candleSeriesRef.current}
        rsiChartRef={rsiChartRef}
        overlayData={overlayData}
        trades={trades}
        selectedTrade={manualTrade || selectedTrade}
        strategy=""
        showMarkers={showMarkersState}
        toggleStates={toggleStates}
        onToggleChange={(k, v) => setToggleStates(p => ({ ...p, [k]: v }))}
      />

      {hasRsi && (
        <div className="glass-panel" style={{ padding: '1rem' }}>
          <h5 className="m-0" style={{ marginBottom: '0.5rem' }}>RSI</h5>
          <div style={{ height: '120px', border: '1px solid #333', borderRadius: '4px', overflow: 'hidden' }}>
            <div ref={rsiContainerRef} style={{ width: '100%', height: '100%' }} />
          </div>
        </div>
      )}

      {hasEquity && showEquity && (
        <div className="glass-panel" style={{ padding: '1rem' }}>
          <h5 className="m-0" style={{ marginBottom: '0.5rem' }}>Portfolio Equity Curve</h5>
          <div style={{ height: '180px', border: '1px solid #333', borderRadius: '4px', overflow: 'hidden' }}>
            <EquityMiniChart data={equityCurve ?? []} />
          </div>
        </div>
      )}

      <IndicatorPanel candles={allCandles} syncChart={candleChartRef.current} />
    </div>
  );
});

export default CandleChart;
