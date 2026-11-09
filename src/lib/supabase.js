const STORAGE_KEY = 'flowwallet_app_state_v1';
const CURRENT_USER_KEY = 'flowwallet_current_user_v1';

export const EXPENSE_CATEGORIES = [
  { id: 'food', label: 'อาหาร & เครื่องดื่ม', icon: '🍜', color: '#ef4444' },
  { id: 'shopping', label: 'ช้อปปิ้ง & ของใช้', icon: '🛍️', color: '#f97316' },
  { id: 'transport', label: 'เดินทาง & น้ำมัน', icon: '🚗', color: '#eab308' },
  { id: 'home', label: 'ค่าบ้าน & น้ำไฟเน็ต', icon: '🏠', color: '#06b6d4' },
  { id: 'entertainment', label: 'บันเทิง & ซับสคริปชัน', icon: '🎬', color: '#8b5cf6' },
  { id: 'health', label: 'สุขภาพ & ประกัน', icon: '💊', color: '#ec4899' },
  { id: 'family', label: 'ครอบครัว & สัตว์เลี้ยง', icon: '👨‍👩‍👧', color: '#14b8a6' },
  { id: 'other_exp', label: 'รายจ่ายอื่นๆ', icon: '📦', color: '#64748b' },
];

export const INCOME_CATEGORIES = [
  { id: 'salary', label: 'เงินเดือนประจำ', icon: '💼', color: '#10b981' },
  { id: 'freelance', label: 'งานเสริม / ฟรีแลนซ์', icon: '💻', color: '#3b82f6' },
  { id: 'investment', label: 'ปันผล / ดอกเบี้ย', icon: '📈', color: '#6366f1' },
  { id: 'bonus', label: 'โบนัส / ของขวัญ', icon: '🎁', color: '#f59e0b' },
  { id: 'other_inc', label: 'รายรับอื่นๆ', icon: '✨', color: '#14b8a6' },
];

export const ACCOUNT_TYPE_META = {
  cash: { label: 'เงินสด', badge: 'เงินสด', icon: '💵', isLiability: false },
  bank: { label: 'บัญชีธนาคาร', badge: 'ธนาคาร', icon: '🏦', isLiability: false },
  ewallet: { label: 'E-Wallet', badge: 'วอลเล็ท', icon: '📱', isLiability: false },
  credit_card: { label: 'บัตรเครดิต (ใช้ก่อนจ่ายทีหลัง)', badge: 'บัตรเครดิต', icon: '💳', isLiability: true },
  bnpl: { label: 'สินเชื่อ / PayLater (ใช้ก่อนจ่ายทีหลัง)', badge: 'PayLater', icon: '⚡', isLiability: true },
};

export function createInitialSeedData() {
  const familyId = 'fam-home-2026';
  const today = new Date().toISOString().slice(0, 10);

  return {
    users: [
      {
        email: 'sutti.owner@gmail.com',
        name: 'คุณ (เจ้าของบัญชีหลัก)',
        avatar: 'S',
        familyId,
      },
      {
        email: 'partner.home@gmail.com',
        name: 'เมย์ (คนในบ้าน)',
        avatar: 'M',
        familyId,
      },
    ],
    familyGroups: [
      {
        id: familyId,
        name: 'บ้านของเรา (Family Space)',
        inviteCode: 'HOME2026',
        ownerEmail: 'sutti.owner@gmail.com',
        memberEmails: ['sutti.owner@gmail.com', 'partner.home@gmail.com'],
        createdAt: today,
      },
    ],
    accounts: [
      {
        id: 'acc-kbank-main',
        ownerEmail: 'sutti.owner@gmail.com',
        ownerName: 'คุณ (เจ้าของบัญชีหลัก)',
        familyId,
        isSharedWithFamily: false,
        name: 'กสิกรไทย (เงินเดือน)',
        type: 'bank',
        balance: 48500,
        creditLimit: 0,
        usedAmount: 0,
        statementDay: 1,
        dueDay: 1,
        color: '#059669',
        createdAt: today,
      },
      {
        id: 'acc-cash-wallet',
        ownerEmail: 'sutti.owner@gmail.com',
        ownerName: 'คุณ (เจ้าของบัญชีหลัก)',
        familyId,
        isSharedWithFamily: false,
        name: 'กระเป๋าเงินสดติดตัว',
        type: 'cash',
        balance: 3200,
        creditLimit: 0,
        usedAmount: 0,
        statementDay: 1,
        dueDay: 1,
        color: '#0284c7',
        createdAt: today,
      },
      {
        id: 'acc-family-scb',
        ownerEmail: 'sutti.owner@gmail.com',
        ownerName: 'คุณ (เจ้าของบัญชีหลัก)',
        familyId,
        isSharedWithFamily: true,
        name: 'SCB กองกลางของบ้าน',
        type: 'bank',
        balance: 26400,
        creditLimit: 0,
        usedAmount: 0,
        statementDay: 1,
        dueDay: 1,
        color: '#7c3aed',
        createdAt: today,
      },
      {
        id: 'acc-partner-bank',
        ownerEmail: 'partner.home@gmail.com',
        ownerName: 'เมย์ (คนในบ้าน)',
        familyId,
        isSharedWithFamily: true,
        name: 'กรุงไทย (เงินออมบ้าน - เมย์)',
        type: 'bank',
        balance: 35000,
        creditLimit: 0,
        usedAmount: 0,
        statementDay: 1,
        dueDay: 1,
        color: '#db2777',
        createdAt: today,
      },
      {
        id: 'acc-cc-ktc',
        ownerEmail: 'sutti.owner@gmail.com',
        ownerName: 'คุณ (เจ้าของบัญชีหลัก)',
        familyId,
        isSharedWithFamily: true,
        name: 'บัตรเครดิต KTC Signature',
        type: 'credit_card',
        balance: 0,
        creditLimit: 80000,
        usedAmount: 14800,
        statementDay: 25,
        dueDay: 10,
        color: '#1e293b',
        createdAt: today,
      },
      {
        id: 'acc-bnpl-spay',
        ownerEmail: 'sutti.owner@gmail.com',
        ownerName: 'คุณ (เจ้าของบัญชีหลัก)',
        familyId,
        isSharedWithFamily: false,
        name: 'SPayLater (ใช้ก่อนจ่ายทีหลัง)',
        type: 'bnpl',
        balance: 0,
        creditLimit: 30000,
        usedAmount: 4500,
        statementDay: 1,
        dueDay: 10,
        color: '#ea580c',
        createdAt: today,
      },
      {
        id: 'acc-partner-cc',
        ownerEmail: 'partner.home@gmail.com',
        ownerName: 'เมย์ (คนในบ้าน)',
        familyId,
        isSharedWithFamily: true,
        name: 'บัตรเครดิต Central The 1 (เมย์)',
        type: 'credit_card',
        balance: 0,
        creditLimit: 50000,
        usedAmount: 6200,
        statementDay: 20,
        dueDay: 5,
        color: '#b91c1c',
        createdAt: today,
      },
    ],
    installments: [
      {
        id: 'inst-1',
        accountId: 'acc-cc-ktc',
        ownerEmail: 'sutti.owner@gmail.com',
        ownerName: 'คุณ (เจ้าของบัญชีหลัก)',
        isSharedWithFamily: true,
        title: 'ผ่อนเครื่องซักผ้า LG เข้าบ้าน (0% 10 เดือน)',
        totalAmount: 18000,
        totalMonths: 10,
        paidMonths: 4,
        monthlyAmount: 1800,
        interestRate: 0,
        startDate: today,
        createdAt: today,
      },
      {
        id: 'inst-2',
        accountId: 'acc-bnpl-spay',
        ownerEmail: 'sutti.owner@gmail.com',
        ownerName: 'คุณ (เจ้าของบัญชีหลัก)',
        isSharedWithFamily: false,
        title: 'ผ่อนหูฟัง Sony WH-1000XM5 (0% 6 เดือน)',
        totalAmount: 9000,
        totalMonths: 6,
        paidMonths: 3,
        monthlyAmount: 1500,
        interestRate: 0,
        startDate: today,
        createdAt: today,
      },
    ],
    transactions: [
      {
        id: 'tx-1',
        ownerEmail: 'sutti.owner@gmail.com',
        ownerName: 'คุณ (เจ้าของบัญชีหลัก)',
        isSharedWithFamily: false,
        type: 'income',
        amount: 55000,
        category: 'salary',
        note: 'เงินเดือนเข้ากสิกรไทย',
        accountId: 'acc-kbank-main',
        txDate: today,
        createdAt: today,
      },
      {
        id: 'tx-2',
        ownerEmail: 'sutti.owner@gmail.com',
        ownerName: 'คุณ (เจ้าของบัญชีหลัก)',
        isSharedWithFamily: true,
        type: 'expense',
        amount: 2450,
        category: 'home',
        note: 'จ่ายค่าไฟ + ค่าเน็ตบ้าน (รูดบัตร KTC)',
        accountId: 'acc-cc-ktc',
        txDate: today,
        createdAt: today,
      },
      {
        id: 'tx-3',
        ownerEmail: 'partner.home@gmail.com',
        ownerName: 'เมย์ (คนในบ้าน)',
        isSharedWithFamily: true,
        type: 'expense',
        amount: 1890,
        category: 'food',
        note: 'ซื้อของสดแม็คโครเข้าตู้เย็นบ้าน',
        accountId: 'acc-partner-cc',
        txDate: today,
        createdAt: today,
      },
      {
        id: 'tx-4',
        ownerEmail: 'sutti.owner@gmail.com',
        ownerName: 'คุณ (เจ้าของบัญชีหลัก)',
        isSharedWithFamily: false,
        type: 'expense',
        amount: 320,
        category: 'food',
        note: 'กาแฟ + ข้าวเที่ยงที่ออฟฟิศ',
        accountId: 'acc-cash-wallet',
        txDate: today,
        createdAt: today,
      },
      {
        id: 'tx-5',
        ownerEmail: 'sutti.owner@gmail.com',
        ownerName: 'คุณ (เจ้าของบัญชีหลัก)',
        isSharedWithFamily: true,
        type: 'card_payment',
        amount: 5000,
        category: 'transfer',
        note: 'จ่ายบิลบัตรเครดิต KTC บางส่วน',
        accountId: 'acc-kbank-main',
        toAccountId: 'acc-cc-ktc',
        txDate: today,
        createdAt: today,
      },
    ],
    loans: [
      {
        id: 'loan-1',
        ownerEmail: 'sutti.owner@gmail.com',
        ownerName: 'คุณ (เจ้าของบัญชีหลัก)',
        isSharedWithFamily: true,
        loanType: 'lend',
        personName: 'บอย (เพื่อนออฟฟิศ)',
        totalAmount: 5000,
        paidAmount: 2000,
        accountId: 'acc-kbank-main',
        dueDate: today,
        note: 'ยืมจ่ายค่าซ่อมรถ นัดคืนสิ้นเดือน',
        status: 'active',
        repayments: [
          {
            id: 'rep-1',
            amount: 2000,
            accountId: 'acc-kbank-main',
            date: today,
            note: 'โอนคืนงวดแรกเข้ากสิกร',
          },
        ],
        createdAt: today,
      },
      {
        id: 'loan-2',
        ownerEmail: 'sutti.owner@gmail.com',
        ownerName: 'คุณ (เจ้าของบัญชีหลัก)',
        isSharedWithFamily: true,
        loanType: 'borrow',
        personName: 'คุณแม่',
        totalAmount: 15000,
        paidAmount: 5000,
        accountId: 'acc-family-scb',
        dueDate: today,
        note: 'ยืมมาสำรองค่าต่อประกันรถยนต์',
        status: 'active',
        repayments: [
          {
            id: 'rep-2',
            amount: 5000,
            accountId: 'acc-family-scb',
            date: today,
            note: 'โอนคืนคุณแม่งวดที่ 1',
          },
        ],
        createdAt: today,
      },
    ],
  };
}

export function loadAppState() {
  if (typeof window === 'undefined') return createInitialSeedData();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seed = createInitialSeedData();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    return JSON.parse(raw);
  } catch {
    return createInitialSeedData();
  }
}

export function saveAppState(state) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function loadCurrentUser() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CURRENT_USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveCurrentUser(user) {
  if (typeof window === 'undefined') return;
  if (!user) {
    window.localStorage.removeItem(CURRENT_USER_KEY);
  } else {
    window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  }
}

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function startSupabaseGoogleLogin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || typeof window === 'undefined') return;
  const redirectTo = encodeURIComponent(window.location.origin);
  window.location.href = `${url}/auth/v1/authorize?provider=google&redirect_to=${redirectTo}`;
}
