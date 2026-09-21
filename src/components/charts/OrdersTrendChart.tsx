import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { trenPesanan } from '../../data/dashboard'
import { SERIES, INK } from '../../lib/theme'
import { ribuan } from '../../lib/format'
import { makeTooltip } from './ChartTooltip'

const Tip = makeTooltip((v) => ribuan(v))

export function OrdersTrendChart() {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={trenPesanan} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="gPesanan" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES[1]} stopOpacity={0.24} />
            <stop offset="100%" stopColor={SERIES[1]} stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="gSelesai" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES[3]} stopOpacity={0.2} />
            <stop offset="100%" stopColor={SERIES[3]} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={INK.grid} />
        <XAxis dataKey="hari" tickLine={false} axisLine={false} minTickGap={28} interval="preserveStartEnd" />
        <YAxis tickLine={false} axisLine={false} width={40} />
        <Tooltip content={<Tip />} />
        <Legend
          verticalAlign="top"
          align="right"
          height={28}
          iconType="plainline"
          wrapperStyle={{ fontSize: 12, color: INK.secondary }}
        />
        <Area
          type="monotone"
          name="Pesanan"
          dataKey="pesanan"
          stroke={SERIES[1]}
          strokeWidth={2}
          fill="url(#gPesanan)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          name="Selesai"
          dataKey="selesai"
          stroke={SERIES[3]}
          strokeWidth={2}
          fill="url(#gSelesai)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
