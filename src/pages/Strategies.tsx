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
          <h2 className="m-0">Bot Lifecycle: การทำงานของระบบ</h2>
        </div>
        
        <div className="lifecycle-grid" style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '1rem',
          position: 'relative'
        }}>
          <LifecycleStep 
            index="01"
            icon={<Search size={28} color="#00d1ff" />}
            title="Scanning"
            desc="AI สแกนหาโอกาสในตลาดตามโหมดที่เลือก (Precision, Scout, หรือ Grid)"
            color="#00d1ff"
          />
          <LifecycleStep 
            index="02"
            icon={<Cpu size={28} color="#faad14" />}
            title="AI Reflection"
            desc="เมื่อ Indicator ให้สัญญาณ AI จะวิเคราะห์ความสมเหตุสมผลของตลาดก่อนเข้าเทรด"
            color="#faad14"
            isAI
          />
          <LifecycleStep 
            index="03"
            icon={<TrendingUp size={28} color="#0ecb81" />}
            title="Execution"
            desc="ยิงออเดอร์เข้า Binance Live Sim พร้อมคำนวณ Quantity และ Leverage อัตโนมัติ"
            color="#0ecb81"
          />
          <LifecycleStep 
            index="04"
            icon={<ShieldCheck size={28} color="#ff4d4f" />}
            title="Portfolio Shield"
            desc="เฝ้าระวัง drawdown แบบ Real-time หากขาดทุนเกินวงเงิน ระบบจะหยุดบอททันที"
            color="#ff4d4f"
          />
          <LifecycleStep 
            index="05"
            icon={<RefreshCcw size={28} color="#a855f7" />}
            title="AI Evolution"
            desc="AI รีวิวผลงานทุก 30 นาที เพื่อปรับเปลี่ยนกลยุทธ์ให้ชนะตลาดอยู่เสมอ"
            color="#a855f7"
            isAI
          />
        </div>
      </section>
      
      {/* 2.1 Technical Workflow Pipeline */}
      <section className="glass-panel" style={{ padding: '3rem', borderRadius: '24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(168,85,247,0.05) 0%, transparent 70%)', zIndex: 0 }} />
        
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '3rem', justifyContent: 'center' }}>
            <Layers size={24} color="var(--accent-primary)" />
            <h2 className="m-0" style={{ fontSize: '1.75rem' }}>Technical Workflow Pipeline</h2>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'center', alignItems: 'flex-start' }}>
            <WorkflowStep 
              title="Exchange Data Feed"
              tag="INGESTION"
              desc="BinanceAdapter ดึงข้อมูล Klines (1m - 1h) และ Real-time Tickers ทุก 5-30 วินาที"
              icon={<Activity size={24} />}
            />
            <div style={{ display: 'flex', alignItems: 'center', color: 'rgba(255,255,255,0.1)', padding: '1rem 0' }}><ArrowRight size={20} /></div>
            
            <WorkflowStep 
              title="Vector Signal Engine"
              tag="ANALYSIS"
              desc="คำนวณ Indicators (EMA, RSI, BB, Volume Flow) และสร้าง Trading Signals ขั้นต้น"
              icon={<Zap size={24} />}
            />
            <div style={{ display: 'flex', alignItems: 'center', color: 'rgba(255,255,255,0.1)', padding: '1rem 0' }}><ArrowRight size={20} /></div>

            <WorkflowStep 
              title="Cognitive Layer (AI)"
              tag="INTELLIGENCE"
              desc="OpenRouter (DeepSeek/Gemini) ทำการ Reflection วิเคราะห์ Context เพื่อลด False Signals"
              icon={<BrainCircuit size={24} />}
              isFeatured
            />
            <div style={{ display: 'flex', alignItems: 'center', color: 'rgba(255,255,255,0.1)', padding: '1rem 0' }}><ArrowRight size={20} /></div>

            <WorkflowStep 
              title="Execution & Persist"
              tag="ACTION"
              desc="บันทึกผลลง SQLite Database และยิงคำสั่งผ่าน Binance API พร้อมส่ง Log ไปที่ Telegram"
              icon={<RefreshCcw size={24} />}
            />
          </div>
        </div>
      </section>

      {/* 3. The 3 Pillars of Intelligence */}
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ width: '50px', height: '50px', background: 'rgba(0, 209, 255, 0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Layers size={28} color="#00d1ff" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>AI Portfolio Manager</h3>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
              เปรียบเสมือน "ผู้จัดการกองทุน" ที่คอยคุมภาพรวมของพอร์ตทุ่มเทในการค้นหาเหรียญที่มีความน่าจะเป็นสูง 
              และกระจายงบประมาณ (Budget Allocation) ไปยังบอทแต่ละตัวอย่างเหมาะสม เพื่อลดความเสี่ยงจากการเทรดเหรียญเดียว
            </p>
            <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              <li>บริหารจัดการ Active Bots ให้ตรงตามจำนวนที่ตั้งเป้าไว้</li>
              <li>ควบคุมระดับความเสี่ยง (Risk Modes) ได้หลากหลาย</li>
              <li>ระบบหยุดอัตโนมัติ (Global Stop Loss) ระดับพอร์ต</li>
            </ul>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', borderLeft: '4px solid #faad14' }}>
          <div style={{ width: '50px', height: '50px', background: 'rgba(250, 173, 20, 0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Target size={28} color="#faad14" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>AI Reflection Agent</h3>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
              เปรียบเสมือน "ที่ปรึกษาการเทรด" ที่คอยกลั่นกรองสัญญาณทางเทคนิค (Indicator Signals) 
              AI จะพิจารณา Volatility และ Market Structure เพื่อตรวจสอบว่าสัญญาณที่เกิดขึ้นนั้นเป็น "สัญญาณหลอก" (Fake-out) หรือไม่
            </p>
            <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              <li>ลดการเทรดในสภาวะตลาดไซด์เวย์ (Range-bound rejection)</li>
              <li>เพิ่ม Win Rate ด้วยการวิเคราะห์ Context ที่ตัวบ่งชี้มองไม่เห็น</li>
              <li>แสดงเหตุผลที่อนุมัติหรือปฏิเสธการเทรดเป็นภาษาไทย</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 4. Core Capabilities */}
      <section>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
           <h2 style={{ fontSize: '2rem' }}>เครื่องมือสำหรับเทรดเดอร์มือโปร</h2>
           <p className="text-muted">ครบครันทุกความต้องการ ตั้งแต่การทดสอบไปจนถึงการรันจริง</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
          <CapabilityCard 
            icon={<FlaskConical size={24} />}
            title="Strategic Backtest"
            desc="ทดสอบสมมติฐานด้วยข้อมูลย้อนหลังจริงจาก Binance ย้อนไปได้หลายร้อยแท่งเทียน"
            link="/backtest"
          />
          <CapabilityCard 
            icon={<Zap size={24} />}
            title="Binance Live Sim"
            desc="เทรดในสภาพตลาดจริงด้วย Testnet Wallet สัมผัสประสบการณ์ Live Trading โดยไม่มีความเสี่ยง"
            link="/binance-live"
          />
          <CapabilityCard 
            icon={<BarChart3 size={24} />}
            title="Real-time Analytics"
            desc="ติดตาม PnL, Win Rate และลอจิกการทำงานของ AI อย่างละเอียดผ่านหน้า Dashboard"
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
        <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>พร้อมเริ่มสร้างพอร์ตอัจฉริยะของคุณหรือยัง?</h2>
        <p className="text-muted" style={{ marginBottom: '2rem' }}>เปิดใช้งาน Auto-Pilot แล้วให้ AI ของเราจัดลำดับพอร์ตโฟลิโอให้คุณ</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <a href="/portfolio" className="btn-primary" style={{ padding: '0.75rem 2rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
             ไปที่ AI Portfolio <ArrowRight size={18} />
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
