// ─── Memory Tab ───────────────────────────────────────────────────────────────

interface Props {
  tradeMemory: any[];
}

export default function MemoryTab({ tradeMemory }: Props) {
  return (
    <div className="glass-panel" style={{ padding: '1.25rem', flex: 1, overflowY: 'auto', borderLeft: '4px solid #faad14' }}>
      <h3 style={{ margin: '0 0 0.5rem 0', color: '#faad14', fontSize: '1.2rem' }}>AI Trade Memory (RAG Data) 🧠</h3>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>ข้อมูลเหล่านี้คือ "ประสบการณ์" ที่ AI ใช้ในการวิเคราะห์และปรับปรุงกลยุทธ์ให้คุณในอนาคต</p>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {tradeMemory.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#555' }}>ยังไม่มีความทรงจำบันทึกไว้ (บอทต้องปิดออเดอร์ก่อน)</div>
        ) : (
          tradeMemory.slice().reverse().map((t: any, i: number) => (
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
            </div>
          ))
        )}
      </div>
    </div>
  );
}
