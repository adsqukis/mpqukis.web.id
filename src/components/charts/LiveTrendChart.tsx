import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { liveTren } from '../../data/dashboard'
import { SERIES, INK } from '../../lib/theme'
import { ribuan } from '../../lib/format'
import { makeTooltip } from './ChartTooltip'

const Tip = makeTooltip((v) => ribuan(v))

export function LiveTrendChart() {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={liveTren} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="gPenonton" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES[5]} stopOpacity={0.22} />
            <stop offset="100%" stopColor={SERIES[5]} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={INK.grid} />
        <XAxis dataKey="sesi" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} width={44} />
        <Tooltip cursor={{ fill: 'rgba(22,21,15,0.04)' }} content={<Tip />} />
        <Legend
          verticalAlign="top"
          align="right"
          height={28}
          wrapperStyle={{ fontSize: 12, color: INK.secondary }}
        />
        <Area
          type="monotone"
          name="Penonton"
          dataKey="penonton"
          stroke={SERIES[5]}
          strokeWidth={2}
          fill="url(#gPenonton)"
          dot={false}
          isAnimationActive={false}
        />
        <Bar dataKey="pesanan" name="Pesanan" fill={SERIES[1]} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
