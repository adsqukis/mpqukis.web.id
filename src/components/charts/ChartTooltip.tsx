import type { TooltipProps } from 'recharts'

type Formatter = (value: number, name: string) => string

export function makeTooltip(format: Formatter) {
  return function ChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
    if (!active || !payload || payload.length === 0) return null
    return (
      <div className="rounded-xl border border-line bg-surface px-3 py-2 shadow-pop">
        {label !== undefined && (
          <div className="mb-1 text-[12px] font-medium text-ink-2">{label}</div>
        )}
        <div className="space-y-1">
          {payload.map((p, i) => (
            <div key={i} className="flex items-center gap-2 text-[13px]">
              <span
                className="h-2 w-2 rounded-[3px]"
                style={{ background: p.color }}
                aria-hidden
              />
              <span className="text-ink-2">{p.name}</span>
              <span className="ml-auto font-semibold text-ink tnum">
                {format(p.value as number, p.name as string)}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }
}
