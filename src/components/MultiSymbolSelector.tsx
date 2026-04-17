import { useState, useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';

interface MultiSymbolSelectorProps {
  values: string[];
  onChange: (symbols: string[]) => void;
  max?: number;
  error?: string | null;
  disabled?: boolean;
}

const POPULAR = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
  'PAXGUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'MATICUSDT',
];

const LABEL = (s: string) => {
  if (s === 'PAXGUSDT') return 'GOLD';
  return s.replace('USDT', '');
};

let symbolCache: string[] = [];

export default function MultiSymbolSelector({
  values,
  onChange,
  max = 20,
  error,
  disabled = false,
}: MultiSymbolSelectorProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSymbols, setLoadingSymbols] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadSymbols = useCallback(async () => {
    if (symbolCache.length > 0) return;
    setLoadingSymbols(true);
    try {
      const res = await fetch('https://api.binance.com/api/v3/exchangeInfo');
      const data = await res.json();
      symbolCache = (data.symbols as { symbol: string; status: string }[])
        .filter(s => s.symbol.endsWith('USDT') && s.status === 'TRADING')
        .map(s => s.symbol)
        .sort();
    } catch { /* fallback to popular */ }
    setLoadingSymbols(false);
  }, []);

  useEffect(() => { loadSymbols(); }, [loadSymbols]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function add(sym: string) {
    const upper = sym.trim().toUpperCase();
    if (!upper || values.includes(upper) || values.length >= max) return;
    onChange([...values, upper]);
    setQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
  }

  function remove(sym: string) {
    onChange(values.filter(s => s !== sym));
  }

  function handleInput(q: string) {
    setQuery(q);
    if (!q.trim()) { setSuggestions([]); setShowSuggestions(false); return; }
    const upper = q.toUpperCase();
    const pool = symbolCache.length > 0 ? symbolCache : POPULAR;
    const filtered = pool.filter(s => s.includes(upper) && !values.includes(s)).slice(0, 8);
    setSuggestions(filtered);
    setShowSuggestions(filtered.length > 0);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === 'Enter' || e.key === ',') && query.trim()) {
      e.preventDefault();
      // If exact match in suggestions, use it; otherwise try as-is
      const upper = query.trim().toUpperCase();
      const match = suggestions.find(s => s === upper) ?? (upper.endsWith('USDT') ? upper : upper + 'USDT');
      add(match);
    } else if (e.key === 'Backspace' && query === '' && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  }

  const atMax = values.length >= max;

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {/* Popular chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
        {POPULAR.map(sym => {
          const selected = values.includes(sym);
          return (
            <button
              key={sym}
              type="button"
              disabled={disabled || (!selected && atMax)}
              onClick={() => selected ? remove(sym) : add(sym)}
              style={{
                padding: '0.2rem 0.55rem',
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: disabled || (!selected && atMax) ? 'not-allowed' : 'pointer',
                border: selected
                  ? '1px solid var(--accent-primary, #00d1ff)'
                  : '1px solid var(--border-color, rgba(255,255,255,0.1))',
                background: selected ? 'rgba(0,209,255,0.15)' : 'rgba(255,255,255,0.04)',
                color: selected ? 'var(--accent-primary, #00d1ff)' : 'var(--text-muted, #888)',
                opacity: !selected && atMax ? 0.4 : 1,
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {LABEL(sym)}
            </button>
          );
        })}
      </div>

      {/* Selected tags + search input */}
      <div
        style={{
          display: 'flex', flexWrap: 'wrap', gap: '0.4rem',
          alignItems: 'center', minHeight: '42px',
          padding: '0.5rem 0.75rem',
          background: 'rgba(255,255,255,0.05)',
          border: error
            ? '1px solid var(--text-loss, #f6465d)'
            : '1px solid var(--border-color, rgba(255,255,255,0.1))',
          borderRadius: '8px',
          cursor: 'text',
          position: 'relative',
        }}
        onClick={() => !disabled && inputRef.current?.focus()}
      >
        {values.map(sym => (
          <span
            key={sym}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
              background: 'rgba(0,209,255,0.15)', color: 'var(--accent-primary, #00d1ff)',
              border: '1px solid rgba(0,209,255,0.3)',
              borderRadius: '100px', padding: '0.15rem 0.6rem',
              fontSize: '0.78rem', fontWeight: 600,
            }}
          >
            {sym}
            {!disabled && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); remove(sym); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, lineHeight: 0 }}
                aria-label={`ลบ ${sym}`}
              >
                <X size={12} />
              </button>
            )}
          </span>
        ))}

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => handleInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query && setShowSuggestions(suggestions.length > 0)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder={
            disabled ? '' :
            atMax ? `สูงสุด ${max} symbols` :
            values.length === 0 ? (loadingSymbols ? 'กำลังโหลด...' : 'ค้นหาหรือพิมพ์ เช่น PEPE แล้วกด Enter') :
            'เพิ่ม symbol...'
          }
          disabled={disabled || atMax}
          style={{
            background: 'none', border: 'none', outline: 'none',
            color: '#fff', fontSize: '0.85rem', flex: 1, minWidth: '160px',
          }}
        />

        {/* Dropdown suggestions */}
        {showSuggestions && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
            background: 'var(--bg-card, #1a1d2e)', border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
            borderRadius: '6px', overflow: 'hidden', marginTop: '4px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          }}>
            {suggestions.map(sym => (
              <div
                key={sym}
                onMouseDown={() => add(sym)}
                style={{
                  padding: '0.5rem 0.75rem',
                  cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  fontSize: '0.85rem',
                  borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.06))',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,209,255,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span><strong>{LABEL(sym)}</strong>/USDT</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #888)' }}>{sym}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <p style={{ margin: 0, fontSize: '0.72rem', color: '#666' }}>
        เลือกจาก popular หรือค้นหา — กด Enter เพื่อเพิ่ม ({values.length}/{max})
      </p>
      {error && <span style={{ fontSize: '0.78rem', color: 'var(--text-loss, #f6465d)' }}>{error}</span>}
    </div>
  );
}
