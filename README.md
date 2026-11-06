# Epen License System

Sistem lisensi software online: halaman aktivasi untuk user, dashboard admin, dan API untuk software Anda.

**Stack:** React + Vite + TypeScript + Tailwind CSS v4 · Vercel Functions (Node.js + TypeScript) · Supabase PostgreSQL + Auth · Hosting Vercel.

---

## 1. Struktur folder

```
epen/
├─ api/                         Vercel Functions (backend)
│  ├─ _lib/                     helper bersama (tidak menjadi endpoint)
│  │  ├─ env.ts  http.ts  crypto.ts  supabase.ts  auth.ts
│  │  ├─ rateLimit.ts  schemas.ts  durations.ts  license.ts
│  ├─ license/                  endpoint publik
│  │  ├─ activate.ts  verify.ts  deactivate.ts
│  └─ admin/                    endpoint admin (wajib login admin)
│     ├─ me.ts  stats.ts  logs.ts
│     ├─ licenses/ index.ts generate.ts extend.ts revoke.ts delete.ts
│     └─ devices/  index.ts remove.ts
├─ src/                         Frontend
│  ├─ components/  pages/  layouts/  hooks/  lib/  types/
├─ supabase/
│  ├─ migrations/               3 file SQL (schema, fungsi, RLS)
│  └─ snippets/make_admin.sql
├─ package.json  vite.config.ts  tsconfig.json  vercel.json
└─ .env.example  README.md
```

## 2. Cara kerja sistem

1. Admin login (Supabase Auth) → **Generate License**. Server membuat key `EPEN-XXXX-XXXX-XXXX` (CSPRNG), menyimpan **HMAC-SHA256** key ke database, dan mengirim key asli **sekali saja** di response.
2. User memasukkan key di halaman aktivasi → `POST /api/license/activate`. Fungsi SQL `activate_license` berjalan dalam satu transaksi dengan `SELECT … FOR UPDATE`:
   - key tidak ada → `INVALID_KEY`; dicabut → `REVOKED`; lewat masa → `EXPIRED`;
   - aktivasi pertama → `activated_at = now()` (jam **database/UTC**), `expires_at = activated_at + durasi`;
   - perangkat didaftarkan; jika slot penuh → `DEVICE_LIMIT`.
3. Server membalas `session_token` bertanda tangan HMAC. Browser menyimpannya di localStorage, **tetapi itu hanya penunjuk**: setiap kali halaman dibuka, setiap 60 detik, saat tab aktif lagi, dan saat hitung mundur habis, browser memanggil `/api/license/verify` dan status asli diambil dari database. Mengubah localStorage atau jam perangkat tidak memperpanjang lisensi.
4. Hitung mundur di UI memakai offset `server_time − jam klien`, jadi jam perangkat yang salah tidak berpengaruh.
5. Setiap perubahan (buat, aktivasi pertama, perangkat, extend, revoke, delete, expired) masuk `license_logs` (append-only lewat trigger).

### Keamanan yang diterapkan
| Prinsip | Implementasi |
|---|---|
| Service role key tidak di frontend | Hanya dipakai di `api/_lib/supabase.ts`; frontend hanya memakai anon key untuk login |
| Key tidak disimpan mentah | Hanya `key_hash` (HMAC-SHA256 + pepper `LICENSE_HASH_SECRET`) dan `key_hint` (4 karakter terakhir) |
| Admin diverifikasi | JWT Supabase divalidasi di server **dan** user harus ada di tabel `admins` |
| Waktu server | Semua waktu memakai `now()` Postgres (UTC) |
| Cegah aktivasi ganda / manipulasi expired | Row lock + constraint CHECK di tabel; `expires_at` hanya diubah oleh fungsi SQL |
| Rate limiting | Fungsi `check_rate_limit` di Postgres (konsisten antar instance): activate 10/menit, verify 60/menit, deactivate 20/menit per IP |
| RLS | Aktif di semua tabel, default deny; admin hanya boleh `SELECT`; semua tulis lewat service role |
| Fungsi SQL | `REVOKE` dari `public/anon/authenticated`, hanya `service_role` yang boleh `EXECUTE` |
| Header | CSP, HSTS, X-Frame-Options, dll. di `vercel.json` |

> **Soal tombol "Copy key" di License List:** karena key hanya berupa hash, key asli tidak bisa ditampilkan ulang. Salin key lewat halaman **Generate License** (tombol salin per key, "Salin semua", atau unduh .txt) sebelum menutup halaman. Ini konsekuensi langsung dari persyaratan "key asli hanya ditampilkan saat dibuat".

---

## 3. Setup Supabase

1. Buat project di <https://supabase.com>.
2. **Authentication → Providers → Email**: aktifkan Email. **Matikan "Allow new users to sign up"** (Authentication → Sign In / Providers) agar tidak ada yang mendaftar sendiri.
3. **SQL Editor**: jalankan isi tiga file **berurutan**:
   1. `supabase/migrations/20260101000000_schema.sql`
   2. `supabase/migrations/20260101000100_functions.sql`
   3. `supabase/migrations/20260101000200_rls.sql`

   (Atau dengan Supabase CLI: `supabase link --project-ref <ref>` lalu `supabase db push`.)
4. **Project Settings → API**, salin: `Project URL`, `anon public key`, `service_role key` (rahasia!).

## 4. Membuat akun admin

1. Supabase → **Authentication → Users → Add user → Create new user**. Isi email + password kuat, centang **Auto Confirm User**.
2. Jalankan di SQL Editor (ganti email), lihat `supabase/snippets/make_admin.sql`:
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'admin@example.com'
   on conflict (user_id) do nothing;
   ```
3. Login di `/admin/login`. Akun Supabase tanpa baris di `admins` akan ditolak (403).

## 5. Environment variables

Salin `.env.example` ke `.env.local` untuk lokal, dan isi di **Vercel → Project → Settings → Environment Variables** untuk produksi.

| Variabel | Keterangan |
|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Publik (dibundel ke browser) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | **Rahasia**, hanya server |
| `LICENSE_HASH_SECRET` | `openssl rand -hex 32`. **Jangan diganti setelah ada license**, key lama tidak akan cocok lagi |
| `SESSION_SECRET` | `openssl rand -hex 32` (berbeda dari di atas) |
| `ALLOWED_ORIGINS` | Opsional, untuk CORS jika API dipanggil dari web di domain lain |

## 6. Menjalankan lokal

```bash
npm install
npm i -g vercel
vercel link          # hubungkan ke project Vercel (opsional, agar env ter-pull)
vercel dev           # menjalankan frontend + /api di http://localhost:3000
```
`npm run dev` hanya menjalankan frontend (tanpa API). Cek tipe: `npm run typecheck`.

## 7. Deployment Vercel

1. Push proyek ke GitHub/GitLab.
2. Vercel → **Add New → Project** → pilih repo. Framework otomatis terdeteksi **Vite** (sudah diatur di `vercel.json`).
3. Isi semua environment variables di atas (Production + Preview).
4. **Deploy**. Semua file di `api/` otomatis menjadi Serverless Functions, folder `_lib` tidak diekspos.
5. Uji: buka domain Anda → halaman aktivasi; `/admin/login` → dashboard.

## 8. Generate license key

Login admin → **Generate License** → pilih durasi (1 jam … Lifetime atau Custom), jumlah (1–100), batas perangkat, catatan → **Buat license**. Salin/unduh key segera. Masa aktif baru berjalan saat key diaktivasi pertama kali.

## 9. Pengujian API (curl)

```bash
BASE=https://your-app.vercel.app

# --- Publik ---
curl -s -X POST $BASE/api/license/activate -H 'Content-Type: application/json' \
  -d '{"license_key":"EPEN-AAAA-BBBB-CCCC","device_id":"my-device-12345","device_name":"PC Kantor"}'

curl -s -X POST $BASE/api/license/verify -H 'Content-Type: application/json' \
  -d '{"session_token":"<token dari activate>"}'
# atau tanpa token:
curl -s -X POST $BASE/api/license/verify -H 'Content-Type: application/json' \
  -d '{"license_key":"EPEN-AAAA-BBBB-CCCC","device_id":"my-device-12345"}'

curl -s -X POST $BASE/api/license/deactivate -H 'Content-Type: application/json' \
  -d '{"session_token":"<token>"}'

# --- Admin: ambil access token ---
TOKEN=$(curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_ANON_KEY" -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"PASSWORD"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')

curl -s -X POST $BASE/api/admin/licenses/generate -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"duration":"7d","count":3,"max_devices":2,"note":"uji coba"}'

curl -s "$BASE/api/admin/licenses?status=unactivated&page=1" -H "Authorization: Bearer $TOKEN"

curl -s -X POST $BASE/api/admin/licenses/extend -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"id":"<license uuid>","duration":"custom","custom_seconds":7200}'

curl -s -X POST $BASE/api/admin/licenses/revoke -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"id":"<license uuid>","reason":"refund"}'

curl -s -X DELETE "$BASE/api/admin/licenses/delete?id=<license uuid>" -H "Authorization: Bearer $TOKEN"
```

**Format response (konsisten):**
```json
{ "success": true,  "data": { } }
{ "success": false, "error": { "code": "INVALID_KEY", "message": "…", "details": { } } }
```
Kode error: `VALIDATION_ERROR` 400 · `INVALID_JSON` 400 · `UNAUTHORIZED` 401 · `INVALID_SESSION` 401 · `FORBIDDEN` 403 · `REVOKED` 403 · `EXPIRED` 403 · `NOT_ACTIVATED` 403 · `DEVICE_NOT_REGISTERED` 403 · `INVALID_KEY` 404 · `NOT_FOUND` 404 · `METHOD_NOT_ALLOWED` 405 · `DEVICE_LIMIT` 409 · `RATE_LIMITED` 429 (+ header `Retry-After`) · `INTERNAL_ERROR`/`DATABASE_ERROR` 500.

**Uji manual yang disarankan:** aktivasi key baru (cek `activated_at`/`expires_at` terisi); aktivasi ulang dari device sama (idempotent); device kedua pada key `max_devices=1` (harus `DEVICE_LIMIT`); revoke lalu verify (harus `REVOKED`); key 1 jam diubah `expires_at`-nya mustahil lewat API; kirim 11 request activate dalam semenit (harus 429).

## 10. Mengintegrasikan ke software Anda

Software desktop/mobile cukup memanggil `activate` sekali dengan `device_id` stabil milik aplikasi (mis. UUID yang disimpan, atau hash hardware id), simpan `session_token`, lalu panggil `verify` berkala dan saat startup. Jangan pernah menganggap lisensi valid hanya karena data lokal; selalu ikuti respons server.

## 11. Catatan & pemeliharaan

- **Status expired** diperbarui otomatis saat `activate`/`verify` dan saat admin membuka daftar/dashboard. Opsional, jadwalkan dengan pg_cron: `select cron.schedule('expire-licenses','* * * * *','select public.expire_overdue_licenses()');`
- **Retensi log:** `license_logs` append-only. Untuk membersihkan log lama, nonaktifkan trigger sementara di SQL Editor (`alter table public.license_logs disable trigger license_logs_append_only;`), hapus, lalu aktifkan lagi.
- **Token sesi** berlaku 30 hari dan diperbarui setiap verify sukses. Mencabut license / menghapus perangkat langsung membuat verify gagal, walau token masih berlaku.
- **Rate limit** berbasis IP (header `x-forwarded-for` dari Vercel). Endpoint admin dilindungi JWT; tambahkan rate limit bila diperlukan.
- **Troubleshooting:** error 500 `Environment variable … belum diatur` → cek env di Vercel dan redeploy. 403 saat login → user belum masuk tabel `admins`. Jika build function gagal karena import ESM, pastikan import relatif di `api/` memakai ekstensi `.js` (sudah diterapkan).
