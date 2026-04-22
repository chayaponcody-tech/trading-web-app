import sqlite3
from pathlib import Path

db_path = Path("trading_app.db")
conn = sqlite3.connect(db_path)
cursor = conn.execute("SELECT key FROM settings")
rows = cursor.fetchall()
for r in rows:
    print(f"Key: {r[0]}")
conn.close()
