import express from 'express';
import { MarketDataEngine } from '../../../data-layer/src/MarketDataEngine.js';

export function createMarketRoutes(binanceService) {
  const router = express.Router();
  const engine = new MarketDataEngine(binanceService);

  /**
   * @swagger
   * /api/market/features:
   *   get:
   *     summary: Get calculated Market Features for a symbol
   *     parameters:
   *       - name: symbol
   *         in: query
   *         required: true
   *         schema: { type: string }
   *       - name: interval
   *         in: query
   *         required: false
   *         schema: { type: string, default: '1h' }
   */
  router.get('/features', async (req, res) => {
    try {
      const { symbol, interval = '1h' } = req.query;
      if (!symbol) return res.status(400).json({ error: 'Symbol is required' });

      const features = await engine.getMarketFeatures(symbol, interval);
      res.json(features);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  } );

  /**
   * Get definitions of available Market Features
   */
  router.get('/definitions', (req, res) => {
    res.json([
      { 
        id: 'tqi', 
        name: 'Trend Quality Index', 
        name_th: 'ดัชนีคุณภาพเทรนด์',
        category: 'Quant', 
        update_type: 'Snapshot',
        update_type_th: 'รายแท่งเทียน',
        description: 'Composite index (0-1) measuring overall trend health.',
        description_th: 'ดัชนีรวม (0-1) ที่ใช้วัดความแข็งแกร่งของแนวโน้มภาพรวม',
        formula: 'Weighted average of ER, Vol, Struct, Mom, and ADX',
        source: 'Internal Quant Engine v2.1',
        impact: 'High (>0.7): Strong Trend | Low (<0.3): Ranging/Noise',
        impact_th: 'สูง (>0.7): เทรนด์แรง | ต่ำ (<0.3): ไซด์เวย์'
      },
      { 
        id: 'efficiency_ratio', 
        name: 'Efficiency Ratio', 
        name_th: 'อัตราประสิทธิภาพราคา',
        category: 'Quant', 
        update_type: 'Snapshot',
        update_type_th: 'รายแท่งเทียน',
        description: 'Measures how efficient the price movement is (Trend vs Noise).',
        description_th: 'วัดว่าราคาเคลื่อนที่อย่างมีประสิทธิภาพแค่ไหน (เทรนด์ vs สัญญาณรบกวน)',
        formula: 'Net Change / Sum of Absolute Changes',
        source: 'Price Velocity Analysis',
        impact: 'High (>0.6): Clean Move | Low (<0.2): Choppy/Sideway',
        impact_th: 'สูง (>0.6): วิ่งแรงทางเดียว | ต่ำ (<0.2): คลื่นรบกวนเยอะ'
      },
      { 
        id: 'volatility_ratio', 
        name: 'Volatility Ratio', 
        name_th: 'อัตราส่วนความผันผวน',
        category: 'Quant', 
        update_type: 'Snapshot',
        update_type_th: 'รายแท่งเทียน',
        description: 'Compares current ATR against long-term baseline.',
        description_th: 'เปรียบเทียบค่า ATR ปัจจุบันกับค่ามาตรฐานระยะยาว',
        formula: 'ATR(14) / ATR_Baseline(100)',
        source: 'Historical Volatility Engine',
        impact: 'High (>1.5): Abnormal Volatility | Low (<0.8): Low Liquidity',
        impact_th: 'สูง (>1.5): ผันผวนผิดปกติ | ต่ำ (<0.8): สภาพคล่องต่ำ'
      },
      { 
        id: 'rsi', 
        name: 'Relative Strength Index', 
        name_th: 'ดัชนีกำลังสัมพัทธ์ (RSI)',
        category: 'Technical', 
        update_type: 'Snapshot',
        update_type_th: 'รายแท่งเทียน',
        description: 'Classical momentum indicator for Overbought/Oversold levels.',
        description_th: 'ตัวชี้วัดโมเมนตัมแบบดั้งเดิมสำหรับดูโซนซื้อมาก/ขายมากเกินไป',
        formula: '100 - (100 / (1 + RS))',
        source: 'Technical Indicator Library',
        impact: '>70: Overbought (Sell Bias) | <30: Oversold (Buy Bias)',
        impact_th: '>70: ซื้อมากไป (ระวังขาย) | <30: ขายมากไป (ระวังซื้อ)'
      },
      { 
        id: 'funding_rate', 
        name: 'Funding Rate', 
        name_th: 'อัตราค่าธรรมเนียมถือครอง',
        category: 'Microstructure', 
        update_type: 'Real-time',
        update_type_th: 'เรียลไทม์',
        description: 'Periodic payment between long and short traders.',
        description_th: 'ค่าธรรมเนียมที่จ่ายระหว่างฝั่ง Long และ Short ทุกๆ ช่วงเวลา',
        formula: 'Binance Premium Index',
        source: 'Binance FAPI (Real-time)',
        impact: 'Potentially Reversal Trigger if Extreme positive/negative',
        impact_th: 'ถ้าค่าเป็นบวกหรือลบมากเกินไป มีโอกาสกลับตัวสูง'
      },
      { 
        id: 'open_interest', 
        name: 'Open Interest', 
        name_th: 'ปริมาณสัญญาคงค้าง (OI)',
        category: 'Microstructure', 
        update_type: 'Real-time',
        update_type_th: 'เรียลไทม์',
        description: 'Total number of outstanding derivative contracts.',
        description_th: 'จำนวนรวมของสัญญาทั้งหมดที่ยังไม่มีการปิดสถานะในตลาด',
        formula: 'Binance Open Interest API',
        source: 'Binance FAPI (Aggregated)',
        impact: 'Rising during price move: Confirms Trend | Falling: Trend Reversal Risk',
        impact_th: 'ถ้าพุ่งตามราคา: ยันยืนเทรนด์ | ถ้าลดลง: เสี่ยงเทรนด์กลับตัว'
      },
      { 
        id: 'liquidation_volume', 
        name: 'Liquidation Volume', 
        name_th: 'ปริมาณการล้างพอร์ต',
        category: 'Microstructure', 
        update_type: 'Real-time',
        update_type_th: 'เรียลไทม์',
        description: 'Total value of liquidated positions in the recent period.',
        description_th: 'มูลค่ารวมของพอร์ตที่ถูกบังคับปิด (โดนล้าง) ในช่วงเวลาล่าสุด',
        formula: 'Sum(Force Orders * Fill Price)',
        source: 'Binance Liquidations Feed',
        impact: 'High Spike: Capitulation / Market Local Bottom/Top',
        impact_th: 'ถ้าพุ่งสูง: สัญญาณการยอมแพ้ หรือจุดต่ำสุด/สูงสุดชั่วคราว'
      },
      { 
        id: 'order_flow_delta', 
        name: 'Order Flow Delta', 
        name_th: 'เดลต้าแรงซื้อขายสด',
        category: 'Microstructure', 
        update_type: 'Real-time',
        update_type_th: 'เรียลไทม์',
        description: 'Net difference between market buy and market sell volume.',
        description_th: 'ส่วนต่างสุทธิระหว่างปริมาณการซื้อสดและขายสดในตลาด',
        formula: '(Taker Buy - Taker Sell) / Total Vol',
        source: 'Binance AggTrade Stream',
        impact: 'Positive: Aggressive Buying | Negative: Aggressive Selling',
        impact_th: 'บวก: แรงซื้อรุกราน | ลบ: แรงขายรุกราน'
      },
      { 
        id: 'exchange_netflow', 
        name: 'Exchange Netflow', 
        name_th: 'ปริมาณเงินไหลเข้าออกกระดาน',
        category: 'On-Chain', 
        update_type: 'Near Real-time',
        update_type_th: 'ใกล้เคียงเรียลไทม์',
        description: 'Net movement of coins in/out of exchange wallets.',
        description_th: 'การเคลื่อนย้ายเหรียญสุทธิเข้าหรือออกจากกระเป๋าของกระดานเทรด',
        formula: 'Inflow - Outflow (Simulated)',
        source: 'On-Chain Flow Simulator',
        impact: 'High Netflow: Selling Pressure | Outflow: Accumulation Bias',
        impact_th: 'ไหลเข้าสูง: แรงกดดันการขาย | ไหลออก: แรงกดดันการเก็บของ'
      },
      { 
        id: 'whale_activity', 
        name: 'Whale Activity', 
        name_th: 'พฤติกรรมเจ้ามือ (วาฬ)',
        category: 'On-Chain', 
        update_type: 'Near Real-time',
        update_type_th: 'ใกล้เคียงเรียลไทม์',
        description: 'Detection of large-scale movements by significant holders.',
        description_th: 'การตรวจจับการทำธุรกรรมขนาดใหญ่จากผู้ถือเหรียญรายใหญ่',
        formula: 'Large Transaction Cluster Analysis',
        source: 'Whale Tracker (Simulated)',
        impact: 'High: Whales Active (Volatility Coming) | Low: Retail-Driven Market',
        impact_th: 'สูง: วาฬเริ่มขยับ (ความผันผวนกำลังมา) | ต่ำ: ตลาดรายย่อยขับเคลื่อน'
      }
    ]);
  });

  return router;
}
