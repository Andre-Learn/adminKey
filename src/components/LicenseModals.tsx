import { useCallback, useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { defaultDurationState, toDurationPayload, validateDuration, type DurationState } from '@/lib/durations';
import { formatDateTime, formatDuration, relativeTime } from '@/lib/format';
import type { DeviceRecord, License } from '@/types';
import { Button } from './Button';
import { ConfirmModal } from './ConfirmModal';
import { DurationPicker } from './DurationPicker';
import { Modal } from './Modal';
import { ErrorNotice } from './PageHeader';
import { Spinner } from './Spinner';
import { useToast } from './Toast';

interface BaseProps {
  license: License;
  onClose: () => void;
  onDone: () => void;
}

export function ExtendModal({ license, onClose, onDone }: BaseProps) {
  const toast = useToast();
  const [state, setState] = useState<DurationState>({ ...defaultDurationState, duration: '30d' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const invalid = validateDuration(state);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      await adminApi.extend({ id: license.id, ...toDurationPayload(state) });
      toast.success('License diperpanjang');
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memperpanjang license.');
      setLoading(false);
    }
  }

  return (
    <Modal
      title="Perpanjang license"
      description={
        license.activated_at
          ? `Waktu ditambahkan dari tanggal kedaluwarsa saat ini (atau dari sekarang jika sudah lewat). ${license.key_hint}`
          : `Belum diaktivasi: tambahan durasi digabung ke durasi awal, hitungan tetap mulai saat aktivasi pertama. ${license.key_hint}`
      }
      onClose={onClose}
    >
      <DurationPicker value={state} onChange={setState} />
      {error && <p className="mt-3 rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad" role="alert">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={loading}>Batal</Button>
        <Button onClick={submit} loading={loading} disabled={Boolean(invalid)}>Perpanjang</Button>
      </div>
    </Modal>
  );
}

export function RevokeModal({ license, onClose, onDone }: BaseProps) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  return (
    <ConfirmModal
      title="Cabut license"
      description={`${license.key_hint} tidak akan bisa diaktivasi atau diverifikasi lagi. Perangkat yang sedang memakainya akan ditolak pada verifikasi berikutnya.`}
      confirmLabel="Cabut license"
      danger
      onClose={onClose}
      onConfirm={async () => {
        await adminApi.revoke({ id: license.id, reason: reason.trim() || undefined });
        toast.success('License dicabut');
        onDone();
      }}
    >
      <label className="field-label" htmlFor="revoke-reason">Alasan (opsional)</label>
      <textarea
        id="revoke-reason"
        className="input min-h-20"
        maxLength={300}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Contoh: refund, key bocor"
      />
    </ConfirmModal>
  );
}

export function DeleteModal({ license, onClose, onDone }: BaseProps) {
  const toast = useToast();
  return (
    <ConfirmModal
      title="Hapus license"
      description={`${license.key_hint} beserta daftar perangkatnya akan dihapus permanen. Catatan di License Logs tetap tersimpan.`}
      confirmLabel="Hapus permanen"
      danger
      onClose={onClose}
      onConfirm={async () => {
        await adminApi.remove(license.id);
        toast.success('License dihapus');
        onDone();
      }}
    />
  );
}

export function DevicesModal({ license, onClose }: { license: License; onClose: () => void }) {
  const toast = useToast();
  const [devices, setDevices] = useState<DeviceRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await adminApi.devices({ page: 1, page_size: 100, license_id: license.id });
      setDevices(res.devices);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat perangkat.');
    }
  }, [license.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(id: string) {
    setRemoving(id);
    try {
      await adminApi.removeDevice(id);
      toast.success('Perangkat dihapus');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menghapus perangkat.');
    } finally {
      setRemoving(null);
    }
  }

  return (
    <Modal
      title="Perangkat license"
      description={`${license.key_hint} · ${license.devices_count} dari ${license.max_devices} slot terpakai · durasi ${formatDuration(license.duration_seconds, license.is_lifetime)}`}
      onClose={onClose}
      wide
    >
      {error && <ErrorNotice message={error} onRetry={() => void load()} />}
      {!devices && !error && (
        <div className="flex items-center gap-2 py-8 text-sm text-muted" role="status">
          <Spinner /> Memuat perangkat…
        </div>
      )}
      {devices && devices.length === 0 && <p className="py-8 text-center text-sm text-muted">Belum ada perangkat yang memakai key ini.</p>}
      {devices && devices.length > 0 && (
        <ul className="divide-y divide-line">
          {devices.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{d.device_name ?? 'Perangkat tanpa nama'}</p>
                <p className="truncate text-xs text-muted">
                  {d.platform ?? '-'} · IP {d.last_ip ?? '-'} · terdaftar {formatDateTime(d.first_seen_at)} · terakhir aktif {relativeTime(d.last_seen_at)}
                </p>
              </div>
              <Button variant="danger" size="sm" loading={removing === d.id} onClick={() => void remove(d.id)} aria-label="Hapus perangkat">
                <Trash2 className="size-3.5" aria-hidden="true" /> Hapus
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
