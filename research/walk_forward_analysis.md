---
tags: [quant, optimization, validation]
---
# Walk-Forward Analysis (WFA) Implementation Guide

## 📌 บทนำ (Introduction)
**Walk-Forward Analysis (WFA)** คือเทคนิคการทดสอบกลยุทธ์การเทรดที่จำลอง "โลกแห่งความจริง" ได้ดีที่สุด โดยการแบ่งข้อมูลย้อนหลังออกเป็นชุดๆ เพื่อใช้สำหรับการ "หาค่าที่เหมาะสม" (In-Sample) และ "การทดสอบจริง" (Out-of-Sample) แบบเลื่อนช่วงเวลาไปข้างหน้า (Rolling Window)

---

## 🛠 ทำไมต้อง WFA? (The Why)
1.  **ป้องกัน Overfitting**: ลดพฤติกรรม "บอทเทพแค่ในอดีต" (Curve Fitting) โดยการบังคับให้บอทต้องรันในข้อมูลที่มันไม่เคยเห็นมาก่อนในขั้นตอนการหาพารามิเตอร์
2.  **วัดค่า Robustness**: หากกลยุทธ์กำไรทั้งใน In-Sample และ Out-of-Sample แสดงว่ากลยุทธ์นั้นมีความทนทานต่อสภาวะตลาดจริง
3.  **Dynamic Adaptation**: ช่วยให้เรารู้ว่าควร "Re-optimize" (ปรับค่าพารามิเตอร์ใหม่) ทุกๆ กี่วัน หรือกี่สัปดาห์

---

## 📐 โครงสร้างการทำงาน (WFA Architecture)

ในระบบของเรา WFA จะทำงานเป็น Pipeline ดังนี้:

### 1. การแบ่งข้อมูล (Data Partitioning)
ข้อมูลจะถูกแบ่งออกเป็น **Windows**:
*   **In-Sample (IS)**: ข้อมูลช่วง 70-80% ของหน้าต่าง (เช่น 3 เดือน) ใช้สำหรับให้ Optuna/VectorBT หาค่า Parameters ที่ดีที่สุด
*   **Out-of-Sample (OOS)**: ข้อมูลช่วง 20-30% ต่อถัดมา (เช่น 1 เดือน) ใช้สำหรับรันกลยุทธ์ด้วยค่าจาก IS เพื่อดูผลกำไรจริง

### 2. รูปแบบที่ใช้: Rolling Window
เราจะขยับกรอบเวลาไปข้างหน้าทีละก้าว:
- **Step 1**: Train(Jan-Mar) → Test(Apr)
- **Step 2**: Train(Feb-Apr) → Test(May)
- **Step 3**: Train(Mar-May) → Test(Jun)
*(กำไรสุทธิทางสถิติจริงๆ คือผลรวมของก้อน Test เท่านั้น)*

---

## 🚀 แผนการ Implement (Implementation Roadmap)

### Phase 1: WFA Engine (Python Side)
เพิ่ม Endpoint ใน `strategy-ai`:
- `POST /strategy/validate/walk-forward`
- **Input**: Symbol, Intervals, Strategy, WFA Config (is_window, oos_window, steps)
- **Logic**:
    1. วนลูปตามจำนวน Steps
    2. ในแต่ละ Step ให้เรียก `run_vbt_optimize` (IS)
    3. นำ Params ที่ดีที่สุดไปรัน Backtest แบบปกติ (OOS)
    4. บันทึกผลลัพธ์แยกแต่ละ Step

### Phase 2: Robustness Metrics
คำนวณ **Walk-Forward Efficiency (WFE)**:
*   `WFE = (Annualized Return OOS) / (Annualized Return IS)`
*   **WFE > 50%**: กลยุทธ์ผ่านเกณฑ์ (หน้ามือกับหลังมือไม่ต่างกันจนเกินไป)
*   **WFE < 30%**: กลยุทธ์มีแนวโน้ม Overfitted (ทิ้งทันที)

### Phase 3: Automated Re-Optimization (Live System)
เชื่อมต่อกับ `BotManager`:
- เมื่อบอทรันไปครบกำหนด (เช่น ทุก 1 สัปดาห์) ระบบจะรัน WFA อัตโนมัติในพื้นหลัง
- หาก Parameter ใหม่ให้ค่า WFE สูงกว่า บอทจะทำการ Hot-Reload ตัวเองด้วยค่าใหม่ทันที

---

## 📊 หน้าจอ UI ที่ต้องการ
1.  **WFA Result Chart**: กราฟแสดงผล PnL ของชุดข้อมูล Out-of-Sample ต่อเนื่องกัน
2.  **Parameter Stability Plot**: กราฟที่แสดงว่าค่าพารามิเตอร์ (เช่น EMA Period) เหวี่ยงมากแค่ไหนในแต่ละช่วงเวลา (ถ้าเหวี่ยงมากแสดงว่าระบบไม่เสถียร)
3.  **Robustness Scorecard**: สรุปคะแนนความเสี่ยงของกลยุทธ์

---
**สถานะ**: ข้อเสนอ (Proposed)
**ความสำคัญ**: สูงสุดสำหรับการส่งกลยุทธ์ AI ไปรันพอร์ตจริง
