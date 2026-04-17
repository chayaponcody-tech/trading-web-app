import { useState, useEffect, useRef } from 'react';
import type { IChartApi, ISeriesApi, MouseEventParams, Time } from 'lightweight-charts';

type DrawMode = 'none' | 'hline' | 'trendline' | 'rect';

interface Point { time: number; price: number; }

interface Drawing {
  id: string;
  type: DrawMode;
  points: Point[];
  color: string;
}

interface DrawingToolsProps {
  chart: IChartApi | null;
  candleSeries: ISeriesApi<'Candlestick'> | null;
}

const COLORS = ['#f6a609', '#0ecb81', '#f6465d', '#2196f3', '#9c27b0', '#ffffff'];

export default function DrawingTools({ chart, candleSeries }: DrawingToolsProps) {
  const [mode, setMode] = useState<DrawMode>('none');
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [pendingPoints, setPendingPoints] = useState<Point[]>([]);
  const [color, setColor] = useState('#f6a609');
  const [showPanel, setShowPanel] = useState(false);

  // Canvas overlay for drawing
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Attach canvas on top of chart
  useEffect(() => {
    if (!chart) return;
    const chartEl = (chart as any)._private__chartWidget?._private__element as HTMLElement | undefined;
    if (!chartEl) return;

    const parent = chartEl.parentElement;
    if (!parent) return;

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:5;';
    parent.style.position = 'relative';
    parent.appendChild(canvas);
    canvasRef.current = canvas;

    const resize = () => {
      canvas.width = parent.offsetWidth;
      canvas.height = parent.offsetHeight;
      redraw();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(parent);
    resize();

    return () => {
      ro.disconnect();
      canvas.remove();
      canvasRef.current = null;
    };
  }, [chart]);

  const getCoords = (p: Point): { x: number; y: number } | null => {
    if (!chart || !candleSeries || !canvasRef.current) return null;
    try {
      const x = chart.timeScale().timeToCoordinate(p.time as Time);
      const y = candleSeries.priceToCoordinate(p.price);
      if (x === null || y === null) return null;
      return { x, y };
    } catch { return null; }
  };

  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const d of drawings) {
      ctx.strokeStyle = d.color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);

      if (d.type === 'hline' && d.points[0]) {
        const c = getCoords(d.points[0]);
        if (!c) continue;
        ctx.beginPath();
        ctx.setLineDash([6, 3]);
        ctx.moveTo(0, c.y);
        ctx.lineTo(canvas.width, c.y);
        ctx.stroke();
        // Label
        ctx.font = '11px monospace';
        ctx.fillStyle = d.color;
        ctx.fillText(d.points[0].price.toFixed(2), 4, c.y - 3);
      }

      if (d.type === 'trendline' && d.points.length === 2) {
        const c1 = getCoords(d.points[0]);
        const c2 = getCoords(d.points[1]);
        if (!c1 || !c2) continue;
        ctx.beginPath();
        ctx.moveTo(c1.x, c1.y);
        ctx.lineTo(c2.x, c2.y);
        ctx.stroke();
      }

      if (d.type === 'rect' && d.points.length === 2) {
        const c1 = getCoords(d.points[0]);
        const c2 = getCoords(d.points[1]);
        if (!c1 || !c2) continue;
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = d.color;
        ctx.fillRect(c1.x, c1.y, c2.x - c1.x, c2.y - c1.y);
        ctx.globalAlpha = 1;
        ctx.strokeRect(c1.x, c1.y, c2.x - c1.x, c2.y - c1.y);
      }
    }
  };

  // Redraw whenever drawings or chart updates
  useEffect(() => {
    redraw();
  }, [drawings, chart]);

  // Subscribe to chart clicks for drawing
  useEffect(() => {
    if (!chart || mode === 'none') return;

    const handler = (param: MouseEventParams<Time>) => {
      if (!param.point || !param.time) return;
      const price = candleSeries?.coordinateToPrice(param.point.y);
      if (price === null || price === undefined) return;
      const pt: Point = { time: param.time as number, price };

      if (mode === 'hline') {
        const id = `${Date.now()}`;
        setDrawings(prev => [...prev, { id, type: 'hline', points: [pt], color }]);
        setMode('none');
        return;
      }

      setPendingPoints(prev => {
        const next = [...prev, pt];
        if ((mode === 'trendline' || mode === 'rect') && next.length === 2) {
          const id = `${Date.now()}`;
          setDrawings(d => [...d, { id, type: mode, points: next, color }]);
          setMode('none');
          return [];
        }
        return next;
      });
    };

    chart.subscribeClick(handler);
    return () => chart.unsubscribeClick(handler);
  }, [chart, mode, color, candleSeries]);

  // Redraw on chart scroll/zoom
  useEffect(() => {
    if (!chart) return;
    const unsub = chart.timeScale().subscribeVisibleTimeRangeChange(() => redraw());
    return unsub;
  }, [chart, drawings]);

  const btnStyle = (active = false): React.CSSProperties => ({
    background: active ? 'var(--accent-primary)' : 'var(--bg-dark)',
    color: active ? '#fff' : 'var(--text-main)',
    border: '1px solid #444',
    padding: '0.25rem 0.55rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
    cursor: 'pointer',
  });

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setShowPanel(v => !v)} style={btnStyle(showPanel || mode !== 'none')} title="Drawing tools">
        ✏ Draw
      </button>

      {showPanel && (
        <div style={{
          position: 'absolute', top: '110%', right: 0, zIndex: 100,
          background: 'var(--bg-card)', border: '1px solid var(--border-color)',
          borderRadius: '6px', padding: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.5rem',
          minWidth: '160px', boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Drawing Tools</div>
          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
            <button onClick={() => { setMode('hline'); setPendingPoints([]); }} style={btnStyle(mode === 'hline')} title="Horizontal line">— H-Line</button>
            <button onClick={() => { setMode('trendline'); setPendingPoints([]); }} style={btnStyle(mode === 'trendline')} title="Trend line">↗ Trend</button>
            <button onClick={() => { setMode('rect'); setPendingPoints([]); }} style={btnStyle(mode === 'rect')} title="Rectangle">▭ Rect</button>
          </div>

          {mode !== 'none' && (
            <div style={{ fontSize: '0.7rem', color: '#f6a609' }}>
              {mode === 'hline' ? 'Click on chart to place line' :
               pendingPoints.length === 0 ? 'Click first point' : 'Click second point'}
            </div>
          )}

          {/* Color picker */}
          <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Color:</span>
            {COLORS.map(c => (
              <div
                key={c}
                onClick={() => setColor(c)}
                style={{
                  width: 16, height: 16, borderRadius: '50%', background: c, cursor: 'pointer',
                  border: color === c ? '2px solid #fff' : '2px solid transparent',
                }}
              />
            ))}
          </div>

          {/* Clear button */}
          {drawings.length > 0 && (
            <button
              onClick={() => { setDrawings([]); setMode('none'); }}
              style={{ ...btnStyle(), color: 'var(--loss-color)', fontSize: '0.7rem' }}
            >
              🗑 Clear All ({drawings.length})
            </button>
          )}

          {/* List of drawings with delete */}
          {drawings.length > 0 && (
            <div style={{ maxHeight: '120px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              {drawings.map(d => (
                <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  <span style={{ color: d.color }}>■</span>
                  <span>{d.type} @ {d.points[0]?.price.toFixed(2)}</span>
                  <button
                    onClick={() => setDrawings(prev => prev.filter(x => x.id !== d.id))}
                    style={{ background: 'transparent', border: 'none', color: 'var(--loss-color)', cursor: 'pointer', fontSize: '0.8rem' }}
                  >✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
