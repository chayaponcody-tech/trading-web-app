import type { Bot } from '../types';

// ─── Fleet Groups Tab ─────────────────────────────────────────────────────────

interface Props {
  bots: Bot[];
  onResume: (id: string) => void;
  onStop: (id: string) => void;
  onDeleteGroup: (list: Bot[]) => void;
}

export default function GroupsTab({ bots, onResume, onStop, onDeleteGroup }: Props) {
  const groups: Record<string, Bot[]> = {};
  bots.forEach(b => {
    const key = b.startedAt || 'Manual';
    if (!groups[key]) groups[key] = [];
    groups[key].push(b);
  });

  const groupList = Object.entries(groups).filter(([, list]) => list.length >= 2);

  if (groupList.length === 0) {
    return (
      <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', textAlign: 'center', color: '#555', border: '1px dashed var(--border-color)', margin: '1rem' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>🚢</div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', margin: '0 0 0.5rem 0' }}>No AI Fleet Groups Active</h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', maxWidth: '400px', margin: '0 0 2rem 0' }}>Start multiple bots via AI Fleet to create a group.</p>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto', padding: '1rem', minHeight: '600px' }}>
      {groupList.reverse().map(([time, list]) => {
        const totalPnL = list.reduce((sum, b) => sum + (b.netPnl || 0), 0);
        const aiType = list[0]?.config.aiType || 'scout';

        return (
          <div key={time} className="glass-panel" style={{ padding: '1.5rem', borderLeft: '4px solid #faad14', background: 'linear-gradient(to right, rgba(250,173,20,0.05), transparent)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(250,173,20,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                  {aiType === 'scout' ? '🏹' : aiType === 'confident' ? '✨' : '📈'}
                </div>
                <div>
                  <div style={{ fontSize: '0.65rem', color: '#faad14', fontWeight: 'bold', textTransform: 'uppercase' }}>Fleet Squadron • {time}</div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{list[0]?.config?.groupName || aiType.toUpperCase() + ' Deployment'}</h3>
                  <span style={{ fontSize: '0.75rem', color: '#888' }}>({list.length} Bots)</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.6rem', color: '#888' }}>TOTAL PNL</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: totalPnL >= 0 ? '#0ecb81' : '#f6465d' }}>${totalPnL.toFixed(2)}</div>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', flexDirection: 'column', minWidth: '150px' }}>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button onClick={() => list.forEach(b => !b.isRunning && onResume(b.id))} style={{ flex: 1, padding: '0.45rem', background: '#faad14', border: 'none', color: '#000', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 'bold', cursor: 'pointer' }}>START ALL</button>
                    <button onClick={() => list.forEach(b => b.isRunning && onStop(b.id))} style={{ flex: 1, padding: '0.45rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 'bold', cursor: 'pointer' }}>STOP ALL</button>
                  </div>
                  <button onClick={() => onDeleteGroup(list)} style={{ width: '100%', padding: '0.4rem', background: 'rgba(246,70,93,0.05)', border: '1px solid rgba(246,70,93,0.2)', color: '#f6465d', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 'bold', cursor: 'pointer' }}>🗑️ DELETE GROUP</button>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
              {list.map(b => (
                <div key={b.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', padding: '0.4rem 0.75rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: '130px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: b.isRunning ? '#0ecb81' : '#f6465d' }} />
                  <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{b.config.symbol}</span>
                  <span style={{ fontSize: '0.7rem', color: (b.netPnl || 0) >= 0 ? '#0ecb81' : '#f6465d', marginLeft: 'auto' }}>${(b.netPnl || 0).toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
