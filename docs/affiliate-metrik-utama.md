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

### Membuktikannya sendiri: `scripts/shopee-probe.mjs`

Klaim "AMS tidak ada di Open Platform" tidak perlu dipercaya begitu saja —
skrip diagnosa di `scripts/shopee-probe.mjs` mengujinya langsung. Tanpa
dependensi, Node 18+ saja. **Jalankan dari server/laptop yang punya akses
keluar, jangan dari browser** — skrip ini butuh partner key.

```bash
export SHOPEE_PARTNER_ID=2045868          # bukan rahasia; ikut di setiap URL request
export SHOPEE_PARTNER_KEY=...             # RAHASIA — dari environment, jangan ditulis di file

# 1. otorisasi toko (sekali saja)
node scripts/shopee-probe.mjs auth-url https://api.qukis.id/shopee/callback
node scripts/shopee-probe.mjs token <code> <shop_id>

# 2. uji modul mana yang terbuka
SHOPEE_SHOP_ID=... SHOPEE_ACCESS_TOKEN=... node scripts/shopee-probe.mjs probe

# 3. Affiliate Open API — platform terpisah, kredensial sendiri
export SHOPEE_AFFILIATE_APP_ID=...
export SHOPEE_AFFILIATE_SECRET=...        # RAHASIA
node scripts/shopee-probe.mjs affiliate
```

`probe` menjalankan dua kelompok:

- **KONTROL** (`shop/get_shop_info`, `ads/get_total_balance`) — membuktikan
  partner ID, partner key, tanda tangan, dan token memang benar.
- **KANDIDAT AMS** — daftar jalur hipotesis. Ini tebakan yang sedang diuji,
  bukan endpoint terdokumentasi.

Cara bacanya: **kontrol hijau + semua kandidat `TIDAK ADA`** = AMS memang tidak
terbuka untuk aplikasi ini. Kalau kontrolnya sendiri merah, yang salah
kredensial/otorisasi — hasil kandidat belum bisa dipercaya, dan skrip menolak
menarik kesimpulan.

Shopee membalas HTTP 200 dengan field `error` di body bahkan saat gagal. Jadi
balasan non-JSON atau status non-2xx berarti request tidak sampai ke Shopee
(proxy/firewall), dan dilaporkan `TIDAK KONKLUSIF` — bukan sebagai bukti
endpoint ada.

### Kredensial Affiliate Open API tanpa dokumentasi

Kredensial Affiliate Open API sering diberikan tanpa dokumentasi. Perintah
`affiliate` dirancang untuk keadaan itu dan tidak menebak apa pun:

1. **Menemukan skema tanda tangan.** Dicoba dua kombinasi lazim —
   `SHA256(appId + ts + payload + secret)` dan
   `HMAC-SHA256(secret, appId + ts + payload)` — terhadap endpoint `.co.id`
   dan `.com`, lalu dilaporkan mana yang diterima. Ditolak karena tanda tangan
   salah dibedakan dari gagal karena jaringan: yang pertama membalas JSON
   GraphQL, yang kedua tidak membalas JSON sama sekali. Tanpa pembedaan itu,
   jaringan yang memblokir terbaca seolah kredensialnya ditolak.

2. **Menanyakan isinya ke API.** Begitu satu kombinasi lolos, dijalankan
   introspeksi GraphQL — API menyebutkan sendiri seluruh query yang tersedia
   beserta parameter dan tipe hasilnya. Daftar kemampuan didapat tanpa dokumen.

3. **Menilai relevansinya.** Query yang namanya menyiratkan sisi toko/penjual
   ditandai, karena layar Metrik Utama butuh data penjual, bukan data konversi
   milik satu akun affiliate.

Kalau introspeksi dimatikan di sisi server, yang perlu diminta ke pemberi
kredensial hanya daftar nama query dan parameternya — bukan dokumen lengkap.

### Affiliate Open API bukan pengganti AMS

Perlu ditegaskan karena mudah tertukar: Affiliate Open API melayani **akun
affiliate** — konversi dan komisi milik akun itu sendiri. Metrik Utama adalah
sisi **penjual**: performa toko dari seluruh affiliate yang mempromosikannya.

Kredensial affiliate karena itu belum tentu membuka layar ini. Perintah
`affiliate` ada supaya pertanyaan tersebut dijawab bukti, bukan dugaan. Kalau
daftar query-nya ternyata seluruhnya laporan milik akun affiliate, jalur export
tetap dipakai.

### Partner ID vs partner key

| | `SHOPEE_PARTNER_ID` = `2045868` | `SHOPEE_PARTNER_KEY` (`shpk…`) |
|---|---|---|
| Sifat | pengenal aplikasi, **bukan rahasia** | **rahasia** |
| Terlihat di | query string setiap request | tidak pernah keluar dari server |
| Kalau bocor | tidak apa-apa sendirian | putar ulang segera |
| Boleh di repo frontend | sebaiknya tetap lewat env | **tidak pernah** |

Keduanya sepasang untuk **satu** platform: Open Platform Seller API. Menambah
partner ID tidak menambah modul — ia hanya menandai aplikasi mana yang
menandatangani request.

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

## 4. Import file export

Tombol **Import** membaca hasil export dari halaman Metrik Utama, **.xlsx maupun
.csv**. Jenis file dikenali dari isinya (magic bytes `PK`), bukan dari
ekstensinya — nama file bisa salah, isinya tidak.

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

### .xlsx tanpa dependensi

`src/affiliate/xlsx.js` membaca .xlsx sendiri: format itu hanya arsip ZIP berisi
XML, dan inflate-nya memakai `DecompressionStream` bawaan browser.

Alasannya bukan menghindari pustaka demi menghindari pustaka. Paket `xlsx` di
npm berhenti di 0.18.5 dan punya riwayat security advisory; `exceljs` berukuran
puluhan MB. Keduanya berlebihan untuk membaca satu sheet datar. Pembaca sendiri
ini ter-*code split* menjadi chunk ~3,6 KB (1,8 KB gzip) yang baru diunduh saat
tombol import dipakai, jadi halaman awal tidak ikut berat.

Yang ditangani: entri ZIP `stored` maupun `deflate`, `sharedStrings`, sel
`inlineStr`, kolom kosong yang dilewat Excel, urutan sheet sesuai
`workbook.xml`, dan **sel tanggal asli Excel** (angka serial + format tanggal
dari `styles.xml`) yang dikonversi ke ISO. ZIP64 ditolak dengan pesan jelas,
bukan dibaca separuh.

### Riwayat menumpuk antar import

Import berikutnya **menambah**, bukan menimpa. Baris dikunci `tanggal + kanal`;
import terbaru menang, karena angka pesanan di Shopee masih bisa dikoreksi
beberapa hari setelahnya.

Efek praktisnya: export harian bikin grafik tren makin panjang, melewati batas
rentang satu file. Semua disimpan di `localStorage`, jadi bertahan setelah
refresh. Kalau tanggal yang dipilih tidak ada, UI memberi tahu tanggal mana yang
dipakai sebagai gantinya.

---

## 5. Struktur file

```
scripts/
  shopee-probe.mjs   diagnosa akses API (dev tool, tidak ikut ter-bundel)
src/
  shared/
    format.js          formatter angka/tanggal, preset rentang (tanpa React)
    ui.jsx             StatCard, Card, Badge, InfoNote, MetricTile, RangeCalendar
  affiliate/
    model.js           metrik, parser CSV, normalisasi API, data contoh
    xlsx.js            pembaca .xlsx tanpa dependensi (lazy-loaded)
    TabAffiliate.jsx   layar Metrik Utama
```

`shared/` dipisah supaya tab lain ikut memakainya dan `model.js` bisa diuji
tanpa merender React.
