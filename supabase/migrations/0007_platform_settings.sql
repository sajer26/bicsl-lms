-- ============================================================================
-- BICSL LMS — Platform Settings
-- ============================================================================

create table public.platform_settings (
  id int primary key default 1,
  platform_name text not null default 'BICSL',
  passing_score int not null default 80,
  certificate_validity_years int not null default 2,
  session_timeout_minutes int not null default 60,
  updated_at timestamptz not null default now(),
  constraint single_row check (id = 1)
);

insert into public.platform_settings (id) values (1);

create trigger trg_touch_platform_settings
before update on public.platform_settings
for each row execute function public.touch_updated_at();

alter table public.platform_settings enable row level security;

create policy "anyone can read platform settings"
  on public.platform_settings for select
  to authenticated, anon
  using (true);

create policy "super_admin can update platform settings"
  on public.platform_settings for update
  using (public.is_super_admin())
  with check (public.is_super_admin());
