import { useState, useEffect, useRef, useCallback } from 'react';

interface SymbolSelectorProps {
  value: string;
  onSelect: (symbol: string) => void;
  compact?: boolean;
  searchTop?: boolean;
}

const POPULAR = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'PAXGUSDT'];

const LABEL = (s: string) => {
  if (s === 'PAXGUSDT') return 'GOLD'; // Shorter label for narrow view
  return s.replace('USDT', '');
};

let symbolCache: string[] = [];

export default function SymbolSelector({ value, onSelect, compact = false, searchTop = false }: SymbolSelectorProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSymbols, setLoadingSymbols] = useState(false);
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
    } catch { }
    setLoadingSymbols(false);
  }, []);

  useEffect(() => { loadSymbols(); }, [loadSymbols]);

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
      .slice(0, 50); // Show more results for long view
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
    padding: '4px 0',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    border: sym === value ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
    background: sym === value ? 'rgba(59,130,246,0.15)' : 'var(--bg-dark)',
    color: sym === value ? 'var(--accent-primary)' : 'var(--text-muted)',
    flex: '1 1 45%', // 2 per row
    textAlign: 'center'
  });

  const searchInput = (
    <div style={{ position: 'relative' }}>
      <input
        type="text"
        autoFocus
        placeholder={loadingSymbols ? 'Loading...' : 'Search Symbol...'}
        value={query}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => query && setShowSuggestions(suggestions.length > 0)}
        style={{
          width: '100%',
          background: 'var(--bg-dark)',
          border: '1px solid var(--border-color)',
          color: 'var(--text-main)',
          padding: '0.5rem 0.6rem',
          borderRadius: '4px',
          fontSize: '0.85rem',
          outline: 'none',
        }}
      />
      {showSuggestions && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999999,
          background: 'var(--bg-card)', border: '1px solid var(--border-color)',
          borderRadius: '0 0 4px 4px', overflowY: 'auto', marginTop: '1px',
          maxHeight: '400px', // Long view
          boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
        }}>
          {suggestions.map((sym) => (
            <div
              key={sym}
              onClick={() => choose(sym)}
              style={{
                padding: '0.75rem 1rem',
                cursor: 'pointer',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontSize: '0.9rem',
                borderBottom: '1px solid var(--border-color)',
                background: sym === value ? 'rgba(59,130,246,0.08)' : 'transparent',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = sym === value ? 'rgba(59,130,246,0.08)' : 'transparent')}
            >
              <strong style={{ color: sym === value ? 'var(--accent-primary)' : '#fff' }}>{LABEL(sym)}</strong>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>USDT</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {searchTop && searchInput}
      
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
        {POPULAR.map((sym) => (
          <button key={sym} onClick={() => choose(sym)} style={chipStyle(sym)}>
            {LABEL(sym)}
          </button>
        ))}
      </div>

      {!searchTop && searchInput}
    </div>
  );
}
