import { useEffect, useRef } from 'react';
import { createChart, ColorType, AreaSeries } from 'lightweight-charts';

export const PerformanceChart = ({ data }: { data: any[] }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartContainerRef.current || !data || data.length === 0) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: 'rgba(42, 46, 57, 0.5)' },
        horzLines: { color: 'rgba(42, 46, 57, 0.5)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: '#faad14',
      topColor: 'rgba(250, 173, 20, 0.4)',
      bottomColor: 'rgba(250, 173, 20, 0.0)',
    });

    const chartData = data
      .map((d) => {
        let timeValue: any = d.time;
        if (timeValue === 'Initial') {
           timeValue = Math.floor(Date.now() / 1000) - 86400 * 7;
        } else {
          const parsed = new Date(timeValue).getTime();
          timeValue = isNaN(parsed) ? null : Math.floor(parsed / 1000);
        }
        return { time: timeValue, value: d.value };
      })
      .filter(d => d.time !== null)
      .sort((a, b) => (a.time as number) - (b.time as number));

    const uniqueData = chartData.filter((v, i, a) => i === 0 || (v.time as number) > (a[i - 1].time as number));

    if (uniqueData.length > 0) {
        try {
            series.setData(uniqueData as any);
            chart.timeScale().fitContent();
        } catch (err) {
            console.error('Lightweight Charts Error:', err);
        }
    }

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [data]);

  return <div ref={chartContainerRef} style={{ width: '100%', height: '400px' }} />;
};

export const SummaryStat = ({ icon, label, value, sub, color }: any) => (
  <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '1rem', alignItems: 'center', transition: 'transform 0.2s' }}>
    <div style={{ fontSize: '1.5rem', background: 'rgba(250,173,20,0.1)', minWidth: '45px', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '10px' }}>{icon}</div>
    <div style={{ overflow: 'hidden' }}>
      <div style={{ fontSize: '0.6rem', color: '#888', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: color || '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
      <div style={{ fontSize: '0.6rem', opacity: 0.5, whiteSpace: 'nowrap' }}>{sub}</div>
    </div>
  </div>
);

export default function AnalyticsTab({ analyticsData }: { analyticsData: any }) {
  if (!analyticsData) return <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>Loading Analytics...</div>;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto', padding: '1rem' }}>
      {/* Analytics Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
         <SummaryStat 
           icon="📈" label="Sharpe Ratio" 
           value={analyticsData.sharpe?.toFixed(2) || '0.00'} 
           sub="Risk-adjusted Return" 
           color="#faad14" 
         />
         <SummaryStat 
           icon="📉" label="Max Drawdown" 
           value={`${((analyticsData.maxDrawdown || 0) * 100).toFixed(2)}%`} 
           sub="Peak to Trough" 
           color="#f6465d" 
         />
         <SummaryStat 
           icon="💰" label="Profit Factor" 
           value={analyticsData.profitFactor?.toFixed(2) || '0.00'} 
           sub="Gross Profit / Gross Loss" 
           color="#0ecb81" 
         />
         <SummaryStat 
           icon="🎯" label="Win Rate" 
           value={`${(analyticsData.winRate || 0).toFixed(1)}%`} 
           sub={`${analyticsData.totalTrades || 0} Total Trades`} 
           color="#fff" 
         />
      </div>

      {/* Performance Chart Section */}
      <div className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.2)', flex: 1, minHeight: '450px', display: 'flex', flexDirection: 'column' }}>
         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#faad14' }}>Equity Curve (Performance Over Time)</h3>
            <div style={{ fontSize: '0.7rem', color: '#888' }}>Base: 1000 USDT</div>
         </div>
         <div style={{ flex: 1, width: '100%', position: 'relative' }}>
            <PerformanceChart data={analyticsData.equityCurve || []} />
         </div>
      </div>
    </div>
  );
}
