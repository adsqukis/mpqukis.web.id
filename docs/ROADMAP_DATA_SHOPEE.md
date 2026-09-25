# Roadmap Data Shopee — mpqukis.web.id

Daftar data Shopee Open Platform yang bisa ditarik tapi belum dipakai dashboard. Dikerjakan **satu per satu**, urut nomor, kecuali disepakati lain.

- **Sumber spec:** `open.shopee.com` diblokir dari environment Claude, jadi dipakai 451 file spec resmi di [congminh1254/shopee-sdk](https://github.com/congminh1254/shopee-sdk), folder `schemas/`, format `v2.<modul>.<api>.json`. Isinya permission, field, error code, dan update log per endpoint.
- **Kategori app:** hampir pasti *Seller In House System* (cuma kategori ini yang punya Ads + Order + Payment sekaligus). Konfirmasi di Console → App List.
- **Di luar jangkauan app ini:** AMS/affiliate, Livestream, Video, dan Business Insights butuh app kategori lain. Iklan Toko dan chat pembeli nggak ada di API. CPAS datanya ada di Meta.

## Aturan umum tiap poin

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
| 10 | Iklan: fix per-produk + data yang belum dipakai | belum (butuh #3) |

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
- **Fix dulu:** grouping iklan per produk sekarang nebak dari nama campaign (`AF_PRODUCT_GROUPS`). Ganti dengan `common_info.item_id_list` + `auto_product_ads_info` (info_type 4) dari `get_product_level_campaign_setting_info`, lalu petakan lewat peta dari poin 3.
- **Tes:** `get_gms_item_performance` (performa per item). Butuh toko di-whitelist "Product GMS" (error `ads_error_not_whitelisted_for_product_gms`).
- **Lalu:** `get_product_campaign_hourly_performance`, keyword + bid (info_type 2), target ROAS (info_type 3), rekomendasi (`get_recommended_item_list`, `get_recommended_keyword_list`, `get_create_product_ad_budget_suggestion`).

## Keputusan yang masih menunggu

- Tab "Generos 1 Box" sebenarnya produk **Generos Klasik** menurut master SKU. Ganti nama tab-nya?
- Server lama (VPS sebelum migrasi): matikan proses backend mpqukis saja. Masih menunggu hasil diagnostic.
