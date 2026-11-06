import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/Button';
import { ConfirmModal } from '@/components/ConfirmModal';
import { EmptyState, ErrorNotice, PageHeader } from '@/components/PageHeader';
import { Pagination } from '@/components/Pagination';
import { Spinner } from '@/components/Spinner';
import { StatusBadge } from '@/components/StatusBadge';
import { useToast } from '@/components/Toast';
import { adminApi } from '@/lib/api';
import { effectiveStatus, formatDateTime, relativeTime } from '@/lib/format';
import type { DeviceRecord } from '@/types';

const PAGE_SIZE = 20;

export default function DevicesPage() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ devices: DeviceRecord[]; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<DeviceRecord | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    adminApi
      .devices({ page, page_size: PAGE_SIZE })
      .then((res) => !cancelled && setData({ devices: res.devices, total: res.total }))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : 'Gagal memuat perangkat.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const devices = data?.devices ?? [];

  return (
    <>
      <PageHeader
        title="User Devices"
        description="Perangkat yang sedang memakai license. Menghapus perangkat membebaskan satu slot."
        actions={
          <Button variant="secondary" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" /> Muat ulang
          </Button>
        }
      />
      {error && <ErrorNotice message={error} onRetry={refresh} />}

      <div className="card overflow-hidden">
        {!data && loading && <div className="flex items-center gap-2 px-5 py-10 text-sm text-muted" role="status"><Spinner /> Memuat perangkat…</div>}
        {data && devices.length === 0 && <EmptyState title="Belum ada perangkat" hint="Perangkat muncul setelah user mengaktivasi sebuah key." />}

        {devices.length > 0 && (
          <ul className={`divide-y divide-line ${loading ? 'opacity-60' : ''}`}>
            {devices.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{d.device_name ?? 'Perangkat tanpa nama'}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {d.platform ?? '-'} · IP {d.last_ip ?? '-'}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    Terdaftar {formatDateTime(d.first_seen_at)} · aktif {relativeTime(d.last_seen_at)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-mono text-xs">{d.licenses?.key_hint ?? '-'}</p>
                    {d.licenses && <div className="mt-1"><StatusBadge status={effectiveStatus(d.licenses)} /></div>}
                  </div>
                  <Button variant="danger" size="sm" onClick={() => setTarget(d)} aria-label="Hapus perangkat">
                    <Trash2 className="size-3.5" aria-hidden="true" /> Hapus
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {data && data.total > 0 && <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onChange={setPage} />}

      {target && (
        <ConfirmModal
          title="Hapus perangkat"
          description={`${target.device_name ?? 'Perangkat'} akan dilepas dari ${target.licenses?.key_hint ?? 'license'}. User harus aktivasi ulang untuk memakainya lagi.`}
          confirmLabel="Hapus perangkat"
          danger
          onClose={() => setTarget(null)}
          onConfirm={async () => {
            await adminApi.removeDevice(target.id);
            toast.success('Perangkat dihapus');
            setTarget(null);
            refresh();
          }}
        />
      )}
    </>
  );
}
