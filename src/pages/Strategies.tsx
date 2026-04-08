import React, { useState } from 'react';
import {
  Cpu, ShieldCheck, TrendingUp, Zap, Search, BrainCircuit, BarChart3, Activity,
  ArrowRight, Target, RefreshCcw, Layers, FlaskConical, Clock, Database,
  GitBranch, AlertTriangle, CheckCircle, DollarSign, Eye, Settings, Bot
} from 'lucide-react';

// ─── Tab definitions ──────────────────────────────────────────────────────────
const TABS = [
  { id: 'overview', label: '🗺️ ภาพรวมระบบ' },
  { id: 'data', label: '📡 Data Reference' },
  { id: 'workflow', label: '🔄 Deep Workflow' },
];

export default function SystemOverview() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div style={{ maxWidth: '1300px', margin: '0 auto', paddingBottom: '4rem' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            background: 'transparent', border: 'none',
            borderBottom: activeTab === t.id ? '2px solid #faad14' : '2px solid transparent',
            color: activeTab === t.id ? '#faad14' : '#666',
            padding: '0.75rem 1.25rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold',
            transition: 'color 0.15s'
          }}>{t.label}</button>
        ))}
      </div>

      {activeTab === 'overview' && <OverviewTab />}
      {activeTab === 'data' && <DataReferenceTab />}
      {activeTab === 'workflow' && <DeepWorkflowTab />}
    </div>
  );
}

// ─── Tab 1: Overview (existing content) ──────────────────────────────────────
function OverviewTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
      <section style={{ textAlign: 'center', padding: '3rem 1rem', background: 'radial-gradient(circle at center, rgba(0,209,255,0.08) 0%, transparent 70%)', borderRadius: '24px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 1.25rem', background: 'rgba(0,209,255,0.1)', borderRadius: '100px', color: 'var(--accent-primary)', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '1.5rem', border: '1px solid rgba(0,209,255,0.2)' }}>
          <BrainCircuit size={16} /> NEXT-GEN AI TRADING ECOSYSTEM
        </div>
        <h1 style={{ fontSize: '3.5rem', margin: '0 0 1rem 0', fontWeight: 800, letterSpacing: '-1px' }}>
          Intelligence in <span style={{ background: 'linear-gradient(to right, #00d1ff, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Every Trade</span>.
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.25rem', maxWidth: '800px', margin: '0 auto', lineHeight: 1.6 }}>
          CryptoSmartTrade ผสมผสานเทคนิค Quant ระดับสูงเข้ากับ Generative AI เพื่อสร้างระบบเทรดอัตโนมัติที่คิด วิเคราะห์ และปกป้องเงินทุนของคุณอย่างชาญฉลาด
        </p>
      </section>

      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
          <Activity size={24} color="var(--accent-primary)" />
          <h2 style={{ margin: 0 }}>Autonomous Fleet Lifecycle</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
          <LifecycleStep index="01" icon={<Search size={28} color="#00d1ff" />} title="Market Scouting" desc="ยานแม่สแกน 40 เหรียญที่มี Volume สูงสุด คัดกรองเหรียญที่มีความผันผวนและเข้าเงื่อนไขเทรดเบื้องต้น" color="#00d1ff" />
          <LifecycleStep index="02" icon={<BarChart3 size={28} color="#faad14" />} title="Alpha Hunting" desc="ดึงข้อมูล Microstructure (OI Delta, Funding Rate) จากตลาดจริงมาวิเคราะห์ 'ความแรง' ของกองกำลังฝั่งนั้นๆ" color="#faad14" isAI />
          <LifecycleStep index="03" icon={<BrainCircuit size={28} color="#faad14" />} title="AI Reasoning" desc="AI (DeepSeek/Gemini) ประมวลผลข้อมูลระดับวินาที เพื่อให้เหตุผลและอนุมัติการเข้าเทรดเป็นภาษาไทย" color="#faad14" isAI />
          <LifecycleStep index="04" icon={<Layers size={28} color="#0ecb81" />} title="Layered Entry" desc="ยิงออเดอร์แบบลำดับไม้ (Grid/Scalp Layers) ลง Binance Live Sim เพื่อให้ได้ต้นทุนเฉลี่ยที่ได้เปรียบ" color="#0ecb81" />
        </div>
      </section>

      <section className="glass-panel" style={{ padding: '3rem', borderRadius: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '3rem', justifyContent: 'center' }}>
          <Cpu size={24} color="var(--accent-primary)" />
          <h2 style={{ margin: 0, fontSize: '1.75rem' }}>Multi-Fleet Orchestration Architecture</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '16px', borderLeft: '4px solid #00d1ff' }}>
            <h4 style={{ color: '#00d1ff', marginBottom: '1rem' }}>🚢 Fleet Management</h4>
            <p style={{ fontSize: '0.85rem', color: '#aaa', lineHeight: 1.6 }}>ระบบทำหน้าที่เป็นจอมทัพ (Commander) คุมกองยานแต่ละลำ แต่ละลำจะมีเป้าหมายและงบประมาณที่ AI จัดสรรให้ตามสภาวะตลาด</p>
          </div>
          <div style={{ background: 'rgba(250,173,20,0.05)', padding: '1.5rem', borderRadius: '16px', borderLeft: '4px solid #faad14' }}>
            <h4 style={{ color: '#faad14', marginBottom: '1rem' }}>🧠 Microstructure Alpha</h4>
            <p style={{ fontSize: '0.85rem', color: '#aaa', lineHeight: 1.6 }}>ใช้ข้อมูล Open Interest Delta เพื่อดูว่ามีการยัดเงินใหม่เข้ามาในตลาดหรือไม่ และใช้ Funding Rate เพื่อตรวจสอบสภาวะความได้เปรียบก่อนยิงออเดอร์</p>
          </div>
          <div style={{ background: 'rgba(14,203,129,0.05)', padding: '1.5rem', borderRadius: '16px', borderLeft: '4px solid #0ecb81' }}>
            <h4 style={{ color: '#0ecb81', marginBottom: '1rem' }}>🧹 Auto Sanitizer</h4>
            <p style={{ fontSize: '0.85rem', color: '#aaa', lineHeight: 1.6 }}>ระบบเฝ้าระวังตำแหน่งค้าง (Ghost Positions) หากพบบอทที่ไม่ระบุเจ้าของ ระบบจะทำการปิดตำแหน่งทันทีเพื่อความปลอดภัย</p>
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ width: '50px', height: '50px', background: 'rgba(0,209,255,0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Zap size={28} color="#00d1ff" /></div>
          <div>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>AI Portfolio Manager</h3>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>บริหารจัดการ "งบประมาณกองยาน" โดยใช้ปริมาณเงินรวมและอัตราความเสี่ยง (Risk Mode) มาเป็นตัวตั้งในการเปิดบอทแต่ละเหรียญ</p>
            <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              <li>กระจายเหรียญตามความร้อนแรง (Volume Flow Integration)</li>
              <li>ระบบหยุดอัตโนมัติ (Global Stop Loss) แบบ Real-time</li>
              <li>รองรับการเทรดหลาย Fleets พร้อมกันแยกข้ามเหรียญ</li>
            </ul>
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', borderLeft: '4px solid #faad14' }}>
          <div style={{ width: '50px', height: '50px', background: 'rgba(250,173,20,0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Target size={28} color="#faad14" /></div>
          <div>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>Microstructure Reflection</h3>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>วิเคราะห์ความลึกของตลาด (Market Depth) ผ่านการตรวจสอบ OI และ Funding Rate จริงจาก Binance Production</p>
            <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              <li>กรอง "สัญญาณหลอก" ด้วยการดู OI Flow (Money Flow)</li>
              <li>ตรวจสภาพความอิ่มตัวของฝั่ง Long/Short ด้วย Funding Rate</li>
              <li>แสดงเหตุผลที่ AI เลือกเล่นไม้ต้นทุนต่ำให้พอร์ต</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="glass-panel" style={{ padding: '3rem', textAlign: 'center', background: 'linear-gradient(to right, rgba(0,209,255,0.05), rgba(168,85,247,0.05))', border: '1px solid rgba(255,255,255,0.1)' }}>
        <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>พร้อมเริ่มรันกองยานอัจฉริยะแล้วหรือยัง?</h2>
        <p className="text-muted" style={{ marginBottom: '2rem' }}>กวดขันวินัยการเทรดด้วย AI Fleet Manager รุ่นล่าสุด</p>
        <a href="/portfolio" style={{ padding: '0.75rem 2rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'var(--accent-primary)', color: '#000', borderRadius: '8px', fontWeight: 'bold' }}>
          เปิดตารางงานกองยาน <ArrowRight size={18} />
        </a>
      </section>

      <style dangerouslySetInnerHTML={{ __html: `
        .lifecycle-step { transition: transform 0.3s ease; }
        .lifecycle-step:hover { transform: translateY(-5px); }
        .ai-pulse { position: relative; }
        .ai-pulse::after { content: 'AI'; position: absolute; top: -10px; right: -10px; background: #faad14; color: #000; font-size: 0.6rem; font-weight: bold; padding: 2px 6px; border-radius: 4px; box-shadow: 0 0 10px rgba(250,173,20,0.5); }
      `}} />
    </div>
  );
}

// ─── Tab 2: Data Reference ────────────────────────────────────────────────────
const DATA_FIELDS = [
  {
    group: 'Bot Card — Header',
    color: '#00d1ff',
    fields: [
      { name: 'Current Price', interval: '30 วิ', source: 'Binance API', method: 'คำนวณ', detail: 'getTickerPrice(symbol) — ดึงตรงจาก exchange ไม่มีการคำนวณ', impact: 'ใช้เป็น reference price สำหรับ TP/SL และ ROE' },
      { name: 'Strategy / Interval / Leverage', interval: 'Static', source: 'Bot Config', method: 'config', detail: 'ค่าที่ตั้งตอน launch bot ไม่เปลี่ยนระหว่าง session', impact: 'กำหนดว่า bot จะใช้ indicator ชุดไหน และ position size เท่าไร' },
      { name: 'Timer (elapsed / left)', interval: 'Real-time', source: 'bot.startedAt + durationMinutes', method: 'คำนวณ', detail: '(Date.now() - startedAt) / 60000 = elapsed, max(0, duration - elapsed) = remaining', impact: 'เมื่อ left = 0 bot จะหยุดอัตโนมัติ' },
    ]
  },
  {
    group: 'Bot Card — PNL Stats',
    color: '#0ecb81',
    fields: [
      { name: 'Net PNL', interval: '30 วิ', source: 'Backend syncBotStats()', method: 'คำนวณ', detail: 'unrealizedPnl + (grossProfit - grossLoss) จาก trades array', impact: 'ตัวเลขหลักที่บอกว่า bot กำไร/ขาดทุนรวม' },
      { name: 'Realized PNL', interval: '30 วิ', source: 'bot.trades array', method: 'คำนวณ', detail: 'รวม pnl ของทุก trade ที่ปิดแล้ว (exitPrice - entryPrice) × qty × leverage', impact: 'กำไรที่ lock ไว้แล้ว ไม่เปลี่ยนแปลงตามราคา' },
      { name: 'Unrealized PNL', interval: '30 วิ', source: 'Binance account positions', method: 'ดึงตรง', detail: 'p.unrealizedProfit จาก /api/binance/account — ตัวเลขจาก exchange โดยตรง', impact: 'เปลี่ยนทุกวินาทีตามราคาตลาด' },
      { name: 'Win Rate %', interval: '30 วิ', source: 'bot.trades array', method: 'คำนวณ', detail: '(winCount / totalTrades) × 100 — winCount = trades ที่ pnl >= 0', impact: 'ใช้ประเมินคุณภาพ signal ของ strategy' },
    ]
  },
  {
    group: 'Bot Card — Market Data',
    color: '#faad14',
    fields: [
      { name: 'Funding Rate', interval: '60 วิ (display) / on-demand (entry)', source: 'Binance Futures API', method: 'ดึงตรง', detail: 'getFundingRate(symbol) → lastFundingRate\n\n[Display] frontend poll ทุก 60 วิ\n[Pre-entry Filter] ดึงทันทีก่อนเปิด position:\n  - funding > +0.05% + LONG signal → BLOCK (Long squeeze risk)\n  - funding < -0.05% + SHORT signal → BLOCK (Short squeeze risk)\n  - threshold ปรับได้ผ่าน bot.config.fundingThreshold', impact: 'บวก = Long จ่าย Short (ตลาด overbought), ลบ = Short จ่าย Long (ตลาด oversold)\nใช้เป็น pre-entry gate ป้องกันการเปิด position ในทิศทางที่เสี่ยง squeeze' },
      { name: 'Open Interest (OI)', interval: '60 วิ (display) / on-demand (entry)', source: 'Binance Futures API', method: 'ดึงตรง', detail: 'getOpenInterest(symbol) → sumOpenInterest (display)\ngetOpenInterestStatistics(symbol, 15m, 3) → OI history 3 จุด (pre-entry)\n\n[Pre-entry Filter]:\n  - OI ลดลง > 10% ใน 15m → BLOCK ทุก direction (แรงหนุนอ่อน)\n  - OI เพิ่มขึ้น → CONFIRM (เงินใหม่เข้าตลาด ยืนยัน signal)\n  - ถ้า API ล้มเหลว → fail-open ไม่ block entry', impact: 'OI สูง + ราคาขึ้น = trend แข็งแกร่ง, OI ลด = position ถูกปิด\nใช้เป็น signal quality filter ก่อนเปิด position จริง' },
      { name: 'SIGNAL / currentThought', interval: '30 วิ', source: 'Technical Indicators', method: 'คำนวณ', detail: 'computeSignal() ใช้ RSI, EMA7/14, Bollinger Bands จาก OHLCV candles — ไม่ใช่ AI', impact: 'เป็น trigger หลักในการเปิด/ปิด position ทุก candle close' },
    ]
  },
  {
    group: 'Bot Card — AI Analysis',
    color: '#a855f7',
    fields: [
      { name: 'AI Reason (Deep Market Logic)', interval: 'ปรับได้ (default 30 นาที)', source: 'OpenRouter LLM (DeepSeek/Gemini)', method: 'AI คิด', detail: 'performAiBotReview() ส่ง context (price, RSI, OI, funding, trade history) ให้ LLM วิเคราะห์ — ได้กลับมาเป็น JSON { reason, tp, sl, leverage, strategy }', impact: 'ปรับ TP/SL/leverage ของ bot อัตโนมัติ และเขียน aiReason ที่เห็นในการ์ด' },
      { name: 'Reflection', interval: 'หลัง trade ขาดทุน', source: 'OpenRouter LLM', method: 'AI คิด', detail: 'triggerReflection() เรียกหลัง SL hit — AI วิเคราะห์ว่าทำไมถึงแพ้ และบันทึกบทเรียน', impact: 'ใช้ปรับ strategy ในรอบถัดไป ดูได้ใน Reflections tab' },
      { name: 'Auto Review Interval', interval: 'ตั้งค่าได้ (นาที)', source: 'bot.config.aiCheckInterval', method: 'config', detail: 'ค่า default 30 นาที ปรับได้ใน Trades tab ของการ์ด — ยิ่งถี่ยิ่งใช้ API token มาก', impact: 'กำหนดความถี่ที่ AI จะ re-evaluate สภาวะตลาดและปรับ config' },
    ]
  },
  {
    group: 'Positions Tab (Binance Sync)',
    color: '#1890ff',
    fields: [
      { name: 'ROE %', interval: '5 วิ (frontend poll)', source: 'Binance account positions', method: 'คำนวณ', detail: '(unrealizedProfit / marginValue) × 100 — marginValue = (|positionAmt| × entryPrice) / leverage', impact: 'Return on Equity — กำไร/ขาดทุนเทียบกับ margin ที่วางไว้จริง' },
      { name: 'Mark Price', interval: '5 วิ', source: 'Binance Futures API', method: 'ดึงตรง', detail: 'p.markPrice จาก position risk endpoint — ราคาที่ Binance ใช้คำนวณ liquidation', impact: 'ต่างจาก last price — ใช้ป้องกัน price manipulation' },
      { name: 'Unrealized PNL (USDT)', interval: '5 วิ', source: 'Binance account positions', method: 'ดึงตรง', detail: 'p.unrealizedProfit — คำนวณโดย Binance เอง ไม่ใช่ frontend', impact: 'ตัวเลขที่แม่นยำที่สุด ใช้เป็น source of truth' },
    ]
  },
];

function DataReferenceTab() {
  const [expandedField, setExpandedField] = useState<string | null>(null);
  const [filterMethod, setFilterMethod] = useState<'all' | 'คำนวณ' | 'ดึงตรง' | 'AI คิด' | 'config'>('all');

  const methodColor: Record<string, string> = {
    'คำนวณ': '#faad14',
    'ดึงตรง': '#00d1ff',
    'AI คิด': '#a855f7',
    'config': '#888',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Legend + filter */}
      <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.8rem', color: '#888', fontWeight: 'bold' }}>FILTER:</span>
        {(['all', 'คำนวณ', 'ดึงตรง', 'AI คิด', 'config'] as const).map(m => (
          <button key={m} onClick={() => setFilterMethod(m)} style={{
            background: filterMethod === m ? `${methodColor[m] || '#faad14'}22` : 'transparent',
            border: `1px solid ${filterMethod === m ? (methodColor[m] || '#faad14') : 'rgba(255,255,255,0.1)'}`,
            color: filterMethod === m ? (methodColor[m] || '#faad14') : '#888',
            padding: '0.3rem 0.8rem', borderRadius: '20px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 'bold'
          }}>
            {m === 'all' ? 'ทั้งหมด' : m}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          {Object.entries(methodColor).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: '#888' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: v, display: 'inline-block' }} />
              {k}
            </div>
          ))}
        </div>
      </div>

      {DATA_FIELDS.map(group => {
        const filtered = group.fields.filter(f => filterMethod === 'all' || f.method === filterMethod);
        if (filtered.length === 0) return null;
        return (
          <div key={group.group}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
              <div style={{ width: '4px', height: '20px', background: group.color, borderRadius: '2px' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: group.color, textTransform: 'uppercase', letterSpacing: '1px' }}>{group.group}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {filtered.map(f => {
                const key = `${group.group}-${f.name}`;
                const isOpen = expandedField === key;
                return (
                  <div key={f.name} className="glass-panel" style={{ overflow: 'hidden', borderLeft: `3px solid ${methodColor[f.method] || '#888'}` }}>
                    <div onClick={() => setExpandedField(isOpen ? null : key)} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 90px 24px', alignItems: 'center', gap: '1rem', padding: '0.75rem 1rem', cursor: 'pointer' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '0.88rem' }}>{f.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: '#888' }}>
                        <Clock size={11} /> {f.interval}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: '#888' }}>
                        <Database size={11} /> {f.source.split(' ')[0]}
                      </div>
                      <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: methodColor[f.method] || '#888', background: `${methodColor[f.method]}18`, padding: '0.2rem 0.5rem', borderRadius: '4px', textAlign: 'center' }}>
                        {f.method}
                      </span>
                      <span style={{ color: '#555', fontSize: '0.8rem' }}>{isOpen ? '▲' : '▼'}</span>
                    </div>
                    {isOpen && (
                      <div style={{ padding: '0 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ paddingTop: '0.75rem' }}>
                          <div style={{ fontSize: '0.65rem', color: '#555', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.3rem' }}>วิธีได้ค่า</div>
                          <div style={{ fontSize: '0.82rem', color: '#ccc', lineHeight: 1.6, fontFamily: 'monospace', background: 'rgba(0,0,0,0.2)', padding: '0.6rem 0.8rem', borderRadius: '6px' }}>{f.detail}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.65rem', color: '#555', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.3rem' }}>ผลกระทบต่อระบบ</div>
                          <div style={{ fontSize: '0.82rem', color: '#aaa', lineHeight: 1.6 }}>{f.impact}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.72rem' }}>
                          <span style={{ color: '#555' }}>Source:</span>
                          <span style={{ color: '#888' }}>{f.source}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Tab 3: Deep Workflow ─────────────────────────────────────────────────────
const WORKFLOW_STEPS = [
  {
    phase: 'PHASE 1 — SETUP',
    color: '#00d1ff',
    steps: [
      {
        id: 'fleet-create',
        icon: '🚀',
        title: 'สร้าง Fleet',
        who: 'User',
        trigger: 'กด "Create Fleet" ใน Portfolio',
        params: ['ชื่อ Fleet', 'Budget รวม (USDT)', 'Risk Mode (conservative/moderate/aggressive)', 'Strategy type'],
        what: 'ระบบสร้าง fleet object ใน DB พร้อม id, budget, และ config เริ่มต้น',
        output: 'fleet.id ที่ใช้ผูกกับ bot ทุกตัวใน fleet นี้',
        dataFlow: 'POST /api/portfolio/fleets → fleetRepository.create()',
      },
      {
        id: 'api-config',
        icon: '🔑',
        title: 'ตั้งค่า Binance API',
        who: 'User',
        trigger: 'กรอก API Key/Secret ใน Config page',
        params: ['Binance API Key', 'Binance Secret', 'OpenRouter API Key', 'AI Model (deepseek/gemini)'],
        what: 'เก็บ key ใน .env หรือ DB — ใช้สำหรับ sign request ทุกครั้งที่ส่งออเดอร์',
        output: 'binanceKeys object ที่ frontend ดึงมาแสดงสถานะ',
        dataFlow: 'POST /api/config/keys → configRepository.save()',
      },
    ]
  },
  {
    phase: 'PHASE 2 — BOT LAUNCH',
    color: '#faad14',
    steps: [
      {
        id: 'ai-scout',
        icon: '🔍',
        title: 'AI Scouting (ถ้าใช้ Auto-Pilot)',
        who: 'System (AI)',
        trigger: 'กด AUTO-PILOT ใน Fleet header',
        params: ['จำนวน bot ที่ต้องการ', 'budget per bot', 'strategy preference', 'strategyType (grid/scalp/trend)'],
        what: [
          '1. MarketScanner.scanTopUSDT() — กรองเหรียญตาม mode (grid=|change|<5%, scout=momentum สูง)',
          '2. ถ้าระบุ strategyType → assessSuitability() คำนวณ ADX + BB Width ของ top-40 เหรียญ',
          '   - grid: ADX < 25, BBWidth < 5% → sideway score',
          '   - scalp: BBWidth > 3%, priceChange > 2% → volatile score',
          '   - trend: ADX > 25, BBWidth > 4% → trending score',
          '3. เรียง suitable coins ขึ้นมาก่อน ส่งพร้อม regime data ให้ HunterAgent',
          '4. HunterAgent ส่ง OI + Funding + ADX + BBWidth ให้ AI เลือก top 5',
        ].join('\n'),
        output: 'รายการ symbol พร้อม recommended strategy, leverage, TP%, SL%, เหตุผลภาษาไทยที่ระบุ regime + OI',
        dataFlow: 'MarketScanner.scan() → assessSuitability() → HunterAgent → OpenRouterClient → POST /api/forward-test/start',
      },
      {
        id: 'bot-launch',
        icon: '🤖',
        title: 'Launch Bot',
        who: 'User หรือ Auto-Pilot',
        trigger: 'กด Launch / Auto-Pilot approve',
        params: ['symbol', 'strategy (AI_SCOUTER/AI_GRID_SCALP/AI_GRID_SWING)', 'interval (5m/15m/1h)', 'leverage', 'TP%', 'SL%', 'positionSizeUSDT', 'durationMinutes', 'aiCheckInterval'],
        what: 'สร้าง bot object ใน memory + DB, เริ่ม binanceTick loop ทุก 30 วิ',
        output: 'bot.id, bot.isRunning = true, เริ่ม polling',
        dataFlow: 'POST /api/forward-test/start → botService.startBot() → setInterval(binanceTick, 30000)',
      },
    ]
  },
  {
    phase: 'PHASE 3 — BOT RUNNING (ทุก 30 วิ)',
    color: '#0ecb81',
    steps: [
      {
        id: 'tick-price',
        icon: '📊',
        title: 'Fetch Price + Candles',
        who: 'System',
        trigger: 'binanceTick() ทุก 30 วิ',
        params: ['symbol', 'interval'],
        what: 'ดึง OHLCV candles ล่าสุด + ticker price จาก Binance',
        output: 'currPrice, candles array สำหรับคำนวณ indicator',
        dataFlow: 'binanceService.getOHLCV() + getTickerPrice() → bot.currentPrice',
      },
      {
        id: 'compute-signal',
        icon: '⚡',
        title: 'Compute Signal',
        who: 'System (Technical)',
        trigger: 'หลัง fetch candles',
        params: ['strategy type', 'candles', 'RSI period', 'EMA periods'],
        what: 'คำนวณ RSI, EMA7/14, Bollinger Bands → ตัดสิน LONG/SHORT/NONE ตาม strategy rules',
        output: 'signal = "LONG" | "SHORT" | "NONE", currentThought (ข้อความอธิบาย)',
        dataFlow: 'computeSignal(candles, strategy) → bot.currentThought',
      },
      {
        id: 'microstructure-filter',
        icon: '🔬',
        title: 'Microstructure Filter (OI + Funding)',
        who: 'System',
        trigger: 'เฉพาะเมื่อ signal = LONG หรือ SHORT และยังไม่มี position เปิดอยู่',
        params: ['signal direction', 'Funding Rate (Binance)', 'OI history 15m x3 (Binance)', 'fundingThreshold (default 0.05%)'],
        what: [
          '1. ดึง Funding Rate + OI history แบบ parallel (on-demand ไม่กระทบ tick ปกติ)',
          '2. ตรวจ Funding Rate: LONG + funding > +0.05% → BLOCK (Long squeeze risk)',
          '3. ตรวจ Funding Rate: SHORT + funding < -0.05% → BLOCK (Short squeeze risk)',
          '4. ตรวจ OI trend: OI ลดลง > 10% ใน 15m → BLOCK ทุก direction (signal อ่อน)',
          '5. OI เพิ่มขึ้น → CONFIRM (เงินใหม่เข้าตลาด ยืนยัน signal)',
          '6. ถ้า API ล้มเหลว → fail-open (ไม่ block entry)',
        ].join('\n'),
        output: '{ pass: bool, reason: string } — ถ้า pass=false จะแสดงใน currentThought เป็น "⚠️ [Microstructure Block] ..." และข้ามการเปิด position รอบนี้',
        dataFlow: '_checkMicrostructure() → getFundingRate() + getOpenInterestStatistics(15m,3) → pass/block → bot.currentThought',
      },
      {
        id: 'candle-close',
        icon: '🕯️',
        title: 'Execute on Candle Close',
        who: 'System',
        trigger: 'เมื่อ lastCloseTime เปลี่ยน (candle ใหม่ปิด) และ Microstructure Filter ผ่าน',
        params: ['signal', 'openPositions', 'currPrice'],
        what: '1) ถ้ามี position เปิดอยู่และ signal flip → closePosition() 2) ถ้าไม่มี position และ signal ≠ NONE → openPosition()',
        output: 'trade record ใน bot.trades, position ใน bot.openPositions',
        dataFlow: 'openPosition() / closePosition() → Binance createOrder() → tradeRepository.save()',
      },
      {
        id: 'tp-sl-check',
        icon: '🛡️',
        title: 'TP/SL Check',
        who: 'System',
        trigger: 'ทุก tick (ไม่รอ candle close)',
        params: ['currPrice', 'entryPrice', 'tpPercent', 'slPercent', 'leverage'],
        what: 'เช็คว่าราคาถึง TP หรือ SL แล้วหรือยัง ถ้าใช่ → closePosition()',
        output: 'trade ปิด, PNL บันทึก, bot.realizedPnl อัพเดท',
        dataFlow: 'checkTPSL() → closePosition() → syncBotStats()',
      },
      {
        id: 'ai-review',
        icon: '🧠',
        title: 'AI Review (ตาม interval)',
        who: 'System (AI)',
        trigger: 'ทุก aiCheckInterval นาที (default 30 นาที)',
        params: ['price', 'RSI', 'OI', 'fundingRate', 'trade history', 'current config'],
        what: 'ส่ง context ทั้งหมดให้ LLM วิเคราะห์ → ได้ JSON กลับมา → อัพเดท bot config ถ้า AI แนะนำ',
        output: 'bot.aiReason (ข้อความ), อาจปรับ TP/SL/leverage/strategy',
        dataFlow: 'performAiBotReview() → OpenRouter API → bot.config update → DB save',
      },
      {
        id: 'sync-stats',
        icon: '🔄',
        title: 'Sync Stats',
        who: 'System',
        trigger: 'หลังทุก trade และทุก tick',
        params: ['trades array', 'openPositions', 'Binance account positions'],
        what: 'คำนวณ netPnl, realizedPnl, unrealizedPnl, winRate, winCount ใหม่ทั้งหมด',
        output: 'bot stats อัพเดท → frontend poll ทุก 5 วิ ดึงค่าใหม่',
        dataFlow: 'syncBotStats() → bot object update → GET /api/forward-test/status',
      },
    ]
  },
  {
    phase: 'PHASE 4 — PROFIT / EXIT',
    color: '#a855f7',
    steps: [
      {
        id: 'tp-hit',
        icon: '💰',
        title: 'Take Profit Hit',
        who: 'System',
        trigger: 'currPrice ≥ entryPrice × (1 + tpPercent/100) สำหรับ LONG',
        params: ['entryPrice', 'tpPercent', 'quantity', 'leverage'],
        what: 'ปิด position ที่ Binance, คำนวณ PNL จริง, บันทึก trade ด้วย reason = "TP Hit"',
        output: 'realizedPnl เพิ่มขึ้น, trade record ใน history',
        dataFlow: 'closePosition(reason="TP Hit") → Binance closeOrder() → tradeRepository.save()',
      },
      {
        id: 'reflection',
        icon: '🪞',
        title: 'Reflection (หลัง SL)',
        who: 'System (AI)',
        trigger: 'หลัง SL hit เท่านั้น',
        params: ['trade ที่ขาดทุน', 'market context ตอนนั้น', 'AI reason เดิม'],
        what: 'AI วิเคราะห์ว่าทำไมถึงแพ้ บันทึกบทเรียน และอาจปรับ strategy ให้ conservative ขึ้น',
        output: 'reflectionHistory entry, อาจปรับ config',
        dataFlow: 'triggerReflection() → OpenRouter API → reflectionRepository.save()',
      },
      {
        id: 'bot-expire',
        icon: '⏰',
        title: 'Bot หมดเวลา / Stop',
        who: 'System หรือ User',
        trigger: 'elapsed >= durationMinutes หรือกด Stop',
        params: ['durationMinutes', 'openPositions'],
        what: 'ปิด position ที่ค้างอยู่ทั้งหมด, set isRunning = false, บันทึก final stats',
        output: 'bot.isRunning = false, final PNL บันทึกใน DB',
        dataFlow: 'stopBot() → closeAllPositions() → botRepository.save()',
      },
    ]
  },
];

function DeepWorkflowTab() {
  const [expandedStep, setExpandedStep] = useState<string | null>('bot-launch');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
      <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', background: 'rgba(250,173,20,0.05)', border: '1px solid rgba(250,173,20,0.15)' }}>
        <div style={{ fontSize: '0.75rem', color: '#faad14', fontWeight: 'bold', marginBottom: '0.4rem' }}>📖 วิธีอ่าน Workflow นี้</div>
        <div style={{ fontSize: '0.82rem', color: '#aaa', lineHeight: 1.6 }}>
          แต่ละ step แสดง: ใครเป็นคนทำ (Who), อะไร trigger, parameters ที่เกี่ยวข้อง, ผลลัพธ์, และ data flow ในระบบ — กด step เพื่อดูรายละเอียด
        </div>
      </div>

      {WORKFLOW_STEPS.map(phase => (
        <div key={phase.phase}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ height: '2px', flex: 1, background: `linear-gradient(to right, ${phase.color}, transparent)` }} />
            <span style={{ fontSize: '0.72rem', fontWeight: 'bold', color: phase.color, letterSpacing: '1.5px', whiteSpace: 'nowrap' }}>{phase.phase}</span>
            <div style={{ height: '2px', flex: 1, background: `linear-gradient(to left, ${phase.color}, transparent)` }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {phase.steps.map((step, idx) => {
              const isOpen = expandedStep === step.id;
              return (
                <div key={step.id} style={{ display: 'flex', gap: '0' }}>
                  {/* Timeline line */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginRight: '1rem', flexShrink: 0 }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: isOpen ? phase.color : 'rgba(255,255,255,0.05)', border: `2px solid ${phase.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', transition: 'background 0.2s', flexShrink: 0 }}>
                      {step.icon}
                    </div>
                    {idx < phase.steps.length - 1 && (
                      <div style={{ width: '2px', flex: 1, minHeight: '20px', background: `${phase.color}33`, marginTop: '4px' }} />
                    )}
                  </div>

                  {/* Card */}
                  <div className="glass-panel" style={{ flex: 1, overflow: 'hidden', marginBottom: idx < phase.steps.length - 1 ? '0.5rem' : 0, borderLeft: `3px solid ${isOpen ? phase.color : 'rgba(255,255,255,0.05)'}`, transition: 'border-color 0.2s' }}>
                    <div onClick={() => setExpandedStep(isOpen ? null : step.id)} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 1rem', cursor: 'pointer' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{step.title}</div>
                        <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '0.1rem' }}>Trigger: {step.trigger}</div>
                      </div>
                      <span style={{ fontSize: '0.7rem', color: step.who.includes('AI') ? '#a855f7' : step.who === 'User' ? '#faad14' : '#00d1ff', background: step.who.includes('AI') ? 'rgba(168,85,247,0.1)' : step.who === 'User' ? 'rgba(250,173,20,0.1)' : 'rgba(0,209,255,0.1)', padding: '0.2rem 0.6rem', borderRadius: '4px', fontWeight: 'bold', flexShrink: 0 }}>
                        {step.who}
                      </span>
                      <span style={{ color: '#555', fontSize: '0.8rem' }}>{isOpen ? '▲' : '▼'}</span>
                    </div>

                    {isOpen && (
                      <div style={{ padding: '0 1rem 1rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ paddingTop: '0.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                          <div>
                            <div style={{ fontSize: '0.65rem', color: '#555', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.4rem' }}>Parameters ที่เกี่ยวข้อง</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                              {step.params.map(p => (
                                <span key={p} style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', padding: '0.15rem 0.5rem', borderRadius: '4px', color: '#ccc' }}>{p}</span>
                              ))}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.65rem', color: '#555', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.4rem' }}>Output</div>
                            <div style={{ fontSize: '0.8rem', color: '#0ecb81', lineHeight: 1.5 }}>{step.output}</div>
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.65rem', color: '#555', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.4rem' }}>สิ่งที่เกิดขึ้น</div>
                          <div style={{ fontSize: '0.82rem', color: '#ccc', lineHeight: 1.6 }}>{step.what}</div>
                        </div>
                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.6rem 0.8rem', borderRadius: '6px', fontFamily: 'monospace', fontSize: '0.75rem', color: '#888' }}>
                          <span style={{ color: '#555' }}>DATA FLOW: </span>{step.dataFlow}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────
function LifecycleStep({ index, icon, title, desc, color, isAI }: any) {
  return (
    <div className="lifecycle-step glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: `4px solid ${color}`, background: isAI ? 'rgba(250,173,20,0.03)' : 'rgba(255,255,255,0.02)' }}>
      <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)', letterSpacing: '2px' }}>{index}</div>
      <div className={isAI ? 'ai-pulse' : ''} style={{ width: 'fit-content' }}>{icon}</div>
      <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{title}</h4>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>{desc}</p>
    </div>
  );
}
