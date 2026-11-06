import {
  DURATION_OPTIONS,
  UNIT_LABEL,
  validateDuration,
  type CustomUnit,
  type DurationState,
} from '@/lib/durations';
import type { DurationKey } from '@/types';

interface Props {
  value: DurationState;
  onChange: (next: DurationState) => void;
  exclude?: DurationKey[];
}

export function DurationPicker({ value, onChange, exclude = [] }: Props) {
  const error = validateDuration(value);
  const options = DURATION_OPTIONS.filter((o) => !exclude.includes(o.key));

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Durasi license">
        {options.map((o) => {
          const active = value.duration === o.key;
          return (
            <button
              key={o.key}
              type="button"
              aria-pressed={active}
              onClick={() => onChange({ ...value, duration: o.key })}
              className={`rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'border-accent bg-accent/15 text-accent-soft'
                  : 'border-line bg-canvas text-muted hover:border-accent/50 hover:text-ink'
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      {value.duration === 'custom' && (
        <div className="mt-3 flex gap-2">
          <input
            type="number"
            min={1}
            step="any"
            inputMode="decimal"
            className="input max-w-32"
            aria-label="Jumlah durasi"
            value={Number.isFinite(value.customAmount) ? value.customAmount : ''}
            onChange={(e) => onChange({ ...value, customAmount: e.target.value === '' ? NaN : Number(e.target.value) })}
          />
          <select
            className="input max-w-36"
            aria-label="Satuan durasi"
            value={value.customUnit}
            onChange={(e) => onChange({ ...value, customUnit: e.target.value as CustomUnit })}
          >
            {(Object.keys(UNIT_LABEL) as CustomUnit[]).map((u) => (
              <option key={u} value={u}>
                {UNIT_LABEL[u]}
              </option>
            ))}
          </select>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-bad">{error}</p>}
    </div>
  );
}
