-- ============================================================================
-- Epen License System - 2/3: Fungsi atomik (transaksi + row lock)
-- Semua waktu memakai now() milik database (UTC), BUKAN jam perangkat user.
-- Fungsi hanya bisa dipanggil oleh service_role (lihat bagian akhir file).
-- ============================================================================

create or replace function public._iso(p_ts timestamptz)
returns text language sql stable as $$
  select case when p_ts is null then null
    else to_char(p_ts at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end
$$;

create or replace function public._log_event(
  p_license_id  uuid,
  p_action      text,
  p_actor_type  text,
  p_actor_id    uuid  default null,
  p_device_hash text  default null,
  p_ip          text  default null,
  p_metadata    jsonb default '{}'::jsonb
) returns void
language sql security definer set search_path = public, pg_temp as $$
  insert into public.license_logs (license_id, action, actor_type, actor_id, device_hash, ip, metadata)
  values (p_license_id, p_action, p_actor_type, p_actor_id, p_device_hash, p_ip, coalesce(p_metadata, '{}'::jsonb));
$$;

create or replace function public._license_json(p_lic public.licenses, p_devices int, p_now timestamptz)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'result', 'ok',
    'license', jsonb_build_object(
      'id', p_lic.id,
      'status', p_lic.status,
      'is_lifetime', p_lic.is_lifetime,
      'duration_seconds', p_lic.duration_seconds,
      'activated_at', public._iso(p_lic.activated_at),
      'expires_at', public._iso(p_lic.expires_at),
      'max_devices', p_lic.max_devices,
      'devices_used', p_devices
    ),
    'server_time', public._iso(p_now)
  )
$$;

-- ----------------------------------------------------------------------------
-- Rate limiting (fixed window, atomik lewat INSERT ... ON CONFLICT)
-- ----------------------------------------------------------------------------
create or replace function public.check_rate_limit(p_key text, p_limit int, p_window_seconds int)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_now timestamptz := now();
  v_row public.rate_limits%rowtype;
  v_window interval := make_interval(secs => p_window_seconds::double precision);
begin
  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, v_now, 1)
  on conflict (key) do update set
    window_start = case when r.window_start + v_window <= v_now then v_now else r.window_start end,
    hits         = case when r.window_start + v_window <= v_now then 1 else r.hits + 1 end
  returning * into v_row;

  if random() < 0.01 then
    delete from public.rate_limits where window_start < v_now - interval '1 day';
  end if;

  return jsonb_build_object(
    'allowed', v_row.hits <= p_limit,
    'remaining', greatest(p_limit - v_row.hits, 0),
    'retry_after', greatest(ceil(extract(epoch from (v_row.window_start + v_window - v_now)))::int, 1)
  );
end $$;

-- ----------------------------------------------------------------------------
-- Tandai license yang sudah lewat masa aktif sebagai expired
-- ----------------------------------------------------------------------------
create or replace function public.expire_overdue_licenses()
returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_count int;
begin
  with updated as (
    update public.licenses
       set status = 'expired'
     where status = 'active' and expires_at is not null and expires_at <= now()
    returning id, key_hint
  ), logged as (
    insert into public.license_logs (license_id, action, actor_type, metadata)
    select id, 'expired', 'system', jsonb_build_object('key_hint', key_hint) from updated
    returning 1
  )
  select count(*) into v_count from logged;
  return v_count;
end $$;

-- ----------------------------------------------------------------------------
-- Aktivasi: masa aktif dihitung dari aktivasi pertama (waktu server)
-- ----------------------------------------------------------------------------
create or replace function public.activate_license(
  p_key_hash    text,
  p_device_hash text,
  p_device_name text default null,
  p_platform    text default null,
  p_ip          text default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_now     timestamptz := now();
  v_lic     public.licenses%rowtype;
  v_dev_id  uuid;
  v_devices int;
begin
  select * into v_lic from public.licenses where key_hash = p_key_hash for update;

  if not found then
    perform public._log_event(null, 'activate_failed', 'user', null, p_device_hash, p_ip,
      jsonb_build_object('reason', 'invalid_key'));
    return jsonb_build_object('result', 'invalid');
  end if;

  if v_lic.status = 'active' and v_lic.expires_at is not null and v_lic.expires_at <= v_now then
    update public.licenses set status = 'expired' where id = v_lic.id returning * into v_lic;
    perform public._log_event(v_lic.id, 'expired', 'system', null, null, null,
      jsonb_build_object('key_hint', v_lic.key_hint));
  end if;

  if v_lic.status = 'revoked' then
    perform public._log_event(v_lic.id, 'activate_failed', 'user', null, p_device_hash, p_ip,
      jsonb_build_object('reason', 'revoked', 'key_hint', v_lic.key_hint));
    return jsonb_build_object('result', 'revoked');
  end if;

  if v_lic.status = 'expired' then
    perform public._log_event(v_lic.id, 'activate_failed', 'user', null, p_device_hash, p_ip,
      jsonb_build_object('reason', 'expired', 'key_hint', v_lic.key_hint));
    return jsonb_build_object('result', 'expired', 'expires_at', public._iso(v_lic.expires_at));
  end if;

  -- Aktivasi pertama: mulai hitung masa aktif
  if v_lic.activated_at is null then
    update public.licenses
       set activated_at = v_now,
           expires_at = case when is_lifetime then null
                             else v_now + make_interval(secs => duration_seconds::double precision) end
     where id = v_lic.id
    returning * into v_lic;
    perform public._log_event(v_lic.id, 'first_activation', 'user', null, p_device_hash, p_ip,
      jsonb_build_object('key_hint', v_lic.key_hint, 'expires_at', public._iso(v_lic.expires_at)));
  end if;

  select id into v_dev_id
    from public.license_devices
   where license_id = v_lic.id and device_hash = p_device_hash
   for update;

  if found then
    update public.license_devices
       set last_seen_at = v_now,
           last_ip = p_ip,
           device_name = coalesce(p_device_name, device_name),
           platform = coalesce(p_platform, platform)
     where id = v_dev_id;
  else
    select count(*) into v_devices from public.license_devices where license_id = v_lic.id;
    if v_devices >= v_lic.max_devices then
      perform public._log_event(v_lic.id, 'activate_failed', 'user', null, p_device_hash, p_ip,
        jsonb_build_object('reason', 'device_limit', 'key_hint', v_lic.key_hint));
      return jsonb_build_object('result', 'device_limit', 'max_devices', v_lic.max_devices);
    end if;

    insert into public.license_devices (license_id, device_hash, device_name, platform, last_ip)
    values (v_lic.id, p_device_hash, p_device_name, p_platform, p_ip);
    perform public._log_event(v_lic.id, 'device_registered', 'user', null, p_device_hash, p_ip,
      jsonb_build_object('key_hint', v_lic.key_hint, 'device_name', p_device_name));
  end if;

  select count(*) into v_devices from public.license_devices where license_id = v_lic.id;
  return public._license_json(v_lic, v_devices, v_now);
end $$;

-- ----------------------------------------------------------------------------
-- Verifikasi (berdasarkan license_id dari session token ATAU key_hash)
-- ----------------------------------------------------------------------------
create or replace function public.verify_license(
  p_key_hash    text,
  p_license_id  uuid,
  p_device_hash text,
  p_ip          text default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_now     timestamptz := now();
  v_lic     public.licenses%rowtype;
  v_devices int;
  v_found   boolean;
begin
  if p_license_id is not null then
    select * into v_lic from public.licenses where id = p_license_id for update;
  else
    select * into v_lic from public.licenses where key_hash = p_key_hash for update;
  end if;

  if not found then
    return jsonb_build_object('result', 'invalid');
  end if;

  if v_lic.status = 'active' and v_lic.expires_at is not null and v_lic.expires_at <= v_now then
    update public.licenses set status = 'expired' where id = v_lic.id returning * into v_lic;
    perform public._log_event(v_lic.id, 'expired', 'system', null, null, null,
      jsonb_build_object('key_hint', v_lic.key_hint));
  end if;

  if v_lic.status = 'revoked' then
    return jsonb_build_object('result', 'revoked');
  end if;
  if v_lic.status = 'expired' then
    return jsonb_build_object('result', 'expired', 'expires_at', public._iso(v_lic.expires_at));
  end if;
  if v_lic.activated_at is null then
    return jsonb_build_object('result', 'not_activated');
  end if;

  -- Perangkat harus terdaftar; update last_seen maksimal 1x per menit
  update public.license_devices
     set last_seen_at = v_now, last_ip = coalesce(p_ip, last_ip)
   where license_id = v_lic.id
     and device_hash = p_device_hash
     and last_seen_at < v_now - interval '1 minute';
  select exists (
    select 1 from public.license_devices where license_id = v_lic.id and device_hash = p_device_hash
  ) into v_found;

  if not v_found then
    return jsonb_build_object('result', 'device_not_registered');
  end if;

  select count(*) into v_devices from public.license_devices where license_id = v_lic.id;
  return public._license_json(v_lic, v_devices, v_now);
end $$;

-- ----------------------------------------------------------------------------
-- Deaktivasi perangkat oleh user (membebaskan slot)
-- ----------------------------------------------------------------------------
create or replace function public.deactivate_device(
  p_key_hash    text,
  p_license_id  uuid,
  p_device_hash text,
  p_ip          text default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_lic     public.licenses%rowtype;
  v_deleted uuid;
begin
  if p_license_id is not null then
    select * into v_lic from public.licenses where id = p_license_id for update;
  else
    select * into v_lic from public.licenses where key_hash = p_key_hash for update;
  end if;

  if not found then
    return jsonb_build_object('result', 'ok', 'removed', false);
  end if;

  delete from public.license_devices
   where license_id = v_lic.id and device_hash = p_device_hash
  returning id into v_deleted;

  if v_deleted is not null then
    perform public._log_event(v_lic.id, 'device_deactivated', 'user', null, p_device_hash, p_ip,
      jsonb_build_object('key_hint', v_lic.key_hint));
  end if;

  return jsonb_build_object('result', 'ok', 'removed', v_deleted is not null);
end $$;

-- ----------------------------------------------------------------------------
-- Admin: generate banyak license sekaligus (atomik, beserta audit log)
-- ----------------------------------------------------------------------------
create or replace function public.admin_generate_licenses(
  p_keys             jsonb,       -- [{ "key_hash": "...", "key_hint": "..." }]
  p_duration_seconds bigint,
  p_is_lifetime      boolean,
  p_max_devices      int,
  p_note             text,
  p_admin_id         uuid
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_result jsonb;
begin
  with ins as (
    insert into public.licenses (key_hash, key_hint, duration_seconds, is_lifetime, max_devices, note, created_by)
    select k->>'key_hash', k->>'key_hint',
           case when p_is_lifetime then null else p_duration_seconds end,
           p_is_lifetime, p_max_devices, nullif(p_note, ''), p_admin_id
      from jsonb_array_elements(p_keys) as k
    returning id, key_hash, key_hint, created_at
  ), logged as (
    insert into public.license_logs (license_id, action, actor_type, actor_id, metadata)
    select id, 'created', 'admin', p_admin_id,
           jsonb_build_object('key_hint', key_hint, 'duration_seconds', p_duration_seconds,
                              'is_lifetime', p_is_lifetime, 'max_devices', p_max_devices)
      from ins
    returning 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', id, 'key_hash', key_hash, 'key_hint', key_hint, 'created_at', public._iso(created_at))), '[]'::jsonb)
    into v_result
    from ins;
  return v_result;
end $$;

-- ----------------------------------------------------------------------------
-- Admin: extend
-- ----------------------------------------------------------------------------
create or replace function public.admin_extend_license(
  p_license_id uuid,
  p_seconds    bigint,
  p_lifetime   boolean,
  p_admin_id   uuid
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  c_max         constant bigint := 315360000;  -- 10 tahun
  v_now         timestamptz := now();
  v_lic         public.licenses%rowtype;
  v_new_expires timestamptz;
  v_new_dur     bigint;
begin
  select * into v_lic from public.licenses where id = p_license_id for update;
  if not found then return jsonb_build_object('result', 'not_found'); end if;
  if v_lic.status = 'revoked' then return jsonb_build_object('result', 'revoked'); end if;
  if v_lic.is_lifetime then return jsonb_build_object('result', 'already_lifetime'); end if;

  if p_lifetime then
    update public.licenses
       set is_lifetime = true, duration_seconds = null, expires_at = null, status = 'active'
     where id = v_lic.id
    returning * into v_lic;
  else
    if p_seconds is null or p_seconds < 60 or p_seconds > c_max then
      return jsonb_build_object('result', 'invalid_duration');
    end if;

    if v_lic.activated_at is null then
      v_new_dur := v_lic.duration_seconds + p_seconds;
      if v_new_dur > c_max then return jsonb_build_object('result', 'too_long'); end if;
      update public.licenses set duration_seconds = v_new_dur where id = v_lic.id returning * into v_lic;
    else
      v_new_expires := greatest(coalesce(v_lic.expires_at, v_now), v_now)
                       + make_interval(secs => p_seconds::double precision);
      if v_new_expires > v_now + make_interval(secs => c_max::double precision) then
        return jsonb_build_object('result', 'too_long');
      end if;
      update public.licenses set expires_at = v_new_expires, status = 'active'
       where id = v_lic.id returning * into v_lic;
    end if;
  end if;

  perform public._log_event(v_lic.id, 'extended', 'admin', p_admin_id, null, null,
    jsonb_build_object('key_hint', v_lic.key_hint, 'seconds', p_seconds, 'lifetime', p_lifetime,
                       'expires_at', public._iso(v_lic.expires_at)));

  return jsonb_build_object('result', 'ok', 'id', v_lic.id, 'status', v_lic.status,
                            'expires_at', public._iso(v_lic.expires_at));
end $$;

-- ----------------------------------------------------------------------------
-- Admin: revoke
-- ----------------------------------------------------------------------------
create or replace function public.admin_revoke_license(
  p_license_id uuid,
  p_reason     text,
  p_admin_id   uuid
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_lic public.licenses%rowtype;
begin
  select * into v_lic from public.licenses where id = p_license_id for update;
  if not found then return jsonb_build_object('result', 'not_found'); end if;
  if v_lic.status = 'revoked' then return jsonb_build_object('result', 'already_revoked'); end if;

  update public.licenses
     set status = 'revoked', revoked_at = now(), revoked_reason = nullif(p_reason, '')
   where id = v_lic.id
  returning * into v_lic;

  perform public._log_event(v_lic.id, 'revoked', 'admin', p_admin_id, null, null,
    jsonb_build_object('key_hint', v_lic.key_hint, 'reason', nullif(p_reason, '')));

  return jsonb_build_object('result', 'ok', 'id', v_lic.id, 'status', v_lic.status);
end $$;

-- ----------------------------------------------------------------------------
-- Admin: delete (log ditulis lebih dulu, lalu license dihapus)
-- ----------------------------------------------------------------------------
create or replace function public.admin_delete_license(
  p_license_id uuid,
  p_admin_id   uuid
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_lic public.licenses%rowtype;
begin
  select * into v_lic from public.licenses where id = p_license_id for update;
  if not found then return jsonb_build_object('result', 'not_found'); end if;

  perform public._log_event(null, 'deleted', 'admin', p_admin_id, null, null,
    jsonb_build_object('license_id', v_lic.id, 'key_hint', v_lic.key_hint, 'status', v_lic.status));

  delete from public.licenses where id = v_lic.id;
  return jsonb_build_object('result', 'ok', 'id', v_lic.id);
end $$;

-- ----------------------------------------------------------------------------
-- Admin: hapus perangkat dari license
-- ----------------------------------------------------------------------------
create or replace function public.admin_remove_device(
  p_device_id uuid,
  p_admin_id  uuid
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_dev public.license_devices%rowtype;
  v_hint text;
begin
  delete from public.license_devices where id = p_device_id returning * into v_dev;
  if not found then return jsonb_build_object('result', 'not_found'); end if;

  select key_hint into v_hint from public.licenses where id = v_dev.license_id;
  perform public._log_event(v_dev.license_id, 'device_removed', 'admin', p_admin_id, v_dev.device_hash, null,
    jsonb_build_object('key_hint', v_hint, 'device_name', v_dev.device_name));

  return jsonb_build_object('result', 'ok');
end $$;

-- ----------------------------------------------------------------------------
-- Admin: statistik dashboard
-- ----------------------------------------------------------------------------
create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v jsonb;
begin
  perform public.expire_overdue_licenses();
  select jsonb_build_object(
    'total',       count(*),
    'active',      count(*) filter (where status = 'active' and activated_at is not null),
    'unactivated', count(*) filter (where status = 'active' and activated_at is null),
    'expired',     count(*) filter (where status = 'expired'),
    'revoked',     count(*) filter (where status = 'revoked'),
    'devices',     (select count(*) from public.license_devices)
  ) into v from public.licenses;
  return v;
end $$;

-- ----------------------------------------------------------------------------
-- Hak akses: fungsi hanya untuk service_role (server). Bukan anon/authenticated.
-- ----------------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array[
    'public._log_event(uuid, text, text, uuid, text, text, jsonb)',
    'public.check_rate_limit(text, int, int)',
    'public.expire_overdue_licenses()',
    'public.activate_license(text, text, text, text, text)',
    'public.verify_license(text, uuid, text, text)',
    'public.deactivate_device(text, uuid, text, text)',
    'public.admin_generate_licenses(jsonb, bigint, boolean, int, text, uuid)',
    'public.admin_extend_license(uuid, bigint, boolean, uuid)',
    'public.admin_revoke_license(uuid, text, uuid)',
    'public.admin_delete_license(uuid, uuid)',
    'public.admin_remove_device(uuid, uuid)',
    'public.admin_dashboard_stats()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
