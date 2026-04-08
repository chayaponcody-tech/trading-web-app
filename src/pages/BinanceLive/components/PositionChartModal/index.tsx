import { useState } from 'react';
import type { IChartApi } from 'lightweight-charts';
import type { ChartProps } from './types';
import { useBinanceData } from './hooks/useBinanceData';
import { useIndicators } from './hooks/useIndicators';
import { ChartHeader } from './components/ChartHeader';
import { ChartFooter } from './components/ChartFooter';
import { PriceChart } from './components/PriceChart';
import { RsiChart } from './components/RsiChart';

export default function PositionChartModal({ 
  symbol, interval, entryPrice, entryTime, type, reason, strategy, gridUpper, gridLower, onClose 
}: ChartProps) {
  const [showRSI, setShowRSI] = useState(false);
  const [mainChart, setMainChart] = useState<IChartApi | null>(null);
  const [selectedInterval, setSelectedInterval] = useState(interval);
  
  const { data, loading } = useBinanceData(symbol, selectedInterval);
  const indicators = useIndicators(data);

  // entryTime is valid only when there's a real open position (not Date.now() fallback)
  const hasPosition = !!entryTime && entryTime !== 0;
  const entryUnix = hasPosition
    ? (typeof entryTime === 'string' ? Math.floor(new Date(entryTime).getTime() / 1000) : Math.floor((entryTime as number) / 1000))
    : 0;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '16px' }}>
      <div className="glass-panel" style={{ 
        width: '100%', maxWidth: '1100px', height: 'calc(100vh - 32px)',
        display: 'flex', flexDirection: 'column', background: '#131722', border: '1px solid #333', 
        borderRadius: '12px', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
      }}>
        <ChartHeader 
          symbol={symbol} interval={selectedInterval} strategy={strategy} 
          entryPrice={entryPrice} type={type} reason={reason} 
          showRSI={showRSI} setShowRSI={setShowRSI} onClose={onClose}
          selectedInterval={selectedInterval} setSelectedInterval={setSelectedInterval}
        />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', background: 'linear-gradient(to bottom, #131722, #0b0e14)' }}>
           {loading && (
             <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#faad14', zIndex: 10, background: 'rgba(19, 23, 34, 0.9)' }}>
                <div style={{ width: '40px', height: '40px', border: '3px solid rgba(250,173,20,0.1)', borderTop: '3px solid #faad14', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '1.2rem' }}></div>
                <div>Loading Live Charts...</div>
             </div>
           )}
           
           <div style={{ flex: showRSI ? '0 0 auto' : '1', height: showRSI ? 'calc(100% - 170px)' : '100%', transition: 'height 0.3s ease' }}>
              <PriceChart 
                data={data} indicators={indicators} 
                entryPrice={entryPrice} entryTime={entryUnix}
                hasPosition={hasPosition}
                type={type} strategy={strategy} 
                gridUpper={gridUpper} gridLower={gridLower}
                onChartCreated={setMainChart}
              />
           </div>

           {showRSI && (
             <div style={{ height: '160px', flexShrink: 0, padding: '0 0 8px' }}>
               <RsiChart rsiData={indicators.rsi} height={150} mainChart={mainChart} />
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
