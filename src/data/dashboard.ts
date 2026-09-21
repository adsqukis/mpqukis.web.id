// ─────────────────────────────────────────────────────────────────────────────
// Data model — MP Qukis dashboard (Generos Official Store).
// Struktur diambil dari dashboard asli; angka bersifat representatif dan
// terpusat di satu tempat agar mudah diganti ke sumber data / API nanti.
// Ganti isi file ini (atau sambungkan ke API) tanpa menyentuh komponen UI.
// ─────────────────────────────────────────────────────────────────────────────

export const store = {
  name: 'Generos Official Store',
  brand: 'Generos Milk',
  periode: '1–30 September 2026',
}

// ── Produk ───────────────────────────────────────────────────────────────────
export type Produk = {
  id: string
  nama: string
  varian: string
  seriesKey: 1 | 2 | 3 | 4 | 5
  harga: number
  terjual: number
  stok: number
  rating: number
  trenPersen: number
}

export const produk: Produk[] = [
  { id: 'gen-klasik', nama: 'Generos Klasik', varian: 'Box 30 sachet', seriesKey: 1, harga: 165_000, terjual: 1842, stok: 320, rating: 4.9, trenPersen: 12.4 },
  { id: 'gen-madu', nama: 'Generos Milk Madu', varian: 'Box 30 sachet', seriesKey: 2, harga: 175_000, terjual: 1536, stok: 210, rating: 4.8, trenPersen: 8.1 },
  { id: 'gen-vanilla', nama: 'Generos Milk Vanilla', varian: 'Box 30 sachet', seriesKey: 3, harga: 175_000, terjual: 1274, stok: 95, rating: 4.8, trenPersen: -3.2 },
]

// ── Status pesanan ───────────────────────────────────────────────────────────
export type StatusPesanan =
  | 'Perlu Dikirim'
  | 'Sedang Dikirim'
  | 'Telah Dikirim'
  | 'Selesai'
  | 'Batal'

export const resumePesanan: { status: StatusPesanan; jumlah: number; tone: 'warning' | 'series1' | 'series3' | 'good' | 'critical' }[] = [
  { status: 'Perlu Dikirim', jumlah: 48, tone: 'warning' },
  { status: 'Sedang Dikirim', jumlah: 126, tone: 'series1' },
  { status: 'Telah Dikirim', jumlah: 214, tone: 'series3' },
  { status: 'Selesai', jumlah: 3921, tone: 'good' },
  { status: 'Batal', jumlah: 37, tone: 'critical' },
]

export type Pesanan = {
  id: string
  pembeli: string
  produk: string
  qty: number
  total: number
  status: StatusPesanan
  waktu: string
}

export const pesananTerbaru: Pesanan[] = [
  { id: 'INV-90418', pembeli: 'Rina Kartika', produk: 'Generos Milk Madu', qty: 2, total: 350_000, status: 'Perlu Dikirim', waktu: '5 mnt lalu' },
  { id: 'INV-90417', pembeli: 'Budi Santoso', produk: 'Generos Klasik', qty: 1, total: 165_000, status: 'Perlu Dikirim', waktu: '22 mnt lalu' },
  { id: 'INV-90416', pembeli: 'Sari Dewi', produk: 'Generos Milk Vanilla', qty: 3, total: 525_000, status: 'Sedang Dikirim', waktu: '48 mnt lalu' },
  { id: 'INV-90415', pembeli: 'Ahmad Fauzi', produk: 'Generos Klasik', qty: 2, total: 330_000, status: 'Sedang Dikirim', waktu: '1 jam lalu' },
  { id: 'INV-90414', pembeli: 'Maya Putri', produk: 'Generos Milk Madu', qty: 1, total: 175_000, status: 'Telah Dikirim', waktu: '2 jam lalu' },
  { id: 'INV-90413', pembeli: 'Doni Prasetyo', produk: 'Generos Milk Vanilla', qty: 4, total: 700_000, status: 'Selesai', waktu: '3 jam lalu' },
]

// ── Tren pesanan harian (30 hari) ────────────────────────────────────────────
export type TitikHarian = { hari: string; pesanan: number; selesai: number }

export const trenPesanan: TitikHarian[] = Array.from({ length: 30 }, (_, i) => {
  const base = 120 + Math.round(40 * Math.sin(i / 3) + i * 1.4)
  return {
    hari: `${i + 1} Sep`,
    pesanan: base,
    selesai: Math.round(base * (0.86 + 0.05 * Math.sin(i / 2))),
  }
})

// ── Penghasilan ──────────────────────────────────────────────────────────────
export const penghasilan = {
  totalPayout: 742_385_000,
  transaksiPayout: 4172,
  trenPersen: 14.2,
}

// Komponen penghasilan — interaktif: bisa ditambah/lepas dari Total.
export type KomponenPenghasilan = {
  key: string
  label: string
  nilai: number
  seriesKey: 1 | 2 | 3 | 4 | 5
  defaultInTotal: boolean
}

export const komponenPenghasilan: KomponenPenghasilan[] = [
  { key: 'penjualan', label: 'Penjualan produk', nilai: 812_640_000, seriesKey: 1, defaultInTotal: true },
  { key: 'ongkir', label: 'Subsidi ongkir', nilai: 24_180_000, seriesKey: 3, defaultInTotal: true },
  { key: 'komisi', label: 'Komisi marketplace', nilai: -58_920_000, seriesKey: 2, defaultInTotal: true },
  { key: 'admin', label: 'Biaya admin & layanan', nilai: -21_340_000, seriesKey: 4, defaultInTotal: true },
  { key: 'voucher', label: 'Voucher ditanggung penjual', nilai: -14_175_000, seriesKey: 5, defaultInTotal: true },
]

// Tren payout mingguan
export const trenPayout = [
  { minggu: 'Mgg 1', payout: 168_400_000 },
  { minggu: 'Mgg 2', payout: 182_950_000 },
  { minggu: 'Mgg 3', payout: 191_620_000 },
  { minggu: 'Mgg 4', payout: 199_415_000 },
]

// ── Statistik siaran langsung (live) ─────────────────────────────────────────
export const liveStats = {
  totalSesi: 12,
  penonton: 48_920,
  pesananLive: 684,
  omzetLive: 118_640_000,
  konversiPersen: 3.8,
}

export const liveTren = Array.from({ length: 12 }, (_, i) => ({
  sesi: `S${i + 1}`,
  penonton: 2800 + Math.round(1600 * Math.sin(i / 2) + i * 120),
  pesanan: 38 + Math.round(24 * Math.sin(i / 2) + i * 2),
}))

// ── Performa kampanye iklan ──────────────────────────────────────────────────
export type Kampanye = {
  nama: string
  belanja: number
  omzet: number
  roas: number
  status: 'Aktif' | 'Jeda'
}

export const kampanye: Kampanye[] = [
  { nama: 'Generos Klasik — Prospecting', belanja: 18_400_000, omzet: 92_300_000, roas: 5.0, status: 'Aktif' },
  { nama: 'Generos Madu — Retargeting', belanja: 12_100_000, omzet: 74_800_000, roas: 6.2, status: 'Aktif' },
  { nama: 'Generos Vanilla — Awareness', belanja: 9_600_000, omzet: 31_200_000, roas: 3.3, status: 'Jeda' },
  { nama: 'Bundle Family — Konversi', belanja: 15_800_000, omzet: 98_400_000, roas: 6.2, status: 'Aktif' },
]
