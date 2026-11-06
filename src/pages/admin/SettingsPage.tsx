import { useState } from 'react';
import { CopyButton } from '@/components/CopyButton';
import { Button } from '@/components/Button';
import { PageHeader } from '@/components/PageHeader';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/hooks/useAuth';
import { DURATION_OPTIONS } from '@/lib/durations';
import { loadPrefs, savePrefs, type Prefs } from '@/lib/prefs';

const ENDPOINTS = [
  ['POST', '/api/license/activate'],
  ['POST', '/api/license/verify'],
  ['POST', '/api/license/deactivate'],
] as const;

export default function SettingsPage() {
  const { admin, signOut } = useAuth();
  const toast = useToast();
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const base = window.location.origin;

  return (
    <>
      <PageHeader title="Settings" description="Akun admin, endpoint untuk software Anda, dan nilai default form." />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="text-sm font-semibold">Akun admin</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div><dt className="text-xs text-muted">Email</dt><dd>{admin?.email ?? '-'}</dd></div>
            <div><dt className="text-xs text-muted">User ID</dt><dd className="break-all font-mono text-xs">{admin?.id}</dd></div>
          </dl>
          <Button variant="secondary" size="sm" className="mt-4" onClick={() => void signOut()}>Logout</Button>
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-semibold">Default generate</h2>
          <div className="mt-3 space-y-3">
            <div>
              <label className="field-label" htmlFor="pref-duration">Durasi</label>
              <select id="pref-duration" className="input" value={prefs.defaultDuration} onChange={(e) => setPrefs({ ...prefs, defaultDuration: e.target.value as Prefs['defaultDuration'] })}>
                {DURATION_OPTIONS.filter((o) => o.key !== 'custom').map((o) => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="pref-devices">Batas perangkat</label>
              <input id="pref-devices" type="number" min={1} max={1000} className="input" value={prefs.defaultMaxDevices} onChange={(e) => setPrefs({ ...prefs, defaultMaxDevices: Math.min(1000, Math.max(1, Number(e.target.value) || 1)) })} />
            </div>
            <Button size="sm" onClick={() => { savePrefs(prefs); toast.success('Pengaturan disimpan'); }}>Simpan pengaturan</Button>
            <p className="field-hint">Disimpan di browser ini saja. Hanya memengaruhi nilai awal form.</p>
          </div>
        </section>

        <section className="card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold">Endpoint untuk software Anda</h2>
          <ul className="mt-3 divide-y divide-line">
            {ENDPOINTS.map(([method, path]) => (
              <li key={path} className="flex items-center justify-between gap-2 py-2">
                <code className="min-w-0 break-all font-mono text-xs"><span className="text-accent-soft">{method}</span> {base}{path}</code>
                <CopyButton text={`${base}${path}`} label={`Salin ${path}`} />
              </li>
            ))}
          </ul>
          <p className="field-hint">Body verify/deactivate: <code className="font-mono">{'{ "session_token": "..." }'}</code> atau <code className="font-mono">{'{ "license_key", "device_id" }'}</code>.</p>
        </section>
      </div>
    </>
  );
}
