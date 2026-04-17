import { useState, useEffect } from 'react';
import { X, Loader2, Tag } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import type { StrategyDefinition } from '../../types/strategy';
import { createStrategy, updateStrategy } from '../../api/strategyApi';

// ─── Props ────────────────────────────────────────────────────────────────────

interface StrategyFormProps {
  strategy?: StrategyDefinition;  // if provided, edit mode; otherwise create mode
  onSuccess: (strategy: StrategyDefinition) => void;
  onClose: () => void;
}

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormValues {
  name: string;
  description: string;
  baseStrategy: string;
  defaultParams: string;  // JSON string
  pythonCode: string;
  tags: string[];
  parameters: any[];
}

interface FormErrors {
  name?: string;
  baseStrategy?: string;
  defaultParams?: string;
  pythonCode?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StrategyForm({ strategy, onSuccess, onClose }: StrategyFormProps) {
  const isEdit = !!strategy;

  const [values, setValues] = useState<FormValues>({
    name: strategy?.name ?? '',
    description: strategy?.description ?? '',
    baseStrategy: strategy?.baseStrategy ?? '',
    defaultParams: strategy?.defaultParams ? JSON.stringify(strategy.defaultParams, null, 2) : '{}',
    pythonCode: strategy?.pythonCode ?? '',
    tags: strategy?.tags ?? [],
    parameters: strategy?.parameters ?? [],
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // ─── Validation ─────────────────────────────────────────────────────────────

  function validate(): boolean {
    const errs: FormErrors = {};

    if (!values.name.trim()) {
      errs.name = 'กรุณากรอกชื่อกลยุทธ์';
    }

    const trimmedParams = values.defaultParams.trim();
    if (trimmedParams && trimmedParams !== '{}') {
      try {
        JSON.parse(values.defaultParams);
      } catch {
        errs.defaultParams = 'Default Params ต้องเป็น JSON ที่ถูกต้อง';
      }
    }

    if (!values.pythonCode.trim()) {
      errs.pythonCode = 'กรุณากรอก Python Code';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ─── Tag input ───────────────────────────────────────────────────────────────

  function addTag(raw: string) {
    const tag = raw.trim().replace(/,+$/, '').trim();
    if (tag && !values.tags.includes(tag)) {
      setValues(v => ({ ...v, tags: [...v.tags, tag] }));
    }
    setTagInput('');
  }

  function handleTagKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === 'Backspace' && tagInput === '' && values.tags.length > 0) {
      setValues(v => ({ ...v, tags: v.tags.slice(0, -1) }));
    }
  }

  function removeTag(tag: string) {
    setValues(v => ({ ...v, tags: v.tags.filter(t => t !== tag) }));
  }

  // ─── Submit ──────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (!validate()) return;

    setLoading(true);
    try {
      const trimmedParams = values.defaultParams.trim();
      const parsedParams = (trimmedParams && trimmedParams !== '{}')
        ? JSON.parse(values.defaultParams) as Record<string, unknown>
        : {};

      const payload: Omit<StrategyDefinition, 'id' | 'createdAt' | 'updatedAt'> = {
        name: values.name.trim(),
        description: values.description,
        engineType: 'python',
        baseStrategy: values.baseStrategy || undefined,
        defaultParams: parsedParams,
        tags: values.tags,
        parameters: values.parameters,
        pythonCode: values.pythonCode,
      };

      const result = isEdit
        ? await updateStrategy(strategy!.id, payload)
        : await createStrategy(payload);

      onSuccess(result);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่';
      setSubmitError(msg);
    } finally {
      setLoading(false);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    /* Backdrop */
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
    >
      {/* Modal panel — stop propagation so clicking inside doesn't close */}
      <div
        className="glass-panel"
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '560px',
          maxHeight: '90vh', overflowY: 'auto',
          borderRadius: '16px', padding: '2rem',
          display: 'flex', flexDirection: 'column', gap: '1.5rem',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
            {isEdit ? '✏️ แก้ไข Strategy' : '➕ เพิ่ม Strategy ใหม่'}
          </h2>
          <button
            onClick={onClose}
            className="btn-outline"
            style={{ padding: '0.35rem', borderRadius: '8px', lineHeight: 0 }}
            aria-label="ปิด"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Name */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={labelStyle}>ชื่อกลยุทธ์ <span style={{ color: 'var(--text-loss, #f6465d)' }}>*</span></label>
            <input
              type="text"
              value={values.name}
              onChange={e => setValues(v => ({ ...v, name: e.target.value }))}
              placeholder="เช่น EMA Cross Strategy"
              style={{ ...inputStyle, borderColor: errors.name ? 'var(--text-loss, #f6465d)' : undefined }}
              disabled={loading}
            />
            {errors.name && <span style={errorStyle}>{errors.name}</span>}
          </div>

          {/* Description */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={labelStyle}>คำอธิบาย (รองรับ Markdown)</label>
            <textarea
              value={values.description}
              onChange={e => setValues(v => ({ ...v, description: e.target.value }))}
              placeholder="อธิบายกลยุทธ์นี้..."
              rows={4}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: '0.85rem' }}
              disabled={loading}
            />
          </div>

          {/* Python Code — always required */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={labelStyle}>
              Python Code <span style={{ color: 'var(--text-loss, #f6465d)' }}>*</span>
            </label>
            <textarea
              value={values.pythonCode}
              onChange={e => setValues(v => ({ ...v, pythonCode: e.target.value }))}
              placeholder={`import pandas as pd\nimport ta\nfrom base_strategy import BaseStrategy\n\nclass MyStrategy(BaseStrategy):\n    def compute_signal(self, closes, highs, lows, volumes, params):\n        ...\n        return {"signal": "LONG", "stoploss": None, "metadata": {}}\n\n    def get_metadata(self):\n        return {"name": "MyStrategy", "description": "", "version": "1.0.0"}`}
              rows={14}
              style={{
                ...inputStyle, resize: 'vertical',
                fontFamily: 'monospace', fontSize: '0.82rem',
                borderColor: errors.pythonCode ? 'var(--text-loss, #f6465d)' : undefined,
              }}
              disabled={loading}
            />
            {errors.pythonCode && <span style={errorStyle}>{errors.pythonCode}</span>}
          </div>
          {/* Default Params (JSON) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={labelStyle}>Default Params (JSON)</label>
            <textarea
              value={values.defaultParams}
              onChange={e => setValues(v => ({ ...v, defaultParams: e.target.value }))}
              placeholder='{"period": 14, "threshold": 0.5}'
              rows={4}
              style={{
                ...inputStyle, resize: 'vertical',
                fontFamily: 'monospace', fontSize: '0.82rem',
                borderColor: errors.defaultParams ? 'var(--text-loss, #f6465d)' : undefined,
              }}
              disabled={loading}
            />
            {errors.defaultParams && <span style={errorStyle}>{errors.defaultParams}</span>}
          </div>

          {/* UI Parameters Editor */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={labelStyle}>UI Parameters (ช่องปรับจูนค่าใน Backtest)</label>
              <button
                type="button"
                onClick={() => setValues(v => ({ ...v, parameters: [...v.parameters, { key: '', label: '', type: 'number', default: 0 }] }))}
                style={{ fontSize: '0.72rem', color: 'var(--accent-primary, #00d1ff)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
              >
                + เพิ่มพารามิเตอร์
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {values.parameters.map((p, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 0.5fr auto', gap: '0.4rem', alignItems: 'start', padding: '0.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                  <input
                    placeholder="Label (เช่น RSI Period)"
                    value={p.label}
                    onChange={e => {
                      const newParams = [...values.parameters];
                      newParams[idx].label = e.target.value;
                      setValues(v => ({ ...v, parameters: newParams }));
                    }}
                    style={{ ...inputStyle, padding: '0.4rem', fontSize: '0.8rem' }}
                  />
                  <input
                    placeholder="Key (เช่น rsi_len)"
                    value={p.key}
                    onChange={e => {
                      const newParams = [...values.parameters];
                      newParams[idx].key = e.target.value;
                      setValues(v => ({ ...v, parameters: newParams }));
                    }}
                    style={{ ...inputStyle, padding: '0.4rem', fontSize: '0.8rem', fontFamily: 'monospace' }}
                  />
                  <input
                    placeholder="ค่า Default"
                    type={p.type === 'number' ? 'number' : 'text'}
                    value={p.default}
                    onChange={e => {
                      const newParams = [...values.parameters];
                      newParams[idx].default = p.type === 'number' ? Number(e.target.value) : e.target.value;
                      setValues(v => ({ ...v, parameters: newParams }));
                    }}
                    style={{ ...inputStyle, padding: '0.4rem', fontSize: '0.8rem' }}
                  />
                  <select
                    value={p.type}
                    onChange={e => {
                      const newParams = [...values.parameters];
                      newParams[idx].type = e.target.value as 'number' | 'text';
                      setValues(v => ({ ...v, parameters: newParams }));
                    }}
                    style={{ ...inputStyle, padding: '0.4rem', fontSize: '0.8rem', background: 'rgba(0,0,0,0.3)' }}
                  >
                    <option value="number">Num</option>
                    <option value="text">Txt</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setValues(v => ({ ...v, parameters: v.parameters.filter((_, i) => i !== idx) }))}
                    style={{ color: '#666', background: 'none', border: 'none', cursor: 'pointer', padding: '0.4rem' }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              {values.parameters.length === 0 && (
                <div style={{ fontSize: '0.72rem', color: '#555', textAlign: 'center', padding: '0.5rem', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '8px' }}>
                  ยังไม่มีการกำหนดพารามิเตอร์แบบ UI
                </div>
              )}
            </div>
          </div>

          {/* Tags */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={labelStyle}>Tags</label>
            <div
              style={{
                ...inputStyle,
                display: 'flex', flexWrap: 'wrap', gap: '0.4rem',
                alignItems: 'center', minHeight: '42px', cursor: 'text',
                padding: '0.5rem 0.75rem',
              }}
              onClick={() => document.getElementById('tag-input')?.focus()}
            >
              {values.tags.map(tag => (
                <span
                  key={tag}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                    background: 'rgba(0,209,255,0.15)', color: 'var(--accent-primary, #00d1ff)',
                    border: '1px solid rgba(0,209,255,0.3)',
                    borderRadius: '100px', padding: '0.15rem 0.6rem',
                    fontSize: '0.78rem', fontWeight: 600,
                  }}
                >
                  <Tag size={11} />
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, lineHeight: 0 }}
                    aria-label={`ลบ tag ${tag}`}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
              <input
                id="tag-input"
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={() => { if (tagInput.trim()) addTag(tagInput); }}
                placeholder={values.tags.length === 0 ? 'พิมพ์ tag แล้วกด Enter หรือ ,' : ''}
                style={{
                  background: 'none', border: 'none', outline: 'none',
                  color: '#fff', fontSize: '0.85rem', flex: 1, minWidth: '120px',
                }}
                disabled={loading}
              />
            </div>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#666' }}>กด Enter หรือ , เพื่อเพิ่ม tag</p>
          </div>

          {/* Submit error */}
          {submitError && (
            <div style={{
              background: 'rgba(246,70,93,0.1)', border: '1px solid rgba(246,70,93,0.3)',
              borderRadius: '8px', padding: '0.75rem 1rem',
              color: 'var(--text-loss, #f6465d)', fontSize: '0.85rem',
            }}>
              {submitError}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
            <button
              type="button"
              className="btn-outline"
              onClick={onClose}
              disabled={loading}
              style={{ padding: '0.6rem 1.25rem', borderRadius: '8px' }}
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.6rem 1.5rem', borderRadius: '8px',
                background: loading ? 'rgba(0,209,255,0.3)' : 'var(--accent-primary, #00d1ff)',
                color: loading ? 'rgba(255,255,255,0.5)' : '#000',
                border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 700, fontSize: '0.9rem', transition: 'opacity 0.15s',
              }}
            >
              {loading && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
              {loading ? 'กำลังบันทึก...' : isEdit ? 'บันทึกการแก้ไข' : 'สร้าง Strategy'}
            </button>
          </div>
        </form>
      </div>

      {/* Spinner keyframe */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontSize: '0.8rem', fontWeight: 700, color: '#aaa',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.65rem 0.75rem',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
  color: '#fff', borderRadius: '8px',
  fontSize: '0.9rem', boxSizing: 'border-box',
};

const errorStyle: React.CSSProperties = {
  fontSize: '0.78rem', color: 'var(--text-loss, #f6465d)',
};
