import Database from 'better-sqlite3';
import path from 'path';

const dbPath = 'd:/Crypto/trading-web-app/trading_app.db';
const db = new Database(dbPath);

console.log('--- AI Token Usage Summary (By Feature) ---');
const summary = db.prepare(`
    SELECT feature, 
           COUNT(*) as call_count, 
           SUM(total_tokens) as total_tokens,
           AVG(total_tokens) as avg_tokens
    FROM ai_token_logs 
    GROUP BY feature 
    ORDER BY total_tokens DESC
`).all();
console.table(summary);

console.log('\n--- AI Token Usage Summary (By Model) ---');
const modelSummary = db.prepare(`
    SELECT model, 
           COUNT(*) as call_count, 
           SUM(total_tokens) as total_tokens 
    FROM ai_token_logs 
    GROUP BY model 
    ORDER BY total_tokens DESC
`).all();
console.table(modelSummary);

console.log('\n--- Highest Usage Spikes (Daily) ---');
const dailySummary = db.prepare(`
    SELECT date(timestamp) as day, 
           SUM(total_tokens) as total_tokens,
           COUNT(*) as call_count
    FROM ai_token_logs 
    GROUP BY day 
    ORDER BY total_tokens DESC 
    LIMIT 10
`).all();
console.table(dailySummary);

console.log('\n--- Recent 10 High-Consumption Requests ---');
const highConsume = db.prepare(`
    SELECT feature, model, total_tokens, timestamp 
    FROM ai_token_logs 
    ORDER BY total_tokens DESC 
    LIMIT 10
`).all();
console.table(highConsume);

db.close();
