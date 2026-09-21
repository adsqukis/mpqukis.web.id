import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { trenPayout } from '../../data/dashboard'
import { SERIES, INK } from '../../lib/theme'
import { rupiah } from '../../lib/format'
import { makeTooltip } from './ChartTooltip'

const Tip = makeTooltip((v) => rupiah(v))

export function PayoutTrendChart() {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={trenPayout} margin={{ top: 8, right: 8, left: -6, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={INK.grid} />
        <XAxis dataKey="minggu" tickLine={false} axisLine={false} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={44}
          tickFormatter={(v) => rupiah(v, { compact: true }).replace('Rp', '')}
        />
        <Tooltip cursor={{ fill: 'rgba(22,21,15,0.04)' }} content={<Tip />} />
        <Bar dataKey="payout" name="Payout" fill={SERIES[1]} radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}
