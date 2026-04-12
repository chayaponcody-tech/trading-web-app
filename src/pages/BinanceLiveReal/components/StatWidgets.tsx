// ─── Shared UI Components ──────────────────────────────────────────────────────

export const SummaryStat = ({ icon, label, value, sub, color }: any) => (
  <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '1rem', alignItems: 'center', transition: 'transform 0.2s' }}>
    <div style={{ fontSize: '1.5rem', background: 'rgba(250,173,20,0.1)', minWidth: '45px', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '10px' }}>{icon}</div>
    <div style={{ overflow: 'hidden' }}>
      <div style={{ fontSize: '0.6rem', color: '#888', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: color || '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
      <div style={{ fontSize: '0.6rem', opacity: 0.5, whiteSpace: 'nowrap' }}>{sub}</div>
    </div>
  </div>
);

export const StatLarge = ({ label, value, color }: { label: string; value: string; color?: string }) => (
  <div style={{ textAlign: 'right' }}>
    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>{label}</div>
    <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: color || '#fff' }}>{value}</div>
  </div>
);
