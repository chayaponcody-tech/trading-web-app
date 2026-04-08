export const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Antigravity Trading API',
    version: '1.1.0',
    description: `API for controlling AI Trading Bots on Binance Futures

## Bot Tick Cycle
Every 30 seconds per bot:
1. Fetch klines + ticker + accountInfo
2. Sync positions & unrealized PnL
3. Check Max Drawdown / Expiry
4. TP/SL/Trailing Stop check (real-time, every tick)
5. On new candle close → computeSignal (technical only)
6. If signal → _checkMicrostructure (OI + Funding Rate, on-demand)
7. If microstructure passes → _openPosition

## Microstructure Filter Rules
Applied only at entry time (not every tick):
- Funding > +0.05% → block LONG
- Funding < -0.05% → block SHORT  
- OI drops > 10% in 15m → block ALL directions
- Configurable per bot via \`fundingThreshold\`
- Fail-open: API errors do not block entry

## Strategy Suitability (Recruiting)
POST /api/binance/ai-hunt with \`strategyType\` to enable pre-filtering:
- grid → filters sideway coins (ADX < 25, BBWidth < 5%)
- scalp → filters volatile/momentum coins
- trend → filters trending coins (ADX > 25)
`,
  },
  servers: [
    { url: 'http://localhost:4001', description: 'Development server' },
    { url: 'http://localhost:4000', description: 'Production / Docker' },
  ],
  paths: {
    '/strategies': {
      get: {
        summary: 'Get all strategy metadata',
        tags: ['Strategies'],
        description: 'Returns strategy list with market regime hints, suitability indicators (ADX/BBWidth thresholds), and microstructure filter rules applied at entry time.',
        responses: {
          200: {
            description: 'Array of strategy objects',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id:           { type: 'string', example: 'AI_GRID' },
                      name:         { type: 'string', example: 'AI Grid Trading' },
                      description:  { type: 'string' },
                      marketRegime: { type: 'string', example: 'sideway' },
                      regimeLabel:  { type: 'string' },
                      bestInterval: { type: 'string', example: '1h' },
                      indicators:   { type: 'array', items: { type: 'string' } },
                      suitabilityHints: {
                        type: 'object',
                        properties: {
                          adxMin:         { type: 'number' },
                          adxMax:         { type: 'number' },
                          bbWidthMin:     { type: 'number' },
                          bbWidthMax:     { type: 'number' },
                          priceChangeMin: { type: 'number' },
                          priceChangeMax: { type: 'number' },
                        }
                      },
                      riskProfile: { type: 'string', enum: ['low', 'medium', 'high'] },
                      tags:         { type: 'array', items: { type: 'string' } },
                      microstructureFilter: {
                        type: 'object',
                        properties: {
                          description:  { type: 'string' },
                          appliedAt:    { type: 'string' },
                          rules:        { type: 'array' },
                          configurable: { type: 'object' },
                          failBehavior: { type: 'string' },
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/forward-test/status': {
      get: {
        summary: 'Get full state of all bots',
        tags: ['Bots'],
        responses: { 200: { description: 'List of all bots with full internal state' } }
      }
    },
    '/api/forward-test/start': {
      post: {
        summary: 'Launch a new trading bot',
        tags: ['Bots'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  symbol:            { type: 'string', example: 'BTCUSDT' },
                  strategy:          { type: 'string', example: 'AI_GRID_SCALP', enum: ['EMA_RSI', 'AI_GRID', 'AI_GRID_SCALP', 'AI_GRID_SWING', 'AI_SCOUTER', 'BB_RSI', 'EMA_BB_RSI'] },
                  interval:          { type: 'string', example: '15m' },
                  leverage:          { type: 'number', example: 10 },
                  positionSizeUSDT:  { type: 'number', example: 100 },
                  tpPercent:         { type: 'number', example: 1.5 },
                  slPercent:         { type: 'number', example: 1.0 },
                  fundingThreshold:  { type: 'number', example: 0.0005, description: 'Microstructure filter threshold (default 0.0005 = 0.05%)' },
                  cooldownMinutes:   { type: 'number', example: 0 },
                  durationMinutes:   { type: 'number', example: 240 },
                }
              }
            }
          }
        },
        responses: { 200: { description: 'Bot started successfully' } }
      }
    },
    '/api/forward-test/stop': {
      post: {
        summary: 'Stop a running bot',
        tags: ['Bots'],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { botId: { type: 'string' } } } } } },
        responses: { 200: { description: 'Success' } }
      }
    },
    '/api/forward-test/resume': {
      post: {
        summary: 'Resume a stopped bot',
        tags: ['Bots'],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { botId: { type: 'string' } } } } } },
        responses: { 200: { description: 'Success' } }
      }
    },
    '/api/forward-test/delete': {
      post: {
        summary: 'Delete a bot permanently',
        tags: ['Bots'],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { botId: { type: 'string' } } } } } },
        responses: { 200: { description: 'Success' } }
      }
    },
    '/api/forward-test/summary': {
      get: {
        summary: 'Get a lightweight summary of all bots (Used by Frontend)',
        tags: ['Bots'],
        responses: { 200: { description: 'Array of bot summaries' } }
      }
    },
    '/api/forward-test/clear-all': {
      post: {
        summary: 'Wipe ALL bots from memory and database (Hard Reset)',
        tags: ['Bots'],
        responses: { 200: { description: 'All bots wiped successfully' } }
      }
    },
    '/api/binance/account': {
      get: {
        summary: 'Get Binance Account info (Balance/Positions)',
        tags: ['Account'],
        responses: { 200: { description: 'Account snapshot' } }
      }
    },
    '/api/binance/ai-hunt': {
      post: {
        summary: 'Hunt best symbols for a strategy goal',
        tags: ['AI'],
        description: 'Finds top 5 coins using AI. If strategyType is provided, pre-computes market regime (ADX + BBWidth) per coin and filters candidates before sending to AI.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  goal:         { type: 'string', example: 'Grid trading on sideway coins' },
                  strategyType: { type: 'string', enum: ['grid', 'scalp', 'trend'], description: 'Enables market regime pre-filter. grid=sideway, scalp=volatile, trend=trending' },
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Array of recommended symbols with reasons and scores',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      symbol: { type: 'string' },
                      reason: { type: 'string', description: 'Thai language analysis including regime + OI relationship' },
                      score:  { type: 'number' },
                      tag:    { type: 'string' },
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/binance/market-scan': {
      get: {
        summary: 'Scan top USDT pairs by mode',
        tags: ['Market'],
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'mode',  in: 'query', schema: { type: 'string', enum: ['volume', 'scout', 'dip', 'precision', 'grid'], default: 'volume' }, description: 'grid = filter |priceChange| < 5% (sideway candidates)' },
        ],
        responses: { 200: { description: 'Array of ticker summaries' } }
      }
    },
  }
};
