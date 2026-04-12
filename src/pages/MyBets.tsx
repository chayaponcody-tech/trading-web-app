import { Wallet } from 'lucide-react';

export default function MyBets() {
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '1rem', color: 'var(--text-muted)' }}>
      <Wallet size={48} strokeWidth={1.2} color="#ff6b35" />
      <h2 style={{ margin: 0, color: 'var(--text-main)' }}>My Bets</h2>
      <p style={{ margin: 0, fontSize: '0.95rem' }}>Coming soon — Track your prediction positions</p>
    </div>
  );
}
