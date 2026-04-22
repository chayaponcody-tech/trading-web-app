import sqlite3
conn = sqlite3.connect('d:/Crypto/trading-web-app/trading_app.db')
conn.execute("UPDATE research_sources SET name = 'Arxiv Quant Finance', url = 'https://export.arxiv.org/rss/q-fin' WHERE name LIKE '%Arxiv%'")
conn.commit()
conn.close()
print('Successfully updated Arxiv to Quant Finance feed')
