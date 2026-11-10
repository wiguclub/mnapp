const STORAGE_KEY = 'flowwallet_multiuser_v3';
const SESSION_USER_KEY = 'flowwallet_active_session_v3';
export const CLOUD_SYNC_TOPIC = 'fw_mnapp_cloud_v5_store';

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
    shareConnections: [],
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
  const cleanLine = (s) =>
    typeof s === 'string' ? s.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim() : s;
  return {
    users: Array.isArray(raw.users)
      ? raw.users.map((u) => (u ? { ...u, name: cleanLine(u.name), email: cleanLine(u.email) } : u))
      : [],
    familyGroups: Array.isArray(raw.familyGroups) ? raw.familyGroups : [],
    shareConnections: Array.isArray(raw.shareConnections) ? raw.shareConnections : [],
    accounts: Array.isArray(raw.accounts)
      ? raw.accounts.map((a) =>
          a ? { ...a, name: cleanLine(a.name), ownerName: cleanLine(a.ownerName) } : a
        )
      : [],
    installments: Array.isArray(raw.installments)
      ? raw.installments.map((inst) =>
          inst ? { ...inst, title: cleanLine(inst.title), ownerName: cleanLine(inst.ownerName) } : inst
        )
      : [],
    transactions: Array.isArray(raw.transactions)
      ? raw.transactions.map((t) =>
          t ? { ...t, note: cleanLine(t.note), ownerName: cleanLine(t.ownerName) } : t
        )
      : [],
    loans: Array.isArray(raw.loans)
      ? raw.loans.map((l) =>
          l
            ? {
                ...l,
                personName: cleanLine(l.personName),
                note: cleanLine(l.note),
                ownerName: cleanLine(l.ownerName),
              }
            : l
        )
      : [],
    deletedIds: Array.isArray(raw.deletedIds) ? raw.deletedIds : [],
  };
}

function deduplicateStarterCashAccounts(accounts) {
  const byOwner = new Map();
  for (const acc of accounts) {
    const owner = (acc.ownerEmail || '').toLowerCase();
    if (!byOwner.has(owner)) byOwner.set(owner, []);
    byOwner.get(owner).push(acc);
  }

  const result = [];
  for (const [, userAccs] of byOwner.entries()) {
    if (userAccs.length <= 1) {
      result.push(...userAccs);
      continue;
    }
    const emptyStarterCash = userAccs.filter(
      (a) => a.type === 'cash' && a.name === 'กระเป๋าเงินสด' && Number(a.balance || 0) === 0
    );
    const nonEmptyOrCustom = userAccs.filter(
      (a) => !(a.type === 'cash' && a.name === 'กระเป๋าเงินสด' && Number(a.balance || 0) === 0)
    );
    if (nonEmptyOrCustom.length > 0) {
      // Keep all real/custom accounts; if none of them is 'กระเป๋าเงินสด', keep at most 1 starter cash account
      const hasEditedCash = nonEmptyOrCustom.some(
        (a) => a.type === 'cash' && a.name === 'กระเป๋าเงินสด'
      );
      if (hasEditedCash) {
        result.push(...nonEmptyOrCustom);
      } else if (emptyStarterCash.length > 0) {
        result.push(emptyStarterCash[0], ...nonEmptyOrCustom);
      } else {
        result.push(...nonEmptyOrCustom);
      }
    } else {
      // All accounts are empty starter cash accounts -> keep only 1
      result.push(emptyStarterCash[0]);
    }
  }
  return result;
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
      const k =
        keyField === 'email' ? String(item[keyField]).toLowerCase() : String(item[keyField]);
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

  const mergedAccounts = deduplicateStarterCashAccounts(
    mergeById(local.accounts, cloud.accounts, 'id')
  );

  return {
    users: mergeById(local.users, cloud.users, 'email'),
    familyGroups: mergeById(local.familyGroups, cloud.familyGroups, 'id'),
    shareConnections: mergeById(local.shareConnections, cloud.shareConnections, 'id'),
    accounts: mergedAccounts,
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

function toAsciiJson(obj) {
  return JSON.stringify(obj).replace(/[\u007F-\uFFFF]/g, (chr) =>
    '\\u' + ('0000' + chr.charCodeAt(0).toString(16)).slice(-4)
  );
}

async function fetchCloudStateFromNtfy() {
  const res = await fetch(
    `https://ntfy.sh/${CLOUD_SYNC_TOPIC}/json?poll=1&since=all&_t=${Date.now()}`,
    {
      method: 'GET',
      cache: 'no-store',
    }
  );
  if (!res.ok) return null;
  const text = await res.text();
  if (!text || !text.trim()) return createEmptyAppState();

  const lines = text
    .trim()
    .split('\n')
    .filter(Boolean);

  const batches = {};
  const batchOrder = [];

  for (const lineStr of lines) {
    try {
      const event = JSON.parse(lineStr);
      if (event.event !== 'message' || !event.message) continue;
      const packet = JSON.parse(event.message);
      if (packet && packet.b && typeof packet.i === 'number' && packet.n) {
        if (!batches[packet.b]) {
          batches[packet.b] = { n: packet.n, parts: {} };
          batchOrder.push(packet.b);
        }
        batches[packet.b].parts[packet.i] = packet.d;
      } else if (packet && Array.isArray(packet.accounts)) {
        // Unchunked legacy packet
        const bId = `legacy-${event.id}`;
        batches[bId] = { n: 1, parts: { 0: JSON.stringify(packet) } };
        batchOrder.push(bId);
      }
    } catch {
      // Ignore malformed message lines
    }
  }

  let accumulated = createEmptyAppState();
  for (const bId of batchOrder) {
    const b = batches[bId];
    if (Object.keys(b.parts).length === b.n) {
      try {
        const joined = Array.from({ length: b.n }, (_, idx) => b.parts[idx]).join('');
        const parsed = JSON.parse(joined);
        accumulated = mergeStates(accumulated, parsed);
      } catch {
        // Ignore broken batch
      }
    }
  }
  return accumulated;
}

async function publishStateToNtfy(state) {
  const raw = toAsciiJson(normalizeState(state));
  const chunkSize = 2800;
  const total = Math.max(1, Math.ceil(raw.length / chunkSize));
  const batchId = `b${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  for (let i = 0; i < total; i++) {
    const chunk = raw.slice(i * chunkSize, (i + 1) * chunkSize);
    const msg = JSON.stringify({ b: batchId, i, n: total, d: chunk });
    await fetch('https://ntfy.sh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: CLOUD_SYNC_TOPIC,
        message: msg,
      }),
    });
  }
}

// Fetch latest state from Cloud and merge with local
// Also pushes local items to Cloud if local has any data not yet on Cloud!
export async function syncWithCloud(currentState) {
  try {
    const local = normalizeState(currentState);
    const cloudData = await fetchCloudStateFromNtfy();
    if (!cloudData) return local;

    const normalizedCloud = normalizeState(cloudData);
    const merged = mergeStates(local, normalizedCloud);
    saveAppState(merged);

    // If local had any data (users, accounts, balances, transactions, loans, connections) not yet in cloudData, push merged to cloud automatically
    const hasLocalContribution =
      (local.users.length > 0 ||
        local.accounts.length > 0 ||
        local.transactions.length > 0 ||
        local.loans.length > 0 ||
        local.shareConnections.length > 0) &&
      toAsciiJson(merged) !== toAsciiJson(normalizedCloud);

    if (hasLocalContribution) {
      await publishStateToNtfy(merged);
    }

    return merged;
  } catch {
    return normalizeState(currentState);
  }
}

// Push updated state to Cloud (merges with latest cloud state first to prevent overwriting)
export async function pushStateToCloud(newState) {
  try {
    const local = normalizeState(newState);
    saveAppState(local);
    const cloudData = await fetchCloudStateFromNtfy();
    const merged = cloudData ? mergeStates(cloudData, local) : local;
    saveAppState(merged);
    await publishStateToNtfy(merged);
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
