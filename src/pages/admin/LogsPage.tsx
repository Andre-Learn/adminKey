import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/Button';
import { EmptyState, ErrorNotice, PageHeader } from '@/components/PageHeader';
import { Pagination } from '@/components/Pagination';
import { Spinner } from '@/components/Spinner';
import { adminApi } from '@/lib/api';
import { ACTION_LABEL, formatDateTime } from '@/lib/format';
import type { LogAction, LogRecord } from '@/types';

const PAGE_SIZE = 25;
const ACTOR_LABEL = { system: 'Sistem', admin: 'Admin', user: 'User' } as const;

function detail(l: LogRecord): string {
  const m = l.metadata;
  const parts: string[] = [];
  if (typeof m.reason === 'string') parts.push(`alasan: ${m.reason}`);
  if (typeof m.device_name === 'string') parts.push(m.device_name);
  if (typeof m.seconds === 'number') parts.push(`+${m.seconds} detik`);
  if (m.lifetime === true) parts.push('lifetime');
  if (typeof m.expires_at === 'string') parts.push(`exp ${formatDateTime(m.expires_at)}`);
  return parts.join(' · ');
}

export default function LogsPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<LogAction | ''>('');
  const [data, setData] = useState<{ logs: LogRecord[]; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    adminApi
      .logs({ page, page_size: PAGE_SIZE, action })
      .then((res) => !cancelled && setData({ logs: res.logs, total: res.total }))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : 'Gagal memuat log.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, action, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const logs = data?.logs ?? [];

  return (
    <>
      <PageHeader
        title="License Logs"
        description="Audit log append-only: tidak bisa diubah atau dihapus lewat aplikasi."
        actions={
          <div className="flex gap-2">
            <select className="input !w-auto" aria-label="Filter aksi" value={action} onChange={(e) => { setAction(e.target.value as LogAction | ''); setPage(1); }}>
              <option value="">Semua aksi</option>
              {(Object.keys(ACTION_LABEL) as LogAction[]).map((a) => (
                <option key={a} value={a}>{ACTION_LABEL[a]}</option>
              ))}
            </select>
            <Button variant="secondary" size="sm" onClick={refresh} disabled={loading} aria-label="Muat ulang">
              <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            </Button>
          </div>
        }
      />
      {error && <ErrorNotice message={error} onRetry={refresh} />}

      <div className="card overflow-hidden">
        {!data && loading && <div className="flex items-center gap-2 px-5 py-10 text-sm text-muted" role="status"><Spinner /> Memuat log…</div>}
        {data && logs.length === 0 && <EmptyState title="Belum ada log" />}
        {logs.length > 0 && (
          <ul className={`divide-y divide-line ${loading ? 'opacity-60' : ''}`}>
            {logs.map((l) => (
              <li key={l.id} className="px-4 py-3.5 sm:px-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{ACTION_LABEL[l.action]}</p>
                  <time className="text-xs text-muted" dateTime={l.created_at}>{formatDateTime(l.created_at)}</time>
                </div>
                <p className="mt-1 text-xs text-muted">
                  <span className="font-mono">{l.licenses?.key_hint ?? (l.metadata.key_hint as string | undefined) ?? '-'}</span>
                  {' · '}{ACTOR_LABEL[l.actor_type]}
                  {l.ip ? ` · IP ${l.ip}` : ''}
                  {detail(l) ? ` · ${detail(l)}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
      {data && data.total > 0 && <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onChange={setPage} />}
    </>
  );
}
