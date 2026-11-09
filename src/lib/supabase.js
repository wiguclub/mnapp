const STORAGE_KEY = 'flowwallet_multiuser_v2';
const SESSION_USER_KEY = 'flowwallet_active_session_v2';

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

// Clean empty initial state (no fake/hardcoded users!)
export function createEmptyAppState() {
  return {
    users: [],
    familyGroups: [],
    accounts: [],
    installments: [],
    transactions: [],
    loans: [],
  };
}

export function loadAppState() {
  if (typeof window === 'undefined') return createEmptyAppState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const empty = createEmptyAppState();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(empty));
      return empty;
    }
    return JSON.parse(raw);
  } catch {
    return createEmptyAppState();
  }
}

export function saveAppState(state) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function loadCurrentUser() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SESSION_USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveCurrentUser(user) {
  if (typeof window === 'undefined') return;
  if (!user) {
    window.localStorage.removeItem(SESSION_USER_KEY);
  } else {
    window.localStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
  }
}

// Decode JWT payload (for Google Identity Services ID Token or Supabase JWT)
export function decodeJwtPayload(token) {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
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
