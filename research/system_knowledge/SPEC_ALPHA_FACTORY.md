# Technical Specification: Autonomous Alpha Factory

เอกสารข้อกำหนดทางเทคนิคสำหรับการพัฒนาหน่วยวิจัยและสเตชั่นสร้างกลยุทธ์อัตโนมัติ

---

## 1. ScoutAgent (หน่วยสอดแนม Alpha)
**Objective**: ค้นหาไอเดียและเทคนิคจากภายนอกมาสรุปเป็นองค์ความรู้

### 🧰 เครื่องมือ & เทคโนโลยี:
- **Sources**: 
    - **Web Research (Tavily/Perplexity)**: เจาะลึก Medium, Substack และ Blog โพสต์สาย Quant เพื่อตามติดเทรนด์ตลาดล่าสุด
    - **Social Media (X/Reddit)**: ติดตาม Alpha จากเหล่า Quants และ Pine Script Developers ใน Crypto Twitter (CT)
    - **Academic Papers (ArXiv/SSRN)**: ค้นหาความได้เปรียบทางสถิติ (Statistical Edge) จากงานวิจัยระดับสถาบัน
    - **GitHub Repositories**: ตรวจสอบ Library และโมเดลวิเคราะห์ข้อมูล Market Microstructure ใหม่ๆ
- **Workflow**:
    1.  ตั้งเวลา (Schedule) รันวันละ 1-2 ครั้ง
    2.  AI ค้นหาคำสำคัญเช่น "crypto trading alpha", "vectorbt strategy", "price microstructure ideas"
    3.  AI สรุปเป็นไฟล์ Markdown เก็บไว้ใน `research/scout_reports/`

---

## 2. AlphaAgent (วิศวกรออกแบบกลยุทธ์)
**Objective**: เปลี่ยนไอเดียที่เป็นตัวอักษรให้กลายเป็นโค้ด Python ที่รันได้จริง

### 📜 Logic & Flow:
- **Context Injection**: เราจะป้อน "Blueprint" ของระบบให้ AI รู้จัก (List ของ Indicators ที่เรามี, วิธีการดึงข้อมูลจาก Database)
- **Template-Based Generation**: AI ต้องเขียนโค้ดตามโครงสร้างของ `strategy-ai/templates/strategy_base.py`
- **Error Correction**: หากโค้ดมี Syntax Error ระบบจะส่ง Error กลับไปให้ AI แก้ไขอัตโนมัติ (Self-Healing)

---

## 3. Sandbox Executor (ความปลอดภัยและการทดสอบ)
**Objective**: รันโค้ดที่ AI สร้างขึ้นในสภาพแวดล้อมที่จำกัดและปลอดภัย

### 🔒 Security:
- **Environment**: ใช้ Docker Container หรือ `RestrictedPython` ในการรันโค้ดที่สร้างโดย AI
- **Limitations**: จำกัด Timeout (30s), จำกัด Memory (512MB), และห้ามเข้าถึงระบบ Network ภายนอกยกเว้น Database ของเรา

---

## 4. Backtest & Validation Pipeline
**Objective**: คัดกรองกลยุทธ์ด้วยตัวเลขสถิติ

### 📊 Validation Steps:
1.  **Mini Backtest**: รันข้อมูล 7 วันเพื่อดูว่าสัญญาณ "เทรดได้จริง" หรือไม่
2.  **Walk-Forward Analysis**: รัน 3 Steps (Rolling Window) ตามแผนงาน WFA
3.  **Metrics Reporting**: บันทึก Sharpe Ratio, MaxDD, และ Profit Factor ลงใน `Proposed_Strategies` table

---

## 5. Alpha Review Dashboard (UI)
**Objective**: พื้นที่ให้ Admin พิจารณาและอนุมัติงานของ AI

### 🖥️ UI Components:
- **Proposal List**: การ์ดแสดงไอเดียกลยุทธ์ที่ AI เสนอ
- **Code Viewer**: ตรวจสอบโค้ดที่ AI เขียน
- **Performance Summary**: กราฟแสดงผลเทส (PnL Curve) และค่าสถิติต่างๆ
- **Deploy Button**: ปุ่มกดสั้นๆ เพื่อส่งบอทลงสนามกระเป๋าจำลอง (Paper Training)

---

## 📅 แผนการพัฒนาระยะสั้น (Next Actions):
1.  **[x]** พัฒนา `ScoutAgent` Prototype สำหรับดึงไอเดียเบื้องต้น
2.  **[x]** พัฒนา `AlphaAgent` ในฝั่ง Python เพื่อรับ Prompt และคืนค่าเป็นโค้ด (พร้อมระบบ Self-Correction)
3.  **[ ]** สร้าง UI หน้า `/quant-engine` ให้รองรับการดู Agent Logs และ Scout Reports
4.  **[ ]** พัฒนา Alpha Review Dashboard สำหรับอนุมัติกลยุทธ์เข้าสู่ Paper Trading

---
**ผู้อนุมัติ (Admin)**: ___________________ (ลงชื่อเมื่อพร้อมเริ่ม Phase 1)
