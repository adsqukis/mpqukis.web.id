# Roadmap Data Shopee — mpqukis.web.id

Daftar data Shopee Open Platform yang bisa ditarik tapi belum dipakai dashboard. Dikerjakan **satu per satu**, urut nomor, kecuali disepakati lain.

- **Sumber spec:** `open.shopee.com` diblokir dari environment Claude, jadi dipakai 451 file spec resmi di [congminh1254/shopee-sdk](https://github.com/congminh1254/shopee-sdk), folder `schemas/`, format `v2.<modul>.<api>.json`. Isinya permission, field, error code, dan update log per endpoint.
- **Kategori app:** hampir pasti *Seller In House System* (cuma kategori ini yang punya Ads + Order + Payment sekaligus). Konfirmasi di Console → App List.
- **Di luar jangkauan app ini:** API AMS (data per kreator), Livestream, Video, dan Business Insights butuh app kategori lain. Iklan Toko dan chat pembeli nggak ada di API. CPAS datanya ada di Meta. Komisi affiliate per pesanan tetap bisa ditarik lewat escrow (lihat bagian Affiliate).

## Aturan umum tiap poin

- Fitur backend baru dibuat sebagai modul `ext_<nama>.py` (contoh: `ops/ext_affiliate.py`) yang mendaftarkan route ke `EXT_ROUTES`. Titik sambungnya dipasang sekali di `app.py` oleh `ops/install_ext.py`; modul berikutnya cukup ditaruh di folder backend lalu restart. Route modul otomatis kena cek `X-MP-Key`, dan modul yang error tidak menjatuhkan backend.
- Route backend baru di `do_GET` otomatis kena cek `X-MP-Key` (kecuali `/health`). Frontend otomatis kirim key lewat patch `window.fetch`.
- Rate limit Ads ada 4 lapis (partner / shop / API / campaign). Tambahan tarikan harus di-cache, jangan dipanggil tiap render.
- Backend di VPS baru hasil konsolidasi (`~/shopee-backend`, service `mpqukis-backend`). Frontend deploy lewat merge ke `main` (GitHub Pages).
- Selesai = data asli tampil di dashboard dan sudah dicek, bukan cuma "deploy sukses".

## Poin

| # | Area | Status |
|---|---|---|
| 1 | Pesanan & pembeli → CRM/RFM | belum |
| 2 | Keuangan per order → laba bersih | belum |
| 3 | Produk: katalog, stok, performa organik | belum |
| 4 | Ulasan + analisis sentimen | belum |
| 5 | Retur & refund | belum |
| 6 | Stok gudang Shopee + kedaluwarsa | belum |
| 7 | Kesehatan toko | belum |
| 8 | Promo | belum |
| 9 | Logistik & info toko | belum |
| 10 | Iklan: fix per-produk + data yang belum dipakai | fix per-produk: siap deploy, tunggu cek vs Seller Centre |

### 1. Pesanan & pembeli → CRM/RFM
- **Endpoint:** `v2.order.get_order_list` (maks 15 hari per request), `v2.order.get_order_detail`.
- **Kerjaan:** `build_recs` di `pull_export.py` / `pull_range.py` sekarang cuma simpan order, status, SKU, qty. `buyer_user_id` sudah diminta ke Shopee tapi dibuang. Simpan `buyer_user_id`, `buyer_username`, total order, `create_time`, kota/provinsi. Tarik ulang histori. Bikin endpoint RFM + tampilan segmen & sebaran kota.
- **Cek dulu:** field alamat/HP ke-masking atau nggak buat toko ini (kata spec: tergantung market & tipe seller).
- **Risiko:** pakai nomor HP pembeli Shopee buat blast WhatsApp bentrok aturan Shopee (bawa pembeli keluar platform) dan UU PDP.

### 2. Keuangan per order → laba bersih
- **Endpoint:** `v2.payment.get_escrow_detail` / `get_escrow_detail_batch` / `get_escrow_list`, `get_income_overview`, `get_income_detail`, `get_wallet_transaction_list`, `get_income_report`, `get_income_statement`.
- **Kerjaan:** rincian potongan per order sampai level item (komisi, biaya layanan/transaksi/kampanye, ongkir & subsidi, voucher lu vs Shopee, koin, refund) → laba bersih per order dan per produk.
- **Butuh dari user:** HPP per SKU.

### 3. Produk: katalog, stok, performa organik
- **Endpoint:** `v2.product.get_item_list`, `get_item_base_info`, `get_model_list`, `get_item_extra_info` (terjual, views, likes, rating, jumlah ulasan), `get_item_promotion`, `get_boosted_list`, `get_item_content_diagnosis_result`, `get_item_violation_info`.
- **Kerjaan:** tab produk (harga, stok, terjual, views, rating, skor kualitas listing).
- **Sekalian:** peta `item_id → model/SKU → grup produk`, pakai master SKU di `parse_export.py`: Generos Klasik (QKS-GEN01/02/03), Generos 1 Botol (QKS-GEN1), Generos Milk (Vanilla/Madu). Peta ini dipakai poin 10.

### 4. Ulasan + analisis sentimen
- **Endpoint:** `v2.product.get_comment` (maks 1000 per tarikan). Untuk membalas: `v2.product.reply_comment`.
- **Kerjaan:** feed ulasan per produk, distribusi bintang, analisis sentimen AI, draft balasan.
- **Aturan:** kirim balasan wajib lewat persetujuan manusia, jangan otomatis.

### 5. Retur & refund
- **Endpoint:** `v2.returns.get_return_list`, `get_return_detail`, `get_return_dispute_reason`, `get_reverse_tracking_info`.
- **Kerjaan:** retur rate dan alasan terbanyak per produk, nominal refund, retur yang mendekati deadline respons.

### 6. Stok gudang Shopee + kedaluwarsa
- **Endpoint:** `v2.sbs.get_bound_whs_info`, `get_current_inventory`, `get_expiry_report`, `get_stock_aging`, `get_stock_movement`.
- **Langkah pertama:** tes apakah endpoint ini kebuka buat toko ini (`shop_fulfillment_flag` = `PFF - FBS Shop`).
- **Kalau kebuka:** alert stok hampir expired per SKU per gudang (normal / hampir expired / expired / diblok / rusak).

### 7. Kesehatan toko
- **Endpoint:** `v2.account_health.get_shop_performance`, `get_metric_source_detail`, `get_penalty_point_history`, `get_punishment_history`, `get_listings_with_issues`, `get_late_orders`.
- **Kerjaan:** panel skor toko (late shipment, non-fulfillment, cancel/return rate, chat response, rating, poin penalti) + alert order telat kirim dan listing bermasalah.

### 8. Promo
- **Endpoint:** `v2.voucher.get_voucher_list` / `get_voucher`, `v2.discount.get_discount_list` / `get_discount`, `v2.bundle_deal.*`, `v2.add_on_deal.*`, `v2.shop_flash_sale.get_shop_flash_sale_list` / `get_shop_flash_sale_items`, `v2.follow_prize.*`, `v2.top_picks.get_top_picks_list`.
- **Kerjaan:** tab promo (kuota vs terpakai) + omzet per promo, dengan menyilangkan `promotion_type` di item order.

### 9. Logistik & info toko
- **Endpoint:** `v2.logistics.get_tracking_info`, `get_channel_list`, `get_operating_hours`; `v2.shop.get_profile`, `get_shop_holiday_mode`, `get_shop_notification`.
- **Kerjaan:** status pengiriman dan paket yang nyangkut, notifikasi Seller Center di dashboard.

### 10. Iklan: fix per-produk + data yang belum dipakai
- **Temuan dari data asli (`ops/ads_discovery.py`, 19–25/09):**
  - Campaign GMS (iklan otomatis toko) tidak muncul di `get_product_campaign_daily_performance`, jadi sekitar 31% biaya iklan produk tidak kelihatan di tab per produk. Datanya cuma ada di `get_gms_campaign_performance` / `get_gms_item_performance`.
  - Dashboard lama memakai ROAS broad (pembelian produk apa pun di toko). ROAS langsung iklan manual jauh lebih rendah: 1 Botol 1,05x (tampil 7,36x), Milk 2,37x (tampil 5,22x), Klasik 13,73x (tampil 16,86x).
  - Ke-120 campaign punya `item_id_list`, jadi produk bisa dipetakan pasti lewat SKU, tidak perlu menebak dari nama.
- **Sudah dikerjakan (iklan v2):**
  - Backend `ops/ads_v2.py`, dipasang dengan `ops/install_ads_v2.py`. Grup produk diambil dari `item_id_list` → SKU listing/varian → master SKU `parse_export.py`, dengan katalog item di-cache 12 jam. Campaign berisi lebih dari 1 produk masuk "Campuran", produk di luar master masuk "Lainnya".
  - GMS ikut dihitung per listing. Angka langsung dan broad dikirim terpisah.
  - Frontend: tiap tab produk menampilkan ringkasan (angka langsung jadi angka utama), perbandingan manual vs GMS, tabel campaign manual (bidding, target ROAS, jumlah keyword), dan tabel listing GMS.
- **Selesai kalau:** angka 7 hari per produk cocok dengan Seller Centre.
- **Berikutnya:** `get_product_campaign_hourly_performance`, detail keyword + bid (info_type 2), rekomendasi (`get_recommended_item_list`, `get_recommended_keyword_list`, `get_create_product_ad_budget_suggestion`).

### Affiliate (di luar urutan, diminta user 25/09)
- **Sumber:** `v2.payment.get_escrow_detail_batch` (`order_ams_commission_fee`, `items[].ams_commission_fee`), `v2.order.get_order_detail` (status terkini pesanan affiliate, supaya pesanan batal tidak dihitung), `v2.payment.get_wallet_transaction_list` (tipe 455/456/460: biaya affiliate lewat saldo).
- **Sudah dikerjakan:** backend `ops/ext_affiliate.py` (route `/api/affiliate/summary`, maks 31 hari, escrow di-cache per pesanan, pesanan > 30 hari dianggap final) dan tab Affiliate: ringkasan (penjualan, pesanan, komisi, rate, biaya lewat saldo, ROAS affiliate), per produk, tren harian, pesanan affiliate terbaru, biaya lewat saldo. Diagnostic read-only: `ops/aff_discovery.py`.
- **Belum bisa tanpa AMS:** nama kreator, klik, ROI per kreator, performa konten. Butuh app baru kategori "Affiliate Marketing Solution Management" di Shopee Open Platform Console + otorisasi toko.
- **Belum dipakai:** pesanan sampel kreator (`affiliate_sample_type`); butuh puller harian menyimpan field ini.

## Keputusan

- Tab "Generos 1 Box" diganti jadi **Generos Klasik**, sesuai master SKU (QKS-GEN01/02/03).
- Sub-tab **iklan CPAS** disembunyikan sementara (flag `SHOW_CPAS` di `TabAds`). Isinya selama ini status AMS (afiliasi Shopee), padahal data CPAS ada di Meta Ads Manager, bukan di API Shopee.

## Keputusan yang masih menunggu

- Server lama (VPS sebelum migrasi): matikan proses backend mpqukis saja. Masih menunggu hasil diagnostic.
