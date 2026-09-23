# Affiliate — Metrik Utama

Catatan teknis untuk layar **Affiliate → Metrik Utama** (`src/affiliate/`).

---

## 1. Kredensial: jangan pernah masuk ke repo ini

Repo ini **frontend statis** yang di-deploy ke GitHub Pages. Semua yang ada di
sini terkirim ke browser dan bisa dibaca siapa pun lewat *view source* atau file
bundel di `dist/assets/*.js`.

Artinya:

- **Partner key Shopee Open Platform tidak boleh ada di repo ini** — tidak di
  kode, tidak di `.env`, tidak di variabel build Vite. Semua `VITE_*` ikut
  ter-bundel ke output.
- Partner key hanya boleh hidup sebagai environment variable di backend
  (`api.qukis.id`), tempat tanda tangan HMAC-SHA256 dibuat.
- Frontend memanggil backend sendiri; backend yang memanggil Shopee.

Partner key dipakai untuk menandatangani seluruh request Open Platform atas nama
aplikasi. Kalau bocor, pihak lain bisa memanggil API untuk toko yang sudah
memberi otorisasi. **Kalau sebuah key pernah terkirim lewat chat, email, tiket,
atau screenshot — anggap sudah terekspos dan putar ulang (rotate) di Shopee Open
Platform console.**

---

## 2. Kenapa layar ini punya tiga sumber data

Angka di Metrik Utama berasal dari **Affiliate Marketing Solution (AMS)** di
Seller Centre (`Promosi Saya → Affiliate Marketing Solution → Metrik Utama`).

Sampai catatan ini ditulis, **AMS tidak punya endpoint publik di Shopee Open
Platform v2**. Yang perlu dibedakan:

| Platform | Kredensial | Untuk siapa | Isi |
|---|---|---|---|
| Shopee Open Platform (Seller API) | `partner_id` + partner key (`shpk…`) | Penjual | shop, order, item, logistics, payment, **ads** |
| Shopee Affiliate Open API | App ID + App Secret terpisah | **Affiliate/kreator** | laporan konversi milik kreator itu sendiri |
| AMS di Seller Centre | sesi login Seller Centre | Penjual | layar di dokumen ini |

Partner key toko membuka kolom pertama, bukan yang ketiga. Karena itu modul ini
punya tiga sumber yang dipakai berurutan (`src/affiliate/model.js`):

1. **`live`** — backend sendiri, kalau/ketika endpoint AMS tersedia.
2. **`csv`** — hasil export dari halaman Metrik Utama, di-import lewat browser.
   **Ini satu-satunya jalur yang jalan hari ini tanpa API baru.**
3. **`demo`** — angka contoh untuk menilai tata letak. Selalu berlabel `CONTOH`.

Kalau tidak ada sumber yang berhasil, kartu menampilkan `—`, **bukan 0**. Nol
adalah angka; tidak ada data bukan.

### Opsi menuju data live

- **Export CSV berkala** (jalan sekarang, tanpa risiko). Bisa dinaikkan jadi
  semi-otomatis: unggah export harian ke storage, backend yang parsing.
- **Minta akses API AMS** lewat account manager / BD Shopee. Jalur resmi,
  perlu waktu, tapi paling tahan lama.
- **Scraping endpoint internal Seller Centre pakai cookie sesi.** Secara teknis
  bisa, tapi rapuh (berubah tanpa pemberitahuan), berpotensi melanggar ToS, dan
  bisa berujung tindakan ke akun. Tidak diimplementasikan di sini.

---

## 3. Kontrak endpoint backend

Kalau backend nanti menyediakan data AMS, frontend sudah siap memakainya tanpa
perubahan kode.

```
GET https://api.qukis.id/api/affiliate/metrics
      ?order_type=confirmed|created
      &period=day|week|month
      &date=YYYY-MM-DD
      &channel=all|live|video|social
      &timezone=Asia/Jakarta
```

Respons:

```jsonc
{
  "updated_at": "2026-09-22T15:35:00+07:00",
  "current": {
    "sales": 24900000,
    "items_sold": 73,
    "orders": 72,
    "clicks": 1041,
    "est_commission": 1042000,
    "roi": 23.9,
    "buyers": 72,
    "new_buyers": 48
  },
  "previous": { "...": "bentuk sama; dipakai untuk delta \"vs Kemarin\"" },
  "series": [
    { "date": "2026-09-08", "sales": 21300000, "...": "..." }
  ]
}
```

Aturan:

- **Metrik yang tidak tersedia dikirim `null`**, jangan `0`. UI menampilkan `—`.
- `previous` boleh `null` — delta jadi `—`, bukan `0%`.
- `roi` boleh dihilangkan; frontend menurunkannya dari `sales / est_commission`.
- `series` opsional; dipakai untuk grafik tren. Butuh minimal 2 titik.
- Normalisasi respons sengaja longgar (`normalizeApiPayload`): nama field
  boleh camelCase, snake_case, atau berbahasa Indonesia.

---

## 4. Import CSV

Tombol **Import CSV** membaca hasil export dari halaman Metrik Utama.

Parser (`parseAffiliateCsv`) dibuat toleran karena nama kolom export berubah
antar versi dan antar bahasa:

- Pemisah terdeteksi otomatis: `,` `;` tab `|`.
- Baris judul sebelum header dilewati (header dicari sampai 8 baris pertama).
- Header dicocokkan lewat daftar alias, ID maupun EN. Kolom yang lebih spesifik
  dicocokkan lebih dulu supaya *Pembeli Baru* tidak tertangkap alias *Pembeli*.
- Angka: `Rp 24.900.000`, `24,9`, `1,234.56`, `12%` semua terbaca benar —
  pemisah ribuan/desimal ditebak dari pola, bukan diasumsikan.
- Tanggal: `21-09-2026`, `21/09/2026`, `2026-09-21`.
- `ROI` diturunkan kalau kolomnya tidak ada.

Hasil parsing disimpan di `localStorage`, jadi bertahan setelah refresh. Kalau
tanggal yang dipilih tidak ada di file, UI memberi tahu tanggal mana yang
dipakai sebagai gantinya.

---

## 5. Struktur file

```
src/
  shared/
    format.js          formatter angka/tanggal, preset rentang (tanpa React)
    ui.jsx             StatCard, Card, Badge, InfoNote, MetricTile, RangeCalendar
  affiliate/
    model.js           metrik, parser CSV, normalisasi API, data contoh
    TabAffiliate.jsx   layar Metrik Utama
```

`shared/` dipisah supaya tab lain ikut memakainya dan `model.js` bisa diuji
tanpa merender React.
