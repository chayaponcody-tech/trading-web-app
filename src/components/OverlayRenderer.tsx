import { useEffect, useRef } from 'react';
import { LineSeries, LineStyle } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, IPriceLine, Time } from 'lightweight-charts';
import type { OverlayData, OverlayToggleState, Trade } from '../utils/backtestUtils';
import { convertOverlayData, OVERLAY_COLORS } from '../utils/backtestUtils';

const TZ_OFFSET = 7 * 3600;

// ─── OverlayRenderer ─────────────────────────────────────────────────────────

interface OverlayRendererProps {
  chart: IChartApi | null;
  candleSeries: ISeriesApi<'Candlestick'> | null;
  rsiChartRef: React.RefObject<IChartApi | null>;
  overlayData: OverlayData;
  trades: Trade[];
  selectedTrade: Trade | null;
  strategy: string;
  showMarkers: boolean;
  toggleStates: OverlayToggleState;
  onToggleChange: (key: keyof OverlayToggleState, value: boolean) => void;
}

export default function OverlayRenderer({
  chart,
  candleSeries,
  rsiChartRef,
  overlayData,
  selectedTrade,
  toggleStates,
  onToggleChange
}: OverlayRendererProps) {
  const ema20SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema50SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbUpperRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbMiddleRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbLowerRef = useRef<ISeriesApi<'Line'> | null>(null);
  const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const zoneSeriesRef = useRef<ISeriesApi<'Line'>[]>([]);

  // Trade level price line refs
  const entryLineRef = useRef<IPriceLine | null>(null);
  const tp1LineRef   = useRef<IPriceLine | null>(null);
  const tp2LineRef   = useRef<IPriceLine | null>(null);
  const tp3LineRef   = useRef<IPriceLine | null>(null);
  const slLineRef    = useRef<IPriceLine | null>(null);

  const removeTradeLevels = (series: ISeriesApi<'Candlestick'>) => {
    [entryLineRef, tp1LineRef, tp2LineRef, tp3LineRef, slLineRef].forEach(ref => {
      if (ref.current) { try { series.removePriceLine(ref.current); } catch { /* ignore */ } ref.current = null; }
    });
  };

  // ─── Indicator series lifecycle ───────────────────────────────────────────
  useEffect(() => {
    if (!chart) return;
    let rafId: number;
    const apply = () => {
      try {
        const range = chart.timeScale().getVisibleLogicalRange();
        if (!range) return;
      } catch { return; }

      // Cleanup existing
      [ema20SeriesRef, ema50SeriesRef, bbUpperRef, bbMiddleRef, bbLowerRef].forEach(ref => {
        if (ref.current) { try { chart.removeSeries(ref.current); } catch { /* ignore */ } ref.current = null; }
      });
      if (rsiSeriesRef.current && rsiChartRef.current) {
        try { rsiChartRef.current.removeSeries(rsiSeriesRef.current); } catch { /* ignore */ }
        rsiSeriesRef.current = null;
      }
      zoneSeriesRef.current.forEach(s => { try { chart.removeSeries(s); } catch { /* ignore */ } });
      zoneSeriesRef.current = [];

      // EMAs
      if (overlayData.ema20?.length) {
        const s = chart.addSeries(LineSeries, { color: OVERLAY_COLORS.ema20, lineWidth: 2 });
        try { s.setData(convertOverlayData(overlayData.ema20)); } catch { /* ignore */ }
        s.applyOptions({ visible: toggleStates.ema20 });
        ema20SeriesRef.current = s;
      }
      if (overlayData.ema50?.length) {
        const s = chart.addSeries(LineSeries, { color: OVERLAY_COLORS.ema50, lineWidth: 2 });
        try { s.setData(convertOverlayData(overlayData.ema50)); } catch { /* ignore */ }
        s.applyOptions({ visible: toggleStates.ema50 });
        ema50SeriesRef.current = s;
      }
      
      // Bollinger Bands
      if (overlayData.bbUpper?.length) {
        const s = chart.addSeries(LineSeries, { color: OVERLAY_COLORS.bbUpper, lineStyle: LineStyle.Dashed });
        try { s.setData(convertOverlayData(overlayData.bbUpper)); } catch { /* ignore */ }
        s.applyOptions({ visible: toggleStates.bb });
        bbUpperRef.current = s;
      }
      if (overlayData.bbMiddle?.length) {
        const s = chart.addSeries(LineSeries, { color: OVERLAY_COLORS.bbMiddle });
        try { s.setData(convertOverlayData(overlayData.bbMiddle)); } catch { /* ignore */ }
        s.applyOptions({ visible: toggleStates.bb });
        bbMiddleRef.current = s;
      }
      if (overlayData.bbLower?.length) {
        const s = chart.addSeries(LineSeries, { color: OVERLAY_COLORS.bbLower, lineStyle: LineStyle.Dashed });
        try { s.setData(convertOverlayData(overlayData.bbLower)); } catch { /* ignore */ }
        s.applyOptions({ visible: toggleStates.bb });
        bbLowerRef.current = s;
      }

      // RSI (Sub-panel)
      if (overlayData.rsi?.length && rsiChartRef.current) {
        const s = rsiChartRef.current.addSeries(LineSeries, { color: OVERLAY_COLORS.rsi, lineWidth: 1 });
        try { s.setData(convertOverlayData(overlayData.rsi)); } catch { /* ignore */ }
        s.applyOptions({ visible: toggleStates.rsi });
        s.createPriceLine({ price: 70, color: '#f6465d', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'OB' });
        s.createPriceLine({ price: 30, color: '#0ecb81', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'OS' });
        rsiSeriesRef.current = s;
      }

      // Zones (HOB/OB/BB)
      if (overlayData.zones?.length) {
        overlayData.zones.forEach(z => {
          // Note: z.startTime from our utils already reflects the candle time (which may have TZ_OFFSET)
          const t1_val = Math.floor(new Date(z.startTime).getTime() / 1000);
          if (isNaN(t1_val)) return;
          const t1 = t1_val as Time;
          
          // Use z.endTime if exists, else use "Now" adjusted to Chart Time
          let t2_val = z.endTime 
            ? Math.floor(new Date(z.endTime).getTime() / 1000)
            : Math.floor(Date.now() / 1000) + TZ_OFFSET;
          
          // Safety: Lightweight Charts REQUIRES t2 > t1.
          // If data is invalid or reversed, we push t2 slightly ahead of t1.
          if (isNaN(t2_val) || t2_val <= t1_val) {
            t2_val = t1_val + 1;
          }
          const t2 = t2_val as Time;
          
          const color = z.type === 'HOB' ? '#00d1ff' : (z.type === 'BB' ? '#f6465d' : '#9c27b0');
          const visibility = toggleStates.zones || false;

          const addZoneLine = (val: number, style: LineStyle = LineStyle.Solid) => {
            if (isNaN(val)) return;
            const s = chart.addSeries(LineSeries, { 
              color, 
              lineWidth: 1, 
              lineStyle: style, 
              priceLineVisible: false,
              visible: visibility 
            });
            try {
              s.setData([{ time: t1, value: val }, { time: t2, value: val }]);
              zoneSeriesRef.current.push(s);
            } catch (err) {
              // Silently catch sorting errors to prevent full app crash
              console.warn("Zone rendering skip:", err);
            }
          };

          addZoneLine(z.top);
          addZoneLine(z.bottom);
          if (z.mid) addZoneLine(z.mid, LineStyle.Dashed);
        });
      }
    };
    rafId = requestAnimationFrame(apply);
    return () => {
      cancelAnimationFrame(rafId);
      if (!chart) return;
      [ema20SeriesRef, ema50SeriesRef, bbUpperRef, bbMiddleRef, bbLowerRef].forEach(ref => {
        if (ref.current) { try { chart.removeSeries(ref.current); } catch { /* ignore */ } ref.current = null; }
      });
      if (rsiSeriesRef.current && rsiChartRef.current) {
        try { rsiChartRef.current.removeSeries(rsiSeriesRef.current); } catch { /* ignore */ }
        rsiSeriesRef.current = null;
      }
      zoneSeriesRef.current.forEach(s => { try { chart.removeSeries(s); } catch { /* ignore */ } });
      zoneSeriesRef.current = [];
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlayData, chart, candleSeries, rsiChartRef, toggleStates.zones]);

  // ─── Sync toggle visibility ────────────────────────────────────────────────
  useEffect(() => {
    if (ema20SeriesRef.current) ema20SeriesRef.current.applyOptions({ visible: toggleStates.ema20 });
    if (ema50SeriesRef.current) ema50SeriesRef.current.applyOptions({ visible: toggleStates.ema50 });
    if (bbUpperRef.current)    bbUpperRef.current.applyOptions({ visible: toggleStates.bb });
    if (bbMiddleRef.current)   bbMiddleRef.current.applyOptions({ visible: toggleStates.bb });
    if (bbLowerRef.current)    bbLowerRef.current.applyOptions({ visible: toggleStates.bb });
    if (rsiSeriesRef.current)  rsiSeriesRef.current.applyOptions({ visible: toggleStates.rsi });
    zoneSeriesRef.current.forEach(s => s.applyOptions({ visible: toggleStates.zones }));
  }, [toggleStates]);

  // ─── Trade level lines (Entry / TP1 / TP2 / TP3 / SL) ────────────────────
  useEffect(() => {
    if (!candleSeries) return;
    removeTradeLevels(candleSeries);
    if (!selectedTrade || !toggleStates.levels) return;

    const { entryPrice, tpPrice, tp2Price, tp3Price, slPrice, type } = selectedTrade;
    const isLong = type === 'LONG';

    entryLineRef.current = candleSeries.createPriceLine({
      price: entryPrice,
      color: '#ffffff',
      lineWidth: 1,
      lineStyle: LineStyle.Solid,
      axisLabelVisible: true,
      title: `ENTRY ${entryPrice.toFixed(2)}`,
    });

    if (tpPrice > 0) {
      tp1LineRef.current = candleSeries.createPriceLine({
        price: tpPrice,
        color: '#0ecb81',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `TP1 ${tpPrice.toFixed(2)}`,
      });
    }

    const tp2 = tp2Price ?? (tpPrice > 0 ? entryPrice + (tpPrice - entryPrice) * 2 * (isLong ? 1 : -1) : 0);
    if (tp2 > 0) {
      tp2LineRef.current = candleSeries.createPriceLine({
        price: tp2,
        color: '#00e5a0',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `TP2 ${tp2.toFixed(2)}`,
      });
    }

    const tp3 = tp3Price ?? (tpPrice > 0 ? entryPrice + (tpPrice - entryPrice) * 3 * (isLong ? 1 : -1) : 0);
    if (tp3 > 0) {
      tp3LineRef.current = candleSeries.createPriceLine({
        price: tp3,
        color: '#00ffc8',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `TP3 ${tp3.toFixed(2)}`,
      });
    }

    if (slPrice > 0) {
      slLineRef.current = candleSeries.createPriceLine({
        price: slPrice,
        color: '#f6465d',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `SL ${slPrice.toFixed(2)}`,
      });
    }

    return () => { if (candleSeries) removeTradeLevels(candleSeries); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTrade, candleSeries, toggleStates.levels]);

  return null;
}

// ─── OverlayToggleControls ────────────────────────────────────────────────────

interface OverlayToggleControlsProps {
  overlayData: OverlayData;
  toggleStates: OverlayToggleState;
  onToggleChange: (key: keyof OverlayToggleState, value: boolean) => void;
}

const toggleBtnStyle = (active: boolean, color: string): React.CSSProperties => ({
  padding: '0.25rem 0.6rem',
  borderRadius: '4px',
  border: `1px solid ${active ? color : 'var(--border-color)'}`,
  background: active ? `${color}22` : 'transparent',
  color: active ? color : 'var(--text-muted)',
  cursor: 'pointer',
  fontSize: '0.75rem',
  fontWeight: 600,
  transition: 'all 0.2s ease',
  fontFamily: 'Outfit, sans-serif',
});

export function OverlayToggleControls({
  overlayData,
  toggleStates,
  onToggleChange,
}: OverlayToggleControlsProps) {
  const hasEma20 = !!(overlayData.ema20 && overlayData.ema20.length > 0);
  const hasEma50 = !!(overlayData.ema50 && overlayData.ema50.length > 0);
  const hasBB    = !!(overlayData.bbUpper && overlayData.bbUpper.length > 0);
  const hasRsi   = !!(overlayData.rsi && overlayData.rsi.length > 0);
  const hasZones = !!(overlayData.zones && overlayData.zones.length > 0);

  if (!hasEma20 && !hasEma50 && !hasBB && !hasRsi && !hasZones) return null;

  return (
    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
      {hasEma20 && (
        <button
          style={toggleBtnStyle(toggleStates.ema20, OVERLAY_COLORS.ema20)}
          onClick={() => onToggleChange('ema20', !toggleStates.ema20)}
        >
          EMA20
        </button>
      )}
      {hasEma50 && (
        <button
          style={toggleBtnStyle(toggleStates.ema50, OVERLAY_COLORS.ema50)}
          onClick={() => onToggleChange('ema50', !toggleStates.ema50)}
        >
          EMA50
        </button>
      )}
      {hasBB && (
        <button
          style={toggleBtnStyle(toggleStates.bb, OVERLAY_COLORS.bbUpper)}
          onClick={() => onToggleChange('bb', !toggleStates.bb)}
        >
          BB
        </button>
      )}
      {hasRsi && (
        <button
          style={toggleBtnStyle(toggleStates.rsi, OVERLAY_COLORS.rsi)}
          onClick={() => onToggleChange('rsi', !toggleStates.rsi)}
        >
          RSI
        </button>
      )}
      {hasZones && (
        <button
          style={toggleBtnStyle(toggleStates.zones, '#00d1ff')}
          onClick={() => onToggleChange('zones', !toggleStates.zones)}
        >
          Zones
        </button>
      )}
      <button
        style={toggleBtnStyle(toggleStates.levels, '#ffffff')}
        onClick={() => onToggleChange('levels', !toggleStates.levels)}
      >
        Levels
      </button>
    </div>
  );
}
