import type { StatusPesanan } from '../../data/dashboard'

const MAP: Record<StatusPesanan, { bg: string; text: string; dot: string }> = {
  'Perlu Dikirim': { bg: 'bg-[#fbf1dc]', text: 'text-[#946200]', dot: 'bg-warning' },
  'Sedang Dikirim': { bg: 'bg-[#e6f0fb]', text: 'text-[#1a5cab]', dot: 'bg-series-1' },
  'Telah Dikirim': { bg: 'bg-[#e2f4ec]', text: 'text-[#0f7a54]', dot: 'bg-series-3' },
  Selesai: { bg: 'bg-[#e4f5e4]', text: 'text-[#1f7a1f]', dot: 'bg-good' },
  Batal: { bg: 'bg-[#fbe6e6]', text: 'text-[#a52a2a]', dot: 'bg-critical' },
}

export function StatusBadge({ status }: { status: StatusPesanan }) {
  const s = MAP[status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium ${s.bg} ${s.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden />
      {status}
    </span>
  )
}

export function Pill({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode
  tone?: 'neutral' | 'good' | 'warning'
}) {
  const tones = {
    neutral: 'bg-surface-2 text-ink-2 border border-line',
    good: 'bg-[#e4f5e4] text-[#1f7a1f]',
    warning: 'bg-[#fbf1dc] text-[#946200]',
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  )
}
