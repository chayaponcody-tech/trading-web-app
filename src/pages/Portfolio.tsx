import { useState, useEffect } from 'react';
import {
  Wallet, TrendingUp, ShieldAlert, Cpu, Activity, Settings,
  Layers, Trash2, BrainCircuit, Brain, X, Plus, Play, Square,
  ChevronRight, AlertTriangle, Clock, Zap, Bot, RefreshCw,
  Lock, Globe, PieChart, BarChart3, ArrowUpRight, Shield
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PerformanceChart } from './BinanceLive/components/AnalyticsTab';

const API = '';

const RISK_MODES = [
  { value: 'auto_pilot',  label: '🧠 AI Auto-Pilot',       accuracy: 5, speed: 'mid',  desc: 'System Managed — ให้ AI วิเคราะห์ TQI และสลับกลยุทธ์ตามสภาวะตลาดแบบ Real-time' },
  { value: 'confident',   label: '✨ Momentum & Trend',    accuracy: 4, speed: 'slow', desc: 'Macro Trend — เน้นความแม่นยำ รันออเดอร์ตามเทรนหลักระยะกลาง-ยาว' },
  { value: 'scout',       label: '🏹 Trend Scout',         accuracy: 3, speed: 'fast', desc: 'Breakout — สแกนหาจังหวะเบรกเอาท์แล้วตามน้ำเก็บกำไรทันที' },
  { value: 'grid',        label: '📈 Range Defense Pro',   accuracy: 4, speed: 'slow', desc: 'Grid Accumulation — วางตาข่ายปูพรม เหมาะสำหรับตลาด Sideway/แกว่งตัว' },
  { value: 'stoch_rsi',   label: '🎯 Oscillator Rebound',  accuracy: 4, speed: 'mid',  desc: 'Mean Reversion — ซ้อนซื้อตอนถูก (Oversold) และขายตอนแพง (Overbought)' },
  { value: 'vwap_scalp',  label: '📊 Institutional Scalp', accuracy: 4, speed: 'fast', desc: 'VWAP Baseline — ใช้ราคาเฉลี่ยที่สถาบันรายใหญ่พิจารณาเป็นฐาน เกาะกินระยะสั้น' },
  { value: 'ema_scalp',   label: '⚡ Hyper Scalping',      accuracy: 3, speed: 'fast', desc: 'Fast Momentum — เน้นรอบเร็วสุดขีด ตัดสินใจในเสี้ยวนาทีเกาะโมเมนตัม' },
];

const AI_MODELS = [
  { value: '',                                    label: 'Default (System Managed)' },
  { value: 'deepseek/deepseek-chat',              label: '🤖 DeepSeek V3' },
  { value: 'google/gemini-pro-1.5',               label: '♊ Gemini 1.5 Pro' },
  { value: 'anthropic/claude-3.5-sonnet',         label: '🎭 Claude 3.5 Sonnet' },
  { value: 'meta-llama/llama-3.1-405b',           label: '🦙 Llama 3.1 405B' },
];

const RETHINK_INTERVALS = [
  { value: 15,  label: 'Every 15 min (5m candle)' },
  { value: 30,  label: 'Every 30 min (15m candle)' },
  { value: 60,  label: 'Every 1 hour (1h candle)' },
  { value: 240, label: 'Every 4 hours (4h candle)' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color = '#fff', icon, hideBorder }: any) {
  return (
    <div className={hideBorder ? "" : "glass-panel"} style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: hideBorder ? '0' : '1.25rem', background: hideBorder ? 'transparent' : 'rgba(255,255,255,0.01)', border: hideBorder ? 'none' : undefined }}>
      {icon && <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '0.75rem', color: color }}>{icon}</div>}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.65rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '0.4rem', fontWeight: 800 }}>{label}</div>
        <div style={{ fontSize: '1.4rem', fontWeight: 900, color, lineHeight: '1.1' }}>{value}</div>
        {sub && <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.3rem', fontWeight: 600 }}>{sub}</div>}
      </div>
    </div>
  );
}

function AllocationBar({ items, total }: { items: { label: string, value: number, color: string }[], total: number }) {
  if (total <= 0) return null;

  return (
    <div style={{ width: '100%', height: '14px', background: 'rgba(255,255,255,0.03)', borderRadius: '20px', overflow: 'hidden', display: 'flex', marginTop: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
      {items.map((item, i) => (
        <div key={i} style={{ 
          width: `${(item.value / total) * 100}%`, 
          background: item.color,
          height: '100%',
          borderRight: i < items.length - 1 ? '1px solid rgba(0,0,0,0.2)' : 'none',
        }} title={`${item.label}: $${Number(item.value || 0).toFixed(2)} (${((Number(item.value || 0)/total)*100).toFixed(1)}%)`} />
      ))}
    </div>
  );
}

function BotCard({ bot, fleets, onDelete, isLive }: any) {
  const pnl = bot.netPnl || 0;
  const isProfit = pnl >= 0;
  const fid = bot.managedBy || bot.config?.managedBy;
  const fleetName = fleets.find((f: any) => f.id === fid)?.name;
  const themeColor = isLive ? '#f6465d' : 'var(--accent-primary)';

  return (
    <div className="glass-panel hover-bump" style={{
      padding: '1.25rem',
      background: 'rgba(255,255,255,0.01)',
      border: `1px solid ${isProfit ? 'rgba(14,203,129,0.1)' : 'rgba(246,70,93,0.1)'}`,
      display: 'flex', flexDirection: 'column', gap: '0.85rem',
      position: 'relative',
      overflow: 'hidden',
      transition: 'all 0.2s',
      borderLeft: `3px solid ${isProfit ? '#0ecb81' : pnl < 0 ? '#f6465d' : '#888'}`
    }}>
      <div style={{ position: 'absolute', top: 0, right: 0, width: '60px', height: '60px', background: isProfit ? 'radial-gradient(circle at top right, rgba(14,203,129,0.1), transparent)' : 'radial-gradient(circle at top right, rgba(246,70,93,0.1), transparent)', pointerEvents: 'none' }} />
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontWeight: 900, fontSize: '1.2rem', letterSpacing: '-0.01em', color: '#fff' }}>{bot.symbol}</span>
            <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: isLive ? 'rgba(246,70,93,0.15)' : 'rgba(255,255,255,0.05)', color: isLive ? '#f6465d' : '#aaa', fontWeight: isLive ? 800 : 700, border: isLive ? '1px solid rgba(246,70,93,0.2)' : 'none' }}>
               {isLive ? 'LIVE' : bot.interval}
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: themeColor, fontWeight: 700 }}>{bot.strategy}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 900, color: isProfit ? 'var(--profit-color)' : 'var(--loss-color)' }}>
            {isProfit ? '+' : ''}{pnl.toFixed(2)} USDT
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{bot.totalTrades || 0} Trades</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {fleetName && (
            <span style={{ fontSize: '0.65rem', padding: '3px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', color: '#aaa', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
              <Layers size={10} /> {fleetName}
            </span>
          )}
          {bot.consecutiveLosses >= 2 && (
            <span style={{ fontSize: '0.65rem', padding: '3px 8px', borderRadius: '6px', background: 'rgba(246,70,93,0.1)', color: 'var(--loss-color)', border: '1px solid rgba(246,70,93,0.2)', fontWeight: 800 }}>
              ⚠️ {bot.consecutiveLosses} SL
            </span>
          )}
        </div>
        <button onClick={onDelete} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6, padding: '4px', color: '#f6465d', borderRadius: '4px' }} className="hover-bg-light">
          <Trash2 size={14} />
        </button>
      </div>

      <div style={{ fontSize: '0.75rem', color: '#ddd', background: 'rgba(0,0,0,0.3)', padding: '0.75rem', borderRadius: '8px', borderLeft: `2px solid ${themeColor}`, display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.2rem' }}>
         <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.65rem', fontWeight: 800, color: themeColor, textTransform: 'uppercase' }}>
            <BrainCircuit size={12} /> AI Logic State
         </div>
         <div style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.4' }}>
            {bot.aiReason || 'Waiting for signal confirmation. Searching for high-probability setups.'}
         </div>
      </div>
    </div>
  );
}

// ─── Create Fleet Modal ───────────────────────────────────────────────────────

function CreateFleetModal({ onClose, onCreate, isLive, availableCash }: any) {
  const [name, setName] = useState('');
  const [budget, setBudget] = useState(1000);
  const [maxLoss, setMaxLoss] = useState(5);
  const [botCount, setBotCount] = useState(3);
  const [riskMode, setRiskMode] = useState('confident');
  const [aiModel, setAiModel] = useState('');
  const [rethinkInterval, setRethinkInterval] = useState(60);
  const [slLimit, setSlLimit] = useState(3);
  const [reviewHours, setReviewHours] = useState(1);
  const [autoVaultPct, setAutoVaultPct] = useState(20);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    if (budget > availableCash) {
       alert(`❌ Allocation Error: Your budget ($${budget}) exceeds the available cash reserve ($${availableCash.toFixed(2)}). Please reduce the budget or add funds.`);
       return;
    }
    setLoading(true);
    await onCreate({ 
      name: name.trim(), 
      config: { 
        exchange: isLive ? 'binance_live' : 'binance_testnet',
        totalBudget: budget, 
        maxDailyLossPct: maxLoss, 
        targetBotCount: botCount, 
        riskMode, 
        aiModel, 
        aiRethinkInterval: rethinkInterval, 
        consecutiveSLLimit: slLimit, 
        reviewIntervalHours: reviewHours,
        autoVaultPct
      } 
    });
    setLoading(false);
  };

  const themeColor = isLive ? '#f6465d' : '#00d1ff';

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0d1117', border: `1px solid ${isLive ? 'rgba(246,70,93,0.3)' : 'rgba(0,209,255,0.2)'}`, borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem', boxShadow: '0 32px 80px rgba(0,0,0,0.7)' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: `${themeColor}11`, borderRadius: '10px', padding: '8px', display: 'flex' }}>
              <Plus size={20} color={themeColor} />
            </div>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>Create {isLive ? 'Live' : 'New'} Fleet</div>
              <div style={{ fontSize: '0.75rem', color: '#666' }}>{isLive ? 'ตั้งค่า AI Fleet สำหรับบัญชีจริง' : 'ตั้งค่า AI Fleet ใหม่'}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer', display: 'flex' }}>
            <X size={18} color="#888" />
          </button>
        </div>

        <Field label="Fleet Name">
          <input autoFocus className="styled-input" style={{ width: '100%', borderColor: `${themeColor}33` }} placeholder={isLive ? 'e.g. Master Live Portfolio...' : 'e.g. Scalp Squad, Grid Masters...'} value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <Field label={`Budget (${isLive ? 'REAL ' : ''}USDT)`}>
            <input 
              type="text" 
              className="styled-input" 
              style={{ width: '100%', borderColor: budget > availableCash ? '#f6465d' : undefined }} 
              value={budget === 0 ? '' : budget} 
              placeholder="0"
              onChange={e => {
                const val = e.target.value.replace(/[^0-9.]/g, '');
                setBudget(val === '' ? 0 : Number(val));
              }} 
            />
            <div style={{ fontSize: '0.65rem', marginTop: '0.3rem', color: budget > availableCash ? '#f6465d' : '#666', display: 'flex', justifyContent: 'space-between' }}>
               <span>Available: ${availableCash.toFixed(2)}</span>
               {budget > availableCash && <span style={{ fontWeight: 800 }}>⚠️ Over Limit</span>}
            </div>
          </Field>
          <Field label="Max Daily Drawdown (%)">
            <input 
              type="text" 
              className="styled-input" 
              style={{ width: '100%' }} 
              value={maxLoss === 0 ? '' : maxLoss} 
              placeholder="0"
              onChange={e => {
                const val = e.target.value.replace(/[^0-9.]/g, '');
                setMaxLoss(val === '' ? 0 : Number(val));
              }} 
            />
          </Field>
          <Field label="Target Bot Count">
            <input 
              type="text" 
              className="styled-input" 
              style={{ width: '100%' }} 
              value={botCount === 0 ? '' : botCount} 
              placeholder="0"
              onChange={e => {
                const val = e.target.value.replace(/[^0-9]/g, '');
                setBotCount(val === '' ? 0 : Number(val));
              }} 
            />
          </Field>
          <Field label="Fleet Review Interval">
            <select className="styled-input" style={{ width: '100%' }} value={reviewHours} onChange={e => setReviewHours(+e.target.value)}>
              <option value={1}>Every 1 hour</option>
              <option value={2}>Every 2 hours</option>
              <option value={4}>Every 4 hours</option>
              <option value={6}>Every 6 hours</option>
            </select>
          </Field>
        </div>

        <Field label="AI Scanning Mode">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {RISK_MODES.map(m => (
              <label key={m.value} onClick={() => setRiskMode(m.value)} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.85rem', borderRadius: '12px', cursor: 'pointer', border: `1px solid ${riskMode === m.value ? `${themeColor}66` : 'rgba(255,255,255,0.06)'}`, background: riskMode === m.value ? `${themeColor}08` : 'transparent', transition: 'all 0.15s' }}>
                <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: `2px solid ${riskMode === m.value ? themeColor : '#444'}`, background: riskMode === m.value ? themeColor : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {riskMode === m.value && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#000' }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: riskMode === m.value ? '#fff' : '#aaa' }}>{m.label}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                       <span style={{ fontSize: '0.65rem', color: '#faad14' }}>{'★'.repeat(m.accuracy || 0)}</span>
                       <span style={{ fontSize: '0.6rem', padding: '1px 5px', borderRadius: '4px', background: m.speed === 'fast' ? 'rgba(246,70,93,0.1)' : 'rgba(255,255,255,0.05)', color: m.speed === 'fast' ? '#f6465d' : '#888', fontWeight: 800, textTransform: 'uppercase' }}>
                          {m.speed === 'fast' ? '🚀 Fast' : m.speed === 'mid' ? '⏱️ Mid' : '🐢 Slow'}
                       </span>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#666', lineHeight: 1.4 }}>{m.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <Field label="AI Brain (Model)">
            <select className="styled-input" style={{ width: '100%' }} value={aiModel} onChange={e => setAiModel(e.target.value)}>
              {AI_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </Field>
          <Field label="AI Re-think Interval">
            <select className="styled-input" style={{ width: '100%' }} value={rethinkInterval} onChange={e => setRethinkInterval(+e.target.value)}>
              {RETHINK_INTERVALS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </Field>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
          <button onClick={onClose} className="btn-outline" style={{ flex: 1 }}>Cancel</button>
          <button onClick={handleSubmit} className="btn-primary" style={{ flex: 2, background: isLive ? themeColor : undefined, border: isLive ? 'none' : undefined }} disabled={loading || !name.trim()}>
            {loading ? 'Processing...' : `🚀 ${isLive ? 'Start Live Fleet' : 'Create Fleet'}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <label style={{ fontSize: '0.78rem', color: '#888' }}>{label}</label>
      {children}
    </div>
  );
}

// ─── AI Strategy Wizard Modal ────────────────────────────────────────────────

function StrategyWizardModal({ onClose, onExecute, isLive, availableCash }: any) {
  const [amountInput, setAmountInput] = useState(String(availableCash > 0 ? Number(Math.min(availableCash, 50).toFixed(2)) : 50));
  const amount = Number(amountInput || 0);
  const [proposals, setProposals] = useState<any>(null); // Stores { safe, balanced, aggressive }
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);

  const handlePropose = async () => {
    setLoading(true);
    if (amount > availableCash) {
      alert(`❌ Strategy Wizard Error: Budget of $${amount} exceeds available cash of $${availableCash.toFixed(2)}.`);
      return;
    }
    try {
      const res = await fetch(`${API}/api/portfolio/propose-strategy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totalAmount: amount }),
      });
      const data = await res.json();
      setProposals(data);
      setSelectedTier('balanced'); // Default selection
    } catch (e) {
      alert('Wizard Error: ' + e);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!proposals || !selectedTier) return;
    setExecuting(true);
    try {
      await onExecute(proposals[selectedTier]);
      onClose();
    } catch (e) {
      alert('Execution Error: ' + e);
    } finally {
      setExecuting(false);
    }
  };

  const tiers: any = [
    { id: 'safe', label: '🛡️ Safe', color: '#0ecb81', desc: 'เน้นความชัวร์ กำไรมั่นคง' },
    { id: 'balanced', label: '⚖️ Balanced', color: '#faad14', desc: 'สมดุล ความเสี่ยงปานกลาง' },
    { id: 'aggressive', label: '🔥 Aggressive', color: '#f6465d', desc: 'ซิ่งทำกำไรเร็ว ทริกเกอร์บ่อย' },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: proposals ? '800px' : '440px', padding: '2rem', borderTop: `4px solid #faad14`, position: 'relative', boxShadow: '0 20px 80px rgba(0,0,0,0.8)', transition: 'max-width 0.3s ease' }}>
        <button onClick={onClose} style={{ position: 'absolute', right: '1.25rem', top: '1.25rem', background: 'rgba(255,255,255,0.05)', border: 'none', color: '#888', cursor: 'pointer', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
          <div style={{ background: '#faad1422', padding: '10px', borderRadius: '12px' }}>
            <BrainCircuit size={24} color="#faad14" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900 }}>AI CIO Strategy Wizard</h2>
            <div style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1.5px', marginTop: '2px' }}>Intelligent Capital Architect</div>
          </div>
        </div>

        {!proposals ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.8rem' }}>
            <div style={{ background: 'rgba(250,173,20,0.05)', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(250,173,20,0.1)' }}>
               <p style={{ margin: 0, fontSize: '0.9rem', color: '#ccc', lineHeight: 1.6 }}>
                 ระบุจำนวนเงิน USDT ที่คุณต้องการดึงจาก Wallet มากระจายการลงทุน <br/>
                 AI จะวิเคราะห์สภาวะตลาดปัจจุบันและเสนอ **3 แผนทางเลือก** มาให้คุณตัดสินใจครับ
               </p>
            </div>
            
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 900, color: '#666', textTransform: 'uppercase', marginBottom: '1rem' }}>จำนวนเงินที่จะจัดสรร (USDT)</label>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.5rem', color: '#444', fontWeight: 800 }}>$</span>
                <input 
                  type="text" 
                  value={amountInput} 
                  placeholder="0"
                  onChange={(e) => {
                    let val = e.target.value.replace(/[^0-9.]/g, '');
                    if (val.startsWith('0') && val.length > 1 && val[1] !== '.') val = val.substring(1);
                    setAmountInput(val);
                  }}
                  onBlur={() => {
                    if (!amountInput || isNaN(Number(amountInput))) setAmountInput('0');
                    else setAmountInput(String(Number(amountInput)));
                  }}
                  style={{ background: 'transparent', border: 'none', color: '#faad14', fontSize: '3rem', fontWeight: 900, width: '250px', outline: 'none', textAlign: 'center' }}
                />
              </div>
              <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '1rem' }}>
                คงเหลือใน Wallet: <span style={{ color: '#aaa', fontWeight: 'bold' }}>${availableCash.toLocaleString()} USDT</span>
              </div>
            </div>

            <button 
              onClick={handlePropose} 
              disabled={loading || amount <= 0 || amount > availableCash}
              style={{ 
                background: loading ? '#222' : '#faad14', 
                color: '#000', 
                padding: '1.25rem', 
                border: 'none', 
                borderRadius: '12px', 
                fontWeight: 900, 
                fontSize: '1rem',
                cursor: (loading || amount > availableCash) ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
                boxShadow: loading ? 'none' : '0 10px 30px rgba(250,173,20,0.3)',
                transition: 'all 0.2s ease'
              }}
            >
              {loading ? <RefreshCw size={20} className="spin" /> : <Zap size={20} />}
              {loading ? 'AI CIO กำลังร่างแผนกลยุทธ์...' : 'วิเคราะห์และจัดสรรทุน ⚡'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              {tiers.map((t: any) => {
                const isSel = selectedTier === t.id;
                return (
                  <div 
                    key={t.id}
                    onClick={() => setSelectedTier(t.id)}
                    style={{ 
                      padding: '1.5rem 1rem', 
                      borderRadius: '16px', 
                      background: isSel ? `${t.color}11` : 'rgba(255,255,255,0.02)',
                      border: `2px solid ${isSel ? t.color : 'rgba(255,255,255,0.05)'}`,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      textAlign: 'center',
                      position: 'relative'
                    }}
                  >
                    {isSel && <div style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', background: t.color, color: '#000', fontSize: '0.65rem', padding: '2px 10px', borderRadius: '10px', fontWeight: 900 }}>SELECTED</div>}
                    <div style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>{t.label}</div>
                    <div style={{ fontSize: '0.65rem', color: isSel ? '#fff' : '#666', lineHeight: 1.4 }}>{t.desc}</div>
                  </div>
                );
              })}
            </div>

            {selectedTier && (
              <div className="fade-in" style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                   <div style={{ maxWidth: '70%' }}>
                     <div style={{ fontSize: '0.6rem', fontWeight: 900, color: tiers.find((t:any)=>t.id===selectedTier).color, textTransform: 'uppercase', marginBottom: '0.5rem' }}>AI CIO Analysis Report</div>
                     <p style={{ margin: 0, fontSize: '0.9rem', color: '#eee', lineHeight: 1.6, fontStyle: 'italic' }}>"{proposals[selectedTier].summary}"</p>
                   </div>
                   <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.65rem', color: '#666', textTransform: 'uppercase' }}>Cash Reserve</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#faad14' }}>${proposals[selectedTier].reserve}</div>
                   </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                   {proposals[selectedTier].fleets.map((f: any, i: number) => (
                      <div key={i} style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                         <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                            <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>{f.name}</span>
                            <span style={{ color: '#0ecb81', fontWeight: 900 }}>${f.budget}</span>
                         </div>
                         <div style={{ fontSize: '0.65rem', color: '#666' }}>
                           Type: <span style={{ color: '#aaa' }}>{f.strategyType.toUpperCase()}</span> · {f.riskMode}
                         </div>
                         <div style={{ fontSize: '0.7rem', marginTop: '0.5rem', color: '#888', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem' }}>
                           {f.reason}
                         </div>
                      </div>
                   ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem' }}>
               <button 
                  onClick={() => setProposals(null)} 
                  style={{ flex: 1, padding: '1rem', background: 'rgba(255,255,255,0.05)', color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 800 }}
               >
                  แก้ไขยอดเงิน
               </button>
               <button 
                  onClick={handleApply}
                  disabled={executing}
                  style={{ 
                    flex: 2, 
                    background: '#faad14', 
                    color: '#000', 
                    padding: '1rem', 
                    border: 'none', 
                    borderRadius: '12px', 
                    cursor: executing ? 'not-allowed' : 'pointer', 
                    fontWeight: 900,
                    fontSize: '1rem',
                    boxShadow: '0 10px 25px rgba(250,173,20,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                  }}
               >
                  {executing ? <RefreshCw size={18} className="spin" /> : <Play size={18} />}
                  ยืนยันและเปิดกองยานที่เลือก 🚀
               </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


// ─── Fleet Settings Panel ─────────────────────────────────────────────────────

function FleetSettingsPanel({ fleet, onSave, onClose, isLive }: any) {
  const cfg = fleet.config || {};
  const [budget, setBudget] = useState(cfg.totalBudget ?? 1000);
  const [maxLoss, setMaxLoss] = useState(cfg.maxDailyLossPct ?? 5);
  const [botCount, setBotCount] = useState(cfg.targetBotCount ?? 3);
  const [riskMode, setRiskMode] = useState(cfg.riskMode ?? 'confident');
  const [aiModel, setAiModel] = useState(cfg.aiModel ?? '');
  const [rethinkInterval, setRethinkInterval] = useState(cfg.aiRethinkInterval ?? 60);
  const [slLimit, setSlLimit] = useState(cfg.consecutiveSLLimit ?? 3);
  const [reviewHours, setReviewHours] = useState(cfg.reviewIntervalHours ?? 1);
  const [autoVaultPct, setAutoVaultPct] = useState(cfg.autoVaultPct ?? 20);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave({ 
      totalBudget: budget, 
      maxDailyLossPct: maxLoss, 
      targetBotCount: botCount, 
      riskMode, 
      aiModel, 
      aiRethinkInterval: rethinkInterval, 
      consecutiveSLLimit: slLimit, 
      reviewIntervalHours: reviewHours, 
      autoVaultPct 
    });
    setSaving(false);
    onClose();
  };

  const themeColor = isLive ? '#f6465d' : '#00d1ff';

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0d1117', border: `1px solid ${themeColor}33`, borderRadius: '24px', padding: '2.5rem', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2rem', boxShadow: `0 32px 80px rgba(0,0,0,0.8), 0 0 40px ${themeColor}11` }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ background: `${themeColor}15`, borderRadius: '12px', padding: '12px', color: themeColor, display: 'flex' }}>
               <Settings size={26} />
            </div>
            <div>
              <div style={{ fontWeight: 900, fontSize: '1.5rem', letterSpacing: '-0.02em', color: '#fff' }}>Fleet Configuration</div>
              <div style={{ fontSize: '0.85rem', color: '#666', fontWeight: 600 }}>{fleet.name} · {isLive ? 'LIVE ASSETS' : 'TESTNET SIMULATION'}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', transition: 'all 0.2s' }} className="hover-bg-light">
            <X size={20} />
          </button>
        </div>

        {/* 🧠 SECTION: INTELLIGENCE & EXECUTION */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: themeColor, fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1.5px' }}>
             <Brain size={16} /> Intelligence & Strategy
          </div>
          <div className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
             <Field label="AI Scanning Pattern (Risk Mode)">
               <select className="styled-input" style={{ width: '100%', fontSize: '0.9rem' }} value={riskMode} onChange={e => setRiskMode(e.target.value)}>
                 {RISK_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
               </select>
             </Field>
             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <Field label="Target Bot Count">
                   <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(0,0,0,0.2)', padding: '0.4rem 1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <input type="text" value={botCount === 0 ? '' : botCount} placeholder="0" onChange={e => setBotCount(e.target.value === '' ? 0 : Number(e.target.value.replace(/[^0-9]/g, '')))} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.1rem', fontWeight: 900, width: '100%', outline: 'none' }} />
                      <Cpu size={18} color="#444" />
                   </div>
                </Field>
                <Field label="Review Interval">
                  <select className="styled-input" style={{ width: '100%' }} value={reviewHours} onChange={e => setReviewHours(+e.target.value)}>
                    <option value={1}>Every 1 hour</option>
                    <option value={2}>Every 2 hours</option>
                    <option value={4}>Every 4 hours</option>
                  </select>
                </Field>
             </div>
          </div>
        </section>

        {/* 🛡️ SECTION: RISK & CAPITAL MANAGEMENT */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#0ecb81', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1.5px' }}>
             <Shield size={16} /> Risk & Guardrails
          </div>
          <div className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <Field label="Liquidity Allocation (USDT)">
                   <input type="text" className="styled-input" style={{ width: '100%', fontSize: '1.1rem', fontWeight: 900, color: '#0ecb81' }} value={budget === 0 ? '' : budget} placeholder="0" onChange={e => setBudget(e.target.value === '' ? 0 : Number(e.target.value.replace(/[^0-9.]/g, '')))} />
                </Field>
                <Field label="Daily Drawdown Limit (%)">
                   <input type="text" className="styled-input" style={{ width: '100%', fontSize: '1.1rem', fontWeight: 900, color: '#f6465d' }} value={maxLoss === 0 ? '' : maxLoss} placeholder="0" onChange={e => setMaxLoss(e.target.value === '' ? 0 : Number(e.target.value.replace(/[^0-9.]/g, '')))} />
                </Field>
             </div>

             <Field label={`Profit Auto-Vault: ${autoVaultPct}%`}>
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <input type="range" min={0} max={100} step={5} value={autoVaultPct} onChange={e => setAutoVaultPct(+e.target.value)} style={{ width: '100%', accentColor: '#0ecb81' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.7rem', color: '#444', fontWeight: 800 }}>
                    <span>CASH OUT</span>
                    <span style={{ color: '#0ecb81' }}>{autoVaultPct}% TO WALLET</span>
                    <span>REINVEST</span>
                  </div>
                </div>
             </Field>

             <Field label={`Replacement Circuit Breaker: ${slLimit} SL`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', background: 'rgba(246,70,93,0.05)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(246,70,93,0.1)' }}>
                   <div style={{ flex: 1 }}>
                     <input type="range" min={1} max={10} value={slLimit} onChange={e => setSlLimit(+e.target.value)} style={{ width: '100%', accentColor: '#f6465d' }} />
                   </div>
                   <div style={{ width: '50px', fontSize: '1.2rem', fontWeight: 900, color: '#f6465d', textAlign: 'right' }}>{slLimit}</div>
                </div>
                <div style={{ fontSize: '0.65rem', color: '#666', marginTop: '0.4rem' }}>AI จะปลดบอทออกทันที หากทำผลงานพลาดติดต่อกันครบตามจำนวนที่กำหนด</div>
             </Field>
          </div>
        </section>

        <div style={{ display: 'flex', gap: '1rem', paddingTop: '1rem' }}>
          <button onClick={onClose} className="btn-outline" style={{ flex: 1, padding: '1.25rem', borderRadius: '14px', fontWeight: 800 }}>Cancel</button>
          <button onClick={handleSave} className="btn-primary hover-bump" style={{ flex: 2, padding: '1.25rem', background: themeColor, border: 'none', color: '#000', borderRadius: '14px', fontWeight: 900, fontSize: '1.1rem', boxShadow: `0 10px 30px ${themeColor}33` }} disabled={saving}>
            {saving ? <RefreshCw size={20} className="spin" /> : 'Apply Intelligence Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Portfolio({ mode = 'test' }: { mode?: 'test' | 'live' }) {
  const isLive = mode === 'live';
  const themeColor = isLive ? '#f6465d' : 'var(--accent-primary)';

  const [fleets, setFleets] = useState<any[]>([]);
  const [bots, setBots] = useState<any[]>([]);
  const [mistakes, setMistakes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFleetId, setSelectedFleetId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSettingsFor, setShowSettingsFor] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'bots' | 'logs' | 'memory' | 'performance'>('bots');
  const [reviewingFleet, setReviewingFleet] = useState<string | null>(null);
  const [fleetAnalytics, setFleetAnalytics] = useState<any>(null);
  const [fetchingAnalytics, setFetchingAnalytics] = useState(false);
  const [globalReport, setGlobalReport] = useState<string | null>(null);
  const [fetchingGlobalReport, setFetchingGlobalReport] = useState(false);
  const [showGlobalReport, setShowGlobalReport] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [realWallet, setRealWallet] = useState<any>(null);

  const [realHistory, setRealHistory] = useState<any[]>([]);
  const [fetchingHistory, setFetchingHistory] = useState(false);

  const [vBalance, setVBalance] = useState(1000);
  const [isEditingBalance, setIsEditingBalance] = useState(false);
  const [tempBalance, setTempBalance] = useState('1000');

  const fetchData = async () => {
    try {
      const requests = [
        fetch(`${API}/api/portfolio/fleets`),
        fetch(`${API}/api/bots/summary`),
        fetch(`${API}/api/binance/mistakes`),
        fetch(`${API}/api/config`),
      ];
      if (isLive) requests.push(fetch(`${API}/api/binance/live/account`));

      const responses = await Promise.all(requests);
      const fleetsData = await responses[0].json();
      const botsData = await responses[1].json();
      const mistakesData = await responses[2].json();
      const configData = await responses[3].json();
      
      let rWallet = null;
      if (isLive && responses[4]) rWallet = await responses[4].json();
      setRealWallet(rWallet);
      setVBalance(configData.virtualTestBalance || 1000);

      // Filter by exchange
      const filteredFleets = fleetsData.filter((f: any) => isLive ? f.config?.exchange === 'binance_live' : f.config?.exchange !== 'binance_live');
      const filteredBots = botsData.filter((b: any) => b.isRunning && (isLive ? b.config?.exchange === 'binance_live' : b.config?.exchange !== 'binance_live'));

      const mBots = filteredBots.filter((b: any) => {
        const fid = b.managedBy || b.config?.managedBy;
        return !fid || fid === 'manual' || !filteredFleets.some((f: any) => f.id === fid);
      });

      // Enrich selected fleet with logs
      let enriched = [...filteredFleets];
      if (selectedFleetId && selectedFleetId !== 'manual') {
        try {
          const res = await fetch(`${API}/api/portfolio/fleets/${selectedFleetId}/status`);
          const status = await res.json();
          enriched = filteredFleets.map((f: any) => f.id === selectedFleetId ? { ...f, ...status } : f);
          
          setFetchingAnalytics(true);
          const resAnal = await fetch(`${API}/api/portfolio/fleets/${selectedFleetId}/analytics`);
          if (resAnal.ok) setFleetAnalytics(await resAnal.json());
          setFetchingAnalytics(false);
        } catch (e) {
          console.error('fetchFleetStatus error', e);
          setFetchingAnalytics(false);
        }
      }

      setFleets(enriched.map((f: any) => ({
        ...f,
        minConfidence: f.minConfidence ?? f.config?.minConfidence ?? 70
      })));
      setBots(filteredBots);
      setMistakes(mistakesData);

      const isValidFleet = enriched.some((f: any) => f.id === selectedFleetId) || selectedFleetId === 'manual';
      if (!selectedFleetId || !isValidFleet) {
        if (enriched.length > 0) setSelectedFleetId(enriched[0].id);
        else if (mBots.length > 0) setSelectedFleetId('manual');
        else setSelectedFleetId(null);
      }
    } catch (e) {
      console.error('fetchData error', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchRealHistory = async () => {
    setFetchingHistory(true);
    try {
      const endpoint = isLive ? '/api/binance/live/history' : '/api/binance/history';
      const res = await fetch(`${API}${endpoint}`);
      if (res.ok) {
        const data = await res.json();
        // Standardize format: Live returns CCXT trades, DB returns system trades
        const standardized = data.map((t: any) => ({
          timestamp: t.timestamp || t.exitTime || Date.now(),
          symbol: t.symbol,
          side: (t.side || t.type || 'N/A').toUpperCase(),
          price: t.price || t.exitPrice || 0,
          amount: t.amount || t.quantity || 0,
          realizedPnl: t.realizedPnl !== undefined ? t.realizedPnl : (t.pnl || 0)
        }));
        setRealHistory(standardized);
      }
    } catch (e) {
      console.error('fetchRealHistory error', e);
    } finally {
      setFetchingHistory(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchRealHistory();
    const t = setInterval(fetchData, 10000);
    return () => clearInterval(t);
  }, [selectedFleetId, isLive]);

  const handleCreateFleet = async (data: any) => {
    const res = await fetch(`${API}/api/portfolio/fleets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    setShowCreateModal(false);
    await fetchData();
    if (result.fleet?.id) setSelectedFleetId(result.fleet.id);
  };

  const handleSaveSettings = async (fleetId: string, config: any) => {
    await fetch(`${API}/api/portfolio/fleets/${fleetId}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    await fetchData();
  };

  const [editingConfidenceId, setEditingConfidenceId] = useState<string | null>(null);
  const [confidenceEditValue, setConfidenceEditValue] = useState('');

  const handleUpdateConfidence = async (fleetId: string) => {
    const val = parseFloat(confidenceEditValue);
    if (isNaN(val) || val < 0 || val > 100) {
      alert('❌ กรุณาใส่ตัวเลข 0 - 100 ครับ');
      setEditingConfidenceId(null);
      return;
    }

    try {
      const res = await fetch(`${API}/api/portfolio/fleets/${fleetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minConfidence: val }),
      });
      if (!res.ok) throw new Error('Update failed');
      
      // Update local state to reflect change immediately
      setFleets(prev => prev.map(f => f.id === fleetId ? { ...f, minConfidence: val } : f));
      setEditingConfidenceId(null);
    } catch (e) {
      alert('Error updating confidence: ' + e);
    }
  };

  const handleToggle = async (fleetId: string, active: boolean) => {
    await fetch(`${API}/api/portfolio/fleets/${fleetId}/settings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isAutonomous: active }) });
    await fetch(`${API}/api/portfolio/fleets/${fleetId}/toggle`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active }) });
    fetchData();
  };

  const handleToggleAllBots = async (fleetId: string, action: 'start' | 'stop') => {
    if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการ ${action === 'start' ? 'เริ่มทำงาน' : 'หยุดทำงาน'} บอททั้งหมดในกองยานนี้?`)) return;
    await fetch(`${API}/api/portfolio/fleets/${fleetId}/bots-action`, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ action }) 
    });
    fetchData();
  };

  const handleForceReview = async (fleetId: string) => {
    setReviewingFleet(fleetId);
    try {
      await fetch(`${API}/api/portfolio/fleets/${fleetId}/review`, { method: 'POST' });
      await fetchData();
    } catch (e) { console.error(e); } finally { setReviewingFleet(null); }
  };

  const handleDeleteFleet = async (id: string, name: string) => {
    const msg = `ต้องการลบ Fleet "${name}" ใช่หรือไม่?\n\n⚠️ บอทที่อยู่ในกลุ่มนี้จะถูกย้ายไปที่ "Unassigned" (Manual)\n⚠️ ระบบจะไม่ปิด Position ที่เปิดค้างไว้ให้โดยอัตโนมัติ คุณต้องจัดการต่อเองในหน้า Manual\n\nยืนยันการลบ?`;
    if (!window.confirm(msg)) return;
    await fetch(`${API}/api/portfolio/fleets/${id}`, { method: 'DELETE' });
    if (selectedFleetId === id) setSelectedFleetId(null);
    fetchData();
  };

  const handleCloneLive = async (id: string, name: string) => {
    if (!window.confirm(`Deploy "${name}" to Binance LIVE? This will create a duplicate fleet configured for real trading.`)) return;
    try {
      const res = await fetch(`${API}/api/portfolio/fleets/${id}/clone-live`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert('Fleet cloned successfully! Look for the (LIVE) version in your list.');
      fetchData();
    } catch (e: any) { alert('Deployment Error: ' + e.message); }
  };

  const handleDeleteBot = async (botId: string) => {
    await fetch(`${API}/api/bots/delete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ botId }) });
    fetchData();
  };

  const handleRunGlobalReview = async () => {
    setFetchingGlobalReport(true);
    setShowGlobalReport(true);
    try {
      const res = await fetch(`${API}/api/portfolio/global-review?isLive=${isLive}`);
      const data = await res.json();
      if (res.ok) setGlobalReport(data.report);
      else throw new Error(data.error);
    } catch (e: any) { alert('Global Review Error: ' + e.message); } finally { setFetchingGlobalReport(false); }
  };

  const handleUpdateBalance = async (newAmount: number) => {
    await fetch(`${API}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ virtualTestBalance: newAmount }),
    });
    setVBalance(newAmount);
    setIsEditingBalance(false);
    fetchData();
  };

  const handleExecuteWizard = async (proposal: any) => {
    // Create and AUTO-START multiple fleets based on AI proposal
    for (const f of proposal.fleets) {
      const res = await fetch(`${API}/api/portfolio/fleets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: f.name,
          config: {
            exchange: isLive ? 'binance_live' : 'binance_testnet',
            riskMode: f.riskMode,
            strategyType: f.strategyType,
            totalBudget: f.budget,
            targetBotCount: 3,
            isAutonomous: f.isAutonomous
          }
        }),
      });
      
      const data = await res.json();
      if (res.ok && data.fleet?.id) {
        // AUTO-START the fleet immediately
        await fetch(`${API}/api/portfolio/fleets/${data.fleet.id}/toggle`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active: true })
        });
      }
    }
    fetchData();
  };

  if (loading) return <div className="p-8 text-muted animate-pulse">Initializing {isLive ? 'Live' : 'Paper'} Portfolio Command...</div>;

  const getBotFleetId = (bot: any) => bot.managedBy || bot.config?.managedBy;
  const manualBots = bots.filter(b => {
    const fid = getBotFleetId(b);
    return !fid || fid === 'manual' || !fleets.some(f => f.id === fid);
  });
  const isSelectedManual = selectedFleetId === 'manual';

  const currentFleet = isSelectedManual
    ? { id: 'manual', name: 'Manual Operations', config: { isAutonomous: false, totalBudget: 0, riskMode: 'manual', targetBotCount: 0 }, isRunning: false, currentAction: 'Manual Execution' }
    : (fleets.find(f => f.id === selectedFleetId) || (fleets.length > 0 ? fleets[0] : null));

  const fleetBots = isSelectedManual ? manualBots : (currentFleet ? bots.filter(b => getBotFleetId(b) === currentFleet.id) : []);
  const fleetPnl = fleetBots.reduce((s, b) => s + (b.netPnl || 0), 0);
  const totalAllocated = fleets.reduce((s, f) => s + (f.config?.totalBudget || 0), 0);
  const fleetBudget = (isSelectedManual ? manualBots.reduce((s, b) => s + (b.config?.positionSizeUSDT || 0), 0) : currentFleet?.config?.totalBudget) || 1000;
  const pnlPct = fleetBudget > 0 ? (fleetPnl / fleetBudget) * 100 : 0;
  const isAuto = currentFleet?.config?.isAutonomous;

  // 📊 Wallet & Allocation Logic
  const manualBotsValue = manualBots.reduce((s, b) => s + (b.netPnl || 0), 0); // Unassigned bots value
  const totalFleetEquity = fleets.reduce((sum, f) => {
    const fBots = bots.filter(b => getBotFleetId(b) === f.id);
    const fPnl = fBots.reduce((s, b) => s + (b.netPnl || 0), 0);
    return sum + (f.config?.totalBudget || 0) + fPnl;
  }, 0) + manualBotsValue;

  const cashReserve = Number(isLive ? (realWallet?.availableBalance || 0) : Math.max(0, vBalance - totalAllocated)); 
  const totalEquity = Number(isLive ? (realWallet?.totalWalletBalance || 0) : (totalFleetEquity + cashReserve));
  const employedPct = totalEquity > 0 ? (totalFleetEquity / totalEquity) * 100 : 0;

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* 🚩 LIVE PRODUCTION BANNER */}
      {isLive && (
        <div className="glass-panel" style={{ padding: '0.75rem 1.25rem', background: 'rgba(246,70,93,0.15)', border: '1px solid rgba(246,70,93,0.4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#f6465d' }}>
            <Lock size={16} />
            <span style={{ fontWeight: 900, fontSize: '0.9rem', letterSpacing: '1px' }}>PRODUCTION ENVIRONMENT — REAL ASSETS (LIVE)</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#f6465d', fontWeight: 'bold' }}>
             <Globe size={14} style={{ marginRight: '0.4rem' }} /> BINANCE GLOBAL READY
          </div>
        </div>
      )}

      {/* Modals */}
      {showCreateModal && (
        <CreateFleetModal 
          isLive={isLive} 
          availableCash={cashReserve} 
          onClose={() => setShowCreateModal(false)} 
          onCreate={handleCreateFleet} 
        />
      )}
      {showWizard && <StrategyWizardModal isLive={isLive} availableCash={cashReserve} onClose={() => setShowWizard(false)} onExecute={handleExecuteWizard} />}
      {showSettingsFor && (
        <FleetSettingsPanel
          isLive={isLive}
          fleet={showSettingsFor}
          onSave={(cfg: any) => handleSaveSettings(showSettingsFor.id, cfg)}
          onClose={() => setShowSettingsFor(null)}
        />
      )}

      {/* ── 🏦 PORTFOLIO OVERVIEW & INTELLIGENCE ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(400px, 1.2fr) minmax(350px, 1fr)', gap: '1.5rem', alignItems: 'stretch' }}>
        
        {/* Left: Financial Summary */}
        <div className="glass-panel" style={{ padding: '2rem', borderTop: `4px solid ${themeColor}`, background: 'rgba(255,255,255,0.01)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-30px', right: '-20px', opacity: 0.03, pointerEvents: 'none' }}><Wallet size={200} /></div>
          
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
               <PieChart size={14} color={themeColor} /> Total Portfolio Value
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '3.5rem', color: isEditingBalance ? themeColor : '#fff', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: '1', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <span style={{ fontSize: '1.8rem', color: 'rgba(255,255,255,0.2)' }}>$</span>
                {isEditingBalance && !isLive ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                     <input 
                       autoFocus
                       className="styled-input" 
                       style={{ fontSize: '2.5rem', padding: '0.1rem 0.6rem', width: '250px', fontWeight: 900, background: 'rgba(0,0,0,0.3)', color: themeColor, border: `1px solid ${themeColor}55` }} 
                       value={tempBalance} 
                       onChange={e => setTempBalance(e.target.value)}
                       onKeyDown={e => e.key === 'Enter' && handleUpdateBalance(+tempBalance)}
                     />
                     <button onClick={() => handleUpdateBalance(+tempBalance)} className="btn-primary" style={{ padding: '0.6rem', borderRadius: '10px' }}><RefreshCw size={20} /></button>
                     <button onClick={() => setIsEditingBalance(false)} className="btn-outline" style={{ padding: '0.6rem', borderRadius: '10px' }}><X size={20} /></button>
                  </div>
                ) : (
                  <>
                    {totalEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    {!isLive && (
                       <button 
                          onClick={() => { setTempBalance(String(vBalance)); setIsEditingBalance(true); }} 
                          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px', cursor: 'pointer', color: '#888', display: 'flex', transition: 'all 0.2s' }}
                          className="hover-bg-light"
                          title="Set Target Simulation Balance"
                        >
                          <Settings size={18} />
                       </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '2.5rem', padding: '1.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.03)' }}>
            <div>
              <div style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', fontWeight: 800, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Activity size={12} color={themeColor} /> Active Investment</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fff' }}>${totalFleetEquity.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.3rem', fontWeight: 600 }}>{employedPct.toFixed(1)}% of Capital</div>
            </div>
            <div style={{ borderLeft: '1px solid rgba(255,255,255,0.05)', paddingLeft: '1.5rem' }}>
              <div style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', fontWeight: 800, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Lock size={12} color="#0ecb81" /> Cash Reserve</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0ecb81' }}>${cashReserve.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.3rem', fontWeight: 600 }}>Ready for Deployment</div>
            </div>
          </div>
          
          <div style={{ marginTop: '1.5rem' }}>
            <AllocationBar 
              total={totalEquity}
              items={[
                ...fleets.map((f:any, i:number) => {
                  const fBots = bots.filter(b => getBotFleetId(b) === f.id);
                  const fPnl = fBots.reduce((s, b) => s + (b.netPnl || 0), 0);
                  const colors = [themeColor, '#00d1ff', '#faad14', '#9c27b0', '#ff9800'];
                  return {
                    label: f.name,
                    value: (f.config?.totalBudget || 0) + fPnl,
                    color: colors[i % colors.length]
                  };
                }),
                ...(manualBotsValue !== 0 ? [{ label: 'Manual/Unassigned', value: manualBotsValue, color: '#888' }] : []),
                { label: 'Cash Reserve', value: cashReserve, color: '#222' }
              ]}
            />
          </div>
        </div>

        {/* Right: Market Intelligence & Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
           {/* Intelligence Card */}
           <div className="glass-panel" style={{ flex: 1, padding: '2rem', background: 'linear-gradient(145deg, rgba(255,255,255,0.02) 0%, rgba(0,0,0,0.2) 100%)', border: `1px solid ${themeColor}33`, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: '-20px', right: '-20px', opacity: 0.05, pointerEvents: 'none' }}><BrainCircuit size={150} /></div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.5rem' }}>
                 <Brain size={22} color={themeColor} />
                 <span style={{ fontSize: '0.9rem', fontWeight: 900, textTransform: 'uppercase', color: themeColor, letterSpacing: '1px' }}>AI Market Radar</span>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: '0.65rem', color: '#888', textTransform: 'uppercase', marginBottom: '0.4rem', fontWeight: 700 }}>Trend Quality (TQI)</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0ecb81', fontWeight: 900, fontSize: '1.2rem' }}>
                    <TrendingUp size={18} /> Strong
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: '0.65rem', color: '#888', textTransform: 'uppercase', marginBottom: '0.4rem', fontWeight: 700 }}>Market Sentiment</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#faad14', fontWeight: 900, fontSize: '1.2rem' }}>
                    <Activity size={18} /> Neutral-Greed
                  </div>
                </div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1.25rem', borderRadius: '12px', borderLeft: `4px solid ${themeColor}` }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 900, color: '#aaa', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.5px' }}>CIO Evaluation</div>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#ddd', lineHeight: '1.6' }}>
                    Market structure is stable. High TQI supports Trend-Following strategies. Maintain 20% Cash Reserve. Consider scaling Aggressive bots if volume increases.
                  </p>
              </div>
           </div>
           
           <button 
             className="btn-primary" 
             style={{ padding: '1.25rem', background: themeColor, border: 'none', borderRadius: '16px', fontSize: '1rem', fontWeight: 900, boxShadow: `0 10px 30px ${themeColor}22` }} 
             onClick={handleRunGlobalReview}
             disabled={fetchingGlobalReport}
           >
             {fetchingGlobalReport ? <RefreshCw size={20} className="spin" /> : <BrainCircuit size={20} />} 
             {fetchingGlobalReport ? 'Analyzing Portfolios...' : 'Run Deep Portfolio Analysis'}
           </button>
        </div>
      </div>

      {/* 🧠 Global AI Insights Panel */}
      {showGlobalReport && (
        <div className="glass-panel animate-fade-in" style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.01)', border: `1px solid ${themeColor}33` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ background: themeColor, borderRadius: '8px', padding: '6px', display: 'flex' }}>
                <Brain size={20} color="white" />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>CIO Strategic Advisor Report</h3>
            </div>
            <button onClick={() => setShowGlobalReport(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <X size={20} />
            </button>
          </div>
          
          {fetchingGlobalReport ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <RefreshCw size={32} className="spin" style={{ marginBottom: '1rem', opacity: 0.3 }} />
              <div>CIO is assessing all portfolios and market microstructure...</div>
            </div>
          ) : (
            <div className="markdown-content" style={{ fontSize: '0.9rem', color: '#ccc', lineHeight: '1.6' }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{globalReport || 'No report available.'}</ReactMarkdown>
            </div>
          )}
        </div>
      )}

      {/* ── Sub-Portfolio (Fleets) Navigation ──────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
             <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Layers size={20} color={themeColor} /> Active Fleets
             </h2>
             <button 
                onClick={() => {
                  if (window.confirm('🛑 Emergency Stop: ต้องการสั่งหยุดกองยานทั้งหมดใช่หรือไม่?')) {
                    fleets.filter(f => f.isRunning).forEach(f => handleToggle(f.id, false));
                  }
                }}
                style={{ background: 'rgba(246,70,93,0.1)', border: '1px solid rgba(246,70,93,0.3)', color: '#f6465d', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', fontWeight: 800, transition: 'all 0.2s' }}
                className="hover-bg-light"
              >
                <Square size={12} fill="#f6465d" /> STOP ALL
              </button>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
             <button onClick={() => setShowWizard(true)} className="btn-primary" style={{ padding: '0.6rem 1rem', background: '#faad14', border: 'none', color: '#000', fontWeight: 900, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '10px', boxShadow: '0 4px 15px rgba(250,173,20,0.2)' }}>
                <Zap size={16} fill="#000" /> AI CIO STRATEGY WIZARD
             </button>
             <button onClick={() => setShowCreateModal(true)} className="btn-outline" style={{ padding: '0.6rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '10px' }}>
                <Plus size={16} /> Custom Fleet
             </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '1rem', scrollbarWidth: 'none' }}>
          
          {/* 🛠️ Manual Operations Tab */}
          {manualBots.length > 0 && (
            <div
              onClick={() => setSelectedFleetId('manual')}
              className="glass-panel"
              style={{
                flexShrink: 0, minWidth: '260px', padding: '1.25rem', cursor: 'pointer',
                border: `1px solid ${isSelectedManual ? themeColor : 'rgba(255,255,255,0.06)'}`,
                background: isSelectedManual ? `${themeColor}08` : 'rgba(255,255,255,0.01)',
                boxShadow: isSelectedManual ? `0 0 20px ${themeColor}11` : 'none',
                transition: 'all 0.2s transform'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#666' }} />
                  <span style={{ fontWeight: 800, fontSize: '1rem', color: isSelectedManual ? '#fff' : 'var(--text-muted)' }}>Manual Operations</span>
                </div>
                <Globe size={16} style={{ opacity: 0.3 }} />
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{manualBots.length} Unassigned Bots</div>
              <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: '1.2rem', fontWeight: 900 }}>
                  ${manualBots.reduce((s, b) => s + (b.netPnl || 0), 0).toFixed(2)}
                </span>
                <span style={{ fontSize: '0.7rem', color: '#666', fontWeight: 600 }}>Pending Cleanup</span>
              </div>
            </div>
          )}

          {fleets.map(f => {
            const fBots = bots.filter(b => getBotFleetId(b) === f.id);
            const fPnl = fBots.reduce((s, b) => s + (b.netPnl || 0), 0);
            const fBudget = f.config?.totalBudget || 1000;
            const fPnlPct = (fPnl / fBudget) * 100;
            const isSelected = selectedFleetId === f.id;
            const allocationPct = (fBudget / totalEquity) * 100;
            const isRunning = f.isRunning;

            return (
              <div
                key={f.id}
                onClick={() => setSelectedFleetId(f.id)}
                className="glass-panel hover-bump"
                style={{
                  flexShrink: 0, minWidth: '260px', padding: '1.25rem', cursor: 'pointer',
                  border: `1px solid ${isSelected ? themeColor : 'rgba(255,255,255,0.06)'}`,
                  background: isSelected ? `${themeColor}08` : 'rgba(255,255,255,0.02)',
                  boxShadow: isSelected ? `0 0 20px ${themeColor}11` : 'none',
                  transform: isSelected ? 'translateY(-2px)' : 'none',
                  position: 'relative',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.6rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div className={isRunning ? 'pulse' : ''} style={{ width: '10px', height: '10px', borderRadius: '50%', background: isRunning ? (isLive ? '#f6465d' : 'var(--profit-color)') : '#444' }} />
                    <span style={{ fontWeight: 800, fontSize: '1.05rem', color: isSelected ? '#fff' : 'var(--text-muted)' }}>{f.name}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', padding: '2px', background: 'rgba(0,0,0,0.2)' }}>
                     <button 
                        onClick={e => { e.stopPropagation(); handleToggle(f.id, !isRunning); }} 
                        style={{ 
                          background: 'none', border: 'none', cursor: 'pointer', opacity: 0.8, padding: '4px 6px', 
                          color: isRunning ? '#f6465d' : '#0ecb81',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          borderRadius: '4px'
                        }}
                        className="hover-bg-light"
                     >
                       {isRunning ? <Square size={14} fill="#f6465d" /> : <Play size={14} fill="#0ecb81" />}
                     </button>
                     {isSelected && (
                      <button onClick={e => { e.stopPropagation(); handleDeleteFleet(f.id, f.name); }} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6, padding: '4px 6px', color: '#f6465d', borderRadius: '4px' }} className="hover-bg-light">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{fBots.length} Bots · {f.config?.riskMode || 'confident'}</div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {editingConfidenceId === f.id ? (
                      <input 
                        autoFocus
                        type="text"
                        value={confidenceEditValue}
                        onChange={e => setConfidenceEditValue(e.target.value.replace(/[^0-9.]/g, ''))}
                        onBlur={() => handleUpdateConfidence(f.id)}
                        onKeyDown={e => e.key === 'Enter' && handleUpdateConfidence(f.id)}
                        style={{ width: '40px', background: 'rgba(0,0,0,0.3)', border: `1px solid ${themeColor}`, color: '#fff', fontSize: '0.7rem', borderRadius: '4px', textAlign: 'center' }}
                      />
                    ) : (
                      <div 
                        onClick={(e) => { e.stopPropagation(); setEditingConfidenceId(f.id); setConfidenceEditValue(String(f.minConfidence || 70)); }}
                        style={{ fontSize: '0.7rem', fontWeight: 800, color: '#aaa', background: `rgba(255,255,255,0.05)`, padding: '2px 6px', borderRadius: '4px', cursor: 'edit', border: '1px solid rgba(255,255,255,0.1)' }}
                        title="Click to edit Confidence"
                        className="hover-glow"
                      >
                        Conf: {f.minConfidence || 70}%
                      </div>
                    )}
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: themeColor, background: `${themeColor}22`, padding: '2px 6px', borderRadius: '4px' }}>{allocationPct.toFixed(0)}% Alloc</div>
                  </div>
                </div>
                <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '0.8rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: 900 }}>${(fBudget + fPnl).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: fPnl >= 0 ? 'var(--profit-color)' : 'var(--loss-color)', background: fPnl >= 0 ? 'rgba(14,203,129,0.1)' : 'rgba(246,70,93,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                      {fPnl >= 0 ? '+' : ''}{fPnlPct.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Fleet Detail & Execution ────────────────────────────────────────── */}
      {currentFleet && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="glass-panel" style={{ padding: '2rem', borderTop: isLive ? '4px solid #f6465d' : `4px solid ${themeColor}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 900, letterSpacing: '-0.02em' }}>{currentFleet.name}</h3>
                    <span style={{ fontSize: '0.7rem', padding: '4px 12px', borderRadius: '20px', background: isAuto ? `${themeColor}22` : 'rgba(255,255,255,0.05)', color: isAuto ? (isLive ? '#f6465d' : '#0ecb81') : '#888', fontWeight: 900, letterSpacing: '0.5px', border: `1px solid ${isAuto ? themeColor : '#444'}44` }}>
                      {isAuto ? '● ENGINES ACTIVE' : '○ MANUAL STANDBY'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#888', marginTop: '0.6rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><BrainCircuit size={14} color={themeColor} /> {RISK_MODES.find(m => m.value === currentFleet.config?.riskMode)?.label || 'AI Precision'}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Clock size={14} /> Review: Every {currentFleet.config?.reviewIntervalHours || 1}h</span>
                  </div>
                </div>
                 <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {currentFleet.id !== 'manual' && (
                    <>
                      <button onClick={() => handleToggleAllBots(currentFleet.id, 'start')} className="btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#0ecb81', borderColor: 'rgba(14,203,129,0.3)', padding: '0.6rem 1rem', borderRadius: '8px' }}>
                        <Play size={14} fill="currentColor" /> Start All Bots
                      </button>
                      <button onClick={() => handleToggleAllBots(currentFleet.id, 'stop')} className="btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#faad14', borderColor: 'rgba(250,173,20,0.3)', padding: '0.6rem 1rem', borderRadius: '8px' }}>
                        <Square size={14} fill="currentColor" /> Stop All Bots
                      </button>
                      {!isLive && (
                        <button onClick={() => handleCloneLive(currentFleet.id, currentFleet.name)} className="btn-primary hover-bump" style={{ fontSize: '0.8rem', padding: '0.6rem 1.25rem', background: 'linear-gradient(45deg, #f6465d, #ff9b21)', border: 'none', borderRadius: '8px' }}>
                           <Zap size={14} /> Promote
                        </button>
                      )}
                      <button onClick={() => setShowSettingsFor(currentFleet)} className="btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1rem', borderRadius: '8px' }}>
                        <Settings size={14} /> Settings
                      </button>
                      <button onClick={() => handleDeleteFleet(currentFleet.id, currentFleet.name)} className="btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderColor: 'rgba(246,70,93,0.3)', color: '#f6465d', padding: '0.6rem 1rem', borderRadius: '8px' }}>
                        <Trash2 size={14} /> Delete
                      </button>
                      <button onClick={() => handleToggle(currentFleet.id, !isAuto)} className={isAuto ? 'btn-danger hover-bump' : 'btn-primary hover-bump'} style={{ background: !isAuto ? themeColor : undefined, border: !isAuto && isLive ? 'none' : undefined, fontWeight: 900, padding: '0.6rem 1.5rem', borderRadius: '8px', boxShadow: isAuto ? 'none' : `0 4px 15px ${themeColor}44` }}>
                        {isAuto ? <><Square size={14} fill="currentColor" /> STOP REVIEWS</> : <><Play size={14} fill="currentColor" /> START AI ENGINE</>}
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1.5rem', background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.02)' }}>
                <StatCard label="Fleet Net PnL" value={`${fleetPnl >= 0 ? '+' : ''}${fleetPnl.toFixed(2)}`} sub="Total USDT Profit" color={fleetPnl >= 0 ? '#0ecb81' : '#f6465d'} />
                <div style={{ borderLeft: '1px solid rgba(255,255,255,0.05)', paddingLeft: '1.5rem' }}>
                    <StatCard label="Sortino Ratio" value={fleetAnalytics?.sortino?.toFixed(2) || '0.00'} sub="Downside Risk-Adj" color="#faad14" hideBorder />
                </div>
                <div style={{ borderLeft: '1px solid rgba(255,255,255,0.05)', paddingLeft: '1.5rem' }}>
                    <StatCard label="Value at Risk (VaR)" value={`$${fleetAnalytics?.var?.toFixed(1) || '0.0'}`} sub="95% Hist. Max Loss" color="#f6465d" hideBorder />
                </div>
                <div style={{ borderLeft: '1px solid rgba(255,255,255,0.05)', paddingLeft: '1.5rem' }}>
                    <StatCard label="Capital Employed" value={`$${(fleetBudget + fleetPnl).toLocaleString()}`} sub={`${((fleetBudget/totalEquity)*100).toFixed(1)}% of Master Wallet`} hideBorder />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', borderLeft: '1px solid rgba(255,255,255,0.05)', paddingLeft: '1.5rem' }}>
                    <div style={{ fontSize: '0.65rem', color: '#888', textTransform: 'uppercase', fontWeight: 800, marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Activity size={12} color={currentFleet.isRunning ? themeColor : '#444'} /> AI System State
                    </div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 900, color: currentFleet.isRunning ? (isLive ? '#f6465d' : '#0ecb81') : '#888' }}>
                      {currentFleet.isRunning ? 'Active Scan' : 'Standby Mode'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>
                      {currentFleet.currentAction || 'Awaiting orders...'}
                    </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              {['bots', 'performance', 'logs', 'history'].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab as any)} style={{ background: 'none', border: 'none', padding: '1rem 0.5rem', color: activeTab === tab ? themeColor : '#555', borderBottom: `2px solid ${activeTab === tab ? themeColor : 'transparent'}`, cursor: 'pointer', fontWeight: 800, fontSize: '0.85rem' }}>{tab.toUpperCase()}</button>
              ))}
            </div>

            {activeTab === 'bots' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '1rem' }}>
                {fleetBots.map(b => <BotCard key={b.id} bot={b} fleets={fleets} isLive={isLive} onDelete={() => handleDeleteBot(b.id)} />)}
                {fleetBots.length === 0 && (
                  <div style={{ padding: '3rem', textAlign: 'center', gridColumn: '1 / -1', color: '#333' }}>
                    <Bot size={48} style={{ opacity: 0.1, marginBottom: '1rem' }} />
                    <p>No active bots in this fleet. Fleet Manager will recruit soon.</p>
                  </div>
                )}
              </div>
            ) : activeTab === 'performance' ? (
              <div className="glass-panel" style={{ padding: '1.5rem', minHeight: '400px' }}>
                 <PerformanceChart data={fleetAnalytics?.equityCurve || []} />
              </div>
            ) : activeTab === 'logs' ? (
              <div className="glass-panel" style={{ padding: '1rem', height: '400px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                {currentFleet.logs?.map((l: any, i: number) => <div key={i} style={{ padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.02)', color: l.type === 'error' ? '#f6465d' : l.type === 'warn' ? '#faad14' : '#888' }}>
                  <span style={{ opacity: 0.3, marginRight: '0.75rem' }}>[{new Date(l.timestamp).toLocaleTimeString()}]</span>
                  <span>{l.message}</span>
                </div>)}
              </div>
            ) : (
              <div className="glass-panel" style={{ padding: '1.5rem', height: '400px', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h4 style={{ margin: 0 }}>Binance Real Trade History</h4>
                  <button onClick={() => fetchRealHistory()} className="btn-icon"><RefreshCw size={14} className={fetchingHistory ? 'spin' : ''} /></button>
                </div>
                {fetchingHistory ? (
                   <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><RefreshCw className="spin" /></div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: '#444', borderBottom: '1px solid #222' }}>
                        <th style={{ padding: '0.5rem' }}>Time</th>
                        <th style={{ padding: '0.5rem' }}>Symbol</th>
                        <th style={{ padding: '0.5rem' }}>Side</th>
                        <th style={{ padding: '0.5rem' }}>Price</th>
                        <th style={{ padding: '0.5rem' }}>Qty</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>PnL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {realHistory.map((t: any, i: number) => {
                        const pnl = parseFloat(t.realizedPnl || 0);
                        return (
                          <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                            <td style={{ padding: '0.75rem 0.5rem', color: '#666' }}>{new Date(t.timestamp).toLocaleString()}</td>
                            <td style={{ padding: '0.75rem 0.5rem', fontWeight: 'bold' }}>{t.symbol}</td>
                            <td style={{ padding: '0.75rem 0.5rem', color: t.side === 'BUY' || t.side === 'LONG' ? '#0ecb81' : '#f6465d' }}>{t.side.toUpperCase()}</td>
                            <td style={{ padding: '0.75rem 0.5rem' }}>${parseFloat(t.price).toLocaleString()}</td>
                            <td style={{ padding: '0.75rem 0.5rem' }}>{parseFloat(t.amount || 0).toFixed(4)}</td>
                            <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', color: pnl > 0 ? '#0ecb81' : pnl < 0 ? '#f6465d' : '#888', fontWeight: 'bold' }}>
                               {pnl !== 0 ? (pnl > 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`) : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>

          {/* Right Sidebar: Governance & Risk */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
             <div className="glass-panel" style={{ padding: '1.25rem' }}>
                <h4 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Shield size={18} color={themeColor} /> Fleet Governance</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                   <div>
                      <div style={{ fontSize: '0.65rem', color: '#666', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Replacement Logic</div>
                      <div style={{ fontSize: '0.85rem' }}>Automatic trigger after <b>{currentFleet.config?.consecutiveSLLimit || 3} consecutive</b> SL hits.</div>
                   </div>
                   <div>
                      <div style={{ fontSize: '0.65rem', color: '#666', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Self-Evaluation Loop</div>
                      <div style={{ fontSize: '0.85rem' }}>Every <b>{currentFleet.config?.reviewIntervalHours || 1} hour(s)</b>, AI scans for performance gaps.</div>
                   </div>
                   <button onClick={() => handleForceReview(currentFleet.id)} disabled={reviewingFleet === currentFleet.id}  className="btn-outline" style={{ width: '100%', marginTop: '0.5rem', color: '#faad14' }}>
                     {reviewingFleet === currentFleet.id ? <RefreshCw size={14} className="spin" /> : <RefreshCw size={14} />} Force Instant Review
                   </button>
                </div>
             </div>

             <div className="glass-panel" style={{ padding: '1.25rem' }}>
               <h4 style={{ margin: '0 0 1rem 0' }}>Safety Controls</h4>
               <div style={{ background: 'rgba(246,70,93,0.05)', borderRadius: '8px', padding: '1rem' }}>
                  <div style={{ fontSize: '0.65rem', color: '#f6465d', fontWeight: 800, marginBottom: '0.5rem' }}>CIRCUIT BREAKER</div>
                  <div style={{ fontSize: '0.85rem', color: '#f6465d' }}>Auto-kill fleet if drawdown reaches {currentFleet.config?.maxDailyLossPct || 5}% daily.</div>
               </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
