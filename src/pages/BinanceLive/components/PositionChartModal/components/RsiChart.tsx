import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, LineSeries } from 'lightweight-charts';
import type { IChartApi } from 'lightweight-charts';

interface Props {
  rsiData: any[];
  height: number;
  mainChart?: IChartApi | null;
}

export const RsiChart: React.FC<Props> = ({ rsiData, height, mainChart }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const rsiChart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: '#131722' }, textColor: '#d1d4dc' },
      grid: { vertLines: { color: '#1e222d' }, horzLines: { color: '#1e222d' } },
      width: containerRef.current.clientWidth,
      height: height,
      timeScale: { visible: false },
    });

    const rsiSeries = rsiChart.addSeries(LineSeries, { color: '#ab47bc', lineWidth: 2, title: 'RSI' });
    rsiSeries.setData(rsiData);

    if (mainChart) {
      mainChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        rsiChart.timeScale().setVisibleLogicalRange(range as any);
      });
    }

    const handleResize = () => {
      if (containerRef.current) rsiChart.applyOptions({ width: containerRef.current.clientWidth });
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      rsiChart.remove();
    };
  }, [rsiData, height, mainChart]);

  return (
    <div style={{ flexShrink: 0, paddingBottom: '1rem' }}>
       <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ab47bc' }}></span> RSI (14)
       </div>
       <div ref={containerRef} style={{ width: '100%', height: height, borderRadius: '8px', overflow: 'hidden' }} />
    </div>
  );
};
