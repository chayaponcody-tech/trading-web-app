---
tags: [quant, alpha, microstructure]
---
# Market Features & Alpha Factors Registry

รายละเอียดของเครื่องมือเชิงปริมาณ (Quant) และปัจจัยทางโครงสร้างตลาด (Microstructure) ที่ใช้กรองสัญญาณ

## 1. Quantitative Factors (ปัจจัยเชิงปริมาณ)

### TQI (Trend Quality Index)
- **ID**: `tqi`
- **Description**: ดัชนีที่วัด "คุณภาพ" ของเทรนด์ว่าแข็งแรงและมีความต่อเนื่องแค่ไหน
- **Range**: 0.0 (No Trend/Noise) ถึง 1.0 (Pure Trend)
- **Components**: Efficiency Ratio, Volatility Stability, Price Structure (Higher Highs).

### Efficiency Ratio (ER)
- **ID**: `er`
- **Description**: วัดความคุ้มค่าของการเคลื่อนที่ของราคา (Trend vs Noise)
- **Formula**: `Net Change / Sum of absolute changes`

### Volatility Ratio
- **ID**: `vol_ratio`
- **Description**: วัดว่าปัจจุบันมีความผันผวนสูงกว่าค่าเฉลี่ยในอดีตนานแค่ไหน เพื่อหลีกเลี่ยงช่วงตลาดคลั่ง (Wild Markets)

## 2. Market Microstructure (โครงสร้างตลาด)

### Funding Rate
- **ID**: `funding`
- **Description**: ค่าธรรมเนียมระหว่าง Long/Short ในตลาด Futures
- **Logic**: Positive Funding = Long เพลีย (Sentiment Bullish เกินไป)

### Open Interest Delta (OI Delta)
- **ID**: `oi_delta`
- **Description**: การเปลี่ยนแปลงของสถานะคงค้าง (Open Interest)
- **Alpha**: ราคาขึ้น + OI ขึ้น = สถาบันกำลังสะสม (Strong Trend) / ราคาขึ้น + OI ลง = Short Squeeze (Trend อาจจบ)

### TDA (Trade Density Analysis)
- **Description**: ปริมาณการซื้อขายที่ระดับราคาต่างๆ เพื่อดูแนวรับแนวต้านเชิงวอลุ่ม (Order Blocks)

---
*อัปเดตล่าสุด: 2026-04-17*
