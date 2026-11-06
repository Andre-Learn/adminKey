-- Jadikan user Supabase Auth sebagai admin.
-- 1) Buat user di Authentication > Users (Add user > Create new user, centang Auto Confirm).
-- 2) Jalankan query ini di SQL Editor (ganti email).
insert into public.admins (user_id)
select id from auth.users where email = 'admin@example.com'
on conflict (user_id) do nothing;

-- Cek:
-- select a.user_id, u.email from public.admins a join auth.users u on u.id = a.user_id;
