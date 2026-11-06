import { useState, type FormEvent } from 'react';
import { Download, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/Button';
import { CopyButton, copyText } from '@/components/CopyButton';
import { DurationPicker } from '@/components/DurationPicker';
import { PageHeader } from '@/components/PageHeader';
import { useToast } from '@/components/Toast';
import { adminApi } from '@/lib/api';
import { defaultDurationState, toDurationPayload, validateDuration, type DurationState } from '@/lib/durations';
import { formatDuration } from '@/lib/format';
import { loadPrefs } from '@/lib/prefs';
import type { GenerateResponse } from '@/types';

export default function GeneratePage() {
  const toast = useToast();
  const prefs = loadPrefs();
  const [duration, setDuration] = useState<DurationState>({ ...defaultDurationState, duration: prefs.defaultDuration });
  const [count, setCount] = useState(1);
  const [maxDevices, setMaxDevices] = useState(prefs.defaultMaxDevices);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);

  const durationError = validateDuration(duration);
  const countValid = Number.isInteger(count) && count >= 1 && count <= 100;
  const devicesValid = Number.isInteger(maxDevices) && maxDevices >= 1 && maxDevices <= 1000;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.generate({
        ...toDurationPayload(duration),
        count,
        max_devices: maxDevices,
        note: note.trim() || undefined,
      });
      setResult(res);
      toast.success(`${res.licenses.length} license dibuat`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat license.');
    } finally {
      setLoading(false);
    }
  }

  function download() {
    if (!result) return;
    const text = result.licenses.map((l) => l.license_key).join('\n') + '\n';
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `epen-licenses-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyAll() {
    if (!result) return;
    const ok = await copyText(result.licenses.map((l) => l.license_key).join('\n'));
    if (ok) toast.success('Semua key tersalin');
    else toast.error('Gagal menyalin. Salin manual.');
  }

  return (
    <>
      <PageHeader title="Generate License" description="Buat satu atau banyak key sekaligus. Masa aktif baru mulai dihitung saat key pertama kali diaktivasi." />

      <div className="grid gap-4 lg:grid-cols-5">
        <form onSubmit={submit} className="card space-y-5 p-5 lg:col-span-2">
          <div>
            <span className="field-label">Durasi</span>
            <DurationPicker value={duration} onChange={setDuration} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label" htmlFor="count">Jumlah key</label>
              <input id="count" type="number" min={1} max={100} className="input" value={Number.isNaN(count) ? '' : count} onChange={(e) => setCount(e.target.value === '' ? NaN : Number(e.target.value))} />
              <p className="field-hint">1 sampai 100</p>
            </div>
            <div>
              <label className="field-label" htmlFor="devices">Batas perangkat</label>
              <input id="devices" type="number" min={1} max={1000} className="input" value={Number.isNaN(maxDevices) ? '' : maxDevices} onChange={(e) => setMaxDevices(e.target.value === '' ? NaN : Number(e.target.value))} />
              <p className="field-hint">Per key</p>
            </div>
          </div>

          <div>
            <label className="field-label" htmlFor="note">Catatan admin</label>
            <textarea id="note" className="input min-h-20" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Contoh: pelanggan Budi, paket Pro" />
          </div>

          {error && <p className="rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad" role="alert">{error}</p>}

          <Button type="submit" loading={loading} disabled={!countValid || !devicesValid || Boolean(durationError)} className="w-full">
            {loading ? 'Membuat…' : count > 1 ? `Buat ${count} license` : 'Buat license'}
          </Button>
        </form>

        <section className="card lg:col-span-3" aria-label="Hasil generate" aria-live="polite">
          {!result ? (
            <div className="px-6 py-16 text-center">
              <p className="font-medium">Key yang dibuat muncul di sini</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted">Atur durasi dan jumlah di sebelah kiri, lalu buat license.</p>
            </div>
          ) : (
            <div>
              <div className="flex items-start gap-3 border-b border-line bg-warn/8 px-5 py-4 text-sm">
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden="true" />
                <p>
                  <span className="font-semibold text-warn">Simpan sekarang.</span>{' '}
                  <span className="text-muted">Database hanya menyimpan hash, jadi key asli tidak bisa ditampilkan lagi setelah halaman ini ditutup.</span>
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <p className="text-sm text-muted">
                  {result.licenses.length} key · {formatDuration(result.duration_seconds, result.is_lifetime)} · {result.max_devices} perangkat
                </p>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => void copyAll()}>Salin semua</Button>
                  <Button variant="secondary" size="sm" onClick={download}><Download className="size-3.5" aria-hidden="true" /> Unduh .txt</Button>
                </div>
              </div>

              <ul className="max-h-[28rem] divide-y divide-line overflow-y-auto border-t border-line">
                {result.licenses.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-2 px-5 py-2.5">
                    <code className="select-all font-mono text-sm tracking-wider text-accent-soft">{l.license_key}</code>
                    <CopyButton text={l.license_key} label={`Salin ${l.key_hint}`} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
