import { Search } from 'lucide-react';

export default function MarketsBrowser() {
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '1rem', color: 'var(--text-muted)' }}>
      <Search size={48} strokeWidth={1.2} color="#ff6b35" />
      <h2 style={{ margin: 0, color: 'var(--text-main)' }}>Markets Browser</h2>
      <p style={{ margin: 0, fontSize: '0.95rem' }}>Coming soon — Browse & filter prediction markets</p>
    </div>
  );
}
