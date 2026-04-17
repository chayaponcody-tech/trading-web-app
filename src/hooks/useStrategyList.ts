import { useState, useEffect } from 'react';

export interface StrategyEntry {
  key: string;
  id?: string;  // UUID for DB strategies; undefined for built-ins
  engine: 'js' | 'python';
  description: string;
  tags: string[];
  parameters?: any[];
}

export const JS_STRATEGIES: StrategyEntry[] = [
  {
    key: 'EMA',
    engine: 'python',
    description: 'EMA Cross — เข้าเมื่อ EMA20 ตัด EMA50 เหมาะกับตลาด trending มีทิศทางชัดเจน',
    tags: ['trend', 'ema'],
  },
  {
    key: 'RSI',
    engine: 'python',
    description: 'RSI Reversal — เข้าเมื่อ RSI oversold/overbought เหมาะกับตลาด ranging',
    tags: ['reversal', 'rsi'],
  },
  {
    key: 'BB',
    engine: 'python',
    description: 'Bollinger Bands — เข้าเมื่อราคาแตะ band เหมาะกับตลาด sideway ที่มี volatility',
    tags: ['mean-reversion', 'bb'],
  },
  {
    key: 'EMA_RSI',
    engine: 'python',
    description: 'EMA Cross + RSI — รวม EMA trend filter กับ RSI momentum เพื่อกรอง signal เข้มขึ้น',
    tags: ['trend', 'momentum', 'ema', 'rsi'],
  },
  {
    key: 'BB_RSI',
    engine: 'python',
    description: 'Bollinger Bands + RSI — mean reversion เมื่อราคาแตะ BB band พร้อม RSI ยืนยัน',
    tags: ['mean-reversion', 'bb', 'rsi'],
  },
  {
    key: 'EMA_BB_RSI',
    engine: 'python',
    description: 'EMA + BB + RSI Composite — รวม 3 indicator กรอง signal เข้มข้น เหมาะกับตลาด trending พร้อม pullback',
    tags: ['composite', 'trend', 'pullback'],
  },
  {
    key: 'GRID',
    engine: 'python',
    description: 'Grid Trading — ซื้อขอบล่าง ขายขอบบนของกรอบราคา เหมาะกับตลาด sideway',
    tags: ['grid', 'range', 'sideway'],
  },
  {
    key: 'AI_SCOUTER',
    engine: 'python',
    description: 'AI Scouter Scalp — momentum scalping ด้วย SMA7/SMA14 cross + RSI เหมาะกับตลาด volatile',
    tags: ['scalp', 'momentum', 'volatile'],
  },
  {
    key: 'EMA_SCALP',
    engine: 'python',
    description: 'EMA Scalp — scalping ระยะสั้นด้วย EMA fast/slow cross บน timeframe เล็ก',
    tags: ['scalp', 'ema', 'short-term'],
  },
  {
    key: 'STOCH_RSI',
    engine: 'python',
    description: 'Stochastic RSI — ใช้ StochRSI ตรวจจับ overbought/oversold เหมาะกับตลาด ranging',
    tags: ['reversal', 'stoch', 'rsi'],
  },
  {
    key: 'VWAP_SCALP',
    engine: 'python',
    description: 'VWAP Scalp — เข้าเมื่อราคากลับมาหา VWAP เหมาะกับ intraday trading',
    tags: ['scalp', 'vwap', 'intraday'],
  },
  {
    key: 'EMA_CROSS',
    engine: 'python',
    description: 'EMA Cross — เข้าเมื่อ EMA20 ตัด EMA50 (Standard version)',
    tags: ['trend', 'ema'],
  },
  {
    key: 'EMA_CROSS_V2',
    engine: 'python',
    description: 'EMA Cross V2 — เวอร์ชั่นปรับปรุงของ EMA Cross สำหรับตลาด CRYPTO',
    tags: ['trend', 'ema', 'optimized'],
  },
  {
    key: 'RSI_TREND',
    engine: 'python',
    description: 'RSI Trend — ใช้ RSI ในการยืนยัน momentum ของเทรนด์',
    tags: ['trend', 'momentum', 'rsi'],
  },
  {
    key: 'BB_BREAKOUT',
    engine: 'python',
    description: 'Bollinger Breakout — เข้าเทรดเมื่อราคาพุ่งทะลุ Band ด้วย momentum สูง',
    tags: ['trend', 'breakout', 'bb'],
  },
  {
    key: 'OI_FUNDING_ALPHA',
    engine: 'python',
    description: 'OI & Funding Alpha — ใช้ข้อมูล Funding Rate และ Open Interest ในการระบุ Market Imbalance',
    tags: ['quant', 'alpha', 'sentiment'],
  },
];

/**
 * Shared hook that returns the merged JS + Python strategy list.
 * Sources:
 *  1. Hardcoded JS_STRATEGIES (built-in)
 *  2. /strategy/list — Python service registry
 *  3. /api/strategies — user-created strategies stored in DB
 */
export function useStrategyList() {
  const [strategyList, setStrategyList] = useState<StrategyEntry[]>(JS_STRATEGIES);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    const fetchPython = fetch('/api/backtest/strategies')
      .then(r => r.json())
      .then(data =>
        Array.isArray(data.strategies)
          ? data.strategies.map((s: { key: string; description?: string }) => ({
              key: s.key.toUpperCase(),
              engine: 'python' as const,
              description: s.description ?? '',
              tags: ['python'],
            }))
          : []
      )
      .catch(() => {
        setWarning('Python strategy service unavailable — showing JS strategies only');
        return [] as StrategyEntry[];
      });

    const fetchDB = fetch('/api/strategies')
      .then(r => r.json())
      .then((data: any[]) =>
        Array.isArray(data)
          ? data.map(s => ({
              key: s.name,           // preserve original casing — Python service uses this exact key
              id: s.id,
              engine: s.engineType as 'js' | 'python',
              description: s.description ?? '',
              tags: s.tags ?? [],
              parameters: s.parameters ?? [],
            }))
          : []
      )
      .catch(() => [] as StrategyEntry[]);

    Promise.all([fetchPython, fetchDB]).then(([pythonEntries, dbEntries]) => {
      // Build merged list:
      // 1. JS_STRATEGIES (hardcoded built-ins) — always first
      // 2. DB entries (custom user strategies) — use real UUID as id
      // 3. Python service entries — only if not already in JS_STRATEGIES or DB
      const seen = new Set<string>();
      const merged: StrategyEntry[] = [];

      // JS built-ins first
      for (const entry of JS_STRATEGIES) {
        seen.add(entry.key.toUpperCase());
        merged.push(entry);
      }

      // DB custom strategies — always include, use UUID id
      for (const entry of dbEntries) {
        const k = entry.key.toUpperCase();
        if (!seen.has(k)) {
          seen.add(k);
          merged.push(entry);
        }
      }

      // Python service extras — only if not already covered
      for (const entry of pythonEntries) {
        const k = entry.key.toUpperCase();
        if (!seen.has(k)) {
          seen.add(k);
          merged.push(entry);
        }
      }

      setStrategyList(merged);
    });
  }, []);

  return { strategyList, warning };
}
