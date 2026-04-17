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
    height = 'calc(100vh - 340px)',
    autoRangeFromTrades = false,
    onTradeSelect,
    onDataLoaded,
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

  const [allCandles, setAllCandles] = useState<{ time: Time; open: number; high: number; low: number; close: number; volume?: number }[]>([]);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [hoveredCandle, setHoveredCandle] = useState<{ time: Time; open: number; high: number; low: number; close: number; volume?: number } | null>(null);

  // Always show last trade by default
  useEffect(() => {
    if (trades.length > 0) setSelectedTrade(trades[trades.length - 1]);
    else setSelectedTrade(null);
  }, [trades]);
  const [toggleStates, setToggleStates] = useState<OverlayToggleState>({ ema20: true, ema50: true, bb: true, rsi: true, levels: true, zones: true });
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

  // ── Equity curve from prop ───────────────────────────────────────────────────
  // Handled by EquityMiniChart component (mounts fresh when showEquity=true)

  const [showTradeInfo, setShowTradeInfo] = useState(true);

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
        // Match if hover is within the trade's entry→exit range (+ 5 bar pad)
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

  // ── Scroll to selected trade ─────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedTrade || !candleChartRef.current) return;
    const entryTs = Math.floor(new Date(selectedTrade.entryTime).getTime() / 1000) + TZ_OFFSET;
    const exitTs  = Math.floor(new Date(selectedTrade.exitTime).getTime() / 1000) + TZ_OFFSET;
    const pad = ((INTERVAL_MS[interval] ?? 3600000) / 1000) * 20;
    try {
      candleChartRef.current.timeScale().setVisibleRange({
        from: (entryTs - pad) as Time,
        to: (exitTs + pad) as Time,
      });
    } catch { /* ignore */ }
  }, [selectedTrade, interval]);

  // ── Auto-fetch klines ────────────────────────────────────────────────────────
  const loadKlines = useCallback(async (params: {
    symbol: string; interval: string; startDate?: string; endDate?: string;
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

    const urlParams = new URLSearchParams({ symbol: params.symbol, interval: params.interval, limit: '1500' });
    if (resolvedStart) urlParams.set('startTime', String(new Date(resolvedStart).getTime()));
    // Only set endTime if it's meaningfully in the past (> 1 bar ago), otherwise omit to get latest bars
    if (resolvedEnd) {
      const intervalMs2 = INTERVAL_MS[params.interval] ?? 3600000;
      const endMs = new Date(resolvedEnd).getTime();
      const nowMs = Date.now();
      if (nowMs - endMs > intervalMs2 * 2) {
        urlParams.set('endTime', String(endMs));
      }
    }

    try {
      const res  = await fetch(`/api/backtest?${urlParams}`);
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

      candleSeriesRef.current?.setData(cdata);

      // Volume overlay
      if (volumeSeriesRef.current) {
        volumeSeriesRef.current.setData(cdata.map(c => ({
          time: c.time,
          value: c.volume,
          color: c.close >= c.open ? 'rgba(14,203,129,0.4)' : 'rgba(246,70,93,0.4)',
        })));
      }
      candleChartRef.current?.timeScale().fitContent();
      candleChartRef.current?.timeScale().applyOptions({ rightOffset: 12 });
      setAllCandles(cdata);
      if (onDataLoaded) {
        onDataLoaded(cdata);
      }

      // Build markers from trades
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
    } catch { setFetchError('โหลด kline ไม่สำเร็จ'); }
    setLoading(false);
  }, [trades, autoRangeFromTrades]);

  useEffect(() => {
    if (!autoFetch) return;
    // If autoRangeFromTrades, wait until trades are available before fetching
    if (autoRangeFromTrades && trades.length === 0) return;
    loadKlines({ symbol, interval, startDate, endDate });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFetch, symbol, interval, startDate, endDate, trades.length, autoRangeFromTrades]);

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
    setEquityCurve(_curve) { /* handled by EquityMiniChart */ },
    clearEquityCurve() { /* handled by EquityMiniChart */ },
    getChart() { return candleChartRef.current; },
    getCandleSeries() { return candleSeriesRef.current; },
  }), [loadKlines, applyMarkers]);

  // ── Trade info panel ─────────────────────────────────────────────────────────
  const tradeIdx = selectedTrade ? trades.indexOf(selectedTrade) + 1 : 0;
  const infoPanel = showTradeInfo && selectedTrade ? (() => {
    const t = selectedTrade;
    const isLong = t.type === 'LONG';
    const tp2 = t.tp2Price ?? (t.tpPrice > 0 ? t.entryPrice + (t.tpPrice - t.entryPrice) * 2 : 0);
    const tp3 = t.tp3Price ?? (t.tpPrice > 0 ? t.entryPrice + (t.tpPrice - t.entryPrice) * 3 : 0);
    const rows: [string, string, string?][] = [
      ['Trade', `#${tradeIdx} ${t.type}`, isLong ? '#0ecb81' : '#f6465d'],
      ['Entry', `$${t.entryPrice.toFixed(2)}`],
      ['Exit', `$${t.exitPrice.toFixed(2)}`],
      ['PnL', `${t.pnl >= 0 ? '+' : ''}$${t.pnl.toFixed(2)} (${t.pnlPct >= 0 ? '+' : ''}${t.pnlPct.toFixed(2)}%)`, t.pnl >= 0 ? '#0ecb81' : '#f6465d'],
      ['Reason', t.exitReason],
      ['─', ''],
      ['TP1', t.tpPrice > 0 ? `$${t.tpPrice.toFixed(2)}` : '—', '#0ecb81'],
      ['TP2', tp2 > 0 ? `$${tp2.toFixed(2)}` : '—', '#00e5a0'],
      ['TP3', tp3 > 0 ? `$${tp3.toFixed(2)}` : '—', '#00ffc8'],
      ['SL', t.slPrice > 0 ? `$${t.slPrice.toFixed(2)}` : '—', '#f6465d'],
      ['─', ''],
      ['Conf.', t.entryConfidence != null ? `${((t.entryConfidence as number) * 100).toFixed(0)}%` : '—'],
      ['ATR', t.atr != null ? `$${(t.atr as number).toFixed(2)}` : '—'],
      ['Regime', t.regime ?? '—'],
    ];
    return (
      <div style={{
        width: '180px', flexShrink: 0,
        background: 'rgba(10,14,23,0.95)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px', padding: '0.75rem',
        fontSize: '0.72rem', fontFamily: 'monospace',
        alignSelf: 'flex-start',
      }}>
        <div style={{ fontWeight: 700, fontSize: '0.78rem', marginBottom: '0.5rem', color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.35rem' }}>
          Trade Info
        </div>
        {rows.map(([label, value, color], i) =>
          label === '─' ? (
            <div key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.07)', margin: '0.3rem 0' }} />
          ) : (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.4rem', marginBottom: '0.2rem' }}>
              <span style={{ color: '#555' }}>{label}</span>
              <span style={{ color: color ?? '#ccc', textAlign: 'right', maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
            </div>
          )
        )}
        <button onClick={() => { setSelectedTrade(null); onTradeSelect?.(null); }} style={{ marginTop: '0.5rem', width: '100%', background: 'transparent', border: '1px solid #333', color: '#666', borderRadius: '4px', padding: '0.2rem', cursor: 'pointer', fontSize: '0.7rem' }}>
          ✕ Clear
        </button>
      </div>
    );
  })() : null;

  const chartHeight = typeof height === 'number' ? `${height}px` : height;
  const hasEquity = !!(equityCurve && equityCurve.length > 0);
  const hasRsi    = !!(overlayData.rsi && overlayData.rsi.length > 0);
  const [showEquity, setShowEquity] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', height: chartHeight }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
          {symbol}
          {selectedTrade && <span style={{ fontSize: '0.7rem', color: selectedTrade.type === 'LONG' ? '#0ecb81' : '#f6465d', marginLeft: '0.5rem' }}>▶ Trade #{tradeIdx} — click to deselect</span>}
        </span>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <ReplayControls allCandles={allCandles} candleSeries={candleSeriesRef.current} />
          <DrawingTools chart={candleChartRef.current} candleSeries={candleSeriesRef.current} />
          <OverlayToggleControls overlayData={overlayData} toggleStates={toggleStates} onToggleChange={(k, v) => setToggleStates(p => ({ ...p, [k]: v }))} />
          <button
            onClick={() => setShowMarkersState(v => !v)}
            style={{ background: showMarkersState ? 'var(--accent-primary)' : 'transparent', color: showMarkersState ? '#fff' : 'var(--text-main)', border: '1px solid #444', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer' }}
          >
            {showMarkersState ? 'Hide Markers' : 'Show Markers'}
          </button>
          {hasEquity && (
            <button
              onClick={() => setShowEquity(v => !v)}
              style={{ background: showEquity ? 'rgba(14,203,129,0.2)' : 'transparent', color: showEquity ? '#0ecb81' : 'var(--text-muted)', border: `1px solid ${showEquity ? '#0ecb81' : '#444'}`, padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer' }}
            >
              Equity Curve
            </button>
          )}
          {trades.length > 0 && (
            <button
              onClick={() => setShowTradeInfo(v => !v)}
              style={{ background: showTradeInfo ? 'rgba(0,209,255,0.15)' : 'transparent', color: showTradeInfo ? 'var(--accent-primary, #00d1ff)' : 'var(--text-muted)', border: `1px solid ${showTradeInfo ? 'var(--accent-primary, #00d1ff)' : '#444'}`, padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer' }}
            >
              Trade Info
            </button>
          )}
        </div>
      </div>

      {/* Candle chart + info panel */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', flex: 1, minHeight: 0 }}>
        <div style={{ flex: 1, minWidth: 0, height: '100%' }}>
          {loading && allCandles.length === 0 && <div style={{ height: chartHeight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>กำลังโหลด...</div>}
          {fetchError && <div style={{ height: chartHeight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f6465d' }}>{fetchError}</div>}
          <div ref={candleContainerRef} style={{ height: chartHeight, width: '100%', display: (loading && allCandles.length === 0) || fetchError ? 'none' : 'block' }} />
        </div>
        {infoPanel}
      </div>

      {/* OverlayRenderer — indicators + TP/SL/Entry lines */}
      <OverlayRenderer
        chart={candleChartRef.current}
        candleSeries={candleSeriesRef.current}
        rsiChartRef={rsiChartRef}
        overlayData={overlayData}
        trades={trades}
        selectedTrade={selectedTrade}
        strategy=""
        showMarkers={showMarkersState}
        toggleStates={toggleStates}
        onToggleChange={(k, v) => setToggleStates(p => ({ ...p, [k]: v }))}
      />

      {/* RSI sub-panel */}
      {hasRsi && (
        <div className="glass-panel" style={{ padding: '1rem' }}>
          <h5 className="m-0" style={{ marginBottom: '0.5rem' }}>RSI</h5>
          <div style={{ height: '120px', border: '1px solid var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
            <div ref={rsiContainerRef} style={{ width: '100%', height: '100%' }} />
          </div>
        </div>
      )}

      {hasEquity && showEquity && (
        <div className="glass-panel" style={{ padding: '1rem' }}>
          <h5 className="m-0" style={{ marginBottom: '0.5rem' }}>Portfolio Equity Curve</h5>
          <div style={{ height: '180px', border: '1px solid var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
            <EquityMiniChart data={equityCurve ?? []} />
          </div>
        </div>
      )}

      {/* Indicator sub-panels */}
      <IndicatorPanel candles={allCandles} syncChart={candleChartRef.current} />
    </div>
  );
});

export default CandleChart;
