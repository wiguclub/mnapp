import './globals.css';

export const metadata = {
  title: 'FlowWallet | รายรับ-รายจ่าย หลายบัญชี บัตรเครดิต ยืม-ให้ยืม & แชร์คนในบ้าน',
  description: 'แอปรายรับรายจ่ายครบวงจร รองรับหลายบัญชี บัตรเครดิต ใช้ก่อนจ่ายทีหลัง ยืมเงิน/ให้ยืมเงิน และแชร์ยอดรวมกับคนในบ้าน ล็อกอินด้วย Gmail',
  manifest: '/manifest.json',
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
