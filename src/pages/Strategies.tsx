import React from 'react';
import { BookOpen, TrendingUp, Activity, AlertTriangle, CheckCircle, Clock, Grid } from 'lucide-react';

export default function Strategies() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem',  height: 'calc(100vh - 80px)', overflowY: 'auto', paddingRight: '0.5rem' }}>
      <div className="glass-panel" style={{ borderLeft: '4px solid var(--accent-primary)' }}>
        <h2 className="m-0" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
           <BookOpen size={24} color="var(--accent-primary)" /> 
           เอกสารกลยุทธ์การเทรด (Trading Strategies)
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: 0, lineHeight: 1.6 }}>
           สำรวจกลยุทธ์การเทรดแบบอัลกอริทึมที่มาพร้อมกับเครื่องมือของ CryptoSmartTrade 
           คุณสามารถทดลองใช้งานกลยุทธ์เหล่านี้ได้ในหน้า <strong>ระบบทดสอบกลยุทธ์ (Backtest)</strong> โดยใช้ข้อมูลย้อนหลังจริงจาก Binance เพื่อประเมินประสิทธิภาพก่อนนำไปรันจริง (Forward Test)
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
        {/* EMA Crossover Card */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
           <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
             <div>
               <h3 className="m-0" style={{ fontSize: '1.25rem', color: 'var(--text-main)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                 <TrendingUp size={20} color="var(--profit-color)" /> EMA Crossover (20/50)
               </h3>
               <span style={{ fontSize: '0.8rem', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-primary)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>Trend Following (ตามเทรนด์)</span>
             </div>
             <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ความซับซ้อน</div>
                <div style={{ fontWeight: 'bold', color: 'var(--profit-color)' }}>มือใหม่</div>
             </div>
           </div>

           <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>
             กลยุทธ์ยอดนิยมสำหรับสายเทรดตามเทรนด์ โดยใช้เส้นค่าเฉลี่ยเคลื่อนที่แบบเอ็กซ์โพเนนเชียล (EMA) สองเส้นเพื่อระบุการเปลี่ยนทิศทางของโมเมนตัมตลาด ซึ่งเส้น EMA จะให้น้ำหนักกับราคาล่าสุดมากกว่าเส้นค่าเฉลี่ยแบบปกติ (SMA) ทำให้ตอบสนองต่อราคาได้รวดเร็วกว่า
           </p>

           <div style={{ background: 'var(--bg-dark)', padding: '1rem', borderRadius: '6px' }}>
              <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', color: 'var(--text-main)' }}>ตรรกะการเทรด (Trading Logic)</h4>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--text-muted)', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                 <li><strong style={{ color: 'var(--profit-color)' }}>LONG (ซื้อ):</strong> เกิดขึ้นเมื่อเส้น EMA เร็ว (20) ตัด *ขึ้น* เหนือเส้น EMA ช้า (50) บ่งบอกถึงแนวโน้มขาขึ้น</li>
                 <li><strong style={{ color: 'var(--loss-color)' }}>SHORT (ขาย):</strong> เกิดขึ้นเมื่อเส้น EMA เร็ว (20) ตัด *ลง* ต่ำกว่าเส้น EMA ช้า (50) บ่งบอกถึงแนวโน้มขาลง</li>
              </ul>
           </div>

           <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: 'auto' }}>
              <div>
                 <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.25rem' }}>
                    <CheckCircle size={14} color="var(--profit-color)" /> เหมาะสำหรับ
                 </div>
                 <div style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>สภาวะตลาดที่มีเทรนด์ชัดเจน (Bull หรือ Bear runs)</div>
              </div>
              <div>
                 <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.25rem' }}>
                    <AlertTriangle size={14} color="var(--loss-color)" /> จุดอ่อน
                 </div>
                 <div style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>ตลาดไซด์เวย์ (Sideways) ซึ่งจะเกิดสัญญาณหลอกได้บ่อย</div>
              </div>
           </div>

           <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <Clock size={16} /> <strong>Timeframe ที่แนะนำ:</strong> 1h, 4h, 1d
           </div>
        </div>

        {/* Bollinger Bands Card */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
           <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
             <div>
               <h3 className="m-0" style={{ fontSize: '1.25rem', color: 'var(--text-main)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                 <Activity size={20} color="orange" /> BB Mean Reversion
               </h3>
               <span style={{ fontSize: '0.8rem', background: 'rgba(255, 165, 0, 0.1)', color: 'orange', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>Reversal (กลับตัว)</span>
             </div>
             <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ความซับซ้อน</div>
                <div style={{ fontWeight: 'bold', color: 'orange' }}>ระดับกลาง</div>
             </div>
           </div>

           <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>
             กลยุทธ์ที่อาศัยความผันผวนของราคา (Volatility) โดยอิงจากหลักการ Mean Reversion ซึ่งตัว Bollinger Bands จะประกอบด้วยเส้นกลาง (SMA) และเส้นขอบนอกสองเส้น เมื่อราคาเบี่ยงเบนออกไปมากเกินไป (ชนขอบนอก) มักจะมีแนวโน้มที่จะกลับเข้าหาค่าเฉลี่ยเสมอ
           </p>

           <div style={{ background: 'var(--bg-dark)', padding: '1rem', borderRadius: '6px' }}>
              <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', color: 'var(--text-main)' }}>ตรรกะการเทรด (Trading Logic)</h4>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--text-muted)', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                 <li><strong style={{ color: 'var(--profit-color)' }}>LONG (ซื้อ):</strong> เมื่อราคาปิดต่ำกว่าเส้น Lower Band แล้วดีดกลับขึ้นมา (Oversold bounce)</li>
                 <li><strong style={{ color: 'var(--loss-color)' }}>SHORT (ขาย):</strong> เมื่อราคาปิดสูงกว่าเส้น Upper Band แล้วม้วนกลับลงมา (Overbought rejection)</li>
              </ul>
           </div>

           <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: 'auto' }}>
              <div>
                 <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.25rem' }}>
                    <CheckCircle size={14} color="var(--profit-color)" /> เหมาะสำหรับ
                 </div>
                 <div style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>ตลาดไซด์เวย์ หรือช่วงที่ราคากำลังสะสมพลังอยู่ในกรอบ</div>
              </div>
              <div>
                 <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.25rem' }}>
                    <AlertTriangle size={14} color="var(--loss-color)" /> จุดอ่อน
                 </div>
                 <div style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>ตลาดที่มีเทรนด์รุนแรง (ราคาอาจ "เกาะขอบ" ไปเรื่อยๆ โดยไม่กลับตัว)</div>
              </div>
           </div>

           <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <Clock size={16} /> <strong>Timeframe ที่แนะนำ:</strong> 15m, 1h
           </div>
        </div>

        {/* Grid Bot Card */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
           <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
             <div>
               <h3 className="m-0" style={{ fontSize: '1.25rem', color: 'var(--text-main)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                 <Grid size={20} color="#0ecb81" /> Grid Trading Bot
               </h3>
               <span style={{ fontSize: '0.8rem', background: 'rgba(14, 203, 129, 0.1)', color: '#0ecb81', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>Range Trading (วางกรอบ)</span>
             </div>
             <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ความซับซ้อน</div>
                <div style={{ fontWeight: 'bold', color: 'var(--profit-color)' }}>มือใหม่</div>
             </div>
           </div>

           <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>
             กลยุทธ์เชิงปริมาณ (Quantitative) ที่ออกแบบมาเพื่อทำกำไรจากความผันผวนปกติของตลาด โดยแบ่งช่วงราคาเป็นชั้นๆ เหมือน "ตาข่าย" (Grid) และวางคำสั่งซื้อ-ขายอัตโนมัติในแต่ละเส้น เพื่อเก็บกำไรเล็กๆ น้อยๆ เมื่อราคาสวิงขึ้นลง
           </p>

           <div style={{ background: 'var(--bg-dark)', padding: '1rem', borderRadius: '6px' }}>
              <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', color: 'var(--text-main)' }}>ตรรกะการเทรด (Trading Logic)</h4>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--text-muted)', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                 <li><strong style={{ color: 'var(--profit-color)' }}>BUY:</strong> วางไว้ต่ำกว่าราคาปัจจุบัน เมื่อราคาตกลงมาชนเส้น บอทจะทำการซื้อทีละส่วน</li>
                 <li><strong style={{ color: 'var(--loss-color)' }}>SELL:</strong> วางไว้เหนือราคาล่าสุด เมื่อราคาดีดขึ้นไปชนเส้น บอทจะขายส่วนที่ซื้อมาเพื่อรับกำไรคงที่</li>
              </ul>
           </div>

           <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: 'auto' }}>
              <div>
                 <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.25rem' }}>
                    <CheckCircle size={14} color="var(--profit-color)" /> เหมาะสำหรับ
                 </div>
                 <div style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>สภาวะตลาดไซด์เวย์ หรือตลาดที่ผันผวนรุนแรงอยู่ในกรอบเดิม</div>
              </div>
              <div>
                 <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.25rem' }}>
                    <AlertTriangle size={14} color="var(--loss-color)" /> จุดอ่อน
                 </div>
                 <div style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>เทรนด์ที่เป็นขาลงรุนแรง (หลุดกรอบด้านล่าง) หรือขาขึ้นแบบไม่พัก (ทำให้ของหมดมือ)</div>
              </div>
           </div>

           <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <Clock size={16} /> <strong>Timeframe ที่แนะนำ:</strong> 1m, 5m, 15m
           </div>
        </div>

      </div>

      <div className="glass-panel" style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
         <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <h3 className="m-0" style={{ fontSize: '1.1rem', color: 'var(--text-main)' }}>พร้อมที่จะทดสอบกลยุทธ์เหล่านี้หรือยัง?</h3>
            <p className="text-muted m-0" style={{ fontSize: '0.9rem' }}>ใช้ระบบ Strategy Tester เพื่อทดสอบประสิทธิภาพด้วยข้อมูลย้อนหลัง</p>
         </div>
         <a href="/backtest" style={{ textDecoration: 'none', background: 'var(--accent-primary)', color: '#fff', padding: '0.6rem 1.25rem', borderRadius: '4px', fontWeight: 'bold' }}>
            ไปที่หน้าทดสอบกลยุทธ์
         </a>
      </div>

    </div>
  );
}
