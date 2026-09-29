-- ============================================================
--  보담 장부(세무) — 테이블·권한
--  Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 한 번 실행한다.
--  여러 번 실행해도 안전하다(있으면 건너뛴다).
--
--  ⚠️ 장부는 사업자 본인의 돈 흐름이다. 관리인·보담회원에게 보이면 안 된다.
--     그래서 두 테이블 모두 «관리자(admin)이면서 승인된(active)» 사용자만 읽고 쓴다.
-- ============================================================

-- 관리자인가? — RLS 정책이 user_roles 의 RLS 에 걸리지 않도록 security definer 로 둔다.
-- user_id 컬럼 타입(uuid/text)이 무엇이든 맞도록 글자로 비교한다.
create or replace function public.ledger_is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles r
    where r.user_id::text = auth.uid()::text
      and r.role = 'admin'
      and r.status = 'active'
  );
$$;
revoke all on function public.ledger_is_admin() from public;
grant execute on function public.ledger_is_admin() to authenticated;

-- 거래 한 줄 = 한 행. 금액은 **원** 단위(은행·카드 내역이 원 단위라서).
--   ⚠️ leases 의 월세·보증금은 «만원» 단위다. 섞지 말 것.
create table if not exists public.ledger_entries (
  id            uuid primary key default gen_random_uuid(),
  entry_date    date   not null,
  source        text   not null default 'bank' check (source in ('bank', 'card', 'manual')),
  account_label text   not null default '',          -- 어느 통장/카드인지 (예: "신한 임대료통장")
  direction     text   not null check (direction in ('in', 'out')),
  amount        bigint not null check (amount > 0),
  description   text   not null default '',          -- 적요·가맹점·입금자 표기
  balance       bigint,                              -- 거래 후 잔액(있으면). 중복 판정에 쓴다
  category      text,                                -- 계정과목 키 (null = 미분류)
  cat_by        text check (cat_by in ('rule', 'learned', 'lease', 'ai', 'human')),
  ai_confidence text,
  ai_reason     text,
  lease_id      text,                                -- 임대료로 맞춘 세대 (있으면)
  memo          text,
  raw           text,                                -- 원본 줄 (나중에 대조용)
  dedup_key     text   not null unique,              -- 같은 파일을 두 번 올려도 한 번만 들어가게
  created_at    timestamptz not null default now(),
  created_by    uuid default auth.uid()
);
create index if not exists ledger_entries_date_idx on public.ledger_entries (entry_date);

-- 사람이 고친 분류를 기억한다 — 다음 가져오기부터 같은 적요는 자동으로 붙는다.
create table if not exists public.ledger_rules (
  direction  text not null check (direction in ('in', 'out')),
  pattern    text not null,                          -- 공백·숫자를 뺀 적요
  category   text not null,
  updated_at timestamptz not null default now(),
  primary key (direction, pattern)
);

alter table public.ledger_entries enable row level security;
alter table public.ledger_rules   enable row level security;

drop policy if exists ledger_entries_admin on public.ledger_entries;
create policy ledger_entries_admin on public.ledger_entries
  for all to authenticated
  using (public.ledger_is_admin())
  with check (public.ledger_is_admin());

drop policy if exists ledger_rules_admin on public.ledger_rules;
create policy ledger_rules_admin on public.ledger_rules
  for all to authenticated
  using (public.ledger_is_admin())
  with check (public.ledger_is_admin());
