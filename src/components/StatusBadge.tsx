import type { EffectiveStatus } from '@/types';
import { STATUS_LABEL } from '@/lib/format';

const TONE: Record<EffectiveStatus, string> = {
  active: 'bg-ok/12 text-ok',
  unactivated: 'bg-accent/15 text-accent-soft',
  expired: 'bg-warn/12 text-warn',
  revoked: 'bg-bad/12 text-bad',
};

export function StatusBadge({ status }: { status: EffectiveStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${TONE[status]}`}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {STATUS_LABEL[status]}
    </span>
  );
}
