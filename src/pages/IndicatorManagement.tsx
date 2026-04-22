import React, { useState } from 'react';
import { 
  Layers, 
  Settings2, 
  Eye, 
  EyeOff, 
  ChevronRight, 
  Search, 
  Palette, 
  Activity,
  Box,
  LayoutGrid,
  Info,
  Save,
  RefreshCw,
  Plus
} from 'lucide-react';

interface IndicatorConfig {
  id: string;
  name: string;
  description: string;
  type: 'overlay' | 'oscillator';
  enabled: boolean;
  params: Record<string, any>;
  styles: Record<string, any>;
}

const DEFAULT_INDICATORS: IndicatorConfig[] = [
  {
    id: 'hob',
    name: 'Hidden Orderblock (HOB)',
    description: 'Detects institutional order blocks that intersect with Fair Value Gaps at the Equilibrium level.',
    type: 'overlay',
    enabled: true,
    params: {
      lookback: 100,
      minFvgSize: 0.5,
      easyEngulfing: true,
      timeframe: 'Current',
    },
    styles: {
      bullColor: '#00d1ff',
      bearColor: '#f6465d',
      eqLineStyle: 'dotted',
      transparency: 0.15,
      showEq: true,
    }
  },
  {
    id: 'fvg',
    name: 'Fair Value Gap (FVG)',
    description: 'Identifies price imbalances where a gap exists between the previous high and next low.',
    type: 'overlay',
    enabled: false,
    params: {
      threshold: 1.5,
      mitigationType: 'Close',
    },
    styles: {
      bullColor: '#10b981',
      bearColor: '#f43f5e',
      opacity: 0.1,
    }
  },
  {
    id: 'bb',
    name: 'Breaker Blocks (BB)',
    description: 'Marks failed order blocks that have been broken and switched polarity.',
    type: 'overlay',
    enabled: true,
    params: {
      volumeFilter: true,
      minDisplacement: 2.0,
    },
    styles: {
      bullColor: '#3b82f6',
      bearColor: '#ef4444',
      borderStyle: 'solid',
    }
  }
];

export default function IndicatorManagement() {
  const [indicators, setIndicators] = useState<IndicatorConfig[]>(DEFAULT_INDICATORS);
  const [selectedId, setSelectedId] = useState<string>('hob');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const API_BASE = '/api/indicators';

  React.useEffect(() => {
    fetchIndicators();
  }, []);

  const fetchIndicators = async () => {
    try {
      const res = await fetch(API_BASE);
      if (res.ok) {
        const data = await res.json();
        // Merge with defaults to ensure all required fields exist
        if (data && data.length > 0) {
          const merged = DEFAULT_INDICATORS.map(def => {
             const saved = data.find((d: any) => d.id === def.id);
             return saved ? { ...def, ...saved } : def;
          });
          setIndicators(merged);
        }
      }
    } catch (e) {
      console.error('Failed to fetch indicators', e);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await Promise.all(
        indicators.map(ind => 
          fetch(`${API_BASE}/${ind.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              enabled: ind.enabled, 
              params: ind.params, 
              styles: ind.styles 
            })
          })
        )
      );
      alert('Indicators saved successfully! Changes will reflect in Market Analysis.');
    } catch (e) {
      alert('Failed to save indicators:' + (e as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const selected = indicators.find(i => i.id === selectedId) || indicators[0];

  const toggleIndicator = (id: string) => {
    setIndicators(prev => prev.map(ind => 
      ind.id === id ? { ...ind, enabled: !ind.enabled } : ind
    ));
  };

  const updateParam = (key: string, value: any) => {
    setIndicators(prev => prev.map(ind => 
      ind.id === selectedId ? { ...ind, params: { ...ind.params, [key]: value } } : ind
    ));
  };

  const updateStyle = (key: string, value: any) => {
    setIndicators(prev => prev.map(ind => 
      ind.id === selectedId ? { ...ind, styles: { ...ind.styles, [key]: value } } : ind
    ));
  };

  return (
    <div className="flex flex-col gap-6" style={{ height: 'calc(100vh - 180px)', minHeight: '600px', display: 'flex', flexDirection: 'column' }}>
      {/* Header Area */}
      <div className="flex-between items-center glass-panel p-4" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        padding: '1rem 1.5rem',
        background: 'linear-gradient(90deg, rgba(0,209,255,0.05) 0%, rgba(167,139,250,0.05) 100%)' 
      }}>
        <div className="flex items-center gap-3" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="p-2 rounded-lg" style={{ background: 'rgba(0, 209, 255, 0.1)', display: 'flex' }}>
            <Layers style={{ color: 'var(--accent-primary)' }} size={24} />
          </div>
          <div>
            <h2 className="m-0 text-lg font-bold" style={{ fontSize: '1.2rem', margin: 0 }}>Chart Indicators</h2>
            <p className="text-muted text-xs m-0" style={{ margin: 0 }}>Manage visual signals and chart overlays</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ position: 'relative' }}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} size={16} />
            <input 
              type="text" 
              placeholder="Search indicators..." 
              className="styled-input"
              style={{ paddingLeft: '2.5rem', width: '250px', height: '40px' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button className="btn-primary" style={{ height: '40px', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0 1.25rem' }}>
            <Plus size={18} /> New Preset
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar: Indicator List */}
        <div className="glass-panel" style={{ width: '320px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Available Tools</span>
            <span className="badge-muted text-xs" style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '10px' }}>{indicators.length}</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
            {indicators.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase())).map(ind => (
              <div 
                key={ind.id}
                onClick={() => setSelectedId(ind.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1rem',
                  marginBottom: '0.5rem',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  background: selectedId === ind.id ? 'rgba(0, 209, 255, 0.08)' : 'transparent',
                  border: '1px solid',
                  borderColor: selectedId === ind.id ? 'var(--accent-primary)' : 'transparent',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ 
                    width: '4px', 
                    height: '24px', 
                    borderRadius: '2px', 
                    background: ind.enabled ? 'var(--accent-primary)' : 'var(--text-muted)' 
                  }} />
                  <div>
                    <div className="text-sm font-semibold" style={{ color: selectedId === ind.id ? '#fff' : 'var(--text-main)' }}>{ind.name}</div>
                    <div className="text-xs text-muted">
                      {ind.type === 'overlay' ? 'Main Chart Overlay' : 'Oscillator'}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); toggleIndicator(ind.id); }}
                  style={{ 
                    background: 'transparent', 
                    border: 'none', 
                    padding: '4px',
                    color: ind.enabled ? 'var(--accent-primary)' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  {ind.enabled ? <Eye size={18} /> : <EyeOff size={18} />}
                </button>
              </div>
            ))}
          </div>
          
          <div style={{ padding: '1rem', background: 'rgba(255, 255, 255, 0.03)', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <Info size={14} /> 
              <span>Presets are applied globally.</span>
            </div>
          </div>
        </div>

        {/* Main Content: Detailed Settings */}
        <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <div className="p-3 rounded-xl" style={{ background: 'rgba(0, 209, 255, 0.1)', display: 'flex' }}>
                {selectedId === 'hob' ? <Box style={{ color: 'var(--accent-primary)' }} size={32} /> : 
                 selectedId === 'fvg' ? <LayoutGrid style={{ color: 'var(--accent-primary)' }} size={32} /> : 
                 <Activity style={{ color: 'var(--accent-primary)' }} size={32} />}
              </div>
              <div>
                <h2 className="m-0 text-xl font-bold" style={{ fontSize: '1.4rem', margin: 0 }}>{selected.name}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.4rem' }}>
                  <span style={{ 
                    fontSize: '0.65rem', 
                    fontWeight: 'bold',
                    padding: '2px 8px', 
                    borderRadius: '4px', 
                    background: selected.enabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.1)',
                    color: selected.enabled ? 'var(--profit-color)' : 'var(--text-muted)'
                  }}>
                    {selected.enabled ? 'ENABLED' : 'DISABLED'}
                  </span>
                  <span className="text-muted text-xs italic">{selected.description}</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn-outline" onClick={fetchIndicators} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <RefreshCw size={16} className={isSaving ? 'animate-spin' : ''} /> Reset
              </button>
              <button 
                className="btn-primary" 
                onClick={handleSave}
                disabled={isSaving}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0 1.5rem', opacity: isSaving ? 0.7 : 1 }}
              >
                {isSaving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem' }}>
              {/* Parameter Settings */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
                  <Settings2 size={18} style={{ color: 'var(--accent-primary)' }} />
                  <h3 className="m-0 text-xs uppercase tracking-widest font-bold" style={{ margin: 0 }}>Input Parameters</h3>
                </div>
                
                {Object.entries(selected.params).map(([key, value]) => (
                  <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.5px' }}>{key.replace(/([A-Z])/g, ' $1').toUpperCase()}</label>
                    {typeof value === 'boolean' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }} onClick={() => updateParam(key, !value)}>
                        <input 
                          type="checkbox" 
                          checked={value} 
                          onChange={(e) => updateParam(key, e.target.checked)}
                          style={{ width: '1.1rem', height: '1.1rem', cursor: 'pointer' }}
                        />
                        <span className="text-sm">Active Filter</span>
                      </div>
                    ) : typeof value === 'number' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                        <input 
                          type="range" 
                          min="0" max={key === 'lookback' ? "500" : "10"} step={key === 'lookback' ? "10" : "0.1"}
                          value={value}
                          onChange={(e) => updateParam(key, parseFloat(e.target.value))}
                          style={{ flex: 1, cursor: 'pointer' }}
                        />
                        <input 
                          type="number" 
                          value={value}
                          onChange={(e) => updateParam(key, parseFloat(e.target.value))}
                          className="styled-input"
                          style={{ width: '70px', height: '32px', textAlign: 'center', padding: '0', fontSize: '0.8rem' }}
                        />
                      </div>
                    ) : (
                      <select 
                        value={value} 
                        onChange={(e) => updateParam(key, e.target.value)}
                        className="styled-input"
                        style={{ height: '38px', cursor: 'pointer' }}
                      >
                        <option value="Current">Current Timeframe</option>
                        <option value="1h">1 Hour</option>
                        <option value="4h">4 Hours</option>
                        <option value="1d">1 Day</option>
                      </select>
                    )}
                  </div>
                ))}
              </div>

              {/* Style Settings */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
                  <Palette size={18} style={{ color: 'var(--accent-primary)' }} />
                  <h3 className="m-0 text-xs uppercase tracking-widest font-bold" style={{ margin: 0 }}>Visual Styles</h3>
                </div>

                {Object.entries(selected.styles).map(([key, value]) => (
                  <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.5px' }}>{key.replace(/([A-Z])/g, ' $1').toUpperCase()}</label>
                    {key.toLowerCase().includes('color') ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ 
                          width: '40px', height: '40px', borderRadius: '8px', background: value, border: '2px solid rgba(255,255,255,0.1)', cursor: 'pointer', position: 'relative', overflow: 'hidden'
                        }}>
                          <input 
                            type="color" 
                            value={value} 
                            onChange={(e) => updateStyle(key, e.target.value)}
                            style={{ position: 'absolute', top: '-10px', left: '-10px', width: '60px', height: '60px', opacity: 0, cursor: 'pointer' }}
                          />
                        </div>
                        <code style={{ fontSize: '0.75rem', background: 'rgba(0,0,0,0.2)', padding: '4px 10px', borderRadius: '6px', fontFamily: 'monospace' }}>{value.toUpperCase()}</code>
                      </div>
                    ) : typeof value === 'boolean' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }} onClick={() => updateStyle(key, !value)}>
                        <input 
                          type="checkbox" 
                          checked={value} 
                          onChange={(e) => updateStyle(key, e.target.checked)}
                          style={{ width: '1.1rem', height: '1.1rem', cursor: 'pointer' }}
                        />
                        <span className="text-sm">Visible</span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                        <input 
                          type="range" 
                          min="0" max="1" step="0.01"
                          value={value}
                          onChange={(e) => updateStyle(key, parseFloat(e.target.value))}
                          style={{ flex: 1, cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '0.75rem', minWidth: '40px', textAlign: 'right', fontWeight: 'bold' }}>{Math.round(value * 100)}%</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ 
              marginTop: '4rem', 
              padding: '2rem', 
              borderRadius: '1.25rem', 
              border: '1px solid var(--border-color)', 
              background: 'rgba(0,0,0,0.3)', 
              position: 'relative' 
            }}>
               <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, rgba(0, 209, 255, 0.08), transparent)', pointerEvents: 'none' }} />
               <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                     <ChevronRight size={18} style={{ color: 'var(--accent-primary)' }} />
                     <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 'bold' }}>Indicator Rule Preview</h4>
                   </div>
                   <p className="text-xs text-muted" style={{ margin: 0, marginLeft: '1.75rem' }}>This indicator's logic is applied to the chart rendering pipeline.</p>
                 </div>
                 {selectedId === 'hob' && (
                   <div style={{ padding: '0.6rem 1.25rem', borderRadius: '10px', border: '1px solid var(--accent-primary)', background: 'rgba(0, 209, 255, 0.12)', color: 'var(--accent-primary)', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                     <Activity size={14} /> ACTIVE LOGIC
                   </div>
                 )}
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
