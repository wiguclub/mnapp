const STORAGE_KEY = 'flowwallet_multiuser_v3';
const SESSION_USER_KEY = 'flowwallet_active_session_v3';
const CLOUD_SYNC_URL = 'https://api.restful-api.dev/objects/ff808181a09d98f701a1c36e3c4d77d0';

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

export function createEmptyAppState() {
  return {
    users: [],
    familyGroups: [],
    shareConnections: [], // { id, fromEmail, fromName, toEmail, status: 'pending' | 'accepted' | 'paused', shareBack: true, updatedAt }
    accounts: [],
    installments: [],
    transactions: [],
    loans: [],
    deletedIds: [],
  };
}

export function normalizeState(raw) {
  const base = createEmptyAppState();
  if (!raw || typeof raw !== 'object') return base;
  return {
    users: Array.isArray(raw.users) ? raw.users : [],
    familyGroups: Array.isArray(raw.familyGroups) ? raw.familyGroups : [],
    shareConnections: Array.isArray(raw.shareConnections) ? raw.shareConnections : [],
    accounts: Array.isArray(raw.accounts) ? raw.accounts : [],
    installments: Array.isArray(raw.installments) ? raw.installments : [],
    transactions: Array.isArray(raw.transactions) ? raw.transactions : [],
    loans: Array.isArray(raw.loans) ? raw.loans : [],
    deletedIds: Array.isArray(raw.deletedIds) ? raw.deletedIds : [],
  };
}

// Merge local state and cloud state by item ID and updatedAt timestamp
export function mergeStates(localRaw, cloudRaw) {
  const local = normalizeState(localRaw);
  const cloud = normalizeState(cloudRaw);

  const deletedSet = new Set([...(local.deletedIds || []), ...(cloud.deletedIds || [])]);

  const mergeById = (arrA, arrB, keyField = 'id') => {
    const map = new Map();
    for (const item of [...arrA, ...arrB]) {
      if (!item || !item[keyField]) continue;
      const k = item[keyField];
      if (deletedSet.has(k)) continue;
      const existing = map.get(k);
      if (!existing) {
        map.set(k, item);
      } else {
        const tNew = Number(item.updatedAt || 0);
        const tOld = Number(existing.updatedAt || 0);
        if (tNew >= tOld) {
          map.set(k, item);
        }
      }
    }
    return Array.from(map.values());
  };

  return {
    users: mergeById(local.users, cloud.users, 'email'),
    familyGroups: mergeById(local.familyGroups, cloud.familyGroups, 'id'),
    shareConnections: mergeById(local.shareConnections, cloud.shareConnections, 'id'),
    accounts: mergeById(local.accounts, cloud.accounts, 'id'),
    installments: mergeById(local.installments, cloud.installments, 'id'),
    transactions: mergeById(local.transactions, cloud.transactions, 'id'),
    loans: mergeById(local.loans, cloud.loans, 'id'),
    deletedIds: Array.from(deletedSet).slice(-500),
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
    return normalizeState(JSON.parse(raw));
  } catch {
    return createEmptyAppState();
  }
}

export function saveAppState(state) {
  if (typeof window === 'undefined') return;
  const normalized = normalizeState(state);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
}

// Fetch latest state from Cloud and merge with local
export async function syncWithCloud(currentState) {
  try {
    const res = await fetch(CLOUD_SYNC_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return normalizeState(currentState);
    const json = await res.json();
    const cloudData = json?.data || createEmptyAppState();
    const merged = mergeStates(currentState, cloudData);
    saveAppState(merged);
    return merged;
  } catch {
    return normalizeState(currentState);
  }
}

// Push updated state to Cloud (merges with latest cloud state first to prevent overwriting)
export async function pushStateToCloud(newState) {
  try {
    saveAppState(newState);
    const res = await fetch(CLOUD_SYNC_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    let merged = normalizeState(newState);
    if (res.ok) {
      const json = await res.json();
      merged = mergeStates(json?.data, newState);
    }
    saveAppState(merged);
    await fetch(CLOUD_SYNC_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'flowwallet-store',
        data: merged,
      }),
    });
    return merged;
  } catch {
    return normalizeState(newState);
  }
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
