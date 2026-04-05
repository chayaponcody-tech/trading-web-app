import { useState, useRef, useEffect, useCallback } from 'react';
import { createChart, ColorType, LineSeries, CandlestickSeries, createSeriesMarkers } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, Time, SeriesMarker, ISeriesMarkersPluginApi } from 'lightweight-charts';
import { EMA, BollingerBands, RSI, ATR } from 'technicalindicators';

const API = '';

const LOT_SIZES = [
  { value: 0.01, label: '0.01 (Micro)' },
  { value: 0.05, label: '0.05' },
  { value: 0.1, label: '0.10 (Mini)' },
  { value: 0.5, label: '0.50' },
  { value: 1.0, label: '1.00 (Standard)' },
  { value: 2.0, label: '2.00' },
  { value: 5.0, label: '5.00' },
];
const GOLD_INTERVALS = ['5m', '15m', '1h', '4h', '1d'];
const GOLD_STRATEGIES = [
  { value: 'EMA', label: 'EMA Cross (20/50)' },
  { value: 'BB', label: 'BB Mean Reversion' },
  { value: 'RSI', label: 'RSI Oversold/Overbought' },
  { value: 'EMA_RSI', label: '⚡ EMA + RSI' },
  { value: 'BB_RSI', label: '⚡ BB + RSI' },
  { value: 'GRID', label: '🌐 Grid (Mean Reversion)' },
  { value: 'PA_REJECTION', label: '🕯️ Price Action + RSI' },
];

// Forex Gold lot math: 1 standard lot = 100 oz
const ozPerStdLot = 100;
const fmtPrice = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPnl = (n: number) => `${n >= 0 ? '+' : ''}$${fmtPrice(n)}`;

interface Trade {
  entryTime: string; exitTime: string;
  type: string; entryPrice: number; exitPrice: number;
  pnl: number; reason: string; lots: number;
}
interface Results {
  netPnl: number; winRate: number; winCount: number; lossCount: number;
  maxDrawdown: number; profitFactor: number; totalTrades: number;
  grossProfit: number; grossLoss: number;
}

export default function GoldBacktest() {
  const [interval, setIntervalVal] = useState('1h');
  const [strategy, setStrategy] = useState('EMA');
  const [lots, setLots] = useState(0.1);
  const [leverage, setLeverage] = useState(100);
  const [tpMode, setTpMode] = useState<'FIXED' | 'ATR'>('FIXED');
  const [slMode, setSlMode] = useState<'FIXED' | 'ATR'>('FIXED');
  const [tpPips, setTpPips] = useState(200);   // in Points ($2.00)
  const [slPips, setSlPips] = useState(100);   // in Points ($1.00)
  const [atrMultiplierTP, setAtrMultiplierTP] = useState(3.0);
  const [atrMultiplierSL, setAtrMultiplierSL] = useState(1.5);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Results | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [error, setError] = useState('');
  const [showMarkers, setShowMarkers] = useState(true);
  const [storedMarkers, setStoredMarkers] = useState<SeriesMarker<Time>[]>([]);
  const [activeTab, setActiveTab] = useState<'charts' | 'log'>('charts');

  const chartRef = useRef<HTMLDivElement>(null);
  const chartApiRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const ema20Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ema50Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);

  // ─── Chart Setup ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!chartRef.current) return;
    const chart = createChart(chartRef.current, {
      layout: { background: { type: ColorType.Solid, color: '#0d1117' }, textColor: '#c9d1d9' },
      grid: { vertLines: { color: '#21262d' }, horzLines: { color: '#21262d' } },
      width: chartRef.current.clientWidth, height: 360,
      timeScale: { timeVisible: true },
      localization: {
        locale: 'th-TH',
        timeFormatter: (time: number) => {
          return new Date(time * 1000).toLocaleString('th-TH', {
            hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Bangkok'
          });
        },
      },
    });
    chartApiRef.current = chart;

    const cSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#0ecb81', downColor: '#f6465d',
      borderUpColor: '#0ecb81', borderDownColor: '#f6465d',
      wickUpColor: '#0ecb81', wickDownColor: '#f6465d',
    });
    candleSeriesRef.current = cSeries;

    ema20Ref.current = chart.addSeries(LineSeries, { color: '#faad14', lineWidth: 1 });
    ema50Ref.current = chart.addSeries(LineSeries, { color: '#6366f1', lineWidth: 1 });

    const ro = new ResizeObserver(() => {
      if (chartRef.current) chart.applyOptions({ width: chartRef.current.clientWidth });
    });
    ro.observe(chartRef.current);
    return () => { ro.disconnect(); chart.remove(); markersPluginRef.current = null; };
  }, []);

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

  // ─── Fetch & Run Backtest ──────────────────────────────────────────────────
  const runBacktest = useCallback(async () => {
    setLoading(true); setError(''); setResults(null); setTrades([]);
    if (markersPluginRef.current) markersPluginRef.current.setMarkers([]);
    setStoredMarkers([]);
    try {
      const params = new URLSearchParams({ symbol: 'PAXGUSDT', interval, limit: '1000' });
      if (startDate) params.set('startTime', String(new Date(startDate).getTime()));
      if (endDate) params.set('endTime', String(new Date(endDate).getTime()));

      const res = await fetch(`${API}/api/backtest?${params}`);
      const raw: [number, string, string, string, string, string, number, string, string, string, string, string][] = await res.json();
      if (!Array.isArray(raw) || raw.length < 20) { setError('ข้อมูลไม่เพียงพอ'); setLoading(false); return; }

      const klines = raw.map(k => ({
        time: Math.floor(k[0] / 1000) as Time,
        open: parseFloat(k[1]), high: parseFloat(k[2]),
        low: parseFloat(k[3]), close: parseFloat(k[4]),
      }));

      // Update chart
      candleSeriesRef.current?.setData(klines);
      const closes = klines.map(k => k.close);
      const ema20 = EMA.calculate({ period: 20, values: closes });
      const ema50 = EMA.calculate({ period: 50, values: closes });
      const e20Data = ema20.map((v, i) => ({ time: klines[i + (closes.length - ema20.length)].time, value: v }));
      const e50Data = ema50.map((v, i) => ({ time: klines[i + (closes.length - ema50.length)].time, value: v }));
      ema20Ref.current?.setData(e20Data);
      ema50Ref.current?.setData(e50Data);
      chartApiRef.current?.timeScale().fitContent();

      // ─── Backtest Engine ──────────────────────────────────────────────────
      const contractSize = lots * ozPerStdLot; // oz
      let cash = 10000;
      let grossProfit = 0, grossLoss = 0, winCount = 0, lossCount = 0;
      let openPos: { 
        type: string; 
        entryPrice: number; 
        entryTime: string;
        slPrice: number;
        tpPrice: number;
      } | null = null;
      const tradeList: Trade[] = [];
      let equity = cash;
      let maxEquity = cash;
      let maxDrawdown = 0;

      const allCloses = klines.map(k => k.close);
      const ema20Full = EMA.calculate({ period: 20, values: allCloses });
      const ema50Full = EMA.calculate({ period: 50, values: allCloses });
      const rsiAll = RSI.calculate({ period: 14, values: allCloses });
      const bbAll = BollingerBands.calculate({ period: 20, stdDev: 2, values: allCloses });
      const atrAll = ATR.calculate({
        period: 14,
        high: klines.map(k => k.high),
        low: klines.map(k => k.low),
        close: klines.map(k => k.close)
      });

      const getSignal = (i: number): string => {
        const closesUpTo = allCloses.slice(0, i + 1);
        const n = closesUpTo.length;
        if (n < 60) return 'NONE';
        const e20i = ema20Full[i - (allCloses.length - ema20Full.length)];
        const e50i = ema50Full[i - (allCloses.length - ema50Full.length)];
        const e20p = ema20Full[i - 1 - (allCloses.length - ema20Full.length)];
        const e50p = ema50Full[i - 1 - (allCloses.length - ema50Full.length)];
        const rsii = rsiAll[i - (allCloses.length - rsiAll.length)];
        const bbi = bbAll[i - (allCloses.length - bbAll.length)];
        const bbp = bbAll[i - 1 - (allCloses.length - bbAll.length)];
        const curr = allCloses[i], prev = allCloses[i - 1];

        if (strategy === 'EMA' && e20i != null && e50i != null && e20p != null && e50p != null) {
          if (e20p <= e50p && e20i > e50i) return 'LONG';
          if (e20p >= e50p && e20i < e50i) return 'SHORT';
        } else if (strategy === 'BB' && bbi && bbp) {
          if (prev <= bbp.lower && curr > bbi.lower) return 'LONG';
          if (prev >= bbp.upper && curr < bbi.upper) return 'SHORT';
        } else if (strategy === 'RSI' && rsii != null) {
          const rsiPrev = rsiAll[i - 1 - (allCloses.length - rsiAll.length)];
          if (rsiPrev != null && rsiPrev <= 30 && rsii > 30) return 'LONG';
          if (rsiPrev != null && rsiPrev >= 70 && rsii < 70) return 'SHORT';
        } else if (strategy === 'EMA_RSI' && e20i != null && e50i != null && e20p != null && e50p != null && rsii != null) {
          if (e20p <= e50p && e20i > e50i && rsii < 40) return 'LONG';
          if (e20p >= e50p && e20i < e50i && rsii > 60) return 'SHORT';
        } else if (strategy === 'BB_RSI' && bbi && bbp && rsii != null) {
          const rsiPrev = rsiAll[i - 1 - (allCloses.length - rsiAll.length)];
          if (rsiPrev != null && prev <= bbp.lower && curr > bbi.lower && rsiPrev <= 30) return 'LONG';
          if (rsiPrev != null && prev >= bbp.upper && curr < bbi.upper && rsiPrev >= 70) return 'SHORT';
        } else if (strategy === 'GRID' && e20i != null) {
          const dev = (curr - e20i) / e20i;
          if (dev <= -0.005) return 'LONG';
          if (dev >= 0.005) return 'SHORT';
        } else if (strategy === 'PA_REJECTION' && rsii != null && prev != null) {
          const pk = klines[i-1]; // Previous candle
          const ck = klines[i];   // Current candle
          
          const pBody = Math.abs(pk.close - pk.open);
          const cBody = Math.abs(ck.close - ck.open);
          const cTotal = ck.high - ck.low;
          const cUpperWick = ck.high - Math.max(ck.open, ck.close);
          const cLowerWick = Math.min(ck.open, ck.close) - ck.low;

          // 1. PINBAR DETECTION
          const isBullishPin = cLowerWick > (cBody * 2) && cUpperWick < (cTotal * 0.2);
          const isBearishPin = cUpperWick > (cBody * 2) && cLowerWick < (cTotal * 0.2);

          // 2. ENGULFING DETECTION
          const isBullishEngulf = ck.close > ck.open && pk.close < pk.open && ck.close > pk.open && ck.open < pk.close;
          const isBearishEngulf = ck.close < ck.open && pk.close > pk.open && ck.close < pk.low && ck.open > pk.high; // Simplified

          if ((isBullishPin || isBullishEngulf) && rsii < 40) return `LONG:${isBullishPin ? 'Pinbar' : 'Engulfing'}`;
          if ((isBearishPin || isBearishEngulf) && rsii > 60) return `SHORT:${isBearishPin ? 'Pinbar' : 'Engulfing'}`;
        }
        return 'NONE';
      };
      const tzOpts: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Bangkok', dateStyle: 'short', timeStyle: 'short' };
      const fmtTime = (t: number) => new Date(t * 1000).toLocaleString('th-TH', tzOpts);

      const markers: SeriesMarker<Time>[] = [];
      for (let i = 60; i < klines.length; i++) {
        const k = klines[i];
        const curr = k.close;
        const atri = atrAll[i - (klines.length - atrAll.length)];

        if (openPos) {
          const pnl = openPos.type === 'LONG'
            ? (curr - openPos.entryPrice) * contractSize
            : (openPos.entryPrice - curr) * contractSize;

          let closed: string | null = null;
          if (openPos.type === 'LONG') {
            if (curr >= openPos.tpPrice) closed = 'TP Hit';
            else if (curr <= openPos.slPrice) closed = 'SL Hit';
          } else {
            if (curr <= openPos.tpPrice) closed = 'TP Hit';
            else if (curr >= openPos.slPrice) closed = 'SL Hit';
          }

          const sigRes = getSignal(i);
          const flipped = sigRes !== 'NONE' && !sigRes.startsWith(openPos.type) ? 'Signal Flipped' : null;
          const reason = closed || flipped;

          if (reason) {
            cash += pnl;
            if (pnl > 0) { grossProfit += pnl; winCount++; }
            else { grossLoss += Math.abs(pnl); lossCount++; }
            tradeList.push({
              entryTime: fmtTime(Number(openPos.entryTime)), exitTime: fmtTime(Number(k.time)),
              type: openPos.type, entryPrice: openPos.entryPrice, exitPrice: curr,
              pnl, reason, lots,
            });
            markers.push({
              time: k.time,
              position: openPos.type === 'LONG' ? 'aboveBar' : 'belowBar',
              color: openPos.type === 'LONG' ? '#f6465d' : '#0ecb81',
              shape: openPos.type === 'LONG' ? 'arrowDown' : 'arrowUp',
              text: `${openPos.type === 'LONG' ? 'SELL' : 'BUY'} (${reason})`
            });
            openPos = null;
          }
        }

        if (!openPos) {
          const fullSig = getSignal(i);
          if (fullSig !== 'NONE' && atri != null) {
            const parts = fullSig.split(':');
            const sig = parts[0];
            const pattern = parts[1] || null;

            if (sig === 'LONG' || sig === 'SHORT') {
              let slVal = 0, tpVal = 0;
              if (slMode === 'FIXED') slVal = slPips / 100;
              else slVal = atri * atrMultiplierSL;

              if (tpMode === 'FIXED') tpVal = tpPips / 100;
              else tpVal = atri * atrMultiplierTP;

              const slPrice = sig === 'LONG' ? curr - slVal : curr + slVal;
              const tpPrice = sig === 'LONG' ? curr + tpVal : curr - tpVal;

              openPos = { type: sig, entryPrice: curr, entryTime: k.time.toString(), slPrice, tpPrice };
              markers.push({
                time: k.time,
                position: sig === 'LONG' ? 'belowBar' : 'aboveBar',
                color: sig === 'LONG' ? '#0ecb81' : '#f6465d',
                shape: sig === 'LONG' ? 'arrowUp' : 'arrowDown',
                text: pattern ? `${sig} (${pattern})` : sig
              });
            }
          }
        }

        equity = cash + (openPos
          ? (openPos.type === 'LONG' ? (curr - openPos.entryPrice) * contractSize : (openPos.entryPrice - curr) * contractSize)
          : 0);
        if (equity > maxEquity) maxEquity = equity;
        const dd = ((maxEquity - equity) / maxEquity) * 100;
        if (dd > maxDrawdown) maxDrawdown = dd;
      }

      const sortedMarkers = [...markers].sort((a, b) => (a.time as number) - (b.time as number));
      setStoredMarkers(sortedMarkers);

      const pf = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
      setResults({
        netPnl: cash - 10000, winRate: (winCount / (winCount + lossCount || 1)) * 100,
        winCount, lossCount, maxDrawdown, profitFactor: pf,
        totalTrades: tradeList.length, grossProfit, grossLoss,
      });
      setTrades(tradeList);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }, [interval, strategy, lots, leverage, tpPips, slPips, tpMode, slMode, atrMultiplierTP, atrMultiplierSL, startDate, endDate]);

  return (
    <div style={{ display: 'flex', gap: '1rem', height: '100%', overflow: 'hidden' }}>
      {/* ── Sidebar ───────────────────────────────────────────────── */}
      <div style={{ width: '280px', flexShrink: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingRight: '0.5rem' }}>
        <div className="glass-panel" style={{ borderLeft: '4px solid #faad14' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            🪙 Gold Backtest
          </h3>
          <p style={{ margin: '0.3rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            XAUUSD · Forex Lot Sizing
          </p>
        </div>

        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {/* Instrument label */}
          <div style={{ padding: '0.6rem', background: 'rgba(250,173,20,0.08)', borderRadius: '6px', border: '1px solid rgba(250,173,20,0.2)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Instrument</div>
            <div style={{ fontWeight: 'bold', color: '#faad14', fontSize: '1.2rem' }}>GOLD / XAU</div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>via PAXGUSDT (Binance)</div>
          </div>

          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Timeframe
            <select value={interval} onChange={e => setIntervalVal(e.target.value)} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.35rem', marginTop: '0.2rem' }}>
              {GOLD_INTERVALS.map(i => <option key={i}>{i}</option>)}
            </select>
          </label>

          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Strategy
            <select value={strategy} onChange={e => setStrategy(e.target.value)} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.35rem', marginTop: '0.2rem' }}>
              {GOLD_STRATEGIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Lot Size
              <select value={lots} onChange={e => setLots(parseFloat(e.target.value))} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: '#faad14', fontWeight: 'bold', padding: '0.3rem' }}>
                {LOT_SIZES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </label>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Leverage
              <select value={leverage} onChange={e => setLeverage(parseInt(e.target.value))} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.3rem' }}>
                {[10, 20, 50, 100, 200, 500].map(x => <option key={x} value={x}>{x}x</option>)}
              </select>
            </label>
          </div>

          <div style={{ padding: '0.4rem', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Take Profit</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button onClick={() => setTpMode('FIXED')} style={{ fontSize: '0.6rem', padding: '1px 4px', background: tpMode === 'FIXED' ? '#0ecb81' : '#333', border: 'none', color: '#fff', borderRadius: '2px', cursor: 'pointer' }}>Fixed</button>
                <button onClick={() => setTpMode('ATR')} style={{ fontSize: '0.6rem', padding: '1px 4px', background: tpMode === 'ATR' ? '#0ecb81' : '#333', border: 'none', color: '#fff', borderRadius: '2px', cursor: 'pointer' }}>ATR</button>
              </div>
            </div>
            {tpMode === 'FIXED' ? (
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>TP Points
                <input type="number" value={tpPips} onChange={e => setTpPips(parseFloat(e.target.value))} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--profit-color)', padding: '0.3rem' }} />
              </label>
            ) : (
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ATR Multiplier
                <input type="number" step="0.1" value={atrMultiplierTP} onChange={e => setAtrMultiplierTP(parseFloat(e.target.value))} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--profit-color)', padding: '0.3rem' }} />
              </label>
            )}
          </div>

          <div style={{ padding: '0.4rem', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Stop Loss</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button onClick={() => setSlMode('FIXED')} style={{ fontSize: '0.6rem', padding: '1px 4px', background: slMode === 'FIXED' ? '#f6465d' : '#333', border: 'none', color: '#fff', borderRadius: '2px', cursor: 'pointer' }}>Fixed</button>
                <button onClick={() => setSlMode('ATR')} style={{ fontSize: '0.6rem', padding: '1px 4px', background: slMode === 'ATR' ? '#f6465d' : '#333', border: 'none', color: '#fff', borderRadius: '2px', cursor: 'pointer' }}>ATR</button>
              </div>
            </div>
            {slMode === 'FIXED' ? (
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SL Points
                <input type="number" value={slPips} onChange={e => setSlPips(parseFloat(e.target.value))} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--loss-color)', padding: '0.3rem' }} />
              </label>
            ) : (
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ATR Multiplier
                <input type="number" step="0.1" value={atrMultiplierSL} onChange={e => setAtrMultiplierSL(parseFloat(e.target.value))} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--loss-color)', padding: '0.3rem' }} />
              </label>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Start Date
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.4rem', borderRadius: '4px', marginTop: '0.2rem', boxSizing: 'border-box' }} />
            </label>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>End Date
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.4rem', borderRadius: '4px', marginTop: '0.2rem', boxSizing: 'border-box' }} />
            </label>
          </div>

          {/* Calculated info */}
          <div style={{ background: 'var(--bg-dark)', borderRadius: '4px', padding: '0.5rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            <div>Contract: <strong style={{ color: '#fff' }}>{(lots * ozPerStdLot).toFixed(0)} oz</strong></div>
            <div>$1 move = <strong style={{ color: '#0ecb81' }}>${(lots * ozPerStdLot).toFixed(2)} profit/loss</strong></div>
          </div>

          <button onClick={runBacktest} disabled={loading} style={{ background: '#faad14', color: '#000', border: 'none', padding: '0.7rem', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.9rem' }}>
            {loading ? '⏳ Running...' : '▶ Run Backtest'}
          </button>
          {error && <div style={{ color: 'var(--loss-color)', fontSize: '0.8rem' }}>{error}</div>}
        </div>
      </div>

      {/* ── Main Content ──────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', overflow: 'hidden' }}>
        {/* Results Bar */}
        {results && (
          <div className="glass-panel" style={{ padding: '0.75rem 1.25rem', borderLeft: '4px solid #faad14' }}>
            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>NET PnL</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: results.netPnl >= 0 ? 'var(--profit-color)' : 'var(--loss-color)' }}>{fmtPnl(results.netPnl)}</div>
              </div>
              {[
                { label: 'Win Rate', value: `${results.winRate.toFixed(1)}%`, sub: `${results.winCount}W / ${results.lossCount}L` },
                { label: 'Profit Factor', value: isFinite(results.profitFactor) ? results.profitFactor.toFixed(2) : '∞' },
                { label: 'Max Drawdown', value: `${results.maxDrawdown.toFixed(1)}%`, color: 'var(--loss-color)' },
                { label: 'Total Trades', value: results.totalTrades },
                { label: 'Gross Profit', value: `$${results.grossProfit.toFixed(2)}`, color: 'var(--profit-color)' },
                { label: 'Gross Loss', value: `-$${results.grossLoss.toFixed(2)}`, color: 'var(--loss-color)' },
              ].map((s, idx) => (
                <div key={idx}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{s.label}</div>
                  <div style={{ fontWeight: 'bold', color: s.color || '#fff' }}>{s.value}</div>
                  {s.sub && <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{s.sub}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabs & Stats */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            <button
              onClick={() => setActiveTab('charts')}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 'bold', padding: '0.75rem',
                color: activeTab === 'charts' ? 'var(--text-main)' : 'var(--text-muted)',
                borderBottom: activeTab === 'charts' ? '2px solid #faad14' : 'none'
              }}
            >
              📊 Charts
            </button>
            <button
              onClick={() => setActiveTab('log')}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 'bold', padding: '0.75rem',
                color: activeTab === 'log' ? 'var(--text-main)' : 'var(--text-muted)',
                borderBottom: activeTab === 'log' ? '2px solid #faad14' : 'none'
              }}
            >
              📋 Trade History ({trades.length})
            </button>
          </div>
          {results && (
            <div style={{ fontSize: '0.9rem', color: '#0ecb81', fontWeight: 'bold' }}>
              Final Balance: ${fmtPrice(10000 + results.netPnl)}
            </div>
          )}
        </div>

        {/* Chart View */}
        <div style={{ display: activeTab === 'charts' ? 'flex' : 'none', flexDirection: 'column', gap: '1rem', flex: 1, overflowY: 'auto' }}>
          <div className="glass-panel" style={{ flex: '0 0 auto', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', padding: '0 1rem' }}>
              <h5 className="m-0" style={{ color: '#faad14' }}>Market Chart (Gold/XAUUSD)</h5>
              <button
                onClick={() => setShowMarkers(v => !v)}
                style={{
                  background: showMarkers ? 'rgba(250,173,20,0.2)' : 'transparent',
                  color: showMarkers ? '#faad14' : 'var(--text-muted)',
                  border: `1px solid ${showMarkers ? '#faad14' : '#444'}`,
                  padding: '0.2rem 0.6rem',
                  borderRadius: '4px',
                  fontSize: '0.7rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {showMarkers ? '● Showing Markers' : 'Showing Markers'}
              </button>
            </div>
            <div ref={chartRef} style={{ width: '100%', height: '400px' }} />
          </div>

          <div className="glass-panel" style={{ padding: '1rem' }}>
            <h5 className="m-0" style={{ color: '#faad14', marginBottom: '0.5rem' }}>Indicator Details</h5>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
              <div style={{ background: 'var(--bg-dark)', padding: '0.5rem', borderRadius: '4px' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>EMA 20</div>
                <div style={{ color: '#faad14', fontWeight: 'bold' }}>Fast Signal</div>
              </div>
              <div style={{ background: 'var(--bg-dark)', padding: '0.5rem', borderRadius: '4px' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>EMA 50</div>
                <div style={{ color: '#6366f1', fontWeight: 'bold' }}>Slow Signal</div>
              </div>
              <div style={{ background: 'var(--bg-dark)', padding: '0.5rem', borderRadius: '4px' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Leverage</div>
                <div style={{ color: '#fff', fontWeight: 'bold' }}>{leverage}x</div>
              </div>
              <div style={{ background: 'var(--bg-dark)', padding: '0.5rem', borderRadius: '4px' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Contract</div>
                <div style={{ color: '#fff', fontWeight: 'bold' }}>{ozPerStdLot * lots} oz</div>
              </div>
            </div>
          </div>
        </div>

        {/* Trade Log View */}
        <div style={{ display: activeTab === 'log' ? 'block' : 'none', flex: 1, overflowY: 'auto' }}>
          {trades.length > 0 ? (
            <div className="glass-panel" style={{ padding: '0' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 10 }}>
                  <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ textAlign: 'left', padding: '1rem' }}>Direction / Time</th>
                    <th>Entry $</th>
                    <th>Exit $</th>
                    <th>Lots</th>
                    <th style={{ textAlign: 'right', paddingRight: '1rem' }}>PnL ($)</th>
                    <th style={{ textAlign: 'right', paddingRight: '1rem' }}>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {[...trades].reverse().map((t, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }} className="hover-row">
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ color: t.type === 'LONG' ? 'var(--profit-color)' : 'var(--loss-color)', fontWeight: 'bold', fontSize: '0.9rem' }}>{t.type}</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t.entryTime} → {t.exitTime}</span>
                        </div>
                      </td>
                      <td>${fmtPrice(t.entryPrice)}</td>
                      <td>${fmtPrice(t.exitPrice)}</td>
                      <td style={{ color: '#faad14' }}>{t.lots}</td>
                      <td style={{ textAlign: 'right', color: t.pnl >= 0 ? 'var(--profit-color)' : 'var(--loss-color)', fontWeight: 'bold', paddingRight: '1rem' }}>{fmtPnl(t.pnl)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.75rem', paddingRight: '1rem' }}>{t.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📃</div>
              No trades reported yet. Run the backtest to see details here.
            </div>
          )}
        </div>

        {!results && !loading && (
          <div className="glass-panel" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ fontSize: '3rem' }}>🪙</div>
            <div style={{ color: 'var(--text-muted)' }}>กำหนด Lot Size และ Strategy แล้วกด <strong>Run Backtest</strong> เพื่อทดสอบกลยุทธ์บนราคาทองคำ</div>
          </div>
        )}
      </div>
    </div>
  );
}
