import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, LogOut, RefreshCw, ShieldX, WifiOff } from 'lucide-react';
import { Button } from '@/components/Button';
import { ConfirmModal } from '@/components/ConfirmModal';
import { Spinner } from '@/components/Spinner';
import { useToast } from '@/components/Toast';
import { useCountdown } from '@/hooks/useCountdown';
import { ApiClientError, licenseApi } from '@/lib/api';
import { formatDateTime, formatDuration, formatKeyInput, KEY_REGEX, splitRemaining } from '@/lib/format';
import { sessionStore } from '@/lib/session';
import type { ActivationResponse, LicenseView } from '@/types';

type Phase = 'checking' | 'idle' | 'activating' | 'active';
interface Notice {
  tone: 'error' | 'warn';
  title: string;
  message: string;
}

function noticeFromError(err: unknown): Notice {
  if (!(err instanceof ApiClientError)) {
    return { tone: 'error', title: 'Terjadi kesalahan', message: 'Coba lagi beberapa saat.' };
  }
  switch (err.code) {
    case 'INVALID_KEY':
      return { tone: 'error', title: 'Key tidak valid', message: 'License key tidak ditemukan. Periksa kembali penulisannya.' };
    case 'VALIDATION_ERROR':
      return { tone: 'error', title: 'Format key salah', message: 'Format key harus EPEN-XXXX-XXXX-XXXX.' };
    case 'REVOKED':
      return { tone: 'error', title: 'License dicabut', message: 'License ini sudah dicabut oleh admin. Hubungi admin untuk bantuan.' };
    case 'EXPIRED':
      return {
        tone: 'error',
        title: 'License kedaluwarsa',
        message: `Masa aktif berakhir pada ${formatDateTime(err.details?.expires_at as string | undefined)}.`,
      };
    case 'DEVICE_LIMIT':
      return {
        tone: 'error',
        title: 'Batas perangkat tercapai',
        message: `Key ini sudah dipakai di ${String(err.details?.max_devices ?? 'batas maksimum')} perangkat. Nonaktifkan salah satu perangkat atau hubungi admin.`,
      };
    case 'RATE_LIMITED':
      return {
        tone: 'warn',
        title: 'Terlalu banyak percobaan',
        message: `Coba lagi dalam ${String(err.details?.retry_after ?? 60)} detik.`,
      };
    case 'NETWORK_ERROR':
      return { tone: 'warn', title: 'Tidak ada koneksi', message: err.message };
    case 'INVALID_SESSION':
    case 'DEVICE_NOT_REGISTERED':
    case 'NOT_ACTIVATED':
      return { tone: 'warn', title: 'Sesi berakhir', message: 'Aktivasi perangkat ini tidak lagi berlaku. Masukkan key untuk mengaktifkan ulang.' };
    default:
      return { tone: 'error', title: 'Gagal memvalidasi', message: err.message };
  }
}

function Unit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex min-w-14 flex-col items-center sm:min-w-16">
      <span className="font-mono text-4xl font-semibold tabular-nums sm:text-5xl">{String(value).padStart(2, '0')}</span>
      <span className="mt-1 text-xs text-muted">{label}</span>
    </div>
  );
}

function ActivePanel({ license, offset, onVerify, onDeactivate, verifying }: {
  license: LicenseView;
  offset: number;
  onVerify: () => void;
  onDeactivate: () => void;
  verifying: boolean;
}) {
  const remaining = useCountdown(license.is_lifetime ? null : license.expires_at, offset);
  const parts = remaining !== null ? splitRemaining(remaining) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-ok">
        <CheckCircle2 className="size-5" aria-hidden="true" />
        <h1 className="text-xl font-semibold text-ink">Lisensi aktif</h1>
      </div>

      <div className="rounded-xl border border-line bg-canvas px-4 py-7 text-center" role="timer" aria-label="Sisa masa aktif">
        <p className="mb-4 text-sm text-muted">Sisa masa aktif</p>
        {license.is_lifetime ? (
          <p className="font-mono text-4xl font-semibold text-accent-soft sm:text-5xl">Lifetime</p>
        ) : parts ? (
          <div className="flex items-start justify-center gap-3 sm:gap-5">
            <Unit value={parts.days} label="hari" />
            <Unit value={parts.hours} label="jam" />
            <Unit value={parts.minutes} label="menit" />
            <Unit value={parts.seconds} label="detik" />
          </div>
        ) : null}
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
        <div><dt className="text-xs text-muted">Masa aktif</dt><dd className="mt-0.5 font-medium">{formatDuration(license.duration_seconds, license.is_lifetime)}</dd></div>
        <div><dt className="text-xs text-muted">Perangkat</dt><dd className="mt-0.5 font-medium">{license.devices_used} dari {license.max_devices}</dd></div>
        <div><dt className="text-xs text-muted">Diaktivasi</dt><dd className="mt-0.5 font-medium">{formatDateTime(license.activated_at)}</dd></div>
        <div><dt className="text-xs text-muted">Kedaluwarsa</dt><dd className="mt-0.5 font-medium">{license.is_lifetime ? 'Tidak pernah' : formatDateTime(license.expires_at)}</dd></div>
      </dl>

      <div className="flex flex-wrap gap-2 border-t border-line pt-5">
        <Button variant="secondary" size="sm" onClick={onVerify} loading={verifying}>
          <RefreshCw className="size-3.5" aria-hidden="true" /> Verifikasi ulang
        </Button>
        <Button variant="ghost" size="sm" onClick={onDeactivate}>
          <LogOut className="size-3.5" aria-hidden="true" /> Nonaktifkan perangkat ini
        </Button>
      </div>
    </div>
  );
}

export default function ActivatePage() {
  const toast = useToast();
  const [phase, setPhase] = useState<Phase>(() => (sessionStore.get() ? 'checking' : 'idle'));
  const [keyInput, setKeyInput] = useState('');
  const [license, setLicense] = useState<LicenseView | null>(null);
  const [offset, setOffset] = useState(0);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [offline, setOffline] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const hasLicense = useRef(false);

  const apply = useCallback((res: ActivationResponse) => {
    sessionStore.set(res.session_token);
    hasLicense.current = true;
    setLicense(res.license);
    setOffset((Date.parse(res.server_time) || Date.now()) - Date.now());
    setPhase('active');
    setNotice(null);
    setOffline(false);
  }, []);

  const verify = useCallback(
    async (manual: boolean) => {
      const token = sessionStore.get();
      if (!token) {
        setPhase('idle');
        return;
      }
      if (manual) setVerifying(true);
      try {
        apply(await licenseApi.verify(token));
      } catch (err) {
        if (err instanceof ApiClientError && err.isTransient) {
          // Gangguan sementara: jangan keluarkan user, tapi jangan beri status baru tanpa server.
          setOffline(true);
          if (!hasLicense.current) {
            setPhase('idle');
            setNotice(noticeFromError(err));
          }
        } else {
          sessionStore.clear();
          hasLicense.current = false;
          setLicense(null);
          setPhase('idle');
          setNotice(noticeFromError(err));
        }
      } finally {
        if (manual) setVerifying(false);
      }
    },
    [apply],
  );

  // Verifikasi ke server saat halaman dibuka (localStorage tidak dipercaya).
  useEffect(() => {
    if (sessionStore.get()) void verify(false);
  }, [verify]);

  // Verifikasi berkala + saat tab kembali aktif.
  useEffect(() => {
    if (phase !== 'active') return;
    const id = window.setInterval(() => void verify(false), 60_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void verify(false);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [phase, verify]);

  // Saat hitung mundur habis, tanyakan status resmi ke server.
  const remaining = useCountdown(license && !license.is_lifetime ? license.expires_at : null, offset, phase === 'active');
  useEffect(() => {
    if (phase === 'active' && remaining === 0) void verify(false);
  }, [phase, remaining, verify]);

  async function activate(e: FormEvent) {
    e.preventDefault();
    if (!KEY_REGEX.test(keyInput)) return;
    setPhase('activating');
    setNotice(null);
    try {
      apply(await licenseApi.activate(keyInput));
      setKeyInput('');
    } catch (err) {
      setPhase('idle');
      setNotice(noticeFromError(err));
    }
  }

  async function deactivate() {
    const token = sessionStore.get();
    if (token) {
      try {
        await licenseApi.deactivate(token);
      } catch (err) {
        if (err instanceof ApiClientError && err.isTransient) throw new Error('Tidak dapat menghubungi server. Coba lagi.');
        // Sesi sudah tidak valid di server: lanjut bersihkan lokal.
      }
    }
    sessionStore.clear();
    hasLicense.current = false;
    setLicense(null);
    setConfirmOpen(false);
    setPhase('idle');
    setNotice(null);
    toast.success('Perangkat dinonaktifkan');
  }

  const valid = KEY_REGEX.test(keyInput);

  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(48rem_24rem_at_50%_-8%,rgb(124_82_230/0.16),transparent)]">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-accent text-sm font-bold text-white">E</span>
          <span className="font-semibold tracking-tight">Epen</span>
        </div>
        <Link to="/admin/login" className="text-sm text-muted hover:text-ink">Admin</Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="card w-full max-w-md p-6 sm:p-8">
          {phase === 'checking' && (
            <div className="flex items-center justify-center gap-3 py-10 text-muted" role="status">
              <Spinner className="size-5" /> <span className="text-sm">Memeriksa lisensi…</span>
            </div>
          )}

          {(phase === 'idle' || phase === 'activating') && (
            <form onSubmit={activate} className="space-y-5" noValidate>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Aktifkan lisensi</h1>
                <p className="mt-1.5 text-sm text-muted">Masukkan license key Anda. Masa aktif mulai dihitung saat key pertama kali diaktifkan.</p>
              </div>

              <div>
                <label htmlFor="license-key" className="field-label">License key</label>
                <input
                  id="license-key"
                  className="input text-center font-mono text-base tracking-widest"
                  placeholder="EPEN-XXXX-XXXX-XXXX"
                  value={keyInput}
                  onChange={(e) => setKeyInput(formatKeyInput(e.target.value))}
                  disabled={phase === 'activating'}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  maxLength={19}
                  aria-invalid={notice?.tone === 'error' || undefined}
                  aria-describedby={notice ? 'activation-notice' : undefined}
                />
              </div>

              {notice && (
                <div
                  id="activation-notice"
                  role="alert"
                  className={`flex gap-3 rounded-lg border px-4 py-3 text-sm ${
                    notice.tone === 'error' ? 'border-bad/30 bg-bad/10 text-bad' : 'border-warn/30 bg-warn/10 text-warn'
                  }`}
                >
                  {notice.tone === 'error' ? <ShieldX className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
                  <div>
                    <p className="font-semibold">{notice.title}</p>
                    <p className="mt-0.5 opacity-90">{notice.message}</p>
                  </div>
                </div>
              )}

              <Button type="submit" className="w-full" loading={phase === 'activating'} disabled={!valid}>
                {phase === 'activating' ? 'Memvalidasi…' : 'Aktifkan'}
              </Button>
            </form>
          )}

          {phase === 'active' && license && (
            <>
              {offline && (
                <p className="mb-5 flex items-center gap-2 rounded-lg bg-warn/10 px-3 py-2 text-xs text-warn" role="status">
                  <WifiOff className="size-3.5 shrink-0" aria-hidden="true" />
                  Tidak dapat memverifikasi ke server. Menampilkan status terakhir yang terverifikasi.
                </p>
              )}
              <ActivePanel license={license} offset={offset} verifying={verifying} onVerify={() => void verify(true)} onDeactivate={() => setConfirmOpen(true)} />
            </>
          )}
        </div>
      </main>

      {confirmOpen && (
        <ConfirmModal
          title="Nonaktifkan perangkat ini?"
          description="Perangkat dilepas dari license dan slotnya dibebaskan. Anda perlu memasukkan key lagi untuk mengaktifkannya."
          confirmLabel="Nonaktifkan"
          danger
          onClose={() => setConfirmOpen(false)}
          onConfirm={deactivate}
        />
      )}
    </div>
  );
}
