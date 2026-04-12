import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, LineSeries, CandlestickSeries, createSeriesMarkers } from 'lightweight-charts';
import type { IChartApi } from 'lightweight-charts';
import type { CandleData } from '../types';

interface Props {
  data: CandleData[];
  indicators: any;
  entryPrice: number;
  entryTime: number;
  hasPosition: boolean;
  type: string;
  strategy: string;
  gridUpper?: number;
  gridLower?: number;
  onChartCreated?: (chart: IChartApi) => void;
}

export const PriceChart: React.FC<Props> = ({ 
  data, indicators, entryPrice, entryTime, hasPosition, type, strategy, gridUpper, gridLower, onChartCreated 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: '#131722' }, textColor: '#d1d4dc' },
      grid: { vertLines: { color: '#1e222d' }, horzLines: { color: '#1e222d' } },
      timeScale: { timeVisible: true, secondsVisible: false, barSpacing: 12 },
      localization: {
        locale: 'th-TH',
        timeFormatter: (time: number) => {
          return new Date(time * 1000).toLocaleString('th-TH', {
            hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Bangkok'
          });
        },
      },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#0ecb81', downColor: '#f6465d', borderVisible: false,
      wickUpColor: '#0ecb81', wickDownColor: '#f6465d',
    });

    const ema20Series = chart.addSeries(LineSeries, { color: '#2962FF', lineWidth: 2, title: 'EMA 20' });
    const ema50Series = chart.addSeries(LineSeries, { color: '#FF6D00', lineWidth: 2, title: 'EMA 50' });
    const bbUpper = chart.addSeries(LineSeries, { color: 'rgba(132, 142, 156, 0.4)', lineWidth: 1, title: 'BB Upper' });
    const bbLower = chart.addSeries(LineSeries, { color: 'rgba(132, 142, 156, 0.4)', lineWidth: 1, title: 'BB Lower' });

    if (hasPosition && entryPrice > 0) {
      candleSeries.createPriceLine({
        price: entryPrice, color: '#faad14', lineWidth: 2, lineStyle: 0, axisLabelVisible: true, title: 'ENTRY',
      });
    }

    if (strategy.includes('GRID') && gridUpper && gridLower) {
      candleSeries.createPriceLine({ price: gridUpper, color: '#f6465d', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'GRID TOP' });
      candleSeries.createPriceLine({ price: gridLower, color: '#f6465d', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'GRID BOT' });
    }

    if (data.length > 0) {
      candleSeries.setData(data as any);
      ema20Series.setData(indicators.ema20);
      ema50Series.setData(indicators.ema50);
      bbUpper.setData(indicators.bb.map((v: any) => ({ time: v.time, value: v.upper })));
      bbLower.setData(indicators.bb.map((v: any) => ({ time: v.time, value: v.lower })));

      // Only place entry marker when there's a real open position
      if (hasPosition && entryTime > 0) {
        const closestCandle = [...data].reverse().find(c => c.time <= entryTime);
        if (closestCandle) {
          createSeriesMarkers(candleSeries, [
            {
              time: closestCandle.time as any,
              position: type === 'LONG' ? 'belowBar' : 'aboveBar',
              color: '#faad14',
              shape: type === 'LONG' ? 'arrowUp' : 'arrowDown',
              text: type === 'LONG' ? 'BUY' : 'SELL',
              size: 2
            }
          ]);
        }
      }

      chart.timeScale().setVisibleRange({
        from: data[Math.max(0, data.length - 100)].time as any,
        to: data[data.length - 1].time as any,
      });
    }

    chartRef.current = chart;
    if (onChartCreated) onChartCreated(chart);

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ 
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [data, indicators, entryPrice, entryTime, hasPosition, strategy, type]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%', borderRadius: '8px', overflow: 'hidden' }} />;
};
