# MP Qukis — Dashboard Seller

Dashboard seller marketplace untuk **Generos Official Store**. Dibangun ulang
dari static build lama menjadi proyek yang bisa diedit langsung dari repo dan
auto-deploy ke GitHub Pages di [mpqukis.web.id](https://mpqukis.web.id).

## Stack

- **Vite + React + TypeScript** — cepat, type-safe, modular
- **Tailwind CSS** — design system konsisten (token warna & surface di `tailwind.config.js`)
- **Recharts** — visualisasi (palette lolos validasi color-blind safe)

## Struktur

```
src/
  data/dashboard.ts      # SEMUA data terpusat — ganti di sini / sambungkan ke API
  lib/format.ts          # format rupiah, ribuan, persen
  lib/theme.ts           # token warna chart (sinkron dgn tailwind.config)
  components/
    layout/              # Sidebar, Topbar
    ui/                  # Card, StatTile, Badge, Icon
    charts/              # komponen Recharts + tooltip bersama
  features/
    OrdersTab.tsx        # tab Pesanan
    IncomeTab.tsx        # tab Penghasilan (interaktif: klik komponen ke Total)
    ProductsTab.tsx      # tab Produk + live + kampanye iklan
```

## Kembangkan

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # output ke dist/
```

## Ganti data

Semua angka ada di `src/data/dashboard.ts`. Ubah di situ, atau ganti isinya
dengan fetch ke API — komponen UI tidak perlu disentuh.

## Deploy

Push ke `main` → GitHub Actions build & publish otomatis (lihat
`.github/workflows/deploy.yml`). Domain diatur lewat `public/CNAME`.

**Setup sekali (di GitHub):** Settings → Pages → Source: **GitHub Actions**,
dan jadikan `main` sebagai default branch (Settings → General → Default branch)
agar lolos aturan proteksi environment `github-pages`.
