# 🚀 CryptoSmartTrade Ecosystem
> โครงสร้างระบบเทรดอัตโนมัติที่ผสานพลัง Quant Technical Analysis เข้ากับ Cognitive AI (DeepSeek/Gemini)

---

## 💎 สารบัญขีดความสามารถ (System Capabilities)

### 🧠 1. Cognitive Intelligence Layer
- **AI Reflection (Double-Check):** ทุกสัญญาณการเทรดจะถูกกรองโดย AI (OpenRouter) เพื่อลด False Signal
- **AI Mistakes Memory (Learning Bot):** ระบบจดจำความผิดพลาด บอทวิเคราะห์สาเหตุทุกครั้งที่ขาดทุน บันทึกเป็น "บทเรียน" ลง SQLite
- **AI Review (ทุก N นาที):** ปรับ TP/SL/Strategy อัตโนมัติตาม market condition ที่เปลี่ยนไป

### 📈 2. Advanced Trading Logic

#### Bot Tick Cycle (ทุก 30 วินาที)
```
[Tick] → fetch klines + ticker + accountInfo
       → sync positions & unrealized PnL
       → check Max Drawdown / Expiry
       → TP/SL/Trailing Stop check (real-time)
       → [New Candle?] → computeSignal (Technical)
                       → [Signal?] → _checkMicrostructure (OI + Funding)
                                   → [Pass?] → _openPosition
```

#### Microstructure Filter (ใหม่)
ดึง OI + Funding Rate จาก Binance **เฉพาะตอนจะเปิด position** ไม่กระทบ tick ปกติ
- Funding > +0.05% → block LONG (Long squeeze risk)
- Funding < -0.05% → block SHORT (Short squeeze risk)
- OI ลดลง > 10% ใน 15 นาที → block ทุก direction (signal อ่อน)
- ปรับ threshold ได้ต่อบอทผ่าน `bot.config.fundingThreshold`
- Fail-open: ถ้าดึง API ไม่ได้จะไม่ block entry

#### Signal Entry (ต่อ candle close เท่านั้น)
- ใช้ technical indicators ล้วนๆ (`computeSignal`) — ไม่เรียก AI
- เปิด position ได้ครั้งเดียวต่อ candle ไม่ว่า tick จะรันกี่ครั้ง

#### Adaptive Trailing Stop Loss
- เมื่อกำไรถึงเป้า ระบบเลื่อน Stop Loss ตามราคาเพื่อล็อคกำไร

#### Multi-Step Entry (ซอยไม้)
- แบ่งไม้เข้าซื้อหลาย step (MARKET + LIMIT) เพื่อ average ราคาที่ดีขึ้น

### 🎯 3. Recruiting & Strategy Suitability (ใหม่)

#### HunterAgent
- ดึง top tickers พร้อม OI + Funding data
- ถ้าระบุ `strategyType` จะ pre-compute **market regime** (ADX + BB Width) ของแต่ละเหรียญก่อนส่งให้ AI เลือก
- Grid → กรองเหรียญ sideway (ADX < 25, BBW < 5%)
- Scalp → กรองเหรียญ volatile (momentum สูง)
- Trend → กรองเหรียญ trending (ADX > 25)

#### MarketScanner
- `assessSuitability(symbol, strategyType, interval)` — คำนวณ ADX + BB Width + price drift แล้วให้ suitability score 0-100
- `scanTopUSDT(limit, mode)` — รองรับ mode `grid` (กรอง `|priceChange| < 5%`) เพิ่มเติมจาก scout/dip/precision

### 🐳 4. Modern Infrastructure & Security
- **Docker Dev Mode (Hot-Reload):** แก้โค้ดแล้วอัปเดตทันที
- **Lean Multi-Stage Images:** Production image ขนาดเล็ก
- **Unified Environment:** สลับ Testnet/Live ได้ง่ายผ่าน `.env`

---

## 🛠 วิธีเริ่มต้นใช้งาน (Quick Start)

1. **ตั้งค่ากุญแจ:** แก้ไขไฟล์ `.env` ใส่ API Key ของ Binance และ OpenRouter
2. **รันระบบ:**
    ```powershell
    docker compose up --build -d
    ```
3. **เข้าใช้งาน:**
    - Frontend: `http://localhost:4000`
    - API: `http://localhost:4001`
    - Strategies metadata: `http://localhost:4000/strategies`

### PM2 Start

ถ้าต้องการรันแบบ process manager ให้ใช้ `pm2` แทน `start.ps1`

1. ติดตั้ง `pm2`
    ```powershell
    npm.cmd install -g pm2
    ```
2. build frontend ก่อน
    ```powershell
    npm.cmd run build
    ```
3. start ทุก service
    ```powershell
    .\pm2-start.ps1
    ```
4. ดูสถานะ / logs
    ```powershell
    pm2.cmd status
    pm2.cmd logs
    ```
5. ถ้าต้องการให้ process list คงอยู่
    ```powershell
    pm2.cmd save
    ```

ถ้าต้องการ stop
```powershell
.\pm2-stop.ps1
```

Services ที่ถูก start จาก `pm2`
- `trading-frontend` ที่ `http://localhost:4000`
- `trading-api` ที่ `http://localhost:4001`
- `strategy-ai` ที่ `http://localhost:8000`
- `quant-engine` ที่ `http://localhost:8002`
- `polymarket-dashboard` ที่ `http://localhost:8080`
- `polymarket-agent` แบบ `--dry-run` เป็นค่าเริ่มต้น

---

## 📡 Key API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/strategies` | Strategy metadata + suitability hints + microstructure filter rules |
| POST | `/api/binance/ai-hunt` | Hunt best symbols — รับ `strategyType` เพื่อ pre-filter ตาม market regime |
| GET | `/api/binance/market-scan` | Scan top USDT pairs — รองรับ mode `grid` |
| POST | `/api/forward-test/start` | เริ่มบอท |
| GET | `/api/forward-test/summary` | สรุปสถานะบอททั้งหมด |

---

## 📝 บันทึกการพัฒนา (Development Log)
- **2026-04-09:** เพิ่ม Microstructure Filter (OI + Funding) ก่อนเปิด position, Strategy Suitability Check (ADX + BBWidth) ใน Recruiting, `/strategies` endpoint
- **2026-04-06:** เพิ่มระบบ AI Mistakes Memory และ Adaptive Trailing Stop
- **2026-04-05:** ปรับปรุง Docker Optimization และ ระบบ API Proxy
- **2026-04-04:** พัฒนา AI Portfolio Manager และ Hunter Bot
