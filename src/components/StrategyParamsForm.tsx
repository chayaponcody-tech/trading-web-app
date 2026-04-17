import type { ParamDef } from '../utils/strategyParams';

interface Props {
  params: ParamDef[];
  values: Record<string, number | string>;
  onChange: (key: string, value: number | string) => void;
  disabled?: boolean;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.65rem',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
  color: '#fff',
  borderRadius: '8px',
  fontSize: '0.85rem',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.78rem',
  fontWeight: 700,
  color: '#aaa',
  marginBottom: '0.3rem',
};

export default function StrategyParamsForm({ params, values, onChange, disabled }: Props) {
  if (params.length === 0) return null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
      {params.map(p => (
        <div key={p.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <label style={labelStyle} title={p.hint}>
            {p.label}
            {p.hint && <span style={{ marginLeft: '0.3rem', color: '#666', fontWeight: 400 }}>ⓘ</span>}
          </label>
          <input
            type={p.type === 'number' ? 'number' : 'text'}
            value={values[p.key] ?? p.default}
            min={p.min}
            max={p.max}
            step={p.step}
            disabled={disabled}
            onChange={e => onChange(p.key, p.type === 'number' ? Number(e.target.value) : e.target.value)}
            style={inputStyle}
            title={p.hint}
          />
          {p.hint && (
            <span style={{ fontSize: '0.7rem', color: '#666' }}>{p.hint}</span>
          )}
        </div>
      ))}
    </div>
  );
}
