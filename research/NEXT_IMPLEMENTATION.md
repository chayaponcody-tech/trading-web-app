# 🚀 Checklist: Next Implementation Phase (Technical Roadmap)

เอกสารฉบับนี้ใช้สำหรับติดตามความคืบหน้าการพัฒนาเชิงเทคนิค (Priority จากบนลงล่าง)

---

## 🟢 Phase 1: SaaS Foundation (Infrastructure)
*เป้าหมาย: ทำให้ระบบรองรับผู้ใช้หลายคนและมีความปลอดภัย*

- [ ] **1. User Auth & Multi-Tenancy:**
    - [ ] ออกแบบ `User` schema ใน Database สำหรับรองรับสมาชิกหลายคน
    - [ ] ระบบ Login/Register และ JWT Authentication
    - [ ] ระบบ Encrypted Store สำหรับเก็บ Binance/Exchange API Keys (ความปลอดภัยสูง)
- [ ] **2. Centralized Config UI:**
    - [ ] หน้าเว็บสำหรับปรับแก้ TQI Thresholds และ Params (ไม่ต้องแก้โค้ด)
    - [ ] ระบบบันทึก Config แยกตามรายบอท/รายผู้ใช้
- [ ] **3. Performance Dashboard:**
    - [ ] ระบบคำนวณ Equity Curve แบบ Real-time รายบุคคล
    - [ ] ระบบดึงประวัติการเทรดมาสรุปเป็น Win Rate และ Profit/Loss แยกตามวัน

---

## 🔵 Phase 2: AI Edge & Monetization Logic
*เป้าหมาย: สร้างจุดขายและระบบเก็บเงินเบื้องต้น*

- [ ] **1. "Brain View" (Reflection Logs):**
    - [ ] API ดึงข้อมูล `ai_reflection` log มาแสดงผลที่ Frontend
    - [ ] UI Component แสดงตรรกะ AI เป็นกล่องข้อความอธิบายการตัดสินใจ
- [ ] **2. Affiliate Tracking System (Model A):**
    - [ ] ระบบเช็ค `Affiliate ID` จาก API กระดานเทรดเพื่อปลดล็อกการใช้งาน
    - [ ] ระบบรายงาน Trading Volume เพื่อคำนวณรายได้ Rebate (Admin View)
- [ ] **3. Asset Intelligence Base:**
    - [ ] สร้างระบบ "คลังความรู้รายเหรียญ" ผูกข่าวกับ HunterAgent
    - [ ] ระบบ Sentiment Scoring เจาะจงรายเหรียญ (Social API Ingestion)

---

## 🟡 Phase 3: Advanced Trading & Scale (Model B & C)
*เป้าหมาย: ขยายการทำกำไรและความสามารถของบอท*

- [ ] **1. Profit-Sharing Billing Engine (Model C):**
    - [ ] พัฒนา Logic คำนวณ High-Water Mark (กำไรใหม่ที่ต้องหักส่วนแบ่ง)
    - [ ] ระบบแจ้งเตือนเรียกเก็บเงิน (Invoice System) และหน้าชำระเงิน
- [ ] **2. DEX & On-chain Trading (Model B):**
    - [ ] เชื่อมต่อ Web3 Library (Solana Web3.js / Ethers.js)
    - [ ] ระบบฝัง Routing Fee เข้าไปในออเดอร์ก่อนยิง Transaction
- [ ] **3. Arbitrage Monitor (Phase 4 เดิม):**
    - [ ] ระบบเปรียบเทียบราคาข้าม Exchange (Cross-Exchange Monitor)
    - [ ] ระบบวิเคราะห์กำไรหลังหักค่าธรรมเนียมการโอน (Arbitrage Engine)

---

## 🟣 Phase 4: Marketing & Community
*เป้าหมาย: ดึงดูดผู้ใช้งานใหม่*

- [ ] **1. Performance Card Generator:** ระบบสร้างรูปสรุปกำไรอัตโนมัติ
- [ ] **2. Leaderboard & Gamification:** ระบบจัดอันดับเทรดเดอร์ในระบบ
- [ ] **3. Marketplace Launchpad:** ระบบสำหรับให้เทรดเดอร์ปล่อยเช่ากลยุทธ์

---
*อัปเดตล่าสุด: 2026-04-19 | สถานะ: กำลังดำเนินการ*
