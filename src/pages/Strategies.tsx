import React from 'react';
import { 
  Cpu, 
  ShieldCheck, 
  TrendingUp, 
  Zap, 
  Search, 
  BrainCircuit, 
  BarChart3, 
  Activity,
  ArrowRight,
  Target,
  RefreshCcw,
  Layers,
  FlaskConical
} from 'lucide-react';

export default function SystemOverview() {
  return (
    <div className="system-overview-container" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '3rem', 
      paddingBottom: '4rem',
      maxWidth: '1300px',
      margin: '0 auto' 
    }}>
      
      {/* 1. Hero Section */}
      <section className="overview-hero" style={{ 
        textAlign: 'center', 
        padding: '3rem 1rem',
        background: 'radial-gradient(circle at center, rgba(0, 209, 255, 0.08) 0%, transparent 70%)',
        borderRadius: '24px'
      }}>
        <div style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          gap: '0.75rem', 
          padding: '0.5rem 1.25rem', 
          background: 'rgba(0, 209, 255, 0.1)', 
          borderRadius: '100px',
          color: 'var(--accent-primary)',
          fontSize: '0.85rem',
          fontWeight: 'bold',
          marginBottom: '1.5rem',
          border: '1px solid rgba(0, 209, 255, 0.2)'
        }}>
          <BrainCircuit size={16} /> NEXT-GEN AI TRADING ECOSYSTEM
        </div>
        <h1 style={{ fontSize: '3.5rem', margin: '0 0 1rem 0', fontWeight: 800, letterSpacing: '-1px' }}>
          Intelligence in <span className="text-gradient">Every Trade</span>.
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.25rem', maxWidth: '800px', margin: '0 auto', lineHeight: 1.6 }}>
          CryptoSmartTrade ผสมผสานเทคนิค Quant ระดับสูงเข้ากับ Generative AI เพื่อสร้างระบบเทรดอัตโนมัติที่คิด วิเคราะห์ และปกป้องเงินทุนของคุณอย่างชาญฉลาด
        </p>
      </section>

      {/* 2. System Lifecycle Visualizer */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
          <Activity size={24} color="var(--accent-primary)" />
          <h2 className="m-0">Autonomous Fleet Lifecycle: ตั้งแต่เลือกกองยานจนเข้าออเดอร์</h2>
        </div>
        
        <div className="lifecycle-grid" style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
          gap: '1.25rem',
          position: 'relative'
        }}>
          <LifecycleStep 
            index="01"
            icon={<Search size={28} color="#00d1ff" />}
            title="Market Scouting"
            desc="ยานแม่สแกน 40 เหรียญที่มี Volume สูงสุด คัดกรองเหรียญที่มีความผันผวนและเข้าเงื่อนไขเทรดเบื้องต้น"
            color="#00d1ff"
          />
          <LifecycleStep 
            index="02"
            icon={<BarChart3 size={28} color="#faad14" />}
            title="Alpha Hunting"
            desc="ดึงข้อมูล Microstructure (OI Delta, Funding Rate) จากตลาดจริงมาวิเคราะห์ 'ความแรง' ของกองกำลังฝั่งนั้นๆ"
            color="#faad14"
            isAI
          />
          <LifecycleStep 
            index="03"
            icon={<BrainCircuit size={28} color="#faad14" />}
            title="AI Reasoning"
            desc="AI (DeepSeek/Gemini) ประมวลผลข้อมูลระดับวินาที เพื่อให้เหตุผลและอนุมัติการเข้าเทรดเป็นภาษาไทย"
            color="#faad14"
            isAI
          />
          <LifecycleStep 
            index="04"
            icon={<Layers size={28} color="#0ecb81" />}
            title="Layered Entry"
            desc="ยิงออเดอร์แบบลำดับไม้ (Grid/Scalp Layers) ลง Binance Live Sim เพื่อให้ได้ต้นทุนเฉลี่ยที่ได้เปรียบ"
            color="#0ecb81"
          />
        </div>
      </section>
      
      {/* 2.1 Technical Workflow Pipeline */}
      <section className="glass-panel" style={{ padding: '3rem', borderRadius: '24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(168,85,247,0.05) 0%, transparent 70%)', zIndex: 0 }} />
        
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '3rem', justifyContent: 'center' }}>
            <Cpu size={24} color="var(--accent-primary)" />
            <h2 className="m-0" style={{ fontSize: '1.75rem' }}>Multi-Fleet Orchestration Architecture (Phase 2)</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
             <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '16px', borderLeft: '4px solid #00d1ff' }}>
                <h4 style={{ color: '#00d1ff', marginBottom: '1rem' }}>🚢 Fleet Management</h4>
                <p style={{ fontSize: '0.85rem', color: '#aaa', lineHeight: 1.6 }}>
                  ระบบทำหน้าที่เป็นจอมทัพ (Commander) คุมกองยานแต่ละลำ (เช่น AI Scouter, AI Grid) แยกจากกัน 
                  แต่ละลำจะมีเป้าหมายและงบประมาณ (Budget) ที่ AI จัดสรรให้ตามสภาวะตลาด
                </p>
             </div>
             <div style={{ background: 'rgba(250,173,20,0.05)', padding: '1.5rem', borderRadius: '16px', borderLeft: '4px solid #faad14' }}>
                <h4 style={{ color: '#faad14', marginBottom: '1rem' }}>🧠 Microstructure Alpha</h4>
                <p style={{ fontSize: '0.85rem', color: '#aaa', lineHeight: 1.6 }}>
                   ใช้ข้อมูล <b>Open Interest Delta</b> เพื่อดูว่ามีการยัดเงินใหม่เข้ามาในตลาดหรือไม่ และใช้ <b>Funding Rate</b> 
                   เพื่อตรวจสอบสภาวะความได้เปรียบ-เสียเปรียบของค่าธรรมเนียมก่อนยิงออเดอร์
                </p>
             </div>
             <div style={{ background: 'rgba(14,203,129,0.05)', padding: '1.5rem', borderRadius: '16px', borderLeft: '4px solid #0ecb81' }}>
                <h4 style={{ color: '#0ecb81', marginBottom: '1rem' }}>🧹 Auto Sanitizer</h4>
                <p style={{ fontSize: '0.85rem', color: '#aaa', lineHeight: 1.6 }}>
                   ระบบเฝ้าระวังตำแหน่งค้าง (Ghost Positions) หากพบบอทที่ไม่ระบุเจ้าของหรือกำพร้า 
                   ระบบจะทำการปิดตำแหน่งทันทีเพื่อความปลอดภัยในทรัพย์สินระดับพอร์ต
                </p>
             </div>
          </div>
        </div>
      </section>

      {/* 3. The 3 Pillars of Intelligence */}
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ width: '50px', height: '50px', background: 'rgba(0, 209, 255, 0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={28} color="#00d1ff" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>AI Portfolio Manager</h3>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
               บริหารจัดการ "งบประมาณกองยาน" โดยใช้ปริมาณเงินรวมและอัตราความเสี่ยง (Risk Mode) มาเป็นตัวตั้งในการเปิดบอทแต่ละเหรียญ
            </p>
            <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              <li>กระจายเหรียญตามความร้อนแรง (Volume Flow Integration)</li>
              <li>ระบบหยุดอัตโนมัติ (Global Stop Loss) แบบ Real-time</li>
              <li>รองรับการเทรดหลาย Fleets พร้อมกันแยกข้ามเหรียญ</li>
            </ul>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', borderLeft: '4px solid #faad14' }}>
          <div style={{ width: '50px', height: '50px', background: 'rgba(250, 173, 20, 0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Target size={28} color="#faad14" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>Microstructure Reflection</h3>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
               วิเคราะห์ความลึกของตลาด (Market Depth) ผ่านการตรวจสอบ OI และ Funding Rate จริงจาก Binance Production เพื่อหาจุดได้เปรียบทางเชิงปริมาณ (Quantitative Edge)
            </p>
            <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              <li>กรอง "สัญญาณหลอก" ด้วยการดู OI Flow (Money Flow)</li>
              <li>ตรวจสภาพความอิ่มตัวของฝั่ง Long/Short ด้วย Funding Rate</li>
              <li>แสดงเหตุผลที่ AI เลือกเล่นไม้ต้นทุนต่ำให้พอร์ต</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 4. Core Capabilities */}
      <section>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
           <h2 style={{ fontSize: '2rem' }}>เครื่องมือวิเคราะห์กองยาน</h2>
           <p className="text-muted">ครบเครื่องเรื่องการเฝ้าระวังและการตัดสินใจเชิง AI</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
          <CapabilityCard 
            icon={<Layers size={24} />}
            title="Fleet Control"
            desc="ดูภาพรวมการบริหารพอร์ตและกำไรรายกองยานผ่านหน้าจอ Portfolio หลัก"
            link="/portfolio"
          />
          <CapabilityCard 
            icon={<Zap size={24} />}
            title="Binance Live Sim"
            desc="เทรดในสภาพตลาดจริงพร้อมป้ายกำกับกองยาน (Fleet Tags) แยกระหว่าง AI กับคน"
            link="/binance-live"
          />
          <CapabilityCard 
            icon={<Activity size={24} />}
            title="Microstructure Logs"
            desc="ติดตามความเคลื่อนไหวของ OI และ Funding Rate ที่บอทนำมาใช้คิดวิเคราะห์"
            link="/portfolio"
          />
        </div>
      </section>

      {/* 5. CTA Section */}
      <section className="glass-panel" style={{ 
        padding: '3rem', 
        textAlign: 'center', 
        background: 'linear-gradient(to right, rgba(0,209,255,0.05), rgba(168,85,247,0.05))',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>พร้อมเริ่มรันกองยานอัจฉริยะแล้วหรือยัง?</h2>
        <p className="text-muted" style={{ marginBottom: '2rem' }}>กวดขันวินัยการเทรดด้วย AI Fleet Manager รุ่นล่าสุด</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <a href="/portfolio" className="btn-primary" style={{ padding: '0.75rem 2rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
             เปิดตารางงานกองยาน <ArrowRight size={18} />
          </a>
        </div>
      </section>

      <style dangerouslySetInnerHTML={{ __html: `
        .text-gradient {
          background: linear-gradient(to right, #00d1ff, #a855f7);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .lifecycle-step {
          transition: transform 0.3s ease, border-color 0.3s ease;
        }
        .lifecycle-step:hover {
          transform: translateY(-5px);
          border-color: rgba(255,255,255,0.3) !important;
        }
        .ai-pulse {
          position: relative;
        }
        .ai-pulse::after {
          content: 'AI';
          position: absolute;
          top: -10px;
          right: -10px;
          background: #faad14;
          color: #000;
          font-size: 0.6rem;
          font-weight: bold;
          padding: 2px 6px;
          border-radius: 4px;
          box-shadow: 0 0 10px rgba(250, 173, 20, 0.5);
        }
      `}} />
    </div>
  );
}

function LifecycleStep({ index, icon, title, desc, color, isAI }: any) {
  return (
    <div className="lifecycle-step glass-panel" style={{ 
      padding: '1.5rem', 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '1rem',
      borderTop: `4px solid ${color}`,
      background: isAI ? 'rgba(250, 173, 20, 0.03)' : 'rgba(255,255,255,0.02)'
    }}>
      <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)', letterSpacing: '2px' }}>{index}</div>
      <div className={isAI ? 'ai-pulse' : ''} style={{ width: 'fit-content' }}>
        {icon}
      </div>
      <h4 className="m-0" style={{ fontSize: '1.1rem' }}>{title}</h4>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>{desc}</p>
    </div>
  );
}

function WorkflowStep({ title, tag, desc, icon, isFeatured }: any) {
  return (
    <div style={{ 
      flex: '1', 
      minWidth: '240px', 
      background: isFeatured ? 'rgba(250, 173, 20, 0.05)' : 'rgba(255,255,255,0.03)',
      border: isFeatured ? '1px solid rgba(250, 173, 20, 0.2)' : '1px solid rgba(255,255,255,0.05)',
      padding: '2rem',
      borderRadius: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem'
    }}>
      <div style={{ 
        fontSize: '0.65rem', 
        fontWeight: 'bold', 
        color: isFeatured ? '#faad14' : 'var(--accent-primary)', 
        letterSpacing: '1.5px',
        opacity: 0.8
      }}>
        {tag}
      </div>
      <div style={{ color: isFeatured ? '#faad14' : 'var(--text-bright)' }}>{icon}</div>
      <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{title}</h4>
      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>{desc}</p>
    </div>
  );
}

function CapabilityCard({ icon, title, desc, link }: any) {
  return (
    <a href={link} className="glass-panel hover-card" style={{ 
      textDecoration: 'none', 
      padding: '2rem', 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '1rem',
      color: 'inherit',
      textAlign: 'left'
    }}>
      <div style={{ color: 'var(--accent-primary)' }}>{icon}</div>
      <h4 className="m-0" style={{ fontSize: '1.2rem' }}>{title}</h4>
      <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>{desc}</p>
      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-primary)', fontSize: '0.85rem', fontWeight: 'bold' }}>
        EXPLORE <ArrowRight size={14} />
      </div>
    </a>
  );
}
