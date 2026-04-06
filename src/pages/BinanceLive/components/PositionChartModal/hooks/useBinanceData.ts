import { useState, useEffect } from 'react';
import { API } from '../../../types';
import type { CandleData } from '../types';

export function useBinanceData(symbol: string, interval: string) {
  const [data, setData] = useState<CandleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API}/api/binance/klines?symbol=${symbol}&interval=${interval}&limit=200`);
        const result = await res.json();
        
        if (!Array.isArray(result)) {
           setData([]);
           setLoading(false);
           return;
        }

        const formattedData = result.map((d: any) => ({
          time: Math.floor(d[0] / 1000),
          open: parseFloat(d[1]),
          high: parseFloat(d[2]),
          low: parseFloat(d[3]),
          close: parseFloat(d[4])
        }));

        setData(formattedData);
        setError(null);
      } catch (err) {
        console.error('Chart Data Fetch Error:', err);
        setError('Failed to fetch chart data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [symbol, interval]);

  return { data, loading, error };
}
