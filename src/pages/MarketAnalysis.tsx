import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, 
  Settings, 
  Maximize2, 
  Clock, 
  Zap,
  ChevronDown,
  LayoutGrid,
  Info
} from 'lucide-react';
import CandleChart from '../components/CandleChart';
import type { CandleChartHandle } from '../components/CandleChart';
import type { OverlayData } from '../utils/backtestUtils';
import { detectFVG, detectOB } from '../utils/indicatorUtils';
import SymbolSelector from '../components/SymbolSelector';

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'];

export default function MarketAnalysis() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [interval, setInterval] = useState('1h');
  const [showSearch, setShowSearch] = useState(false);
  
  const [overlayData, setOverlayData] = useState<OverlayData>({
    zones: []
  });

  const chartRef = useRef<CandleChartHandle>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const isInsideTrigger = searchContainerRef.current && searchContainerRef.current.contains(event.target as Node);
      const isInsideDropdown = dropdownRef.current && dropdownRef.current.contains(event.target as Node);
      
      if (!isInsideTrigger && !isInsideDropdown) {
        setShowSearch(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDataLoaded = React.useCallback((candles: any[]) => {
    if (!candles || candles.length === 0) return;
    const fvgZones = detectFVG(candles);
    const obZones = detectOB(candles);
    setOverlayData({
      zones: [...fvgZones, ...obZones]
    });
  }, []);

  useEffect(() => {
    if (chartRef.current) {
       chartRef.current.loadKlines({ symbol, interval });
    }
  }, [symbol, interval]);

  return (
    <div className="flex flex-col h-full" style={{ gap: '0', height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column', color: '#d1d4dc', background: '#131722' }}>
      {/* 1. TOP TOOLBAR */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        height: '48px',
        background: '#131722',
        borderBottom: '1px solid #2a2e39',
        position: 'relative',
        zIndex: 1000
      }}>
        <div ref={searchContainerRef} style={{ height: '100%', display: 'flex', alignItems: 'center', position: 'relative' }}>
          <div 
            onClick={() => setShowSearch(!showSearch)}
            className="hover:bg-[#2a2e39] cursor-pointer px-4 h-full flex items-center transition-all gap-2" 
            style={{ 
              borderRight: '1px solid #2a2e39',
              background: showSearch ? '#2a2e39' : 'transparent',
              color: showSearch ? '#fff' : 'inherit'
            }}
          >
            <span style={{ fontSize: '0.85rem', fontWeight: '800', letterSpacing: '0.5px' }}>{symbol}</span>
            <ChevronDown size={14} opacity={0.5} style={{ transform: showSearch ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </div>
        </div>

        {/* Timeframes */}
        <div style={{ display: 'flex', height: '100%', alignItems: 'center', borderRight: '1px solid #2a2e39' }}>
          {TIMEFRAMES.map(tf => (
            <div 
              key={tf} 
              onClick={() => setInterval(tf)}
              style={{
                padding: '0 0.85rem',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                fontSize: '0.75rem',
                cursor: 'pointer',
                fontWeight: interval === tf ? 'bold' : 'normal',
                color: interval === tf ? '#2962ff' : '#848e9c',
                background: interval === tf ? 'rgba(41, 98, 255, 0.08)' : 'transparent',
              }}
              className="hover:bg-[#2a2e39] transition-all"
            >
              {tf.toUpperCase()}
            </div>
          ))}
        </div>

        {/* Right Actions */}
        <div style={{ marginLeft: 'auto', display: 'flex', height: '100%', alignItems: 'center', paddingRight: '0.5rem' }}>
          <div className="hover:bg-[#2a2e39] px-4 h-full flex items-center cursor-pointer gap-2 transition-all border-l border-[#2a2e39]">
             <LayoutGrid size={16} opacity={0.8} />
             <span style={{ fontSize: '0.75rem' }}>Indicators</span>
          </div>
          <div className="hover:bg-[#2a2e39] p-3 cursor-pointer"><Maximize2 size={16} opacity={0.8} /></div>
          <div className="hover:bg-[#2a2e39] p-3 cursor-pointer"><Settings size={16} opacity={0.8} /></div>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0, background: '#131722' }}>
        
        {/* 2. LEFT SIDEBAR (Standard Narrow Width) */}
        <div style={{ 
          width: '64px', 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          padding: '1rem 0', 
          gap: '1.5rem',
          borderRight: '1px solid #2a2e39',
          background: '#131722',
          zIndex: 50
        }}>
           <div className="p-2 hover:bg-[#2a2e39] rounded cursor-pointer text-[#d1d4dc]"><Activity size={24} /></div>
           <div className="p-2 hover:bg-[#2a2e39] rounded cursor-pointer text-[#848e9c]"><LayoutGrid size={24} /></div>
           <div className="p-2 hover:bg-[#2a2e39] rounded cursor-pointer text-[#848e9c]"><Clock size={24} /></div>
           <div style={{ marginTop: 'auto' }} className="p-2 hover:bg-[#2a2e39] rounded cursor-pointer text-[#848e9c]"><Info size={24} /></div>
        </div>

        {/* 3. CHART VIEWPORT with RED BOX DROPDOWN */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>
          
          {/* THE FLOATING "RED BOX" DROPDOWN - Styled as requested */}
          {showSearch && (
            <div 
                 ref={dropdownRef}
                 className="absolute top-0 left-0 w-[420px] h-full z-[9999] animate-in slide-in-from-left duration-300" 
                 style={{ 
                    padding: '12px', 
                    background: 'rgba(19, 23, 34, 0.95)', 
                    backdropFilter: 'blur(10px)',
                    borderRight: '1px solid #363c4e',
                    boxShadow: '20px 0 50px rgba(0,0,0,0.5)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                 }}>
               
               {/* Box 1 (Symbol Header) */}
               <div style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px', border: '1px solid #363c4e', display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <Activity size={28} color="#0ecb81" />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                     <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{symbol}</span>
                     <span style={{ fontSize: '0.7rem', color: '#848e9c' }}>Binance Futures • Perps</span>
                  </div>
               </div>

               {/* The Actual Functional Search & Chips (Wrapped in a box) */}
               <div style={{ flex: 1, overflowY: 'auto', padding: '12px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px', border: '1px solid #2a2e39' }}>
                  <SymbolSelector 
                    value={symbol} 
                    onSelect={(s) => { setSymbol(s); setShowSearch(false); }} 
                    searchTop={true}
                  />
               </div>

               {/* Indicator Box Shortcut (Box 2 style) */}
               <div style={{ padding: '12px', borderRadius: '8px', border: '1px solid #2a2e39', display: 'flex', alignItems: 'center', gap: '12px', opacity: 0.6 }}>
                  <LayoutGrid size={20} />
                  <span style={{ fontSize: '0.8rem' }}>Toggle Indicators Group</span>
               </div>
            </div>
          )}

          <div style={{ flex: 1, position: 'relative' }}>
             <CandleChart 
               ref={chartRef}
               symbol={symbol}
               interval={interval}
               autoFetch={true}
               overlayData={overlayData}
               onDataLoaded={handleDataLoaded}
               height="100%"
             />
          </div>
        </div>

        {/* 4. RIGHT SIDEBAR */}
        <div style={{ width: '320px', background: '#131722', borderLeft: '1px solid #2a2e39', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
           <h3 style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Zap size={14} /> SIGNAL TERMINAL</h3>
           <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid #2a2e39' }}>
                 <div style={{ fontSize: '10px', color: '#848e9c', marginBottom: '0.5rem' }}>CURRENT ZONE</div>
                 {overlayData.zones?.[0] ? (
                   <div style={{ color: '#0ecb81', fontWeight: 'bold' }}>{overlayData.zones[0].type} Detected</div>
                 ) : "--"}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
