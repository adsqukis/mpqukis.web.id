import { Icon, type IconName } from './Icon'
import { persen } from '../../lib/format'

type StatTileProps = {
  label: string
  value: string
  icon?: IconName
  delta?: number
  hint?: string
}

export function StatTile({ label, value, icon, delta, hint }: StatTileProps) {
  const up = (delta ?? 0) >= 0
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-card transition-shadow hover:shadow-card-hover sm:p-5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-ink-2">{label}</span>
        {icon && (
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-soft text-brand-ink">
            <Icon name={icon} size={17} />
          </span>
        )}
      </div>
      <div className="mt-2 text-[26px] font-semibold leading-none tracking-tight text-ink tnum">
        {value}
      </div>
      <div className="mt-2 flex items-center gap-2">
        {delta !== undefined && (
          <span
            className={`inline-flex items-center gap-0.5 text-[12px] font-semibold ${
              up ? 'text-good' : 'text-critical'
            }`}
          >
            <Icon name={up ? 'arrow-up' : 'arrow-down'} size={13} />
            {persen(Math.abs(delta))}
          </span>
        )}
        {hint && <span className="text-[12px] text-ink-3">{hint}</span>}
      </div>
    </div>
  )
}
