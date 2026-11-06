import { useCallback, useEffect, useState } from 'react';
import { Ban, CalendarPlus, MonitorSmartphone, RefreshCw, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/Button';
import { DeleteModal, DevicesModal, ExtendModal, RevokeModal } from '@/components/LicenseModals';
import { EmptyState, ErrorNotice, PageHeader } from '@/components/PageHeader';
import { Pagination } from '@/components/Pagination';
import { Spinner } from '@/components/Spinner';
import { StatusBadge } from '@/components/StatusBadge';
import { useDebounce } from '@/hooks/useDebounce';
import { adminApi } from '@/lib/api';
import { effectiveStatus, formatDateTime, formatDuration } from '@/lib/format';
import type { License } from '@/types';

const FILTERS = [
  { value: 'all', label: 'Semua' },
  { value: 'active', label: 'Aktif' },
  { value: 'unactivated', label: 'Belum diaktivasi' },
  { value: 'expired', label: 'Kedaluwarsa' },
  { value: 'revoked', label: 'Dicabut' },
];

const PAGE_SIZE = 20;
type ModalState = { kind: 'extend' | 'revoke' | 'delete' | 'devices'; license: License } | null;

function expiryText(l: License): string {
  if (l.is_lifetime) return 'Tidak pernah';
  if (!l.activated_at) return 'Mulai saat aktivasi';
  return formatDateTime(l.expires_at);
}

function RowActions({ l, open }: { l: License; open: (kind: NonNullable<ModalState>['kind']) => void }) {
  const revoked = l.status === 'revoked';
  return (
    <div className="flex items-center justify-end gap-1">
      <Button variant="ghost" size="sm" onClick={() => open('devices')} aria-label="Lihat perangkat" title="Lihat perangkat"><MonitorSmartphone className="size-4" aria-hidden="true" /></Button>
      <Button variant="ghost" size="sm" disabled={revoked || l.is_lifetime} onClick={() => open('extend')} aria-label="Perpanjang" title="Perpanjang"><CalendarPlus className="size-4" aria-hidden="true" /></Button>
      <Button variant="ghost" size="sm" disabled={revoked} onClick={() => open('revoke')} aria-label="Cabut" title="Cabut"><Ban className="size-4" aria-hidden="true" /></Button>
      <Button variant="ghost" size="sm" onClick={() => open('delete')} aria-label="Hapus" title="Hapus" className="hover:text-bad"><Trash2 className="size-4" aria-hidden="true" /></Button>
    </div>
  );
}

export default function LicenseListPage() {
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search);
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ licenses: License[]; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    adminApi
      .listLicenses({ page, page_size: PAGE_SIZE, status, search: debounced })
      .then((res) => {
        if (!cancelled) setData({ licenses: res.licenses, total: res.total });
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Gagal memuat license.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, status, debounced, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const closeModal = useCallback(() => setModal(null), []);
  const done = useCallback(() => {
    setModal(null);
    refresh();
  }, [refresh]);

  const rows = data?.licenses ?? [];

  return (
    <>
      <PageHeader
        title="License List"
        description="Cari lewat 4 karakter terakhir key, catatan, ID, atau tempel key lengkap (dicocokkan lewat hash)."
        actions={
          <Button variant="secondary" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" /> Muat ulang
          </Button>
        }
      />

      <div className="mb-4 space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            className="input pl-10"
            placeholder="Cari key, catatan, atau ID"
            aria-label="Cari license"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="group" aria-label="Filter status">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={status === f.value}
              onClick={() => {
                setStatus(f.value);
                setPage(1);
              }}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                status === f.value ? 'border-accent bg-accent/15 text-accent-soft' : 'border-line text-muted hover:text-ink'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorNotice message={error} onRetry={refresh} />}

      <div className="card overflow-hidden">
        {!data && loading && (
          <div className="flex items-center gap-2 px-5 py-10 text-sm text-muted" role="status"><Spinner /> Memuat license…</div>
        )}
        {data && rows.length === 0 && <EmptyState title="Tidak ada license" hint="Ubah filter atau kata kunci pencarian." />}

        {rows.length > 0 && (
          <>
            {/* Desktop */}
            <table className="hidden w-full text-left text-sm md:table">
              <thead className="border-b border-line text-xs text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Key</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Durasi</th>
                  <th className="px-4 py-3 font-medium">Diaktivasi</th>
                  <th className="px-4 py-3 font-medium">Kedaluwarsa</th>
                  <th className="px-4 py-3 font-medium">Perangkat</th>
                  <th className="px-4 py-3"><span className="sr-only">Aksi</span></th>
                </tr>
              </thead>
              <tbody className={`divide-y divide-line ${loading ? 'opacity-60' : ''}`}>
                {rows.map((l) => (
                  <tr key={l.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs">{l.key_hint}</p>
                      {l.note && <p className="mt-0.5 max-w-48 truncate text-xs text-muted" title={l.note}>{l.note}</p>}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={effectiveStatus(l)} /></td>
                    <td className="px-4 py-3 text-muted">{formatDuration(l.duration_seconds, l.is_lifetime)}</td>
                    <td className="px-4 py-3 text-muted">{formatDateTime(l.activated_at)}</td>
                    <td className="px-4 py-3 text-muted">{expiryText(l)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted">{l.devices_count}/{l.max_devices}</td>
                    <td className="px-4 py-2"><RowActions l={l} open={(kind) => setModal({ kind, license: l })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile */}
            <ul className={`divide-y divide-line md:hidden ${loading ? 'opacity-60' : ''}`}>
              {rows.map((l) => (
                <li key={l.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-sm">{l.key_hint}</p>
                      {l.note && <p className="mt-0.5 truncate text-xs text-muted">{l.note}</p>}
                    </div>
                    <StatusBadge status={effectiveStatus(l)} />
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <div><dt className="text-muted">Durasi</dt><dd>{formatDuration(l.duration_seconds, l.is_lifetime)}</dd></div>
                    <div><dt className="text-muted">Perangkat</dt><dd className="font-mono">{l.devices_count}/{l.max_devices}</dd></div>
                    <div><dt className="text-muted">Diaktivasi</dt><dd>{formatDateTime(l.activated_at)}</dd></div>
                    <div><dt className="text-muted">Kedaluwarsa</dt><dd>{expiryText(l)}</dd></div>
                  </dl>
                  <RowActions l={l} open={(kind) => setModal({ kind, license: l })} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {data && data.total > 0 && <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onChange={setPage} />}

      {modal?.kind === 'extend' && <ExtendModal license={modal.license} onClose={closeModal} onDone={done} />}
      {modal?.kind === 'revoke' && <RevokeModal license={modal.license} onClose={closeModal} onDone={done} />}
      {modal?.kind === 'delete' && <DeleteModal license={modal.license} onClose={closeModal} onDone={done} />}
      {modal?.kind === 'devices' && <DevicesModal license={modal.license} onClose={closeModal} />}
    </>
  );
}
