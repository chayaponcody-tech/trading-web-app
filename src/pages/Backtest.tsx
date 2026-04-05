import { useState, useRef, useEffect, useCallback } from 'react';
import { createChart, ColorType, LineSeries, CandlestickSeries, createSeriesMarkers } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, Time, SeriesMarker, ISeriesMarkersPluginApi } from 'lightweight-charts';
import { EMA, BollingerBands, RSI } from 'technicalindicators';
import SymbolSelector from '../components/SymbolSelector';

interface BacktestTrade {
  entryTime: string;
  exitTime: string;
  type: string;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  reason: string;
  maxFloatingLoss?: number;
}

interface OpenPosition {
  type: string;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  size?: number;
}

interface BacktestResults {
  netPnl: number;
  netPnlPct: number;
  worstFloatingLoss: number;
  winRate: number;
  winCount: number;
  lossCount: number;
  maxDrawdown: number;
  profitFactor: number;
  totalTrades: number;
  openPositions: OpenPosition[];
}

export default function Backtest() {
  const [symbol, setSymbol] = useState('BTCUSDT'); 
  const [interval, setIntervalTime] = useState('1h');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [strategy, setStrategy] = useState('EMA');
  const [tpPercent, setTpPercent] = useState(2.0);
  const [slPercent, setSlPercent] = useState(1.0);
  const [gridUpper, setGridUpper] = useState(70000);
  const [gridLower, setGridLower] = useState(50000);
  const [gridQuantity, setGridQuantity] = useState(20);
  const [capital, setCapital] = useState(10000);

  useEffect(() => {
    switch (symbol) {
      case 'BTCUSDT': setGridUpper(75000); setGridLower(55000); break;
      case 'ETHUSDT': setGridUpper(4000); setGridLower(2500); break;
      case 'SOLUSDT': setGridUpper(220); setGridLower(120); break;
      case 'BNBUSDT': setGridUpper(700); setGridLower(500); break;
    }
  }, [symbol]);

  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<BacktestResults | null>(null);
  const [tradeLog, setTradeLog] = useState<BacktestTrade[]>([]);
  const [activeTab, setActiveTab] = useState<'charts' | 'log'>('charts');
  const [showMarkers, setShowMarkers] = useState(true);
  const [storedMarkers, setStoredMarkers] = useState<SeriesMarker<Time>[]>([]);
  const [hoverData, setHoverData] = useState<{ unrealized: number; equity: number } | null>(null);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const equitySeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  const candleChartContainerRef = useRef<HTMLDivElement>(null);
  const candleChartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  
  // The official markers plugin instance
  const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);

  const ema20SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ema50SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbUpperSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbLowerSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbMidSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  // RSI chart (separate panel since RSI is 0-100 scale)
  const rsiChartContainerRef = useRef<HTMLDivElement>(null);
  const rsiChartRef = useRef<IChartApi | null>(null);
  const rsiSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const rsi30Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const rsi70Ref = useRef<ISeriesApi<"Line"> | null>(null);

  const equityDataMapRef = useRef<Map<number, { unrealized: number; equity: number }>>(new Map());

  // Apply or remove markers using the plugin
  const applyMarkers = useCallback((markers: SeriesMarker<Time>[], visible: boolean) => {
    if (!candleSeriesRef.current) return;
    if (markersPluginRef.current) {
      markersPluginRef.current.setMarkers(visible ? markers : []);
    } else if (visible && markers.length > 0) {
      markersPluginRef.current = createSeriesMarkers(candleSeriesRef.current, markers);
    }
  }, []);

  useEffect(() => {
    applyMarkers(storedMarkers, showMarkers);
  }, [showMarkers, storedMarkers, applyMarkers]);

  useEffect(() => {
    if (!chartContainerRef.current) return;
    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#848e9c' },
      grid: { vertLines: { color: '#2b313f' }, horzLines: { color: '#2b313f' } },
      timeScale: { timeVisible: true, secondsVisible: false },
      localization: {
        locale: 'th-TH',
        timeFormatter: (time: number) => {
          return new Date(time * 1000).toLocaleString('th-TH', {
            hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Bangkok'
          });
        },
      },
      rightPriceScale: { autoScale: true },
      autoSize: true,
    });
    chartRef.current = chart;
    equitySeriesRef.current = chart.addSeries(LineSeries, { color: '#0ecb81', lineWidth: 2 });

    if (candleChartContainerRef.current) {
      const cChart = createChart(candleChartContainerRef.current, {
        layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#848e9c' },
        grid: { vertLines: { color: '#2b313f' }, horzLines: { color: '#2b313f' } },
        timeScale: { timeVisible: true, secondsVisible: false },
        localization: {
          locale: 'th-TH',
          timeFormatter: (time: number) => {
            return new Date(time * 1000).toLocaleString('th-TH', {
              hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Bangkok'
            });
          },
        },
        rightPriceScale: { autoScale: true },
        autoSize: true,
      });
      candleChartRef.current = cChart;
      candleSeriesRef.current = cChart.addSeries(CandlestickSeries, {
        upColor: '#0ecb81', downColor: '#f6465d', borderVisible: false, wickUpColor: '#0ecb81', wickDownColor: '#f6465d'
      });
      
      ema20SeriesRef.current = cChart.addSeries(LineSeries, { color: '#2962FF', lineWidth: 1, title: 'EMA 20' });
      ema50SeriesRef.current = cChart.addSeries(LineSeries, { color: '#FF6D00', lineWidth: 1, title: 'EMA 50' });
      bbUpperSeriesRef.current = cChart.addSeries(LineSeries, { color: 'rgba(132, 142, 156, 0.5)', lineWidth: 1, title: 'BB U' });
      bbLowerSeriesRef.current = cChart.addSeries(LineSeries, { color: 'rgba(132, 142, 156, 0.5)', lineWidth: 1, title: 'BB L' });
      bbMidSeriesRef.current = cChart.addSeries(LineSeries, { color: 'rgba(132, 142, 156, 0.2)', lineWidth: 1, title: 'BB M' });

      let isCrossUpdating = false;
      const sync = (logicalRange: any, target: IChartApi) => {
          if (!isCrossUpdating && logicalRange) {
              isCrossUpdating = true;
              target.timeScale().setVisibleLogicalRange(logicalRange);
              isCrossUpdating = false;
          }
      };
      chart.timeScale().subscribeVisibleLogicalRangeChange((lr) => sync(lr, cChart));
      cChart.timeScale().subscribeVisibleLogicalRangeChange((lr) => sync(lr, chart));

      cChart.subscribeCrosshairMove((param) => {
          if (param.time) {
              const d = equityDataMapRef.current.get(param.time as number);
              setHoverData(d ?? null);
          } else setHoverData(null);
      });
    }

    // RSI chart (separate oscillator panel)
    if (rsiChartContainerRef.current) {
      const rChart = createChart(rsiChartContainerRef.current, {
        layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#848e9c' },
        grid: { vertLines: { color: '#2b313f' }, horzLines: { color: '#2b313f' } },
        timeScale: { timeVisible: true, secondsVisible: false },
        rightPriceScale: { autoScale: false, scaleMargins: { top: 0.05, bottom: 0.05 } },
        autoSize: true,
      });
      rsiChartRef.current = rChart;
      rsiSeriesRef.current = rChart.addSeries(LineSeries, { color: '#ab47bc', lineWidth: 2, title: 'RSI 14', priceScaleId: 'right' });
      rsi30Ref.current = rChart.addSeries(LineSeries, { color: 'rgba(14,203,129,0.3)', lineWidth: 1, lineStyle: 2, priceScaleId: 'right' });
      rsi70Ref.current = rChart.addSeries(LineSeries, { color: 'rgba(246,70,93,0.3)', lineWidth: 1, lineStyle: 2, priceScaleId: 'right' });
      rChart.priceScale('right').applyOptions({ autoScale: false, scaleMargins: { top: 0.05, bottom: 0.05 } });

      // Sync RSI chart with candle chart
      if (candleChartRef.current) {
        let isCross2 = false;
        const sync2 = (lr: any, t: IChartApi) => { if (!isCross2 && lr) { isCross2 = true; t.timeScale().setVisibleLogicalRange(lr); isCross2 = false; } };
        candleChartRef.current.timeScale().subscribeVisibleLogicalRangeChange((lr) => sync2(lr, rChart));
        rChart.timeScale().subscribeVisibleLogicalRangeChange((lr) => { if (candleChartRef.current) sync2(lr, candleChartRef.current); });
      }
    }

    return () => { chart.remove(); candleChartRef.current?.remove(); rsiChartRef.current?.remove(); markersPluginRef.current = null; }
  }, []);

  const calculateAndDrawIndicators = useCallback((cdata: any[], currentStrategy: string) => {
    const closePrices = cdata.map((d) => d.close);
    const signals: string[] = new Array(cdata.length).fill('NONE');

    // Reset all indicator series
    ema20SeriesRef.current?.setData([]);
    ema50SeriesRef.current?.setData([]);
    bbUpperSeriesRef.current?.setData([]);
    bbLowerSeriesRef.current?.setData([]);
    bbMidSeriesRef.current?.setData([]);
    rsiSeriesRef.current?.setData([]);
    rsi30Ref.current?.setData([]);
    rsi70Ref.current?.setData([]);

    if (currentStrategy === 'EMA') {
      const d20 = EMA.calculate({ period: 20, values: closePrices });
      const d50 = EMA.calculate({ period: 50, values: closePrices });
      const o20 = cdata.length - d20.length;
      const o50 = cdata.length - d50.length;
      ema20SeriesRef.current?.setData(d20.map((v, idx) => ({ time: cdata[idx + o20].time, value: v })));
      ema50SeriesRef.current?.setData(d50.map((v, idx) => ({ time: cdata[idx + o50].time, value: v })));
      const warmup = Math.max(o20, o50) + 10;
      for (let i = warmup + 1; i < cdata.length; i++) {
        if (d20[i-1-o20] <= d50[i-1-o50] && d20[i-o20] > d50[i-o50]) signals[i] = 'LONG';
        else if (d20[i-1-o20] >= d50[i-1-o50] && d20[i-o20] < d50[i-o50]) signals[i] = 'SHORT';
      }
    } else if (currentStrategy === 'BB') {
      const bb = BollingerBands.calculate({ period: 20, stdDev: 2, values: closePrices });
      const offset = cdata.length - bb.length;
      bbUpperSeriesRef.current?.setData(bb.map((v, idx) => ({ time: cdata[idx + offset].time, value: v.upper })));
      bbLowerSeriesRef.current?.setData(bb.map((v, idx) => ({ time: cdata[idx + offset].time, value: v.lower })));
      bbMidSeriesRef.current?.setData(bb.map((v, idx) => ({ time: cdata[idx + offset].time, value: v.middle })));
      for (let i = offset + 5; i < cdata.length; i++) {
        if (closePrices[i-1] <= bb[i-1-offset].lower && closePrices[i] > bb[i-offset].lower) signals[i] = 'LONG';
        else if (closePrices[i-1] >= bb[i-1-offset].upper && closePrices[i] < bb[i-offset].upper) signals[i] = 'SHORT';
      }
    } else if (currentStrategy === 'RSI') {
      const rsiValues = RSI.calculate({ period: 14, values: closePrices });
      const rsiOffset = cdata.length - rsiValues.length;
      const rsiLine = rsiValues.map((v, idx) => ({ time: cdata[idx + rsiOffset].time, value: v }));
      rsiSeriesRef.current?.setData(rsiLine);
      rsi30Ref.current?.setData(rsiLine.map(p => ({ time: p.time, value: 30 })));
      rsi70Ref.current?.setData(rsiLine.map(p => ({ time: p.time, value: 70 })));
      rsiChartRef.current?.timeScale().fitContent();
      for (let i = rsiOffset + 5; i < cdata.length; i++) {
        if (rsiValues[i-1-rsiOffset] <= 30 && rsiValues[i-rsiOffset] > 30) signals[i] = 'LONG';
        else if (rsiValues[i-1-rsiOffset] >= 70 && rsiValues[i-rsiOffset] < 70) signals[i] = 'SHORT';
      }
    } else if (['EMA_RSI', 'BB_RSI', 'EMA_BB_RSI'].includes(currentStrategy)) {
      const d20 = EMA.calculate({ period: 20, values: closePrices });
      const d50 = EMA.calculate({ period: 50, values: closePrices });
      const o20 = cdata.length - d20.length;
      const o50 = cdata.length - d50.length;
      const bb = BollingerBands.calculate({ period: 20, stdDev: 2, values: closePrices });
      const bbOff = cdata.length - bb.length;
      const rsiValues = RSI.calculate({ period: 14, values: closePrices });
      const rsiOff = cdata.length - rsiValues.length;

      if (currentStrategy.includes('EMA')) {
        ema20SeriesRef.current?.setData(d20.map((v, idx) => ({ time: cdata[idx + o20].time, value: v })));
        ema50SeriesRef.current?.setData(d50.map((v, idx) => ({ time: cdata[idx + o50].time, value: v })));
      }
      if (currentStrategy.includes('BB')) {
        bbUpperSeriesRef.current?.setData(bb.map((v, idx) => ({ time: cdata[idx + bbOff].time, value: v.upper })));
        bbLowerSeriesRef.current?.setData(bb.map((v, idx) => ({ time: cdata[idx + bbOff].time, value: v.lower })));
        bbMidSeriesRef.current?.setData(bb.map((v, idx) => ({ time: cdata[idx + bbOff].time, value: v.middle })));
      }
      const rsiLine = rsiValues.map((v, idx) => ({ time: cdata[idx + rsiOff].time, value: v }));
      rsiSeriesRef.current?.setData(rsiLine);
      rsi30Ref.current?.setData(rsiLine.map(p => ({ time: p.time, value: 30 })));
      rsi70Ref.current?.setData(rsiLine.map(p => ({ time: p.time, value: 70 })));
      rsiChartRef.current?.timeScale().fitContent();

      const start = Math.max(o20, o50, bbOff, rsiOff) + 10;
      for (let i = start; i < cdata.length; i++) {
        const rsi = rsiValues[i - rsiOff];
        const prevRsi = rsiValues[i - 1 - rsiOff];
        const emaCrossUp = d20[i-o20] > d50[i-o50] && d20[i-1-o20] <= d50[i-1-o50];
        const emaCrossDown = d20[i-o20] < d50[i-o50] && d20[i-1-o20] >= d50[i-1-o50];
        const emaBullish = d20[i-o20] > d50[i-o50];
        const emaBearish = d20[i-o20] < d50[i-o50];
        const bbBounceUp = closePrices[i-1] <= bb[i-1-bbOff].lower && closePrices[i] > bb[i-bbOff].lower;
        const bbBounceDown = closePrices[i-1] >= bb[i-1-bbOff].upper && closePrices[i] < bb[i-bbOff].upper;
        
        if (currentStrategy === 'EMA_RSI') {
          if (emaCrossUp && rsi < 40) signals[i] = 'LONG';
          else if (emaCrossDown && rsi > 60) signals[i] = 'SHORT';
        } else if (currentStrategy === 'BB_RSI') {
          if (bbBounceUp && prevRsi <= 30) signals[i] = 'LONG';
          else if (bbBounceDown && prevRsi >= 70) signals[i] = 'SHORT';
        } else if (currentStrategy === 'EMA_BB_RSI') {
          if (emaBullish && bbBounceUp && rsi < 40) signals[i] = 'LONG';
          else if (emaBearish && bbBounceDown && rsi > 60) signals[i] = 'SHORT';
        }
      }
    }
    return signals;
  }, []);

  // Auto-preview on symbol/interval/strategy change
  useEffect(() => {
    const fetchPreview = async () => {
      try {
        const res = await fetch(`/api/backtest?symbol=${symbol}&interval=${interval}&limit=1000`);
        const data = await res.json();
        if (!Array.isArray(data)) return;

        const TZ_OFFSET = 7 * 3600;
        const cdata = data.map((d: any) => ({
          time: (Math.floor(d[0] / 1000) + TZ_OFFSET) as Time,
          open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4])
        }));

        candleSeriesRef.current?.setData(cdata);
        calculateAndDrawIndicators(cdata, strategy);
        
        candleChartRef.current?.timeScale().fitContent();
        rsiChartRef.current?.timeScale().fitContent();
        // Reset scale as well
        candleChartRef.current?.priceScale('right').applyOptions({ autoScale: true });
        rsiChartRef.current?.priceScale('right').applyOptions({ autoScale: true });
      } catch (err) { console.error('Preview error:', err); }
    };

    if (candleSeriesRef.current && !isRunning) {
      fetchPreview();
    }
  }, [symbol, interval, strategy, calculateAndDrawIndicators, isRunning]);

  const runBacktest = async () => {
    setIsRunning(true);
    setResults(null);
    setTradeLog([]);
    setActiveTab('charts');
    equityDataMapRef.current.clear();
    
    // Clear markers immediately
    if (markersPluginRef.current) {
        markersPluginRef.current.setMarkers([]);
    }
    setStoredMarkers([]);

    ema20SeriesRef.current?.setData([]);
    ema50SeriesRef.current?.setData([]);
    bbUpperSeriesRef.current?.setData([]);
    bbLowerSeriesRef.current?.setData([]);
    bbMidSeriesRef.current?.setData([]);
    rsiSeriesRef.current?.setData([]);
    rsi30Ref.current?.setData([]);
    rsi70Ref.current?.setData([]);

    try {
      const startMs = startDate ? new Date(startDate).getTime() : '';
      const endMs = endDate ? new Date(endDate).getTime() : '';
      const res = await fetch(`/api/backtest?symbol=${symbol}&interval=${interval}&limit=1000${startMs ? `&startTime=${startMs}` : ''}${endMs ? `&endTime=${endMs}` : ''}`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error('Data fetch failed');

      const cdata = data.map((d: any) => ({
        time: (Math.floor(d[0] / 1000)) as Time,
        open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4])
      }));

      // Calculate signals and render indicators
      const signals = calculateAndDrawIndicators(cdata, strategy);


      const tzOpts: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Bangkok', dateStyle: 'short', timeStyle: 'short' };
      const logs: BacktestTrade[] = [];
      const markers: SeriesMarker<Time>[] = [];
      const equityCurve: Array<{time: Time, value: number}> = [];
      let finalResults: BacktestResults;

      if (strategy === 'GRID') {
         const step = (gridUpper - gridLower) / gridQuantity;
         const sizePerGrid = capital / gridQuantity;
         const grids: Array<{buyPrice: number, sellPrice: number, isBought: boolean}> = [];
         for(let i=0; i<gridQuantity; i++) grids.push({ buyPrice: gridLower + step * i, sellPrice: gridLower + step * (i + 1), isBought: false });
         
         let currentCash = capital;
         if (cdata.length > 0) grids.forEach(g => { if (g.buyPrice < cdata[0].open) { g.isBought = true; currentCash -= sizePerGrid; } });

         let peakEquity = capital, maxDrawdown = 0, grossProfit = 0, worstFloating = 0;

         for (let i = 0; i < cdata.length; i++) {
            const candle = cdata[i];
            grids.forEach(g => {
               if (g.isBought && candle.high >= g.sellPrice) {
                  g.isBought = false;
                  const pnlVal = ((g.sellPrice - g.buyPrice) / g.buyPrice) * sizePerGrid;
                  currentCash += sizePerGrid + pnlVal; grossProfit += pnlVal;
                   logs.push({ entryTime: new Date((candle.time as number)*1000).toLocaleString('th-TH', tzOpts), exitTime: new Date((candle.time as number)*1000).toLocaleString('th-TH', tzOpts), type: 'GRID SELL', entryPrice: g.buyPrice, exitPrice: g.sellPrice, pnl: pnlVal, reason: 'Target' });
                  markers.push({ time: candle.time, position: 'aboveBar', color: '#f6465d', shape: 'arrowDown', text: 'SELL' });
               }
               if (!g.isBought && candle.low <= g.buyPrice && currentCash >= sizePerGrid) {
                  g.isBought = true; currentCash -= sizePerGrid;
                  markers.push({ time: candle.time, position: 'belowBar', color: '#0ecb81', shape: 'arrowUp', text: 'BUY' });
               }
            });
            let unrealized = 0;
            grids.forEach(g => { if (g.isBought) unrealized += sizePerGrid * (candle.close / g.buyPrice) - sizePerGrid; });
            if (unrealized < worstFloating) worstFloating = unrealized;
            const eq = currentCash + grids.filter(g => g.isBought).length * sizePerGrid + unrealized;
            if (eq > peakEquity) peakEquity = eq;
            maxDrawdown = Math.max(maxDrawdown, ((peakEquity - eq) / peakEquity) * 100);
            equityCurve.push({ time: candle.time, value: eq });
            equityDataMapRef.current.set(candle.time as number, { unrealized, equity: eq });
         }
         const lastClose = cdata[cdata.length - 1]?.close ?? 0;
         const openPos: OpenPosition[] = grids.filter(g => g.isBought).map(g => ({
           type: 'GRID HOLD', entryPrice: g.buyPrice, currentPrice: lastClose,
           unrealizedPnl: sizePerGrid * (lastClose / g.buyPrice) - sizePerGrid, size: sizePerGrid
         }));
         finalResults = { netPnl: equityCurve[equityCurve.length-1].value - capital, netPnlPct: ((equityCurve[equityCurve.length-1].value - capital) / capital) * 100, worstFloatingLoss: worstFloating, winRate: 100, winCount: logs.length, lossCount: 0, maxDrawdown, profitFactor: grossProfit, totalTrades: logs.length, openPositions: openPos };
      } else {
         let currentCash = capital, peakEquity = capital, maxDD = 0;
         let pos = 'NONE', entryPriceValue = 0, entryTimeValue = 0;
         let grossProfit = 0, grossLoss = 0, winCount = 0;
         let worstFloatingLossTotal = 0, maxUnrealizedTradeLoss = 0;
         
         for (let i = 0; i < cdata.length; i++) {
             const candle = cdata[i];
             const signal = signals[i];
             let unrealized = 0;
             if (pos === 'LONG') unrealized = ((candle.close - entryPriceValue) / entryPriceValue) * currentCash;
             else if (pos === 'SHORT') unrealized = ((entryPriceValue - candle.close) / entryPriceValue) * currentCash;
             if (pos !== 'NONE' && unrealized < maxUnrealizedTradeLoss) maxUnrealizedTradeLoss = unrealized;
              if (unrealized < worstFloatingLossTotal) worstFloatingLossTotal = unrealized;
             const stepEq = currentCash + unrealized;
             if (stepEq > peakEquity) peakEquity = stepEq;
             maxDD = Math.max(maxDD, ((peakEquity - stepEq) / peakEquity) * 100);
             equityCurve.push({ time: candle.time, value: stepEq });
             equityDataMapRef.current.set(candle.time as number, { unrealized, equity: stepEq });

             if (pos !== 'NONE') {
                 const pnlPct = pos === 'LONG' ? ((candle.close - entryPriceValue) / entryPriceValue) * 100 : ((entryPriceValue - candle.close) / entryPriceValue) * 100;
                 let closeReason = '';
                 if (tpPercent > 0 && pnlPct >= tpPercent) closeReason = `TP Hit (+${tpPercent}%)`;
                 else if (slPercent > 0 && pnlPct <= -slPercent) closeReason = `SL Hit (-${slPercent}%)`;
                 else if (signal !== 'NONE' && signal !== pos) closeReason = 'Signal Flipped';
                 if (closeReason) {
                     const tradePnL = (pnlPct / 100) * currentCash;
                     currentCash += tradePnL;
                     if (tradePnL > 0) { grossProfit += tradePnL; winCount++; } else { grossLoss += Math.abs(tradePnL); }
                      logs.push({ entryTime: new Date((entryTimeValue)*1000).toLocaleString('th-TH', tzOpts), exitTime: new Date((candle.time as number)*1000).toLocaleString('th-TH', tzOpts), type: pos, entryPrice: entryPriceValue, exitPrice: candle.close, pnl: tradePnL, reason: closeReason, maxFloatingLoss: maxUnrealizedTradeLoss });
                     markers.push({ time: candle.time, position: pos === 'LONG' ? 'aboveBar' : 'belowBar', color: '#f6465d', shape: 'arrowDown', text: pos === 'LONG' ? 'SELL' : 'BUY(Close)' });
                     pos = 'NONE'; maxUnrealizedTradeLoss = 0;
                 }
             }
             if (pos === 'NONE' && (signal === 'LONG' || signal === 'SHORT')) {
                pos = signal; entryPriceValue = candle.close; entryTimeValue = candle.time as number;
                markers.push({ time: candle.time, position: pos === 'LONG' ? 'belowBar' : 'aboveBar', color: pos === 'LONG' ? '#0ecb81' : '#f6465d', shape: 'arrowUp', text: pos });
             }
         }
         const lastClose = cdata[cdata.length - 1]?.close ?? 0;
         const openPos: OpenPosition[] = pos !== 'NONE' ? [{ type: pos, entryPrice: entryPriceValue, currentPrice: lastClose, unrealizedPnl: pos === 'LONG' ? ((lastClose - entryPriceValue) / entryPriceValue) * currentCash : ((entryPriceValue - lastClose) / entryPriceValue) * currentCash }] : [];
         finalResults = { netPnl: equityCurve[equityCurve.length-1].value - capital, netPnlPct: ((equityCurve[equityCurve.length-1].value - capital) / capital) * 100, worstFloatingLoss: worstFloatingLossTotal, winRate: logs.length > 0 ? (winCount / logs.length) * 100 : 0, winCount, lossCount: logs.length - winCount, maxDrawdown: maxDD, profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit, totalTrades: logs.length, openPositions: openPos };
      }

      // Set chart data
      candleSeriesRef.current?.setData(cdata);
      equitySeriesRef.current?.setData(equityCurve);
      
      // Use createSeriesMarkers plugin for markers (v5 API)
      const sortedMarkers = [...markers].sort((a,b) => (a.time as number) - (b.time as number));
      setStoredMarkers(sortedMarkers);
      setTradeLog(logs.reverse());
      setResults(finalResults);

      candleChartRef.current?.timeScale().fitContent();
      chartRef.current?.timeScale().fitContent();
    } catch (e) {
      console.error(e);
      alert('Backtest Failed: ' + (e as Error).message);
    }
    setIsRunning(false);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1rem', height: 'calc(100vh - 80px)', overflow: 'hidden' }}>
      {/* Parameter Panel */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', overflowY: 'auto', padding: '1rem' }}>
        <h4 className="m-0" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', fontSize: '1rem' }}>Strategy Tester</h4>
        <SymbolSelector value={symbol} onSelect={setSymbol} />
        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Timeframe
          <select value={interval} onChange={e => setIntervalTime(e.target.value)} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.4rem', borderRadius: '4px', marginTop: '0.2rem' }}>
            <option value="5m">5m</option><option value="15m">15m</option><option value="1h">1h</option><option value="4h">4h</option><option value="1d">1d</option>
          </select>
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Start
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.3rem', borderRadius: '4px', fontSize: '10px' }} />
          </label>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>End
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.3rem', borderRadius: '4px', fontSize: '10px' }} />
          </label>
        </div>
        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Strategy
          <select value={strategy} onChange={e => setStrategy(e.target.value)} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.4rem', borderRadius: '4px', marginTop: '0.2rem' }}>
            <option value="EMA">EMA Crossover</option><option value="BB">BB Mean Reversion</option><option value="RSI">RSI Overbought/Oversold</option><option value="EMA_RSI">⚡ EMA + RSI</option><option value="BB_RSI">⚡ BB + RSI</option><option value="EMA_BB_RSI">⚡ EMA + BB + RSI</option><option value="GRID">Grid Bot</option>
          </select>
        </label>
        {strategy === 'GRID' ? (
           <div style={{ border: '1px solid var(--border-color)', padding: '0.5rem', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
             <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Upper
               <input type="number" value={gridUpper} onChange={e => setGridUpper(parseFloat(e.target.value))} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.3rem' }} />
             </label>
             <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Lower
               <input type="number" value={gridLower} onChange={e => setGridLower(parseFloat(e.target.value))} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.3rem' }} />
             </label>
             <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Grids
               <input type="number" value={gridQuantity} onChange={e => setGridQuantity(parseInt(e.target.value))} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.3rem' }} />
             </label>
           </div>
        ) : (
           <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
             <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>TP%
               <input type="number" step="0.5" value={tpPercent} onChange={e => setTpPercent(parseFloat(e.target.value))} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.3rem' }} />
             </label>
             <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SL%
               <input type="number" step="0.5" value={slPercent} onChange={e => setSlPercent(parseFloat(e.target.value))} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.3rem' }} />
             </label>
           </div>
        )}
        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Capital
          <input type="number" value={capital} onChange={e => setCapital(parseFloat(e.target.value))} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.4rem', marginTop: '0.2rem' }} />
        </label>
        <button onClick={runBacktest} disabled={isRunning} style={{ background: 'var(--accent-primary)', color: '#fff', border: 'none', padding: '0.7rem', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', marginTop: '0.5rem' }}>
          {isRunning ? 'Running...' : '▶ Start Backtest'}
        </button>
      </div>

      {/* Main Content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', paddingRight: '0.25rem' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.6rem' }}>
          {[
            { label: 'Net PnL', value: results ? `${results.netPnl >= 0 ? '+' : ''}$${results.netPnl.toFixed(2)} (${results.netPnlPct >= 0 ? '+' : ''}${results.netPnlPct.toFixed(1)}%)` : '--', color: results && results.netPnl >= 0 ? 'var(--profit-color)' : 'var(--loss-color)' },
            { label: 'Peak Float Loss', value: results ? (results.worstFloatingLoss < 0 ? `-$${Math.abs(results.worstFloatingLoss).toFixed(2)}` : '$0.00') : '--', color: 'var(--loss-color)' },
            { label: 'Win Rate', value: results ? `${results.winRate.toFixed(1)}% (${results.winCount}W / ${results.lossCount}L)` : '--', color: '#fff' },
            { label: 'Max DD', value: results ? `${results.maxDrawdown.toFixed(2)}%` : '--', color: 'var(--loss-color)' },
            { label: 'P. Factor', value: results ? results.profitFactor.toFixed(2) : '--', color: '#fff' },
            { label: 'Trades', value: results ? results.totalTrades : '--', color: '#fff' },
            { label: 'Open Pos.', value: results ? (results.openPositions.length > 0 ? `${results.openPositions.length} Active` : 'None') : '--', color: results && results.openPositions.length > 0 ? '#f0b90b' : '#0ecb81' }
          ].map((stat, i) => (
            <div key={i} className="glass-panel" style={{ padding: '0.6rem', textAlign: 'center' }}>
               <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>{stat.label}</div>
               <div style={{ fontSize: '1rem', fontWeight: 'bold', color: stat.color }}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
          <button onClick={() => setActiveTab('charts')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 'bold', padding: '0.5rem', color: activeTab === 'charts' ? 'var(--text-main)' : 'var(--text-muted)', borderBottom: activeTab === 'charts' ? '2px solid var(--accent-primary)' : 'none' }}>Charts</button>
          <button onClick={() => setActiveTab('log')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 'bold', padding: '0.5rem', color: activeTab === 'log' ? 'var(--text-main)' : 'var(--text-muted)', borderBottom: activeTab === 'log' ? '2px solid var(--accent-primary)' : 'none' }}>Trade Log ({tradeLog.length})</button>
        </div>

        {/* Charts */}
        <div style={{ display: activeTab === 'charts' ? 'flex' : 'none', flexDirection: 'column', gap: '1rem', position: 'relative' }}>
          {hoverData && (
            <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.85)', border: '1px solid var(--accent-primary)', padding: '0.5rem 0.8rem', borderRadius: '4px', zIndex: 100, fontSize: '0.75rem', pointerEvents: 'none' }}>
              <div style={{ color: '#fff' }}>Equity: <b>${hoverData.equity.toFixed(2)}</b></div>
              <div style={{ color: hoverData.unrealized >= 0 ? 'var(--profit-color)' : 'var(--loss-color)' }}>Unrealized: <b>{hoverData.unrealized >= 0 ? '+' : ''}${hoverData.unrealized.toFixed(2)}</b></div>
            </div>
          )}
          <div className="glass-panel" style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h5 className="m-0">Market & Indicators</h5>
              <button onClick={() => setShowMarkers(v => !v)} style={{ background: showMarkers ? 'var(--accent-primary)' : 'transparent', color: showMarkers ? '#fff' : 'var(--text-main)', border: '1px solid #444', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer' }}>{showMarkers ? 'Hide Markers' : 'Show Markers'}</button>
            </div>
            <div style={{ height: '320px', border: '1px solid var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
              <div ref={candleChartContainerRef} style={{ width: '100%', height: '100%' }} />
            </div>
          </div>
          {(strategy === 'RSI' || strategy === 'EMA_RSI' || strategy === 'BB_RSI' || strategy === 'EMA_BB_RSI') && (
            <div className="glass-panel" style={{ padding: '1rem' }}>
              <h5 className="m-0" style={{ marginBottom: '0.5rem' }}>RSI (14)</h5>
              <div style={{ height: '120px', border: '1px solid var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                <div ref={rsiChartContainerRef} style={{ width: '100%', height: '100%' }} />
              </div>
            </div>
          )}
          <div className="glass-panel" style={{ padding: '1rem' }}>
            <h5 className="m-0" style={{ marginBottom: '0.5rem' }}>Portfolio Equity Curve</h5>
            <div style={{ height: '180px', border: '1px solid var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
              <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />
            </div>
          </div>
        </div>

        {/* Trade Log */}
        <div className="glass-panel" style={{ display: activeTab === 'log' ? 'block' : 'none' }}>
          <div style={{ overflow: 'auto', height: 'calc(100vh - 280px)' }}>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 10 }}>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.5rem' }}>Entry Time</th><th>Exit Time</th><th>Type</th><th>Entry $</th><th>Exit $</th>
                  <th style={{ textAlign: 'right' }}>PnL</th><th style={{ textAlign: 'right' }}>Max Float Loss</th>
                </tr>
              </thead>
              <tbody>
                {tradeLog.map((log, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.5rem' }}>{log.entryTime}</td><td>{log.exitTime}</td>
                    <td style={{ color: log.type.includes('BUY') || log.type === 'LONG' ? 'var(--profit-color)' : 'var(--loss-color)', fontWeight: 'bold' }}>{log.type}</td>
                    <td>${log.entryPrice.toFixed(2)}</td><td>${log.exitPrice.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', color: log.pnl >= 0 ? 'var(--profit-color)' : 'var(--loss-color)', fontWeight: 'bold' }}>{log.pnl >= 0 ? '+' : ''}${log.pnl.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--loss-color)' }}>{log.maxFloatingLoss ? `-$${Math.abs(log.maxFloatingLoss).toFixed(2)}` : '--'}</td>
                  </tr>
                ))}
                {tradeLog.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Run backtest to see trade log.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Open Positions */}
          {results && results.openPositions.length > 0 && (
            <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
              <h5 style={{ margin: '0 0 0.5rem 0', color: '#f0b90b' }}>⚠ Open Positions at End ({results.openPositions.length})</h5>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.4rem' }}>Type</th><th>Entry $</th><th>Current $</th><th style={{ textAlign: 'right' }}>Unrealized PnL</th>{strategy === 'GRID' && <th style={{ textAlign: 'right' }}>Size</th>}
                  </tr>
                </thead>
                <tbody>
                  {results.openPositions.map((op, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.4rem', color: '#f0b90b', fontWeight: 'bold' }}>{op.type}</td>
                      <td>${op.entryPrice.toFixed(2)}</td>
                      <td>${op.currentPrice.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', color: op.unrealizedPnl >= 0 ? 'var(--profit-color)' : 'var(--loss-color)', fontWeight: 'bold' }}>{op.unrealizedPnl >= 0 ? '+' : ''}${op.unrealizedPnl.toFixed(2)}</td>
                      {strategy === 'GRID' && <td style={{ textAlign: 'right' }}>${op.size?.toFixed(2)}</td>}
                    </tr>
                  ))}
                  <tr style={{ borderTop: '2px solid var(--border-color)', fontWeight: 'bold' }}>
                    <td style={{ padding: '0.4rem' }} colSpan={3}>Total Unrealized</td>
                    <td style={{ textAlign: 'right', color: results.openPositions.reduce((s,o) => s + o.unrealizedPnl, 0) >= 0 ? 'var(--profit-color)' : 'var(--loss-color)' }}>
                      {results.openPositions.reduce((s,o) => s + o.unrealizedPnl, 0) >= 0 ? '+' : ''}${results.openPositions.reduce((s,o) => s + o.unrealizedPnl, 0).toFixed(2)}
                    </td>
                    {strategy === 'GRID' && <td style={{ textAlign: 'right' }}>${results.openPositions.reduce((s,o) => s + (o.size ?? 0), 0).toFixed(2)}</td>}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
