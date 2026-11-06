import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/Button';
import { EmptyState, ErrorNotice, PageHeader } from '@/components/PageHeader';
import { Spinner } from '@/components/Spinner';
import { adminApi } from '@/lib/api';
import { ACTION_LABEL, relativeTime } from '@/lib/format';
import type { LogRecord, Stats } from '@/types';

const SEGMENTS = [
  { key: 'active', label: 'Aktif', color: 'bg-ok', text: 'text-ok' },
  { key: 'unactivated', label: 'Belum diaktivasi', color: 'bg-accent', text: 'text-accent-soft' },
  { key: 'expired', label: 'Kedaluwarsa', color: 'bg-warn', text: 'text-warn' },
  { key: 'revoked', label: 'Dicabut', color: 'bg-bad', text: 'text-bad' },
] as const;

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [logs, setLogs] = useState<LogRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, l] = await Promise.all([adminApi.stats(), adminApi.logs({ page: 1, page_size: 8 })]);
      setStats(s);
      setLogs(l.logs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Ringkasan seluruh license. Status kedaluwarsa dihitung dengan waktu server."
        actions={
          <Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" /> Muat ulang
          </Button>
        }
      />

      {error && <ErrorNotice message={error} onRetry={() => void load()} />}

      {!stats && !error && (
        <div className="flex items-center gap-2 py-10 text-sm text-muted" role="status"><Spinner /> Memuat statistik…</div>
      )}

      {stats && (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label="Statistik license">
            <div className="card col-span-2 p-5 lg:col-span-1">
              <p className="text-sm text-muted">Total license</p>
              <p className="mt-2 font-mono text-3xl font-semibold tabular-nums">{stats.total}</p>
            </div>
            {SEGMENTS.map((s) => (
              <div key={s.key} className="card p-5">
                <p className="flex items-center gap-2 text-sm text-muted">
                  <span className={`size-2 rounded-full ${s.color}`} aria-hidden="true" /> {s.label}
                </p>
                <p className={`mt-2 font-mono text-3xl font-semibold tabular-nums ${s.text}`}>{stats[s.key]}</p>
              </div>
            ))}
          </section>

          <section className="card mt-4 p-5" aria-label="Distribusi status">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold">Distribusi status</h2>
              <span className="text-xs text-muted">{stats.devices} perangkat terdaftar</span>
            </div>
            {stats.total === 0 ? (
              <p className="text-sm text-muted">Belum ada license. Buat yang pertama lewat menu Generate License.</p>
            ) : (
              <div className="flex h-2.5 overflow-hidden rounded-full bg-raised">
                {SEGMENTS.map((s) => (
                  <div key={s.key} className={s.color} style={{ width: `${(stats[s.key] / stats.total) * 100}%` }} title={`${s.label}: ${stats[s.key]}`} />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <section className="card mt-4" aria-label="Aktivitas terbaru">
        <h2 className="border-b border-line px-5 py-4 text-sm font-semibold">Aktivitas terbaru</h2>
        {logs.length === 0 && !loading ? (
          <EmptyState title="Belum ada aktivitas" />
        ) : (
          <ul className="divide-y divide-line">
            {logs.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{ACTION_LABEL[l.action]}</p>
                  <p className="truncate font-mono text-xs text-muted">
                    {l.licenses?.key_hint ?? (l.metadata.key_hint as string | undefined) ?? '-'}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted">{relativeTime(l.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
