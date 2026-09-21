import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardHeader } from '../components/ui/Card'
import { StatTile } from '../components/ui/StatTile'
import { PayoutTrendChart } from '../components/charts/PayoutTrendChart'
import { makeTooltip } from '../components/charts/ChartTooltip'
import { komponenPenghasilan, penghasilan } from '../data/dashboard'
import { SERIES, INK } from '../lib/theme'
import { rupiah, ribuan } from '../lib/format'

const Tip = makeTooltip((v) => rupiah(v))

export function IncomeTab() {
  // Interaktif: komponen mana yang dihitung ke Total.
  const [inTotal, setInTotal] = useState<Set<string>>(
    () => new Set(komponenPenghasilan.filter((k) => k.defaultInTotal).map((k) => k.key)),
  )

  const toggle = (key: string) =>
    setInTotal((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  const total = useMemo(
    () =>
      komponenPenghasilan
        .filter((k) => inTotal.has(k.key))
        .reduce((a, k) => a + k.nilai, 0),
    [inTotal],
  )

  const chartData = komponenPenghasilan.map((k) => ({
    label: k.label,
    nilai: k.nilai,
    key: k.key,
    color: SERIES[k.seriesKey],
    aktif: inTotal.has(k.key),
  }))

  return (
    <div className="space-y-5">
      {/* KPI */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatTile label="Total Payout" value={rupiah(penghasilan.totalPayout, { compact: true })} icon="wallet" delta={penghasilan.trenPersen} hint="30 hari" />
        <StatTile label="Transaksi Payout" value={ribuan(penghasilan.transaksiPayout)} icon="orders" delta={7.6} hint="30 hari" />
        <StatTile label="Rata-rata / Transaksi" value={rupiah(Math.round(penghasilan.totalPayout / penghasilan.transaksiPayout))} icon="dashboard" hint="payout" />
        <StatTile label="Total Terpilih" value={rupiah(total, { compact: true })} icon="box" hint={`${inTotal.size} komponen`} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Interactive breakdown */}
        <Card className="xl:col-span-2">
          <CardHeader
            title="Rincian Komponen Penghasilan"
            subtitle="Klik komponen untuk menambah / melepas dari Total"
            action={
              <div className="rounded-xl bg-brand-soft px-3 py-1.5 text-right">
                <div className="text-[11px] font-medium text-brand-ink">TOTAL</div>
                <div className="text-[16px] font-semibold text-brand-ink tnum">{rupiah(total)}</div>
              </div>
            }
          />
          <div className="px-2 pb-2 pt-3 sm:px-4">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 20, right: 12, left: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={INK.grid} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={false} height={8} />
                <YAxis tickLine={false} axisLine={false} width={54} tickFormatter={(v) => rupiah(v, { compact: true }).replace('Rp', '')} />
                <Tooltip cursor={{ fill: 'rgba(22,21,15,0.04)' }} content={<Tip />} />
                <Bar dataKey="nilai" radius={[4, 4, 0, 0]} maxBarSize={64} isAnimationActive={false} onClick={(d: { key?: string }) => d.key && toggle(d.key)} className="cursor-pointer">
                  {chartData.map((d) => (
                    <Cell key={d.key} fill={d.color} fillOpacity={d.aktif ? 1 : 0.28} />
                  ))}
                  <LabelList dataKey="nilai" position="top" formatter={(v: number) => rupiah(v, { compact: true })} style={{ fontSize: 11, fill: INK.secondary }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Toggle chips */}
          <div className="flex flex-wrap gap-2 px-4 pb-4">
            {komponenPenghasilan.map((k) => {
              const on = inTotal.has(k.key)
              return (
                <button
                  key={k.key}
                  onClick={() => toggle(k.key)}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                    on
                      ? 'border-transparent bg-surface-2 text-ink'
                      : 'border-line bg-surface text-ink-3 line-through'
                  }`}
                  title={on ? 'Klik untuk lepas dari Total' : 'Klik untuk tambah ke Total'}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-[3px]"
                    style={{ background: SERIES[k.seriesKey], opacity: on ? 1 : 0.35 }}
                  />
                  {k.label}
                  <span className="tnum text-ink-2">{rupiah(k.nilai, { compact: true })}</span>
                </button>
              )
            })}
          </div>
        </Card>

        {/* Payout trend */}
        <Card>
          <CardHeader title="Tren Payout" subtitle="Payout masuk per minggu" />
          <div className="px-2 pb-4 pt-3 sm:px-4">
            <PayoutTrendChart />
          </div>
          <div className="mx-4 mb-4 rounded-xl border border-line bg-surface-2 p-3">
            <div className="text-[12px] text-ink-2">Payout Masuk (bulan ini)</div>
            <div className="mt-0.5 text-[20px] font-semibold text-ink tnum">
              {rupiah(penghasilan.totalPayout, { compact: true })}
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
