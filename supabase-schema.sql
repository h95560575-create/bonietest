create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  login_id text unique not null,
  email text unique not null,
  display_name text not null,
  role text not null default 'member' check (role in ('admin', 'member')),
  is_active boolean not null default true,
  can_upload_inventory boolean not null default false,
  can_edit_memo boolean not null default true,
  can_edit_schedule boolean not null default true,
  can_manage_links boolean not null default false,
  can_manage_users boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_state (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.app_state enable row level security;

revoke all on public.profiles from anon, authenticated;
revoke all on public.app_state from anon, authenticated;

insert into public.app_state (key, value)
values ('inventory', '{"items":[],"activity":[],"lastColumns":[],"memoResetVersion":1}'::jsonb)
on conflict (key) do nothing;

-- 사용자 생성 후 아래 예시처럼 본인 계정을 관리자 권한으로 등록하세요.
-- email은 Supabase Auth에서 만든 이메일과 반드시 같아야 합니다.
--
-- insert into public.profiles (
--   user_id, login_id, email, display_name, role, is_active,
--   can_upload_inventory, can_edit_memo, can_edit_schedule, can_manage_links, can_manage_users
-- )
-- select
--   id, 'admin', email, '관리자', 'admin', true,
--   true, true, true, true, true
-- from auth.users
-- where email = 'YOUR_ADMIN_EMAIL@example.com'
-- on conflict (user_id) do update set
--   role = 'admin',
--   is_active = true,
--   can_upload_inventory = true,
--   can_edit_memo = true,
--   can_edit_schedule = true,
--   can_manage_links = true,
--   can_manage_users = true,
--   updated_at = now();
