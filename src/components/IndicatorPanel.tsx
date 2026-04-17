import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, LineSeries, HistogramSeries } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import { CANDLE_CHART_OPTIONS } from '../utils/chartConfig';

interface CandleData {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface IndicatorPanelProps {
  candles: CandleData[];
  syncChart: IChartApi | null; // candle chart to sync with
}

// ── Calculation helpers ──────────────────────────────────────────────────────

function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = new Array(values.length).fill(NaN);
  let prev = values[period - 1];
  result[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    result[i] = prev;
  }
  return result;
}

function calcMACD(closes: number[]) {
  const fast = ema(closes, 12);
  const slow = ema(closes, 26);
  const macdLine = closes.map((_, i) => (isNaN(fast[i]) || isNaN(slow[i])) ? NaN : fast[i] - slow[i]);
  const validMacd = macdLine.map(v => isNaN(v) ? 0 : v);
  const signal = ema(validMacd, 9);
  const hist = macdLine.map((v, i) => isNaN(v) || isNaN(signal[i]) ? NaN : v - signal[i]);
  return { macdLine, signal, hist };
}

function calcStoch(highs: number[], lows: number[], closes: number[], k = 14, d = 3) {
  const kLine: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < k - 1) { kLine.push(NaN); continue; }
    const slice_h = highs.slice(i - k + 1, i + 1);
    const slice_l = lows.slice(i - k + 1, i + 1);
    const hh = Math.max(...slice_h);
    const ll = Math.min(...slice_l);
    kLine.push(hh === ll ? 50 : ((closes[i] - ll) / (hh - ll)) * 100);
  }
  const dLine: number[] = kLine.map((_, i) => {
    if (i < k - 1 + d - 1) return NaN;
    const slice = kLine.slice(i - d + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / d;
  });
  return { kLine, dLine };
}

// ── Component ────────────────────────────────────────────────────────────────

type IndicatorType = 'macd' | 'stoch' | 'volume';

export default function IndicatorPanel({ candles, syncChart }: IndicatorPanelProps) {
  const [active, setActive] = useState<IndicatorType[]>([]);

  const macdContainerRef = useRef<HTMLDivElement>(null);
  const stochContainerRef = useRef<HTMLDivElement>(null);
  const volContainerRef = useRef<HTMLDivElement>(null);

  const macdChartRef = useRef<IChartApi | null>(null);
  const stochChartRef = useRef<IChartApi | null>(null);
  const volChartRef = useRef<IChartApi | null>(null);

  const TZ_OFFSET = 7 * 3600;

  const makeChart = (container: HTMLDivElement): IChartApi =>
    createChart(container, {
      ...CANDLE_CHART_OPTIONS,
      height: 120,
    });

  // Sync helper
  const syncWith = (child: IChartApi) => {
    if (!syncChart) return () => {};
    let busy = false;
    const handler1 = (range: unknown) => {
      if (busy || !range) return;
      busy = true;
      try {
        const logical = syncChart.timeScale().getVisibleLogicalRange();
        if (logical) child.timeScale().setVisibleLogicalRange(logical);
      } catch { /* ignore */ }
      busy = false;
    };
    const handler2 = (range: unknown) => {
      if (busy || !range) return;
      busy = true;
      try {
        const logical = child.timeScale().getVisibleLogicalRange();
        if (logical) syncChart.timeScale().setVisibleLogicalRange(logical);
      } catch { /* ignore */ }
      busy = false;
    };
    syncChart.timeScale().subscribeVisibleTimeRangeChange(handler1);
    child.timeScale().subscribeVisibleTimeRangeChange(handler2);
    return () => {
      try { syncChart.timeScale().unsubscribeVisibleTimeRangeChange(handler1); } catch { /* ignore */ }
      try { child.timeScale().unsubscribeVisibleTimeRangeChange(handler2); } catch { /* ignore */ }
    };
  };

  // ── MACD ──
  useEffect(() => {
    if (!active.includes('macd') || !macdContainerRef.current || candles.length < 35) return;
    const chart = makeChart(macdContainerRef.current);
    macdChartRef.current = chart;
    const unsyncFn = syncWith(chart);

    const closes = candles.map(c => c.close);
    const times = candles.map(c => c.time);
    const { macdLine, signal, hist } = calcMACD(closes);

    const macdSeries = chart.addSeries(LineSeries, { color: '#2196f3', lineWidth: 1 });
    const signalSeries = chart.addSeries(LineSeries, { color: '#f6a609', lineWidth: 1 });
    const histSeries = chart.addSeries(HistogramSeries, { color: '#0ecb81' });

    macdSeries.setData(times.map((t, i) => ({ time: t, value: isNaN(macdLine[i]) ? 0 : macdLine[i] })));
    signalSeries.setData(times.map((t, i) => ({ time: t, value: isNaN(signal[i]) ? 0 : signal[i] })));
    histSeries.setData(times.map((t, i) => ({
      time: t,
      value: isNaN(hist[i]) ? 0 : hist[i],
      color: (hist[i] ?? 0) >= 0 ? '#0ecb81' : '#f6465d',
    })));

    return () => { unsyncFn?.(); chart.remove(); macdChartRef.current = null; };
  }, [active, candles, syncChart]);

  // ── Stochastic ──
  useEffect(() => {
    if (!active.includes('stoch') || !stochContainerRef.current || candles.length < 17) return;
    const chart = makeChart(stochContainerRef.current);
    stochChartRef.current = chart;
    const unsyncFn = syncWith(chart);

    const { kLine, dLine } = calcStoch(
      candles.map(c => c.high),
      candles.map(c => c.low),
      candles.map(c => c.close),
    );
    const times = candles.map(c => c.time);

    const kSeries = chart.addSeries(LineSeries, { color: '#0ecb81', lineWidth: 1 });
    const dSeries = chart.addSeries(LineSeries, { color: '#f6a609', lineWidth: 1 });

    kSeries.setData(times.map((t, i) => ({ time: t, value: isNaN(kLine[i]) ? 50 : kLine[i] })));
    dSeries.setData(times.map((t, i) => ({ time: t, value: isNaN(dLine[i]) ? 50 : dLine[i] })));

    // Overbought/oversold lines
    const ob = chart.addSeries(LineSeries, { color: 'rgba(246,70,93,0.4)', lineWidth: 1 });
    const os = chart.addSeries(LineSeries, { color: 'rgba(14,203,129,0.4)', lineWidth: 1 });
    ob.setData(times.map(t => ({ time: t, value: 80 })));
    os.setData(times.map(t => ({ time: t, value: 20 })));

    return () => { unsyncFn?.(); chart.remove(); stochChartRef.current = null; };
  }, [active, candles, syncChart]);

  // ── Volume ──
  useEffect(() => {
    if (!active.includes('volume') || !volContainerRef.current || candles.length === 0) return;
    const chart = makeChart(volContainerRef.current);
    volChartRef.current = chart;
    const unsyncFn = syncWith(chart);

    const volSeries = chart.addSeries(HistogramSeries, { color: '#2196f3', priceScaleId: 'right' });
    volSeries.setData(candles.map(c => ({
      time: c.time,
      value: (c as any).volume ?? 0,
      color: c.close >= c.open ? 'rgba(14,203,129,0.6)' : 'rgba(246,70,93,0.6)',
    })));

    return () => { unsyncFn?.(); chart.remove(); volChartRef.current = null; };
  }, [active, candles, syncChart]);

  const toggle = (ind: IndicatorType) =>
    setActive(prev => prev.includes(ind) ? prev.filter(x => x !== ind) : [...prev, ind]);

  const btnStyle = (on: boolean): React.CSSProperties => ({
    background: on ? 'var(--accent-primary)' : 'var(--bg-dark)',
    color: on ? '#fff' : 'var(--text-main)',
    border: '1px solid #444',
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.7rem',
    cursor: 'pointer',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {/* Toggle bar */}
      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Indicators:</span>
        <button onClick={() => toggle('volume')} style={btnStyle(active.includes('volume'))}>Volume</button>
        <button onClick={() => toggle('macd')} style={btnStyle(active.includes('macd'))}>MACD</button>
        <button onClick={() => toggle('stoch')} style={btnStyle(active.includes('stoch'))}>Stoch(14,3)</button>
      </div>

      {/* Sub-panels */}
      {active.includes('volume') && (
        <div className="glass-panel" style={{ padding: '0.5rem' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Volume</div>
          <div ref={volContainerRef} style={{ height: '80px' }} />
        </div>
      )}
      {active.includes('macd') && (
        <div className="glass-panel" style={{ padding: '0.5rem' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
            MACD (12,26,9) — <span style={{ color: '#2196f3' }}>MACD</span> / <span style={{ color: '#f6a609' }}>Signal</span> / Hist
          </div>
          <div ref={macdContainerRef} style={{ height: '120px' }} />
        </div>
      )}
      {active.includes('stoch') && (
        <div className="glass-panel" style={{ padding: '0.5rem' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
            Stochastic (14,3) — <span style={{ color: '#0ecb81' }}>%K</span> / <span style={{ color: '#f6a609' }}>%D</span>
          </div>
          <div ref={stochContainerRef} style={{ height: '120px' }} />
        </div>
      )}
    </div>
  );
}
