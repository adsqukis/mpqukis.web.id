# MP Qukis — Dashboard Seller (mpqukis.web.id)

Mirror frontend dari **mp.qukis.id** — dashboard monitoring marketplace Shopee
untuk **Generos Official Store** (pesanan, penghasilan, performa iklan).

- **Live:** https://mpqukis.web.id (GitHub Pages)
- **Data:** ditarik live dari `https://api.qukis.id/api/*` (CORS `*`)

Tab: **Overview · Pesanan · Penghasilan · Ads · Affiliate · Live**.

## Affiliate — Metrik Utama

Tab **Affiliate** meniru layar *Metrik Utama* di Affiliate Marketing Solution
(Seller Centre): 8 kartu KPI, filter tipe pesanan & periode, dan sub-tab kanal
(Semua / Shopee Live / Shopee Video / Media Sosial).

AMS **belum punya endpoint di Shopee Open Platform**, jadi layar ini punya tiga
sumber data: `Live API` (kalau backend sudah menyediakannya), `File CSV` (import
hasil export Seller Centre, .xlsx atau .csv — jalur yang jalan hari ini), dan `Contoh` (berlabel
`CONTOH`, untuk menilai tata letak). Tanpa data, kartu menampilkan `—`, bukan 0.

> **Kredensial:** repo ini statis — apa pun di sini terkirim ke browser. Partner
> key Shopee hanya boleh hidup sebagai environment variable di backend, tidak
> pernah di repo ini (termasuk `VITE_*`, yang ikut ter-bundel).

Detail kontrak endpoint, alias kolom CSV, dan struktur modul:
[`docs/affiliate-metrik-utama.md`](docs/affiliate-metrik-utama.md).

## Stack

React + Vite + Recharts + lucide-react (source identik dengan `adsqukis/mp.qukis.id`
folder `frontend/`).

## Kembangkan

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # output ke dist/
```

## Deploy

Push ke `main` → GitHub Actions build & publish `dist/` ke Pages
(`.github/workflows/deploy.yml`). Domain via `public/CNAME`; data selalu
ditarik dari `api.qukis.id`, jadi tidak perlu backend di sini.

> Catatan: ini mirror tampilan/fitur mp.qukis.id. Untuk versi upgrade
> (redesign, struktur modular, TypeScript) lihat riwayat branch sebelumnya.
