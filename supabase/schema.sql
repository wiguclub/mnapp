-- ============================================================================
-- FlowWallet (แอปบันทึกรายรับ-รายจ่าย, หลายบัญชี, บัตรเครดิต/BNPL, ยืม/ให้ยืม, แชร์คนในบ้าน)
-- Supabase PostgreSQL Schema & Row-Level Security (RLS)
-- ============================================================================

-- 1. ตารางครอบครัว / บ้าน (Family Groups)
create table if not exists public.family_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique not null,
  owner_email text not null,
  member_emails text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- 2. ตารางบัญชีการเงิน และ บัตรเครดิต / ใช้ก่อนจ่ายทีหลัง (Accounts & Credit Cards)
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  owner_email text not null,
  owner_name text not null,
  family_id uuid references public.family_groups(id) on delete set null,
  is_shared_with_family boolean not null default false,
  name text not null,
  type text not null check (type in ('cash', 'bank', 'ewallet', 'credit_card', 'bnpl')),
  balance numeric(14,2) not null default 0,         -- สำหรับ cash, bank, ewallet
  credit_limit numeric(14,2) not null default 0,    -- สำหรับ credit_card, bnpl
  used_amount numeric(14,2) not null default 0,     -- ยอดรูดใช้ไปแล้ว (หนี้ค้างชำระ)
  statement_day int default 25,                     -- วันสรุปยอดบิล (1-31)
  due_day int default 10,                           -- วันครบกำหนดจ่าย (1-31)
  color text not null default '#4f46e5',
  created_at timestamptz not null default now()
);

-- 3. ตารางรายการผ่อนชำระ (Installment Plans - ใช้ก่อนจ่ายทีหลัง / ผ่อนบัตรเครดิต)
create table if not exists public.installments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.accounts(id) on delete cascade,
  owner_email text not null,
  owner_name text not null,
  is_shared_with_family boolean not null default false,
  title text not null,
  total_amount numeric(14,2) not null,
  total_months int not null,
  paid_months int not null default 0,
  monthly_amount numeric(14,2) not null,
  interest_rate numeric(5,2) not null default 0,
  start_date date not null default current_date,
  created_at timestamptz not null default now()
);

-- 4. ตารางรายการรับ-จ่าย-โอน-จ่ายบิลบัตร (Transactions)
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  owner_email text not null,
  owner_name text not null,
  is_shared_with_family boolean not null default false,
  type text not null check (type in ('income', 'expense', 'transfer', 'card_payment')),
  amount numeric(14,2) not null,
  category text not null,
  note text default '',
  account_id uuid references public.accounts(id) on delete cascade,
  to_account_id uuid references public.accounts(id) on delete set null,
  tx_date date not null default current_date,
  created_at timestamptz not null default now()
);

-- 5. ตารางการยืมเงิน และ ให้คนอื่นยืมเงิน (Loans & Debt Tracking)
create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  owner_email text not null,
  owner_name text not null,
  is_shared_with_family boolean not null default false,
  loan_type text not null check (loan_type in ('lend', 'borrow')), -- lend = ให้เขายืม (ลูกหนี้), borrow = เรายืมเขา (เจ้าหนี้)
  person_name text not null,
  total_amount numeric(14,2) not null,
  paid_amount numeric(14,2) not null default 0,
  account_id uuid references public.accounts(id) on delete set null,
  due_date date,
  note text default '',
  status text not null default 'active' check (status in ('active', 'settled')),
  repayments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
