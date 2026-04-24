const root = __dirname;

module.exports = {
  apps: [
    {
      name: 'trading-api',
      cwd: root,
      script: 'packages/api-gateway/src/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        PORT: '4001',
      },
    },
    {
      name: 'trading-frontend',
      cwd: root,
      script: 'cmd.exe',
      args: ['/c', 'npm.cmd', 'run', 'preview', '--', '--host', '0.0.0.0', '--port', '4000'],
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
    },
    {
      name: 'strategy-ai',
      cwd: root,
      script: 'powershell.exe',
      args: ['-ExecutionPolicy', 'Bypass', '-File', '.\\scripts\\run-strategy-ai.ps1'],
      interpreter: 'none',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        PYTHONUTF8: '1',
        PYTHONIOENCODING: 'utf-8',
      },
    },
    {
      name: 'quant-engine',
      cwd: root,
      script: 'powershell.exe',
      args: ['-ExecutionPolicy', 'Bypass', '-File', '.\\scripts\\run-quant-engine.ps1'],
      interpreter: 'none',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        PYTHONUTF8: '1',
        PYTHONIOENCODING: 'utf-8',
      },
    },
    {
      name: 'polymarket-dashboard',
      cwd: root,
      script: 'powershell.exe',
      args: ['-ExecutionPolicy', 'Bypass', '-File', '.\\scripts\\run-polymarket-dashboard.ps1'],
      interpreter: 'none',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        PYTHONUTF8: '1',
        PYTHONIOENCODING: 'utf-8',
      },
    },
    {
      name: 'polymarket-agent',
      cwd: root,
      script: 'powershell.exe',
      args: ['-ExecutionPolicy', 'Bypass', '-File', '.\\scripts\\run-polymarket-agent.ps1'],
      interpreter: 'none',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        PYTHONUTF8: '1',
        PYTHONIOENCODING: 'utf-8',
        POLYMARKET_AGENT_ARGS: '--dry-run',
      },
    },
  ],
};
