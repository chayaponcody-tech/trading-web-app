const root = __dirname;

module.exports = {
  apps: [
    {
      name: 'trading-api',
      cwd: root,
      script: 'node',
      args: 'packages/api-gateway/src/server.js',
      interpreter: 'none',
      autorestart: true,
      watch: false,
      env: {
        PORT: '4001',
      },
    },
    {
      name: 'trading-frontend',
      cwd: root,
      script: 'npm.cmd',
      args: 'run preview -- --host 0.0.0.0 --port 4000',
      interpreter: 'none',
      autorestart: true,
      watch: false,
    },
    {
      name: 'strategy-ai',
      cwd: root,
      script: 'powershell.exe',
      args: '-ExecutionPolicy Bypass -File scripts/run-strategy-ai.ps1',
      interpreter: 'none',
      autorestart: true,
      watch: false,
    },
    {
      name: 'quant-engine',
      cwd: root,
      script: 'powershell.exe',
      args: '-ExecutionPolicy Bypass -File scripts/run-quant-engine.ps1',
      interpreter: 'none',
      autorestart: true,
      watch: false,
    },
    {
      name: 'polymarket-dashboard',
      cwd: root,
      script: 'powershell.exe',
      args: '-ExecutionPolicy Bypass -File scripts/run-polymarket-dashboard.ps1',
      interpreter: 'none',
      autorestart: true,
      watch: false,
    },
    {
      name: 'polymarket-agent',
      cwd: root,
      script: 'powershell.exe',
      args: '-ExecutionPolicy Bypass -File scripts/run-polymarket-agent.ps1',
      interpreter: 'none',
      autorestart: true,
      watch: false,
      env: {
        POLYMARKET_AGENT_ARGS: '--dry-run',
      },
    },
  ],
};
