import { Card, CardHeader } from '../components/ui/Card'
import { StatTile } from '../components/ui/StatTile'
import { StatusBadge } from '../components/ui/Badge'
import { OrdersTrendChart } from '../components/charts/OrdersTrendChart'
import { resumePesanan, pesananTerbaru } from '../data/dashboard'
import { ribuan, rupiah } from '../lib/format'

const toneDot: Record<string, string> = {
  warning: 'bg-warning',
  series1: 'bg-series-1',
  series3: 'bg-series-3',
  good: 'bg-good',
  critical: 'bg-critical',
}

export function OrdersTab() {
  const totalPesanan = resumePesanan.reduce((a, r) => a + r.jumlah, 0)
  const perluDikirim = resumePesanan.find((r) => r.status === 'Perlu Dikirim')?.jumlah ?? 0
  const selesai = resumePesanan.find((r) => r.status === 'Selesai')?.jumlah ?? 0

  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatTile label="Total Pesanan" value={ribuan(totalPesanan)} icon="orders" delta={9.4} hint="30 hari" />
        <StatTile label="Perlu Dikirim" value={ribuan(perluDikirim)} icon="box" hint="butuh tindakan" />
        <StatTile label="Pesanan Selesai" value={ribuan(selesai)} icon="dashboard" delta={11.2} hint="30 hari" />
        <StatTile label="Nilai Pesanan" value={rupiah(812_640_000, { compact: true })} icon="wallet" delta={12.8} hint="30 hari" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Trend chart */}
        <Card className="xl:col-span-2">
          <CardHeader title="Tren Pesanan Harian" subtitle="Pesanan masuk vs pesanan selesai" />
          <div className="px-2 pb-3 pt-2 sm:px-4">
            <OrdersTrendChart />
          </div>
        </Card>

        {/* Resume pesanan */}
        <Card>
          <CardHeader title="Resume Pesanan" subtitle="Status pesanan tokomu" />
          <div className="space-y-1 px-3 pb-4 pt-2">
            {resumePesanan.map((r) => (
              <div
                key={r.status}
                className="flex items-center justify-between rounded-xl px-2.5 py-2.5 hover:bg-surface-2"
              >
                <span className="flex items-center gap-2.5 text-[13.5px] text-ink-2">
                  <span className={`h-2 w-2 rounded-full ${toneDot[r.tone]}`} />
                  {r.status}
                </span>
                <span className="text-[15px] font-semibold text-ink tnum">{ribuan(r.jumlah)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Pesanan terbaru */}
      <Card>
        <CardHeader title="Pesanan Terbaru" subtitle="6 pesanan masuk terakhir" />
        <div className="overflow-x-auto px-2 pb-3 pt-2 sm:px-4">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="text-[12px] uppercase tracking-wide text-ink-3">
                <th className="px-3 py-2 font-medium">Invoice</th>
                <th className="px-3 py-2 font-medium">Pembeli</th>
                <th className="px-3 py-2 font-medium">Produk</th>
                <th className="px-3 py-2 text-center font-medium">Qty</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Waktu</th>
              </tr>
            </thead>
            <tbody>
              {pesananTerbaru.map((p) => (
                <tr key={p.id} className="border-t border-line text-[13.5px] hover:bg-surface-2">
                  <td className="px-3 py-3 font-medium text-ink tnum">{p.id}</td>
                  <td className="px-3 py-3 text-ink-2">{p.pembeli}</td>
                  <td className="px-3 py-3 text-ink-2">{p.produk}</td>
                  <td className="px-3 py-3 text-center text-ink-2 tnum">{p.qty}</td>
                  <td className="px-3 py-3 text-right font-medium text-ink tnum">{rupiah(p.total)}</td>
                  <td className="px-3 py-3"><StatusBadge status={p.status} /></td>
                  <td className="px-3 py-3 text-right text-[12.5px] text-ink-3">{p.waktu}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
