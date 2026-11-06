-- ============================================================================
-- Epen License System - 1/3: Schema
-- ============================================================================

-- Daftar admin. Hanya user yang ada di tabel ini yang dianggap admin.
create table public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.licenses (
  id               uuid primary key default gen_random_uuid(),
  key_hash         text not null,             -- HMAC-SHA256 hex dari key asli
  key_hint         text not null,             -- EPEN-****-****-ABCD (aman ditampilkan)
  status           text not null default 'active',
  duration_seconds bigint,                    -- NULL jika lifetime
  is_lifetime      boolean not null default false,
  max_devices      integer not null default 1,
  note             text,
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  activated_at     timestamptz,               -- diisi saat aktivasi pertama (waktu server)
  expires_at       timestamptz,               -- NULL jika lifetime / belum diaktivasi
  revoked_at       timestamptz,
  revoked_reason   text,

  constraint licenses_key_hash_unique unique (key_hash),
  constraint licenses_key_hash_format check (key_hash ~ '^[0-9a-f]{64}$'),
  constraint licenses_status_check check (status in ('active', 'revoked', 'expired')),
  constraint licenses_duration_check check (
    (is_lifetime and duration_seconds is null)
    or (not is_lifetime and duration_seconds between 60 and 315360000)
  ),
  constraint licenses_max_devices_check check (max_devices between 1 and 1000),
  constraint licenses_note_length check (note is null or char_length(note) <= 500),
  constraint licenses_lifetime_no_expiry check (not is_lifetime or expires_at is null),
  constraint licenses_expiry_requires_activation check (expires_at is null or activated_at is not null),
  constraint licenses_timed_has_expiry check (is_lifetime or activated_at is null or expires_at is not null),
  constraint licenses_expiry_after_activation check (expires_at is null or expires_at > activated_at),
  constraint licenses_revoked_consistency check ((status = 'revoked') = (revoked_at is not null))
);

create index licenses_status_idx      on public.licenses (status);
create index licenses_created_at_idx  on public.licenses (created_at desc);
create index licenses_created_by_idx  on public.licenses (created_by);
create index licenses_expiry_idx      on public.licenses (expires_at)
  where status = 'active' and expires_at is not null;

create table public.license_devices (
  id            uuid primary key default gen_random_uuid(),
  license_id    uuid not null references public.licenses (id) on delete cascade,
  device_hash   text not null,                -- HMAC-SHA256 dari device id
  device_name   text,
  platform      text,
  last_ip       text,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),

  constraint license_devices_unique unique (license_id, device_hash),
  constraint license_devices_hash_format check (device_hash ~ '^[0-9a-f]{64}$'),
  constraint license_devices_name_length check (device_name is null or char_length(device_name) <= 100),
  constraint license_devices_platform_length check (platform is null or char_length(platform) <= 100)
);

create index license_devices_license_idx   on public.license_devices (license_id);
create index license_devices_last_seen_idx on public.license_devices (last_seen_at desc);

create table public.license_logs (
  id          bigint generated always as identity primary key,
  license_id  uuid references public.licenses (id) on delete set null,
  action      text not null,
  actor_type  text not null,
  actor_id    uuid,                           -- tanpa FK agar log tetap ada jika admin dihapus
  device_hash text,
  ip          text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),

  constraint license_logs_action_check check (action in (
    'created', 'first_activation', 'device_registered', 'activate_failed',
    'device_deactivated', 'device_removed', 'extended', 'revoked', 'deleted', 'expired'
  )),
  constraint license_logs_actor_check check (actor_type in ('system', 'admin', 'user'))
);

create index license_logs_license_idx on public.license_logs (license_id);
create index license_logs_created_idx on public.license_logs (created_at desc);
create index license_logs_action_idx  on public.license_logs (action);

-- Penyimpanan rate limit (dipakai oleh fungsi check_rate_limit).
create table public.rate_limits (
  key          text primary key,
  window_start timestamptz not null,
  hits         integer not null
);

-- updated_at otomatis
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger licenses_set_updated_at
before update on public.licenses
for each row execute function public.set_updated_at();

-- Audit log bersifat append-only: tidak boleh di-update/delete,
-- kecuali license_id menjadi NULL (akibat license dihapus).
create or replace function public.prevent_log_tampering()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'license_logs bersifat append-only';
  end if;
  if (to_jsonb(new) - 'license_id') is distinct from (to_jsonb(old) - 'license_id') then
    raise exception 'license_logs bersifat append-only';
  end if;
  return new;
end $$;

create trigger license_logs_append_only
before update or delete on public.license_logs
for each row execute function public.prevent_log_tampering();
