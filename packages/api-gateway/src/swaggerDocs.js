export const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Antigravity Trading API',
    version: '1.0.0',
    description: 'API for controlling AI Trading Bots on Binance Futures',
  },
  servers: [
    {
      url: 'http://localhost:4001',
      description: 'Development server',
    },
  ],
  paths: {
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
                  symbol: { type: 'string', example: 'BTCUSDT' },
                  strategy: { type: 'string', example: 'AI_GRID_SCALP' },
                  interval: { type: 'string', example: '15m' },
                  leverage: { type: 'number', example: 10 },
                  positionSizeUSDT: { type: 'number', example: 100 }
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
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { botId: { type: 'string' } } } } }
        },
        responses: { 200: { description: 'Success' } }
      }
    },
    '/api/forward-test/resume': {
      post: {
        summary: 'Resume a stopped bot',
        tags: ['Bots'],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { botId: { type: 'string' } } } } }
        },
        responses: { 200: { description: 'Success' } }
      }
    },
    '/api/forward-test/delete': {
      post: {
        summary: 'Delete a bot permanently',
        tags: ['Bots'],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { botId: { type: 'string' } } } } }
        },
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
    }
  }
};
