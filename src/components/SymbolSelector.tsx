import { useState, useEffect, useRef, useCallback } from 'react';

interface SymbolSelectorProps {
  value: string;
  onSelect: (symbol: string) => void;
  compact?: boolean;
}

const POPULAR = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
  'PAXGUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'MATICUSDT',
];

const LABEL = (s: string) => {
  if (s === 'PAXGUSDT') return 'GOLD (XAU)';
  return s.replace('USDT', '');
};

// Module-level cache shared across all instances
let symbolCache: string[] = [];

export default function SymbolSelector({ value, onSelect, compact = false }: SymbolSelectorProps) {
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
      symbolCache = (data.symbols as any[])
        .filter((s) => s.symbol.endsWith('USDT') && s.status === 'TRADING')
        .map((s) => s.symbol)
        .sort();
    } catch { /* offline fallback to popular list */ }
    setLoadingSymbols(false);
  }, []);

  // Pre-load on mount
  useEffect(() => { loadSymbols(); }, [loadSymbols]);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleInput = (q: string) => {
    setQuery(q);
    if (!q.trim()) { setSuggestions([]); setShowSuggestions(false); return; }
    const upper = q.toUpperCase();
    const pool = symbolCache.length > 0 ? symbolCache : POPULAR;
    const filtered = pool
      .filter((s) => s.includes(upper))
      .slice(0, 8);
    setSuggestions(filtered);
    setShowSuggestions(filtered.length > 0);
  };

  const choose = (sym: string) => {
    onSelect(sym);
    setQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const chipStyle = (sym: string): React.CSSProperties => ({
    padding: compact ? '0.15rem 0.45rem' : '0.2rem 0.55rem',
    borderRadius: '4px',
    fontSize: compact ? '0.7rem' : '0.75rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    border: sym === value ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
    background: sym === value ? 'rgba(59,130,246,0.15)' : 'var(--bg-dark)',
    color: sym === value ? 'var(--accent-primary)' : 'var(--text-muted)',
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap',
  });

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      {/* Current value badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Symbol</span>
        <span style={{
          fontSize: '0.8rem', fontWeight: 'bold',
          background: 'rgba(59,130,246,0.1)', color: 'var(--accent-primary)',
          padding: '0.1rem 0.4rem', borderRadius: '4px',
        }}>{value}</span>
      </div>

      {/* Popular chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
        {POPULAR.map((sym) => (
          <button key={sym} onClick={() => choose(sym)} style={chipStyle(sym)}>
            {LABEL(sym)}
          </button>
        ))}
      </div>

      {/* Search input */}
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          type="text"
          placeholder={loadingSymbols ? 'กำลังโหลดรายชื่อเหรียญ...' : 'ค้นหาเหรียญ เช่น PEPE, WIF...'}
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => query && setShowSuggestions(suggestions.length > 0)}
          style={{
            width: '100%',
            background: 'var(--bg-dark)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-main)',
            padding: '0.4rem 0.6rem',
            borderRadius: '4px',
            fontSize: '0.85rem',
            boxSizing: 'border-box',
            outline: 'none',
          }}
        />
        {showSuggestions && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
            borderRadius: '4px', overflow: 'hidden', marginTop: '2px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}>
            {suggestions.map((sym) => (
              <div
                key={sym}
                onClick={() => choose(sym)}
                style={{
                  padding: '0.5rem 0.75rem',
                  cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  fontSize: '0.85rem',
                  color: sym === value ? 'var(--accent-primary)' : 'var(--text-main)',
                  background: sym === value ? 'rgba(59,130,246,0.08)' : 'transparent',
                  borderBottom: '1px solid var(--border-color)',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(59,130,246,0.12)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = sym === value ? 'rgba(59,130,246,0.08)' : 'transparent')}
              >
                <span><strong>{LABEL(sym)}</strong>/USDT</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{sym}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
