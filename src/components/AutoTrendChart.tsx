import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, LineStyle, CandlestickSeries, LineSeries, HistogramSeries, createSeriesMarkers } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, Time, SeriesMarker } from 'lightweight-charts';
import { EMA, BollingerBands } from 'technicalindicators';

interface ChartProps {
  symbol: string;
}

export default function AutoTrendChart({ symbol }: ChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  // Series References for toggling visibility
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ema20SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ema50SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbUpperSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbLowerSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const resistanceSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const supportSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candlestickSeriesMarkersRef = useRef<any>(null);

  // Toggle States
  const [showVolume, setShowVolume] = useState(true);
  const [showEMA, setShowEMA] = useState(true);
  const [showBB, setShowBB] = useState(true);
  const [showTrend, setShowTrend] = useState(true);
  const [interval, setIntervalTime] = useState('1h');
  
  // Latest AI Signal State
  const [latestSignal, setLatestSignal] = useState<{type: string, time: string, price: number}>({type: 'NONE', time: '', price: 0});
  
  // Backtest Stats State
  const [backtestStats, setBacktestStats] = useState({ totalTrades: 0, winRate: 0, netPnL: 0 });
  
  // Selected Strategy
  const [selectedStrategy, setSelectedStrategy] = useState<'EMA' | 'BB'>('EMA');

  // Paper Trading State
  const [isLoading, setIsLoading] = useState(true);
  const [isBotRunning, setIsBotRunning] = useState(false);
  const [paperState, setPaperState] = useState({
    balance: 10000,
    position: 'NONE' as 'LONG' | 'SHORT' | 'NONE',
    entryPrice: 0,
    trades: 0,
    equity: 10000 // Real-time estimated balance
  });
  const [tpPercent, setTpPercent] = useState<number>(2.0);
  const [slPercent, setSlPercent] = useState<number>(1.0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [tradeHistory, setTradeHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const isBotActiveRef = useRef(isBotRunning);
  const paperStateRef = useRef(paperState);
  const tpRef = useRef(tpPercent);
  const slRef = useRef(slPercent);
  const historyRef = useRef(tradeHistory);

  useEffect(() => { isBotActiveRef.current = isBotRunning; }, [isBotRunning]);
  useEffect(() => { paperStateRef.current = paperState; }, [paperState]);
  useEffect(() => { tpRef.current = tpPercent; }, [tpPercent]);
  useEffect(() => { slRef.current = slPercent; }, [slPercent]);
  useEffect(() => { historyRef.current = tradeHistory; }, [tradeHistory]);

  const saveToServer = async (updates: Record<string, unknown>) => {
    try {
      await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
    } catch { console.error('Failed to save to backend'); }
  };

  const syncBotRunning = (val: boolean) => { setIsBotRunning(val); saveToServer({ isBotRunning: val }); };
  const syncStrategy = (val: 'EMA' | 'BB') => { setSelectedStrategy(val); saveToServer({ selectedStrategy: val }); };
  const syncTp = (val: number) => { setTpPercent(val); saveToServer({ tpPercent: val }); };
  const syncSl = (val: number) => { setSlPercent(val); saveToServer({ slPercent: val }); };

  useEffect(() => {
    fetch('/api/state')
      .then(res => res.json())
      .then(data => {
        setIsBotRunning(data.isBotRunning);
        setSelectedStrategy(data.selectedStrategy);
        setTpPercent(data.tpPercent);
        setSlPercent(data.slPercent);
        setPaperState(data.paperState);
        setTradeHistory(data.tradeHistory);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Failed to load backend state', err);
        setIsLoading(false);
      });
  }, []);

  // Apply visibility changes when state updates
  useEffect(() => {
    if (volumeSeriesRef.current) volumeSeriesRef.current.applyOptions({ visible: showVolume });
  }, [showVolume]);

  useEffect(() => {
    if (ema20SeriesRef.current) ema20SeriesRef.current.applyOptions({ visible: showEMA });
    if (ema50SeriesRef.current) ema50SeriesRef.current.applyOptions({ visible: showEMA });
  }, [showEMA]);

  useEffect(() => {
    if (bbUpperSeriesRef.current) bbUpperSeriesRef.current.applyOptions({ visible: showBB });
    if (bbLowerSeriesRef.current) bbLowerSeriesRef.current.applyOptions({ visible: showBB });
  }, [showBB]);

  useEffect(() => {
    if (resistanceSeriesRef.current) resistanceSeriesRef.current.applyOptions({ visible: showTrend });
    if (supportSeriesRef.current) supportSeriesRef.current.applyOptions({ visible: showTrend });
  }, [showTrend]);

  useEffect(() => {
    if (!chartContainerRef.current) return;
    const formattedSymbol = symbol.replace('/', '');

    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#848e9c' },
      grid: { vertLines: { color: '#2b313f' }, horzLines: { color: '#2b313f' } },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
      localization: {
        locale: 'th-TH',
        timeFormatter: (time: number) => {
          const date = new Date(time * 1000);
          return date.toLocaleString('th-TH', { 
            hour: '2-digit', 
            minute: '2-digit', 
            hour12: false,
            timeZone: 'Asia/Bangkok'
          });
        },
      },
      rightPriceScale: { autoScale: true },
      autoSize: true,
    });
    chartRef.current = chart;

    // 1. Candlestick Series
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#0ecb81', downColor: '#f6465d', borderVisible: false, wickUpColor: '#0ecb81', wickDownColor: '#f6465d',
    });
    candlestickSeriesRef.current = candlestickSeries;

    // 2. Volume Series (Overlay at the bottom)
    volumeSeriesRef.current = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '', 
      visible: showVolume
    });
    chart.priceScale('').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });

    // 3. EMA 20 & EMA 50 Series
    ema20SeriesRef.current = chart.addSeries(LineSeries, { color: '#38bdf8', lineWidth: 2, visible: showEMA });
    ema50SeriesRef.current = chart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 2, visible: showEMA });

    // 4. Bollinger Bands Series
    bbUpperSeriesRef.current = chart.addSeries(LineSeries, { color: 'rgba(41, 98, 255, 0.5)', lineWidth: 1, lineStyle: LineStyle.Dashed, visible: showBB });
    bbLowerSeriesRef.current = chart.addSeries(LineSeries, { color: 'rgba(41, 98, 255, 0.5)', lineWidth: 1, lineStyle: LineStyle.Dashed, visible: showBB });

    // 5. AI Trendlines
    resistanceSeriesRef.current = chart.addSeries(LineSeries, { color: '#ef4444', lineWidth: 2, lineStyle: LineStyle.Dotted, visible: showTrend });
    supportSeriesRef.current = chart.addSeries(LineSeries, { color: '#10b981', lineWidth: 2, lineStyle: LineStyle.Dotted, visible: showTrend });

    const fetchData = async () => {
      try {
        const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${formattedSymbol}&interval=${interval}&limit=250`);
        const data = await response.json();

        interface CData { time: Time; open: number; high: number; low: number; close: number; volume: number; }

        const cdata = data.map((d: (number | string)[]) => ({
          time: Math.floor((d[0] as number) / 1000) as Time,
          open: parseFloat(d[1] as string), high: parseFloat(d[2] as string), low: parseFloat(d[3] as string), close: parseFloat(d[4] as string),
          volume: parseFloat(d[5] as string),
        }));

        candlestickSeries.setData(cdata);

        const volumeData = cdata.map((d: CData) => ({
          time: d.time, value: d.volume, color: d.close >= d.open ? 'rgba(8, 153, 129, 0.3)' : 'rgba(242, 54, 69, 0.3)'
        }));
        volumeSeriesRef.current?.setData(volumeData);

        const closePrices = cdata.map((d: CData) => d.close);

        const ema20 = EMA.calculate({ period: 20, values: closePrices });
        const ema20Data = cdata.slice(cdata.length - ema20.length).map((d: CData, i: number) => ({ time: d.time, value: ema20[i] }));
        ema20SeriesRef.current?.setData(ema20Data);

        const ema50 = EMA.calculate({ period: 50, values: closePrices });
        const ema50Data = cdata.slice(cdata.length - ema50.length).map((d: CData, i: number) => ({ time: d.time, value: ema50[i] }));
        ema50SeriesRef.current?.setData(ema50Data);

        const bb = BollingerBands.calculate({ period: 20, stdDev: 2, values: closePrices });
        const bbUpperData = cdata.slice(cdata.length - bb.length).map((d: CData, i: number) => ({ time: d.time, value: bb[i].upper }));
        const bbLowerData = cdata.slice(cdata.length - bb.length).map((d: CData, i: number) => ({ time: d.time, value: bb[i].lower }));
        bbUpperSeriesRef.current?.setData(bbUpperData);
        bbLowerSeriesRef.current?.setData(bbLowerData);

        // --- AI Signal Generator & Backtesting Engine ---
        const markers: SeriesMarker<Time>[] = [];
        let curSignal = { type: 'NONE', time: '', price: 0 };
        
        let currentPosition: 'LONG' | 'SHORT' | 'NONE' = 'NONE';
        let entryPrice = 0;
        let wins = 0;
        let totalTrades = 0;
        let totalPnL = 0;
        
        // Ensure we have enough data points based on the strategy
        const startIndex = selectedStrategy === 'EMA' 
           ? cdata.length - Math.min(ema20Data.length, ema50Data.length) + 1
           : cdata.length - bbUpperData.length + 1;

        for (let i = startIndex; i < cdata.length; i++) {
          const currentTime = cdata[i].time;
          const prevTime = cdata[i-1].time;
          
          let isLongSignal = false;
          let isShortSignal = false;

          if (selectedStrategy === 'EMA') {
            const currentEma20 = ema20Data.find((d: {time: Time; value: number}) => d.time === currentTime)?.value;
            const prevEma20 = ema20Data.find((d: {time: Time; value: number}) => d.time === prevTime)?.value;
            const currentEma50 = ema50Data.find((d: {time: Time; value: number}) => d.time === currentTime)?.value;
            const prevEma50 = ema50Data.find((d: {time: Time; value: number}) => d.time === prevTime)?.value;

            if (currentEma20 && prevEma20 && currentEma50 && prevEma50) {
              isLongSignal = prevEma20 <= prevEma50 && currentEma20 > currentEma50;
              isShortSignal = prevEma20 >= prevEma50 && currentEma20 < currentEma50;
            }
          } else if (selectedStrategy === 'BB') {
            const currentClose = cdata[i].close;
            const prevClose = cdata[i-1].close;
            const currentBBUpper = bbUpperData.find((d: {time: Time; value: number}) => d.time === currentTime)?.value;
            const currentBBLower = bbLowerData.find((d: {time: Time; value: number}) => d.time === currentTime)?.value;
            const prevBBLower = bbLowerData.find((d: {time: Time; value: number}) => d.time === prevTime)?.value;
            const prevBBUpper = bbUpperData.find((d: {time: Time; value: number}) => d.time === prevTime)?.value;

            if (currentBBUpper && currentBBLower && prevBBUpper && prevBBLower) {
              // Basic Mean Reversion: Buy when price <= Lower Band, Sell when price >= Upper Band.
              isLongSignal = prevClose > prevBBLower && currentClose <= currentBBLower;
              isShortSignal = prevClose < prevBBUpper && currentClose >= currentBBUpper;
            }
          }

          if (isLongSignal || isShortSignal) {
             // Backtest check close position
            if (currentPosition === 'LONG' && isShortSignal) {
              totalTrades++;
              const pnl = ((cdata[i].close - entryPrice) / entryPrice) * 100;
              totalPnL += pnl;
              if (pnl > 0) wins++;
              currentPosition = 'NONE';
            } 
            else if (currentPosition === 'SHORT' && isLongSignal) {
              totalTrades++;
              const pnl = ((entryPrice - cdata[i].close) / entryPrice) * 100;
              totalPnL += pnl;
              if (pnl > 0) wins++;
              currentPosition = 'NONE';
            }

            if (isLongSignal) {
              const timeStr = new Date((cdata[i].time as number) * 1000).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
              markers.push({ time: cdata[i].time as Time, position: 'belowBar', color: '#10b981', shape: 'arrowUp', text: 'LONG' });
              curSignal = { type: 'LONG', time: timeStr, price: cdata[i].close };
              
              if (currentPosition === 'NONE') {
                currentPosition = 'LONG';
                entryPrice = cdata[i].close;
              }
            }
            else if (isShortSignal) {
              const timeStr = new Date((cdata[i].time as number) * 1000).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
              markers.push({ time: cdata[i].time as Time, position: 'aboveBar', color: '#ef4444', shape: 'arrowDown', text: 'SHORT' });
              curSignal = { type: 'SHORT', time: timeStr, price: cdata[i].close };
              
              if (currentPosition === 'NONE') {
                currentPosition = 'SHORT';
                entryPrice = cdata[i].close;
              }
            }
          }
        }
        // AI Signals are no longer plotted here to avoid overlapping with actual trade markers
        setLatestSignal(curSignal);
        setBacktestStats({
          totalTrades,
          winRate: totalTrades > 0 ? (wins / totalTrades) * 100 : 0,
          netPnL: totalPnL
        });

        // --- Paper Trading Live Execution ---
        const lastClosePrice = cdata[cdata.length - 1].close;
        const currentPState = paperStateRef.current;
        const botActive = isBotActiveRef.current;
        const currentTp = tpRef.current;
        const currentSl = slRef.current;
        let updatePaperState = false;
        
        let currentEquity = currentPState.balance;
        let currentPnlPercent = 0;
        let currentPnlValue = 0;

        if (currentPState.position === 'LONG') {
           currentPnlPercent = ((lastClosePrice - currentPState.entryPrice) / currentPState.entryPrice) * 100;
           currentPnlValue = (currentPnlPercent / 100) * currentPState.balance;
           currentEquity += currentPnlValue;
        } else if (currentPState.position === 'SHORT') {
           currentPnlPercent = ((currentPState.entryPrice - lastClosePrice) / currentPState.entryPrice) * 100;
           currentPnlValue = (currentPnlPercent / 100) * currentPState.balance;
           currentEquity += currentPnlValue;
        }

        if (botActive) {
            let justClosed = false;

            if (currentPState.position !== 'NONE') {
                let closeReason = '';
                if (currentTp > 0 && currentPnlPercent >= currentTp) closeReason = `TP Hit (+${currentTp.toFixed(2)}%)`;
                else if (currentSl > 0 && currentPnlPercent <= -currentSl) closeReason = `SL Hit (-${currentSl.toFixed(2)}%)`;
                
                if (closeReason) {
                    historyRef.current = [{
                            time: new Date().toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' }),
                            timestamp: cdata[cdata.length - 1].time,
                            type: currentPState.position,
                            entry: currentPState.entryPrice,
                            exit: lastClosePrice,
                            pnl: currentPnlValue,
                            reason: closeReason
                    }, ...historyRef.current].slice(0, 50);
                    
                    setTradeHistory([...historyRef.current]);
                    currentPState.balance = currentEquity;
                    currentPState.position = 'NONE';
                    currentPState.entryPrice = 0;
                    justClosed = true;
                    updatePaperState = true;
                }
            }

            if (curSignal.type !== 'NONE' && !justClosed) {
                const isNewSignal = curSignal.type !== currentPState.position;
                
                if (isNewSignal) {
                    if (currentPState.position !== 'NONE') {
                        historyRef.current = [{
                            time: new Date().toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' }),
                            timestamp: cdata[cdata.length - 1].time,
                            type: currentPState.position,
                            entry: currentPState.entryPrice,
                            exit: lastClosePrice,
                            pnl: currentPnlValue,
                            reason: 'Signal Flipped'
                        }, ...historyRef.current].slice(0, 50);
                        setTradeHistory([...historyRef.current]);
                        currentPState.balance = currentEquity;
                    }
                    
                    if (curSignal.type === 'LONG' || curSignal.type === 'SHORT') {
                       currentPState.position = curSignal.type as 'LONG' | 'SHORT';
                       currentPState.entryPrice = lastClosePrice;
                       currentPState.trades += 1;
                       currentEquity = currentPState.balance;
                    } else {
                       currentPState.position = 'NONE';
                       currentPState.entryPrice = 0;
                    }
                    updatePaperState = true;
                }
            }
        }
        
        if (updatePaperState || currentPState.equity !== currentEquity) {
           currentPState.equity = currentEquity;
           setPaperState({ ...currentPState });
           if (updatePaperState) {
              saveToServer({ paperState: currentPState, tradeHistory: historyRef.current });
           }
        }

        // --- AI Auto-Trendline Algorithm (Swing Pivots) ---
        const pivotHighs: {time: number, value: number}[] = [];
        const pivotLows: {time: number, value: number}[] = [];
        const lookback = 7; 

        for (let i = lookback; i < cdata.length - lookback; i++) {
          let isPivotHigh = true;
          let isPivotLow = true;
          for (let j = 1; j <= lookback; j++) {
            if (cdata[i].high <= cdata[i-j].high || cdata[i].high <= cdata[i+j].high) isPivotHigh = false;
            if (cdata[i].low >= cdata[i-j].low || cdata[i].low >= cdata[i+j].low) isPivotLow = false;
          }
          if (isPivotHigh) pivotHighs.push({time: cdata[i].time as number, value: cdata[i].high});
          if (isPivotLow) pivotLows.push({time: cdata[i].time as number, value: cdata[i].low});
        }

        const lastPoint = cdata[cdata.length - 1];

        if (pivotHighs.length >= 2) {
          const l1 = pivotHighs[pivotHighs.length - 2];
          const l2 = pivotHighs[pivotHighs.length - 1];
          const slope = (l2.value - l1.value) / (l2.time - l1.time);
          const endValue = l1.value + slope * ((lastPoint.time as number) - l1.time);
          resistanceSeriesRef.current?.setData([ { time: l1.time as Time, value: l1.value }, { time: l2.time as Time, value: l2.value }, { time: lastPoint.time as Time, value: endValue } ] as { time: Time; value: number }[]);
        }

        if (pivotLows.length >= 2) {
          const l1 = pivotLows[pivotLows.length - 2];
          const l2 = pivotLows[pivotLows.length - 1];
          const slope = (l2.value - l1.value) / (l2.time - l1.time);
          const endValue = l1.value + slope * ((lastPoint.time as number) - l1.time);
          supportSeriesRef.current?.setData([ { time: l1.time as Time, value: l1.value }, { time: l2.time as Time, value: l2.value }, { time: lastPoint.time as Time, value: endValue } ] as { time: Time; value: number }[]);
        }
        
        chart.timeScale().fitContent();

        // --- Plot Trade Markers ---
        const tradeMarkers: SeriesMarker<Time>[] = historyRef.current
           .filter(t => t.timestamp)
           .map(t => ({
              time: t.timestamp as Time,
              position: t.type === 'LONG' ? 'belowBar' : 'aboveBar',
              color: t.type === 'LONG' ? '#0ecb81' : '#f6465d',
              shape: t.type === 'LONG' ? 'arrowUp' : 'arrowDown',
              text: t.type === 'LONG' ? 'BUY' : 'SELL',
              size: 2
           }));
        
        // Sort markers by precise time value for `setMarkers()` to prevent errors
        tradeMarkers.sort((a, b) => (a.time as number) - (b.time as number));
        
        if (candlestickSeriesRef.current) {
            if (!candlestickSeriesMarkersRef.current) {
               candlestickSeriesMarkersRef.current = createSeriesMarkers(candlestickSeriesRef.current, tradeMarkers);
            } else {
               candlestickSeriesMarkersRef.current.setMarkers(tradeMarkers);
            }
        }

      } catch {
        console.error("Error drawing indicators:");
      }
    };

    fetchData();
    const intervalId = setInterval(fetchData, 5000); // Live poll every 5s

    return () => {
      clearInterval(intervalId);
      chart.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, interval, selectedStrategy]);

  const toggleButtonStyle = (isActive: boolean) => ({
    padding: '0.4rem 0.8rem',
    borderRadius: '4px',
    border: `1px solid ${isActive ? 'var(--accent-primary)' : 'var(--border-color)'}`,
    background: isActive ? 'var(--border-color-glow)' : 'transparent',
    color: isActive ? 'var(--text-main)' : 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: '0.85rem',
    transition: 'all 0.2s ease',
    fontFamily: 'Outfit, sans-serif'
  });

  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-muted)' }}>Loading Paper Trading State...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
      {/* Interval Selector */}
      <div style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card-hover)' }}>
        {['1m', '5m', '15m', '1h', '4h', '1d'].map(t => (
          <button 
            key={t}
            onClick={() => setIntervalTime(t)}
            style={{
              padding: '0.25rem 0.6rem',
              borderRadius: '4px',
              border: 'none',
              background: interval === t ? 'var(--accent-primary)' : 'var(--border-color)',
              color: interval === t ? 'white' : 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 600
            }}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Backtest & Indicator Toolbar */}
      <div style={{ display: 'flex', flexDirection: 'column', padding: '0.75rem', borderBottom: '1px solid var(--border-color)', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button style={toggleButtonStyle(showVolume)} onClick={() => setShowVolume(!showVolume)}>
            📊 Volume
          </button>
          <button style={toggleButtonStyle(showEMA)} onClick={() => setShowEMA(!showEMA)}>
            📈 EMA (20/50)
          </button>
          <button style={toggleButtonStyle(showBB)} onClick={() => setShowBB(!showBB)}>
            🔵 Bollinger Bands
          </button>
          <button style={toggleButtonStyle(showTrend)} onClick={() => setShowTrend(!showTrend)}>
            🎯 AI Trendlines
          </button>
          
          {/* Latest Signal Alert */}
          {latestSignal.type !== 'NONE' && (
            <div style={{ 
              marginLeft: 'auto', 
              padding: '0.4rem 0.8rem', 
              borderRadius: '4px', 
              background: latestSignal.type === 'LONG' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              border: `1px solid ${latestSignal.type === 'LONG' ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)'}`,
              color: latestSignal.type === 'LONG' ? '#10b981' : '#ef4444',
              fontSize: '0.85rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <span className="pulse">●</span> 
              LATEST: {latestSignal.type} @ {latestSignal.price}
            </div>
          )}
        </div>
        
        {/* Backtester Results Panel */}
        <div style={{ 
          display: 'flex', flexDirection: 'column', padding: '0.5rem 0.75rem', 
          background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '6px', gap: '0.75rem'
        }}>
          {/* Strategy Switcher */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'Outfit, sans-serif' }}>Strategy:</span>
            <button 
              onClick={() => syncStrategy('EMA')}
              style={{ ...toggleButtonStyle(selectedStrategy === 'EMA'), padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}>
              EMA Crossover (20/50)
            </button>
            <button 
              onClick={() => syncStrategy('BB')}
              style={{ ...toggleButtonStyle(selectedStrategy === 'BB'), padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}>
              BB Mean Reversion
            </button>
          </div>

          <div style={{ 
            display: 'flex', gap: '1.5rem', 
            fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'Outfit, sans-serif'
          }}>
            <div><strong>Total Trades:</strong> <span style={{color: 'var(--text-main)'}}>{backtestStats.totalTrades}</span></div>
            <div><strong>Win Rate:</strong> <span style={{color: backtestStats.winRate >= 50 ? 'var(--profit-color)' : 'var(--loss-color)'}}>{backtestStats.winRate.toFixed(1)}%</span></div>
            <div><strong>Net PnL:</strong> <span style={{color: backtestStats.netPnL >= 0 ? 'var(--profit-color)' : 'var(--loss-color)'}}>{backtestStats.netPnL > 0 ? '+' : ''}{backtestStats.netPnL.toFixed(2)}%</span></div>
          </div>
        </div>
      </div>
      
      {/* Paper Trading Panel */}
      <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button 
           onClick={() => syncBotRunning(!isBotRunning)}
           style={{
             padding: '0.4rem 1.2rem',
             borderRadius: '6px',
             border: 'none',
             background: isBotRunning ? '#ef4444' : '#10b981',
             color: '#fff',
             fontWeight: 'bold',
             cursor: 'pointer',
             boxShadow: isBotRunning ? '0 0 10px rgba(239, 68, 68, 0.4)' : '0 0 10px rgba(16, 185, 129, 0.4)',
             transition: 'all 0.3s ease'
           }}
        >
           {isBotRunning ? '⏹ STOP BOT' : '▶ START PAPER TRADING'}
        </button>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
           <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              TP %: <input type="number" step="0.5" value={tpPercent} onChange={e => syncTp(parseFloat(e.target.value) || 0)} style={{ width: '60px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '4px', padding: '0.2rem', textAlign: 'center' }} />
           </label>
           <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              SL %: <input type="number" step="0.5" value={slPercent} onChange={e => syncSl(parseFloat(e.target.value) || 0)} style={{ width: '60px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '4px', padding: '0.2rem', textAlign: 'center' }} />
           </label>
           <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>* Set to 0 to disable</span>
        </div>
        
        <div style={{ display: 'flex', gap: '1.5rem', background: 'var(--bg-card-hover)', padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.85rem', fontFamily: 'Outfit, sans-serif' }}>
          <div><span style={{color: 'var(--text-muted)'}}>Equity:</span> <strong style={{color: 'var(--text-main)'}}>${paperState.equity.toFixed(2)}</strong></div>
          <div><span style={{color: 'var(--text-muted)'}}>Pos:</span> <strong style={{color: paperState.position === 'LONG' ? 'var(--profit-color)' : paperState.position === 'SHORT' ? 'var(--loss-color)' : 'var(--text-main)'}}>{paperState.position}</strong></div>
          {paperState.position !== 'NONE' && (
             <div><span style={{color: 'var(--text-muted)'}}>Entry:</span> <strong style={{color: 'var(--text-main)'}}>{paperState.entryPrice.toFixed(4)}</strong></div>
          )}
          <div><span style={{color: 'var(--text-muted)'}}>Trades:</span> <strong style={{color: 'var(--text-main)'}}>{paperState.trades}</strong></div>
        </div>

        <button 
           onClick={() => setShowHistory(!showHistory)}
           style={{
             marginLeft: 'auto',
             padding: '0.4rem 0.8rem',
             borderRadius: '4px',
             border: '1px solid var(--border-color)',
             background: showHistory ? 'var(--border-color-glow)' : 'var(--bg-card-hover)',
             color: 'var(--text-main)',
             fontSize: '0.8rem',
             cursor: 'pointer',
             transition: 'all 0.2s',
             display: 'flex',
             alignItems: 'center',
             gap: '0.4rem'
           }}
        >
           📝 History <span style={{ background: 'var(--border-color)', padding: '0.1rem 0.4rem', borderRadius: '10px', fontSize: '0.7rem' }}>{tradeHistory.length}</span>
        </button>
      </div>

      {showHistory && tradeHistory.length > 0 && (
         <div style={{ background: 'var(--bg-card)', padding: '0.75rem', maxHeight: '200px', overflowY: 'auto', borderBottom: '1px solid var(--border-color)', fontSize: '0.8rem', fontFamily: 'Outfit, sans-serif' }}>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', color: 'var(--text-muted)' }}>
               <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                     <th style={{ padding: '0.4rem' }}>Time</th>
                     <th style={{ padding: '0.4rem' }}>Type</th>
                     <th style={{ padding: '0.4rem' }}>Reason</th>
                     <th style={{ padding: '0.4rem' }}>Entry Price</th>
                     <th style={{ padding: '0.4rem' }}>Exit Price</th>
                     <th style={{ padding: '0.4rem', textAlign: 'right' }}>PnL</th>
                  </tr>
               </thead>
               <tbody>
                  {tradeHistory.map((trade, i) => (
                     <tr key={i} style={{ borderBottom: i === tradeHistory.length - 1 ? 'none' : '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.4rem' }}>{trade.time}</td>
                        <td style={{ padding: '0.4rem', color: trade.type === 'LONG' ? 'var(--profit-color)' : 'var(--loss-color)', fontWeight: 600 }}>{trade.type}</td>
                        <td style={{ padding: '0.4rem', color: 'var(--text-main)' }}>{trade.reason}</td>
                        <td style={{ padding: '0.4rem' }}>${trade.entry.toFixed(4)}</td>
                        <td style={{ padding: '0.4rem' }}>${trade.exit.toFixed(4)}</td>
                        <td style={{ padding: '0.4rem', textAlign: 'right', color: trade.pnl >= 0 ? 'var(--profit-color)' : 'var(--loss-color)', fontWeight: 'bold' }}>
                           {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
      )}

      {showHistory && tradeHistory.length === 0 && (
         <div style={{ background: 'var(--bg-card)', padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No trades completed yet. Start Paper Trading and wait for signals.
         </div>
      )}

      {/* Chart Canvas */}
      <div ref={chartContainerRef} style={{ flex: 1, width: '100%' }} />
    </div>
  );
}
