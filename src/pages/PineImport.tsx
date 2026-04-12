import { useState, useRef, useEffect } from 'react';
import { createChart, ColorType, LineSeries } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Trade {
  type: string;
  entryPrice: number;
  exitPrice: number;
  entryTime: string;
  exitTime: string;
  pnl: number;
  pnlPct: number;
  exitReason: string;
}

interface BacktestResult {
  totalTrades: number;
  winRate: number;
  netPnlPct: number;
  totalPnl: number;
  sharpeRatio: number;
  maxDrawdown: number;
  profitFactor: number;
  equityCurve: Array<{ time: number | string; value: number }>;
  trades: Trade[];
}

interface BacktestConfig {
  symbol: string;
  interval: string;
  tpPercent: number;
  slPercent: number;
  leverage: number;
  capital: number;
  startDate: string;
  endDate: string;
}

interface PineImportState {
  pineScript: string;
  pythonCode: string;
  className: string;
  backtestConfig: BacktestConfig;
  backtestResult: BacktestResult | null;
  phase: 'idle' | 'converting' | 'preview' | 'backtesting' | 'results' | 'saving' | 'saved';
  error: string | null;
  strategyName: string;
}

// ─── Validation ───────────────────────────────────────────────────────────────

interface ValidationResult {
  isValid: boolean;
  error: string | null;
}

export function validatePineScript(input: string): ValidationResult {
  if (input.length < 10) {
    return { isValid: false, error: 'Pine Script ไม่ถูกต้องหรือสั้นเกินไป' };
  }
  if (input.length > 200000) {
    return { isValid: false, error: 'Pine Script ยาวเกินขีดจำกัด (200,000 ตัวอักษร)' };
  }
  const hasKeyword = input.includes('//@version') || input.includes('strategy(') || input.includes('indicator(');
  if (!hasKeyword) {
    return { isValid: false, error: 'Pine Script ต้องมี keyword //@version, strategy( หรือ indicator(' };
  }
  return { isValid: true, error: null };
}

// ─── Default state ────────────────────────────────────────────────────────────

const defaultConfig: BacktestConfig = {
  symbol: 'BTCUSDT',
  interval: '1h',
  tpPercent: 2.0,
  slPercent: 1.0,
  leverage: 10,
  capital: 10000,
  startDate: '',
  endDate: '',
};

// ─── Shared input style ───────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg-dark)',
  border: '1px solid var(--border-color)',
  color: 'var(--text-main)',
  padding: '0.4rem',
  borderRadius: '4px',
  marginTop: '0.2rem',
  boxSizing: 'border-box',
};

// ─── Component ────────────────────────────────────────────────────────────────

interface SavedStrategy {
  key: string;
  name: string;
}

export default function PineImport() {
  const [state, setState] = useState<PineImportState>({
    pineScript: '',
    pythonCode: '',
    className: '',
    backtestConfig: defaultConfig,
    backtestResult: null,
    phase: 'idle',
    error: null,
    strategyName: '',
  });
  const [isRunningBacktest, setIsRunningBacktest] = useState(false);
  const [saveNameError, setSaveNameError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedStrategies, setSavedStrategies] = useState<SavedStrategy[]>([]);

  const fetchSavedStrategies = async () => {
    try {
      const res = await fetch('/api/pine-script/list');
      if (res.ok) {
        const data = await res.json();
        setSavedStrategies(data.strategies ?? []);
      }
    } catch {
      // silently ignore
    }
  };

  useEffect(() => {
    fetchSavedStrategies();
  }, []);

  const validation = validatePineScript(state.pineScript);
  const isConverting = state.phase === 'converting';

  // Equity curve chart refs
  const equityChartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<IChartApi | null>(null);
  const equitySeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  // Init/destroy equity chart when entering/leaving results phase
  useEffect(() => {
    if (state.phase !== 'results') {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.remove();
        chartInstanceRef.current = null;
        equitySeriesRef.current = null;
      }
      return;
    }
    if (!equityChartRef.current || chartInstanceRef.current) return;

    const chart = createChart(equityChartRef.current, {
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#848e9c' },
      grid: { vertLines: { color: '#2b313f' }, horzLines: { color: '#2b313f' } },
      timeScale: { timeVisible: true, secondsVisible: false },
      rightPriceScale: { autoScale: true },
      autoSize: true,
    });
    chartInstanceRef.current = chart;
    const series = chart.addSeries(LineSeries, { color: '#0ecb81', lineWidth: 2 });
    equitySeriesRef.current = series;

    if (state.backtestResult?.equityCurve?.length) {
      const TZ_OFFSET = 7 * 3600;
      const data = state.backtestResult.equityCurve.map(p => ({
        time: (typeof p.time === 'number'
          ? Math.floor(p.time / 1000) + TZ_OFFSET
          : p.time) as Time,
        value: p.value,
      }));
      series.setData(data);
      chart.timeScale().fitContent();
    }
  }, [state.phase, state.backtestResult]);

  const handleConvert = async () => {
    if (!validation.isValid || isConverting) return;
    setState(s => ({ ...s, phase: 'converting', error: null }));
    try {
      const res = await fetch('/api/pine-script/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pineScript: state.pineScript }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setState(s => ({ ...s, phase: 'idle', error: data.error || 'เกิดข้อผิดพลาดในการแปลง' }));
        return;
      }
      setState(s => ({ ...s, phase: 'preview', pythonCode: data.pythonCode, className: data.className }));
    } catch {
      setState(s => ({ ...s, phase: 'idle', error: 'Network error — กรุณาตรวจสอบการเชื่อมต่อ' }));
    }
  };

  const handleBacktest = async () => {
    setIsRunningBacktest(true);
    setState(s => ({ ...s, phase: 'backtesting', error: null }));
    try {
      const res = await fetch('/api/pine-script/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pythonCode: state.pythonCode, config: state.backtestConfig }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setState(s => ({ ...s, phase: 'preview', error: data.error || 'เกิดข้อผิดพลาดในการรัน Backtest' }));
        return;
      }
      setState(s => ({ ...s, phase: 'results', backtestResult: data as BacktestResult }));
    } catch {
      setState(s => ({ ...s, phase: 'preview', error: 'Network error — กรุณาตรวจสอบการเชื่อมต่อ' }));
    } finally {
      setIsRunningBacktest(false);
    }
  };

  const handleSave = async () => {
    const name = state.strategyName.trim();
    if (!name) return;
    if (!/^[a-zA-Z0-9 ]+$/.test(name)) {
      setSaveNameError('ชื่อ strategy ใช้ได้เฉพาะตัวอักษร ตัวเลข และ space');
      return;
    }
    setSaveNameError(null);
    setIsSaving(true);
    setState(s => ({ ...s, phase: 'saving', error: null }));
    try {
      const res = await fetch('/api/pine-script/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pythonCode: state.pythonCode, name }),
      });
      const data = await res.json();
      if (res.status === 409) {
        setState(s => ({ ...s, phase: 'results', error: `ชื่อ strategy "${name}" มีอยู่แล้ว กรุณาใช้ชื่ออื่น` }));
        return;
      }
      if (!res.ok || data.error) {
        setState(s => ({ ...s, phase: 'results', error: data.error || 'เกิดข้อผิดพลาดในการบันทึก' }));
        return;
      }
      setState(s => ({ ...s, phase: 'saved' }));
      fetchSavedStrategies();
    } catch {
      setState(s => ({ ...s, phase: 'results', error: 'Network error — กรุณาตรวจสอบการเชื่อมต่อ' }));
    } finally {
      setIsSaving(false);
    }
  };

  const updateConfig = (patch: Partial<BacktestConfig>) =>
    setState(s => ({ ...s, backtestConfig: { ...s.backtestConfig, ...patch } }));

  const cfg = state.backtestConfig;
  const result = state.backtestResult;
  const sign = (n: number) => (n >= 0 ? '+' : '');

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '1rem', height: 'calc(100vh - 80px)', overflow: 'hidden' }}>

      {/* ── Left panel: Input Section ── */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', overflowY: 'auto', padding: '1rem' }}>
        <h4 className="m-0" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', fontSize: '1rem' }}>
          Pine Script Importer
        </h4>

        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          วาง Pine Script ที่นี่
          <textarea
            value={state.pineScript}
            onChange={e => setState(s => ({ ...s, pineScript: e.target.value, error: null }))}
            placeholder={`//@version=5\nstrategy("My Strategy", overlay=true)\n\n// วาง Pine Script ของคุณที่นี่...`}
            rows={18}
            maxLength={210000}
            style={{
              display: 'block',
              width: '100%',
              marginTop: '0.3rem',
              background: 'var(--bg-dark)',
              border: `1px solid ${state.pineScript.length > 0 && !validation.isValid ? 'var(--loss-color)' : 'var(--border-color)'}`,
              color: 'var(--text-main)',
              padding: '0.5rem',
              borderRadius: '4px',
              fontFamily: 'monospace',
              fontSize: '0.78rem',
              resize: 'vertical',
              lineHeight: 1.5,
              boxSizing: 'border-box',
            }}
          />
        </label>

        {/* Character count */}
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'right', marginTop: '-0.5rem' }}>
          {state.pineScript.length.toLocaleString()} / 200,000
        </div>

        {/* Inline validation error */}
        {state.pineScript.length > 0 && validation.error && (
          <div style={{ background: 'rgba(246,70,93,0.12)', border: '1px solid var(--loss-color)', borderRadius: '4px', padding: '0.5rem 0.75rem', color: 'var(--loss-color)', fontSize: '0.82rem' }}>
            ⚠ {validation.error}
          </div>
        )}

        {/* API-level error */}
        {state.error && (
          <div style={{ background: 'rgba(246,70,93,0.12)', border: '1px solid var(--loss-color)', borderRadius: '4px', padding: '0.5rem 0.75rem', color: 'var(--loss-color)', fontSize: '0.82rem' }}>
            {state.error}
          </div>
        )}

        {/* Convert button */}
        <button
          onClick={handleConvert}
          disabled={!validation.isValid || isConverting}
          style={{
            background: validation.isValid && !isConverting ? 'var(--accent-primary)' : 'var(--bg-dark)',
            color: validation.isValid && !isConverting ? '#fff' : 'var(--text-muted)',
            border: '1px solid var(--border-color)',
            padding: '0.7rem',
            borderRadius: '4px',
            fontWeight: 'bold',
            cursor: validation.isValid && !isConverting ? 'pointer' : 'not-allowed',
            fontSize: '0.9rem',
            marginTop: '0.25rem',
          }}
        >
          {isConverting ? '⏳ กำลังแปลง...' : '⚡ แปลง'}
        </button>

        {/* Imported Strategies list */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
          <h5 style={{ margin: '0 0 0.5rem', fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Imported Strategies
          </h5>
          {savedStrategies.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              ยังไม่มี strategy ที่ import
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              {savedStrategies.map(s => (
                <div
                  key={s.key}
                  style={{
                    background: 'var(--bg-dark)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    padding: '0.35rem 0.6rem',
                    fontSize: '0.78rem',
                    color: 'var(--text-main)',
                    fontFamily: 'monospace',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={s.key}
                >
                  {s.key}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', paddingRight: '0.25rem' }}>

        {/* phase: idle */}
        {state.phase === 'idle' && (
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '0.75rem', color: 'var(--text-muted)', minHeight: '300px' }}>
            <span style={{ fontSize: '2.5rem' }}>🌲</span>
            <p style={{ margin: 0, fontSize: '0.95rem' }}>วาง Pine Script ทางซ้าย แล้วกด "แปลง" เพื่อเริ่มต้น</p>
          </div>
        )}

        {/* phase: converting */}
        {state.phase === 'converting' && (
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '0.75rem', color: 'var(--text-muted)', minHeight: '300px' }}>
            <span style={{ fontSize: '2rem' }}>⏳</span>
            <p style={{ margin: 0 }}>กำลังแปลง Pine Script เป็น Python...</p>
          </div>
        )}

        {/* phase: preview */}
        {state.phase === 'preview' && (
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1, padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <h4 className="m-0" style={{ fontSize: '1rem' }}>
                🐍 Python Code ที่แปลงแล้ว
                {state.className && (
                  <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                    — {state.className}
                  </span>
                )}
              </h4>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setState(s => ({ ...s, phase: 'idle', pythonCode: '', className: '', error: null }))}
                  style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.82rem' }}
                >
                  🔄 แปลงใหม่
                </button>
                <button
                  onClick={handleBacktest}
                  style={{ background: 'var(--accent-primary)', border: '1px solid var(--accent-primary)', color: '#fff', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 'bold' }}
                >
                  ▶ รัน Backtest
                </button>
              </div>
            </div>

            {/* Backtest config form */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.6rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Symbol
                <input type="text" value={cfg.symbol} onChange={e => updateConfig({ symbol: e.target.value })} style={inputStyle} />
              </label>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Interval
                <select value={cfg.interval} onChange={e => updateConfig({ interval: e.target.value })} style={inputStyle}>
                  <option value="5m">5m</option>
                  <option value="15m">15m</option>
                  <option value="1h">1h</option>
                  <option value="4h">4h</option>
                  <option value="1d">1d</option>
                </select>
              </label>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                TP%
                <input type="number" step="0.5" value={cfg.tpPercent} onChange={e => updateConfig({ tpPercent: parseFloat(e.target.value) })} style={inputStyle} />
              </label>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                SL%
                <input type="number" step="0.5" value={cfg.slPercent} onChange={e => updateConfig({ slPercent: parseFloat(e.target.value) })} style={inputStyle} />
              </label>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Leverage
                <input type="number" min="1" max="125" value={cfg.leverage} onChange={e => updateConfig({ leverage: parseFloat(e.target.value) })} style={inputStyle} />
              </label>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Capital
                <input type="number" value={cfg.capital} onChange={e => updateConfig({ capital: parseFloat(e.target.value) })} style={inputStyle} />
              </label>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Start Date
                <input type="date" value={cfg.startDate} onChange={e => updateConfig({ startDate: e.target.value })} style={{ ...inputStyle, fontSize: '0.72rem' }} />
              </label>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                End Date
                <input type="date" value={cfg.endDate} onChange={e => updateConfig({ endDate: e.target.value })} style={{ ...inputStyle, fontSize: '0.72rem' }} />
              </label>
            </div>

            <textarea
              value={state.pythonCode}
              onChange={e => setState(s => ({ ...s, pythonCode: e.target.value }))}
              spellCheck={false}
              style={{
                flex: 1,
                minHeight: '300px',
                background: '#1a1a2e',
                border: '1px solid var(--border-color)',
                color: '#e2e8f0',
                padding: '0.75rem',
                borderRadius: '4px',
                fontFamily: '"Fira Code", "Cascadia Code", "Consolas", monospace',
                fontSize: '0.8rem',
                lineHeight: 1.6,
                resize: 'vertical',
                boxSizing: 'border-box',
                width: '100%',
              }}
            />

            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              💡 คุณสามารถแก้ไข code ด้านบนก่อนรัน Backtest ได้
            </p>
          </div>
        )}

        {/* phase: backtesting — loading indicator */}
        {state.phase === 'backtesting' && isRunningBacktest && (
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '0.75rem', color: 'var(--text-muted)', minHeight: '300px' }}>
            <span style={{ fontSize: '2rem' }}>⏳</span>
            <p style={{ margin: 0 }}>กำลังรัน Backtest...</p>
          </div>
        )}

        {/* phase: results */}
        {state.phase === 'results' && result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* Header with re-run button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 className="m-0" style={{ fontSize: '1rem' }}>📊 ผลลัพธ์ Backtest</h4>
              <button
                onClick={() => setState(s => ({ ...s, phase: 'preview', error: null }))}
                style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.82rem' }}
              >
                🔄 รัน Backtest อีกครั้ง
              </button>
            </div>

            {/* Metrics cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.6rem' }}>
              {[
                { label: 'Net PnL%', value: result.totalTrades > 0 ? `${sign(result.netPnlPct)}${result.netPnlPct.toFixed(2)}%` : '--', color: result.totalTrades > 0 ? (result.netPnlPct >= 0 ? 'var(--profit-color)' : 'var(--loss-color)') : '#fff' },
                { label: 'Win Rate', value: result.totalTrades > 0 ? `${result.winRate.toFixed(1)}%` : '--', color: '#fff' },
                { label: 'Total Trades', value: String(result.totalTrades), color: '#fff' },
                { label: 'Sharpe Ratio', value: result.totalTrades > 0 ? result.sharpeRatio.toFixed(2) : '--', color: '#fff' },
                { label: 'Max Drawdown', value: result.totalTrades > 0 ? `${(result.maxDrawdown * 100).toFixed(2)}%` : '--', color: 'var(--loss-color)' },
                { label: 'Profit Factor', value: result.totalTrades > 0 ? result.profitFactor.toFixed(2) : '--', color: '#fff' },
              ].map((m, i) => (
                <div key={i} className="glass-panel" style={{ padding: '0.6rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>{m.label}</div>
                  <div style={{ fontSize: '1rem', fontWeight: 'bold', color: m.color }}>{m.value}</div>
                </div>
              ))}
            </div>

            {/* No signals message */}
            {result.totalTrades === 0 && (
              <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                กลยุทธ์นี้ไม่มีสัญญาณในช่วงเวลาที่เลือก กรุณาปรับพารามิเตอร์
              </div>
            )}

            {/* Equity curve */}
            {result.totalTrades > 0 && (
              <div className="glass-panel" style={{ padding: '1rem' }}>
                <h5 className="m-0" style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>Equity Curve</h5>
                <div style={{ height: '200px', border: '1px solid var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div ref={equityChartRef} style={{ width: '100%', height: '100%' }} />
                </div>
              </div>
            )}

            {/* Trades table */}
            {result.totalTrades > 0 && (
              <div className="glass-panel" style={{ overflow: 'auto', maxHeight: '320px' }}>
                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 10 }}>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '0.5rem' }}>Type</th>
                      <th>Entry Price</th>
                      <th>Exit Price</th>
                      <th>Entry Time</th>
                      <th>Exit Time</th>
                      <th style={{ textAlign: 'right' }}>PnL</th>
                      <th style={{ textAlign: 'right' }}>Exit Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.trades.map((trade, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.5rem', color: trade.type === 'LONG' ? 'var(--profit-color)' : 'var(--loss-color)', fontWeight: 'bold' }}>{trade.type}</td>
                        <td>${trade.entryPrice.toFixed(2)}</td>
                        <td>${trade.exitPrice.toFixed(2)}</td>
                        <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{trade.entryTime}</td>
                        <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{trade.exitTime}</td>
                        <td style={{ textAlign: 'right', color: trade.pnl >= 0 ? 'var(--profit-color)' : 'var(--loss-color)', fontWeight: 'bold' }}>
                          {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{trade.exitReason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Save section */}
            <div className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <h5 className="m-0" style={{ fontSize: '0.9rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.4rem' }}>
                💾 บันทึก Strategy
              </h5>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                ชื่อ Strategy
                <input
                  type="text"
                  value={state.strategyName}
                  onChange={e => {
                    const val = e.target.value;
                    setState(s => ({ ...s, strategyName: val, error: null }));
                    setSaveNameError(
                      val.length > 0 && !/^[a-zA-Z0-9 ]+$/.test(val)
                        ? 'ชื่อ strategy ใช้ได้เฉพาะตัวอักษร ตัวเลข และ space'
                        : null
                    );
                  }}
                  placeholder="เช่น My EMA Strategy"
                  style={{
                    ...inputStyle,
                    border: `1px solid ${saveNameError ? 'var(--loss-color)' : 'var(--border-color)'}`,
                  }}
                />
              </label>
              {saveNameError && (
                <div style={{ color: 'var(--loss-color)', fontSize: '0.8rem' }}>⚠ {saveNameError}</div>
              )}
              {state.error && (
                <div style={{ background: 'rgba(246,70,93,0.12)', border: '1px solid var(--loss-color)', borderRadius: '4px', padding: '0.5rem 0.75rem', color: 'var(--loss-color)', fontSize: '0.82rem' }}>
                  {state.error}
                </div>
              )}
              <button
                onClick={handleSave}
                disabled={!state.strategyName.trim() || !!saveNameError || isSaving}
                style={{
                  background: !state.strategyName.trim() || !!saveNameError || isSaving ? 'var(--bg-dark)' : 'var(--accent-primary)',
                  color: !state.strategyName.trim() || !!saveNameError || isSaving ? 'var(--text-muted)' : '#fff',
                  border: '1px solid var(--border-color)',
                  padding: '0.6rem 1rem',
                  borderRadius: '4px',
                  fontWeight: 'bold',
                  cursor: !state.strategyName.trim() || !!saveNameError || isSaving ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                  alignSelf: 'flex-start',
                }}
              >
                {isSaving ? '⏳ กำลังบันทึก...' : '💾 บันทึก Strategy'}
              </button>
            </div>

          </div>
        )}

        {/* phase: saved */}
        {state.phase === 'saved' && (
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '1rem', padding: '2rem', minHeight: '300px', textAlign: 'center' }}>
            <span style={{ fontSize: '3rem' }}>✅</span>
            <p style={{ margin: 0, fontSize: '1rem', color: 'var(--profit-color)', fontWeight: 'bold' }}>
              บันทึก strategy '{state.strategyName.trim()}' สำเร็จ พร้อมใช้งานใน Live Bot แล้ว
            </p>
            <button
              onClick={() => setState({
                pineScript: '',
                pythonCode: '',
                className: '',
                backtestConfig: defaultConfig,
                backtestResult: null,
                phase: 'idle',
                error: null,
                strategyName: '',
              })}
              style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', padding: '0.5rem 1.2rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.88rem' }}
            >
              🔄 เริ่มใหม่
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
