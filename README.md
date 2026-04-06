# 🚀 CryptoSmartTrade Ecosystem
> โครงสร้างระบบเทรดอัตโนมัติที่ผสานพลัง Quant Technical Analysis เข้ากับ Cognitive AI (DeepSeek/Gemini)

---

## 💎 สารบัญขีดความสามารถ (System Capabilities)

### 🧠 1. Cognitive Intelligence Layer
*   **AI Reflection (Double-Check):** ทุกสัญญาณการเทรดจะถูกกรองโดย AI (OpenRouter) เพื่อลด False Signal จากความผันผวนที่ Indicator มองไมเห็น
*   **AI Mistakes Memory (Learning Bot):** 🆕 ระบบจดจำความผิดพลาด บอทจะใช้ AI วิเคราะห์สาเหตุทุกครั้งที่ขาดทุน และบันทึกเป็น "บทเรียน" ลง SQLite เพื่อป้องกันการทำผิดซ้ำในอนาคต

### 📈 2. Advanced Trading Logic
*   **Adaptive Trailing Stop Loss:** 🆕 เมื่อกำไรถึงเป้า (+1.5%) ระบบจะเริ่มเลื่อน Stop Loss ตามราคาขึ้นไปเรื่อยๆ (+1%) เพื่อล็อคกำไรและปล่อยให้กำไรรัน (Let Profit Run)
*   **Multi-Strategy Support:** รองรับทั้ง EMA Crossover, Bollinger Bands Mean Reversion, RSI Scalp และ AI Scout Mode
*   **Precision Entry:** ระบบแบ่งไม้เข้าซื้อ (Step Entry) เพื่อให้ได้ค่าเฉลี่ยราคาที่ดีที่สุด

### 🐳 3. Modern Infrastructure & Security
*   **Docker Dev Mode (Hot-Reload):** ระบบ Docker ที่เชื่อมโยงโค้ดในเครื่องเข้ากับคอนเทนเนอร์โดยตรง แก้โค้ดแล้วอัปเดตทันทีโดยไม่ต้อง Build ใหม่
*   **Lean Multi-Stage Images:** ใช้เทคนิค Multi-stage build เพื่อสร้าง Docker Image ขนาดเล็กที่สุด (ลบไฟล์ DevDependencies และ Build Tools ทิ้งใน Production)
*   **Unified Environment:** สลับระหว่าง **Binance Testnet** และ **Live** ได้ง่ายๆ เพียงเปลี่ยนค่าใน `.env`

---

## 🛠 วิธีเริ่มต้นใช้งาน (Quick Start)

1.  **ตั้งค่ากุญแจ:** แก้ไขไฟล์ `.env` ใส่ API Key ของ Binance และ OpenRouter
2.  **รันระบบ:** 
    ```powershell
    docker compose up --build -d
    ```
3.  **เข้าใช้งาน:** 
    *   หน้าบ้าน (Frontend): `http://localhost:4000`
    *   หลังบ้าน (API): `http://localhost:4001`

---

## 📝 บันทึกการพัฒนา (Development Log)
- **2026-04-06:** เพิ่มระบบ AI Mistakes Memory และ Adaptive Trailing Stop
- **2026-04-05:** ปรับปรุง Docker Optimization และ ระบบ API Proxy
- **2026-04-04:** พัฒนา AI Portfolio Manager และ Hunter Bot
