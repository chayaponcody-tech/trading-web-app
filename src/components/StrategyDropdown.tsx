import type { StrategyEntry } from '../hooks/useStrategyList';

interface Props {
  value: string;
  onChange: (value: string) => void;
  strategyList: StrategyEntry[];
  disabled?: boolean;
  style?: React.CSSProperties;
}

export default function StrategyDropdown({ value, onChange, strategyList, disabled, style }: Props) {
  const builtins = strategyList.filter(s => !s.id);
  const customs = strategyList.filter(s => !!s.id);

  return (
    <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled} required style={style}>
      <option value="">— เลือก Strategy —</option>
      <optgroup label="Built-in Strategies">
        {builtins.map(s => (
          <option key={s.key} value={s.key}>{s.key}</option>
        ))}
      </optgroup>
      {customs.length > 0 && (
        <optgroup label="Custom Strategies">
          {customs.map(s => (
            <option key={s.key} value={s.id!}>{s.key}</option>
          ))}
        </optgroup>
      )}
    </select>
  );
}
