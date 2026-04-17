import { useState, useEffect, useCallback, KeyboardEvent } from 'react';
import { Tag, X, Loader2 } from 'lucide-react';
import type { StrategyDefinition, MultiAssetBacktestResult, RandomWindowBacktestResult } from '../../types/strategy';
import { getStrategies, deleteStrategy, runMultiAssetBacktest, runRandomWindowBacktest } from '../../api/strategyApi';
import { useStrategyList, JS_STRATEGIES } from '../../hooks/useStrategyList';
import MultiSymbolSelector from '../../components/MultiSymbolSelector';
import StrategyForm from './StrategyForm';
import BacktestHistoryPanel from './BacktestHistoryPanel';
import BacktestResultPanel from './BacktestResultPanel';
import StrategyParamsForm from '../../components/StrategyParamsForm';
import StrategyDropdown from '../../components/StrategyDropdown';
import { getStrategyParams, getDefaultParams } from '../../utils/strategyParams';
// ─── Date formatter ───────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

// ─── Engine badge ─────────────────────────────────────────────────────────────

function EngineBadge({ type }: { type: 'js' | 'python' }) {
  const isJs = type === 'js';
  return (
    <span
      style={{
        fontSize: '0.7rem',
        fontWeight: 700,
        padding: '0.15rem 0.5rem',
        borderRadius: '4px',
        background: isJs ? 'rgba(234,179,8,0.2)' : 'rgba(59,130,246,0.2)',
        color: isJs ? '#fde047' : '#93c5fd',
        border: `1px solid ${isJs ? 'rgba(234,179,8,0.3)' : 'rgba(59,130,246,0.3)'}`,
        whiteSpace: 'nowrap',
      }}
    >
      {isJs ? 'JS' : 'Python'}
    </span>
  );
}

// ─── Simple Markdown Renderer ─────────────────────────────────────────────────

function SimpleMarkdown({ text }: { text: string }) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('### ')) {
      elements.push(<h3 key={i} style={{ margin: '0.75rem 0 0.25rem', fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>{line.slice(4)}</h3>);
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={i} style={{ margin: '0.75rem 0 0.25rem', fontSize: '1.05rem', fontWeight: 700, color: '#fff' }}>{line.slice(3)}</h2>);
    } else if (line.startsWith('# ')) {
      elements.push(<h1 key={i} style={{ margin: '0.75rem 0 0.25rem', fontSize: '1.15rem', fontWeight: 700, color: '#fff' }}>{line.slice(2)}</h1>);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(<li key={i} style={{ marginLeft: '1.2rem', fontSize: '0.85rem', color: 'var(--text-muted,#aaa)', lineHeight: 1.6 }}>{renderInline(line.slice(2))}</li>);
    } else if (line.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(<pre key={i} style={{ margin: '0.5rem 0', padding: '0.6rem 0.75rem', background: 'rgba(0,0,0,0.4)', borderRadius: '6px', fontSize: '0.78rem', color: '#e2e8f0', overflowX: 'auto' }}>{codeLines.join('\n')}</pre>);
    } else if (line.trim() === '') {
      elements.push(<br key={i} />);
    } else {
      elements.push(<p key={i} style={{ margin: '0.2rem 0', fontSize: '0.85rem', color: 'var(--text-muted,#aaa)', lineHeight: 1.6 }}>{renderInline(line)}</p>);
    }
    i++;
  }

  return <div>{elements}</div>;
}

function renderInline(text: string): React.ReactNode {
  // Bold **text**
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={i} style={{ background: 'rgba(0,0,0,0.3)', padding: '0.1rem 0.3rem', borderRadius: '3px', fontSize: '0.8rem', fontFamily: 'monospace' }}>{part.slice(1, -1)}</code>;
    return part;
  });
}

// ─── Strategy Detail Modal ────────────────────────────────────────────────────

function StrategyDetailModal({ strategy, isBuiltin, onClose, onEdit, onDelete }: { 
  strategy: StrategyDefinition; 
  isBuiltin: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const params = getStrategyParams(strategy.name);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="glass-panel"
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: '560px', maxHeight: '85vh', overflowY: 'auto', borderRadius: '16px', padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{strategy.name}</span>
            <EngineBadge type={strategy.engineType} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {!isBuiltin && (
              <>
                <button onClick={onEdit} className="btn-outline" style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem', borderRadius: '6px' }}>แก้ไข</button>
                <button onClick={onDelete} className="btn-outline" style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem', borderRadius: '6px', color: 'var(--text-loss,#f6465d)', border: '1px solid rgba(246,70,93,0.3)' }}>ลบ</button>
              </>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}>✕</button>
          </div>
        </div>

        {/* Description — rendered as Markdown */}
        {strategy.description && (
          <SimpleMarkdown text={strategy.description} />
        )}

        {/* Tags */}
        {strategy.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {strategy.tags.map(tag => (
              <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.72rem', fontWeight: 600, padding: '0.15rem 0.55rem', borderRadius: '100px', background: 'rgba(0,209,255,0.1)', color: 'var(--accent-primary,#00d1ff)', border: '1px solid rgba(0,209,255,0.2)' }}>
                <Tag size={10} />{tag}
              </span>
            ))}
          </div>
        )}

        {/* Strategy Params */}
        {params.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Parameters</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {params.map(p => (
                <div key={p.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0.75rem', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', fontSize: '0.82rem' }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{p.label}</span>
                    <span style={{ marginLeft: '0.5rem', color: '#666', fontFamily: 'monospace', fontSize: '0.75rem' }}>({p.key})</span>
                    {p.hint && <div style={{ fontSize: '0.72rem', color: '#666', marginTop: '0.1rem' }}>{p.hint}</div>}
                  </div>
                  <span style={{ color: 'var(--accent-primary,#00d1ff)', fontFamily: 'monospace', fontSize: '0.8rem' }}>default: {p.default}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Default Params JSON */}
        {strategy.defaultParams && Object.keys(strategy.defaultParams).length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Default Params</div>
            <pre style={{ margin: 0, padding: '0.75rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', fontSize: '0.78rem', color: '#e2e8f0', overflowX: 'auto' }}>
              {JSON.stringify(strategy.defaultParams, null, 2)}
            </pre>
          </div>
        )}

        {/* Python Code */}
        {strategy.pythonCode && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Python Code</div>
            <pre style={{ margin: 0, padding: '0.75rem', background: '#1a1a2e', borderRadius: '8px', fontSize: '0.75rem', color: '#e2e8f0', overflowX: 'auto', maxHeight: '300px', overflowY: 'auto' }}>
              {strategy.pythonCode}
            </pre>
          </div>
        )}

        {/* Meta */}
        <div style={{ fontSize: '0.72rem', color: '#555', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.75rem' }}>
          {strategy.createdAt && <>สร้าง: {formatDate(strategy.createdAt)}</>}
          {strategy.updatedAt && <> · อัปเดต: {formatDate(strategy.updatedAt)}</>}
        </div>
      </div>
    </div>
  );
}

// ─── Strategy Card ────────────────────────────────────────────────────────────

interface StrategyCardProps {
  strategy: StrategyDefinition;
  isBuiltin: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}

function StrategyCard({ strategy, isBuiltin, isSelected, onSelect, onView, onEdit, onDelete, deleting }: StrategyCardProps) {
  return (
    <div
      className="glass-panel"
      style={{
        padding: '1rem 1.25rem',
        cursor: 'pointer',
        border: isSelected
          ? '1px solid var(--accent-primary, #00d1ff)'
          : '1px solid var(--border-color, rgba(255,255,255,0.1))',
        transition: 'border-color 0.15s',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.6rem',
      }}
      onClick={onSelect}
    >
      {/* Top row: name + engine badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, fontSize: '0.95rem', flex: 1, minWidth: 0 }}>
          {strategy.name}
        </span>
        <EngineBadge type={strategy.engineType} />
      </div>

      {/* Bottom row: updatedAt + action buttons */}
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}
        onClick={e => e.stopPropagation()}
      >
        {isBuiltin ? (
          <span style={{
            fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.5rem',
            borderRadius: '4px', background: 'rgba(14,203,129,0.1)',
            color: 'var(--profit-color, #0ecb81)', border: '1px solid rgba(14,203,129,0.2)',
          }}>
            built-in
          </span>
        ) : (
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #888)' }}>
            อัปเดต {formatDate(strategy.updatedAt)}
          </span>
        )}
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button
            className="btn-outline"
            onClick={onView}
            style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem', borderRadius: '6px' }}
          >
            ดูรายละเอียด
          </button>
          {!isBuiltin && (
            <>
              <button
                className="btn-outline"
                onClick={onEdit}
                style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem', borderRadius: '6px' }}
              >
                แก้ไข
              </button>
              <button
                className="btn-outline"
                onClick={onDelete}
                disabled={deleting}
                style={{
                  padding: '0.3rem 0.75rem',
                  fontSize: '0.78rem',
                  borderRadius: '6px',
                  color: 'var(--text-loss, #f6465d)',
                  border: '1px solid rgba(246,70,93,0.3)',
                  opacity: deleting ? 0.5 : 1,
                  cursor: deleting ? 'not-allowed' : 'pointer',
                }}
              >
                {deleting ? '...' : 'ลบ'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

interface ConfirmDialogProps {
  strategyName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({ strategyName, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="glass-panel"
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: '400px', padding: '1.75rem', borderRadius: '16px' }}
      >
        <h3 style={{ margin: '0 0 0.75rem', fontSize: '1.1rem', fontWeight: 700 }}>ยืนยันการลบ</h3>
        <p style={{ margin: '0 0 1.5rem', fontSize: '0.9rem', color: 'var(--text-muted, #888)' }}>
          ต้องการลบกลยุทธ์ <strong style={{ color: '#fff' }}>{strategyName}</strong> ใช่หรือไม่?
          การกระทำนี้ไม่สามารถย้อนกลับได้
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button className="btn-outline" onClick={onCancel} style={{ padding: '0.5rem 1.25rem', borderRadius: '8px' }}>
            ยกเลิก
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '0.5rem 1.25rem', borderRadius: '8px',
              background: 'rgba(246,70,93,0.8)', color: '#fff',
              border: '1px solid rgba(246,70,93,0.5)',
              cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem',
            }}
          >
            ลบ
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Shared input styles ──────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.65rem 0.75rem',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
  color: '#fff',
  borderRadius: '8px',
  fontSize: '0.9rem',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  fontWeight: 700,
  color: '#aaa',
};

const errorStyle: React.CSSProperties = {
  fontSize: '0.78rem',
  color: 'var(--text-loss, #f6465d)',
};

// ─── Date helpers ─────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function daysAgoStr(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Convert "YYYY-MM-DD" date input value to ISO 8601 with time component */
function toISODate(dateStr: string, endOfDay = false): string {
  if (!dateStr) return '';
  return endOfDay ? `${dateStr}T23:59:59.000Z` : `${dateStr}T00:00:00.000Z`;
}

/** Interval string → milliseconds */
const INTERVAL_MS: Record<string, number> = {
  '1m': 60_000, '5m': 300_000, '15m': 900_000,
  '30m': 1_800_000, '1h': 3_600_000, '4h': 14_400_000, '1d': 86_400_000,
};

// ─── Multi-Asset Backtest Form ────────────────────────────────────────────────

interface MultiAssetBacktestFormProps {
  onResult: (result: MultiAssetBacktestResult, config: { interval: string; startDate: string; endDate: string }) => void;
}

function MultiAssetBacktestForm({ onResult }: MultiAssetBacktestFormProps) {
  const { strategyList, warning: strategyWarning } = useStrategyList();
  const [strategyKey, setStrategyKey] = useState('');
  const [symbols, setSymbols] = useState<string[]>([]);
  const [interval, setInterval] = useState('1h');
  const [startDate, setStartDate] = useState(daysAgoStr(90));
  // endDate is always "now" — user cannot change it, actual ISO is computed at submit time
  const endDate = todayStr();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [symbolsError, setSymbolsError] = useState<string | null>(null);

  // ── Backtest parameters ──
  const [capital, setCapital] = useState(10000);
  const [leverage, setLeverage] = useState(10);
  const [tpPercent, setTpPercent] = useState(2.0);
  const [slPercent, setSlPercent] = useState(1.0);
  // Dynamic strategy-specific params
  const [strategyParams, setStrategyParams] = useState<Record<string, number | string>>({});

  // Reset params when strategy changes
  const handleStrategyChange = (key: string) => {
    setStrategyKey(key);
    const strategy = strategyList.find(s => (s.id || s.key) === key);
    const dynamicDefaults = Object.fromEntries((strategy?.parameters || []).map((p: any) => [p.key, p.default]));
    const staticDefaults = getDefaultParams(key);
    setStrategyParams({ ...staticDefaults, ...dynamicDefaults });
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (symbols.length < 1 || symbols.length > 20) {
      setSymbolsError('ต้องมี 1–20 symbols');
      return;
    }
    setSymbolsError(null);
    if (!strategyKey || !interval || !startDate || !endDate) {
      setError('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    // Validate date range is wide enough for the selected interval
    const diffDays = (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000;
    const minDays: Record<string, number> = { '1m': 1, '5m': 2, '15m': 4, '1h': 3, '4h': 10, '1d': 60 };
    const required = minDays[interval] ?? 3;
    if (diffDays < required) {
      setError(`Interval ${interval} ต้องการช่วงเวลาอย่างน้อย ${required} วัน`);
      return;
    }

    setRunning(true);
    try {
      // endDate = now snapped to current bar, startDate = now - same range user selected
      const intervalMs = INTERVAL_MS[interval] ?? 3_600_000;
      const rangeMs = diffDays * 86_400_000;
      const endMs = Math.floor(Date.now() / intervalMs) * intervalMs;
      const startMs = endMs - rangeMs;
      const startISO = new Date(startMs).toISOString();
      const endISO = new Date(endMs).toISOString();
      const result = await runMultiAssetBacktest(strategyKey, {
        symbols,
        interval,
        startDate: startISO,
        endDate: endISO,
        params: { capital, leverage, tpPercent, slPercent, ...strategyParams },
      });
      onResult(result, { interval, startDate: startISO, endDate: endISO });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการรัน backtest');
    } finally {
      setRunning(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '640px' }}>

      {/* Strategy dropdown */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        <label style={labelStyle}>Strategy <span style={{ color: 'var(--text-loss, #f6465d)' }}>*</span></label>
        <select
          value={strategyKey}
          onChange={e => handleStrategyChange(e.target.value)}
          style={{ ...inputStyle, background: 'rgba(0,0,0,0.3)' }}
          disabled={running}
          required
        >
          <option value="">— เลือก Strategy —</option>
          {strategyList.map(s => (
            <option key={s.key} value={s.id ?? s.key}>
              {s.key}{s.engine === 'python' ? ' [py]' : ''}
            </option>
          ))}
        </select>
        {strategyWarning && (
          <span style={{ fontSize: '0.72rem', color: '#f6a609' }}>⚠ {strategyWarning}</span>
        )}
      </div>

      {/* Symbols */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        <label style={labelStyle}>Symbols <span style={{ color: 'var(--text-loss, #f6465d)' }}>*</span></label>
        <MultiSymbolSelector
          values={symbols}
          onChange={v => { setSymbols(v); setSymbolsError(null); }}
          max={20}
          error={symbolsError}
          disabled={running}
        />
      </div>

      {/* Interval */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        <label style={labelStyle}>Interval <span style={{ color: 'var(--text-loss, #f6465d)' }}>*</span></label>
        <select
          value={interval}
          onChange={e => setInterval(e.target.value)}
          style={{ ...inputStyle, background: 'rgba(0,0,0,0.3)' }}
          disabled={running}
        >
          {['1m', '5m', '15m', '1h', '4h', '1d'].map(iv => (
            <option key={iv} value={iv}>{iv}</option>
          ))}
        </select>
      </div>

      {/* Date range */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label style={labelStyle}>Start Date <span style={{ color: 'var(--text-loss, #f6465d)' }}>*</span></label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            style={{ ...inputStyle, colorScheme: 'dark' }}
            disabled={running}
            required
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label style={labelStyle}>End Date</label>
          <input
            type="date"
            value={endDate}
            readOnly
            style={{ ...inputStyle, colorScheme: 'dark', opacity: 0.6, cursor: 'not-allowed' }}
          />
          <span style={{ fontSize: '0.72rem', color: '#0ecb81' }}>⏱ ใช้เวลาปัจจุบันตอน run</span>
        </div>
      </div>
      <p style={{ margin: 0, fontSize: '0.72rem', color: '#666' }}>
        แนะนำช่วงเวลา: 1m=1วัน, 5m=2วัน, 15m=4วัน, 1h=3วัน, 4h=10วัน, 1d=60วัน ขึ้นไป
      </p>

      {/* ── Capital & Risk ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label style={labelStyle}>Capital (USDT)</label>
          <input type="number" min="100" step="100" value={capital}
            onChange={e => setCapital(Number(e.target.value))}
            style={inputStyle} disabled={running} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label style={labelStyle}>Leverage</label>
          <input type="number" min="1" max="125" step="1" value={leverage}
            onChange={e => setLeverage(Number(e.target.value))}
            style={inputStyle} disabled={running} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label style={labelStyle}>TP %</label>
          <input type="number" min="0.1" step="0.1" value={tpPercent}
            onChange={e => setTpPercent(Number(e.target.value))}
            style={inputStyle} disabled={running} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label style={labelStyle}>SL %</label>
          <input type="number" min="0.1" step="0.1" value={slPercent}
            onChange={e => setSlPercent(Number(e.target.value))}
            style={inputStyle} disabled={running} />
        </div>
      </div>

      {/* ── Strategy-specific Params ── */}
      {(() => {
        const strategy = strategyList.find(s => (s.id || s.key) === strategyKey);
        const dynamicParams = strategy?.parameters || [];
        const staticParams = getStrategyParams(strategyKey);
        const allParams = [...staticParams, ...dynamicParams];

        if (allParams.length === 0) return null;

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#aaa' }}>Strategy Parameters</label>
            <StrategyParamsForm
              params={allParams}
              values={strategyParams}
              onChange={(key, val) => setStrategyParams(p => ({ ...p, [key]: val }))}
              disabled={running}
            />
          </div>
        );
      })()}

      {/* Submit error */}
      {error && (
        <div style={{
          background: 'rgba(246,70,93,0.1)', border: '1px solid rgba(246,70,93,0.3)',
          borderRadius: '8px', padding: '0.75rem 1rem',
          color: 'var(--text-loss, #f6465d)', fontSize: '0.85rem',
        }}>
          {error}
        </div>
      )}

      {/* Submit button */}
      <div>
        <button
          type="submit"
          disabled={running}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.65rem 1.75rem', borderRadius: '8px',
            background: running ? 'rgba(0,209,255,0.3)' : 'var(--accent-primary, #00d1ff)',
            color: running ? 'rgba(255,255,255,0.5)' : '#000',
            border: 'none', cursor: running ? 'not-allowed' : 'pointer',
            fontWeight: 700, fontSize: '0.9rem',
          }}
        >
          {running && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
          {running ? 'กำลังรัน backtest...' : 'รัน Backtest'}
        </button>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </form>
  );
}

// ─── Random Window Backtest Form ──────────────────────────────────────────────

interface RandomWindowBacktestFormProps {
  onResult: (result: RandomWindowBacktestResult) => void;
}

function RandomWindowBacktestForm({ onResult }: RandomWindowBacktestFormProps) {
  const { strategyList, warning: strategyWarning } = useStrategyList();
  const [strategyKey, setStrategyKey] = useState('');
  const [symbols, setSymbols] = useState<string[]>([]);
  const [interval, setInterval] = useState('1h');
  const [windowDays, setWindowDays] = useState<number | ''>(30);
  const [lookbackYears, setLookbackYears] = useState<number | ''>(1);
  const [numWindows, setNumWindows] = useState<number | ''>(5);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [symbolsError, setSymbolsError] = useState<string | null>(null);
  const [windowDaysError, setWindowDaysError] = useState<string | null>(null);
  const [lookbackYearsError, setLookbackYearsError] = useState<string | null>(null);
  const [numWindowsError, setNumWindowsError] = useState<string | null>(null);

  function handleWindowDaysChange(val: string) {
    const n = val === '' ? '' : Number(val);
    setWindowDays(n);
    if (n === '') {
      setWindowDaysError('กรุณากรอกจำนวนวัน');
    } else if (n < 1 || n > 365) {
      setWindowDaysError('ต้องอยู่ในช่วง 1–365 วัน');
    } else {
      setWindowDaysError(null);
    }
  }

  function handleLookbackYearsChange(val: string) {
    const n = val === '' ? '' : Number(val);
    setLookbackYears(n);
    if (n === '') {
      setLookbackYearsError('กรุณากรอกจำนวนปี');
    } else if (n < 1 || n > 5) {
      setLookbackYearsError('ต้องอยู่ในช่วง 1–5 ปี');
    } else {
      setLookbackYearsError(null);
    }
  }

  function handleNumWindowsChange(val: string) {
    const n = val === '' ? '' : Number(val);
    setNumWindows(n);
    if (n === '') {
      setNumWindowsError('กรุณากรอกจำนวน windows');
    } else if (n < 1 || n > 10) {
      setNumWindowsError('ต้องอยู่ในช่วง 1–10 windows');
    } else {
      setNumWindowsError(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (symbols.length < 1) {
      setSymbolsError('ต้องมีอย่างน้อย 1 symbol');
      return;
    }
    if (!strategyKey || !interval) {
      setError('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }
    if (windowDaysError || lookbackYearsError || numWindowsError) return;
    if (windowDays === '' || lookbackYears === '' || numWindows === '') {
      setError('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    setRunning(true);
    try {
      const result = await runRandomWindowBacktest(strategyKey, {
        symbols,
        interval,
        windowDays: windowDays as number,
        lookbackYears: lookbackYears as number,
        numWindows: numWindows as number,
      });
      onResult(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการรัน backtest');
    } finally {
      setRunning(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '600px' }}>

      {/* Strategy dropdown */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        <label style={labelStyle}>Strategy <span style={{ color: 'var(--text-loss, #f6465d)' }}>*</span></label>
        <select
          value={strategyKey}
          onChange={e => handleStrategyChange(e.target.value)}
          style={{ ...inputStyle, background: 'rgba(0,0,0,0.3)' }}
          disabled={running}
          required
        >
          <option value="">— เลือก Strategy —</option>
          {strategyList.map(s => (
            <option key={s.key} value={s.id ?? s.key}>
              {s.key}{s.engine === 'python' ? ' [py]' : ''}
            </option>
          ))}
        </select>
        {strategyWarning && (
          <span style={{ fontSize: '0.72rem', color: '#f6a609' }}>⚠ {strategyWarning}</span>
        )}
      </div>

      {/* Symbols */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        <label style={labelStyle}>Symbols <span style={{ color: 'var(--text-loss, #f6465d)' }}>*</span></label>
        <MultiSymbolSelector
          values={symbols}
          onChange={v => { setSymbols(v); setSymbolsError(null); }}
          max={20}
          error={symbolsError}
          disabled={running}
        />
      </div>

      {/* Interval */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        <label style={labelStyle}>Interval <span style={{ color: 'var(--text-loss, #f6465d)' }}>*</span></label>
        <select
          value={interval}
          onChange={e => setInterval(e.target.value)}
          style={{ ...inputStyle, background: 'rgba(0,0,0,0.3)' }}
          disabled={running}
        >
          {['1m', '5m', '15m', '1h', '4h', '1d'].map(iv => (
            <option key={iv} value={iv}>{iv}</option>
          ))}
        </select>
      </div>

      {/* windowDays / lookbackYears / numWindows */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label style={labelStyle}>Window Days <span style={{ color: 'var(--text-loss, #f6465d)' }}>*</span></label>
          <input
            type="number"
            value={windowDays}
            onChange={e => handleWindowDaysChange(e.target.value)}
            min={1}
            max={365}
            style={{ ...inputStyle, border: windowDaysError ? '1px solid var(--text-loss, #f6465d)' : '1px solid var(--border-color, rgba(255,255,255,0.1))' }}
            disabled={running}
            required
          />
          {windowDaysError && <span style={errorStyle}>{windowDaysError}</span>}
          <p style={{ margin: 0, fontSize: '0.72rem', color: '#666' }}>1–365 วัน</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label style={labelStyle}>Lookback Years <span style={{ color: 'var(--text-loss, #f6465d)' }}>*</span></label>
          <input
            type="number"
            value={lookbackYears}
            onChange={e => handleLookbackYearsChange(e.target.value)}
            min={1}
            max={5}
            style={{ ...inputStyle, border: lookbackYearsError ? '1px solid var(--text-loss, #f6465d)' : '1px solid var(--border-color, rgba(255,255,255,0.1))' }}
            disabled={running}
            required
          />
          {lookbackYearsError && <span style={errorStyle}>{lookbackYearsError}</span>}
          <p style={{ margin: 0, fontSize: '0.72rem', color: '#666' }}>1–5 ปี</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label style={labelStyle}>Num Windows <span style={{ color: 'var(--text-loss, #f6465d)' }}>*</span></label>
          <input
            type="number"
            value={numWindows}
            onChange={e => handleNumWindowsChange(e.target.value)}
            min={1}
            max={10}
            style={{ ...inputStyle, border: numWindowsError ? '1px solid var(--text-loss, #f6465d)' : '1px solid var(--border-color, rgba(255,255,255,0.1))' }}
            disabled={running}
            required
          />
          {numWindowsError && <span style={errorStyle}>{numWindowsError}</span>}
          <p style={{ margin: 0, fontSize: '0.72rem', color: '#666' }}>1–10 windows</p>
        </div>
      </div>

      {/* Submit error */}
      {error && (
        <div style={{
          background: 'rgba(246,70,93,0.1)', border: '1px solid rgba(246,70,93,0.3)',
          borderRadius: '8px', padding: '0.75rem 1rem',
          color: 'var(--text-loss, #f6465d)', fontSize: '0.85rem',
        }}>
          {error}
        </div>
      )}

      {/* Submit button */}
      <div>
        <button
          type="submit"
          disabled={running}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.65rem 1.75rem', borderRadius: '8px',
            background: running ? 'rgba(0,209,255,0.3)' : 'var(--accent-primary, #00d1ff)',
            color: running ? 'rgba(255,255,255,0.5)' : '#000',
            border: 'none', cursor: running ? 'not-allowed' : 'pointer',
            fontWeight: 700, fontSize: '0.9rem',
          }}
        >
          {running && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
          {running ? 'กำลังรัน backtest...' : 'รัน Backtest'}
        </button>
      </div>
    </form>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

// ─── Convert built-in StrategyEntry → StrategyDefinition for display ──────────

function entryToDefinition(entry: { key: string; engine: 'js' | 'python'; description: string; tags: string[]; id?: string }): StrategyDefinition {
  const isHardcoded = JS_STRATEGIES.some(s => s.key.toUpperCase() === entry.key.toUpperCase());
  return {
    id: entry.id ?? (isHardcoded ? `builtin:${entry.key}` : entry.key),
    name: entry.key,
    description: entry.description,
    engineType: entry.engine,
    defaultParams: {},
    tags: entry.tags,
    parameters: entry.parameters,
    createdAt: '',
    updatedAt: '',
  };
}

export default function StrategyManagement() {
  const [activeTab, setActiveTab] = useState<'strategies' | 'multi-asset' | 'random-window'>('strategies');

  // Built-in strategies from shared hook (same source as Backtest page)
  const { strategyList: builtinStrategies } = useStrategyList();

  // Custom strategies from database
  const [customStrategies, setCustomStrategies] = useState<StrategyDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Merged list: built-in first, then custom (from DB) — dedup by name
  // Use all builtinStrategies keys (JS + Python service + DB entries from hook) to avoid duplicates
  const builtinNames = new Set(builtinStrategies.map(s => s.key.toUpperCase()));
  const strategies: StrategyDefinition[] = [
    ...builtinStrategies.map(entryToDefinition),
    ...customStrategies.filter(s => !builtinNames.has(s.name.toUpperCase())),
  ];

  const [showForm, setShowForm] = useState(false);
  const [editingStrategy, setEditingStrategy] = useState<StrategyDefinition | null>(null);
  const [viewingStrategy, setViewingStrategy] = useState<StrategyDefinition | null>(null);

  const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(null);
  const [backtestResult, setBacktestResult] = useState<MultiAssetBacktestResult | RandomWindowBacktestResult | null>(null);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Multi-Asset Backtest state
  const [maResult, setMaResult] = useState<MultiAssetBacktestResult | null>(null);
  const [maConfig, setMaConfig] = useState<{ interval: string; startDate: string; endDate: string }>({ interval: '1h', startDate: '', endDate: '' });

  // Random Window Backtest state
  const [rwResult, setRwResult] = useState<RandomWindowBacktestResult | null>(null);

  // ─── Fetch strategies ───────────────────────────────────────────────────────

  const fetchStrategies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getStrategies();
      setCustomStrategies(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStrategies();
  }, [fetchStrategies]);

  // ─── Form handlers ──────────────────────────────────────────────────────────

  function handleOpenCreate() {
    setEditingStrategy(null);
    setShowForm(true);
  }

  function handleOpenEdit(strategy: StrategyDefinition) {
    // Fetch full strategy (including pythonCode) before opening form
    fetch(`/api/strategies/${strategy.id}`)
      .then(r => r.json())
      .then((full: StrategyDefinition) => {
        setEditingStrategy(full);
        setShowForm(true);
      })
      .catch(() => {
        // Fallback to cached object if fetch fails
        setEditingStrategy(strategy);
        setShowForm(true);
      });
  }

  function handleFormSuccess(saved: StrategyDefinition) {
    if (editingStrategy) {
      setCustomStrategies(prev => prev.map(s => (s.id === saved.id ? saved : s)));
    } else {
      setCustomStrategies(prev => [saved, ...prev]);
    }
    setShowForm(false);
    setEditingStrategy(null);
  }

  function handleFormClose() {
    setShowForm(false);
    setEditingStrategy(null);
  }

  // ─── Delete handlers ────────────────────────────────────────────────────────

  function handleDeleteClick(id: string) {
    setDeleteError(null);
    setConfirmDeleteId(id);
  }

  async function handleDeleteConfirm() {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    setDeletingId(id);
    setDeleteError(null);
    try {
      await deleteStrategy(id);
      setCustomStrategies(prev => prev.filter(s => s.id !== id));
      if (selectedStrategyId === id) {
        setSelectedStrategyId(null);
        setBacktestResult(null);
      }
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'ไม่สามารถลบกลยุทธ์ได้');
    } finally {
      setDeletingId(null);
    }
  }

  // ─── Card click (select for backtest history) ───────────────────────────────

  function handleCardSelect(id: string) {
    if (selectedStrategyId === id) {
      setSelectedStrategyId(null);
      setBacktestResult(null);
    } else {
      setSelectedStrategyId(id);
      setBacktestResult(null);
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  const confirmStrategy = confirmDeleteId
    ? strategies.find(s => s.id === confirmDeleteId)
    : null;

  // Tab styles
  const tabBase: React.CSSProperties = {
    padding: '0.55rem 1.25rem',
    borderRadius: '8px',
    border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.88rem',
    background: 'transparent',
    color: 'var(--text-muted, #888)',
    transition: 'all 0.15s',
  };

  const tabActive: React.CSSProperties = {
    ...tabBase,
    background: 'rgba(0,209,255,0.12)',
    color: 'var(--accent-primary, #00d1ff)',
    border: '1px solid rgba(0,209,255,0.35)',
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>Strategy Management</h1>
        {activeTab === 'strategies' && (
          <button
            className="btn-outline"
            onClick={handleOpenCreate}
            style={{ padding: '0.5rem 1.25rem', borderRadius: '8px', fontWeight: 700 }}
          >
            + เพิ่ม Strategy
          </button>
        )}
      </div>

      {/* Tab navigation */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button
          style={activeTab === 'strategies' ? tabActive : tabBase}
          onClick={() => setActiveTab('strategies')}
        >
          Strategies
        </button>
        <button
          style={activeTab === 'multi-asset' ? tabActive : tabBase}
          onClick={() => setActiveTab('multi-asset')}
        >
          Multi-Asset Backtest
        </button>
        <button
          style={activeTab === 'random-window' ? tabActive : tabBase}
          onClick={() => setActiveTab('random-window')}
        >
          Random Window Backtest
        </button>
      </div>

      {/* ── Tab: Strategies ── */}
      {activeTab === 'strategies' && (
        <>
          {/* Delete error banner */}
          {deleteError && (
            <div
              style={{
                marginBottom: '1rem',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                background: 'rgba(246,70,93,0.1)',
                border: '1px solid rgba(246,70,93,0.3)',
                color: 'var(--text-loss, #f6465d)',
                fontSize: '0.85rem',
              }}
            >
              {deleteError}
            </div>
          )}

          {/* Main layout */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: '1.5rem',
              alignItems: 'start',
            }}
          >
            {/* Strategy list */}
            <div>
              {loading && (
                <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted, #888)' }}>
                  กำลังโหลด strategy...
                </div>
              )}
              {!loading && error && (
                <div className="glass-panel" style={{ padding: '1.5rem', color: 'var(--text-loss, #f6465d)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <span>เกิดข้อผิดพลาด: {error}</span>
                  <button className="btn-outline" onClick={fetchStrategies} style={{ alignSelf: 'flex-start', padding: '0.4rem 1rem', borderRadius: '6px', fontSize: '0.85rem' }}>
                    ลองใหม่
                  </button>
                </div>
              )}
              {!loading && !error && strategies.length === 0 && (
                <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted, #888)' }}>
                  กำลังโหลด strategies...
                </div>
              )}
              {!loading && !error && strategies.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
                  {strategies.map(s => {
                    const isBuiltin = JS_STRATEGIES.some(j => j.key.toUpperCase() === s.name.toUpperCase()) || 
                                      s.name.startsWith('PINE_');
                    return (
                      <StrategyCard
                        key={s.id}
                        strategy={s}
                        isBuiltin={isBuiltin}
                        isSelected={false}
                        onSelect={() => {}}
                        onView={() => setViewingStrategy(s)}
                        onEdit={() => handleOpenEdit(s)}
                        onDelete={() => handleDeleteClick(s.id)}
                        deleting={deletingId === s.id}
                      />
                    );
                  })}                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Tab: Multi-Asset Backtest ── */}
      {activeTab === 'multi-asset' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h2 style={{ margin: '0 0 1.25rem', fontSize: '1.1rem', fontWeight: 700 }}>Multi-Asset Backtest</h2>
            <MultiAssetBacktestForm
              onResult={(result, config) => { setMaResult(result); setMaConfig(config); }}
            />
          </div>
          {maResult && (
            <BacktestResultPanel
              result={maResult}
              interval={maConfig.interval}
              startDate={maConfig.startDate}
              endDate={maConfig.endDate}
            />
          )}
        </div>
      )}

      {/* ── Tab: Random Window Backtest ── */}
      {activeTab === 'random-window' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h2 style={{ margin: '0 0 1.25rem', fontSize: '1.1rem', fontWeight: 700 }}>Random Window Backtest</h2>
            <RandomWindowBacktestForm
              onResult={result => setRwResult(result)}
            />
          </div>
          {rwResult && <BacktestResultPanel result={rwResult} />}
        </div>
      )}

      {/* Strategy form modal */}
      {showForm && (
        <StrategyForm
          strategy={editingStrategy ?? undefined}
          onSuccess={handleFormSuccess}
          onClose={handleFormClose}
        />
      )}

      {/* Strategy detail modal */}
      {viewingStrategy && (
        <StrategyDetailModal
          strategy={viewingStrategy}
          isBuiltin={JS_STRATEGIES.some(j => j.key.toUpperCase() === viewingStrategy.name.toUpperCase())}
          onClose={() => setViewingStrategy(null)}
          onEdit={() => { setViewingStrategy(null); handleOpenEdit(viewingStrategy); }}
          onDelete={() => { setViewingStrategy(null); handleDeleteClick(viewingStrategy.id); }}
        />
      )}

      {/* Delete confirmation dialog */}
      {confirmStrategy && (
        <ConfirmDialog
          strategyName={confirmStrategy.name}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  );
}
