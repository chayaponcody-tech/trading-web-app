import React, { useState } from 'react';

interface Props {
  tradeMemory: any[];
}

export default function MemoryTab({ tradeMemory }: Props) {
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  const sortedMemory = [...tradeMemory].sort((a, b) => {
    const timeA = new Date(a.exitTime).getTime();
    const timeB = new Date(b.exitTime).getTime();
    return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
  });

  return (
    <div className="glass-panel" style={{ padding: '1.25rem', flex: 1, overflowY: 'auto', borderLeft: '4px solid #faad14' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div>
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#faad14', fontSize: '1.2rem' }}>AI Trade Memory (RAG Data) 🧠</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>ข้อมูลเหล่านี้คือ "ประสบการณ์" ที่ AI ใช้ในการวิเคราะห์และปรับปรุงในอนาคต</p>
        </div>
        
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', padding: '0.2rem' }}>
          <button 
            onClick={() => setSortOrder('newest')}
            style={{ 
              padding: '0.3rem 0.6rem', border: 'none', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer',
              background: sortOrder === 'newest' ? '#faad14' : 'transparent',
              color: sortOrder === 'newest' ? '#000' : '#888'
            }}
          >
            ล่าสุด
          </button>
          <button 
            onClick={() => setSortOrder('oldest')}
            style={{ 
              padding: '0.3rem 0.6rem', border: 'none', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer',
              background: sortOrder === 'oldest' ? '#faad14' : 'transparent',
              color: sortOrder === 'oldest' ? '#000' : '#888'
            }}
          >
            เก่าสุด
          </button>
        </div>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.5rem' }}>
        {sortedMemory.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#555' }}>ยังไม่มีความทรงจำบันทึกไว้ (บอทต้องปิดออเดอร์ก่อน)</div>
        ) : (
          sortedMemory.map((t: any, i: number) => (
            <div key={i} style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', borderLeft: `4px solid ${t.pnl >= 0 ? '#0ecb81' : '#f6465d'}`, border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 'bold', fontSize: '1rem' }}>{t.symbol} <span style={{ color: '#888', fontWeight: 'normal', fontSize: '0.75rem' }}>({t.type})</span></span>
                <span style={{ color: t.pnl >= 0 ? '#0ecb81' : '#f6465d', fontWeight: 'bold' }}>{t.pnl >= 0 ? '+' : ''}{parseFloat(t.pnl).toFixed(2)} USDT</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <div>Strategy: <span style={{ color: '#eee' }}>{t.strategy}</span></div>
                <div>Reason: <span style={{ color: '#eee' }}>{t.reason}</span></div>
                <div>Closed At: <span style={{ color: '#eee' }}>{new Date(t.exitTime).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}</span></div>
              </div>

              {t.aiLesson && (
                <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(250, 173, 20, 0.05)', borderRadius: '6px', borderLeft: '3px solid #faad14', fontSize: '0.85rem' }}>
                  <div style={{ color: '#faad14', fontWeight: 'bold', fontSize: '0.65rem', marginBottom: '0.25rem', textTransform: 'uppercase' }}>🧠 AI Lesson Learned:</div>
                  <p style={{ margin: 0, color: '#eee', fontStyle: 'italic', lineHeight: '1.4' }}>"{t.aiLesson}"</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
