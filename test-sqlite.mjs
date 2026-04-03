import Database from 'better-sqlite3';
const db = new Database('test.db');
db.exec('CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY)');
console.log('✅ SQLite is working!');
process.exit(0);
