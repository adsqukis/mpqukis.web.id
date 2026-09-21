# MP Qukis — Dashboard Seller (mpqukis.web.id)

Mirror frontend dari **mp.qukis.id** — dashboard monitoring marketplace Shopee
untuk **Generos Official Store** (pesanan, penghasilan, performa iklan).

- **Live:** https://mpqukis.web.id (GitHub Pages)
- **Data:** ditarik live dari `https://api.qukis.id/api/*` (CORS `*`)

Tab: **Overview · Pesanan · Penghasilan · Ads · Affiliate · Live**.

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
