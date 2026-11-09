# 💳 FlowWallet — แอปรายรับ-รายจ่าย หลายบัญชี บัตรเครดิต ยืม/ให้ยืม & แชร์ยอดรวมคนในบ้าน

แอปจัดการการเงินส่วนบุคคลและครอบครัว (Web App + Mobile PWA) พัฒนาด้วย **Next.js (App Router)** พร้อมนำขึ้น Git และ Deploy บน **Vercel** ได้ทันที

---

## ✨ ฟีเจอร์หลัก (Features)

1. **🔐 ระบบเข้าสู่ระบบด้วย Gmail (Google Login Gate)**
   - บังคับล็อกอินด้วย Gmail ก่อนเข้าใช้งาน แยกข้อมูลรายบุคคลชัดเจน
   - มีปุ่มสลับบัญชี Gmail แบบ 1-Click เพื่อทดสอบมุมมองของคนในบ้านแต่ละคนได้ทันที
   - รองรับการเชื่อมต่อ **Supabase Google OAuth** สำหรับใช้งานจริงบน Cloud

2. **🏦 ระบบหลายบัญชี (Multi-Accounts: สินทรัพย์ vs หนี้สิน)**
   - **บัญชีสินทรัพย์:** เงินสด (`Cash`), บัญชีธนาคาร (`Bank`), E-Wallet (`TrueMoney / ShopeePay`)
   - **บัตรเครดิต & ใช้ก่อนจ่ายทีหลัง (`Credit Card & BNPL`):**
     - ตั้งวงเงินบัตร (`Credit Limit`), วันสรุปยอดบิล (`Statement Day`), และวันครบกำหนดชำระ (`Due Day`)
     - คำนวณยอดใช้ไป (`Used Amount`) และวงเงินคงเหลืออัตโนมัติ
     - **ปุ่มโอนจ่ายบิลบัตรเครดิต:** หักเงินจากบัญชีธนาคารมาเคลียร์ยอดหนี้บัตรและคืนวงเงินโดยไม่นับเป็นรายจ่ายซ้ำ
     - **ระบบผ่อนชำระ (`Installments`):** รูดผ่อนสินค้า 0% (เช่น 3, 6, 10, 12, 24 เดือน) พร้อมติดตามจำนวนงวดที่จ่ายแล้วและงวดคงเหลือ

3. **🤝 ระบบยืมเงิน & ให้คนอื่นยืมเงิน (Loans & Debt Tracker)**
   - **🟢 ลูกหนี้ (เราให้คนอื่นยืม):** หักเงินออกจากบัญชีธนาคารไปพักไว้ในยอดรอรับคืน (ไม่ปนกับค่าใช้จ่ายปกติ)
   - **🟠 เจ้าหนี้ (เรายืมคนอื่นมา):** รับเงินเข้าบัญชีพร้อมบันทึกยอดหนี้ที่ต้องคืน
   - รองรับ **การทยอยคืนเงินบางส่วน หรือ คืนเต็มจำนวน** พร้อมประวัติการชำระและปุ่ม **คัดลอกสรุปยอดส่ง LINE**

4. **🏠 แชร์ให้เห็นยอดรวมกับคนในบ้าน (Family / Household Sharing)**
   - สร้างบ้านพร้อม **รหัสเชิญ (`Invite Code`)** หรือชวนสมาชิกในบ้านด้วย Gmail
   - เลือกตั้งค่าแต่ละบัญชี/บัตรเครดิตได้ว่าจะเป็น **🔒 ส่วนตัว** หรือ **🏠 แชร์กับบ้าน**
   - ปุ่มสลับมุมมองด้านบนสุด: **👤 ส่วนตัว** vs **🏠 ยอดรวมคนในบ้าน**

5. **📱 รองรับทั้ง Mobile App (PWA) & Desktop Report**
   - **บนมือถือ:** แถบเมนูด้านล่าง (Bottom Bar) + ปุ่มลัด `＋` กดจดมือเดียวสะดวก และกด *Add to Home Screen* เพื่อติดตั้งเป็นแอปเต็มจอได้
   - **บน Desktop:** Sidebar เต็มรูปแบบ พร้อมหน้าวิเคราะห์กราฟสัดส่วนรายจ่ายและปุ่ม **Export CSV (Excel)**

---

## 🚀 วิธีรันในเครื่อง (Local Development)

```bash
npm run dev
```
แล้วเปิดเบราว์เซอร์ไปที่ `http://localhost:3000`

---

## ☁️ วิธีเอาขึ้น Git และ Deploy บน Vercel

1. Push โค้ดขึ้น GitHub Repository ของคุณ:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: FlowWallet personal & family finance app"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main
   ```
2. เข้าเว็บ [Vercel](https://vercel.com) -> กด **Add New Project** -> เลือก Repository นี้ แล้วกด **Deploy** ได้เลย!
3. *(ทางเลือก)* หากต้องการเชื่อมฐานข้อมูลจริงบน Supabase:
   - รันไฟล์ SQL ใน [`supabase/schema.sql`](./supabase/schema.sql) บน Supabase SQL Editor
   - ตั้งค่า `NEXT_PUBLIC_SUPABASE_URL` และ `NEXT_PUBLIC_SUPABASE_ANON_KEY` ในหน้า Environment Variables ของ Vercel
"# mnapp" 
