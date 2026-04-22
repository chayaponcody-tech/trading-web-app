
import sqlite3
import json

db_path = "trading_app.db"

def check_db():
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("--- Tables ---")
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    for table in tables:
        print(f"Table: {table[0]}")
    
    print("\n--- sentiment_scores Schema ---")
    cursor.execute("PRAGMA table_info(sentiment_scores);")
    columns = cursor.fetchall()
    for col in columns:
        print(col)
        
    print("\n--- sentiment_scores Sample Data ---")
    cursor.execute("SELECT * FROM sentiment_scores LIMIT 3;")
    rows = cursor.fetchall()
    for row in rows:
        print(row)
        
    conn.close()

if __name__ == "__main__":
    check_db()
