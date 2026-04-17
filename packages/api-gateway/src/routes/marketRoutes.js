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
        category: 'Quant', 
        description: 'Composite index (0-1) measuring overall trend health.',
        formula: 'Weighted average of ER, Vol, Struct, Mom, and ADX' 
      },
      { 
        id: 'efficiency_ratio', 
        name: 'Efficiency Ratio', 
        category: 'Quant', 
        description: 'Measures how efficient the price movement is (Trend vs Noise).',
        formula: 'Net Change / Sum of Absolute Changes' 
      },
      { 
        id: 'volatility_ratio', 
        name: 'Volatility Ratio', 
        category: 'Quant', 
        description: 'Compares current ATR against long-term baseline.',
        formula: 'ATR(14) / ATR_Baseline(100)' 
      },
      { 
        id: 'rsi', 
        name: 'Relative Strength Index', 
        category: 'Technical', 
        description: 'Classical momentum indicator for Overbought/Oversold levels.',
        formula: '100 - (100 / (1 + RS))' 
      },
      { 
        id: 'funding_rate', 
        name: 'Funding Rate', 
        category: 'Microstructure', 
        description: 'Periodic payment between long and short traders.',
        formula: 'Binance Premium Index' 
      },
      { 
        id: 'open_interest', 
        name: 'Open Interest', 
        category: 'Microstructure', 
        description: 'Total number of outstanding derivative contracts.',
        formula: 'Binance Open Interest API' 
      }
    ]);
  });

  return router;
}
