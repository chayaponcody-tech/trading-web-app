import React from 'react';
import { Check, Star, Zap, Crown, Shield, ArrowRight, Heart, Coffee } from 'lucide-react';
import MockupBanner from '../components/MockupBanner';
import './Pricing.css';

const PricingPage: React.FC = () => {
  const plans = [
    {
      name: 'Supporter',
      price: '$3',
      period: '/เดือน',
      description: 'สนับสนุนผู้พัฒนาและปลดล็อกฟีเจอร์พื้นฐานเพิ่มเติม',
      icon: <Heart size={24} style={{ color: '#f6465d' }} />,
      features: [
        'สูงสุด 4 บอททำงานพร้อมกัน',
        'ปลดล็อกระบบ Telegram Alerts',
        'Badge "Supporter" พิเศษในระบบ',
        'Support ทางเทคนิคเบื้องต้น',
        'มีส่วนช่วยสนับสนุนการพัฒนา',
      ],
      cta: 'สนับสนุนเลย',
      highlight: false,
    },
    {
      name: 'Starter',
      price: 'Free',
      description: 'สำหรับนักเทรดเริ่มต้น ทดลองใช้ระบบพื้นฐาน',
      icon: <Zap size={24} className="text-muted" />,
      features: [
        'สูงสุด 2 บอททำงานพร้อมกัน',
        'อินดิเคเตอร์เทคนิคมาตรฐาน',
        'Timeframe ขั้นต่ำ 15 นาที',
        'แดชบอร์ดสรุปผลพื้นฐาน',
      ],
      cta: 'เริ่มใช้งานฟรี',
      highlight: false,
    },
    {
      name: 'Professional',
      price: '$49',
      period: '/เดือน',
      description: 'ยกระดับการเทรดด้วยพลังของ AI Confidence',
      icon: <Star size={24} style={{ color: '#faad14' }} />,
      features: [
        'สูงสุด 10 บอททำงานพร้อมกัน',
        'AI Confidence Engine (Layer 1)',
        'Sentiment Analysis Dashboard',
        'Timeframe ขั้นต่ำ 5 นาที',
        'Telegram Notifications ทันที',
      ],
      cta: 'สมัครเป็น Pro',
      highlight: true,
      popular: true,
    },
    {
      name: 'Elite',
      price: '$149',
      period: '/เดือน',
      description: 'ที่สุดของระบบเทรดอัตโนมัติระดับสถาบัน',
      icon: <Crown size={24} style={{ color: '#a78bfa' }} />,
      features: [
        'ไม่จำกัดจำนวนบอท',
        'SATS (Self-Aware System)',
        'LLM Deep Analysis (Layer 2)',
        'ข้อมูล Microstructure (OI/Funding)',
        'ที่ปรึกษาส่วนตัว 1-on-1',
      ],
      cta: 'ติดต่อรับ Elite',
      highlight: false,
    },
  ];

  return (
    <div className="pricing-container animate-fade-in" style={{ padding: '0' }}>
      <MockupBanner />
      <div style={{ padding: '2rem' }}>
      <div className="pricing-header">
        <h1 className="pricing-title">เลือกแผนการเทรดที่เหมาะกับคุณ</h1>
        <p className="pricing-subtitle">
          ปลดล็อกขีดจำกัดการเทรดด้วยระบบ AI ระดับสูง และการวิเคราะห์ข้อมูล Microstructure ที่แม่นยำที่สุด
        </p>
      </div>

      <div className="pricing-grid">
        {plans.map((plan, index) => (
          <div 
            key={index} 
            className={`pricing-card glass-panel ${plan.highlight ? 'highlighted' : ''}`}
          >
            {plan.popular && <div className="popular-badge">MOST POPULAR</div>}
            
            <div className="plan-icon">{plan.icon}</div>
            <h2 className="plan-name">{plan.name}</h2>
            <div className="plan-price">
              <span className="price-amount">{plan.price}</span>
              {plan.period && <span className="price-period">{plan.period}</span>}
            </div>
            <p className="plan-description">{plan.description}</p>
            
            <div className="plan-divider" />
            
            <ul className="plan-features">
              {plan.features.map((feature, fIndex) => (
                <li key={fIndex} className="feature-item">
                  <Check size={16} className="text-profit" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            
            <button className={`plan-cta ${plan.highlight ? 'btn-primary' : 'btn-outline'}`} style={{ width: '100%', marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {plan.cta} <ArrowRight size={16} style={{ marginLeft: '8px' }} />
            </button>
          </div>
        ))}
      </div>

      <div className="pricing-footer glass-panel">
        <div className="footer-content">
          <div className="flex-center" style={{ flexDirection: 'column', textAlign: 'center' }}>
            <Shield size={32} style={{ color: '#0ecb81', marginBottom: '1rem' }} />
            <h3 style={{ marginBottom: '0.5rem' }}>การันตีความปลอดภัยระดับมาตรฐานสากล</h3>
            <p style={{ maxWidth: '600px', margin: '0 auto' }}>
              API Keys ของคุณจะถูกแบ่งข้อมูลและเก็บรักษาด้วยการเข้ารหัสระดับ 256-bit AES
              เราไม่มีสิทธิ์ในการถอนเงินของคุณ (Withdrawal disabled) ทำหน้าที่เพียงส่งคำสั่งซื้อขายเท่านั้น
            </p>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default PricingPage;
