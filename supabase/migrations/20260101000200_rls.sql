-- ============================================================================
-- Epen License System - 3/3: Row Level Security
-- Prinsip: default deny. Semua tulis data dilakukan server (service_role) lewat
-- fungsi atomik. Admin yang login hanya boleh MEMBACA data.
-- ============================================================================

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid())
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

alter table public.admins          enable row level security;
alter table public.licenses        enable row level security;
alter table public.license_devices enable row level security;
alter table public.license_logs    enable row level security;
alter table public.rate_limits     enable row level security;

-- Cabut semua hak default lalu berikan minimum yang dibutuhkan.
revoke all on public.admins, public.licenses, public.license_devices,
              public.license_logs, public.rate_limits from anon, authenticated;
grant select on public.admins, public.licenses, public.license_devices,
                public.license_logs to authenticated;

create policy admins_select_self on public.admins
  for select to authenticated
  using (user_id = auth.uid());

create policy licenses_admin_select on public.licenses
  for select to authenticated
  using (public.is_admin());

create policy license_devices_admin_select on public.license_devices
  for select to authenticated
  using (public.is_admin());

create policy license_logs_admin_select on public.license_logs
  for select to authenticated
  using (public.is_admin());

-- rate_limits: RLS aktif tanpa policy => tidak bisa diakses anon/authenticated.
-- Tidak ada policy INSERT/UPDATE/DELETE di tabel lain => semua tulis ditolak
-- untuk anon/authenticated. service_role melewati RLS.
