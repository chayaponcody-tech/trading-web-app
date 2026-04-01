import { spawn } from 'child_process';

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

console.log('🚀 Starting Backend Server (Port 3001)...');
const backend = spawn('node', ['backend/server.js'], { stdio: 'inherit', shell: true });

console.log('🚀 Starting Vite Frontend...');
const frontend = spawn(npmCmd, ['run', 'dev'], { stdio: 'inherit', shell: true });

const cleanup = () => {
  console.log('🛑 Shutting down servers...');
  backend.kill('SIGINT');
  frontend.kill('SIGINT');
  process.exit();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
