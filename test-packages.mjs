// Quick diagnostic script — tests each package can be resolved
import { fileURLToPath } from 'url';
import path from 'path';

console.log('=== Package Resolution Test ===');

const tests = [
  ['@trading/shared', 'packages/shared/config.js'],
  ['@trading/exchange-connector', 'packages/exchange-connector/src/BinanceAdapter.js'],
  ['@trading/data-layer', 'packages/data-layer/src/index.js'],
  ['@trading/bot-engine', 'packages/bot-engine/src/index.js'],
  ['@trading/ai-agents', 'packages/ai-agents/src/index.js'],
  ['@trading/api-gateway', 'packages/api-gateway/src/server.js'],
];

let errors = 0;
for (const [pkg, file] of tests) {
  try {
    const mod = await import(`./${file}`);
    console.log(`✅ ${pkg}`);
  } catch (e) {
    console.error(`❌ ${pkg} → ${e.message}`);
    errors++;
  }
}

console.log(`\n${errors === 0 ? '🎉 All packages OK!' : `❌ ${errors} package(s) failed`}`);
process.exit(errors);
