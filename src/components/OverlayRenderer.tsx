import { useEffect, useRef } from 'react';
import { LineSeries, LineStyle } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, IPriceLine } from 'lightweight-charts';
import type { OverlayData, OverlayToggleState, Trade } from '../utils/backtestUtils';
import { convertOverlayData, OVERLAY_COLORS } from '../utils/backtestUtils';

// ─── OverlayRenderer ─────────────────────────────────────────────────────────

interface OverlayRendererProps {
  chart: IChartApi | null;
  candleSeries: ISeriesApi<'Candlestick'> | null;
  rsiChartRef: React.RefObject<IChartApi | null>;
  overlayData: OverlayData;
  trades: Trade[];
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
  trades,
  toggleStates,
}: OverlayRendererProps) {
  // Indicator series refs
  const ema20SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema50SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbUpperRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbMiddleRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbLowerRef = useRef<ISeriesApi<'Line'> | null>(null);
  const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  // TP/SL price line refs
  const tpLineRef = useRef<IPriceLine | null>(null);
  const slLineRef = useRef<IPriceLine | null>(null);

  // ─── Task 4.2 + 6.2: Indicator series lifecycle ───────────────────────────
  useEffect(() => {
    if (!chart) return;

    // Defer overlay rendering to next animation frame so lightweight-charts
    // has finished updating its internal timeScale after candleSeries.setData().
    // Without this, getVisibleLogicalRange() returns null and throws ensureNotNull.
    let rafId: number;
    const apply = () => {
      try {
        const range = chart.timeScale().getVisibleLogicalRange();
        if (!range) return; // chart has no data yet — overlayData change will re-trigger
      } catch {
        return;
      }

      // Cleanup old series on main chart
      if (ema20SeriesRef.current) { try { chart.removeSeries(ema20SeriesRef.current); } catch { /* ignore */ } ema20SeriesRef.current = null; }
      if (ema50SeriesRef.current) { try { chart.removeSeries(ema50SeriesRef.current); } catch { /* ignore */ } ema50SeriesRef.current = null; }
      if (bbUpperRef.current)    { try { chart.removeSeries(bbUpperRef.current); }    catch { /* ignore */ } bbUpperRef.current = null; }
      if (bbMiddleRef.current)   { try { chart.removeSeries(bbMiddleRef.current); }   catch { /* ignore */ } bbMiddleRef.current = null; }
      if (bbLowerRef.current)    { try { chart.removeSeries(bbLowerRef.current); }    catch { /* ignore */ } bbLowerRef.current = null; }

      // Cleanup old RSI series on RSI chart
      if (rsiSeriesRef.current && rsiChartRef.current) {
        try { rsiChartRef.current.removeSeries(rsiSeriesRef.current); } catch { /* ignore */ }
        rsiSeriesRef.current = null;
      }

      // EMA 20
      if (overlayData.ema20 && overlayData.ema20.length > 0) {
        const s = chart.addSeries(LineSeries, { color: OVERLAY_COLORS.ema20, lineWidth: 2 });
        try { s.setData(convertOverlayData(overlayData.ema20)); } catch { /* ignore */ }
        s.applyOptions({ visible: toggleStates.ema20 });
        ema20SeriesRef.current = s;
      }

      // EMA 50
      if (overlayData.ema50 && overlayData.ema50.length > 0) {
        const s = chart.addSeries(LineSeries, { color: OVERLAY_COLORS.ema50, lineWidth: 2 });
        try { s.setData(convertOverlayData(overlayData.ema50)); } catch { /* ignore */ }
        s.applyOptions({ visible: toggleStates.ema50 });
        ema50SeriesRef.current = s;
      }

      // BB Upper (dashed)
      if (overlayData.bbUpper && overlayData.bbUpper.length > 0) {
        const s = chart.addSeries(LineSeries, { color: OVERLAY_COLORS.bbUpper, lineStyle: LineStyle.Dashed });
        try { s.setData(convertOverlayData(overlayData.bbUpper)); } catch { /* ignore */ }
        s.applyOptions({ visible: toggleStates.bb });
        bbUpperRef.current = s;
      }

      // BB Middle (solid)
      if (overlayData.bbMiddle && overlayData.bbMiddle.length > 0) {
        const s = chart.addSeries(LineSeries, { color: OVERLAY_COLORS.bbMiddle });
        try { s.setData(convertOverlayData(overlayData.bbMiddle)); } catch { /* ignore */ }
        s.applyOptions({ visible: toggleStates.bb });
        bbMiddleRef.current = s;
      }

      // BB Lower (dashed)
      if (overlayData.bbLower && overlayData.bbLower.length > 0) {
        const s = chart.addSeries(LineSeries, { color: OVERLAY_COLORS.bbLower, lineStyle: LineStyle.Dashed });
        try { s.setData(convertOverlayData(overlayData.bbLower)); } catch { /* ignore */ }
        s.applyOptions({ visible: toggleStates.bb });
        bbLowerRef.current = s;
      }

      // RSI — rendered on separate RSI chart
      if (overlayData.rsi && overlayData.rsi.length > 0 && rsiChartRef.current) {
        const s = rsiChartRef.current.addSeries(LineSeries, { color: OVERLAY_COLORS.rsi, lineWidth: 1 });
        try { s.setData(convertOverlayData(overlayData.rsi)); } catch { /* ignore */ }
        s.applyOptions({ visible: toggleStates.rsi });
        s.createPriceLine({ price: 70, color: '#f6465d', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'OB' });
        s.createPriceLine({ price: 30, color: '#0ecb81', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'OS' });
        rsiSeriesRef.current = s;
      }
    };

    rafId = requestAnimationFrame(apply);

    return () => {
      cancelAnimationFrame(rafId);
      if (!chart) return;
      if (ema20SeriesRef.current) { try { chart.removeSeries(ema20SeriesRef.current); } catch { /* ignore */ } ema20SeriesRef.current = null; }
      if (ema50SeriesRef.current) { try { chart.removeSeries(ema50SeriesRef.current); } catch { /* ignore */ } ema50SeriesRef.current = null; }
      if (bbUpperRef.current)    { try { chart.removeSeries(bbUpperRef.current); }    catch { /* ignore */ } bbUpperRef.current = null; }
      if (bbMiddleRef.current)   { try { chart.removeSeries(bbMiddleRef.current); }   catch { /* ignore */ } bbMiddleRef.current = null; }
      if (bbLowerRef.current)    { try { chart.removeSeries(bbLowerRef.current); }    catch { /* ignore */ } bbLowerRef.current = null; }
      if (rsiSeriesRef.current && rsiChartRef.current) {
        try { rsiChartRef.current.removeSeries(rsiSeriesRef.current); } catch { /* ignore */ }
        rsiSeriesRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlayData, chart, candleSeries, rsiChartRef]);

  // ─── Sync toggle visibility ────────────────────────────────────────────────
  useEffect(() => {
    if (ema20SeriesRef.current) ema20SeriesRef.current.applyOptions({ visible: toggleStates.ema20 });
    if (ema50SeriesRef.current) ema50SeriesRef.current.applyOptions({ visible: toggleStates.ema50 });
    if (bbUpperRef.current)    bbUpperRef.current.applyOptions({ visible: toggleStates.bb });
    if (bbMiddleRef.current)   bbMiddleRef.current.applyOptions({ visible: toggleStates.bb });
    if (bbLowerRef.current)    bbLowerRef.current.applyOptions({ visible: toggleStates.bb });
    if (rsiSeriesRef.current)  rsiSeriesRef.current.applyOptions({ visible: toggleStates.rsi });
  }, [toggleStates]);

  // ─── Task 4.3: TP/SL price lines ──────────────────────────────────────────
  useEffect(() => {
    if (!candleSeries) return;

    // Remove old price lines
    if (tpLineRef.current) { try { candleSeries.removePriceLine(tpLineRef.current); } catch { /* ignore */ } tpLineRef.current = null; }
    if (slLineRef.current) { try { candleSeries.removePriceLine(slLineRef.current); } catch { /* ignore */ } slLineRef.current = null; }

    if (trades.length === 0) return;

    const lastTrade = trades[trades.length - 1];
    const { tpPrice, slPrice } = lastTrade;

    if (tpPrice > 0) {
      tpLineRef.current = candleSeries.createPriceLine({
        price: tpPrice,
        color: '#0ecb81',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `TP / ${tpPrice.toFixed(2)}`,
      });
    }

    if (slPrice > 0) {
      slLineRef.current = candleSeries.createPriceLine({
        price: slPrice,
        color: '#f6465d',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `SL / ${slPrice.toFixed(2)}`,
      });
    }

    return () => {
      if (!candleSeries) return;
      if (tpLineRef.current) { try { candleSeries.removePriceLine(tpLineRef.current); } catch { /* ignore */ } tpLineRef.current = null; }
      if (slLineRef.current) { try { candleSeries.removePriceLine(slLineRef.current); } catch { /* ignore */ } slLineRef.current = null; }
    };
  }, [trades, candleSeries]);

  // Non-rendering component
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

  if (!hasEma20 && !hasEma50 && !hasBB && !hasRsi) return null;

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
    </div>
  );
}
