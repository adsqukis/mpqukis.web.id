import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardHeader } from '../components/ui/Card'
import { StatTile } from '../components/ui/StatTile'
import { Icon } from '../components/ui/Icon'
import { Pill } from '../components/ui/Badge'
import { LiveTrendChart } from '../components/charts/LiveTrendChart'
import { makeTooltip } from '../components/charts/ChartTooltip'
import { produk, liveStats, kampanye } from '../data/dashboard'
import { SERIES, INK } from '../lib/theme'
import { ribuan, rupiah, persen } from '../lib/format'

const Tip = makeTooltip((v) => `${ribuan(v)} terjual`)

export function ProductsTab() {
  const chartData = produk.map((p) => ({ nama: p.nama, terjual: p.terjual, color: SERIES[p.seriesKey] }))

  return (
    <div className="space-y-5">
      {/* KPI live */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatTile label="Sesi Live" value={ribuan(liveStats.totalSesi)} icon="live" hint="bulan ini" />
        <StatTile label="Total Penonton" value={ribuan(liveStats.penonton)} icon="dashboard" delta={18.5} hint="30 hari" />
        <StatTile label="Pesanan dari Live" value={ribuan(liveStats.pesananLive)} icon="orders" delta={22.1} hint="30 hari" />
        <StatTile label="Omzet Live" value={rupiah(liveStats.omzetLive, { compact: true })} icon="wallet" delta={15.4} hint="30 hari" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Product sales */}
        <Card className="xl:col-span-2">
          <CardHeader title="Semua Produk" subtitle="Unit terjual per produk (30 hari)" />
          <div className="px-2 pb-2 pt-3 sm:px-4">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart layout="vertical" data={chartData} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke={INK.grid} />
                <XAxis type="number" tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="nama" tickLine={false} axisLine={false} width={140} tick={{ fontSize: 12 }} />
                <Tooltip cursor={{ fill: 'rgba(22,21,15,0.04)' }} content={<Tip />} />
                <Bar dataKey="terjual" radius={[0, 4, 4, 0]} maxBarSize={30} isAnimationActive={false}>
                  {chartData.map((d) => (
                    <Cell key={d.nama} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Product list */}
          <div className="divide-y divide-line px-4 pb-4">
            {produk.map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-3">
                <span className="h-8 w-1.5 rounded-full" style={{ background: SERIES[p.seriesKey] }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-medium text-ink">{p.nama}</div>
                  <div className="text-[12px] text-ink-3">{p.varian} · {rupiah(p.harga)}</div>
                </div>
                <div className="hidden items-center gap-1 text-[12.5px] text-ink-2 sm:flex">
                  <Icon name="star" size={14} className="text-warning" /> {p.rating}
                </div>
                <div className="w-20 text-right">
                  <div className="text-[14px] font-semibold text-ink tnum">{ribuan(p.terjual)}</div>
                  <div className={`text-[11.5px] font-medium ${p.trenPersen >= 0 ? 'text-good' : 'text-critical'}`}>
                    {persen(p.trenPersen)}
                  </div>
                </div>
                <div className="w-16 text-right">
                  <div className="text-[12px] text-ink-3">stok</div>
                  <div className={`text-[13px] font-medium tnum ${p.stok < 100 ? 'text-critical' : 'text-ink-2'}`}>
                    {ribuan(p.stok)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Live stats */}
        <Card>
          <CardHeader title="Statistik Siaran Langsung" subtitle={`Konversi ${liveStats.konversiPersen}% · ${liveStats.totalSesi} sesi`} />
          <div className="px-2 pb-4 pt-3 sm:px-4">
            <LiveTrendChart />
          </div>
        </Card>
      </div>

      {/* Kampanye iklan */}
      <Card>
        <CardHeader title="Performa Kampanye Iklan" subtitle="Belanja iklan, omzet, dan ROAS per kampanye" />
        <div className="overflow-x-auto px-2 pb-3 pt-2 sm:px-4">
          <table className="w-full min-w-[620px] border-collapse text-left">
            <thead>
              <tr className="text-[12px] uppercase tracking-wide text-ink-3">
                <th className="px-3 py-2 font-medium">Kampanye</th>
                <th className="px-3 py-2 text-right font-medium">Belanja</th>
                <th className="px-3 py-2 text-right font-medium">Omzet</th>
                <th className="px-3 py-2 text-right font-medium">ROAS</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {kampanye.map((k) => (
                <tr key={k.nama} className="border-t border-line text-[13.5px] hover:bg-surface-2">
                  <td className="px-3 py-3 font-medium text-ink">{k.nama}</td>
                  <td className="px-3 py-3 text-right text-ink-2 tnum">{rupiah(k.belanja, { compact: true })}</td>
                  <td className="px-3 py-3 text-right font-medium text-ink tnum">{rupiah(k.omzet, { compact: true })}</td>
                  <td className="px-3 py-3 text-right tnum">
                    <span className={`font-semibold ${k.roas >= 4 ? 'text-good' : 'text-warning'}`}>{k.roas.toFixed(1)}×</span>
                  </td>
                  <td className="px-3 py-3">
                    <Pill tone={k.status === 'Aktif' ? 'good' : 'warning'}>{k.status}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
