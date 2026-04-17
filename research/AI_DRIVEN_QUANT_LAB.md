---
tags: [ai, roadmap, quant-engine, automation]
---
# AI-Driven Quant Lab: Roadmap & Capability Map

เอกสารสรุปแผนงานและสถานะปัจจุบันของระบบ AI อัตโนมัติในโครงการ CryptoSmartTrade

---

## 🚀 1. Autonomous Alpha Factory (ฝ่ายวิจัยและสร้าง)
เป้าหมาย: สร้างกลยุทธ์ใหม่ๆ จากข้อมูลงานวิจัยและโซเชียลมีเดียแบบพึ่งพาคนให้น้อยที่สุด

| Component | Description | Status |
|---|---|---|
| **ScoutAgent** | ค้นหาไอเดีย Alpha จาก Web, Twitter, GitHub และ Papers | 🔴 Not Started |
| **AlphaAgent** | แปลงไอเดียเป็นโค้ด Python (VectorBT) ผ่าน LLM | 🟡 Partial (Concept logic ready) |
| **ValidationAgent**| รัน Backtest, WFA และคำนวณ Metrics เพื่อคัดกรอง | 🟡 Partial (VectorBT integrated) |
| **Review Dashboard**| UI สำหรับ Admin ตรวจสอบและอนุมัติกลยุทธ์ใหม่ | 🔴 Not Started |
| **Automated Deploy**| ระบบติดตั้งกลยุทธ์อัตโนมัติหลังได้รับการอนุมัติ | 🔴 Not Started |

---

## 🛠️ 2. Adaptive Strategy Tuning (ฝ่ายช่างเทคนิคและซ่อมบำรุง)
เป้าหมาย: รักษาประสิทธิภาพของกลยุทธ์เดิม (Anti-Aging) ให้ทันตลาดเสมอ

| Component | Description | Status |
|---|---|---|
| **Performance Drift**| ตรวจสอบว่าผลเทรดจริงแย่กว่า Backtest หรือไม่ (Decay Detection) | 🟡 Partial (Trade Logger ready) |
| **TunningService** | ใช้ Optuna (Bayesian Opt) ค้นหา Parameter ที่ดีที่สุดประจำวัน | 🔴 Not Started |
| **Regime Switcher** | เปลี่ยน Preset กลยุทธ์ตามสภาวะตลาด (Trend/Sideway) | 🔴 Not Started |
| **Seamless Hot-Reload**| อัปเดตพารามิเตอร์บอททันทีผ่าน Database โดยไม่หยุดบอท | 🟡 Partial (SQLite logic ready) |
| **Optimization Report**| สรุปผลการปรับจูนส่งให้ Admin พิจารณาทุกครั้ง | 🔴 Not Started |

---

## 🧠 3. Intelligence & Infrastructure (ระบบสนับสนุน)

| Component | Description | Status |
|---|---|---|
| **Vectorized Engine** | ประมวลผลข้อมูลปริมาณมากผ่าน Python (FastAPI) | 🟢 Completed |
| **Data Layer (SQLite)**| ศูนย์กลางข้อมูลบอทและการเทรดแบบ Centralized | 🟢 Completed |
| **Resilience System** | Safety features เช่น Circuit Breaker และ Quarantine | 🟢 Completed |
| **Research Brain** | ระบบเอกสารที่ AI และมนุษย์อ่านและเขียนร่วมกันได้ | 🟢 Completed |

---
**หมายเหตุสัญลักษณ์:**
- 🟢 **Completed**: ใช้งานได้จริงแล้ว
- 🟡 **Partial**: มีโครงสร้างพื้นฐานหรือแนวคิดรองรับแล้ว แต่ต้องต่อยอด
- 🔴 **Not Started**: อยู่ในแผนพัฒนา (Roadmap)
