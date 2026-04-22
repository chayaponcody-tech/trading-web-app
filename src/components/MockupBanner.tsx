import React from 'react';
import { Layout } from 'lucide-react';

const MockupBanner: React.FC = () => {
  return (
    <div style={{
      background: 'linear-gradient(90deg, #faad14 0%, #ff8c00 100%)',
      color: '#000',
      padding: '4px 0',
      textAlign: 'center',
      fontSize: '0.7rem',
      fontWeight: 'bold',
      letterSpacing: '1px',
      textTransform: 'uppercase',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      zIndex: 2000,
      position: 'relative'
    }}>
      <Layout size={14} />
      <span>Prototype Mockup - UI/UX Preview Only</span>
    </div>
  );
};

export default MockupBanner;
